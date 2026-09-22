import type { Project } from './model';
export type GanttAction = 'move' | 'start' | 'end' | 'range';
const addDays = (date: string, delta: number) =>
  new Date(Date.parse(date + 'T00:00:00Z') + delta * 86400000)
    .toISOString()
    .slice(0, 10);
export function changeProjectRange(
  p: Project,
  action: GanttAction,
  origin: string,
  target: string,
): Project {
  const start = p.start || origin,
    end = p.end || start;
  if (action === 'range')
    return {
      ...p,
      start: origin < target ? origin : target,
      end: origin > target ? origin : target,
    };
  if (action === 'start')
    return { ...p, start: target > end ? end : target, end };
  if (action === 'end')
    return { ...p, start, end: target < start ? start : target };
  const delta = (Date.parse(target) - Date.parse(origin)) / 86400000;
  return { ...p, start: addDays(start, delta), end: addDays(end, delta) };
}
export const rangeDays = (start: string, end: string) =>
  Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;

// Convert a canvas coordinate to a day using the current zoom level.
export function ganttDayIndex(
  x: number,
  left: number,
  gutter: number,
  cell: number,
  count: number,
) {
  return Math.min(
    count - 1,
    Math.max(0, Math.floor((x - left - gutter) / cell)),
  );
}
