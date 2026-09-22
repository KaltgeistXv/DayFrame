import type { Task } from './model';
export const STEP = 15;
export const HOUR_HEIGHT = 48;
export const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export const snap = (n: number) => Math.round(n / STEP) * STEP;
export const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export const clock = (n: number) =>
  `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
export const MAX_DURATION = 5270400;
export function taskStart(t: Pick<Task, 'date' | 'time'>) {
  return Date.parse(t.date + 'T00:00:00Z') + minutes(t.time) * 60000;
}
export function taskEnd(t: Pick<Task, 'date' | 'time' | 'duration'>) {
  const d = new Date(taskStart(t) + t.duration * 60000);
  return {
    date: d.toISOString().slice(0, 10),
    time: d.toISOString().slice(11, 16),
  };
}
export function occursOn(t: Task, date: string) {
  if (!t.date) return false;
  const start = taskStart(t),
    end = start + t.duration * 60000,
    day = Date.parse(date + 'T00:00:00Z');
  return start < day + 86400000 && end > day;
}
export function segment(t: Task, date: string) {
  if (!occursOn(t, date)) return null;
  const offset =
      (Date.parse(date + 'T00:00:00Z') - Date.parse(t.date + 'T00:00:00Z')) /
      60000,
    start = Math.max(0, minutes(t.time) - offset),
    end = Math.min(1440, minutes(t.time) + t.duration - offset);
  return {
    start,
    visibleDuration: end - start,
    continuation: offset > 0,
    endsHere: minutes(t.time) + t.duration - offset <= 1440,
  };
}
export const endLabel = (t: Pick<Task, 'time' | 'duration'>) => {
  const n = Math.floor((minutes(t.time) + t.duration) / 1440);
  return `${n === 1 ? '次日 ' : n > 1 ? n + ' 天后 ' : ''}${clock(minutes(t.time) + t.duration)}`;
};
export function rangeAcross(
  startDate: string,
  start: number,
  endDate: string,
  end: number,
) {
  const delta =
      ((Date.parse(endDate) - Date.parse(startDate)) / 86400000) * 1440,
    a = Math.floor(start / STEP) * STEP,
    b = delta + snap(end),
    lo = Math.min(a, b),
    hi = Math.max(a, b),
    d = new Date(startDate + 'T00:00:00Z');
  d.setUTCMinutes(lo);
  return {
    date: d.toISOString().slice(0, 10),
    start: d.getUTCHours() * 60 + d.getUTCMinutes(),
    duration: clamp(hi - lo, STEP, MAX_DURATION),
  };
}
export function selectionRange(start: number, current: number) {
  const a = clamp(Math.floor(start / STEP) * STEP, 0, 1440 - STEP);
  const b = clamp(snap(current), 0, 1440);
  return { start: Math.min(a, b), duration: Math.max(STEP, Math.abs(a - b)) };
}
export function resized(t: Task, edge: 'start' | 'end', minute: number): Task {
  const start = minutes(t.time),
    end = start + t.duration;
  if (edge === 'start') {
    const next = clamp(snap(minute), end - MAX_DURATION, end - STEP);
    return { ...shiftedTask(t, next - start), duration: end - next };
  }
  return { ...t, duration: clamp(snap(minute) - start, STEP, MAX_DURATION) };
}
// Calendar arithmetic uses dates as labels, avoiding daylight-saving jumps in wall-clock time.
export function shiftedTask(t: Task, delta: number): Task {
  const d = new Date(`${t.date}T00:00:00Z`);
  d.setUTCMinutes(minutes(t.time) + delta);
  return {
    ...t,
    date: d.toISOString().slice(0, 10),
    time: clock(d.getUTCHours() * 60 + d.getUTCMinutes()),
  };
}
export function deltaTo(t: Task, date: string, minute: number) {
  return (
    ((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${t.date}T00:00:00Z`)) /
      86400000) *
      1440 +
    minute -
    minutes(t.time)
  );
}
export type Rect = { left: number; top: number; right: number; bottom: number };
export const intersects = (a: Rect, b: Rect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
export function layoutEvents(tasks: Task[], date: string) {
  const items = tasks
    .filter((t) => t.time && occursOn(t, date))
    .map((t) => ({ ...t, ...segment(t, date)!, lane: 0, lanes: 1 }))
    .sort((a, b) => a.start - b.start || b.visibleDuration - a.visibleDuration);
  let group: typeof items = [],
    ends: number[] = [];
  const flush = () => {
    for (const t of group) t.lanes = ends.length;
    group = [];
    ends = [];
  };
  for (const t of items) {
    if (group.length && t.start >= Math.max(...ends)) flush();
    let lane = ends.findIndex((e) => e <= t.start);
    if (lane < 0) lane = ends.length;
    t.lane = lane;
    ends[lane] = t.start + t.visibleDuration;
    group.push(t);
  }
  flush();
  return items;
}

export function dragDelta(
  originDate: string,
  originMinute: number,
  targetDate: string,
  targetMinute: number,
) {
  return (
    ((Date.parse(targetDate) - Date.parse(originDate)) / 86400000) * 1440 +
    snap(targetMinute - originMinute)
  );
}
