'use client';
import { uiCopy } from '@/lib/ui-copy';
import { ViewToolbar } from './ui/view-toolbar';
import GanttCollapseControl from './gantt-collapse-control';
import { useGanttCollapse } from '@/hooks/use-gantt-collapse';
import { displayDate } from '@/lib/calendar-date';

import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { DateStepControls } from './ui/date-step-controls';
import type { Task, Project } from '@/lib/model';
import {
  activityByDay,
  heatmapLevel,
  heatmapYear,
  heatmapGroups,
} from '@/lib/activity-heatmap';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

type Props = {
  toolbarStart?: React.ReactNode;
  toolbarBelow?: React.ReactNode;
  tasks: Task[];
  projects: Project[];
  today: string;
  onEdit: (task: Task, date?: string) => void;
  project?: Project;
  groupByProject?: boolean;
};

export default function ActivityHeatmap({
  tasks,
  projects,
  today,
  onEdit,
  project,
  groupByProject = false,
  toolbarStart,
  toolbarBelow,
}: Props) {
  const [collapsed, setCollapsed] = useGanttCollapse();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [mode, setMode] = useState('all');
  const showProjects = !project && (groupByProject || mode === 'projects');
  const [selected, setSelected] = useState<{
    group: string;
    date: string;
  } | null>(null);
  const cells = useMemo(() => heatmapYear(year), [year]);
  const groups = useMemo(
    () =>
      heatmapGroups(tasks, projects, {
        projectId: project?.id,
        groupByProject: showProjects,
      }).map((group) => ({
        ...group,
        activity: activityByDay(group.tasks, today),
      })),
    [tasks, projects, today, project, showProjects],
  );
  const columns = cells.length / 7;
  function changeYear(next: number) {
    setYear(next);
    setSelected(null);
  }
  return (
    <section className="activity-heatmap" aria-label="任务记录热力图">
      <ViewToolbar className="heatmap-toolbar">
        {toolbarStart}
        <GanttCollapseControl groupIds={groups.map(g => g.id)} collapsed={collapsed} setCollapsed={setCollapsed} subject="热力图分组" />
        {!project && !groupByProject && (
          <Select
            value={mode}
            onValueChange={(value) => {
              setMode(value === 'projects' ? 'projects' : 'all');
              setSelected(null);
            }}
          >
            <SelectTrigger className="scope-control" aria-label="热力图范围">
              <SelectValue>{showProjects ? '按项目' : uiCopy.allTasks}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{uiCopy.allTasks}</SelectItem>
              <SelectItem value="projects">按项目</SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="heatmap-years">
          <strong aria-live="polite">{year} 年</strong>
          <DateStepControls
            previousLabel="上一年" nextLabel="下一年" currentLabel="今年"
            previousDisabled={year <= 1} nextDisabled={year >= currentYear}
            onPrevious={() => changeYear(year - 1)} onCurrent={() => changeYear(currentYear)} onNext={() => changeYear(year + 1)}
          />
        </div>
      </ViewToolbar>
      {toolbarBelow}
      {!groups.length && (
        <div className="heatmap-empty content-empty content-empty-panel">
          暂无记录
        </div>
      )}
      {groups.map((group) => {
        const entries = [...group.activity].filter(
          ([date]) => Number(date.slice(0, 4)) === year,
        );
        const total = entries.reduce((sum, [, items]) => sum + items.length, 0);
        const picked = selected?.group === group.id ? selected.date : '';
        const pickedTasks = group.activity.get(picked) || [];
        return (
          <article className="heatmap-card" key={group.id}>
            <header>
              <h3><button className="group-disclosure" aria-expanded={!collapsed.includes(group.id)} onClick={() => setCollapsed(ids => ids.includes(group.id) ? ids.filter(id => id !== group.id) : [...ids, group.id])}>{group.title}</button></h3>
              <span>
                累计 <b>{total}</b> 项次 <em>·</em> 有记录{' '}
                <b>{entries.length}</b> 天
              </span>
            </header>
            <div className="group-content" hidden={collapsed.includes(group.id)}>
            <div className="heatmap-scroll">
              <div
                className="heatmap-calendar"
                style={{ '--heatmap-columns': columns } as CSSProperties}
              >
                <div className="heatmap-months" aria-hidden="true">
                  {cells.map(
                    (date, i) =>
                      date?.endsWith('-01') && (
                        <span
                          key={date}
                          style={{ gridColumn: Math.floor(i / 7) + 1 }}
                        >
                          {Number(date.slice(5, 7))}月
                        </span>
                      ),
                  )}
                </div>
                <div className="heatmap-weekdays" aria-hidden="true">
                  {['一', '', '三', '', '五', '', '日'].map((name, i) => (
                    <span key={i}>{name}</span>
                  ))}
                </div>
                <div className="heatmap-days">
                  {cells.map((date, i) => {
                    if (!date)
                      return (
                        <span key={`blank-${i}`} className="heatmap-blank" />
                      );
                    const count = group.activity.get(date)?.length || 0;
                    const future = date > today;
                    const label = `${displayDate(date)}：${future ? '尚未到来' : `${count} 项任务有记录`}`;
                    return (
                      <button
                        key={date}
                        data-level={heatmapLevel(count)}
                        data-future={future || undefined}
                        aria-label={label}
                        title={label}
                        aria-pressed={picked === date}
                        aria-current={date === today ? 'date' : undefined}
                        disabled={future}
                        onClick={() => setSelected({ group: group.id, date })}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            {total === 0 && <p className="heatmap-no-activity">本年暂无记录</p>}
            {picked && (
              <div className="heatmap-detail" aria-live="polite">
                <div className="heatmap-detail-heading">
                  <strong>
                    {displayDate(picked)} · {pickedTasks.length} 项任务
                  </strong>
                  <button
                    aria-label="收起当天记录"
                    onClick={() => setSelected(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
                {pickedTasks.length ? (
                  <div className="heatmap-task-list">
                    {pickedTasks.map((task) => (
                      <button
                        key={task.id}
                        className="ui-interactive-row ui-interactive-row--compact"
                        onClick={() => onEdit(task, picked)}
                      >
                        <span>
                          {task.title}
                          <small>
                            {
                              projects.find(
                                (project) => project.id === task.project,
                              )?.title
                            }
                          </small>
                        </span>
                        <span className="heatmap-task-status">
                          {task.status === 'done' && task.completedOn === picked
                            ? '当天完成'
                            : '已打卡'}
                          <ChevronRight size={14} />
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>当天暂无记录</p>
                )}
              </div>
            )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
