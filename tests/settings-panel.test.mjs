import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { compileSource } from './helpers/compile-source.mjs';
import { defaultPreferences } from '../lib/model.ts';

const reactMock =
  'data:text/javascript,' +
  encodeURIComponent(`
let values = [], cursor = 0;
export function reset() { values = []; cursor = 0; }
export function begin() { cursor = 0; }
export function useId() { return 'settings-test'; }
export function useState(initial) { const i = cursor++; if (!(i in values)) values[i] = initial;
 return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value; }]; }
export function useRef(initial) { const i = cursor++; if (!(i in values)) values[i] = { current: initial }; return values[i]; }
`);
const state = await import(reactMock);
const { default: SettingsForm } = await import(
  compileSource(
    new URL('../components/workspace-settings-form.tsx', import.meta.url),
    { react: reactMock },
  )
);
const { default: SettingsPanel } = await import(
  compileSource(
    new URL('../components/interface-settings.tsx', import.meta.url),
    {
      react: reactMock,
      '@/lib/backup-download':
        'data:text/javascript,export async function downloadBackup(){return "cancelled"}',
    },
  )
);
function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  return [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)];
}
function view(Component, props) {
  state.begin();
  return nodes(Component(props));
}
function button(tree, text) {
  return tree.find(
    (n) => n.type?.name === 'Button' && n.props.children === text,
  );
}
const submitEvent = { preventDefault() {} };

void test('name and data share one page, with no tabs or navigation sorting and reset initially collapsed', () => {
  state.reset();
  const tree = view(SettingsPanel, {
    preferences: defaultPreferences,
    busy: false,
    save: async () => {},
    onClose() {},
  });
  assert.ok(tree.some((n) => n.type?.name === 'WorkspaceSettingsForm'));
  assert.equal(
    tree.filter(
      (n) =>
        n.type === 'section' &&
        n.props?.className?.split(' ').includes('dialog-action-section'),
    ).length,
    3,
  );
  assert.ok(
    !tree.some((n) =>
      /Tabs|ordernav/.test(n.type?.name || n.props?.className || ''),
    ),
  );
  assert.ok(
    !tree.some((n) => n.props?.className?.includes('reset-confirmation')),
  );
});

void test('Save is a native submit button and preserves preferences unrelated to the name', async () => {
  state.reset();
  const preferences = {
    ...defaultPreferences,
    density: 'compact',
    startView: 'all',
    navOrder: ['all', 'today', 'projects', 'inbox'],
  };
  let saved;
  const props = {
    preferences,
    busy: false,
    save: async (payload) => {
      saved = payload;
    },
  };
  let tree = view(SettingsForm, props);
  tree
    .find((n) => n.type?.name === 'Input')
    .props.onChange({ target: { value: '  新名称  ' } });
  tree = view(SettingsForm, props);
  assert.match(renderToStaticMarkup(tree[0]), /type="submit"/);
  await tree[0].props.onSubmit(submitEvent);
  assert.deepEqual(saved, {
    action: 'savePreferences',
    preferences: { ...preferences, name: '新名称' },
  });
  assert.equal(preferences.name, defaultPreferences.name);
  tree = view(SettingsForm, props);
  assert.ok(
    tree.some((n) => n.type === 'output' && n.props.children === '名称已保存'),
  );
});

void test('failed saves retain the name and report an error; blank names never submit', async () => {
  state.reset();
  let calls = 0;
  const props = {
    preferences: defaultPreferences,
    busy: false,
    save: async () => {
      calls++;
      throw Error('保存失败');
    },
  };
  let tree = view(SettingsForm, props);
  tree
    .find((n) => n.type?.name === 'Input')
    .props.onChange({ target: { value: '新名称' } });
  await view(SettingsForm, props)[0].props.onSubmit(submitEvent);
  tree = view(SettingsForm, props);
  assert.ok(
    tree.some(
      (n) => n.props?.role === 'alert' && n.props.children === '保存失败',
    ),
  );
  assert.equal(
    tree.find((n) => n.type?.name === 'Input').props.value,
    '新名称',
  );
  tree
    .find((n) => n.type?.name === 'Input')
    .props.onChange({ target: { value: '  ' } });
  await view(SettingsForm, props)[0].props.onSubmit(submitEvent);
  assert.equal(calls, 1);
});

void test('file selection uses a Chinese button and clears the input so a failed file can be retried', async () => {
  state.reset();
  let clicks = 0;
  const props = {
    preferences: defaultPreferences,
    busy: false,
    save: async () => {},
    onClose() {},
  };
  let tree = view(SettingsPanel, props);
  const input = tree.find((n) => n.type === 'input' && n.props.type === 'file');
  assert.equal(input.props.hidden, true);
  input.props.ref.current = {
    click() {
      clicks++;
    },
  };
  button(tree, '选择文件').props.onClick();
  assert.equal(clicks, 1);
  const target = {
    value: 'selected.json',
    files: [{ name: 'selected.json', size: 1, text: async () => 'invalid' }],
  };
  await input.props.onChange({ target });
  assert.equal(target.value, '');
  tree = view(SettingsPanel, props);
  assert.ok(
    tree.some(
      (n) =>
        n.props?.role === 'alert' &&
        n.props.children === '备份文件无法读取，请重新选择',
    ),
  );
});

void test('clear still requires confirmation and cancelled backup never clears data', async () => {
  state.reset();
  let saves = 0;
  const props = {
    preferences: defaultPreferences,
    busy: false,
    save: async () => saves++,
    onClose() {},
  };
  let tree = view(SettingsPanel, props);
  button(tree, '清空数据').props.onClick();
  tree = view(SettingsPanel, props);
  assert.equal(button(tree, '清空数据').props.disabled, true);
  tree
    .find((n) => n.props?.['aria-label'] === '确认清空全部数据并恢复默认设置')
    .props.onCheckedChange(true);
  tree = view(SettingsPanel, props);
  await button(tree, '清空数据').props.onClick();
  assert.equal(saves, 0);
  assert.ok(
    view(SettingsPanel, props).some(
      (n) => n.props?.children === '已取消备份，数据未清空',
    ),
  );
});
