import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { defaultPreferences } from '../lib/model.ts';
const asModule = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
let backup = stripTypeScriptTypes(readFileSync(new URL('../lib/backup.ts', import.meta.url), 'utf8'));
for (const name of ['model', 'colors', 'appearance', 'home-layout'])
  backup = backup.replace(`'./${name}'`, JSON.stringify(new URL(`../lib/${name}.ts`, import.meta.url).href));
let source = stripTypeScriptTypes(readFileSync(new URL('../lib/workspace-history.ts', import.meta.url), 'utf8'));
source = source.replace("'./backup'", JSON.stringify(asModule(backup)));
const { sameWorkspace } = await import(asModule(source));
const fixture = () => ({ tasks: [], projects: [], folders: [{ id: 'f', title: '工作', position: 0 }], labels: [], preferences: structuredClone(defaultPreferences) });

void test('undo comparison ignores object key order and normalizes saved defaults', () => {
  const a = fixture();
  const b = Object.fromEntries(Object.entries(structuredClone(a)).reverse());
  b.folders[0] = { position: 0, title: '工作', id: 'f' };
  assert.equal(sameWorkspace(a, b), true);
});
void test('undo detects other-page edits, creations and deletion', () => {
  const a = fixture(), b = fixture();
  b.folders[0].title = '另一个页面的修改';
  assert.equal(sameWorkspace(a, b), false);
  b.folders = [];
  assert.equal(sameWorkspace(a, b), false);
  b.folders = [...a.folders, { id: 'new', title: '新文件夹', position: 1 }];
  assert.equal(sameWorkspace(a, b), false);
});
void test('undo detects workspace setting changes', () => {
  const a = fixture(), b = fixture();
  b.preferences.name = '新的空间';
  assert.equal(sameWorkspace(a, b), false);
});
