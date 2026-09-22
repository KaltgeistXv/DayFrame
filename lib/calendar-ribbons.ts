import type { Task } from './model';
import { lastTaskDate } from './task-scheduling';
// Calendar projections remain one visual lane per logical task.
export function calendarRibbons(
  entries: Task[],
  first: string,
  last: string,
  includeTimed = false,
) {
  const groups = new Map<string, Task[]>();
  for (const task of entries) {
    if ((!includeTimed && task.time) || !task.date) continue;
    groups.set(task.id, [...(groups.get(task.id) || []), task]);
  }
  return [...groups.values()]
    .map((parts) => {
      const current =
        parts.find((t) => !t.calendarOriginal && !t.calendarHistory) ||
        parts.at(-1)!;
      const plan = parts.find((t) => t.calendarOriginal) || current;
      const start = parts.map((t) => t.date).sort()[0];
      const end = parts.map(lastTaskDate).sort().at(-1)!;
      const lo = Math.max(
        0,
        (Date.parse(start) - Date.parse(first)) / 86400000,
      );
      const hi = Math.min(
        (Date.parse(last) - Date.parse(first)) / 86400000,
        (Date.parse(end) - Date.parse(first)) / 86400000,
      );
      const originalEnd = plan.calendarOriginal
        ? lastTaskDate(plan)
        : current.calendarHistory
          ? ''
          : end;
      const plannedCells = originalEnd
        ? Math.max(
            0,
            Math.min(
              hi - lo + 1,
              (Date.parse(originalEnd) - Date.parse(first)) / 86400000 - lo + 1,
            ),
          )
        : 0;
      return {
        current,
        plan,
        start,
        end,
        lo,
        hi,
        split: (plannedCells / (hi - lo + 1)) * 100,
        historyOnly: parts.every((t) => !!t.calendarHistory),
      };
    })
    .filter((r) => r.hi >= r.lo)
    .sort(
      (a, b) =>
        Date.parse(b.end) -
          Date.parse(b.start) -
          (Date.parse(a.end) - Date.parse(a.start)) ||
        a.current.project.localeCompare(b.current.project) ||
        (a.current.position || 0) - (b.current.position || 0) ||
        a.start.localeCompare(b.start) ||
        a.current.id.localeCompare(b.current.id),
    );
}

// Pack chronologically so a later task reuses the first free row. Tasks that
// begin together keep the longer range above the shorter one.
export function calendarLanes(
  entries: Task[],
  first: string,
  last: string,
  includeTimed = false,
) {
  const occupied: { lo: number; hi: number }[][] = [];
  return calendarRibbons(entries, first, last, includeTimed)
    .sort(
      (a, b) =>
        a.lo - b.lo ||
        b.hi - b.lo - (a.hi - a.lo) ||
        a.current.project.localeCompare(b.current.project) ||
        (a.current.position || 0) - (b.current.position || 0) ||
        a.current.id.localeCompare(b.current.id),
    )
    .map((r) => {
      let lane = occupied.findIndex((ranges) =>
        ranges.every((other) => r.hi < other.lo || r.lo > other.hi),
      );
      if (lane < 0) {
        lane = occupied.length;
        occupied.push([]);
      }
      occupied[lane].push(r);
      return { ...r, lane };
    });
}

// Reuse lanes only when date ranges do not overlap; a task never changes lanes within a week.
export function monthRibbons(
  entries: Task[],
  first: string,
  last: string,
  capacity: number | { height: number } = 3,
) {
  const ribbons = calendarLanes(entries, first, last, true);
  const laneCount = ribbons.reduce(
    (count, r) => Math.max(count, r.lane + 1),
    0,
  );
  // Reserve the footer only when there really are hidden tasks.
  const full =
    typeof capacity === 'number'
      ? capacity
      : Math.max(0, Math.floor((capacity.height - 30) / 22));
  const limit =
    typeof capacity === 'number' || laneCount <= full
      ? full
      : Math.max(0, Math.floor((capacity.height - 50) / 22));
  return {
    visible: ribbons.filter((r) => r.lane < limit),
    hidden: Array.from(
      { length: 7 },
      (_, day) =>
        ribbons.filter((r) => r.lane >= limit && r.lo <= day && r.hi >= day)
          .length,
    ),
  };
}
