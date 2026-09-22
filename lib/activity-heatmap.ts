import type { Task, Project } from './model';

function validDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const time = Date.parse(date + 'T12:00:00Z');
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date
  );
}

// Count actual activity, never the date of a calendar projection or plan.
export function activityByDay(tasks: Task[], today: string) {
  const days = new Map<string, Map<string, Task>>();
  for (const task of tasks) {
    const dates = new Set((task.checkins || []).map((entry) => entry.date));
    if (task.status === 'done' && task.completedOn) dates.add(task.completedOn);
    for (const date of dates) {
      if (!validDay(date) || date > today) continue;
      if (!days.has(date)) days.set(date, new Map());
      days.get(date)!.set(task.id, task);
    }
  }
  return new Map(
    [...days].map(([date, entries]) => [date, [...entries.values()]]),
  );
}

export function heatmapLevel(count: number) {
  return count <= 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
}

export function heatmapYear(year: number) {
  const start = new Date(`${String(year).padStart(4, '0')}-01-01T12:00:00Z`);
  const offset = (start.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array(offset).fill(null);
  while (start.getUTCFullYear() === year) {
    cells.push(start.toISOString().slice(0, 10));
    start.setUTCDate(start.getUTCDate() + 1);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function trackedActivityGroups(tasks: Task[], projects: Project[]) {
  const groups = new Map<
    string,
    { id: string; title: string; tasks: Task[] }
  >();
  const known = new Map(projects.map((project) => [project.id, project]));
  for (const task of tasks) {
    if (!task.tracking) continue;
    const project = known.get(task.project);
    const id = project?.id || '';
    if (!groups.has(id))
      groups.set(id, {
        id,
        title: project?.title || '独立追踪任务',
        tasks: [],
      });
    groups.get(id)!.tasks.push(task);
  }
  return [...groups.values()];
}

// Scope only changes which existing tasks are visualized, not activity counting.
export function heatmapGroups(
  tasks: Task[],
  projects: Project[],
  scope: { projectId?: string; groupByProject?: boolean } = {},
) {
  const scoped = scope.projectId
    ? tasks.filter((task) => task.project === scope.projectId)
    : tasks;
  if (scope.groupByProject && !scope.projectId) {
    const groups = projects.map((project) => ({
      id: project.id,
      title: project.title,
      tasks: scoped.filter((task) => task.project === project.id),
    }));
    const unassigned = scoped.filter((task) => !task.project);
    if (unassigned.length)
      groups.push({
        id: 'no-project',
        title: '无项目',
        tasks: unassigned,
      });
    return groups;
  }
  return [
    {
      id: scope.projectId || 'overview',
      title: scope.projectId ? '项目总览' : '全部任务',
      tasks: scoped,
    },
  ];
}
