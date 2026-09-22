import './register-tsx.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

/** Compile a test subject with explicit mocks; all other imports use real modules. */
export function compileSource(url, replacements = {}) {
  const require = createRequire(url);
  const root = new URL('../../', import.meta.url);
  const resolve = specifier => {
    if (replacements[specifier]) return replacements[specifier];
    if (!specifier.startsWith('.') && !specifier.startsWith('@/'))
      return new URL('file://' + require.resolve(specifier)).href;
    const base = specifier.startsWith('@/') ? new URL(specifier.slice(2), root) : new URL(specifier, url);
    for (const suffix of ['', '.ts', '.tsx', '.mjs', '.js']) {
      const candidate = new URL(base.href + suffix);
      if (existsSync(candidate)) return candidate.href;
    }
    throw new Error(`Unresolved test dependency ${specifier} from ${url}`);
  };
  let code = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  code = code.replace(/(from\s+)(['"])([^'"]+)\2/g, (_, prefix, quote, specifier) => prefix + JSON.stringify(resolve(specifier)));
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
}
