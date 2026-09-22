import type { Task } from './model';
import { lastTaskDate } from './task-scheduling';
import { colorStyle } from './colors';

// Display projections never change stored dates or infer activity from elapsed time.
export function taskSpan(task: Task) {
  const original =
    task.tracking && task.baselineStart && (task.rolledDays || 0) > 0;
  const start = original ? task.baselineStart! : task.date;
  const planEnd = original
    ? task.baselineEnd || lastTaskDate(task)
    : lastTaskDate(task);
  return {
    start,
    planEnd,
    end: [planEnd, lastTaskDate(task)].sort().at(-1) || '',
  };
}
export function taskDayState(task: Task, date: string) {
  const span = taskSpan(task);
  const planned = !!span.start && date >= span.start && date <= span.planEnd;
  const checked = !!task.checkins?.some((c) => c.date === date);
  return {
    planned,
    checked,
    strength: checked
      ? planned
        ? 0.48
        : 0.32
      : planned
        ? task.tracking
          ? 0.23
          : 0.15
        : 0.07,
  };
}
export function taskRangeStyle(
  task: Task,
  color: string,
  first: string,
  last: string,
) {
  const count =
    Math.round((Date.parse(last) - Date.parse(first)) / 86400000) + 1;
  const base = colorStyle(color);
  if (!Number.isFinite(count) || count < 1) return base;
  const stops = Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.parse(first) + i * 86400000)
      .toISOString()
      .slice(0, 10);
    const fill = colorStyle(
      color,
      taskDayState(task, date).strength,
    ).backgroundColor;
    return `${fill} ${(i / count) * 100}%, ${fill} ${((i + 1) / count) * 100}%`;
  });
  return {
    ...base,
    borderColor: base.borderColor + '55',
    background: `linear-gradient(to right, ${stops.join(', ')})`,
  };
}
export function trackingMatches(task: Task, scope: string) {
  return (
    scope === 'all' || (scope === 'tracked' ? !!task.tracking : !task.tracking)
  );
}
export function canCheckIn(task: Task, date: string, today: string) {
  const span = taskSpan(task);
  const recorded = !!task.checkins?.some((c) => c.date === date);
  const end = task.status === 'done' ? task.completedOn || span.end : span.end;
  return (
    !!task.tracking &&
    date <= today &&
    (recorded || (!!span.start && date >= span.start && date <= end))
  );
}
