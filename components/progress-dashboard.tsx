'use client';
import { uiCopy } from '@/lib/ui-copy';
import { ViewToolbar } from './ui/view-toolbar';
import { Fragment, useMemo, useState } from 'react';
import {
  GanttDateControls,
  GanttDetailToggle,
  useGanttDetails,
  GanttHeader,
  GANTT_CELL_WIDTH,
} from '@/components/gantt-view';
import { useContinuousDays } from '@/hooks/use-continuous-days';
import type { Task, Project } from '@/lib/model';
import { progressOf } from '@/lib/progress';
import { trackingMatches } from '@/lib/task-appearance';
import TaskTimelineRow from './task-timeline-row';
import GanttGroupHeader from './gantt-group-header';
import GanttCollapseControl from './gantt-collapse-control';
import { useGanttCollapse } from '@/hooks/use-gantt-collapse';
import { ganttGroups } from '@/lib/gantt-groups';

type Props = {
  toolbarStart?: React.ReactNode;
  toolbarBelow?: React.ReactNode;
  tasks: Task[];
  projects: Project[];
  today: string;
  busy: boolean;
  initialScope?: string;
  scope?: string;
  onEdit: (task: Task, date?: string) => void;
  onMove: (task: Task, changes: Partial<Task>) => void;
  onOrder?: (id: string, target: string, after?: boolean) => void;
};
export default function ProgressDashboard(p: Props) {
  const showDetails = useGanttDetails();
  const [scope, setScope] = useState(p.initialScope || 'tracked');
  const timeline = useContinuousDays(p.today, GANTT_CELL_WIDTH, 63, 21);
  const { ref: timelineRef } = timeline;
  const [collapsed, setCollapsed] = useGanttCollapse(p.busy);
  const visible = useMemo(
    () =>
      p.scope ? p.tasks : p.tasks.filter((t) => trackingMatches(t, scope)),
    [p.scope, p.tasks, scope],
  );
  const groups = useMemo(
    () =>
      ganttGroups(visible, p.projects).map((group) => ({
        ...group,
        taskIds: new Set(group.tasks.map((t) => t.id)),
      })),
    [visible, p.projects],
  );
  const active = visible.filter((t) => t.tracking && t.status !== 'done');
  const delayed = active.filter((t) => progressOf(t, p.today).late > 0);
  return (
    <div className="progress-dashboard unified-gantt gantt-workspace">
      <div className="progress-toolbar">
        {!p.scope && (
          <div className="progress-tabs" aria-label="任务追踪范围">
            {[
              ['tracked', uiCopy.tracking],
              ['all', uiCopy.allTasks],
              ['untracked', '普通任务'],
            ].map(([id, title]) => (
              <button
                key={id}
                aria-pressed={scope === id}
                onClick={() => setScope(id)}
              >
                {title}
              </button>
            ))}
          </div>
        )}
        <ViewToolbar className="gantt-actions">
          {p.toolbarStart}
          <GanttCollapseControl
            groupIds={groups.map((group) => group.id)}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            disabled={p.busy}
          />
          <GanttDetailToggle />
          <GanttDateControls
            value={timeline.visible}
            today={p.today}
            onChange={timeline.jump}
            onMove={timeline.move}
            disabled={p.busy}
          />
        </ViewToolbar>
      </div>
      {p.toolbarBelow}
      <div className="tracking-legend">
        {delayed.length > 0 && (
          <span className="delay-text">{delayed.length} 项延期</span>
        )}
        <span>
          <i className="legend-plan" />
          原计划
        </span>
        <span>
          <i className="legend-rollover" />
          自动顺延
        </span>
        {showDetails && <>
        <span>
          <i className="legend-checked" />
          已打卡
        </span>
        <span>
          <i className="legend-plan-checked" />
          原计划已打卡
        </span>
        <span>
          <i className="legend-unchecked" />
          未打卡
        </span>
        </>}
      </div>
      <div
        className="gantt-scroll continuous-timeline"
        data-edge-scroll="220"
        ref={timelineRef}
        style={timeline.style}
      >
        <div className="gantt-grid">
          <GanttHeader
            dates={timeline.dates}
            today={p.today}
            label="任务"
          />
          {groups.map((group) => (
            <Fragment key={group.id}>
              <GanttGroupHeader
                dates={timeline.dates}
                today={p.today}
                project={group.project}
                tasks={group.tasks}
                collapsed={collapsed.includes(group.id)}
                onToggle={() =>
                  setCollapsed((ids) =>
                    ids.includes(group.id)
                      ? ids.filter((id) => id !== group.id)
                      : [...ids, group.id],
                  )
                }
              />
              {!collapsed.includes(group.id) &&
                group.tasks.map((task, i) => (
                  <TaskTimelineRow
                    key={task.id}
                    task={task}
                    project={group.project}
                    showProject={false}
                    dates={timeline.dates}
                    busy={p.busy}
                    onEdit={p.onEdit}
                    onMove={p.onMove}
                    onOrder={p.onOrder}
                    orderTaskIds={group.taskIds}
                    previous={group.tasks[i - 1]?.id}
                    next={group.tasks[i + 1]?.id}
                    showCheckIns={showDetails}
                  />
                ))}
            </Fragment>
          ))}
        </div>
      </div>
      {!visible.length && (
        <div className="empty">
          <p>{uiCopy.noTaskResults}</p>
        </div>
      )}
    </div>
  );
}
