import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

/** Only identical declarations under the same selector and parent are redundant.
 * Different values (including compatibility fallbacks), media, layers and priority stay intact.
 * Never move a rule: moving it can change its relationship with other selectors.
 */
export function redundantDeclarations(root) {
  const duplicates = [];
  function visit(container) {
    const final = new Map();
    for (const node of [...(container.nodes || [])].reverse()) {
      if (node.type === 'atrule') {
        visit(node);
        continue;
      }
      if (node.type !== 'rule') continue;
      // Keyframe steps are animation data, not style selectors.
      if (container.type === 'atrule' && /keyframes$/i.test(container.name))
        continue;
      for (const declaration of [...(node.nodes || [])].reverse()) {
        if (declaration.type !== 'decl') continue;
        const key = `${node.selector}\0${declaration.prop}\0${!!declaration.important}`;
        if (!final.has(key)) final.set(key, declaration.value);
        else if (final.get(key) === declaration.value)
          duplicates.push(declaration);
      }
    }
  }
  visit(root);
  return duplicates;
}

export function compactCss(source) {
  const root = postcss.parse(source);
  const duplicates = redundantDeclarations(root);
  for (const declaration of duplicates) declaration.remove();
  root.walkRules((rule) => {
    if (!rule.nodes.length) rule.remove();
  });
  return { css: root.toString(), removed: duplicates.length };
}

/** Find declarations replaced by later rules in the same cascade context.
 * A comma group is removable only when every branch is covered. Rules stay in
 * place; media, supports, layers, state selectors and in-rule fallbacks stay distinct.
 */
export function supersededDeclarations(root) {
  const rules = [];
  root.walkRules((rule) => {
    const context = [];
    for (let parent = rule.parent; parent.type !== 'root'; parent = parent.parent) {
      if (parent.type !== 'atrule' || /keyframes$/i.test(parent.name)) return;
      context.unshift([parent.name, parent.params]);
    }
    rules.push({ rule, context: JSON.stringify(context) });
  });
  const later = new Map();
  const superseded = [];
  for (const { rule, context } of rules.reverse()) {
    const selectors = equivalentSelectorBranches(rule.selector);
    const declarations = rule.nodes.filter((node) => node.type === 'decl');
    const counts = new Map();
    for (const d of declarations) counts.set(d.prop, (counts.get(d.prop) || 0) + 1);
    for (const d of declarations) {
      // Keep explicit compatibility fallbacks and vendor-prefixed declarations.
      if (counts.get(d.prop) !== 1 || /^-(?!-)/.test(d.prop)) continue;
      const covered = selectors.every((selector) => {
        const key = `${context}\0${selector}\0${d.prop}\0`;
        return later.has(key + 'true') || (!d.important && later.has(key + 'false'));
      });
      if (covered) superseded.push(d);
    }
    for (const d of declarations) {
      if (counts.get(d.prop) !== 1 || /^-(?!-)/.test(d.prop)) continue;
      for (const selector of selectors) {
        later.set(`${context}\0${selector}\0${d.prop}\0${!!d.important}`, d);
      }
    }
  }
  return superseded;
}

/** Expand only :is() compound choices with identical specificity. This is analysis
 * only: the original selector and its cascade position are never rewritten.
 */
function equivalentSelectorBranches(selector) {
  const result = [];
  const pending = [...selectorParser().astSync(selector).nodes];
  while (pending.length) {
    const branch = pending.pop();
    const choice = branch.nodes.find((node) => {
      if (node.type !== 'pseudo' || node.value !== ':is') return false;
      const weights = node.nodes.map((option) => {
        if (!option.nodes.every((n) => ['class', 'attribute'].includes(n.type))) return null;
        return option.nodes.length;
      });
      return weights.length && weights[0] !== null && weights.every((w) => w === weights[0]);
    });
    if (!choice || pending.length + result.length > 128) {
      result.push(branch.toString().replace(/\s+/g, ' ').trim());
      continue;
    }
    const index = branch.nodes.indexOf(choice);
    for (const option of choice.nodes) {
      const clone = branch.clone();
      clone.nodes[index].replaceWith(...option.nodes.map((node) => node.clone()));
      pending.push(clone);
    }
  }
  return result;
}
