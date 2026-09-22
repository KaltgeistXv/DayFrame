import type { Task } from './model';
// Date-only tasks occupy complete calendar days; timed tasks have an exclusive end.
export function lastTaskDate(t: Task) {
  if (!t.date) return '';
  const start = Date.parse(t.date + 'T' + (t.time || '00:00') + ':00Z');
  return new Date(start + Math.max(1, t.duration) * 60000 - 1)
    .toISOString()
    .slice(0, 10);
}
export function daySpan(t: Task) {
  return t.date
    ? Math.max(
        1,
        (Date.parse(lastTaskDate(t)) - Date.parse(t.date)) / 86400000 + 1,
      )
    : Math.max(1, Math.ceil(t.duration / 1440));
}
export function moveByDate(t: Task, origin: string, target: string): Task {
  const delta = Date.parse(target) - Date.parse(origin || t.date || target);
  return {
    ...t,
    date: new Date(Date.parse(t.date || target) + delta)
      .toISOString()
      .slice(0, 10),
  };
}
export function withoutTime(t: Task, origin = t.date, target = t.date): Task {
  return {
    ...moveByDate(t, origin, target),
    time: '',
    duration: Math.min(5270400, daySpan(t) * 1440),
  };
}
export function atTime(
  t: Task,
  target: string,
  time: string,
  origin = t.date,
): Task {
  const moved = moveByDate(t, origin, target);
  return {
    ...moved,
    time,
    duration:
      !t.time && daySpan(t) === 1 && t.duration >= 1440 ? 60 : t.duration,
  };
}
export const unplan = (t: Task): Task => ({ ...t, date: '', time: '' });

export type TaskDateAction = 'move' | 'start' | 'end' | 'range';
export function changeTaskDates(
  t: Task,
  action: TaskDateAction,
  origin: string,
  target: string,
): Task {
  if (action === 'move') return moveByDate(t, origin, target);
  if (action === 'range' || !t.date) {
    const start = origin < target ? origin : target,
      end = origin > target ? origin : target;
    return {
      ...t,
      date: start,
      time: '',
      duration: Math.min(
        5270400,
        ((Date.parse(end) - Date.parse(start)) / 86400000 + 1) * 1440,
      ),
    };
  }
  const start = Date.parse(t.date + 'T' + (t.time || '00:00') + ':00Z');
  const end = start + (t.time ? t.duration : daySpan(t) * 1440) * 60000;
  if (action === 'end') {
    const desired = end + (Date.parse(target) - Date.parse(lastTaskDate(t)));
    return {
      ...t,
      duration: Math.max(
        t.time ? 5 : 1440,
        Math.min(5270400, (desired - start) / 60000),
      ),
    };
  }
  const desired = start + (Date.parse(target) - Date.parse(t.date));
  const next = Math.max(
    end - 5270400 * 60000,
    Math.min(end - (t.time ? 5 : 1440) * 60000, desired),
  );
  const date = new Date(next).toISOString();
  return {
    ...t,
    date: date.slice(0, 10),
    time: t.time ? date.slice(11, 16) : '',
    duration: (end - next) / 60000,
  };
}
