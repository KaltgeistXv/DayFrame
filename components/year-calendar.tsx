'use client';
import { useRef, useEffect, useState } from 'react';
import type { Task, Project } from '@/lib/model';
import { monthGrid, tasksOnDate } from '@/lib/calendar-views';
import { colorHex } from '@/lib/colors';
export default function YearCalendar(p: {
  date: string;
  today: string;
  tasks: Task[];
  projects: Project[];
  onDay: (date: string) => void;
  onMonth: (date: string) => void;
  onYear: (delta: number) => void;
  onDrop: (event: React.DragEvent, date: string) => void;
}) {
  const { onYear } = p;
  const swipe = useRef({ amount: 0, at: 0 });
  const root = useRef<HTMLDivElement>(null);
  const [dayWidth, setDayWidth] = useState(28);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const viewport = node.closest<HTMLElement>('.workspace-scroll');
    const measure = () => {
      const bottom = viewport ? viewport.getBoundingClientRect().bottom : window.innerHeight;
      const top = node.getBoundingClientRect().top + (viewport?.scrollTop ?? 0);
      // Keep space for the unplanned summary and the shared panel inset.
      node.style.setProperty('--year-available-height', `${Math.max(0, bottom - top - 64)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (viewport) observer.observe(viewport);
    if (node.parentElement) observer.observe(node.parentElement);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => {
    const node = root.current?.querySelector<HTMLElement>('.year-day');
    if (!node) return;
    const measure = () => setDayWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const wheel = (e: WheelEvent) => {
      if (!e.shiftKey && Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = Date.now();
      if (now - swipe.current.at > 250) swipe.current.amount = 0;
      swipe.current.amount += e.shiftKey ? e.deltaY : e.deltaX;
      swipe.current.at = now;
      if (Math.abs(swipe.current.amount) > 180) {
        onYear(Math.sign(swipe.current.amount));
        swipe.current.amount = 0;
      }
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [onYear]);
  const year = p.date.slice(0, 4);
  return (
    <div ref={root} className="year-calendar" aria-label={year + '年日历'}>
      {Array.from(
        { length: 12 },
        (_, m) => `${year}-${String(m + 1).padStart(2, '0')}-01`,
      ).map((month, i) => (
        <section className="year-month" key={month}>
          <button
            className="year-month-title"
            onClick={() => p.onMonth(month)}
            aria-label={`${year}年${i + 1}月，打开月视图`}
          >
            {i + 1}月 <span>↗</span>
          </button>
          <div className="year-month-grid">
            {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
              <span key={d} className="year-weekday">
                {d}
              </span>
            ))}
            {monthGrid(month).map((date) => {
              const inside = date.slice(0, 7) === month.slice(0, 7);
              const tasks = inside ? tasksOnDate(p.tasks, date) : [];
              const capacity = Math.max(1, Math.floor((dayWidth - 8) / 5));
              const dots =
                tasks.length <= capacity
                  ? tasks.length
                  : Math.max(0, Math.floor((dayWidth - 30) / 5));
              return (
                <button
                  key={date}
                  className={
                    'year-day ' +
                    (!inside ? 'outside ' : '') +
                    (inside && date === p.today ? 'is-today ' : '') +
                    (inside && date === p.date ? 'is-selected' : '')
                  }
                  tabIndex={inside ? 0 : -1}
                  aria-hidden={!inside}
                  disabled={!inside}
                  aria-label={`${date}，${tasks.length}项任务，打开日视图`}
                  title={
                    tasks.length ? tasks.map((t) => t.title).join('、') : date
                  }
                  onClick={() => p.onDay(date)}
                  onDragOver={(e) => {
                    if (inside) e.preventDefault();
                  }}
                  onDrop={(e) => p.onDrop(e, date)}
                >
                  <span className="year-day-state">
                    {inside ? Number(date.slice(8)) : ''}
                  </span>
                  <span className="year-day-dots" aria-hidden="true">
                    {tasks.slice(0, dots).map((t) => (
                      <i
                        key={t.id}
                        style={{
                          background: colorHex(
                            p.projects.find((x) => x.id === t.project)?.color ||
                              '3',
                          ),
                        }}
                      />
                    ))}
                    {tasks.length > dots && (
                      <small>+{tasks.length - dots}</small>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
