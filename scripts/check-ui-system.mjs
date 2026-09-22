import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import postcss from 'postcss';
import ts from 'typescript';
import { redundantDeclarations, supersededDeclarations } from './css-rules.mjs';

const owned = /^--(?:ui-|layout-|dialog-|interaction-|motion-|layer-)/;
const legacy =
  /^--ui-(?:title|section|body|dense|meta|control|field|radius|card-radius|gap|panel|line|muted|border)$/;
export function auditUiRules(files) {
  const errors = [];
  const declared = new Set();
  const references = [];
  const themes = { light: new Map(), dark: new Map() };
  for (const [file, source] of Object.entries(files)) {
    for (const match of source.matchAll(/(--[\w-]+)['"]?\s*:/g))
      declared.add(match[1]);
    for (const match of source.matchAll(/var\(\s*(--[\w-]+)/g)) {
      references.push([file, match[1]]);
      if (legacy.test(match[1]))
        errors.push(`${file}: obsolete token ${match[1]}`);
    }
    if (!file.endsWith('ui-tokens.css')) continue;
    const css = postcss.parse(source);
    for (const rule of css.nodes) {
      if (rule.type !== 'rule' || ![':root', '.dark'].includes(rule.selector))
        continue;
      const seen = new Set();
      rule.walkDecls((d) => {
        if (!d.prop.startsWith('--')) return;
        if (seen.has(d.prop))
          errors.push(`${file}: duplicate ${d.prop} in ${rule.selector}`);
        seen.add(d.prop);
        if (rule.selector === ':root') themes.light.set(d.prop, d.value);
        themes.dark.set(d.prop, d.value);
      });
    }
  }
  for (const [file, name] of references)
    if (owned.test(name) && !declared.has(name))
      errors.push(`${file}: undefined token ${name}`);
  for (const [theme, values] of Object.entries(themes)) {
    const visited = new Set(),
      active = new Set();
    const visit = (name) => {
      if (active.has(name)) {
        errors.push(`${theme}: circular token ${name}`);
        return;
      }
      if (visited.has(name) || !values.has(name)) return;
      active.add(name);
      for (const m of values.get(name).matchAll(/var\(\s*(--[\w-]+)/g))
        visit(m[1]);
      active.delete(name);
      visited.add(name);
    };
    for (const name of values.keys()) visit(name);
  }
  // Guard live controls, including drawers, tooltips and mobile navigation.
  const live = reachableComponents(files);
  for (const [file, source] of Object.entries(files)) {
    if (!file.startsWith('components/ui/') || (live && !live.has(file)))
      continue;
    if (/\bduration-\d+\b/.test(source))
      errors.push(`${file}: use shared motion recipe`);
    if (/\btransition-all\b/.test(source))
      errors.push(`${file}: transition only the required properties`);
    if (/\bshadow-(?:sm|md|lg|xl|2xl)\b/.test(source))
      errors.push(`${file}: use shared elevation tokens`);
    if (/\bz-(?:40|50|60|70|80|90)\b/.test(source))
      errors.push(`${file}: use shared layer tokens`);
  }
  for (const [file, source] of Object.entries(files)) {
    if (file.endsWith('.css')) {
      const css = postcss.parse(source);
      css.walkDecls('font-family', (d) => {
        if (!/^(?:inherit|var\(--ui-font-(?:sans|mono)\)|var\(--font-(?:sans|mono|heading)\))$/.test(d.value.trim()))
          errors.push(`${file}:${d.source.start.line}: use shared system font token`);
      });
      css.walkDecls('font', (d) => {
        if (!/^(?:inherit|initial|unset|revert|revert-layer)$/.test(d.value.trim()) &&
            !/var\(--(?:ui-font-(?:sans|mono)|font-(?:sans|mono|heading))\)\s*$/.test(d.value))
          errors.push(`${file}:${d.source.start.line}: use shared system font token in font shorthand`);
      });
      for (const d of new Set([...redundantDeclarations(css), ...supersededDeclarations(css)]))
        errors.push(
          `${file}:${d.source.start.line}: redundant ${d.prop} in ${d.parent.selector}`,
        );
      if (
        /\.(?:calendar-task(?:-body)?|calendar-edge(?:-start|-end)?|calitem)\b/.test(
          source,
        )
      )
        errors.push(`${file}: retired calendar renderer selector`);
    }
    if (live && /^components\/.*\.tsx?$/.test(file) && !live.has(file))
      errors.push(`${file}: component is not reachable from an app entry`);
  }
  const sharedCopy = new Map();
  if (files['lib/ui-copy.ts']) {
    const ast = ts.createSourceFile(
      'copy.ts',
      files['lib/ui-copy.ts'],
      ts.ScriptTarget.Latest,
      true,
    );
    function collect(node) {
      if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer))
        sharedCopy.set(
          node.initializer.text,
          node.name.text || node.name.getText(ast),
        );
      ts.forEachChild(node, collect);
    }
    collect(ast);
  }
  // A shared action must not acquire another name in a different view.
  const retiredCopy = new Map([
    ['移回收集箱', '取消排期'],
    ['移至未排期', '取消排期'],
    ['松开移至未排期', '松开取消排期'],
    ['松开移回未排期 · 移除日期与时间', '松开取消排期'],
    ['手动设置', '手动排期'],
    ['任务状态', '状态'],
    ['项目颜色', '颜色'],
    ['项目名称', '名称'],
    ['任务名称', '名称'],
  ]);
  for (const [file, source] of Object.entries(files)) {
    if (!file.startsWith('components/') || !file.endsWith('.tsx')) continue;
    if (/['"]next\/font(?:\/[^'"]+)?['"]/.test(source))
      errors.push(`${file}: use shared system font token instead of a font loader`);
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node) {
      const phrase = ts.isStringLiteral(node)
        ? node.text
        : ts.isJsxText(node)
          ? node.text.trim()
          : '';
      if (retiredCopy.has(phrase))
        errors.push(
          `${file}: use shared copy for ${retiredCopy.get(phrase)} instead of ${phrase}`,
        );
      if (sharedCopy.has(phrase))
        errors.push(
          `${file}: reference uiCopy.${sharedCopy.get(phrase)} instead of duplicating ${phrase}`,
        );
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  return [...new Set(errors)];
}
/** Resolve app imports, including lazy views, so unused product and UI components cannot accumulate. */
export function reachableComponents(files) {
  const roots = Object.keys(files).filter(
    (file) =>
      file.startsWith('app/') && /\/(?:page|layout|route)\.tsx?$/.test(file),
  );
  if (!roots.length) return null;
  const seen = new Set();
  function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    const ast = ts.createSourceFile(
      file,
      files[file],
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function follow(specifier) {
      const base = specifier.startsWith('@/')
        ? specifier.slice(2)
        : specifier.startsWith('.')
          ? path.posix.normalize(
              path.posix.join(path.posix.dirname(file), specifier),
            )
          : null;
      if (!base) return;
      const target = [
        base,
        base + '.ts',
        base + '.tsx',
        base + '/index.ts',
        base + '/index.tsx',
      ].find((candidate) => candidate in files);
      if (target) visit(target);
    }
    function walk(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        follow(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      )
        follow(node.arguments[0].text);
      ts.forEachChild(node, walk);
    }
    walk(ast);
  }
  roots.forEach(visit);
  return seen;
}

function collect(root, dir, files = {}) {
  for (const entry of readdirSync(path.join(root, dir), {
    withFileTypes: true,
  })) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) collect(root, relative, files);
    else if (/\.(?:css|tsx?)$/.test(entry.name))
      files[relative] = readFileSync(path.join(root, relative), 'utf8');
  }
  return files;
}
export function collectUiSources(root) {
  const files = {};
  for (const dir of ['app', 'components', 'hooks', 'lib'])
    collect(root, dir, files);
  return files;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const files = collectUiSources(root);
  const errors = auditUiRules(files);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      `UI rules passed: ${Object.keys(files).length} source files; tokens, shared copy, control motion/elevation/layers, CSS redundancy and live component imports.`,
    );
}
