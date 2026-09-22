import type { Task } from './model';
import { lastTaskDate } from './task-scheduling';
import { progressOf } from './progress';

export type TaskFocus = 'all' | 'today' | 'overdue' | 'checkins';
export const taskFocusOptions = [
  ['all', '全部任务'], ['today', '今日待办'], ['overdue', '延期任务'], ['checkins', '今日打卡'],
];
// Entry intent overrides a remembered presentation only for an explicit destination.
export function navigationTarget(id: string) {
  const explicit: Record<string, { section: string; view: string; focus: TaskFocus; completion: string; tracking: string; today?: boolean }> = {
    'today-tasks': { section: 'all', view: 'list', focus: 'today', completion: 'active', tracking: 'all' },
    'overdue-tasks': { section: 'all', view: 'list', focus: 'overdue', completion: 'active', tracking: 'tracked' },
    'today-checkins': { section: 'all', view: 'list', focus: 'checkins', completion: 'all', tracking: 'all' },
    'unplanned-tasks': { section: 'inbox', view: 'list', focus: 'all', completion: 'active', tracking: 'all' },
    schedule: { section: 'all', view: 'calendar', focus: 'all', completion: 'all', tracking: 'all', today: true },
    tracking: { section: 'all', view: 'timeline', focus: 'all', completion: 'active', tracking: 'tracked' },
  };
  return explicit[id] || null;
}
export function matchesTaskFocus(task: Task, focus: TaskFocus, today: string) {
  if (focus === 'today') return task.status !== 'done' && !!task.date && task.date <= today && lastTaskDate(task) >= today;
  if (focus === 'overdue') return !!task.tracking && task.status !== 'done' && progressOf(task, today).late > 0;
  if (focus === 'checkins') return !!task.checkins?.some(record => record.date === today);
  return true;
}
export function statusGroupKey(section: string, status: string) {
  return `${section}:status:${status}`;
}
