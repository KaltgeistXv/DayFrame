'use client';
import { uiCopy } from '@/lib/ui-copy';
import { ViewToolbar } from './ui/view-toolbar';
import {
  GanttDateControls,
  GanttDetailToggle,
  useGanttDetails,
  GanttHeader,
  GANTT_CELL_WIDTH,
} from '@/components/gantt-view';
import { useContinuousDays } from '@/hooks/use-continuous-days';
import {
  Fragment,
  useEffect,
  useCallback,
  useRef,
  useState,
  type PointerEvent as PE,
} from 'react';
import { Plus, Undo2 } from 'lucide-react';
import { day, shift, type Project, type Task } from '@/lib/model';
import { colorStyle } from '@/lib/colors';
import {
  changeProjectRange,
  ganttDayIndex,
  rangeDays,
  type GanttAction,
} from '@/lib/gantt-interactions';
import { moveByDate } from '@/lib/task-scheduling';
import { originalPlan } from '@/lib/progress';
import TaskTimelineRow from '@/components/task-timeline-row';
import GanttGroupHeader from './gantt-group-header';
import GanttCollapseControl from './gantt-collapse-control';
import { useGanttCollapse } from '@/hooks/use-gantt-collapse';
import { ItemMenu } from '@/components/task-menu';
type Props = {
  toolbarStart?: React.ReactNode;
  toolbarBelow?: React.ReactNode;
  projects: Project[];
  tasks: Task[];
  onEditTask: (t: Task, date?: string) => void;
  onMoveTask: (t: Task, c: Partial<Task>) => void;
  onBatchMoveTasks?: (tasks: Task[]) => Promise<void>;
  onOrderTask?: (id: string, target: string, after?: boolean) => void;
  onNewTask?: (project: string, date?: string) => void;
  busy: boolean;
  onNew: (date?: string, end?: string) => void;
  onEditProject: (p: Project) => void;
  onSaveProject: (p: Project) => void | Promise<boolean>;
  onDeleteProject: (p: Project) => void;
};
type Drag = {
  project: Project;
  action: GanttAction;
  origin: string;
  x: number;
  y: number;
  active: boolean;
  valid: boolean;
  next: Project;
  fresh: boolean;
};
const LABEL = 220;
export default function ProjectGantt(p: Props) {
  const showDetails = useGanttDetails();
  const timeline = useContinuousDays(day(), GANTT_CELL_WIDTH, 63, 21);
  const { start: anchor, dates } = timeline;
  const DAYS = dates.length;
  const [drag, setDrag] = useState<Drag | null>(null),
    [pending, setPending] = useState<Project | null>(null),
    [undo, setUndo] = useState<{ before: Project; after: Project } | null>(
      null,
    ),
    [error, setError] = useState('');
  const [collapsed, setCollapsed] = useGanttCollapse(p.busy || !!drag || !!pending);
  const root = useRef<HTMLDivElement>(null),
    grid = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    current = useRef<Drag | null>(null),
    pointer = useRef<{ x: number; y: number } | null>(null),
    frame = useRef(0),
    capture = useRef<number | null>(null);

  const timelineRef = timeline.ref;
  const scrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      scroll.current = node;
      timelineRef(node);
    },
    [timelineRef],
  );
  function cancel() {
    current.current = null;
    pointer.current = null;
    setDrag(null);
    cancelAnimationFrame(frame.current);
    const id = capture.current;
    capture.current = null;
    if (id !== null && root.current?.hasPointerCapture(id))
      root.current.releasePointerCapture(id);
  }
  useEffect(() => {
    const stop = () => cancel(),
      key = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && current.current) {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }
      };
    window.addEventListener('blur', stop);
    window.addEventListener('keydown', key, true);
    return () => {
      cancelAnimationFrame(frame.current);
      window.removeEventListener('blur', stop);
      window.removeEventListener('keydown', key, true);
    };
  }, []);
  function dateAt(x: number) {
    const r = grid.current!.getBoundingClientRect(),
      width = GANTT_CELL_WIDTH;
    return shift(
      grid.current!.dataset.start!,
      ganttDayIndex(
        x,
        r.left,
        LABEL,
        width,
        Number(grid.current!.dataset.count),
      ),
    );
  }
  function update(x: number, y: number) {
    const g = current.current,
      area = scroll.current;
    if (!g || !area) return;
    const r = area.getBoundingClientRect(),
      valid =
        x >= r.left + LABEL && x <= r.right && y >= r.top && y <= r.bottom;
    const next = {
      ...g,
      valid,
      active: g.active || Math.hypot(x - g.x, y - g.y) > 4,
      next: changeProjectRange(g.project, g.action, g.origin, dateAt(x)),
    };
    current.current = next;
    setDrag(next);
  }
  function autoScroll() {
    const tick = () => {
      const pt = pointer.current,
        area = scroll.current;
      if (!pt || !current.current || !area) return;
      const r = area.getBoundingClientRect();
      if (
        pt.y >= r.top &&
        pt.y <= r.bottom &&
        pt.x >= r.left + LABEL &&
        pt.x <= r.right
      ) {
        const dx =
          pt.x < r.left + LABEL + 32 ? -10 : pt.x > r.right - 32 ? 10 : 0;
        if (dx) {
          area.scrollLeft += dx;
          update(pt.x, pt.y);
        }
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }
  function begin(e: PE, project: Project, action: GanttAction, fresh = false) {
    if (
      p.busy ||
      pending ||
      e.button !== 0 ||
      (!fresh &&
        project.scheduleMode !== 'manual' &&
        !(action === 'move' && project.start && p.onBatchMoveTasks))
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    cancel();
    const origin = dateAt(e.clientX),
      next = changeProjectRange(project, action, origin, origin),
      g = {
        project,
        action,
        origin,
        next,
        x: e.clientX,
        y: e.clientY,
        active: false,
        valid: true,
        fresh,
      };
    current.current = g;
    setDrag(g);
    pointer.current = { x: e.clientX, y: e.clientY };
    root.current?.setPointerCapture(e.pointerId);
    capture.current = e.pointerId;
    autoScroll();
  }
  async function save(next: Project, before: Project, record = true) {
    setError('');
    setPending(next);
    try {
      if (
        before.scheduleMode !== 'manual' &&
        p.onBatchMoveTasks &&
        before.start &&
        next.start
      ) {
        const children = p.tasks.filter(
          (task) => task.project === before.id && task.date,
        );
        if (children.length)
          await p.onBatchMoveTasks(
            children.map((task) =>
              moveByDate(originalPlan(task), before.start!, next.start!),
            ),
          );
        return;
      }
      const ok = await p.onSaveProject(next);
      if (ok === false) throw Error('日期未保存，请重试。');
      if (record) setUndo({ before, after: next });
      else setUndo(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  }
  function finish(e: PE) {
    if (!current.current) return;
    update(e.clientX, e.clientY);
    const g = current.current;
    cancel();
    if (!g.valid) return;
    if (g.fresh) {
      p.onNew(g.next.start, g.next.end);
      return;
    }
    if (!g.active && g.action !== 'range') {
      p.onEditProject(g.project);
      return;
    }
    if (g.next.start !== g.project.start || g.next.end !== g.project.end)
      void save(g.next, g.project);
  }
  const undoCurrent =
    undo &&
    p.projects.find(
      (x) =>
        x.id === undo.after.id &&
        x.start === undo.after.start &&
        x.end === undo.after.end,
    );
  const blank: Project = {
    id: '',
    title: '新项目',
    description: '',
    color: '0',
  };
  return (
    <div
      className={
        'tracking project-gantt gantt-workspace ' +
        (drag?.active ? 'gantt-dragging' : '')
      }
      ref={root}
      onPointerMove={(e) => {
        if (current.current) {
          pointer.current = { x: e.clientX, y: e.clientY };
          update(e.clientX, e.clientY);
        }
      }}
      onPointerUp={finish}
      onPointerCancel={cancel}
      onLostPointerCapture={() => {
        if (current.current) cancel();
      }}
    >
      <div className="periodbar gantt-toolbar">
        <ViewToolbar className="gantt-actions">
          {p.toolbarStart}
          <GanttCollapseControl
            groupIds={p.projects.map((project) => project.id)}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            disabled={p.busy || !!drag || !!pending}
          />
          {undoCurrent && (
            <button
              className="subtle"
              disabled={p.busy || !!pending}
              onClick={() => {
                if (undo && undoCurrent)
                  void save(
                    {
                      ...undoCurrent,
                      start: undo.before.start,
                      end: undo.before.end,
                    },
                    undo.after,
                    false,
                  );
              }}
            >
              <Undo2 size={14} />
              撤销改期
            </button>
          )}
          <GanttDetailToggle />
          <GanttDateControls
            value={timeline.visible}
            today={day()}
            onChange={timeline.jump}
            onMove={timeline.move}
            disabled={p.busy || !!drag || !!pending}
          />
        </ViewToolbar>
      </div>
      {p.toolbarBelow}
      <div
        className="gantt-scroll continuous-timeline"
        data-edge-scroll="220"
        ref={scrollRef}
        style={timeline.style}
      >
        <div
          className="gantt-grid"
          ref={grid}
          data-start={anchor}
          data-count={DAYS}
        >
          <GanttHeader
            dates={timeline.dates}
            today={day()}
            label="项目与任务"
          />
          {p.projects.map((stored) => {
            const project = stored;
            const tasks = p.tasks
              .filter((t) => t.project === project.id)
              .sort((a, b) => (a.position || 0) - (b.position || 0));
            return (
              <Fragment key={project.id}>
                <ItemMenu color={project.color} busy={p.busy} onColorChange={color => void p.onSaveProject({ ...project, color })} edit={() => p.onEditProject(project)} remove={() => p.onDeleteProject(project)}>
                <GanttGroupHeader
                dates={timeline.dates}
                today={day()}
                  project={project}
                  tasks={tasks}
                  collapsed={collapsed.includes(project.id)}
                  busy={p.busy}
                  onToggle={() =>
                    setCollapsed((ids) =>
                      ids.includes(project.id)
                        ? ids.filter((id) => id !== project.id)
                        : [...ids, project.id],
                    )
                  }
                  onNew={
                    p.onNewTask ? () => p.onNewTask?.(project.id) : undefined
                  }
                />
                </ItemMenu>
                {!collapsed.includes(project.id) &&
                  tasks.map((task, i) => (
                    <TaskTimelineRow
                      showCheckIns={showDetails}
                      key={task.id}
                      task={task}
                      project={project}
                      showProject={false}
                      dates={dates}
                      busy={p.busy}
                      onEdit={p.onEditTask}
                      onMove={p.onMoveTask}
                      onOrder={(id, target, after) => {
                        if (tasks.some((t) => t.id === id))
                          p.onOrderTask?.(id, target, after);
                      }}
                      previous={tasks[i - 1]?.id}
                      next={tasks[i + 1]?.id}
                    />
                  ))}
              </Fragment>
            );
          })}
          <div className="gantt-row gantt-new">
            <button className="gantt-name" onClick={() => p.onNew(day())}>
              <Plus size={15} />
              {uiCopy.newProject}</button>
            {dates.map((d, i) => (
              <button
                key={d}
                className="gantt-cell"
                style={{ gridColumn: i + 2 }}
                disabled={p.busy}
                aria-label={d + ' 新建项目'}
                onPointerDown={(e) => begin(e, blank, 'range', true)}
                onClick={(e) => {
                  if (e.detail === 0) p.onNew(d, d);
                }}
              >
                +
              </button>
            ))}
            {drag?.fresh && (
              <div
                className="gantt-bar gantt-preview"
                style={{
                  ...colorStyle('0'),
                  gridColumn: `${Math.max(0, (Date.parse(drag.next.start!) - Date.parse(anchor)) / 86400000) + 2} / ${Math.min(DAYS - 1, (Date.parse(drag.next.end!) - Date.parse(anchor)) / 86400000) + 3}`,
                }}
              >
                新项目
              </div>
            )}
          </div>
        </div>
      </div>
      <output className="gantt-status">
        {error ||
          (pending
            ? uiCopy.saving
            : drag
              ? drag.valid
                ? `${drag.next.start} — ${drag.next.end} · ${rangeDays(drag.next.start!, drag.next.end!)} 天 · 松开保存，Esc 取消`
                : '移出计划区域，松开取消'
              : '')}
      </output>
    </div>
  );
}
