'use client';
import { bindCalendarSnap } from '@/lib/calendar-snap-motion';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { monthShift, snappedTimelineScroll } from '@/lib/timeline-window';
import { monthVisibleWeekCount } from '@/lib/calendar-views';

type PendingPosition = { month: string; offset: number } | null;
const monthId = (date: string) => monthShift(date, 0);
const pageTop = (node: HTMLElement, page: HTMLElement) =>
  node.scrollTop +
  page.getBoundingClientRect().top -
  node.getBoundingClientRect().top -
  node.clientTop;

export function useContinuousMonths(
  anchor: string,
  change: (date: string) => void,
) {
  const element = useRef<HTMLDivElement | null>(null);
  const [nodeVersion, setNodeVersion] = useState(0);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (element.current === node) return;
    element.current = node;
    setNodeVersion((version) => version + 1);
  }, []);
  const [center, setCenter] = useState(() => monthId(anchor));
  const [weekCount, setWeekCount] = useState(() =>
    monthVisibleWeekCount(anchor),
  );
  const [rowHeight, setRowHeight] = useState(0);
  const pending = useRef<PendingPosition>({
    month: monthId(anchor),
    offset: 0,
  });
  const positioning = useRef(false);
  const positionFrame = useRef(0);
  const dragging = useRef(false);
  const anchorMonth = useRef(anchor.slice(0, 7));
  const months = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => monthShift(center, index - 3)),
    [center],
  );

  const position = useCallback((month: string, offset = 0) => {
    const node = element.current;
    if (!node) return false;
    const page = node
      .querySelector<HTMLElement>(`[data-range-date="${month}"]`)
      ?.closest<HTMLElement>('.month-ribbon-week');
    if (!page) return false;
    const top = pageTop(node, page) + offset;
    positioning.current = true;
    cancelAnimationFrame(positionFrame.current);
    node.style.scrollSnapType = 'none';
    node.scrollTop = top;
    positionFrame.current = requestAnimationFrame(() => {
      node.scrollTop = top;
      node.style.removeProperty('scroll-snap-type');
      positioning.current = false;
    });
    return true;
  }, []);

  const jump = useCallback(
    (date: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const month = monthId(date);
      const rows = monthVisibleWeekCount(date);
      setWeekCount(rows);
      pending.current = { month, offset: 0 };
      if (rows === weekCount && month === center && position(month))
        pending.current = null;
      else setCenter(month);
      change(date);
    },
    [center, change, position, weekCount],
  );

  useEffect(() => {
    const focus = (event: Event) =>
      jump((event as CustomEvent<{ date: string }>).detail.date);
    window.addEventListener('patmi-focus-date', focus);
    return () => window.removeEventListener('patmi-focus-date', focus);
  }, [jump]);

  useLayoutEffect(() => {
    if (!pending.current) return;
    const { month, offset } = pending.current;
    if (position(month, offset)) pending.current = null;
  }, [nodeVersion, center, position, weekCount]);

  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const measure = () => setRowHeight(node.clientHeight / weekCount);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [nodeVersion, weekCount]);

  useEffect(() => {
    const node = element.current;
    if (!node || rowHeight <= 0) return;
    return bindCalendarSnap(node, 'scrollTop',
      () => Math.min(Math.max(0, node.scrollHeight - node.clientHeight), snappedTimelineScroll(node.scrollTop, rowHeight, 1)),
      () => !dragging.current && !positioning.current && node.clientHeight > 0,
    );
  }, [nodeVersion, rowHeight]);

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    let frame = 0;
    const pages = () =>
      Array.from(node.querySelectorAll<HTMLElement>('.month-page[data-month]'));
    const activePage = () => {
      const list = pages();
      let active = list[0];
      for (const page of list) {
        if (pageTop(node, page) <= node.scrollTop + 2) active = page;
        else break;
      }
      return { list, active };
    };
    const sync = () => {
      if (positioning.current) return;
      const { list, active } = activePage();
      if (!active) return;
      const firstWeek = Array.from(
        node.querySelectorAll<HTMLElement>('[data-week-start]'),
      ).find(
        (week) => pageTop(node, week) + week.offsetHeight > node.scrollTop + 2,
      );
      const id =
        firstWeek?.dataset.weekEnd?.slice(0, 7) || active.dataset.month!;
      if (id !== anchorMonth.current) {
        anchorMonth.current = id;
        change(id + '-01');
      }
      const index = list.indexOf(active);
      if (!dragging.current && (index < 2 || index > list.length - 3)) {
        pending.current = {
          month:
            active.querySelector<HTMLElement>('[data-week-start]')!.dataset
              .weekStart!,
          offset: node.scrollTop - pageTop(node, active),
        };
        setCenter(id + '-01');
      }
    };
    const scroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    const beginDrag = () => {
      dragging.current = true;
    };
    const endDrag = () => {
      if (!dragging.current) return;
      dragging.current = false;
      const { active } = activePage();
      if (!active) return;
      pending.current = {
        month:
          active.querySelector<HTMLElement>('[data-week-start]')!.dataset
            .weekStart!,
        offset: node.scrollTop - pageTop(node, active),
      };
      setCenter(active.dataset.month! + '-01');
    };
    node.addEventListener('scroll', scroll, { passive: true });
    document.addEventListener('dragstart', beginDrag);
    document.addEventListener('dragend', endDrag);
    document.addEventListener('drop', endDrag);
    window.addEventListener('blur', endDrag);
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener('scroll', scroll);
      document.removeEventListener('dragstart', beginDrag);
      document.removeEventListener('dragend', endDrag);
      document.removeEventListener('drop', endDrag);
      window.removeEventListener('blur', endDrag);
    };
  }, [nodeVersion, center, change]);

  useEffect(
    () => () => {
      cancelAnimationFrame(positionFrame.current);
    },
    [],
  );

  useEffect(() => {
    const requested = monthId(anchor);
    if (requested.slice(0, 7) === anchorMonth.current) return;
    anchorMonth.current = requested.slice(0, 7);
    const rows = monthVisibleWeekCount(requested);
    // This effect also positions the external scroll viewport after anchor changes.
    // oxlint-disable-next-line react/react-compiler
    setWeekCount(rows);
    pending.current = { month: requested, offset: 0 };
    if (
      rows === weekCount &&
      months.includes(requested) &&
      position(requested)
    ) {
      pending.current = null;
    } else {
      // Rebase the render window together with the external scroll position.
      // oxlint-disable-next-line react/react-compiler
      setCenter(requested);
    }
  }, [anchor, months, position, weekCount]);

  return {
    ref,
    jump,
    months,
    rowHeight,
    style: {
      '--month-visible-weeks': weekCount,
    } as CSSProperties,
  };
}
