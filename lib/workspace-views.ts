export function sectionViews(section: string): string[] {
  if (section === 'today') return ['list'];
  if (section === 'inbox') return ['list', 'board', 'calendar', 'heatmap'];
  if (section === 'schedule') return ['calendar'];
  if (section === 'all')
    return ['list', 'board', 'calendar', 'timeline', 'heatmap'];
  if (section === 'tracking') return ['timeline', 'list', 'board'];
  if (section === 'projects') return [];
  return ['list', 'board', 'calendar', 'timeline', 'heatmap'];
}
export function sectionContains(
  section: string,
  task: { date: string; project: string },
  occursToday: boolean,
) {
  if (section === 'today') return occursToday;
  if (section === 'inbox') return !task.date;
  if (
    ['all', 'tracking', 'schedule', 'projects'].includes(section) ||
    section.startsWith('label:')
  )
    return true;
  return task.project === section;
}
