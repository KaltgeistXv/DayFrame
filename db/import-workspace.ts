import { database } from './raw';
import { validateBackup } from '@/lib/backup';
export async function importWorkspace(value: unknown, mode: unknown) {
  if (mode !== 'merge' && mode !== 'replace') throw Error('导入方式无效');
  const { data } = validateBackup(value),
    db = database();
  const statements: ReturnType<typeof db.prepare>[] = [];
  if (mode === 'replace')
    for (const table of ['tasks', 'projects', 'folders', 'labels'])
      statements.push(db.prepare('DELETE FROM ' + table));
  const insert = (table: string, columns: string[], values: unknown[]) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`,
      )
      .bind(...values);
  for (const f of data.folders)
    statements.push(
      insert(
        'folders',
        ['id', 'title', 'position'],
        [f.id, f.title, f.position],
      ),
    );
  for (const l of data.labels)
    statements.push(
      insert('labels', ['id', 'title', 'color'], [l.id, l.title, l.color]),
    );
  for (const p of data.projects)
    statements.push(
      insert(
        'projects',
        [
          'id',
          'title',
          'description',
          'color',
          'folder',
          'tags',
          'start',
          'end',
          'scheduleMode',
          'position',
        ],
        [
          p.id,
          p.title,
          p.description,
          p.color,
          p.folder,
          JSON.stringify(p.tags),
          p.start,
          p.end,
          p.scheduleMode,
          p.position,
        ],
      ),
    );
  for (const t of data.tasks)
    statements.push(
      insert(
        'tasks',
        [
          'id',
          'title',
          'project',
          'status',
          'priority',
          'date',
          'time',
          'duration',
          'notes',
          'tags',
          'position',
          'tracking',
          'baselineStart',
          'baselineEnd',
          'startedOn',
          'completedOn',
          'rolledDays',
          'checkins',
        ],
        [
          t.id,
          t.title,
          t.project,
          t.status,
          t.priority,
          t.date,
          t.time,
          t.duration,
          t.notes,
          JSON.stringify(t.tags),
          t.position,
          t.tracking ? 1 : 0,
          t.baselineStart,
          t.baselineEnd,
          t.startedOn,
          t.completedOn,
          t.rolledDays,
          JSON.stringify(
            Object.fromEntries((t.checkins || []).map((c) => [c.date, c])),
          ),
        ],
      ),
    );
  if (mode === 'replace')
    statements.push(
      db
        .prepare(
          "INSERT INTO settings(key,value) VALUES('preferences',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .bind(JSON.stringify(data.preferences)),
    );
  statements.push(
    db.prepare(
      "INSERT OR IGNORE INTO settings(key,value) VALUES('initialized','1')",
    ),
  );
  await db.batch(statements);
}
