import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { resetWorkspace } from '../db/reset-workspace.ts';
import { resetViewPreferences } from '../lib/reset-view-preferences.ts';

function workspace() {
  const sqlite = new DatabaseSync(':memory:');
  const migrations = new URL('../drizzle/', import.meta.url);
  for (const file of readdirSync(migrations)
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sqlite.exec(readFileSync(new URL(file, migrations), 'utf8'));
  sqlite.exec(`
    INSERT INTO folders(id,title) VALUES('f','文件夹');
    INSERT INTO labels(id,title) VALUES('l','标签');
    INSERT INTO projects(id,title,folder) VALUES('p','作品集','f');
    INSERT INTO tasks(id,title,project,status,priority,tracking,checkins,baselineStart)
      VALUES('t','排版','p','doing','medium',1,'{"2026-09-08":{"date":"2026-09-08","minutes":60}}','2026-09-07');
    INSERT INTO settings(key,value) VALUES('preferences','{"name":"自定义空间"}'),('initialized','1');
  `);
  let batches = 0;
  const db = {
    prepare(sql) {
      return sqlite.prepare(sql);
    },
    async batch(statements) {
      batches++;
      sqlite.exec('BEGIN');
      try {
        for (const statement of statements) statement.run();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sqlite, db, count: () => batches };
}

void test('reset rejects absent or incorrect confirmation without changing anything', async () => {
  const w = workspace();
  try {
    for (const token of [undefined, null, true, 'reset', {}])
      await assert.rejects(resetWorkspace(w.db, token), /确认/);
    assert.equal(w.count(), 0);
    assert.equal(w.sqlite.prepare('SELECT COUNT(*) n FROM tasks').get().n, 1);
  } finally {
    w.sqlite.close();
  }
});

void test('confirmed reset removes all records and settings in one batch and prevents demo reseeding', async () => {
  const w = workspace();
  try {
    await resetWorkspace(w.db, 'RESET_WORKSPACE');
    assert.equal(w.count(), 1);
    for (const table of ['tasks', 'projects', 'folders', 'labels'])
      assert.equal(
        w.sqlite.prepare('SELECT COUNT(*) n FROM ' + table).get().n,
        0,
      );
    assert.deepEqual(
      w.sqlite
        .prepare('SELECT key,value FROM settings')
        .all()
        .map((r) => ({ ...r })),
      [{ key: 'initialized', value: '1' }],
    );
    w.sqlite.exec(
      "INSERT INTO projects(id,title) SELECT 'demo','示例项目' WHERE NOT EXISTS(SELECT 1 FROM settings WHERE key='initialized')",
    );
    assert.equal(
      w.sqlite.prepare('SELECT COUNT(*) n FROM projects').get().n,
      0,
    );
    await resetWorkspace(w.db, 'RESET_WORKSPACE');
    assert.equal(
      w.sqlite.prepare('SELECT COUNT(*) n FROM settings').get().n,
      1,
    );
  } finally {
    w.sqlite.close();
  }
});

void test('failed reset batch leaves data and preferences intact', async () => {
  const w = workspace();
  try {
    w.sqlite.exec(
      "CREATE TRIGGER reject_clear BEFORE DELETE ON labels BEGIN SELECT RAISE(ABORT,'test failure'); END",
    );
    await assert.rejects(
      resetWorkspace(w.db, 'RESET_WORKSPACE'),
      /test failure/,
    );
    for (const table of ['tasks', 'projects', 'folders', 'labels'])
      assert.equal(
        w.sqlite.prepare('SELECT COUNT(*) n FROM ' + table).get().n,
        1,
      );
    assert.match(
      w.sqlite
        .prepare("SELECT value FROM settings WHERE key='preferences'")
        .get().value,
      /自定义空间/,
    );
  } finally {
    w.sqlite.close();
  }
});

void test('reset clears only DayFrame view memory, preserving unrelated browser data', () => {
  const values = new Map([
    ['patmi:view:all', 'calendar'],
    ['patmi:view:p', 'timeline'],
    ['patmi:calendar-period:all', 'month'],
    ['other-app', 'keep'],
  ]);
  resetViewPreferences({
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i],
    removeItem: (k) => values.delete(k),
  });
  assert.deepEqual([...values], [['other-app', 'keep']]);
});
