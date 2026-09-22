'use client';
import { bindCalendarSnap } from '@/lib/calendar-snap-motion';
import {
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { flushSync } from 'react-dom';
import { shift } from '@/lib/model';
import {
  rebaseWindow,
  timelineWindowCount,
  compensatedScroll,
  snappedTimelineScroll,
  visibleTimelineColumn,
} from '@/lib/timeline-window';

export function useContinuousDays(
  today: string,
  cell = 60,
  initialCount = 63,
  step = 21,
  gutter = 220,
  pageDays = 0,
) {
  const [count, setCount] = useState(initialCount);
  const nativeDragging = useRef(false);
  const [start, setStart] = useState(shift(today, -step));
  const [visible, setVisible] = useState(today);
  const element = useRef<HTMLDivElement | null>(null);
  const [nodeVersion, setNodeVersion] = useState(0);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (element.current === node) return;
    element.current = node;
    setNodeVersion((version) => version + 1);
  }, []);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const resize = () =>
      setCount((current) =>
        Math.max(
          current,
          timelineWindowCount(
            node.clientWidth,
            cell,
            initialCount,
            step,
            gutter,
          ),
        ),
      );
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [nodeVersion, cell, initialCount, step, gutter]);
  const initialized = useRef<HTMLDivElement | null>(null);
  const measuredCell = useRef(cell);
  const pending = useRef<number | null>(step * cell);
  const live = useRef(start);
  useLayoutEffect(() => {
    live.current = start;
  }, [start]);
  const jump = useCallback(
    (date: string) => {
      const node = element.current;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      pending.current = step * cell;
      setStart(shift(date, -step));
      setVisible(date);
      // Also handle clicking Today while already in the same render window.
      if (live.current === shift(date, -step) && node) {
        node.scrollLeft = step * cell;
        pending.current = null;
      }
    },
    [cell, step],
  );
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    if (
      count <
      timelineWindowCount(node.clientWidth, cell, initialCount, step, gutter)
    )
      return;
    if (initialized.current !== node || measuredCell.current !== cell) {
      measuredCell.current = cell;
      initialized.current = node;
      pending.current =
        ((Date.parse(visible) - Date.parse(start)) / 86400000) * cell;
    }
    if (pending.current !== null) {
      node.scrollLeft = pending.current;
      pending.current = null;
    }
    function scroll() {
      if (!node || node.clientWidth === 0) return;
      if (
        count <
        timelineWindowCount(node.clientWidth, cell, initialCount, step, gutter)
      )
        return;
      const left = node.scrollLeft;
      setVisible(
        shift(
          live.current,
          visibleTimelineColumn(left, cell, window.devicePixelRatio),
        ),
      );
      const delta = rebaseWindow(
        left,
        node.clientWidth,
        cell,
        count,
        step,
        gutter,
      );
      if (!delta) return;
      // Keep the native HTML drag source mounted until drop; normal scrolling
      // uses the fixed-size window, dragging temporarily extends it.
      if (nativeDragging.current) {
        pending.current =
          delta < 0 ? compensatedScroll(left, delta, cell) : left;
        flushSync(() => {
          setCount((n) => n + Math.abs(delta));
          if (delta < 0) setStart(shift(live.current, delta));
        });
      } else {
        pending.current = compensatedScroll(left, delta, cell);
        flushSync(() => setStart(shift(live.current, delta)));
      }
    }
    const wheel = (event: WheelEvent) => {
      if (event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        node.scrollLeft += event.deltaY;
      }
    };
    node.addEventListener('scroll', scroll, { passive: true });
    node.addEventListener('wheel', wheel, { passive: false });
    return () => {
      node.removeEventListener('scroll', scroll);
      node.removeEventListener('wheel', wheel);
    };
  }, [nodeVersion, start, visible, cell, count, step, gutter, initialCount]);
  useEffect(() => {
    const node = element.current;
    if (!node || pageDays <= 0) return;
    return bindCalendarSnap(node, 'scrollLeft',
      () => Math.min(Math.max(0, node.scrollWidth - node.clientWidth), snappedTimelineScroll(node.scrollLeft, cell, pageDays)),
      () => !nativeDragging.current && node.clientWidth > 0,
    );
  }, [nodeVersion, cell, pageDays]);
  useEffect(() => {
    const begin = () => {
      nativeDragging.current = true;
    };
    const end = () => {
      if (!nativeDragging.current) return;
      nativeDragging.current = false;
      const targetCount = timelineWindowCount(
        element.current?.clientWidth ?? 0,
        cell,
        initialCount,
        step,
        gutter,
      );
      if (count !== targetCount) {
        setCount(targetCount);
        jump(visible);
      }
    };
    document.addEventListener('dragstart', begin);
    document.addEventListener('dragend', end);
    document.addEventListener('drop', end);
    window.addEventListener('blur', end);
    return () => {
      document.removeEventListener('dragstart', begin);
      document.removeEventListener('dragend', end);
      document.removeEventListener('drop', end);
      window.removeEventListener('blur', end);
    };
  }, [count, initialCount, visible, jump, cell, step, gutter]);
  useEffect(() => {
    const focus = (e: Event) =>
      jump((e as CustomEvent<{ date: string }>).detail.date);
    window.addEventListener('patmi-focus-date', focus);
    return () => window.removeEventListener('patmi-focus-date', focus);
  }, [jump]);
  const dates = useMemo(
    () => Array.from({ length: count }, (_, i) => shift(start, i)),
    [count, start],
  );
  return {
    start,
    visible,
    ref,
    jump,
    move: (days: number) => jump(shift(visible, days)),
    dates,
    style: {
      '--timeline-days': count,
      '--timeline-cell': `${cell}px`,
      '--timeline-width': `${gutter + count * cell}px`,
    } as CSSProperties,
  };
}
