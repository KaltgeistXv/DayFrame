import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileSource } from './helpers/compile-source.mjs';
import { createProjectDraft, isSavedProject } from '../lib/project-editor.ts';

const stateMock =
  'data:text/javascript,' +
  encodeURIComponent(
    'export const errors = []; export function useState() { return ["", value => errors.push(value)]; }',
  );
const { errors } = await import(stateMock);
const { default: ProjectEditor } = await import(
  compileSource(new URL('../components/project-editor.tsx', import.meta.url), {
    react: stateMock,
  })
);
function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  return [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)];
}
function editor(draft, overrides = {}) {
  const props = {
    project: draft,
    projects: [],
    folders: [],
    labels: [],
    busy: false,
    onChange() {},
    async onSave() {},
    onClose() {},
    onDelete() {},
    async onCreateLabel() {
      return 'label';
    },
    ...overrides,
  };
  return nodes(ProjectEditor(props));
}

void test('preallocated project IDs remain drafts until saved; contextual defaults are consistent', () => {
  const draft = createProjectDraft({
    id: 'inline-id',
    folder: 'folder',
    date: '2026-09-14',
  });
  assert.equal(draft.end, draft.start);
  assert.equal(draft.scheduleMode, 'manual');
  assert.equal(draft.folder, 'folder');
  assert.equal(isSavedProject(draft, []), false);
  assert.equal(isSavedProject(draft, [draft]), true);
  assert.equal(isSavedProject(null, [draft]), false);
  const unplanned = createProjectDraft({ id: 'unplanned', end: '2026-09-14' });
  assert.equal(unplanned.scheduleMode, 'auto');
  assert.equal(unplanned.end, '');
});

void test('inline creation shows Create and never exposes Delete; editing uses Save', () => {
  const draft = createProjectDraft({ id: 'preallocated' });
  const creation = editor(draft);
  assert.equal(
    creation.find((n) => n.type?.name === 'DialogTitle').props.children,
    '新建项目',
  );
  assert.equal(
    creation.find((n) => n.props?.type === 'submit').props.children,
    '创建',
  );
  assert.ok(!creation.some((n) => n.props?.className === 'task-delete-button'));
  const editing = editor(draft, { projects: [draft] });
  assert.equal(
    editing.find((n) => n.type?.name === 'DialogTitle').props.children,
    '编辑项目',
  );
  assert.equal(
    editing.find((n) => n.props?.type === 'submit').props.children,
    '保存',
  );
  assert.ok(editing.some((n) => n.props?.className === 'task-delete-button'));
  assert.equal(
    editor(draft, { busy: true }).find((n) => n.props?.type === 'submit').props
      .children,
    '创建中…',
  );
});

void test('project save closes only on success; failed save keeps the draft and reports its error', async () => {
  const draft = createProjectDraft({ id: 'draft' });
  const events = [];
  const success = editor(draft, {
    onSave: async (value) => {
      assert.equal(value, draft);
      events.push('save');
    },
    onClose: () => events.push('close'),
  });
  await success
    .find((n) => n.type === 'form')
    .props.onSubmit({ preventDefault() {} });
  assert.deepEqual(events, ['save', 'close']);
  events.length = 0;
  const failed = editor(draft, {
    onSave: async () => {
      throw new Error('保存失败');
    },
    onClose: () => events.push('close'),
  });
  await failed
    .find((n) => n.type === 'form')
    .props.onSubmit({ preventDefault() {} });
  assert.deepEqual(events, []);
  assert.equal(errors.at(-1), '保存失败');
});

void test('cancel and outside close use the same cleanup callback and cannot close while saving', () => {
  let closed = 0;
  const draft = createProjectDraft({ id: 'draft' });
  const view = editor(draft, { onClose: () => closed++ });
  view.find((n) => n.props?.children === '取消').props.onClick();
  view[0].props.onOpenChange(false);
  assert.equal(closed, 2);
  editor(draft, { busy: true, onClose: () => closed++ })[0].props.onOpenChange(
    false,
  );
  assert.equal(closed, 2);
});

void test('all editor submit labels distinguish creating from saving during pending work', async () => {
  const { editorSubmitLabel } = await import('../lib/ui-copy.ts');
  assert.equal(editorSubmitLabel(false), '创建');
  assert.equal(editorSubmitLabel(false, true), '创建中…');
  assert.equal(editorSubmitLabel(true), '保存');
  assert.equal(editorSubmitLabel(true, true), '保存中…');
});
