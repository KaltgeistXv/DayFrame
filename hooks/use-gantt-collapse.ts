'use client';
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';

export function useGanttCollapse(disabled = false, initial: string[] = []) {
  const [collapsed, updateState] = useState<string[]>(initial);
  const current = useRef(collapsed);
  const mounted = useRef(true);
  const restores = useRef<(() => void)[]>([]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.dispatchEvent(new CustomEvent('dayframe:forget-undo', { detail: restores.current }));
      restores.current = [];
    };
  }, []);
  const setCollapsed = useCallback((update: SetStateAction<string[]>) => {
    if (disabled) return;
    const previous = current.current;
    const value = typeof update === 'function' ? update(previous) : update;
    if (value.length === previous.length && value.every((id) => previous.includes(id))) return;
    current.current = value;
    updateState(value);
    const restore = () => {
      if (!mounted.current) return;
      current.current = previous;
      updateState(previous);
    };
    restores.current = [...restores.current.slice(-19), restore];
    const reapply = () => {
      if (!mounted.current) return;
      current.current = value;
      updateState(value);
    };
    window.dispatchEvent(new CustomEvent('dayframe:undoable', { detail: { restore, reapply } }));
  }, [disabled]);
  return [collapsed, setCollapsed] as const;
}
