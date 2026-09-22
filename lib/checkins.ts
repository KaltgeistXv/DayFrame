import type { Task } from './model';

export function checkInStats(tasks: Task[], today: string) {
  const entries = tasks
    .flatMap((t) => t.checkins || [])
    .filter((c) => c.date <= today);
  const dates = [...new Set(entries.map((c) => c.date))].sort();
  const latest = dates.at(-1) || '';
  return {
    days: dates.length,
    minutes: entries.reduce((sum, c) => sum + c.minutes, 0),
    today: dates.includes(today),
    latest,
    gap: latest
      ? Math.round((Date.parse(today) - Date.parse(latest)) / 86400000)
      : null,
  };
}
