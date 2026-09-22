import {
  validateTask,
  defaultPreferences,
  type Task,
  type Project,
  type Folder,
  type Label,
  type Preferences,
} from './model';
import { validColor, normalizeColor } from './colors';
import { validateHomeLayout } from './home-layout';
import {
  validateAppearance,
  defaultAppearance,
  navigationIds,
} from './appearance';
export type WorkspaceData = {
  tasks: Task[];
  projects: Project[];
  folders: Folder[];
  labels: Label[];
  preferences: Preferences;
};
export type Backup = {
  format: 'pat-mi';
  version: 1;
  exportedAt: string;
  data: WorkspaceData;
};
export function makeBackup(data: WorkspaceData): Backup {
  return {
    format: 'pat-mi',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}
const date = (v: unknown, empty = true): string => {
  if (empty && (v === undefined || v === '')) return '';
  if (
    typeof v !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    Number.isNaN(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw Error('备份包含无效日期');
  return v;
};
const str = (v: unknown, max: number, empty = true) => {
  if (typeof v !== 'string' || v.length > max || (!empty && !v.trim()))
    throw Error('备份包含无效文本');
  return v;
};
const id = (v: unknown) => str(v, 100, false);
const position = (v: unknown) => {
  if (v === undefined) return 0;
  if (!Number.isSafeInteger(v) || Number(v) < 0) throw Error('排序值无效');
  return Number(v);
};
function list(v: unknown, max: number): Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length > max)
    throw Error('备份数据格式或数量无效');
  const rows = v.map((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw Error('备份数据条目无效');
    return value as Record<string, unknown>;
  });
  const ids = rows.map((x) => id(x.id));
  if (new Set(ids).size !== ids.length) throw Error('备份包含重复编号');
  return rows;
}
export function validateBackup(value: unknown): Backup {
  const b = value as Backup;
  if (!b || b.format !== 'pat-mi' || b.version !== 1 || !b.data)
    throw Error('请选择 DayFrame 导出的版本 1 JSON 备份文件');
  const folders = list(b.data.folders, 1000).map((f) => ({
    id: id(f.id),
    title: str(f.title, 100, false),
    position: position(f.position),
  }));
  const labels = list(b.data.labels, 1000).map((l) => {
    if (!validColor(l.color)) throw Error('标签颜色无效');
    return { id: id(l.id), title: str(l.title, 100, false), color: normalizeColor(l.color) };
  });
  const folderIds = new Set(folders.map((f) => f.id)),
    labelIds = new Set(labels.map((l) => l.id));
  function tags(value: unknown): string[] {
    if (value === undefined) return [];
    if (
      !Array.isArray(value) ||
      value.length > 30 ||
      value.some((x) => !labelIds.has(x))
    )
      throw Error('标签关联无效');
    return [...new Set(value)];
  }
  const projects = list(b.data.projects, 1000).map((p) => {
    const start = date(p.start),
      end = date(p.end),
      folder = str(p.folder || '', 100);
    if (
      (folder && !folderIds.has(folder)) ||
      !validColor(p.color) ||
      !!start !== !!end ||
      (start && end < start)
    )
      throw Error('项目关联、颜色或排期无效');
    const scheduleMode = p.scheduleMode || (start ? 'manual' : 'auto');
    if (
      typeof scheduleMode !== 'string' ||
      !['auto', 'manual'].includes(scheduleMode)
    )
      throw Error('项目排期方式无效');
    return {
      id: id(p.id),
      title: str(p.title, 100, false),
      description: str(p.description, 2000),
      color: normalizeColor(p.color),
      folder,
      tags: tags(p.tags),
      start,
      end,
      scheduleMode,
      position: position(p.position),
    };
  });
  const projectIds = new Set(projects.map((p) => p.id));
  const tasks = list(b.data.tasks, 5000).map((raw) => {
    const t = validateTask(raw);
    if (t.project && !projectIds.has(t.project))
      throw Error('任务引用了备份中不存在的项目');
    if (t.tracking !== undefined && typeof t.tracking !== 'boolean')
      throw Error('追踪设置无效');
    const baselineStart = date(t.baselineStart),
      baselineEnd = date(t.baselineEnd),
      startedOn = date(t.startedOn),
      completedOn = date(t.completedOn);
    if (
      !!baselineStart !== !!baselineEnd ||
      (baselineStart && baselineEnd < baselineStart)
    )
      throw Error('任务原计划无效');
    const checkins = t.checkins || [];
    if (!Array.isArray(checkins) || checkins.length > 20000)
      throw Error('打卡记录无效');
    const days = new Set<string>();
    const records = checkins.map((c) => {
      const d = date(c?.date, false);
      if (days.has(d)) throw Error('存在重复日期的打卡');
      days.add(d);
      if (!Number.isInteger(c.minutes) || c.minutes < 0 || c.minutes > 1440)
        throw Error('打卡时长无效');
      return { date: d, note: str(c.note, 2000), minutes: c.minutes };
    });
    return {
      id: id(t.id),
      title: t.title,
      project: t.project,
      status: t.status,
      priority: t.priority,
      date: t.date,
      time: t.time,
      duration: t.duration,
      notes: t.notes,
      tags: tags(t.tags),
      position: position(t.position),
      tracking: !!t.tracking,
      baselineStart,
      baselineEnd,
      startedOn,
      completedOn,
      rolledDays: position(t.rolledDays),
      checkins: records,
    };
  });
  const p = { ...defaultPreferences, ...b.data.preferences };
  if (['tracking', 'schedule'].includes(p.startView)) p.startView = 'all';
  if (Array.isArray(p.navOrder))
    p.navOrder = p.navOrder.filter(
      (id: string) => !['tracking', 'schedule'].includes(id),
    );
  if (
    !navigationIds.includes(p.startView) ||
    !['comfortable', 'compact'].includes(p.density) ||
    !Array.isArray(p.navOrder) ||
    p.navOrder.length !== navigationIds.length ||
    new Set(p.navOrder).size !== navigationIds.length ||
    p.navOrder.some((i: string) => !navigationIds.includes(i))
  )
    throw Error('备份中的工作空间设置无效');
  const preferences = {
    name: str(p.name, 60, false),
    navOrder: p.navOrder,
    density: p.density,
    startView: p.startView,
    appearance: validateAppearance(p.appearance || defaultAppearance),
    ...(p.homeLayout === undefined
      ? {}
      : { homeLayout: validateHomeLayout(p.homeLayout) }),
  };
  return {
    format: 'pat-mi',
    version: 1,
    exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '',
    data: { tasks, projects, folders, labels, preferences },
  };
}
