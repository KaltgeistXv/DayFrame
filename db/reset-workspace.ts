export async function resetWorkspace(db: D1Database, confirmation: unknown) {
  if (confirmation !== 'RESET_WORKSPACE') throw Error('请先确认恢复默认状态');
  // D1 batches are transactional. Keep initialized so GET never restores demo data.
  await db.batch([
    ...['tasks', 'projects', 'folders', 'labels', 'settings'].map((table) =>
      db.prepare('DELETE FROM ' + table),
    ),
    db.prepare("INSERT INTO settings(key,value) VALUES('initialized','1')"),
  ]);
}
