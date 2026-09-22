'use client';
import { uiCopy } from '@/lib/ui-copy';
import { colorHex } from '@/lib/colors';
import DragActionDock from './drag-action-dock';
import { displayDate } from '@/lib/calendar-date';
import {
  memo,
  useEffect,
  useRef,
  useState,
  type PointerEvent as PE,
} from 'react';
import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import type { Task, Project } from '@/lib/model';
import { taskSpan, taskRangeStyle, canCheckIn } from '@/lib/task-appearance';
import {
  originalPlan,
  progressOf,
  isCompletionDrag,
  completeByDrag,
  prepareTracking,
  rollForward,
} from '@/lib/progress';
import { shift } from '@/lib/model';
import {
  changeTaskDates,
  unplan,
  lastTaskDate,
  type TaskDateAction,
} from '@/lib/task-scheduling';
import {
  TaskMenu,
  DailyCheckIn,
  useWorkspaceToday,
  useTaskDeletionConfirmation,
} from '@/components/task-menu';
type Props = {
  task: Task;
  project?: Project;
  dates: string[];
  busy: boolean;
  onEdit: (t: Task, date?: string) => void;
  onMove: (t: Task, c: Partial<Task>) => void;
  onOrder?: (id: string, target: string, after?: boolean) => void;
  orderTaskIds?: ReadonlySet<string>;
  showCheckIns?: boolean;
  showProject?: boolean;
  previous?: string;
  next?: string;
};
function TaskTimelineRow(p: Props) {
  const requestDeleteConfirmation = useTaskDeletionConfirmation();
  const [dockEnabled, setDockEnabled] = useState(false);
  const [dropAction, setDropAction] = useState<'unplan' | 'delete' | null>(null);
  const root = useRef<HTMLDivElement>(null),
    gesture = useRef<{
      base: Task;
      action: TaskDateAction;
      origin: string;
      x: number;
      next: Task;
      active: boolean;
      completion: boolean;
      pointerId: number;
    } | null>(null);
  const frame = useRef(0),
    pointer = useRef<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<Task | null>(null),
    [hint, setHint] = useState('');
  function cancel() {
    const g = gesture.current;
    gesture.current = null;
    cancelAnimationFrame(frame.current);
    pointer.current = null;
    setHint('');
    setDropAction(null);
    setDockEnabled(false);
    setPreview(null);
    if (g && root.current?.hasPointerCapture(g.pointerId))
      root.current.releasePointerCapture(g.pointerId);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && gesture.current) {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }
      },
      blur = () => cancel();
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(frame.current);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', blur);
    };
  }, []);
  function dateAt(x: number) {
    const viewport = root.current
      ?.closest('.gantt-scroll')
      ?.getBoundingClientRect();
    if (viewport && (x < viewport.left + 220 || x > viewport.right))
      return null;
    const cells =
      root.current!.querySelectorAll<HTMLElement>('[data-task-date]');
    for (const c of cells) {
      const r = c.getBoundingClientRect();
      if (x >= r.left && x <= r.right) return c.dataset.taskDate!;
    }
    return null;
  }
  function begin(e: PE, action: TaskDateAction, completion = false) {
    if (p.busy || e.button !== 0) return;
    const origin = dateAt(e.clientX);
    if (!origin) return;
    e.preventDefault();
    e.stopPropagation();
    gesture.current = {
      action,
      completion:
        completion ||
        isCompletionDrag(p.task, origin, action === 'move' ? '' : action),
      origin,
      x: e.clientX,
      base: originalPlan(p.task),
      next: originalPlan(p.task),
      active: false,
      pointerId: e.pointerId,
    };
    setDockEnabled(action === 'move' && !gesture.current.completion);
    root.current?.setPointerCapture(e.pointerId);
    pointer.current = { x: e.clientX, y: e.clientY };
    const tick = () => {
      const pt = pointer.current,
        area = root.current?.closest<HTMLElement>('.gantt-scroll');
      if (!pt || !gesture.current || !area) return;
      const r = area.getBoundingClientRect();
      if (
        pt.y >= r.top &&
        pt.y <= r.bottom &&
        pt.x >= r.left + 220 &&
        pt.x <= r.right
      ) {
        const dx = pt.x < r.left + 248 ? -8 : pt.x > r.right - 28 ? 8 : 0;
        if (dx) {
          const before = area.scrollLeft;
          area.scrollLeft += dx;
          if (before !== area.scrollLeft) updateAt(pt.x);
        }
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }
  function updateAt(x: number) {
    const g = gesture.current;
    if (!g) return;
    const date = dateAt(x);
    if (!date) {
      setHint('移回日期区域继续拖动，Esc 取消');
      return;
    }
    g.active ||= Math.abs(x - g.x) > 4;
    if (g.completion) {
      g.next = completeByDrag(p.task, date);
      if (g.active) {
        try {
          setPreview(prepareTracking(g.next, p.task, today));
        } catch {
          setPreview(null);
        }
        setHint(
          date > today ? '不能将未来日期设为完成日期' : `松开标记 ${date} 完成`,
        );
      }
      return;
    }
    g.next = changeTaskDates(g.base, g.action, g.origin, date);
    if (g.active) {
      setPreview(rollForward(prepareTracking(g.next, p.task, today), today));
      setHint(`${g.next.date} — ${lastTaskDate(g.next)}`);
    }
  }
  function update(e: PE) {
    if (!gesture.current) return;
    e.stopPropagation();
    pointer.current = { x: e.clientX, y: e.clientY };
    updateAt(e.clientX);
    const target = document.elementFromPoint(e.clientX, e.clientY);
    setDropAction(target?.closest('[data-task-delete]') ? 'delete' : target?.closest('[data-task-unplan]') ? 'unplan' : null);
    if (
      gesture.current.action === 'move' &&
      document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest('[data-task-unplan]')
    )
      setHint(uiCopy.releaseCancelSchedule);
  }
  const today = useWorkspaceToday();
  const t = p.task;
  const shown = preview || t;
  const span = taskSpan(shown);
  const offset = (Date.parse(span.start) - Date.parse(p.dates[0])) / 86400000;
  const last = (Date.parse(span.end) - Date.parse(p.dates[0])) / 86400000;
  const planLast =
    (Date.parse(span.planEnd) - Date.parse(p.dates[0])) / 86400000;
  const lo = Math.max(0, offset),
    hi = Math.min(p.dates.length - 1, last);
  const checkInDates = p.dates.filter((date) => canCheckIn(t, date, today));
  const checkins = p.showCheckIns !== false && checkInDates.length > 0;
  const metrics = progressOf(t, today);
  return (
    <>
    {preview && dockEnabled && <DragActionDock active={dropAction} />}
    <TaskMenu task={p.task} dateAt={(e) => dateAt(e.clientX) || undefined}>
      <div
        ref={root}
        className={
          'gantt-row task-timeline-row ' +
          (checkins ? 'with-checkins ' : '') +
          (preview ? 'task-range-preview' : '')
        }
        onPointerMove={update}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (!g) return;
          update(e);
          const unplanned = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest('[data-task-unplan]');
          const deleting = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-task-delete]');
          const valid = dateAt(e.clientX);
          cancel();
          if (deleting && g.action === 'move' && g.active && !g.completion) {
            requestDeleteConfirmation?.([p.task.id]);
            return;
          }
          if (unplanned && g.action === 'move' && g.active) {
            p.onMove(p.task, unplan(p.task));
            return;
          }
          if (!valid) return;
          if (g.completion && g.active) {
            if (valid !== g.origin)
              p.onMove(p.task, completeByDrag(p.task, valid));
            return;
          }
          if (g.active || g.action === 'range')
            p.onMove(
              p.task,
              g.next.date
                ? g.next
                : changeTaskDates(g.base, 'range', g.origin, g.origin),
            );
          else p.onEdit(originalPlan(p.task), g.origin);
          setHint('');
        }}
        onPointerCancel={cancel}
        onLostPointerCapture={() => {
          if (gesture.current) cancel();
        }}
        onDragOver={(e) => {
          if (
            p.onOrder &&
            e.dataTransfer.types.includes('application/x-patmi-task-order')
          )
            e.preventDefault();
        }}
        onDrop={(e) => {
          const id = e.dataTransfer.getData('application/x-patmi-task-order');
          if (
            id &&
            id !== t.id &&
            p.onOrder &&
            (!p.orderTaskIds ||
              (p.orderTaskIds.has(id) && p.orderTaskIds.has(t.id)))
          ) {
            e.preventDefault();
            e.stopPropagation();
            p.onOrder(id, t.id);
          }
        }}
      >
        <div className="gantt-name task-row-name">
          <button
            className="task-order-grip iconbtn"
            hidden={!p.onOrder}
            disabled={p.busy}
            draggable={!!p.onOrder && !p.busy}
            title="拖动调整任务顺序"
            aria-label={'排序 ' + t.title}
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-patmi-task-order', t.id);
            }}
          >
            <GripVertical size={13} />
          </button>
          <span className="gantt-task-dot" aria-hidden="true" style={{ backgroundColor: colorHex(p.project?.color || '3') }} />
          <button
            className="task-row-title"
            title={[t.title, !t.date ? uiCopy.unplanned : '', p.showProject !== false ? p.project?.title : '', t.tracking ? `已打卡 ${t.checkins?.length || 0} 天${metrics.late ? ` · 延期 ${metrics.late} 天` : ''}` : ''].filter(Boolean).join(' · ')}
            draggable={!p.busy}
            data-task-id={t.id}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', t.id);
              e.dataTransfer.setData(
                'application/x-patmi-origin-day',
                originalPlan(t).date,
              );
              e.dataTransfer.setData(
                'application/x-patmi-original',
                originalPlan(t).calendarOriginal ? '1' : '0',
              );
            }}
            onClick={() => p.onEdit(originalPlan(p.task))}
          >
            <span className={t.status === 'done' ? 'strike' : ''}>
              {t.title}
            </span>
            {hint && <small>{hint}</small>}
          </button>
          {p.onOrder && (
            <div className="task-order-actions">
              <button
                className="iconbtn"
                disabled={p.busy || !p.previous}
                aria-label="任务上移"
                onClick={() => p.previous && p.onOrder?.(t.id, p.previous)}
              >
                <ArrowUp size={12} />
              </button>
              <button
                className="iconbtn"
                disabled={p.busy || !p.next}
                aria-label="任务下移"
                onClick={() => p.next && p.onOrder?.(t.id, p.next, true)}
              >
                <ArrowDown size={12} />
              </button>
            </div>
          )}
        </div>
        {p.dates.map((date, i) => (
          <button
            className={'gantt-cell ' + (date === today ? 'gantt-today' : '')}
            key={date}
            style={{ gridColumn: i + 2 }}
            data-task-date={date}
            disabled={p.busy}
            aria-label={date + ' 安排 ' + t.title}
            onPointerDown={(e) => {
              if (!p.task.date) begin(e, 'range');
            }}
            onDoubleClick={() =>
              p.onMove(
                p.task,
                changeTaskDates(
                  originalPlan(p.task),
                  'move',
                  originalPlan(p.task).date || date,
                  date,
                ),
              )
            }
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('text/plain'))
                e.preventDefault();
            }}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/plain');
              if (id === t.id) {
                e.preventDefault();
                e.stopPropagation();
                p.onMove(
                  p.task,
                  changeTaskDates(
                    originalPlan(p.task),
                    'move',
                    e.dataTransfer.getData('application/x-patmi-origin-day'),
                    date,
                  ),
                );
              }
            }}
          />
        ))}
        {shown.date && hi >= lo && (
          <div
            className={
              'gantt-bar unified-task-bar ' +
              (t.status === 'done' ? 'task-done' : '')
            }
            style={{
              ...taskRangeStyle(
                p.showCheckIns === false ? { ...shown, checkins: [] } : shown,
                p.project?.color || '3',
                p.dates[lo],
                p.dates[hi],
              ),
              gridColumn: `${lo + 2} / ${hi + 3}`,
            }}
          >
            {offset >= 0 && (
              <button
                className="gantt-handle gantt-start"
                disabled={p.busy}
                aria-label={'调整 ' + t.title + ' 开始日期'}
                onPointerDown={(e) => begin(e, 'start')}
              />
            )}
            <button
              className="gantt-body"
              aria-label={`${t.title} · ${displayDate(span.start)}至${displayDate(span.end)}，编辑或拖动调整排期`}
              disabled={p.busy}
              onPointerDown={(e) => begin(e, 'move')}
              onClick={(e) => {
                if (e.detail === 0) p.onEdit(originalPlan(p.task));
              }}
              title={`${t.title} · ${displayDate(span.start)}–${displayDate(span.end)}${t.tracking ? ` · 原计划截止 ${displayDate(span.planEnd)} · 已打卡 ${t.checkins?.length || 0} 天` : ''}`}
              onKeyDown={(e) => {
                if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
                  e.preventDefault();
                  const plan = originalPlan(t);
                  p.onMove(
                    t,
                    changeTaskDates(
                      plan,
                      'move',
                      plan.date,
                      shift(
                        plan.date,
                        (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 7 : 1),
                      ),
                    ),
                  );
                }
              }}
            ></button>
            {t.rolledDays! > 0 && last <= hi && (
              <button
                className="gantt-handle gantt-end completion-handle"
                disabled={p.busy}
                aria-label={uiCopy.completionDatePrefix + t.title}
                title={uiCopy.completionDragHint}
                onPointerDown={(e) => begin(e, 'end', true)}
                onClick={(e) => {
                  if (e.detail === 0)
                    p.onEdit(originalPlan(t), t.completedOn || span.end);
                }}
                onKeyDown={(e) => {
                  if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.preventDefault();
                    p.onMove(
                      t,
                      completeByDrag(
                        t,
                        shift(
                          t.completedOn || span.end,
                          (e.key === 'ArrowLeft' ? -1 : 1) *
                            (e.shiftKey ? 7 : 1),
                        ),
                      ),
                    );
                  }
                }}
              />
            )}
            {planLast >= lo && planLast <= hi && (
              <button
                className="gantt-handle gantt-end"
                style={{
                  position: 'absolute',
                  left: `calc(${((planLast - lo + 1) / (hi - lo + 1)) * 100}% - 8px)`,
                  top: 0,
                  bottom: 0,
                }}
                disabled={p.busy}
                aria-label={'调整 ' + t.title + ' 结束日期'}
                onPointerDown={(e) => begin(e, 'end')}
              />
            )}
          </div>
        )}
        {checkins && (
          <>
            {checkInDates.map((date) => (
              <div
                key={'check:' + date}
                className="gantt-checkin-cell"
                style={{ gridColumn: p.dates.indexOf(date) + 2 }}
              >
                <DailyCheckIn
                  task={t}
                  date={date}
                  color={p.project?.color || '3'}
                />
              </div>
            ))}
          </>
        )}
      </div>
    </TaskMenu>
    </>
  );
}

export default memo(TaskTimelineRow);
