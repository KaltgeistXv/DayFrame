import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, migrateDatabase } from '../database.mjs';
import { startServer } from '../server.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const migrations = join(root, 'drizzle');
const temporary = () => mkdtempSync(join(tmpdir(), 'dayframe-test-'));

void test('SQLite batch failure rolls back every statement; binding preserves user text', async () => {
  const dir = temporary(); const db = openDatabase(join(dir, 'workspace.sqlite'), migrations);
  try {
    await assert.rejects(db.batch([
      db.prepare('INSERT INTO projects(id,title) VALUES(?,?)').bind('p', "O'Reilly 测试"),
      db.prepare('INSERT INTO missing_table(id) VALUES(?)').bind('bad'),
    ]));
    assert.equal(await db.prepare('SELECT * FROM projects').first(), null);
    await db.prepare('INSERT INTO projects(id,title) VALUES(?,?)').bind('p', "O'Reilly 测试").run();
    assert.equal(await db.prepare('SELECT title FROM projects').first('title'), "O'Reilly 测试");
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

void test('migration captures committed WAL data, leaves source intact and refuses overwrite', async () => {
  const dir = temporary(); const source = join(dir, 'source.sqlite'); const target = join(dir, 'target.sqlite');
  const db = openDatabase(source, migrations);
  try {
    await db.prepare('INSERT INTO labels(id,title,color) VALUES(?,?,?)').bind('label', '迁移测试', '0').run();
    await migrateDatabase(source, target);
    const copy = openDatabase(target, migrations);
    try { assert.equal(await copy.prepare('SELECT title FROM labels').first('title'), '迁移测试'); } finally { copy.close(); }
    await assert.rejects(migrateDatabase(source, target), /未覆盖/);
    assert.equal(await db.prepare('SELECT count(*) AS n FROM labels').first('n'), 1);
    assert.equal(existsSync(target + '.importing'), false);
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

void test('packaged API supports authenticated offline CRUD, settings, checkins, backup and restore', async () => {
  const dir = temporary();
  const instance = await startServer({ resources: join(root, 'outputs/macos/DayFrame.app/Contents/Resources'), dataDir: dir });
  const origin = new URL(instance.url).origin;
  try {
    assert.equal((await fetch(origin + '/api/workspace')).status, 403);
    const launch = await fetch(instance.url, { redirect: 'manual' });
    assert.equal(launch.status, 303);
    const cookie = launch.headers.get('set-cookie').split(';')[0];
    const headers = { Cookie: cookie, Origin: origin, 'Content-Type':'application/json' };
    const read = async () => {
      const response = await fetch(origin + '/api/workspace', { headers });
      assert.equal(response.status, 200); return response.json();
    };
    const write = async action => {
      const response = await fetch(origin + '/api/workspace', { method: 'POST', headers, body: JSON.stringify(action) });
      const data = await response.json(); assert.equal(response.status, 200, JSON.stringify(data)); return data;
    };
    assert.equal((await fetch(origin + '/', { headers })).status, 200);
    assert.equal((await fetch(origin + '/api/workspace', { method:'POST', headers:{ ...headers, Origin:'https://untrusted.example' }, body:'{}' })).status, 403);
    assert.equal((await read()).tasks.length, 0);
    let state = await write({ action:'saveProject', project:{ id:'test-project',title:'离线项目',description:'',folder:'',tags:[],color:'0',start:'',end:'',scheduleMode:'auto',position:0 } });
    assert.equal(state.projects.length, 1);
    const task = { id:'test-task', title:'离线任务', project:'test-project',status:'doing',priority:'medium',date:'2026-09-01',time:'',duration:1440,notes:'保存后重开',tags:[],tracking:true,position:0 };
    state = await write({ action:'saveTask', task });
    assert.equal(state.tasks[0].title, task.title);
    state = await write({ action:'saveCheckIn', id:task.id,date:'2026-09-01',note:'实际进展',minutes:30 });
    assert.equal(state.tasks[0].checkins[0].note, '实际进展');
    state = await write({ action:'savePreferences', preferences:{ ...state.preferences, name:'离线工作空间' } });
    assert.equal((await read()).preferences.name, '离线工作空间');
    // Matches lib/backup.ts; import passes through the production validator.
    const exported = { format:'pat-mi', version:1, exportedAt:new Date().toISOString(), data:state };
    assert.ok(exported);
    await write({ action:'resetWorkspace', confirmation:'RESET_WORKSPACE' });
    assert.equal((await read()).tasks.length, 0);
    state = await write({ action:'importWorkspace', mode:'replace', backup:exported });
    assert.equal(state.tasks[0].checkins[0].note, '实际进展');
    state = await write({ action:'deleteProject', id:'test-project' });
    assert.equal(state.tasks.length,1); assert.equal(state.tasks[0].project,'');
    const persisted = openDatabase(join(dir, 'workspace.sqlite'), migrations);
    try { assert.equal(await persisted.prepare('SELECT title FROM tasks').first('title'),task.title); } finally { persisted.close(); }
  } finally {
    await new Promise(resolve => instance.server.close(resolve));
    // Module owns the SQLite connection until this test process exits.
    rmSync(dir, { recursive: true, force: true });
  }
});
