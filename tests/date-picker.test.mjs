import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const data = (s) =>
  'data:text/javascript;base64,' + Buffer.from(s).toString('base64');
// Isolate hook lifecycle and wall clock; exercise the real DatePicker handlers.
const hooksURL = data(`
export const effects = [], updates = [];
export let opened = false;
export function reset(open = false) { effects.length = updates.length = 0; opened = open; }
export function useState(initial) {
  return [typeof initial === 'function' ? initial() : initial === false ? opened : initial,
    value => updates.push(value)];
}
export const useMemo = fn => fn();
export const useEffect = fn => effects.push(fn);
`);
const hooks = await import(hooksURL);
const primitives = data(`export const Button = () => null;
export const Calendar = Button, CalendarDays = Button;
export const Popover = Button, PopoverContent = Button, PopoverTrigger = Button;
export const zhCN = {}; export const cn = (...x) => x.filter(Boolean).join(' ');`);
let code = ts.transpileModule(
  readFileSync(
    new URL('../components/ui/date-picker.tsx', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
code = code.replace(
  /from (["'])([^"']+)\1/g,
  (_, quote, specifier) =>
    'from ' +
    JSON.stringify(
      specifier === 'react'
        ? hooksURL
        : specifier === 'react/jsx-runtime'
          ? import.meta.resolve(specifier)
          : specifier === '@/lib/ui-copy'
            ? data(ts.transpileModule(readFileSync(new URL('../lib/ui-copy.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText)
            : primitives,
    ),
);
const { DatePicker } = await import(data(code));
function elements(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(elements)];
}
function setup(props = {}, open = false) {
  hooks.reset(open);
  const changes = [];
  const tree = DatePicker({
    value: '2026-09-12',
    onChange: (v) => changes.push(v),
    ...props,
  });
  const all = elements(tree);
  return {
    changes,
    today: all.find((e) => e.props?.children === '今天'),
    clear: all.find((e) => e.props?.children === '清除'),
  };
}
void test('Today uses the current local date after midnight, retaining serialization', (t) => {
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date(2026, 8, 12, 23, 59, 59),
  });
  const p = setup();
  t.mock.timers.tick(2000);
  p.today.props.onClick();
  assert.deepEqual(p.changes, ['2026-09-13']);
});
void test('Today rechecks max after midnight rather than saving an out-of-range date', (t) => {
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date(2026, 8, 12, 23, 59, 59),
  });
  const p = setup({ max: '2026-09-12' });
  t.mock.timers.tick(2000);
  p.today.props.onClick();
  assert.deepEqual(p.changes, []);
});
void test('an open picker refreshes its day at midnight and clears its timer on close', (t) => {
  t.mock.timers.enable({
    apis: ['Date', 'setTimeout'],
    now: new Date(2026, 8, 12, 23, 59, 59),
  });
  const p = setup({ min: '2026-09-13' }, true);
  assert.equal(p.today.props.disabled, true);
  const cleanups = hooks.effects.map((effect) => effect());
  t.mock.timers.tick(2000);
  assert.ok(hooks.updates.includes('2026-09-13'));
  cleanups.forEach((cleanup) => cleanup?.());
  hooks.updates.length = 0;
  t.mock.timers.tick(86400000);
  assert.deepEqual(hooks.updates, []);
});
void test('min/max and clear keep existing behavior', () => {
  assert.equal(setup({ min: '9999-01-01' }).today.props.disabled, true);
  assert.equal(setup({ max: '0001-01-01' }).today.props.disabled, true);
  assert.equal(setup().clear, undefined);
  const p = setup({ clearable: true });
  p.clear.props.onClick();
  assert.deepEqual(p.changes, ['']);
});
