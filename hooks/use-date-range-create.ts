'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
export function useDateRangeCreate(
  onCreate: (start: string, duration: number) => void,
  busy: boolean,
) {
  const [range, setRange] = useState<{ start: string; end: string } | null>(
      null,
    ),
    drag = useRef<{
      start: string;
      end: string;
      x: number;
      y: number;
      active: boolean;
      root: HTMLElement;
      id: number;
    } | null>(null);
  const frame = useRef(0);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  function cancel() {
    cancelAnimationFrame(frame.current);
    pointer.current = null;
    const g = drag.current;
    drag.current = null;
    setRange(null);
    if (g?.root.hasPointerCapture(g.id)) g.root.releasePointerCapture(g.id);
  }
  useEffect(() => {
    const stop = () => cancel(),
      key = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && drag.current) {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }
      };
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', stop);
    return () => {
      cancelAnimationFrame(frame.current);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', stop);
    };
  }, []);
  function updateAt(x: number, y: number) {
    const g = drag.current;
    if (!g) return;
    const hit = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>('[data-range-date]');
    if (!hit || !g.root.contains(hit)) return;
    g.end = hit.dataset.rangeDate!;
    g.active ||= Math.hypot(x - g.x, y - g.y) > 5;
    const start = g.start < g.end ? g.start : g.end,
      end = g.start > g.end ? g.start : g.end;
    const cap = new Date(Date.parse(start) + 3659 * 86400000)
      .toISOString()
      .slice(0, 10);
    if (g.active) setRange({ start, end: end > cap ? cap : end });
  }
  function move(e: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    e.stopPropagation();
    pointer.current = { x: e.clientX, y: e.clientY };
    updateAt(e.clientX, e.clientY);
  }
  function autoScroll() {
    const pt = pointer.current,
      g = drag.current;
    if (!pt || !g) return;
    const viewport = g.root.closest<HTMLElement>('[data-edge-scroll]');
    if (viewport) {
      const r = viewport.getBoundingClientRect(),
        gutter = Number(viewport.dataset.edgeScroll || 0);
      if (
        pt.y >= r.top &&
        pt.y <= r.bottom &&
        pt.x >= r.left + gutter &&
        pt.x <= r.right
      ) {
        viewport.scrollLeft +=
          pt.x < r.left + gutter + 32 ? -8 : pt.x > r.right - 32 ? 8 : 0;
        updateAt(pt.x, pt.y);
      }
    }
    frame.current = requestAnimationFrame(autoScroll);
  }
  return {
    range,
    bind: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (
          busy ||
          e.button !== 0 ||
          (e.target as HTMLElement).closest('button')
        )
          return;
        const cell = (e.target as HTMLElement).closest<HTMLElement>(
          '[data-range-date]',
        );
        if (!cell) return;
        e.preventDefault();
        e.stopPropagation();
        const date = cell.dataset.rangeDate!;
        drag.current = {
          start: date,
          end: date,
          x: e.clientX,
          y: e.clientY,
          active: false,
          root: e.currentTarget,
          id: e.pointerId,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        pointer.current = { x: e.clientX, y: e.clientY };
        frame.current = requestAnimationFrame(autoScroll);
      },
      onPointerMove: move,
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        if (!drag.current) return;
        move(e);
        const g = drag.current;
        const hit = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest('[data-range-date]');
        const valid = hit && g.root.contains(hit);
        cancel();
        if (g.active && valid) {
          const start = g.start < g.end ? g.start : g.end;
          onCreate(
            start,
            Math.min(
              5270400,
              (Math.abs(Date.parse(g.end) - Date.parse(g.start)) / 86400000 +
                1) *
                1440,
            ),
          );
        }
      },
      onPointerCancel: cancel,
      onLostPointerCapture: () => {
        if (drag.current) cancel();
      },
    },
  };
}
