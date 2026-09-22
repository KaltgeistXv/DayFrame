'use client';
import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type Dispatch,
  type SetStateAction,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { shift, type Task } from '@/lib/model';
import { isCompletionDrag, completeByDrag, originalPlan } from '@/lib/progress';
import { unplan, withoutTime } from '@/lib/task-scheduling';
import {
  HOUR_HEIGHT,
  STEP,
  clamp,
  clock,
  resized,
  rangeAcross,
  dragDelta,
  shiftedTask,
  intersects,
} from '@/lib/planner-interactions';
type Point = { x: number; y: number; date: string; minute: number };
type Gesture = {
  kind: 'create' | 'move' | 'start' | 'end' | 'select';
  origin: Point;
  point: Point;
  clientX: number;
  clientY: number;
  active: boolean;
  task?: Task;
  ids: string[];
  base: string[];
  additive: boolean;
  preview: Task[];
  overTrash: boolean;
  valid: boolean;
  dropZone?: string;
};
type Props = {
  root: RefObject<HTMLDivElement | null>;
  scroll: RefObject<HTMLDivElement | null>;
  body: RefObject<HTMLDivElement | null>;
  trash: RefObject<HTMLDivElement | null>;
  tasks: Task[];
  busy: boolean;
  cellWidth: number;
  horizontal: RefObject<HTMLDivElement | null>;
  selectedIds: string[];
  scheduledSelected: string[];
  setSelection: Dispatch<SetStateAction<string[]>>;
  onNew: (date: string, time?: string, duration?: number) => void;
  onEdit: (task: Task, date?: string) => void;
  onMove: (task: Task, changes: Partial<Task>) => void;
  onBatch: (tasks: Task[]) => Promise<void>;
  onDelete: (ids: string[]) => void;
};
export function usePlannerGesture({
  root,
  scroll,
  body,
  trash,
  tasks,
  busy,
  cellWidth,
  horizontal,
  selectedIds,
  scheduledSelected,
  setSelection,
  onNew,
  onEdit,
  onMove,
  onBatch,
  onDelete,
}: Props) {
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [pendingPreview, setPendingPreview] = useState<Task[]>([]);
  const gestureRef = useRef<Gesture | null>(null),
    pointer = useRef<{ x: number; y: number } | null>(null),
    raf = useRef<number>(0),
    capture = useRef<number | null>(null);
  function commitGesture(g: Gesture | null) {
    gestureRef.current = g;
    setGesture(g);
  }
  function cancel() {
    cancelAnimationFrame(raf.current);
    pointer.current = null;
    commitGesture(null);
    if (
      capture.current !== null &&
      root.current?.hasPointerCapture(capture.current)
    )
      root.current.releasePointerCapture(capture.current);
    capture.current = null;
  }
  useEffect(() => {
    const stop = () => {
      cancelAnimationFrame(raf.current);
      gestureRef.current = null;
      setGesture(null);
      pointer.current = null;
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gestureRef.current) {
        e.preventDefault();
        e.stopPropagation();
        stop();
      }
    };
    window.addEventListener('keydown', escape, true);
    window.addEventListener('blur', stop);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('keydown', escape, true);
      window.removeEventListener('blur', stop);
    };
  }, []);
  function point(x: number, y: number): Point {
    const r = body.current!.getBoundingClientRect(),
      width = Number(body.current!.dataset.cell) || cellWidth;
    return {
      x: clamp(x - r.left, 48, r.width),
      y: clamp(y - r.top, 0, 24 * HOUR_HEIGHT),
      date: shift(
        body.current!.dataset.start!,
        clamp(
          Math.floor((x - r.left - 48) / width),
          0,
          Number(body.current!.dataset.count) - 1,
        ),
      ),
      minute: clamp(((y - r.top) / HOUR_HEIGHT) * 60, 0, 1440),
    };
  }
  function inGrid(x: number, y: number) {
    const r = scroll.current!.getBoundingClientRect(),
      b = body.current!.getBoundingClientRect(),
      clip = scroll.current!.parentElement!.getBoundingClientRect();
    return (
      x >= Math.max(b.left + 48, clip.left + 48) &&
      x <= Math.min(b.right, r.right, clip.right) &&
      y >=
        Math.max(
          b.top,
          r.top +
            (root.current?.querySelector<HTMLElement>('.weekhead')
              ?.offsetHeight || 56) +
            (root.current?.querySelector<HTMLElement>('.alldayrow')
              ?.offsetHeight || 0),
        ) &&
      y <= r.bottom
    );
  }
  function hitTrash(x: number, y: number) {
    const r = trash.current?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  function update(x: number, y: number) {
    const previous = gestureRef.current;
    if (!previous || !body.current) return;
    const g = { ...previous, point: point(x, y) };
    g.active = g.active || Math.hypot(x - g.clientX, y - g.clientY) > 4;
    g.overTrash = g.kind === 'move' && g.active && hitTrash(x, y);
    const hit = document.elementFromPoint(x, y);
    const zone = hit?.closest<HTMLElement>('[data-schedule-drop]');
    const allDayHit =
      hit?.closest('.alldayrow') &&
      x >= (horizontal.current?.getBoundingClientRect().left || 0) + 48;
    g.dropZone =
      g.kind === 'move'
        ? (zone?.dataset.scheduleDrop ?? (allDayHit ? g.point.date : undefined))
        : undefined;
    g.valid = inGrid(x, y) || g.dropZone !== undefined;
    if (g.active) {
      if (g.kind === 'move' && g.task) {
        const delta = dragDelta(
          g.origin.date,
          g.origin.minute,
          g.point.date,
          g.point.minute,
        );
        g.preview = tasks
          .filter((t) => g.ids.includes(t.id))
          .map((t) => (g.task?.calendarOriginal ? originalPlan(t) : t))
          .map((t) =>
            t.time
              ? shiftedTask(t, delta)
              : {
                  ...t,
                  date: shift(
                    t.date,
                    (Date.parse(g.point.date) - Date.parse(g.origin.date)) /
                      86400000,
                  ),
                },
          );
        if (g.dropZone !== undefined) {
          g.preview = tasks
            .filter((t) => g.ids.includes(t.id))
            .map((t) => (g.task?.calendarOriginal ? originalPlan(t) : t))
            .map((t) =>
              g.dropZone === 'unplanned'
                ? unplan(t)
                : withoutTime(t, g.origin.date, g.dropZone!),
            );
        }
      } else if ((g.kind === 'start' || g.kind === 'end') && g.task) {
        g.preview = [
          resized(
            g.task,
            g.kind,
            ((Date.parse(g.point.date) - Date.parse(g.task.date)) / 86400000) *
              1440 +
              g.point.minute,
          ),
        ];
      } else if (g.kind === 'select') {
        const rectangle = {
            left: Math.min(g.origin.x, g.point.x),
            right: Math.max(g.origin.x, g.point.x),
            top: Math.min(g.origin.y, g.point.y),
            bottom: Math.max(g.origin.y, g.point.y),
          },
          bounds = body.current.getBoundingClientRect();
        const found = Array.from(
          body.current.querySelectorAll<HTMLElement>('[data-event-id]'),
        )
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return intersects(rectangle, {
              left: r.left - bounds.left,
              right: r.right - bounds.left,
              top: r.top - bounds.top,
              bottom: r.bottom - bounds.top,
            });
          })
          .map((el) => el.dataset.eventId!);
        setSelection([...new Set([...g.base, ...found])]);
      }
    }
    commitGesture(g);
  }
  function startScroll() {
    const tick = () => {
      const p = pointer.current,
        g = gestureRef.current,
        el = scroll.current;
      if (!p || !g || !el) return;
      if (g.active && !g.overTrash && g.dropZone === undefined) {
        const r = el.getBoundingClientRect();
        const h = horizontal.current,
          hr = h?.getBoundingClientRect();
        if (
          h &&
          hr &&
          p.y >= hr.top &&
          p.y <= hr.bottom &&
          p.x >= hr.left &&
          p.x <= hr.right
        ) {
          const dx = p.x < hr.left + 48 + 28 ? -8 : p.x > hr.right - 28 ? 8 : 0;
          if (dx) {
            h.scrollLeft += dx;
            update(p.x, p.y);
          }
        }
        if (p.x >= r.left && p.x <= r.right) {
          const dy = p.y < r.top + 32 ? -8 : p.y > r.bottom - 32 ? 8 : 0;
          if (dy) {
            el.scrollTop += dy;
            update(p.x, p.y);
          }
        }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }
  function begin(e: ReactPointerEvent, kind: Gesture['kind'], t?: Task) {
    if (
      busy ||
      e.button !== 0 ||
      !body.current ||
      (e.pointerType === 'touch' && kind === 'create')
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    cancel();
    const p = point(e.clientX, e.clientY),
      additive = e.metaKey || e.ctrlKey || e.shiftKey;
    const ids = t
      ? selectedIds.includes(t.id)
        ? scheduledSelected
        : [t.id]
      : [];
    const g: Gesture = {
      kind,
      origin: p,
      point: p,
      clientX: e.clientX,
      clientY: e.clientY,
      active: false,
      task: t,
      ids,
      base: additive ? selectedIds : [],
      additive,
      preview: [],
      overTrash: false,
      valid: true,
    };
    root.current?.focus({ preventScroll: true });
    root.current?.setPointerCapture(e.pointerId);
    capture.current = e.pointerId;
    pointer.current = { x: e.clientX, y: e.clientY };
    commitGesture(g);
    startScroll();
  }
  async function finish(e: ReactPointerEvent) {
    const original = gestureRef.current;
    if (!original) return;
    update(e.clientX, e.clientY);
    const g = gestureRef.current!;
    cancel();
    if (g.kind === 'select') {
      if (!g.active && !g.additive) setSelection([]);
      return;
    }
    if (g.kind === 'create') {
      if (!g.valid) return;
      const range = g.active
        ? rangeAcross(
            g.origin.date,
            g.origin.minute,
            g.point.date,
            g.point.minute,
          )
        : {
            start: clamp(Math.floor(g.origin.minute / STEP) * STEP, 0, 1425),
            duration: Math.min(
              60,
              1440 - Math.floor(g.origin.minute / STEP) * STEP,
            ),
          };
      onNew(
        'date' in range ? String(range.date) : g.origin.date,
        clock(range.start),
        range.duration,
      );
      return;
    }
    if (!g.task) return;
    if (!g.active) {
      if (g.kind === 'move') {
        if (g.additive)
          setSelection((prev) =>
            prev.includes(g.task!.id)
              ? prev.filter((id) => id !== g.task!.id)
              : [...prev, g.task!.id],
          );
        else onEdit(g.task, g.origin.date);
      }
      return;
    }
    if (g.overTrash) {
      onDelete(g.ids);
      return;
    }
    if (
      g.valid &&
      g.ids.length === 1 &&
      g.dropZone !== 'unplanned' &&
      isCompletionDrag(
        tasks.find((t) => t.id === g.task!.id)!,
        g.origin.date,
      ) &&
      !g.task.calendarOriginal &&
      g.kind !== 'start'
    ) {
      const target = g.dropZone || g.point.date;
      if (target !== g.origin.date)
        onMove(
          g.task,
          completeByDrag(
            tasks.find((t) => t.id === g.task!.id)!,
            target,
          ),
        );
      return;
    }
    if (
      g.valid &&
      g.preview.some((t) => {
        const old = tasks.find((x) => x.id === t.id);
        return (
          old &&
          (old.date !== t.date ||
            old.time !== t.time ||
            old.duration !== t.duration)
        );
      })
    ) {
      try {
        setPendingPreview(g.preview);
        await onBatch(g.preview);
      } catch {
        /* Parent displays the save error. */
      } finally {
        setPendingPreview([]);
      }
    }
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (gestureRef.current) {
      pointer.current = { x: e.clientX, y: e.clientY };
      update(e.clientX, e.clientY);
    }
  }
  function onLostPointerCapture() {
    if (gestureRef.current) cancel();
  }
  return {
    gesture,
    pendingPreview,
    point,
    begin,
    finish,
    cancel,
    onPointerMove,
    onLostPointerCapture,
  };
}
