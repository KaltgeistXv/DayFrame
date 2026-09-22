import type { Appearance } from './appearance';
import type { HomeLayout } from './home-layout';
export type CheckIn = { date: string; note: string; minutes: number };
export type Task = {
  // Transient calendar projection; never stored as another task.
  calendarOriginal?: boolean;
  completionDrag?: boolean;
  undoCompletion?: boolean;
  calendarHistory?: { date: string; time: string; duration: number };
  checkins?: CheckIn[];
  id: string;
  title: string;
  project: string;
  status: string;
  priority: string;
  date: string;
  time: string;
  duration: number;
  notes: string;
  tags?: string[];
  tracking?: boolean;
  baselineStart?: string;
  baselineEnd?: string;
  startedOn?: string;
  completedOn?: string;
  rolledDays?: number;
  position?: number;
};
export type Project = {
  scheduleMode?: string;
  id: string;
  title: string;
  description: string;
  color: string;
  folder?: string;
  tags?: string[];
  start?: string;
  end?: string;
  position?: number;
};
export const statuses = [
  ['todo', '待开始'],
  ['doing', '进行中'],
  ['done', '已完成'],
];
export const priorities = [
  ['high', '高优先级'],
  ['medium', '中优先级'],
  ['low', '低优先级'],
];
export function day(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function shift(s: string, n: number) {
  const d = new Date(s + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return day(d);
}
export const blankTask = (date = ''): Task => ({
  id: '',
  title: '',
  project: '',
  status: 'todo',
  priority: 'medium',
  date,
  time: '',
  duration: 60,
  notes: '',
});
export function validateTask(value: unknown): Task {
  const x = value as Task;
  if (
    !x ||
    typeof x.title !== 'string' ||
    !x.title.trim() ||
    x.title.length > 200
  )
    throw Error('请填写 1–200 字的任务名称');
  for (const k of ['project', 'date', 'time', 'notes'] as const)
    if (typeof x[k] !== 'string') throw Error('任务格式不正确');
  if (x.notes.length > 10000 || x.project.length > 100)
    throw Error(
      x.notes.length > 10000
        ? '备注不能超过 10000 字'
        : '任务关联的项目编号过长',
    );
  if (
    !statuses.some(([s]) => s === x.status) ||
    !priorities.some(([s]) => s === x.priority)
  )
    throw Error('状态或优先级无效');
  if (
    x.date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(x.date) ||
      Number.isNaN(Date.parse(x.date)) ||
      new Date(x.date).toISOString().slice(0, 10) !== x.date)
  )
    throw Error('日期无效');
  if (x.time && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) || !x.date))
    throw Error('请先选择日期，再设置时间');
  if (!Number.isInteger(x.duration) || x.duration < 5 || x.duration > 5270400)
    throw Error('时长应为 5–5270400 分钟');
  if (
    x.tags !== undefined &&
    (!Array.isArray(x.tags) ||
      x.tags.length > 30 ||
      x.tags.some((id: unknown) => typeof id !== 'string'))
  )
    throw Error('标签格式无效');
  return { ...x, title: x.title.trim(), tags: x.tags || [] };
}

export type Folder = { id: string; title: string; position: number };
export type Label = { id: string; title: string; color: string };
export type Preferences = {
  appearance?: Appearance;
  homeLayout?: HomeLayout;
  name: string;
  navOrder: string[];
  density: string;
  startView: string;
};
export const defaultPreferences: Preferences = {
  name: '我的工作空间',
  navOrder: ['today', 'inbox', 'all', 'projects'],
  density: 'comfortable',
  startView: 'today',
};
