import type { Task } from './model';
import { lastTaskDate } from './task-scheduling';
export const calendarPeriods = [
  ['year', '年'],
  ['month', '月'],
  ['week', '周'],
  ['day', '日'],
];
export function startOfCalendarWeek(date: string) {
  const monday = new Date(date + 'T12:00:00Z');
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}
export function monthGrid(month: string) {
  const first = new Date(month.slice(0, 7) + '-01T12:00:00Z');
  first.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) =>
    new Date(first.getTime() + i * 86400000).toISOString().slice(0, 10),
  );
}
export function monthVisibleWeekCount(month: string) {
  const first = month.slice(0, 7) + '-01';
  const end = new Date(first + 'T12:00:00Z');
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return Math.ceil(
    (Date.parse(end.toISOString().slice(0, 10)) -
      Date.parse(startOfCalendarWeek(first)) +
      86400000) /
      (7 * 86400000),
  );
}
// Assign every ISO week to the month containing its Thursday. Adjacent month
// sections therefore form one continuous date stream without duplicate days.
export function monthWeeks(month: string) {
  const target = month.slice(0, 7);
  const first = new Date(target + '-01T12:00:00Z');
  first.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  if (
    new Date(first.getTime() + 3 * 86400000).toISOString().slice(0, 7) !==
    target
  )
    first.setUTCDate(first.getUTCDate() + 7);
  const weeks: string[][] = [];
  while (
    new Date(first.getTime() + 3 * 86400000).toISOString().slice(0, 7) ===
    target
  ) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) =>
        new Date(first.getTime() + i * 86400000).toISOString().slice(0, 10),
      ),
    );
    first.setUTCDate(first.getUTCDate() + 7);
  }
  return weeks;
}
export function tasksOnDate(tasks: Task[], date: string) {
  return [
    ...new Map(
      tasks
        .filter((t) => t.date && t.date <= date && lastTaskDate(t) >= date)
        .map((t) => [t.id, t]),
    ).values(),
  ];
}
export function shiftCalendarYear(date: string, delta: number) {
  const year = Math.max(1, Math.min(9999, Number(date.slice(0, 4)) + delta));
  const month = date.slice(5, 7),
    d = Number(date.slice(8));
  const first = `${String(year).padStart(4, '0')}-${month}-01`;
  const end = new Date(first + 'T12:00:00Z');
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return `${first.slice(0, 8)}${String(Math.min(d, end.getUTCDate())).padStart(2, '0')}`;
}
