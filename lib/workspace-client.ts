import { defaultPreferences } from './model';
import type { WorkspaceData } from './backup';
import { uiCopy } from './ui-copy';

export type WorkspaceResponse = WorkspaceData & { undoBefore?: WorkspaceData };

/** API metadata never becomes part of the persisted or undo snapshot. */
export function workspaceSnapshot(data: WorkspaceResponse): WorkspaceData {
  return {
    tasks: data.tasks,
    projects: data.projects,
    folders: data.folders || [],
    labels: data.labels || [],
    preferences: data.preferences || defaultPreferences,
  };
}

/** All workspace reads and writes share response and server-error handling. */
export async function requestWorkspace(
  payload?: object,
): Promise<WorkspaceResponse> {
  const response = await fetch(
    '/api/workspace',
    payload === undefined
      ? undefined
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
  );
  const data = (await response.json()) as WorkspaceResponse & {
    error?: string;
  };
  if (!response.ok) throw Error(data.error || uiCopy.requestFailed);
  return data;
}
