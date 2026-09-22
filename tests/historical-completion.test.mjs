import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';

// Execute the production UPSERT against SQLite to protect existing work logs.
const route = readFileSync(
  new URL('../app/api/workspace/route.ts', import.meta.url),
  'utf8',
);
const source = stripTypeScriptTypes(
  route.slice(
    route.indexOf('function writeTask('),
    route.indexOf('export async function GET'),
  ),
);
const write = (database, t) =>
  runInNewContext(source + '\nwriteTask(t);', { database, t });
void test('correcting completion moves only its automatic check-in, preserving real records', () => {
  const db = new DatabaseSync(':memory:');
  const migrations = new URL('../drizzle/', import.meta.url);
  for (const file of readdirSync(migrations)
    .filter((f) => f.endsWith('.sql'))
    .sort())
    db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  const database = () => ({
    prepare: (sql) => ({ bind: (...args) => db.prepare(sql).run(...args) }),
  });
  const task = {
    id: 'history',
    title: 'Historical task',
    project: '',
    status: 'done',
    priority: 'medium',
    date: '2026-09-09',
    time: '',
    duration: 1440,
    notes: '',
    tracking: true,
    completedOn: '2026-09-09',
  };
  write(database, task);
  const logs = {
    '2026-09-09': { date: '2026-09-09', note: '完成任务', minutes: 0 },
    '2026-07-07': { date: '2026-07-07', note: '排版', minutes: 60 },
    '2026-07-18': { date: '2026-07-18', note: '收尾', minutes: 30 },
  };
  db.prepare('UPDATE tasks SET checkins=? WHERE id=?').run(
    JSON.stringify(logs),
    task.id,
  );
  write(database, { ...task, completedOn: '2026-07-18' });
  const read = () =>
    JSON.parse(
      db.prepare('SELECT checkins FROM tasks WHERE id=?').get(task.id).checkins,
    );
  delete logs['2026-09-09'];
  assert.deepEqual(read(), logs);
  write(database, { ...task, completedOn: '2026-07-18' });
  assert.deepEqual(read(), logs);
  write(database, { ...task, completedOn: '2026-07-19' });
  assert.deepEqual(read()['2026-07-18'], logs['2026-07-18']);
  assert.deepEqual(read()['2026-07-19'], {
    date: '2026-07-19',
    note: '完成任务',
    minutes: 0,
  });
  write(database, {
    ...task,
    status: 'todo',
    completedOn: '',
    undoCompletion: true,
  });
  assert.deepEqual(read(), logs);
  // Undo must preserve an actual work record even when it falls on completion day.
  write(database, { ...task, completedOn: '2026-07-18' });
  write(database, {
    ...task,
    status: 'todo',
    completedOn: '',
    undoCompletion: true,
  });
  assert.deepEqual(read(), logs);
  db.close();
});
