import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const moduleUrl = (text) =>
  'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
let backup = stripTypeScriptTypes(
  readFileSync(new URL('../lib/backup.ts', import.meta.url), 'utf8'),
);
for (const name of ['model', 'colors', 'appearance', 'home-layout'])
  backup = backup.replace(
    `'./${name}'`,
    JSON.stringify(new URL(`../lib/${name}.ts`, import.meta.url).href),
  );
const src = stripTypeScriptTypes(
  readFileSync(new URL('../lib/backup-download.ts', import.meta.url), 'utf8'),
).replace("'./backup'", JSON.stringify(moduleUrl(backup)));
const { downloadBackup } = await import(moduleUrl(src));
const fixture = {
  tasks: [],
  projects: [],
  folders: [],
  labels: [],
  preferences: {},
};
void test('save picker opens before fetch and resolves only after file close', async (t) => {
  const events = [];
  t.mock.method(globalThis, 'fetch', async () => {
    events.push('fetch');
    return { ok: true, json: async () => fixture };
  });
  globalThis.window = {
    showSaveFilePicker: async (opts) => {
      events.push('picker');
      assert.match(opts.suggestedName, /DayFrame-backup-.*\.json$/);
      return {
        createWritable: async () => ({
          write: async (blob) => {
            events.push('write');
            assert.deepEqual(JSON.parse(await blob.text()).data, fixture);
          },
          close: async () => events.push('close'),
          abort: async () => events.push('abort'),
        }),
      };
    },
  };
  assert.equal(await downloadBackup(), 'saved');
  assert.deepEqual(events, ['picker', 'fetch', 'write', 'close']);
  delete globalThis.window;
});
void test('cancel does not fetch data; failed writes abort instead of reporting success', async (t) => {
  let reads = 0,
    aborts = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    reads++;
    return { ok: true, json: async () => fixture };
  });
  globalThis.window = {
    showSaveFilePicker: async () => {
      throw Object.assign(new Error('cancel'), { name: 'AbortError' });
    },
  };
  assert.equal(await downloadBackup(), 'cancelled');
  assert.equal(reads, 0);
  globalThis.window.showSaveFilePicker = async () => ({
    createWritable: async () => ({
      write: async () => {
        throw Error('disk full');
      },
      close: async () => assert.fail('must not close'),
      abort: async () => aborts++,
    }),
  });
  await assert.rejects(downloadBackup(), /备份未保存成功/);
  assert.equal(aborts, 1);
  delete globalThis.window;
});
void test('unsupported browser reports download initiated, not file saved', async (t) => {
  globalThis.window = {};
  let clicked = 0,
    removed = 0;
  globalThis.document = {
    // Stub the supported DOM API, not the deprecated TypeScript overload.
    // oxlint-disable-next-line typescript/no-deprecated
    createElement: () => ({
      click() {
        clicked++;
      },
      remove() {
        removed++;
      },
    }),
    body: { appendChild() {} },
  };
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => fixture,
  }));
  t.mock.method(globalThis, 'setTimeout', () => 0);
  t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  assert.equal(await downloadBackup(), 'downloaded');
  assert.equal(clicked, 1);
  assert.equal(removed, 1);
  delete globalThis.window;
  delete globalThis.document;
});

void test('native backup awaits actual save and propagates cancellation and failure', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => fixture }));
  let resolveSave;
  globalThis.window = { dayframeDesktop: { saveBackup: async (name, content) => {
    assert.match(name, /DayFrame-backup-.*\.json$/);
    assert.deepEqual(JSON.parse(content).data, fixture);
    return new Promise(resolve => { resolveSave = resolve; });
  } } };
  t.after(() => { delete globalThis.window; });
  let completed = false;
  const pending = downloadBackup().then(result => { completed = true; return result; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, false);
  resolveSave('saved');
  assert.equal(await pending, 'saved');
  window.dayframeDesktop.saveBackup = async () => 'cancelled';
  assert.equal(await downloadBackup(), 'cancelled');
  window.dayframeDesktop.saveBackup = async () => { throw Error('磁盘不可写'); };
  await assert.rejects(downloadBackup(), /磁盘不可写/);
});
