'use client';
import { uiCopy } from '@/lib/ui-copy';
import type { CSSProperties } from 'react';
import { Plus } from 'lucide-react';
import type { Project, Task, Folder, Label } from '@/lib/model';
import { projectSchedule } from '@/lib/progress';
import { displayDate } from '@/lib/calendar-date';
import { colorHex } from '@/lib/colors';
import { Progress } from './ui/progress';
import { ItemMenu } from './task-menu';

type Props = {
  view: 'list' | 'board';
  collapsed?: string[];
  onToggleGroup?: (status: string) => void;
  projects: Project[];
  tasks: Task[];
  folders: Folder[];
  labels: Label[];
  onOpen: (id: string) => void;
  onEdit: (project: Project) => void;
  onColorChange: (project: Project, color: string) => void;
  busy: boolean;
  onDelete: (project: Project) => void;
  onNew: () => void;
};
const columns = [
  ['todo', '待开始'],
  ['doing', '进行中'],
  ['done', '已完成'],
] as const;
export default function ProjectCollection(p: Props) {
  const entries = p.projects.map((project) => {
    const tasks = p.tasks.filter((t) => t.project === project.id);
    const done = tasks.filter((t) => t.status === 'done').length;
    const status =
      tasks.length && done === tasks.length
        ? 'done'
        : tasks.some((t) => t.status === 'doing') || done > 0
          ? 'doing'
          : 'todo';
    return {
      project,
      total: tasks.length,
      done,
      status,
      range: projectSchedule(project, p.tasks),
    };
  });
  function item(entry: (typeof entries)[number]) {
    const { project, total, done, status, range } = entry;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return (
      <ItemMenu
        key={project.id}
        color={project.color}
        busy={p.busy}
        onColorChange={color => p.onColorChange(project, color)}
        edit={() => p.onEdit(project)}
        remove={() => p.onDelete(project)}
      >
        <article className="project-summary">
          <div className="project-summary-identity">
            <button
              className="project-summary-title"
              onClick={() => p.onOpen(project.id)}
            >
              {project.title}
            </button>
            <div className="project-summary-meta">
              <span>
                {p.folders.find((f) => f.id === project.folder)?.title ||
                  uiCopy.uncategorized}
              </span>
              {(project.tags || []).map((id) => {
                const label = p.labels.find((l) => l.id === id);
                return label ? (
                  <span
                    className={'pill tag-badge color' + label.color}
                    key={id}
                  >
                    #{label.title}
                  </span>
                ) : null;
              })}
            </div>
          </div>
          <span className="project-summary-status">
            <span className={'statusdot ' + status} />
            {columns.find(([id]) => id === status)?.[1]}
          </span>
          <span className="project-summary-date">
            {range.start
              ? `${displayDate(range.start)}–${displayDate(range.end || range.start)}`
              : uiCopy.unplanned}
          </span>
          <div className="project-summary-progress">
            <span>
              已完成 {done}/{total}
              <span>{percent}%</span>
            </span>
            <Progress
              value={percent}
              style={
                { '--progress-color': colorHex(project.color) } as CSSProperties
              }
              aria-label={project.title + uiCopy.completionProgress}
            />
          </div>
        </article>
      </ItemMenu>
    );
  }
  return (
    <>
      {p.view === 'board' ? (
        <div className="board project-board">
          {columns.map(([status, title]) => (
            <section
              className="column"
              key={status}
              aria-label={title + '项目'}
            >
              <div
                className="columnhead"
                title="根据项目内任务的完成情况自动分组"
              >
                <span className={'statusdot ' + status} />
                <button className="group-disclosure" aria-expanded={!p.collapsed?.includes(status)} onClick={() => p.onToggleGroup?.(status)}>
                  {title}<small>{entries.filter(e => e.status === status).length}</small>
                </button>
              </div>
              <div className="group-content" hidden={p.collapsed?.includes(status)}>
              {entries.filter((e) => e.status === status).map(item)}
              {!entries.some((e) => e.status === status) && (
                <p className="project-collection-empty">暂无{title}项目</p>
              )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="project-list">
          {entries.map(item)}
          {!entries.length && (
            <p className="project-collection-empty">{uiCopy.noProjectResults}</p>
          )}
        </div>
      )}
      <button
        className="inline-create-action project-collection-create"
        onClick={p.onNew}
      >
        <Plus size={14} />
        {uiCopy.newProject}</button>
    </>
  );
}
