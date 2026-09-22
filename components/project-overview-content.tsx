'use client';

import type { CSSProperties } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Folder, Label, Project, Task } from '@/lib/model';
import { projectSchedule } from '@/lib/progress';
import { displayDate } from '@/lib/calendar-date';
import { colorHex } from '@/lib/colors';
import { uiCopy } from '@/lib/ui-copy';
import { Progress } from './ui/progress';

type Props = {
  project: Project;
  tasks: Task[];
  folders: Folder[];
  labels: Label[];
  onOpen: () => void;
};

export function ProjectOverviewContent({ project, tasks, folders, labels, onOpen }: Props) {
  const items = tasks.filter((task) => task.project === project.id);
  const done = items.filter((task) => task.status === 'done').length;
  const percent = items.length ? Math.round(done / items.length * 100) : 0;
  const range = projectSchedule(project, tasks);
  const end = range.end || range.start || '';
  const dates = range.start
    ? displayDate(range.start) + (end !== range.start ? `–${displayDate(end)}` : '')
    : uiCopy.unplanned;

  return (
    <>
      <div className="project-overview-heading">
          <button type="button" className="projecttitle" onClick={onOpen}>
            <span>{project.title}</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
          <div className="projectmetadata">
            <span>{folders.find((folder) => folder.id === project.folder)?.title || uiCopy.uncategorized}</span>
            {(project.tags || []).map((id) => {
              const label = labels.find((label) => label.id === id);
              return label ? <span key={id} className={'pill tag-badge color' + label.color}>#{label.title}</span> : null;
            })}
          </div>
          {project.description && <p className="project-overview-description" title={project.description}>{project.description}</p>}
      </div>
      <div className="project-overview-details">
        <div className="project-overview-completion">
          <span>{items.length ? `已完成 ${done}/${items.length}` : uiCopy.noTasks}</span>
          <strong>{percent}<span>%</span></strong>
        </div>
        <Progress value={percent} style={{ '--progress-color': colorHex(project.color) } as CSSProperties} aria-label={project.title + uiCopy.completionProgress} />
        <div className="project-overview-schedule" title={project.scheduleMode === 'manual' ? uiCopy.manualSchedule : uiCopy.autoSchedule}>
          <span>{dates}</span>
        </div>
      </div>
    </>
  );
}
