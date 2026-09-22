'use client';
import { useEffect } from 'react';
import { edgeScrollDelta } from '@/lib/timeline-window';
// Native drags keep scrolling even when the pointer is held still at an edge.
export function useNativeEdgeScroll() {
  useEffect(() => {
    let frame = 0,
      target: HTMLElement | null = null,
      x = 0,
      y = 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      target = null;
    };
    const tick = () => {
      if (!target?.isConnected) {
        stop();
        return;
      }
      const r = target.getBoundingClientRect(),
        gutter = Number(target.dataset.edgeScroll || 0),
        vertical = target.dataset.edgeScrollAxis === 'y';
      if (y >= r.top && y <= r.bottom && x >= r.left + gutter && x <= r.right) {
        if (vertical) {
          const dy = edgeScrollDelta(y, r.top, r.bottom, 44);
          target.scrollTop += dy;
        } else {
          const dx = edgeScrollDelta(x, r.left + gutter, r.right, 36);
          target.scrollLeft += dx;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('text/plain')) return;
      target = (e.target as HTMLElement).closest('[data-edge-scroll]');
      x = e.clientX;
      y = e.clientY;
      if (target && !frame) frame = requestAnimationFrame(tick);
    };
    const leave = (e: DragEvent) => {
      if (!e.relatedTarget) stop();
    };
    document.addEventListener('dragover', over);
    document.addEventListener('drop', stop);
    document.addEventListener('dragend', stop);
    document.addEventListener('dragleave', leave);
    window.addEventListener('blur', stop);
    return () => {
      stop();
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', stop);
      document.removeEventListener('dragend', stop);
      document.removeEventListener('dragleave', leave);
      window.removeEventListener('blur', stop);
    };
  }, []);
}
