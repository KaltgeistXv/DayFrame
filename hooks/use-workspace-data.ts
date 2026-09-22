'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { uiCopy } from '@/lib/ui-copy';
import { makeBackup, type WorkspaceData } from '@/lib/backup';
import { defaultPreferences, type Preferences } from '@/lib/model';
import { requestWorkspace, workspaceSnapshot } from '@/lib/workspace-client';

type UndoEntry =
  | { before: WorkspaceData; after: WorkspaceData }
  | { restore: () => void; reapply: () => void };

/** Own persisted snapshots, request ordering, mutation locking and undo history.
 * View selection and date navigation belong to the workspace, not this hook.
 */
export function useWorkspaceData(
  onFirstLoad: (preferences: Preferences) => void,
) {
  const [data, setData] = useState<WorkspaceData>(() => ({
    tasks: [],
    projects: [],
    folders: [],
    labels: [],
    preferences: defaultPreferences,
  }));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [undo, setUndo] = useState(false);
  const initialSpace = useRef(false);
  const pending = useRef(false);
  const history = useRef<UndoEntry[]>([]);
  const redoHistory = useRef<UndoEntry[]>([]);
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const d = await requestWorkspace();
      if (version !== requestVersion.current) return;
      setError('');
      setData(workspaceSnapshot(d));
      if (!initialSpace.current) {
        onFirstLoad(d.preferences || defaultPreferences);
        initialSpace.current = true;
      }
      setReady(true);
      history.current = [];
      redoHistory.current = [];
      setUndo(false);
    } catch (e) {
      if (version !== requestVersion.current) return;
      setError(e instanceof Error ? e.message : uiCopy.loadFailed);
    }
  }, [onFirstLoad]);
  const mutate = useCallback(
    async (payload: unknown, message?: string, record = true) => {
      if (pending.current) throw Error(uiCopy.savePending);
      pending.current = true;
      ++requestVersion.current;
      setBusy(true);
      try {
        const d = await requestWorkspace({
          ...(payload as object),
          captureUndo: record,
        });
        setData(workspaceSnapshot(d));
        if (record && d.undoBefore) {
          redoHistory.current = [];
          const after = workspaceSnapshot(d);
          history.current = [
            ...history.current.slice(-19),
            { before: d.undoBefore, after },
          ];
          setUndo(true);
        }
        const action = payload as { action?: string; kind?: string };
        setNotice(
          message ||
            (action.action === 'moveItem'
              ? `${action.kind === 'projects' ? '项目' : '任务'}顺序已更新`
              : uiCopy.workspaceSaved),
        );
        setError('');
        return d;
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [],
  );
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(''), 2000);
      return () => clearTimeout(id);
    }
  }, [notice]);
  const undoLast = useCallback(async () => {
    const entry = history.current.at(-1);
    if (!entry || pending.current) return;
    try {
      if ('restore' in entry) {
        entry.restore();
        setNotice(uiCopy.undoCompleted);
      } else {
        await mutate(
          {
            action: 'restoreWorkspace',
            backup: makeBackup(entry.before),
            expected: makeBackup(entry.after),
          },
          uiCopy.undoCompleted,
          false,
        );
      }
      history.current.pop();
      redoHistory.current.push(entry);
      setUndo(history.current.length > 0);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [mutate]);
  const redoLast = useCallback(async () => {
    const entry = redoHistory.current.at(-1);
    if (!entry || pending.current) return;
    try {
      if ('restore' in entry) {
        entry.reapply();
        setNotice(uiCopy.redoCompleted);
      } else {
        await mutate(
          {
            action: 'restoreWorkspace',
            backup: makeBackup(entry.after),
            expected: makeBackup(entry.before),
          },
          uiCopy.redoCompleted,
          false,
        );
      }
      redoHistory.current.pop();
      history.current.push(entry);
      setUndo(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [mutate]);
  useEffect(() => {
    const register = (event: Event) => {
      const entry = (
        event as CustomEvent<{ restore: () => void; reapply: () => void }>
      ).detail;
      redoHistory.current = [];
      history.current = [...history.current.slice(-19), entry];
      setUndo(true);
    };
    const forget = (event: Event) => {
      const restores = (event as CustomEvent<(() => void)[]>).detail;
      history.current = history.current.filter(
        (entry) => !('restore' in entry) || !restores.includes(entry.restore),
      );
      redoHistory.current = redoHistory.current.filter(
        (entry) => !('restore' in entry) || !restores.includes(entry.restore),
      );
      setUndo(history.current.length > 0);
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        pending.current ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.key.toLowerCase() !== 'z' ||
        !(event.shiftKey
          ? redoHistory.current.length
          : history.current.length) ||
        document.querySelector(
          '[role=dialog],[role=alertdialog],[role=menu],[role=listbox]',
        ) ||
        (event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            event.target.closest('input,textarea,[role=combobox]')))
      )
        return;
      event.preventDefault();
      void (event.shiftKey ? redoLast() : undoLast());
    };
    window.addEventListener('dayframe:undoable', register);
    window.addEventListener('dayframe:forget-undo', forget);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('dayframe:undoable', register);
      window.removeEventListener('dayframe:forget-undo', forget);
      window.removeEventListener('keydown', key);
    };
  }, [undoLast, redoLast]);
  return {
    ...data,
    ready,
    error,
    setError,
    busy,
    notice,
    setNotice,
    undo,
    undoLast,
    load,
    mutate,
    pending,
  };
}
