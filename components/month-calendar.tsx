'use client';
import { uiCopy } from '@/lib/ui-copy';
import type { MouseEvent, DragEvent } from 'react';
import { Plus } from 'lucide-react';
import type { Task, Project } from '@/lib/model';
import { monthWeeks } from '@/lib/calendar-views';
import { monthRibbons } from '@/lib/calendar-ribbons';
import { isCompletionDrag } from '@/lib/progress';
import { lastTaskDate } from '@/lib/task-scheduling';
import { taskRangeStyle } from '@/lib/task-appearance';
import { TaskMenu } from './task-menu';

export default function MonthCalendar({
  month,
  today,
  selected,
  range,
  tasks,
  projects,
  busy,
  onDay,
  onNew,
  onEdit,
  onDrop,
  rowHeight,
  displayMonth = month,
}: {
  month: string;
  today: string;
  selected: string;
  range: { start: string; end: string } | null;
  tasks: Task[];
  projects: Project[];
  busy: boolean;
  onDay: (date: string) => void;
  onNew: (date: string) => void;
  onEdit: (task: Task, date?: string) => void;
  onDrop: (event: DragEvent, date: string) => void;
  rowHeight?: number;
  displayMonth?: string;
}) {
  const weeks = monthWeeks(month);
  return (
    <section
      className="calendar month-page month-ribbon-page"
      data-month={month.slice(0, 7)}
      aria-label={`${Number(month.slice(0, 4))}年${Number(month.slice(5, 7))}月`}
    >
      {weeks.map((days) => {
        const { visible, hidden } = monthRibbons(
          tasks,
          days[0],
          days[6],
          rowHeight ? { height: rowHeight } : 3,
        );
        function dateAt(event: DragEvent | MouseEvent<HTMLElement>) {
          const row = event.currentTarget.closest('.month-ribbon-week')!;
          const rect = row.getBoundingClientRect();
          return days[
            Math.max(
              0,
              Math.min(
                6,
                Math.floor((event.clientX - rect.left) / (rect.width / 7)),
              ),
            )
          ];
        }
        return (
          <div
            className="month-ribbon-week ribbon-calendar"
            key={days[0]}
            data-week-start={days[0]}
            data-week-end={days[6]}
            onDragOver={(e) => {
              if (!busy) e.preventDefault();
            }}
            onDrop={(e) => {
              e.stopPropagation();
              onDrop(e, dateAt(e));
            }}
          >
            {days.map((date, i) => (
              <div
                key={date}
                className={
                  'daycell ' +
                  (date.slice(0, 7) !== displayMonth.slice(0, 7)
                    ? 'outside '
                    : '') +
                  (selected === date ? 'dayselected ' : '') +
                  (range && date >= range.start && date <= range.end
                    ? 'range-day'
                    : '')
                }
                style={{ gridColumn: i + 1, gridRow: 1 }}
                data-range-date={date}
                onDoubleClick={(e) => {
                  if (!(e.target as HTMLElement).closest('button')) onNew(date);
                }}
              >
                <div className="dayhead">
                  <button
                    className={date === today ? 'currentday' : ''}
                    onClick={() => onDay(date)}
                    aria-label={date + ' 查看日程'}
                  >
                    {date.endsWith('-01')
                      ? `${Number(date.slice(5, 7))}月1日`
                      : Number(date.slice(8))}
                  </button>
                  <button
                    className="dayadd"
                    disabled={busy}
                    aria-label={date + ' 新建任务'}
                    onClick={() => onNew(date)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {hidden[i] > 0 && (
                  <button
                    className="month-more"
                    onClick={() => onDay(date)}
                    aria-label={
                      date + ' 另有 ' + hidden[i] + ' 项任务，查看全部'
                    }
                  >
                    +{hidden[i]} 项
                  </button>
                )}
              </div>
            ))}
            {visible.map((r) => {
              const task = r.plan;
              const project = projects.find((p) => p.id === task.project);
              function drag(e: DragEvent<HTMLButtonElement>, edge = '') {
                e.dataTransfer.setData('text/plain', task.id);
                if (isCompletionDrag(r.current, dateAt(e), edge))
                  e.dataTransfer.setData('application/x-patmi-completion', '1');
                e.dataTransfer.setData(
                  'application/x-patmi-original',
                  task.calendarOriginal ? '1' : '0',
                );
                e.dataTransfer.setData(
                  'application/x-patmi-origin-day',
                  dateAt(e),
                );
                if (edge)
                  e.dataTransfer.setData('application/x-patmi-edge', edge);
                e.dataTransfer.effectAllowed = 'move';
              }
              return (
                <TaskMenu
                  key={task.id}
                  task={task}
                  date={days[r.lo]}
                  dateAt={dateAt}
                >
                  <div
                    className={
                      'tracked-ribbon month-task-ribbon' +
                      (r.start < days[0] ? ' continues-before' : '') +
                      (r.end > days[6] ? ' continues-after' : '')
                    }
                    data-task-id={task.id}
                    style={{
                      gridColumn: `${r.lo + 1} / ${r.hi + 2}`,
                      top: 27 + r.lane * 22,
                      ...taskRangeStyle(
                        r.current,
                        project?.color || '3',
                        days[r.lo],
                        days[r.hi],
                      ),
                    }}
                    title={`${task.title}${project ? ' · ' + project.title : ''} · ${r.start} 至 ${r.end}${task.time ? ' · ' + task.time : ''}${task.tracking && r.current.rolledDays ? ' · 自动顺延 ' + r.current.rolledDays + ' 天' : ''}`}
                  >
                    <button
                      className="tracked-ribbon-body"
                      title="拖动原计划调整排期；拖动顺延部分设置完成日期"
                      disabled={busy}
                      draggable={!busy}
                      onDragStart={(e) => drag(e)}
                      onClick={(e) =>
                        onEdit(task, e.detail ? dateAt(e) : days[r.lo])
                      }
                    >
                      <span className="tracked-ribbon-label">
                        <b className={task.status === 'done' ? 'strike' : ''}>
                          {task.time && <time>{task.time} </time>}
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
                    {task.date >= days[0] && task.date <= days[6] && (
                      <button
                        className="ribbon-handle ribbon-start"
                        disabled={busy}
                        draggable={!busy}
                        aria-label={'调整开始日期：' + task.title}
                        onDragStart={(e) => drag(e, 'start')}
                        onClick={(e) =>
                          onEdit(task, e.detail ? dateAt(e) : days[r.lo])
                        }
                      />
                    )}
                    {r.current.rolledDays! > 0 && r.end <= days[6] && (
                      <button
                        className="ribbon-handle ribbon-end completion-handle"
                        draggable={!busy}
                        disabled={busy}
                        aria-label={uiCopy.completionDatePrefix + task.title}
                        title={uiCopy.completionDragHint}
                        onDragStart={(e) => drag(e, 'completion')}
                        onClick={() => onEdit(task, r.end)}
                      />
                    )}
                    {lastTaskDate(task) >= days[0] &&
                      lastTaskDate(task) <= days[6] && (
                        <button
                          className="ribbon-handle ribbon-end"
                          style={{ left: `calc(${r.split}% - 8px)` }}
                          disabled={busy}
                          draggable={!busy}
                          aria-label={'调整结束日期：' + task.title}
                          onDragStart={(e) => drag(e, 'end')}
                          onClick={(e) =>
                            onEdit(task, e.detail ? dateAt(e) : days[r.lo])
                          }
                        />
                      )}
                  </div>
                </TaskMenu>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
