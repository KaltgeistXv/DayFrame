'use client';
import { usePlannerGesture } from '@/hooks/use-planner-gesture';
import { uiCopy } from '@/lib/ui-copy';
import DragActionDock from './drag-action-dock';
import GanttCollapseControl from './gantt-collapse-control';
import { useGanttCollapse } from '@/hooks/use-gantt-collapse';
import { calendarLanes } from '@/lib/calendar-ribbons';
import {
  isCompletionDrag,
  completeByDrag,
  calendarEntries,
  calendarKey,
  calendarCaption,
  hasRollover,
  originalPlan,
} from '@/lib/progress';
import { colorStyle } from '@/lib/colors';
import { taskRangeStyle, taskDayState } from '@/lib/task-appearance';
import CalendarToolbar from './calendar-toolbar';
import { startOfCalendarWeek } from '@/lib/calendar-views';
import { useContinuousDays } from '@/hooks/use-continuous-days';
import { useDateRangeCreate } from '@/hooks/use-date-range-create';
import ProjectBadge from '@/components/project-badge';
import { changeTaskDates, type TaskDateAction } from '@/lib/task-scheduling';
import {
  atTime,
  withoutTime,
  unplan,
  lastTaskDate,
} from '@/lib/task-scheduling';
import { TaskMenu } from '@/components/task-menu';
import { useEffect, useCallback, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { TaskDetailPropertyRow } from '@/components/task-detail-setting-row';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { day, shift, blankTask, type Task, type Project } from '@/lib/model';
import {
  HOUR_HEIGHT,
  STEP,
  clamp,
  snap,
  minutes,
  clock,
  endLabel,
  resized,
  rangeAcross,
  segment,
  occursOn,
  taskEnd,
  shiftedTask,
  deltaTo,
  layoutEvents,
} from '@/lib/planner-interactions';
type Props = {
  tasks: Task[];
  projects: Project[];
  today: string;
  initialDate?: string;
  period?: 'day' | 'week';
  toolbarEnd?: React.ReactNode;
  toolbarStart?: React.ReactNode;
  toolbarBelow?: React.ReactNode;
  onDateChange?: (date: string) => void;
  busy: boolean;
  onEdit: (t: Task, date?: string) => void;
  onNew: (date: string, time?: string, duration?: number) => void;
  onMove: (t: Task, changes: Partial<Task>) => void;
  onBatch: (tasks: Task[]) => Promise<void>;
  onDelete: (ids: string[]) => void;
};
export default function Planner({
  tasks,
  projects,
  today,
  initialDate = today,
  period = 'week',
  onDateChange,
  toolbarEnd,
  toolbarStart,
  toolbarBelow,
  busy,
  onEdit,
  onNew,
  onMove,
  onBatch,
  onDelete,
}: Props) {
  const [collapsed, setCollapsed] = useGanttCollapse(busy);
  const [selected, setSelected] = useState(initialDate),
    [month, setMonth] = useState(initialDate),
    [selection, setSelection] = useState<string[]>([]),
    [nativeDrag, setNativeDrag] = useState(''),
    [dropPreview, setDropPreview] = useState<Task | null>(null),
    [batchEdit, setBatchEdit] = useState<{ date: string; time: string } | null>(
      null,
    ),
    [hint, setHint] = useState('');
  const [cellWidth, setCellWidth] = useState(period === 'day' ? 640 : 112);
  const timeline = useContinuousDays(
    period === 'week' ? startOfCalendarWeek(initialDate) : initialDate,
    cellWidth,
    period === 'day' ? 15 : 35,
    period === 'day' ? 5 : 14,
    48,
    1,
  );
  const attachTimeline = timeline.ref;
  const horizontal = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const trash = useRef<HTMLDivElement>(null);
  const horizontalRef = useCallback(
    (node: HTMLDivElement | null) => {
      horizontal.current = node;
      scroll.current = node;
      attachTimeline(node);
    },
    [attachTimeline],
  );
  useEffect(() => {
    const node = horizontal.current;
    if (!node) return;
    const resize = new ResizeObserver(() =>
      setCellWidth(
        Math.max(
          period === 'day' ? 180 : 84,
          (node.clientWidth - 48) / (period === 'day' ? 1 : 7),
        ),
      ),
    );
    resize.observe(node);
    return () => resize.disconnect();
  }, [period]);
  const pan = useRef<{ x: number; y: number } | null>(null);
  const nativeOrigin = useRef('');
  const nativeOriginal = useRef(false);
  const nativeCompletion = useRef(false);
  const nativeEdge = useRef<TaskDateAction>('move');
  const allDayRange = useDateRangeCreate(
    (date, duration) => onNew(date, '', duration),
    busy,
  );
  const monday = timeline.visible,
    days = timeline.dates;
  const visibleDays = Array.from({ length: period === 'day' ? 1 : 7 }, (_, i) =>
    shift(monday, i),
  );
  const [renderedDay, setRenderedDay] = useState(monday);
  if (renderedDay !== monday) {
    setRenderedDay(monday);
    setMonth(monday);
    setSelection([]);
  }
  useEffect(() => {
    onDateChange?.(timeline.visible);
  }, [timeline.visible, onDateChange]);
  const first = month.slice(0, 7) + '-01',
    start = shift(first, -((new Date(first + 'T12:00:00').getDay() + 6) % 7));
  const weekTasks = calendarEntries(tasks).filter((t) =>
      visibleDays.some((d) => occursOn(t, d)),
    ),
    selectedIds = selection.filter((id) => tasks.some((t) => t.id === id)),
    scheduledSelected = selectedIds.filter((id) =>
      tasks.some((t) => t.id === id && !!t.date),
    );
  const {
    gesture,
    pendingPreview,
    point,
    begin,
    finish,
    cancel,
    onPointerMove,
    onLostPointerCapture,
  } = usePlannerGesture({
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
  });
  useEffect(() => {
    scroll.current?.scrollTo({ top: 7 * HOUR_HEIGHT });
  }, []);
  function projectColor(t: Task) {
    return projects.find((p) => p.id === t.project)?.color || '3';
  }
  function choose(d: string) {
    setSelected(d);
    setMonth(d);
    timeline.jump(period === 'week' ? startOfCalendarWeek(d) : d);
  }
  useEffect(() => {
    const focus = (e: Event) => {
      const { date, time } = (e as CustomEvent<{ date: string; time?: string }>)
        .detail;
      setSelected(date);
      setMonth(date);
      if (time && scroll.current)
        scroll.current.scrollTop = Math.max(
          0,
          (Number(time.slice(0, 2)) - 1) * HOUR_HEIGHT,
        );
    };
    window.addEventListener('patmi-focus-date', focus);
    return () => window.removeEventListener('patmi-focus-date', focus);
  }, []);
  function moveMonth(n: number) {
    const d = new Date(first + 'T12:00:00');
    d.setMonth(d.getMonth() + n);
    choose(day(d));
  }
  function dateDrop(e: React.DragEvent, date: string) {
    e.preventDefault();
    e.stopPropagation();
    const stored = tasks.find(
      (t) => t.id === e.dataTransfer.getData('text/plain'),
    );
    const t =
      stored && e.dataTransfer.getData('application/x-patmi-original') === '1'
        ? originalPlan(stored)
        : stored;
    if (
      stored &&
      !busy &&
      e.dataTransfer.getData('application/x-patmi-completion') === '1' &&
      date !== 'unplanned'
    ) {
      if (date !== e.dataTransfer.getData('application/x-patmi-origin-day'))
        onMove(stored, completeByDrag(stored, date));
      setNativeDrag('');
      setDropPreview(null);
      e.currentTarget.classList.remove('drophighlight');
      return;
    }
    if (t && !busy && date === 'unplanned') {
      onMove(t, unplan(t));
      setNativeDrag('');
      setDropPreview(null);
      e.currentTarget.classList.remove('drophighlight');
      return;
    }
    if (t && !busy && e.dataTransfer.getData('application/x-patmi-edge')) {
      if (date !== 'unplanned')
        onMove(
          t,
          changeTaskDates(
            t,
            e.dataTransfer.getData(
              'application/x-patmi-edge',
            ) as TaskDateAction,
            t.date,
            date,
          ),
        );
      setNativeDrag('');
      setDropPreview(null);
      e.currentTarget.classList.remove('drophighlight');
      return;
    }
    if (t && !busy)
      onMove(
        t,
        date === 'unplanned'
          ? unplan(t)
          : withoutTime(
              t,
              e.dataTransfer.getData('application/x-patmi-origin-day') ||
                t.date ||
                date,
              date,
            ),
      );
    e.currentTarget.classList.remove('drophighlight');
    setNativeDrag('');
    setDropPreview(null);
  }
  function allowDrop(e: React.DragEvent) {
    if (!busy && e.dataTransfer.types.includes('text/plain')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      e.currentTarget.classList.add('drophighlight');
    }
  }
  function allWeek() {
    setSelection([...new Set(weekTasks.map((t) => t.id))]);
  }
  function keyboard(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input,textarea,[role=dialog]'))
      return;
    if (e.key === 'Escape') {
      cancel();
      setSelection([]);
      setHint('');
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      allWeek();
    } else if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      selectedIds.length
    ) {
      e.preventDefault();
      onDelete(selectedIds);
    }
  }
  function eventKey(e: React.KeyboardEvent, t: Task, edge?: 'start' | 'end') {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key))
      return;
    e.preventDefault();
    e.stopPropagation();
    const delta =
      e.key === 'ArrowUp'
        ? -STEP
        : e.key === 'ArrowDown'
          ? STEP
          : e.key === 'ArrowLeft'
            ? -1440
            : 1440;
    if (edge) {
      if (Math.abs(delta) === 1440) return;
      onMove(
        t,
        resized(
          t,
          edge,
          (edge === 'start' ? minutes(t.time) : minutes(t.time) + t.duration) +
            delta,
        ),
      );
    } else onMove(t, shiftedTask(t, delta));
  }
  function nativeOver(e: React.DragEvent) {
    if (!nativeDrag || busy) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const stored = tasks.find((t) => t.id === nativeDrag);
    const t = stored && nativeOriginal.current ? originalPlan(stored) : stored;
    if (t) {
      const p = point(e.clientX, e.clientY);
      if (nativeCompletion.current) {
        setDropPreview(null);
        return;
      }
      if (nativeEdge.current !== 'move') {
        setDropPreview(null);
        return;
      }
      setDropPreview(
        atTime(
          t,
          p.date,
          clock(clamp(snap(p.minute), 0, 1425)),
          nativeOrigin.current,
        ),
      );
    }
  }
  const previewMap = new Map(
    (gesture?.active && gesture.valid && !gesture.overTrash
      ? gesture.preview
      : pendingPreview
    ).map((t) => [calendarKey(t), t]),
  );
  const display = calendarEntries(tasks).map(
    (t) => previewMap.get(calendarKey(t)) || t,
  );
  if (dropPreview && !previewMap.has(calendarKey(dropPreview))) {
    const index = display.findIndex(
      (t) => calendarKey(t) === calendarKey(dropPreview),
    );
    if (index >= 0) display[index] = dropPreview;
  }
  const ribbons = calendarLanes(display, days[0], days.at(-1)!);
  const ribbonHeight =
    (ribbons.length ? Math.max(...ribbons.map((r) => r.lane)) + 1 : 0) * 22;
  const newRange =
    gesture?.kind === 'create' && gesture.active && gesture.valid
      ? rangeAcross(
          gesture.origin.date,
          gesture.origin.minute,
          gesture.point.date,
          gesture.point.minute,
        )
      : null;
  function newSegment(date: string) {
    return newRange
      ? segment(
          {
            ...blankTask(newRange.date),
            time: clock(newRange.start),
            duration: newRange.duration,
          },
          date,
        )
      : null;
  }
  const activePreview =
    gesture?.preview.find((t) => t.id === gesture.task?.id) || dropPreview;
  const selectedDayTasks = [
    ...new Map(
      calendarEntries(tasks)
        .filter((t) => occursOn(t, selected))
        .map((t) => [t.id, t]),
    ).values(),
  ];
  const batchAnchor =
    tasks.find((t) => selectedIds.includes(t.id) && t.time) ||
    tasks.find((t) => selectedIds.includes(t.id));
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      ref={root}
      className={
        'planner interactiveplanner ' + (gesture?.active ? 'gesturing ' : '')
      }
      // Keyboard target for schedule navigation, selection and Escape.
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      aria-label={period === 'day' ? '日历日视图' : '日历周视图'}
      onKeyDown={keyboard}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={cancel}
      onLostPointerCapture={onLostPointerCapture}
    >
      <CalendarToolbar
        toolbarStart={
          <>
            {toolbarStart}
            <GanttCollapseControl
              groupIds={['unplanned']}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              disabled={busy}
              subject="未排期任务"
            />
          </>
        }
        toolbarBelow={toolbarBelow}
        date={timeline.visible}
        period={period}
        onDate={choose}
        onToday={() => choose(today)}
        onMove={(delta) =>
          choose(shift(timeline.visible, delta * (period === 'day' ? 1 : 7)))
        }
      >
        {toolbarEnd}
      </CalendarToolbar>
      <aside className="monthpanel">
        <div className="mini-month-card">
          <div className="minimonthhead">
            <h3>
              {month.slice(0, 4)}年<b>{Number(month.slice(5, 7))}月</b>
            </h3>
            <button
              className="iconbtn"
              aria-label="上个月"
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              className="iconbtn"
              aria-label="下个月"
              onClick={() => moveMonth(1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="minimonth">
            {['一', '二', '三', '四', '五', '六', '日'].map((x) => (
              <span key={x}>{x}</span>
            ))}
            {Array.from({ length: 42 }, (_, i) => shift(start, i)).map((d) => (
              <button
                key={d}
                onClick={() => choose(d)}
                aria-label={d}
                aria-pressed={selected === d}
                className={
                  (d === selected ? 'chosen ' : '') +
                  (d === today ? 'miniToday ' : '') +
                  (d.slice(0, 7) !== month.slice(0, 7) ? 'muted ' : '') +
                  (period === 'week' && visibleDays.includes(d) ? 'inweek' : '')
                }
              >
                <span className="mini-day-state">{Number(d.slice(8))}</span>
              </button>
            ))}
          </div>
          <div className="monthcaption">
            <span>
              {tasks.filter((t) => t.date.startsWith(month.slice(0, 7))).length}{' '}
              项月度安排
            </span>
          </div>
        </div>
        <div className="schedule-dropzone">
          <div className="sectionlabel">
            <button
              className="group-disclosure"
              aria-expanded={!collapsed.includes('unplanned')}
              onClick={() =>
                setCollapsed((ids) =>
                  ids.includes('unplanned') ? [] : ['unplanned'],
                )
              }
            >
              {uiCopy.unplanned}
              <small>
                {tasks.filter((t) => !t.date && t.status !== 'done').length}
              </small>
            </button>
          </div>
          <div
            className="group-content"
            hidden={collapsed.includes('unplanned')}
          >
            {tasks
              .filter((t) => !t.date && t.status !== 'done')
              .map((t) => (
                <TaskMenu key={t.id} task={t}>
                  <button
                    draggable={!busy}
                    data-task-id={t.id}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', t.id);
                      nativeEdge.current = 'move';
                      nativeCompletion.current = false;
                      nativeOrigin.current =
                        e.dataTransfer.getData(
                          'application/x-patmi-origin-day',
                        ) || t.date;
                      setNativeDrag(t.id);
                    }}
                    onDragEnd={() => {
                      setNativeDrag('');
                      setDropPreview(null);
                    }}
                    className="unplannedtask ui-interactive-row ui-interactive-row--compact"
                    key={t.id}
                    onClick={() => onEdit(t)}
                  >
                    <span className={'dot color' + projectColor(t)} />
                    <span className="unplanned-name">
                      {t.title}
                      <ProjectBadge
                        project={projects.find((p) => p.id === t.project)}
                      />
                    </span>
                  </button>
                </TaskMenu>
              ))}
            {!tasks.some((t) => !t.date && t.status !== 'done') && (
              <p className="viewhint">{uiCopy.noUnplanned}</p>
            )}
            <button className="addrow" onClick={() => onNew('')}>
              <Plus size={14} />
              {uiCopy.newTask}
            </button>
          </div>
        </div>
      </aside>
      <section className="weekly">
        <div className="selectionbar-slot">
          {' '}
          {selectedIds.length > 0 && (
            <div
              className="selectionbar"
              role="toolbar"
              aria-label="已选任务操作"
            >
              <strong>已选 {selectedIds.length} 项</strong>
              <button
                disabled={busy}
                onClick={() => {
                  if (batchAnchor)
                    setBatchEdit({
                      date: batchAnchor.date,
                      time: batchAnchor.time,
                    });
                }}
              >
                <CalendarDays size={14} />
                改期
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  try {
                    await onBatch(
                      tasks
                        .filter((t) => selectedIds.includes(t.id))
                        .map((t) => ({ ...t, status: 'done' })),
                    );
                    setSelection([]);
                  } catch {}
                }}
              >
                <Check size={14} />
                完成
              </button>
              <button disabled={busy} onClick={() => onDelete(selectedIds)}>
                <Trash2 size={14} />
                {uiCopy.remove}
              </button>
              <button onClick={() => setSelection([])} aria-label="取消选择">
                <X size={15} />
              </button>
            </div>
          )}
        </div>
        <div
          className="weekhorizontal continuous-week"
          ref={horizontalRef}
          style={timeline.style}
          data-edge-scroll="48"
          onPointerDownCapture={(e) => {
            if (
              (e.pointerType !== 'touch' && e.button !== 1) ||
              !(e.target as HTMLElement).closest('.timeslot,.weekcorner')
            )
              return;
            e.preventDefault();
            e.stopPropagation();
            pan.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMoveCapture={(e) => {
            if (!pan.current) return;
            e.stopPropagation();
            e.currentTarget.scrollLeft += pan.current.x - e.clientX;
            scroll.current?.scrollBy({ top: pan.current.y - e.clientY });
            pan.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUpCapture={(e) => {
            if (!pan.current) return;
            e.stopPropagation();
            pan.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            pan.current = null;
          }}
          onLostPointerCapture={() => {
            pan.current = null;
          }}
        >
          <div className="weekhead">
            <div className="weekcorner">
              <CalendarDays size={15} />
            </div>
            {days.map((d) => (
              <button
                key={d}
                onClick={() => choose(d)}
                aria-pressed={d === selected}
                className={
                  (d === selected ? 'selectedweekdate ' : '') +
                  'calendar-snap-point'
                }
              >
                <span>
                  周
                  {
                    ['日', '一', '二', '三', '四', '五', '六'][
                      new Date(d + 'T12:00:00').getDay()
                    ]
                  }
                </span>
                <b className={d === today ? 'weekToday' : ''}>
                  {Number(d.slice(8))}
                </b>
              </button>
            ))}
          </div>
          <div
            className="alldayrow ribbon-calendar"
            {...allDayRange.bind}
            onDragOver={(e) => {
              if (
                (e.target as HTMLElement).closest('.tracked-ribbon') &&
                !busy
              ) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(e) => dateDrop(e, point(e.clientX, e.clientY).date)}
          >
            <span>全天任务</span>
            {days.map((d, i) => (
              <div
                key={d}
                style={{
                  gridColumn: i + 2,
                  padding: 0,
                  minHeight: Math.max(32, ribbonHeight + 6),
                }}
                data-schedule-drop={d}
                data-range-date={d}
                className={
                  (gesture?.dropZone === d ? 'drophighlight ' : '') +
                  (allDayRange.range &&
                  d >= allDayRange.range.start &&
                  d <= allDayRange.range.end
                    ? 'range-day'
                    : '')
                }
                title={d + ' · 拖入全天任务，双击空白新建'}
                onDragOver={allowDrop}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    e.currentTarget.classList.remove('drophighlight');
                }}
                onDrop={(e) => dateDrop(e, d)}
                onDoubleClick={(e) => {
                  if (e.target === e.currentTarget) onNew(d, '', 1440);
                }}
              ></div>
            ))}
            {ribbons.map((r) => {
              const task = r.plan;
              const project = projects.find((p) => p.id === task.project);

              const drag = (
                e: React.DragEvent<HTMLButtonElement>,
                edge = '',
              ) => {
                const date = point(e.clientX, e.clientY).date;
                nativeCompletion.current = isCompletionDrag(
                  r.current,
                  date,
                  edge,
                );
                if (nativeCompletion.current)
                  e.dataTransfer.setData('application/x-patmi-completion', '1');
                e.dataTransfer.setData('text/plain', task.id);
                e.dataTransfer.setData('application/x-patmi-origin-day', date);
                e.dataTransfer.setData(
                  'application/x-patmi-original',
                  task.calendarOriginal ? '1' : '0',
                );
                if (edge)
                  e.dataTransfer.setData('application/x-patmi-edge', edge);
                e.dataTransfer.effectAllowed = 'move';
                nativeOrigin.current = date;
                nativeOriginal.current = !!task.calendarOriginal;
                nativeEdge.current = (
                  edge === 'completion' ? 'move' : edge || 'move'
                ) as TaskDateAction;
                setNativeDrag(task.id);
              };
              const finish = () => {
                setNativeDrag('');
                setDropPreview(null);
              };
              const editRibbon = (e: React.MouseEvent<HTMLButtonElement>) =>
                e.shiftKey || e.metaKey || e.ctrlKey
                  ? setSelection((ids) =>
                      ids.includes(task.id)
                        ? ids.filter((id) => id !== task.id)
                        : [...ids, task.id],
                    )
                  : onEdit(
                      task,
                      e.detail ? point(e.clientX, e.clientY).date : days[r.lo],
                    );
              return (
                <TaskMenu
                  key={task.id}
                  task={task}
                  date={days[r.lo]}
                  dateAt={(e) => point(e.clientX, e.clientY).date}
                >
                  <div
                    className={
                      'tracked-ribbon' +
                      (selectedIds.includes(task.id) ? ' itemselected' : '')
                    }
                    style={{
                      gridColumn: `${r.lo + 2} / ${r.hi + 3}`,
                      top: r.lane * 22 + 3,
                      ...taskRangeStyle(
                        r.current,
                        project?.color || '3',
                        days[r.lo],
                        days[r.hi],
                      ),
                    }}
                    title={`${task.title}${project ? ' · ' + project.title : ''} · ${r.start} 至 ${r.end}${task.tracking && task.baselineEnd ? ' · 原计划截止 ' + task.baselineEnd : ''}${task.tracking && r.current.rolledDays ? ' · 自动顺延 ' + r.current.rolledDays + ' 天' : ''}`}
                  >
                    <button
                      className="tracked-ribbon-body"
                      title="拖动原计划调整排期；拖动顺延部分设置完成日期"
                      disabled={busy}
                      draggable={!busy && !r.historyOnly}
                      onDragStart={(e) => drag(e)}
                      onDragEnd={finish}
                      onClick={editRibbon}
                    >
                      <span className="tracked-ribbon-label">
                        <b className={task.status === 'done' ? 'strike' : ''}>
                          {task.title}
                        </b>
                        {project && <span>{project.title}</span>}
                        {task.tracking && (
                          <small>
                            {r.current.rolledDays
                              ? `顺延 ${r.current.rolledDays} 天`
                              : '原计划'}
                          </small>
                        )}
                      </span>
                    </button>
                    {!r.historyOnly &&
                      task.date >= days[0] &&
                      task.date <= days.at(-1)! && (
                        <button
                          className="ribbon-handle ribbon-start"
                          draggable={!busy}
                          disabled={busy}
                          aria-label={'调整开始日期：' + task.title}
                          title={
                            task.tracking
                              ? '调整原计划开始日期'
                              : '调整开始日期'
                          }
                          onDragStart={(e) => drag(e, 'start')}
                          onDragEnd={finish}
                          onClick={(e) =>
                            onEdit(
                              task,
                              e.detail
                                ? point(e.clientX, e.clientY).date
                                : days[r.lo],
                            )
                          }
                        />
                      )}
                    {r.current.rolledDays! > 0 && r.end <= days.at(-1)! && (
                      <button
                        className="ribbon-handle ribbon-end completion-handle"
                        draggable={!busy}
                        disabled={busy}
                        aria-label={uiCopy.completionDatePrefix + task.title}
                        title={uiCopy.completionDragHint}
                        onDragStart={(e) => drag(e, 'completion')}
                        onClick={() => onEdit(task, r.end)}
                        onDragEnd={finish}
                      />
                    )}
                    {!r.historyOnly &&
                      lastTaskDate(task) >= days[0] &&
                      lastTaskDate(task) <= days.at(-1)! && (
                        <button
                          className="ribbon-handle ribbon-end"
                          style={{ left: `calc(${r.split}% - 8px)` }}
                          draggable={!busy}
                          disabled={busy}
                          aria-label={'调整结束日期：' + task.title}
                          title={
                            task.tracking
                              ? '调整原计划结束日期'
                              : '调整结束日期'
                          }
                          onDragStart={(e) => drag(e, 'end')}
                          onDragEnd={finish}
                          onClick={(e) =>
                            onEdit(
                              task,
                              e.detail
                                ? point(e.clientX, e.clientY).date
                                : days[r.lo],
                            )
                          }
                        />
                      )}
                  </div>
                </TaskMenu>
              );
            })}
          </div>
          <div className="weekscroll">
            <div
              className="weekbody"
              ref={body}
              data-start={timeline.start}
              data-count={days.length}
              data-cell={cellWidth}
              onDragOver={nativeOver}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node))
                  setDropPreview(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain'),
                  stored = tasks.find((t) => t.id === id),
                  t =
                    stored &&
                    e.dataTransfer.getData('application/x-patmi-original') ===
                      '1'
                      ? originalPlan(stored)
                      : stored;
                if (t && !busy) {
                  const p = point(e.clientX, e.clientY);
                  if (
                    e.dataTransfer.getData('application/x-patmi-completion') ===
                    '1'
                  ) {
                    if (
                      p.date !==
                      e.dataTransfer.getData('application/x-patmi-origin-day')
                    )
                      onMove(stored!, completeByDrag(stored!, p.date));
                    setDropPreview(null);
                    setNativeDrag('');
                    return;
                  }
                  const edge = e.dataTransfer.getData(
                    'application/x-patmi-edge',
                  );
                  if (edge) {
                    onMove(
                      t,
                      changeTaskDates(
                        t,
                        edge as TaskDateAction,
                        t.date,
                        p.date,
                      ),
                    );
                    setDropPreview(null);
                    setNativeDrag('');
                    return;
                  }
                  onMove(
                    t,
                    atTime(
                      t,
                      p.date,
                      clock(clamp(snap(p.minute), 0, 1425)),
                      e.dataTransfer.getData(
                        'application/x-patmi-origin-day',
                      ) || t.date,
                    ),
                  );
                }
                setDropPreview(null);
                setNativeDrag('');
              }}
            >
              <div className="hourlabels">
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h}>{String(h).padStart(2, '0')}:00</span>
                ))}
              </div>
              {days.map((d) => (
                <div
                  className={
                    'weekcolumn ' + (d === selected ? 'selectedcolumn' : '')
                  }
                  key={d}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <button
                      key={h}
                      className="timeslot"
                      disabled={busy}
                      aria-label={d + ' ' + h + ':00 安排任务'}
                      onPointerDown={(e) =>
                        begin(e, e.shiftKey ? 'select' : 'create')
                      }
                      onClick={(e) => {
                        if (e.detail === 0)
                          onNew(d, String(h).padStart(2, '0') + ':00', 60);
                      }}
                    />
                  ))}
                  {layoutEvents(display, d).map((t) => (
                    <TaskMenu key={calendarKey(t)} task={t} date={d}>
                      <div
                        data-event-id={t.id}
                        className={
                          'weekevent eventcontainer color' +
                          projectColor(t) +
                          (t.status === 'done' ? ' strike' : '') +
                          (selectedIds.includes(t.id) ? ' eventselected' : '') +
                          (previewMap.has(calendarKey(t)) ||
                          dropPreview?.id === t.id
                            ? ' eventpreview'
                            : '')
                        }
                        data-calendar-layer={
                          t.calendarOriginal
                            ? 'original'
                            : hasRollover(t)
                              ? 'rollover'
                              : 'planned'
                        }
                        style={{
                          ...colorStyle(
                            projectColor(t),
                            taskDayState(t, d).strength,
                          ),
                          top: (t.start / 60) * HOUR_HEIGHT + 1,
                          height: Math.max(
                            12,
                            (t.visibleDuration / 60) * HOUR_HEIGHT - 2,
                          ),
                          left: `calc(${(t.lane / t.lanes) * 100}% + 2px)`,
                          width: `calc(${100 / t.lanes}% - 4px)`,
                        }}
                        title={`${calendarCaption(t)} ${t.title} · ${projects.find((p) => p.id === t.project)?.title ? projects.find((p) => p.id === t.project)?.title + ' · ' : ''}${t.time} — ${endLabel(t)} · ${t.duration} 分钟`}
                      >
                        <button
                          className="eventbody"
                          disabled={busy}
                          aria-label={`${t.title} ${t.time} 至 ${endLabel(t)}，方向键移动时间，回车编辑`}
                          aria-pressed={selectedIds.includes(t.id)}
                          onPointerDown={(e) => {
                            const original = t;
                            begin(e, 'move', original);
                          }}
                          onKeyDown={(e) => eventKey(e, t)}
                          onClick={(e) => {
                            if (e.detail === 0) {
                              if (e.shiftKey || e.metaKey || e.ctrlKey)
                                setSelection((prev) =>
                                  prev.includes(t.id)
                                    ? prev.filter((id) => id !== t.id)
                                    : [...prev, t.id],
                                );
                              else onEdit(t, d);
                            }
                          }}
                        >
                          <span>
                            {t.continuation ? '↳ ' + clock(t.start) : t.time} —{' '}
                            {t.endsHere ? taskEnd(t).time : '24:00 →'}
                            {projects.find((p) => p.id === t.project)?.title &&
                              ' · ' +
                                projects.find((p) => p.id === t.project)?.title}
                          </span>
                          <b>{t.title}</b>
                          {calendarCaption(t) && (
                            <small className="schedule-origin">
                              {calendarCaption(t)}
                            </small>
                          )}
                        </button>
                        {!t.continuation && (
                          <button
                            className="resizehandle resizestart"
                            disabled={busy}
                            aria-label={'调整开始时间：' + t.title}
                            title="拖动调整开始时间；↑↓ 每次调整 15 分钟"
                            onPointerDown={(e) => begin(e, 'start', t)}
                            onKeyDown={(e) => eventKey(e, t, 'start')}
                            onClick={(e) => {
                              if (e.detail === 0) onEdit(t, d);
                            }}
                          />
                        )}
                        {t.endsHere && (
                          <button
                            className="resizehandle resizeend"
                            disabled={busy}
                            aria-label={'调整结束时间：' + t.title}
                            title="拖动调整结束时间；↑↓ 每次调整 15 分钟"
                            onPointerDown={(e) => {
                              begin(e, 'end', t);
                            }}
                            onKeyDown={(e) => eventKey(e, t, 'end')}
                            onClick={(e) => {
                              if (e.detail === 0) onEdit(t, d);
                            }}
                          />
                        )}
                      </div>
                    </TaskMenu>
                  ))}
                  {newRange && newSegment(d) && (
                    <div
                      className="newrange"
                      style={{
                        top: (newSegment(d)!.start / 60) * HOUR_HEIGHT,
                        height:
                          (newSegment(d)!.visibleDuration / 60) * HOUR_HEIGHT,
                      }}
                    >
                      <b>
                        {newRange.date.slice(5)} {clock(newRange.start)} →{' '}
                        {newRange.start + newRange.duration === 1440
                          ? '24:00'
                          : clock(newRange.start + newRange.duration)}
                      </b>
                      <span>{newRange.duration} 分钟</span>
                    </div>
                  )}
                </div>
              ))}
              {gesture?.kind === 'select' && gesture.active && (
                <div
                  className="selectionrectangle"
                  style={{
                    left: Math.min(gesture.origin.x, gesture.point.x),
                    top: Math.min(gesture.origin.y, gesture.point.y),
                    width: Math.abs(gesture.origin.x - gesture.point.x),
                    height: Math.abs(gesture.origin.y - gesture.point.y),
                  }}
                />
              )}
            </div>
          </div>
        </div>
        <output className="gesturestatus">
          {gesture?.active
            ? gesture.overTrash
              ? `松开后确认删除 ${gesture.ids.length} 项任务`
              : !gesture.valid
                ? '移到日历外松开以取消'
                : gesture.dropZone !== undefined
                  ? gesture.dropZone === 'unplanned'
                    ? uiCopy.releaseCancelSchedule
                    : `松开移到 ${gesture.dropZone} · 全天任务，保留跨天跨度`
                  : newRange
                    ? `${newRange.date} ${clock(newRange.start)} → ${taskEnd({ ...blankTask(newRange.date), time: clock(newRange.start), duration: newRange.duration }).date} ${clock(newRange.start + newRange.duration)} · ${newRange.duration} 分钟`
                    : gesture.kind === 'select'
                      ? `已框选 ${selectedIds.length} 项`
                      : activePreview
                        ? `${activePreview.date} ${activePreview.time} — ${endLabel(activePreview)} · ${activePreview.duration} 分钟${gesture.preview.length > 1 ? ` · 共 ${gesture.preview.length} 项同步移动` : ''}`
                        : ''
            : dropPreview
              ? `${dropPreview.date} ${dropPreview.time} — ${endLabel(dropPreview)}`
              : hint || ''}
        </output>
        <div className="selectedday">
          <div className="sectionlabel">
            {Number(selected.slice(5, 7))}月{Number(selected.slice(8))}日{' '}
            <small>{selectedDayTasks.length} 项安排</small>
            <button
              className="iconbtn"
              aria-label="为选中日期新建任务"
              onClick={() => onNew(selected)}
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="selectedtasks">
            {selectedDayTasks.map((t) => (
              <div className="selectabledaytask" key={t.id}>
                {selectedIds.length > 0 && (
                  <Checkbox
                    checked={selectedIds.includes(t.id)}
                    aria-label={'选择 ' + t.title}
                    onCheckedChange={(v) =>
                      setSelection((prev) =>
                        v
                          ? [...new Set([...prev, t.id])]
                          : prev.filter((id) => id !== t.id),
                      )
                    }
                  />
                )}
                <TaskMenu task={t} date={selected}>
                  <button
                    className="ui-interactive-row ui-interactive-row--compact"
                    data-task-id={t.id}
                    draggable={!busy && !t.calendarHistory}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', t.id);
                      e.dataTransfer.setData(
                        'application/x-patmi-original',
                        t.calendarOriginal ? '1' : '0',
                      );
                      nativeOriginal.current = !!t.calendarOriginal;
                      e.dataTransfer.setData(
                        'application/x-patmi-origin-day',
                        selected,
                      );
                      nativeEdge.current = 'move';
                      nativeCompletion.current = false;
                      nativeOrigin.current =
                        e.dataTransfer.getData(
                          'application/x-patmi-origin-day',
                        ) || t.date;
                      setNativeDrag(t.id);
                    }}
                    onDragEnd={() => {
                      setNativeDrag('');
                      setDropPreview(null);
                    }}
                    onClick={() => onEdit(t, selected)}
                  >
                    <span className={'dot color' + projectColor(t)} />
                    <time>
                      {t.time || uiCopy.allDay}
                      {calendarCaption(t) && (
                        <small className="schedule-origin">
                          {calendarCaption(t)}
                        </small>
                      )}
                    </time>
                    <span className="day-task-identity">
                      <span className={t.status === 'done' ? 'strike' : ''}>
                        {t.title}
                      </span>
                      <ProjectBadge
                        project={projects.find((p) => p.id === t.project)}
                      />
                    </span>
                  </button>
                </TaskMenu>
              </div>
            ))}
            {!tasks.some((t) => occursOn(t, selected)) && (
              <p className="viewhint">{uiCopy.noDaySchedule}</p>
            )}
          </div>
        </div>
      </section>
      {gesture?.kind === 'move' && gesture.active && (
        <DragActionDock
          deleteRef={trash}
          active={
            gesture.overTrash
              ? 'delete'
              : gesture.dropZone === 'unplanned'
                ? 'unplan'
                : null
          }
        />
      )}
      <Dialog
        open={!!batchEdit}
        onOpenChange={(open) => {
          if (!open && !busy) setBatchEdit(null);
        }}
      >
        <DialogContent
          editorLayout="compact"
          className="editor batch-reschedule-editor"
        >
          <DialogTitle>批量改期 · {selectedIds.length} 项</DialogTitle>
          <DialogDescription>
            调整第一项任务的位置，其余任务保留原有间隔和时长。
          </DialogDescription>
          {batchEdit && batchAnchor && (
            <form
              className="batch-reschedule-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const dayDelta =
                    (Date.parse(batchEdit.date) -
                      Date.parse(batchAnchor.date)) /
                    86400000,
                  delta = batchAnchor.time
                    ? deltaTo(
                        batchAnchor,
                        batchEdit.date,
                        minutes(batchEdit.time),
                      )
                    : dayDelta * 1440;
                try {
                  await onBatch(
                    tasks
                      .filter((t) => selectedIds.includes(t.id))
                      .map((t) =>
                        t.time
                          ? shiftedTask(t, delta)
                          : { ...t, date: shift(t.date, dayDelta) },
                      ),
                  );
                  setBatchEdit(null);
                  choose(batchEdit.date);
                  setSelection([]);
                } catch {}
              }}
            >
              <div className="batch-reschedule-body">
                <p className="batch-reschedule-reference">
                  参考任务 <strong>{batchAnchor.title}</strong>
                </p>
                <TaskDetailPropertyRow label="日期">
                  <DatePicker
                    ariaLabel="日期"
                    value={batchEdit.date}
                    required
                    onChange={(date) => {
                      if (date) setBatchEdit({ ...batchEdit, date });
                    }}
                  />
                </TaskDetailPropertyRow>
                {batchAnchor.time && (
                  <TaskDetailPropertyRow label={uiCopy.startTime}>
                    <Input
                      className="batch-reschedule-time"
                      aria-label={uiCopy.startTime}
                      type="time"
                      required
                      value={batchEdit.time}
                      onChange={(e) =>
                        setBatchEdit({ ...batchEdit, time: e.target.value })
                      }
                    />
                  </TaskDetailPropertyRow>
                )}
              </div>
              <DialogFooter
                layout="contained"
                className="formfooter batch-reschedule-footer"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setBatchEdit(null)}
                >
                  {uiCopy.cancel}
                </Button>
                <Button size="sm" disabled={busy}>
                  保存改期
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
