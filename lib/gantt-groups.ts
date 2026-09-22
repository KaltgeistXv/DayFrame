import type { Task, Project } from './model';
// Preserve the chosen task order within each project; unassigned tasks remain separate.
export function ganttGroups(tasks: Task[], projects: Project[]) {
  const known = new Set(projects.map((p) => p.id));
  const buckets = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = known.has(task.project) ? task.project : '';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(task);
  }
  return [
    ...projects.map((project) => ({
      id: project.id,
      project,
      tasks: buckets.get(project.id) || [],
    })),
    { id: '', project: undefined, tasks: buckets.get('') || [] },
  ].filter((g) => g.tasks.length);
}
