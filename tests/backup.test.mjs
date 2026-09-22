import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { execFileSync } from 'node:child_process';
import { defaultPreferences } from '../lib/model.ts';
import { defaultAppearance, validateAppearance } from '../lib/appearance.ts';
const asModule = (source) =>
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
let source = stripTypeScriptTypes(
  readFileSync(new URL('../lib/backup.ts', import.meta.url), 'utf8'),
);
for (const name of ['model', 'colors', 'appearance', 'home-layout'])
  source = source.replace(
    `'./${name}'`,
    JSON.stringify(new URL(`../lib/${name}.ts`, import.meta.url).href),
  );
const backupUrl = asModule(source);
const { validateBackup, makeBackup } = await import(backupUrl);
const fixture = {
  tasks: [
    {
      id: 't',
      title: 'Task',
      project: 'p',
      status: 'doing',
      priority: 'medium',
      date: '2026-09-06',
      time: '',
      duration: 1440,
      notes: 'notes',
      tracking: true,
      baselineStart: '2026-09-05',
      baselineEnd: '2026-09-05',
      startedOn: '2026-09-05',
      rolledDays: 1,
      tags: ['l'],
      position: 5,
      checkins: [{ date: '2026-09-05', note: 'Worked', minutes: 60 }],
    },
  ],
  projects: [
    {
      id: 'p',
      title: 'Project',
      description: '',
      color: '#123456',
      folder: 'f',
      tags: ['l'],
      start: '',
      end: '',
      scheduleMode: 'auto',
      position: 2,
    },
  ],
  folders: [{ id: 'f', title: 'Folder', position: 1 }],
  labels: [{ id: 'l', title: 'Label', color: '0' }],
  preferences: {
    ...defaultPreferences,
    appearance: {
      ...defaultAppearance,
      sidebarVisible: false,
      showTags: false,
    },
  },
};
void test('export/import round trip preserves links, original plan, daily history and appearance', () => {
  const restored = validateBackup(
    JSON.parse(JSON.stringify(makeBackup(fixture))),
  );
  assert.deepEqual(restored.data.tasks[0].checkins, fixture.tasks[0].checkins);
  assert.equal(restored.data.tasks[0].baselineEnd, '2026-09-05');
  assert.equal(restored.data.tasks[0].rolledDays, 1);
  assert.equal(restored.data.projects[0].folder, 'f');
  assert.equal(restored.data.preferences.appearance.sidebarVisible, false);
});
void test('malformed backups and broken relations are rejected before writing', () => {
  for (const alter of [
    (b) => (b.version = 2),
    (b) => b.data.tasks.push(b.data.tasks[0]),
    (b) => (b.data.projects = []),
    (b) => (b.data.labels = []),
    (b) => (b.data.folders = []),
    (b) => b.data.tasks[0].checkins.push(b.data.tasks[0].checkins[0]),
    (b) => (b.data.tasks[0].checkins[0].minutes = -1),
    (b) => (b.data.projects[0].end = 'invalid'),
  ]) {
    const b = makeBackup(structuredClone(fixture));
    alter(b);
    assert.throws(() => validateBackup(b));
  }
  assert.throws(() =>
    validateAppearance({ ...defaultAppearance, sidebarWidth: 10000 }),
  );
  assert.throws(() =>
    validateAppearance({ ...defaultAppearance, hiddenNav: ['missing'] }),
  );
});
void test('actual import statements restore SQLite atomically; merge keeps existing IDs; replace restores history', async () => {
  let captured = [];
  globalThis.__backupTestDb = {
    prepare(sql) {
      return {
        sql,
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
      };
    },
    async batch(statements) {
      captured = statements;
    },
  };
  const importer = stripTypeScriptTypes(
    readFileSync(new URL('../db/import-workspace.ts', import.meta.url), 'utf8'),
  )
    .replace(
      "'./raw'",
      JSON.stringify(
        asModule(
          'export function database(){return globalThis.__backupTestDb;}',
        ),
      ),
    )
    .replace("'@/lib/backup'", JSON.stringify(backupUrl));
  const { importWorkspace } = await import(asModule(importer));
  await importWorkspace(makeBackup(fixture), 'replace');
  const first = captured;
  const updated = structuredClone(fixture);
  updated.tasks[0].title = 'Changed';
  updated.tasks.push({ ...updated.tasks[0], id: 't2', title: 'Second' });
  await importWorkspace(makeBackup(updated), 'merge');
  const merge = captured;
  await importWorkspace(makeBackup(updated), 'replace');
  const replace = captured;
  const script = `import sqlite3,json,sys,pathlib
q=json.load(sys.stdin);db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
for f in sorted(pathlib.Path('drizzle').glob('*.sql')):db.executescript(f.read_text())
def run(stmts):
 with db:
  for s in stmts:db.execute(s['sql'],s['values'])
run(q[0]);run(q[1]);assert db.execute("SELECT title FROM tasks WHERE id='t'").fetchone()[0]=='Task'
assert db.execute('SELECT count(*) FROM tasks').fetchone()[0]==2
run(q[2]);t=dict(db.execute("SELECT * FROM tasks WHERE id='t'").fetchone());assert t['title']=='Changed';assert t['baselineEnd']=='2026-09-05';assert json.loads(t['checkins'])['2026-09-05']['minutes']==60
try:run([{'sql':'DELETE FROM tasks','values':[]},{'sql':'INSERT INTO non_existing VALUES(1)','values':[]}])
except sqlite3.Error:pass
assert db.execute('SELECT count(*) FROM tasks').fetchone()[0]==2
print('SQL round trip and rollback passed')`;
  assert.match(
    execFileSync('python3', ['-c', script], {
      input: JSON.stringify([first, merge, replace]),
      encoding: 'utf8',
    }),
    /passed/,
  );
  delete globalThis.__backupTestDb;
});
void test('legacy tracking navigation migrates into All tasks without losing sidebar preferences or task history', () => {
  const b = makeBackup(structuredClone(fixture));
  b.data.preferences.startView = 'tracking';
  b.data.preferences.navOrder = [
    'projects',
    'tracking',
    'all',
    'schedule',
    'inbox',
    'today',
  ];
  b.data.preferences.appearance.hiddenNav = ['inbox', 'tracking'];
  const p = validateBackup(b).data.preferences;
  assert.deepEqual(p.navOrder, ['projects', 'all', 'inbox', 'today']);
  assert.equal(p.startView, 'all');
  assert.deepEqual(p.appearance.hiddenNav, ['inbox']);
  assert.equal(p.appearance.sidebarVisible, false);
  assert.deepEqual(
    validateBackup(b).data.tasks[0].checkins,
    fixture.tasks[0].checkins,
  );
});

void test('backup restores custom home layout and rejects malformed layout before importing', async () => {
  const { defaultHomeLayout } = await import('../lib/home-layout.ts');
  const value = makeBackup(structuredClone(fixture));
  value.data.preferences.homeLayout = structuredClone(defaultHomeLayout);
  value.data.preferences.homeLayout.cards.reverse();
  value.data.preferences.homeLayout.cards[0].title = '待处理';
  value.data.preferences.homeLayout.cards[0].width = 'full';
  value.data.preferences.homeLayout.sidebarWidth = 280;
  assert.deepEqual(
    validateBackup(value).data.preferences.homeLayout,
    value.data.preferences.homeLayout,
  );
  value.data.preferences.homeLayout.cards[0].height = -1;
  assert.throws(() => validateBackup(value), /卡片设置无效/);
});
