import { validateBackup } from '@/lib/backup';
import { sameWorkspace } from '@/lib/workspace-history';
import {
  appearanceOf,
  validateAppearance,
  navigationOrder,
  currentSection,
} from '@/lib/appearance';
import { importWorkspace } from '@/db/import-workspace';
import { resetWorkspace } from '@/db/reset-workspace';
import { normalizedHomeLayout, validateHomeLayout } from '@/lib/home-layout';
import { prepareTracking, rollForward } from '@/lib/progress';
import { serverCalendarDate } from '@/lib/calendar-date';
import type {
  Task,
  Project,
  Preferences,
  CheckIn,
  Folder,
  Label,
} from '@/lib/model';
type StoredTask = Omit<Task, 'tags' | 'tracking' | 'checkins'> & {
  tags: string;
  tracking: number;
  checkins: string;
};
type HydratedTask = Task & {
  tags: string[];
  checkins: CheckIn[];
};
// Shape expected by each action; branches below validate fields before writing.
type WorkspaceRequest =
  | { action: 'restoreWorkspace'; backup: unknown; expected: unknown }
  | { action: 'resetWorkspace'; confirmation: unknown }
  | { action: 'importWorkspace'; backup: unknown; mode: unknown }
  | { action: 'saveAppearance'; appearance: unknown }
  | {
      action: 'saveCheckIn' | 'deleteCheckIn';
      id: string;
      date: string;
      note: string;
      minutes: number;
    }
  | { action: 'saveTask'; task: Task }
  | { action: 'saveTasks'; tasks: Task[] }
  | { action: 'saveProject'; project: Project }
  | {
      action: 'saveFolder' | 'saveLabel';
      item: { id?: string; title: string; color?: string };
    }
  | { action: 'deleteFolder' | 'deleteLabel' | 'deleteProject'; id: string }
  | { action: 'deleteTask'; id: string }
  | { action: 'deleteTasks'; ids: string[] }
  | {
      action: 'moveItem';
      kind: string;
      id: string;
      target: string;
      after?: boolean;
      preserveStatus?: boolean;
    }
  | { action: 'saveHomeLayout'; layout: unknown }
  | { action: 'savePreferences'; preferences: Preferences };

