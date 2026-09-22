import type { Project } from './model';

/** A client ID links an inline draft to its task; it never implies persistence. */
export function createProjectDraft({
  folder = '',
  date = '',
  end = '',
  id = crypto.randomUUID(),
}: {
  folder?: string;
  date?: string;
  end?: string;
  id?: string;
} = {}): Project {
  return {
    id,
    title: '',
    description: '',
    color: '0',
    folder,
    tags: [],
    scheduleMode: date ? 'manual' : 'auto',
    start: date,
    end: date ? end || date : '',
  };
}

export function isSavedProject(
  project: Pick<Project, 'id'> | null,
  projects: readonly Pick<Project, 'id'>[],
): boolean {
  return !!project?.id && projects.some((saved) => saved.id === project.id);
}
