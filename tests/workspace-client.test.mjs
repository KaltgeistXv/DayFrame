import './helpers/register-tsx.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { requestWorkspace, workspaceSnapshot } = await import('../lib/workspace-client.ts');
import { defaultPreferences } from '../lib/model.ts';
import { uiCopy } from '../lib/ui-copy.ts';

const data = {
  tasks: [],
  projects: [],
  folders: [],
  labels: [],
  preferences: defaultPreferences,
};

void test('workspace reads and writes preserve server snapshots and undo metadata', async (t) => {
  const response = { ...data, undoBefore: data };
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => response };
  });
  assert.equal(await requestWorkspace(), response);
  assert.equal(
    await requestWorkspace({ action: 'saveTask', captureUndo: true }),
    response,
  );
  assert.deepEqual(calls[0], ['/api/workspace', undefined]);
  assert.equal(calls[1][1].method, 'POST');
  assert.deepEqual(calls[1][1].headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(calls[1][1].body), {
    action: 'saveTask',
    captureUndo: true,
  });
  assert.deepEqual(workspaceSnapshot(response), data);
  assert.equal('undoBefore' in workspaceSnapshot(response), false);
});

void test('workspace failures retain server errors and use a shared fallback', async (t) => {
  let error = '工作空间已变更，请刷新后重试';
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: false,
    json: async () => ({ error }),
  }));
  await assert.rejects(requestWorkspace({ action: 'restoreWorkspace' }), {
    message: error,
  });
  error = '';
  await assert.rejects(requestWorkspace(), { message: uiCopy.requestFailed });
});

void test('legacy snapshots get optional defaults without mutating the response', () => {
  const legacy = { tasks: [], projects: [] };
  assert.deepEqual(workspaceSnapshot(legacy), data);
  assert.deepEqual(Object.keys(legacy), ['tasks', 'projects']);
});