import { validColor, normalizeColor } from '@/lib/colors';
import { database } from '@/db/raw';
import { validateTask, shift, defaultPreferences } from '@/lib/model';
export const dynamic = 'force-dynamic';
const json = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { 'Cache-Control': 'no-store' } });
async function read() {
  const db = database();
  const today = serverCalendarDate();
  await rollover(today);
  await repairOrdinaryCompletionDates(today);
  const [tasks, projects, folders, labels, prefs] = await db.batch([
    db.prepare('SELECT * FROM tasks ORDER BY position,rowid'),
    db.prepare('SELECT * FROM projects ORDER BY position,rowid'),
    db.prepare('SELECT * FROM folders ORDER BY position,rowid'),
    db.prepare('SELECT * FROM labels ORDER BY title'),
    db.prepare("SELECT value FROM settings WHERE key='preferences'"),
  ]);
  const decode = <T>(rows: unknown[]) =>
    rows.map((row) => {
      const r = row as T & { tags?: string };
      return { ...r, tags: JSON.parse(r.tags || '[]') as string[] };
    });
  const preferences = {
    ...defaultPreferences,
    ...(prefs.results[0]
      ? JSON.parse(String((prefs.results[0] as { value: string }).value))
      : {}),
  };
  preferences.homeLayout = normalizedHomeLayout(preferences.homeLayout);
  preferences.appearance = appearanceOf(preferences.appearance);
  preferences.navOrder = navigationOrder(preferences.navOrder);
  preferences.startView = currentSection(preferences.startView);
  return {
    tasks: tasks.results.map(taskFromRow),
    projects: decode<Project>(projects.results),
    folders: folders.results as Folder[],
    labels: labels.results as Label[],
    preferences,
  };
}
const validDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
const cleanId = (id: unknown) => {
  if (typeof id !== 'string' || !id || id.length > 100) throw Error('编号无效');
  return id;
};
const titleOf = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 100)
    throw Error('名称应为 1–100 字');
  return value.trim();
};
async function tagIds(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30)
    throw Error('最多选择 30 个标签');
  const allowed = new Set(
    (await database().prepare('SELECT id FROM labels').all()).results.map(
      (r) => r.id,
    ),
  );
  if (value.some((id) => !allowed.has(id)))
    throw Error('标签不存在，请重新加载');
  return [...new Set(value)];
}
function taskFromRow(row: unknown): HydratedTask {
  const task = row as StoredTask;
  return {
    ...task,
    tags: JSON.parse(task.tags || '[]') as string[],
    tracking: !!task.tracking,
    checkins: Object.values(
      JSON.parse(task.checkins || '{}') as Record<string, CheckIn>,
    ).sort((a, b) => b.date.localeCompare(a.date)),
  };
}
async function repairOrdinaryCompletionDates(today: string) {
  const db = database();
  const rows = (
    await db
      .prepare(
        "SELECT * FROM tasks WHERE tracking=0 AND status='done' AND date!=''",
      )
      .all()
  ).results;
  const statements = rows.flatMap((row) => {
    const task = taskFromRow(row);
    const repaired = prepareTracking(task, task, today);
    return task.startedOn === repaired.startedOn &&
      task.completedOn === repaired.completedOn
      ? []
      : [writeTask(repaired)];
  });
  if (statements.length) await db.batch(statements);
}
async function rollover(today: string) {
  const db = database();
  const rows = (
    await db
      .prepare(
        "SELECT * FROM tasks WHERE tracking=1 AND status!='done' AND date!=''",
      )
      .all()
  ).results;
  const statements = rows.flatMap((row) => {
    const task = row as unknown as Task;
    const next = rollForward(task, today);
    return next === task
      ? []
      : [
          db
            .prepare(
              'UPDATE tasks SET date=?,rolledDays=? WHERE id=? AND date=? AND duration=? AND time=? AND tracking=1 AND status!=?',
            )
            .bind(
              next.date,
              next.rolledDays,
              task.id,
              task.date,
              task.duration,
              task.time,
              'done',
            ),
        ];
  });
  if (statements.length) await db.batch(statements);
}
function writeTask(t: Task) {
  // Move only the automatic completion marker; never replace recorded effort.
  const records = `CASE WHEN tasks.completedOn != excluded.completedOn
    AND json_extract(tasks.checkins,'$."'||tasks.completedOn||'".note')='完成任务'
    AND json_extract(tasks.checkins,'$."'||tasks.completedOn||'".minutes')=0
    THEN json_remove(tasks.checkins,'$."'||tasks.completedOn||'"')
    ELSE tasks.checkins END`;
  return database()
    .prepare(
      `INSERT INTO tasks(id,title,project,status,priority,date,time,duration,notes,tags,position,tracking,baselineStart,baselineEnd,startedOn,completedOn,rolledDays,checkins) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,project=excluded.project,status=excluded.status,priority=excluded.priority,date=excluded.date,time=excluded.time,duration=excluded.duration,notes=excluded.notes,tags=excluded.tags,tracking=excluded.tracking,baselineStart=excluded.baselineStart,baselineEnd=excluded.baselineEnd,startedOn=excluded.startedOn,completedOn=excluded.completedOn,rolledDays=excluded.rolledDays,checkins=CASE WHEN excluded.status='done' THEN json_insert(${records},'$."'||excluded.completedOn||'"',json_object('date',excluded.completedOn,'minutes',0,'note','完成任务')) ELSE ${t.undoCompletion ? records : 'tasks.checkins'} END`,
    )
    .bind(
      t.id,
      t.title,
      t.project,
      t.status,
      t.priority,
      t.date,
      t.time,
      t.duration,
      t.notes,
      JSON.stringify(t.tags || []),
      t.position ?? Date.now(),
      t.tracking ? 1 : 0,
      t.baselineStart || '',
      t.baselineEnd || '',
      t.startedOn || '',
      t.completedOn || '',
      t.rolledDays || 0,
      t.status === 'done' && t.completedOn
        ? JSON.stringify({
            [t.completedOn]: {
              date: t.completedOn,
              minutes: 0,
              note: '完成任务',
            },
          })
        : '{}',
    );
}
export async function GET() {
  try {
    const db = database();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const ps = [
      ['brand', '品牌焕新', '从品牌定位到视觉表达，建立一致的品牌体验。', '0'],
      ['product', '产品设计', '把复杂的工作，变成简单的体验。', '1'],
      ['growth', '个人成长', '为阅读、学习和生活留出空间。', '2'],
    ];
    const ts = [
      [
        '1',
        '整理品牌视觉参考',
        'brand',
        'doing',
        'high',
        today,
        '09:30',
        60,
        '收集 5 个参考案例，整理字体、配色和版式方向。',
      ],
      [
        '2',
        '完成工作台交互方案',
        'product',
        'doing',
        'high',
        today,
        '14:00',
        90,
        '重点梳理任务创建与日历排期的路径。',
      ],
      [
        '3',
        '阅读 30 分钟，记录一个想法',
        'growth',
        'todo',
        'low',
        today,
        '20:30',
        30,
        '',
      ],
      [
        '4',
        '梳理新版本的核心需求',
        'product',
        'todo',
        'medium',
        today,
        '',
        60,
        '',
      ],
      ['5', '整理本周工作清单', '', 'done', 'medium', today, '08:30', 30, ''],
      [
        '6',
        '确定品牌主色与字体',
        'brand',
        'todo',
        'medium',
        shift(today, 2),
        '10:00',
        60,
        '',
      ],
      [
        '7',
        '准备可用性测试问题',
        'product',
        'todo',
        'high',
        shift(today, 3),
        '',
        60,
        '',
      ],
      [
        '8',
        '尝试一个新的习惯',
        'growth',
        'todo',
        'low',
        shift(today, 4),
        '07:30',
        30,
        '',
      ],
      [
        '9',
        '给下一次灵感留个位置',
        '',
        'todo',
        'low',
        '',
        '',
        30,
        '随手收集，再决定什么时候做。',
      ],
    ];
    await db.batch([
      ...ps.map((p) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO projects(id,title,description,color) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM settings WHERE key='initialized')",
          )
          .bind(...p),
      ),
      ...ts.map((t) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO tasks(id,title,project,status,priority,date,time,duration,notes) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM settings WHERE key='initialized')",
          )
          .bind(...t),
      ),
      db.prepare(
        "INSERT OR IGNORE INTO settings(key,value) VALUES('initialized','1')",
      ),
    ]);
    return json(await read());
  } catch {
    return json({ error: '暂时无法加载，请重试。' }, 500);
  }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('Origin');
    if (origin && origin !== new URL(req.url).origin)
      return json({ error: '请求来源无效' }, 403);
    const db = database();
    const body = await req.text();
    if (new TextEncoder().encode(body).length > 10 * 1024 * 1024)
      throw Error('文件不能超过 10 MB');
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw Error('请求格式无效');
    const x = parsed as WorkspaceRequest;
    const before = (parsed as { captureUndo?: boolean }).captureUndo
      ? await read()
      : undefined;
    if (x.action === 'restoreWorkspace') {
      const expected = validateBackup(x.expected).data;
      const backup = validateBackup(x.backup);
      if (!sameWorkspace(await read(), expected))
        return json(
          { error: '数据已在其他页面更改，请刷新后重试，未覆盖任何数据。' },
          409,
        );
      await importWorkspace(backup, 'replace');
    } else if (x.action === 'resetWorkspace') {
      await resetWorkspace(db, x.confirmation);
    } else if (x.action === 'importWorkspace') {
      await importWorkspace(x.backup, x.mode);
    } else if (x.action === 'saveAppearance') {
      const appearance = validateAppearance(x.appearance);
      await db
        .prepare(
          "INSERT INTO settings(key,value) VALUES('preferences',?) ON CONFLICT(key) DO UPDATE SET value=json_patch(settings.value,excluded.value)",
        )
        .bind(JSON.stringify({ appearance }))
        .run();
    } else if (x.action === 'saveCheckIn' || x.action === 'deleteCheckIn') {
      const id = cleanId(x.id),
        date = x.date;
      const current = await db
        .prepare('SELECT * FROM tasks WHERE id=?')
        .bind(id)
        .first<StoredTask>();
      if (!current) throw Error('任务不存在');
      if (
        typeof date !== 'string' ||
        !validDate(date) ||
        date > serverCalendarDate()
      )
        throw Error('请选择今天或过去的日期');
      const path = '$."' + date + '"';
      if (x.action === 'deleteCheckIn') {
        await db
          .prepare(
            'UPDATE tasks SET checkins=json_remove(checkins,?) WHERE id=?',
          )
          .bind(path, id)
          .run();
      } else {
        if (
          !current.tracking &&
          !Object.keys(JSON.parse(current.checkins || '{}')).length
        )
          throw Error('请先在任务中开启“自动追踪”');
        if (
          current.status === 'done' &&
          current.completedOn &&
          date > current.completedOn
        )
          throw Error('完成日期之后不能新增打卡，请先将任务标记为未完成');
        if (
          typeof x.note !== 'string' ||
          x.note.length > 2000 ||
          !Number.isInteger(x.minutes) ||
          x.minutes < 0 ||
          x.minutes > 1440
        )
          throw Error(
            typeof x.note !== 'string'
              ? '进展格式无效'
              : x.note.length > 2000
                ? '进展不能超过 2000 字'
                : '打卡记录中的时长须为 0–1440 的整数分钟',
          );
        const record = JSON.stringify({
          date,
          note: x.note.trim(),
          minutes: x.minutes,
        });
        await db
          .prepare(
            "UPDATE tasks SET checkins=json_set(checkins,?,json(?)), status=CASE WHEN status='todo' THEN 'doing' ELSE status END, startedOn=CASE WHEN startedOn='' OR startedOn>? THEN ? ELSE startedOn END WHERE id=?",
          )
          .bind(path, record, date, date, id)
          .run();
      }
    } else if (x.action === 'saveTask' || x.action === 'saveTasks') {
      const raw =
        x.action === 'saveTask'
          ? [{ ...x.task, id: x.task?.id || crypto.randomUUID() }]
          : x.tasks;
      if (!Array.isArray(raw) || !raw.length || raw.length > 200)
        throw Error('每次可更新 1–200 项任务');
      const records = raw.map(validateTask);
      records.forEach((t) => cleanId(t.id));
      if (new Set(records.map((t) => t.id)).size !== records.length)
        throw Error('编号重复');
      const ps = new Set(
        (await db.prepare('SELECT id FROM projects').all()).results.map(
          (r) => r.id,
        ),
      );
      for (const t of records) {
        if (t.project && !ps.has(t.project)) throw Error('项目不存在');
        t.tags = await tagIds(t.tags);
      }
      const existing = (await db.prepare('SELECT * FROM tasks').all()).results;
      const prepared = records.map((t) => {
        if (t.tracking !== undefined && typeof t.tracking !== 'boolean')
          throw Error('追踪设置无效');
        return prepareTracking(
          t,
          existing.find((r) => r.id === t.id) as unknown as Task | undefined,
          serverCalendarDate(),
        );
      });
      await db.batch(prepared.map(writeTask));
    } else if (x.action === 'saveProject') {
      const p = x.project;
      if (!p) throw Error('项目无效');
      const id = p.id ? cleanId(p.id) : crypto.randomUUID(),
        title = titleOf(p.title),
        folder = p.folder || '',
        start = p.start || '',
        end = p.end || '';
      if (
        typeof p.description !== 'string' ||
        p.description.length > 2000 ||
        !validColor(p.color)
      )
        throw Error('项目内容无效');
      if (
        folder &&
        !(await db
          .prepare('SELECT id FROM folders WHERE id=?')
          .bind(folder)
          .first())
      )
        throw Error('文件夹不存在');
      if (
        (start || end) &&
        (!validDate(start) || !validDate(end) || end < start)
      )
        throw Error('请填写完整且顺序正确的项目起止日期');
      const tags = await tagIds(p.tags);
      const mode = p.scheduleMode || (start ? 'manual' : 'auto');
      if (!['auto', 'manual'].includes(mode)) throw Error('排期方式无效');
      await db
        .prepare(
          'INSERT INTO projects(id,title,description,color,folder,tags,start,end,position,scheduleMode) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,color=excluded.color,folder=excluded.folder,tags=excluded.tags,start=excluded.start,end=excluded.end,scheduleMode=excluded.scheduleMode',
        )
        .bind(
          id,
          title,
          p.description,
          normalizeColor(p.color),
          folder,
          JSON.stringify(tags),
          start,
          end,
          p.position || Date.now(),
          mode,
        )
        .run();
    } else if (x.action === 'saveFolder' || x.action === 'saveLabel') {
      const v = x.item,
        id = v?.id ? cleanId(v.id) : crypto.randomUUID(),
        title = titleOf(v?.title);
      if (x.action === 'saveFolder')
        await db
          .prepare(
            'INSERT INTO folders(id,title,position) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title',
          )
          .bind(id, title, Date.now())
          .run();
      else {
        if (!validColor(v.color)) throw Error('颜色无效');
        await db
          .prepare(
            'INSERT INTO labels(id,title,color) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,color=excluded.color',
          )
          .bind(id, title, normalizeColor(v.color))
          .run();
      }
    } else if (x.action === 'deleteFolder') {
      const id = cleanId(x.id);
      await db.batch([
        db.prepare("UPDATE projects SET folder='' WHERE folder=?").bind(id),
        db.prepare('DELETE FROM folders WHERE id=?').bind(id),
      ]);
    } else if (x.action === 'deleteLabel') {
      const id = cleanId(x.id),
        data = await read();
      await db.batch([
        ...data.tasks
          .filter((t) => t.tags.includes(id))
          .map((t) =>
            db
              .prepare('UPDATE tasks SET tags=? WHERE id=?')
              .bind(
                JSON.stringify(t.tags.filter((tag: string) => tag !== id)),
                t.id,
              ),
          ),
        ...data.projects
          .filter((p) => p.tags.includes(id))
          .map((p) =>
            db
              .prepare('UPDATE projects SET tags=? WHERE id=?')
              .bind(
                JSON.stringify(p.tags.filter((tag: string) => tag !== id)),
                p.id,
              ),
          ),
        db.prepare('DELETE FROM labels WHERE id=?').bind(id),
      ]);
    } else if (x.action === 'moveItem') {
      if (!['projects', 'folders', 'tasks'].includes(x.kind))
        throw Error('排序对象无效');
      const id = cleanId(x.id),
        target = cleanId(x.target);
      if (id === target) return json(await read());
      const table = x.kind as string,
        rows = (
          await db
            .prepare('SELECT * FROM ' + table + ' ORDER BY position,rowid')
            .all()
        ).results;
      const source = rows.find((r) => r.id === id),
        dest = rows.find((r) => r.id === target);
      if (!source || !dest) throw Error('排序对象不存在');
      const order = rows.filter((r) => r.id !== id),
        i = order.findIndex((r) => r.id === target);
      order.splice(i + (x.after ? 1 : 0), 0, source);
      const statements = order.map((r, i) =>
        db
          .prepare('UPDATE ' + table + ' SET position=? WHERE id=?')
          .bind(i, r.id),
      );
      if (table === 'projects')
        statements.push(
          db
            .prepare('UPDATE projects SET folder=? WHERE id=?')
            .bind(dest.folder, id),
        );
      if (table === 'tasks' && x.preserveStatus !== true)
        statements.push(
          writeTask(
            prepareTracking(
              {
                ...source,
                tags: JSON.parse(
                  typeof source.tags === 'string' ? source.tags : '[]',
                ),
                status: dest.status,
              } as unknown as Task,
              source as unknown as Task,
              serverCalendarDate(),
            ),
          ),
        );
      await db.batch(statements);
    } else if (x.action === 'saveHomeLayout') {
      const homeLayout = validateHomeLayout(x.layout);
      await db
        .prepare(
          "INSERT INTO settings(key,value) VALUES('preferences',?) ON CONFLICT(key) DO UPDATE SET value=json_patch(settings.value,excluded.value)",
        )
        .bind(JSON.stringify({ homeLayout }))
        .run();
    } else if (x.action === 'savePreferences') {
      const p = x.preferences && {
        ...x.preferences,
        startView: currentSection(x.preferences.startView),
        navOrder: Array.isArray(x.preferences.navOrder)
          ? x.preferences.navOrder.filter(
              (id: string) => !['tracking', 'schedule'].includes(id),
            )
          : x.preferences.navOrder,
      };
      if (
        !p ||
        typeof p.name !== 'string' ||
        !p.name.trim() ||
        p.name.length > 60 ||
        !['comfortable', 'compact'].includes(p.density) ||
        !defaultPreferences.navOrder.includes(p.startView) ||
        !Array.isArray(p.navOrder) ||
        p.navOrder.length !== defaultPreferences.navOrder.length ||
        new Set(p.navOrder).size !== defaultPreferences.navOrder.length ||
        p.navOrder.some(
          (id: string) => !defaultPreferences.navOrder.includes(id),
        )
      )
        throw Error('工作空间设置无效，请检查后重试');
      await db
        .prepare(
          "INSERT INTO settings(key,value) VALUES('preferences',?) ON CONFLICT(key) DO UPDATE SET value=json_patch(settings.value,excluded.value)",
        )
        .bind(
          JSON.stringify({
            name: p.name.trim(),
            density: p.density,
            startView: p.startView,
            navOrder: p.navOrder,
          }),
        )
        .run();
    } else if (x.action === 'deleteTask' || x.action === 'deleteTasks') {
      const ids = x.action === 'deleteTask' ? [x.id] : x.ids;
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > 200 ||
        new Set(ids).size !== ids.length
      )
        throw Error('每次删除 1–200 项任务');
      ids.forEach(cleanId);
      await db.batch(
        ids.map((id) => db.prepare('DELETE FROM tasks WHERE id=?').bind(id)),
      );
    } else if (x.action === 'deleteProject') {
      const id = cleanId(x.id);
      await db.batch([
        db.prepare("UPDATE tasks SET project='' WHERE project=?").bind(id),
        db.prepare('DELETE FROM projects WHERE id=?').bind(id),
      ]);
    } else throw Error('操作无效');
    return json({
      ...(await read()),
      ...(before ? { undoBefore: before } : {}),
    });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : '保存失败，请重试' },
      400,
    );
  }
}
