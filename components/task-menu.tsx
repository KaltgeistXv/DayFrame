'use client';
import { MenuColorPicker } from './color-preview';
import { uiCopy } from '@/lib/ui-copy';
import { Check, Pencil, History, Copy, CircleCheck, Flag, FolderInput, Tags, CalendarClock, Inbox, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { canCheckIn, taskDayState } from '@/lib/task-appearance';
import { colorStyle } from '@/lib/colors';
import { currentCalendarTask } from '@/lib/progress';
import {
  createContext,
  useContext,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuCheckboxItem,
} from '@/components/ui/context-menu';
import type { Task, Project, Label } from '@/lib/model';
import { withoutTime, moveByDate } from '@/lib/task-scheduling';
import { day, shift } from '@/lib/model';
import { statuses, priorities } from '@/lib/model';
type Actions = {
  projects: Project[];
  labels: Label[];
  busy: boolean;
  today: string;
  checkIn: (t: Task, date?: string) => void;
  toggleCheckIn: (t: Task, date: string) => void;
  edit: (t: Task, date?: string) => void;
  update: (t: Task, c: Partial<Task>) => void;
  remove: (ids: string[]) => void;
  duplicate: (t: Task) => void;
};
const Context = createContext<Actions | null>(null);
export function TaskActionsProvider({
  value,
  children,
}: {
  value: Actions;
  children: ReactNode;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
// Provider wires remove to workspace.askDelete: request confirmation only.
export function useTaskDeletionConfirmation() { return useContext(Context)?.remove; }
export function useWorkspaceToday() {
  return useContext(Context)?.today || day();
}
export function DailyCheckIn({
  task,
  date,
  color,
}: {
  task: Task;
  date: string;
  color: string;
}) {
  const a = useContext(Context);
  if (!a || !canCheckIn(task, date, a.today)) return null;
  const { checked, planned } = taskDayState(task, date);
  const completion = task.status === 'done' && task.completedOn === date;
  return (
    <button
      type="button"
      className={
        'daily-checkin ' +
        (checked ? 'is-checked ' : '') +
        (planned ? 'is-planned' : '')
      }
      style={checked ? colorStyle(color, planned ? 0.24 : 0.16) : undefined}
      disabled={a.busy || !canCheckIn(task, date, a.today)}
      aria-pressed={checked}
      aria-label={`${task.title} · ${date} · ${completion ? '查看完成日打卡记录' : checked ? '撤销当日打卡' : '打卡'}`}
      title={`${date} · ${completion ? '完成日 · 查看打卡记录' : checked ? '已打卡 · 点击撤销' : date > a.today ? '尚未到这一天' : '记录当天打卡'}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (completion) a.checkIn(task, date);
        else a.toggleCheckIn(task, date);
      }}
    >
      {checked && (
        <Check className="checkin-mark" size={10} strokeWidth={2.5} aria-hidden="true" />
      )}
    </button>
  );
}
export function TaskCheckInButton({ task }: { task: Task }) {
  const a = useContext(Context);
  if (!a || (!task.tracking && !task.checkins?.length)) return null;
  const recorded = task.checkins?.some((c) => c.date === a.today);
  return (
    <button
      type="button"
      className={'checkin-button ' + (recorded ? 'recorded' : '')}
      disabled={a.busy}
      title={task.title + ' · 查看或记录打卡'}
      onClick={() => a.checkIn(task)}
    >
      {task.status === 'done' || !canCheckIn(task, a.today, a.today)
        ? uiCopy.checkInRecords
        : recorded
          ? '✓ 今日已打卡'
          : uiCopy.checkInToday}
    </button>
  );
}
export function TaskMenu({
  task: inputTask,
  children,
  date,
  dateAt,
}: {
  task: Task;
  children: ReactElement;
  date?: string;
  dateAt?: (e: MouseEvent<HTMLElement>) => string | undefined;
}) {
  const [contextDate, setContextDate] = useState<string>();
  const task = currentCalendarTask(inputTask);
  const a = useContext(Context);
  if (!a) return children;
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={children}
        data-drag-title={task.title}
        data-drag-project={a.projects.find((p) => p.id === task.project)?.title}
        onContextMenuCapture={(e) => setContextDate(dateAt?.(e) || date)}
      />
      <ContextMenuContent className="shortcutmenu">
        <ContextMenuItem onClick={() => a.edit(task, contextDate || date)}>
          <Pencil aria-hidden="true" />{uiCopy.editTask}</ContextMenuItem>
        {(task.tracking || !!task.checkins?.length) && (
          <ContextMenuItem
            disabled={a.busy}
            onClick={() => a.checkIn(task, contextDate || date)}
          >
            <History aria-hidden="true" />{uiCopy.checkInRecords}</ContextMenuItem>
        )}
        <ContextMenuItem disabled={a.busy} onClick={() => a.duplicate(task)}>
          <Copy aria-hidden="true" />{uiCopy.duplicateTask}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger><CircleCheck aria-hidden="true" />{uiCopy.status}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {statuses.map(([id, title]) => (
              <ContextMenuItem
                key={id}
                disabled={a.busy}
                onClick={() => a.update(task, { status: id })}
              >
                {task.status === id && <Check className="menu-choice-check" aria-hidden="true" />}
                {title}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger><Flag aria-hidden="true" />{uiCopy.priority}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {priorities.map(([id, title]) => (
              <ContextMenuItem
                key={id}
                disabled={a.busy}
                onClick={() => a.update(task, { priority: id })}
              >
                {task.priority === id && <Check className="menu-choice-check" aria-hidden="true" />}
                {title}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger><FolderInput aria-hidden="true" />{uiCopy.project}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {[{ id: '', title: uiCopy.noProject }, ...a.projects].map((p) => (
              <ContextMenuItem
                key={p.id}
                disabled={a.busy}
                onClick={() => a.update(task, { project: p.id })}
              >
                {p.id === task.project && <Check className="menu-choice-check" aria-hidden="true" />}
                {p.title}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        {a.labels.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger><Tags aria-hidden="true" />{uiCopy.tags}</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {a.labels.map((l) => (
                <ContextMenuCheckboxItem
                  key={l.id}
                  disabled={a.busy}
                  checked={task.tags?.includes(l.id) || false}
                  onCheckedChange={(v) =>
                    a.update(task, {
                      tags: v
                        ? [...(task.tags || []), l.id]
                        : (task.tags || []).filter((id) => id !== l.id),
                    })
                  }
                >
                  {l.title}
                </ContextMenuCheckboxItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuSub>
          <ContextMenuSubTrigger><CalendarClock aria-hidden="true" />{uiCopy.schedule}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              disabled={a.busy}
              title="移动到今天，保留排期跨度"
              onClick={() => a.update(task, moveByDate(task, task.date, day()))}
            >
              {uiCopy.moveToday}</ContextMenuItem>
            <ContextMenuItem
              disabled={a.busy}
              title="移动到明天，保留排期跨度"
              onClick={() =>
                a.update(task, moveByDate(task, task.date, shift(day(), 1)))
              }
            >
              {uiCopy.moveTomorrow}</ContextMenuItem>
            <ContextMenuItem
              title="保留日期，清除具体时间"
              disabled={a.busy || !task.date || !task.time}
              onClick={() => a.update(task, withoutTime(task))}
            >
              {uiCopy.setAllDay}</ContextMenuItem>
            <ContextMenuItem onClick={() => a.edit(task)}>
              {uiCopy.customSchedule}</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem
          disabled={a.busy}
          title={uiCopy.cancelScheduleHint}
          onClick={() => a.update(task, { date: '', time: '' })}
        >
          <Inbox aria-hidden="true" />{uiCopy.cancelSchedule}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          disabled={a.busy}
          onClick={() => a.remove([task.id])}
        >
          <Trash2 aria-hidden="true" />{uiCopy.deleteTask}</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
export function ItemMenu({
  children,
  edit,
  remove,
  up,
  down,
  color,
  onColorChange,
  busy,
}: {
  children: ReactElement;
  edit: () => void;
  remove: () => void;
  up?: () => void;
  down?: () => void;
  color?: string;
  onColorChange?: (color: string) => void;
  busy?: boolean;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={children} />
      <ContextMenuContent>
        {color !== undefined && onColorChange && <MenuColorPicker value={color} onChange={onColorChange} disabled={busy} />}
        <ContextMenuItem onClick={edit}><Pencil aria-hidden="true" />{uiCopy.edit}</ContextMenuItem>
        {up && <ContextMenuItem onClick={up}><ArrowUp aria-hidden="true" />上移</ContextMenuItem>}
        {down && <ContextMenuItem onClick={down}><ArrowDown aria-hidden="true" />下移</ContextMenuItem>}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={remove}>
          删除…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
