import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, readdirSync, linkSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Reuse the web API's small D1 surface; keep SQL and business validation shared.
export function openDatabase(file, migrations) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const sqlite = new DatabaseSync(file, { timeout: 5000 });
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  const hasTasks = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'").get();
  if (!hasTasks) {
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      for (const name of readdirSync(migrations).filter(n => n.endsWith('.sql')).sort()) {
        sqlite.exec(readFileSync(join(migrations, name), 'utf8'));
      }
      sqlite.exec("INSERT OR IGNORE INTO settings(key,value) VALUES('initialized','1'); COMMIT;");
    } catch (error) {
      sqlite.exec('ROLLBACK');
      sqlite.close();
      throw error;
    }
  }
  // Fail explicitly on incompatible data instead of starting with an empty workspace.
  for (const [table, columns] of Object.entries({
    tasks: ['id', 'tags', 'checkins', 'rolledDays', 'completedOn'],
    projects: ['id', 'scheduleMode'], folders: ['id'], labels: ['id'], settings: ['key', 'value'],
  })) {
    const present = new Set(sqlite.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
    if (columns.some(c => !present.has(c))) { sqlite.close(); throw Error(`数据库版本不兼容：${table}`); }
  }
  class Statement {
    constructor(sql, values = []) { this.sql = sql; this.values = values; }
    bind(...values) { return new Statement(this.sql, values); }
    execute() {
      const prepared = sqlite.prepare(this.sql);
      if (prepared.columns().length) return { success: true, results: prepared.all(...this.values) };
      const result = prepared.run(...this.values);
      return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
    }
    async all() { return this.execute(); }
    async run() { return this.execute(); }
    async first(column) { const row = this.execute().results[0]; return column ? row?.[column] ?? null : row ?? null; }
  }
  return {
    prepare: sql => new Statement(sql),
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(s => s.execute());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close: () => sqlite.close(),
  };
}

// Explicit one-time migration. SQLite backup includes committed WAL pages;
// never copy a running database file or overwrite an existing desktop database.
export async function migrateDatabase(source, destination) {
  if (existsSync(destination)) throw Error('客户端已有数据，未覆盖；请使用应用内导入。');
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = destination + '.importing';
  if (existsSync(temporary)) throw Error('发现未完成的迁移文件，请先检查。');
  const original = new DatabaseSync(source, { readOnly: true });
  try {
    const tables = new Set(original.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name));
    if (!['tasks', 'projects', 'folders', 'labels', 'settings'].every(t => tables.has(t))) throw Error('来源不是 DayFrame 工作空间');
    await backup(original, temporary);
    const copy = new DatabaseSync(temporary);
    try {
      const result = copy.prepare('PRAGMA integrity_check').get();
      if (Object.values(result)[0] !== 'ok') throw Error('数据库完整性检查失败');
    } finally { copy.close(); }
    linkSync(temporary, destination);
    rmSync(temporary);
  } catch (error) { rmSync(temporary, { force: true }); throw error; }
  finally { original.close(); }
}
