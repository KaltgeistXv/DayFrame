import { makeBackup, validateBackup, type WorkspaceData } from './backup';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => JSON.stringify(key) + ':' + canonical(item)).join(',') + '}';
  return JSON.stringify(value);
}
export function sameWorkspace(a: WorkspaceData, b: WorkspaceData) {
  return canonical(validateBackup(makeBackup(a)).data) ===
    canonical(validateBackup(makeBackup(b)).data);
}
