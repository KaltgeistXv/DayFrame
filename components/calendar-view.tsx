'use client';
import { uiCopy } from '@/lib/ui-copy';
import { Plus } from 'lucide-react';
import GanttCollapseControl from './gantt-collapse-control';
import { useGanttCollapse } from '@/hooks/use-gantt-collapse';
import { useEffect, useMemo, useRef, useState } from 'react';
import { day, type Task, type Project } from '@/lib/model';
import { calendarEntries, originalPlan, completeByDrag } from '@/lib/progress';
import {
  changeTaskDates,
  type TaskDateAction,
} from '@/lib/task-scheduling';
import { calendarPeriods, shiftCalendarYear } from '@/lib/calendar-views';
import { useContinuousMonths } from '@/hooks/use-continuous-months';
import { useDateRangeCreate } from '@/hooks/use-date-range-create';
import MonthCalendar from './month-calendar';
import ProjectBadge from './project-badge';
import { TaskMenu } from './task-menu';
import Planner from './planner';
import YearCalendar from './year-calendar';
import CalendarToolbar from './calendar-toolbar';
type Period = 'year' | 'month' | 'week' | 'day';
export type CalendarViewProps = {
  toolbarStart?: React.ReactNode;
  toolbarBelow?: React.ReactNode;
  tasks: Task[];
  allTasks?: Task[];
  projects: Project[];
  today: string;
  date: string;
  onDateChange: (date: string) => void;
  busy: boolean;
  scopeKey: string;
  onEdit: (t: Task, date?: string) => void;
  onNew: (date: string, time?: string, duration?: number) => void;
  onMove: (t: Task, changes: Partial<Task>) => void;
  onBatch: (tasks: Task[]) => Promise<void>;
  onDelete: (ids: string[]) => void;
};
export default function CalendarView(p: CalendarViewProps) {
  const [collapsed, setCollapsed] = useGanttCollapse(p.busy, ['unplanned']);
  const {
    tasks,
    projects,
    today,
    busy,
    onNew,
    onEdit: edit,
    date: anchor,
    onDateChange: setAnchor,
  } = p;
  const [period, setPeriod] = useState<Period>('month');
  const [selected, setSelected] = useState(anchor);
  const {
    ref: attachMonths,
    style: monthStyle,
    months,
    rowHeight,
    jump: jumpMonth,
  } = useContinuousMonths(anchor, setAnchor);
  const initializedScope = useRef('');
  useEffect(() => {
    if (initializedScope.current === p.scopeKey) return;
    initializedScope.current = p.scopeKey;
    let next: Period = 'month';
    try {
      const saved = localStorage.getItem('patmi:calendar-period:' + p.scopeKey);
      if (calendarPeriods.some(([id]) => id === saved)) next = saved as Period;
    } catch {}
    setPeriod(next);
    setSelected(today);
    if (next === 'month') jumpMonth(today);
    else setAnchor(today);
  }, [p.scopeKey, today, jumpMonth, setAnchor]);
  function openPeriod(next: Period, date = anchor) {
    if (next === 'month') jumpMonth(date);
    else setAnchor(date);
    setSelected(date);
    setPeriod(next);
    try {
      localStorage.setItem('patmi:calendar-period:' + p.scopeKey, next);
    } catch {}
  }
  const monthRange = useDateRangeCreate(
    (date, duration) => onNew(date, '', duration),
    busy,
  );
  const calendarTasks = useMemo(
    () => calendarEntries(tasks.filter((t) => !!t.date)),
    [tasks],
  );
  function move(amount: number) {
    if (period === 'year') setAnchor(shiftCalendarYear(anchor, amount));
    else {
      const d = new Date(anchor + 'T12:00:00');
      d.setDate(1);
      d.setMonth(d.getMonth() + amount);
      jumpMonth(day(d));
    }
  }
  function drop(e: React.DragEvent, date: string) {
    e.preventDefault();
    const stored = (p.allTasks || tasks).find(
      (t) => t.id === e.dataTransfer.getData('text/plain'),
    );
    if (!stored || busy) return;
    if (e.dataTransfer.getData('application/x-patmi-completion') === '1') {
      if (date !== e.dataTransfer.getData('application/x-patmi-origin-day'))
        p.onMove(stored, completeByDrag(stored, date));
      return;
    }
    const t =
      e.dataTransfer.getData('application/x-patmi-original') === '1'
        ? originalPlan(stored)
        : stored;
    p.onMove(
      t,
      changeTaskDates(
        t,
        (e.dataTransfer.getData('application/x-patmi-edge') ||
          'move') as TaskDateAction,
        e.dataTransfer.getData('application/x-patmi-origin-day') || t.date,
        date,
      ),
    );
  }
  const periodControl = (
    <fieldset className="calendar-period-switch" aria-label="日历时间范围">
      {calendarPeriods.map(([id, label]) => (
        <button
          key={id}
          aria-pressed={period === id}
          onClick={() => openPeriod(id as Period, today)}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
  return (
    <div className={'calendar-view calendar-period-' + period}>
      {period === 'week' || period === 'day' ? (
        <Planner
          key={period}
          {...p}
          initialDate={anchor}
          period={period}
          onDateChange={setAnchor}
          toolbarEnd={periodControl}
        />
      ) : (
        <>
          <CalendarToolbar
            toolbarStart={<>{p.toolbarStart}<GanttCollapseControl groupIds={['unplanned']} collapsed={collapsed} setCollapsed={setCollapsed} disabled={busy} subject="未排期任务" /></>}
            toolbarBelow={p.toolbarBelow}
            date={anchor}
            period={period}
            onMove={move}
            onDate={(date) => {
              jumpMonth(date);
              setSelected(date);
            }}
            onToday={() => {
              jumpMonth(today);
              setSelected(today);
            }}
          >
            {periodControl}
          </CalendarToolbar>
          {period === 'year' ? (
            <YearCalendar
              date={anchor}
              today={today}
              tasks={calendarTasks}
              projects={projects}
              onDay={(date) => openPeriod('day', date)}
              onMonth={(date) => openPeriod('month', date)}
              onYear={move}
              onDrop={drop}
            />
          ) : (
            <div className="month-calendar-shell">
              <div className="month-weekdays" aria-hidden="true">
                {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
                  <span key={w}>周{w}</span>
                ))}
              </div>
              <div
                className="calendarwrap continuous-months"
                ref={attachMonths}
                style={monthStyle}
                data-edge-scroll="0"
                data-edge-scroll-axis="y"
                {...monthRange.bind}
              >
                <div className="month-strip">
                  {months.map((monthDate) => (
                    <MonthCalendar
                      key={monthDate}
                      month={monthDate}
                      displayMonth={anchor}
                      rowHeight={rowHeight}
                      today={today}
                      selected={selected}
                      range={monthRange.range}
                      tasks={calendarTasks}
                      projects={projects}
                      busy={busy}
                      onDay={(date) => openPeriod('day', date)}
                      onNew={(date) => onNew(date, '', 1440)}
                      onEdit={edit}
                      onDrop={drop}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {(period === 'year' || period === 'month') && (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <details
          className="calendar-unplanned"
          open={!collapsed.includes('unplanned')}

        >
          <summary onClick={(event) => { event.preventDefault(); setCollapsed(ids => ids.includes('unplanned') ? [] : ['unplanned']); }}>未排期 · {tasks.filter((t) => !t.date).length}</summary>
          <div className="calendar-unplanned-list">
            {tasks
              .filter((t) => !t.date)
              .map((t) => (
                <TaskMenu key={t.id} task={t}>
                  <button
                    className="calendar-unplanned-task ui-interactive-row ui-interactive-row--compact"
                    disabled={busy}
                    draggable={!busy}
                    data-task-id={t.id}
                    onDragStart={(e) =>
                      e.dataTransfer.setData('text/plain', t.id)
                    }
                    onClick={() => edit(t)}
                  >
                    <span className={t.status === 'done' ? 'strike' : ''}>
                      {t.title}
                    </span>
                    <ProjectBadge
                      project={projects.find((p) => p.id === t.project)}
                    />
                  </button>
                </TaskMenu>
              ))}
            <button
              className="addrow"
              disabled={busy}
              onClick={() => onNew('')}
            >
              <Plus size={16} aria-hidden="true" />{uiCopy.newTask}</button>
          </div>
        </details>
      )}
    </div>
  );
}
