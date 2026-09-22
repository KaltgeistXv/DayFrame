'use client';
import { uiCopy } from '@/lib/ui-copy';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { Task, Project } from '@/lib/model';
export default function GanttGroupHeader({
  project,
  tasks,
  collapsed,
  onToggle,
  onNew,
  busy,
  dates = [],
  today,
}: {
  project?: Project;
  tasks: Task[];
  collapsed: boolean;
  onToggle: () => void;
  onNew?: () => void;
  busy?: boolean;
  dates?: string[];
  today?: string;
}) {
  const title = project?.title || uiCopy.noProject;
  const done = tasks.filter((t) => t.status === 'done').length;
  return (
    <div className="gantt-row gantt-group-header">
      <div className="gantt-group-identity">
      <button
        className="gantt-group-toggle"
        aria-expanded={!collapsed}
        aria-label={(collapsed ? '展开' : '折叠') + title}
        onClick={onToggle}
      >
        <strong title={`${title} · 已完成 ${done}/${tasks.length}`}>{title}</strong>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>
      {onNew && <button className="iconbtn gantt-group-add" disabled={busy} onClick={onNew} aria-label={uiCopy.newTask} title={uiCopy.newTask}>
        <Plus size={14} />
      </button>}
      </div>
      {dates.map((date, index) => (
        <span key={date} aria-hidden="true" className={'gantt-cell gantt-group-cell ' + (date === today ? 'gantt-today' : '')} style={{ gridColumn: index + 2 }} />
      ))}
    </div>
  );
}
