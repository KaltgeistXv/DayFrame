'use client';
import { uiCopy } from '@/lib/ui-copy';
import { matchesTaskFocus } from '@/lib/navigation-policy';
import { displayDate } from '@/lib/calendar-date';
import { ArrowUpRight, Plus } from 'lucide-react';
import type { CSSProperties } from 'react';
import { colorHex } from '@/lib/colors';
import type { Task, Project } from '@/lib/model';
import { defaultHomeLayout, type HomeCard } from '@/lib/home-layout';
import { lastTaskDate } from '@/lib/task-scheduling';
import { progressOf, projectSchedule } from '@/lib/progress';
import { checkInStats } from '@/lib/checkins';
import { TaskMenu, TaskCheckInButton } from './task-menu';
import ProjectBadge from './project-badge';
import { Checkbox } from './ui/checkbox';
import { Progress } from './ui/progress';

type Props = {
  tasks: Task[];
  projects: Project[];
  today: string;
  busy: boolean;
  query: string;
  onEdit: (t: Task) => void;
  onUpdate: (t: Task, changes: Partial<Task>) => void;
  onNew: (date: string) => void;
  navigate: (section: string) => void;
};
export default function HomeDashboard(p: Props) {
  const todayTasks = p.tasks
    .filter((t) => t.date && t.date <= p.today && lastTaskDate(t) >= p.today)
    .sort(
      (a, b) =>
        Number(a.status === 'done') - Number(b.status === 'done') ||
        (a.time || '99').localeCompare(b.time || '99'),
    );
  const inbox = p.tasks.filter((t) => !t.date && t.status !== 'done');
  const tracked = p.tasks
    .filter((t) => t.tracking && t.status !== 'done')
    .sort((a, b) => progressOf(b, p.today).late - progressOf(a, p.today).late);
  const late = tracked.filter(t => matchesTaskFocus(t, 'overdue', p.today));
  const remaining = todayTasks.filter((t) => t.status !== 'done').length;
  const cardTitles: Record<string, string> = {
    today: '今日安排', tracking: uiCopy.tracking, projects: '项目进度', inbox: uiCopy.unplanned,
  };
  function match(t: Task) {
    return (
      !p.query ||
      `${t.title} ${t.notes} ${p.projects.find((project) => project.id === t.project)?.title || ''}`
        .toLowerCase()
        .includes(p.query.toLowerCase())
    );
  }
  function taskRow(t: Task, tracking = false) {
    const metrics = progressOf(t, p.today),
      activity = checkInStats([t], p.today);
    return (
      <TaskMenu key={t.id} task={t}>
        <div className={'home-task ui-interactive-row ' + (t.status === 'done' ? 'is-done' : '')}>
          <Checkbox
            checked={t.status === 'done'}
            disabled={p.busy}
            aria-label={
              (t.status === 'done' ? '标记未完成：' : '标记完成：') + t.title
            }
            onCheckedChange={(v) =>
              p.onUpdate(t, { status: v ? 'done' : 'todo' })
            }
          />
          <div className="home-task-main">
            <button
              draggable={!p.busy}
              data-task-id={t.id}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
              onClick={() => p.onEdit(t)}
            >
              {t.title}
            </button>
            <div className="home-task-meta">
              <ProjectBadge
                project={p.projects.find((project) => project.id === t.project)}
              />
              {t.date && (
                <span>
                  {t.date === p.today ? '今天' : displayDate(t.date.slice(5))}
                  {lastTaskDate(t) !== t.date
                    ? '–' + displayDate(lastTaskDate(t).slice(5))
                    : ''}
                  {t.time ? ' · ' + t.time : ''}
                </span>
              )}
              {tracking && (
                <span className={metrics.late ? 'delay-text' : ''}>
                  {metrics.late ? `延期 ${metrics.late} 天` : '计划内'} · 已打卡{' '}
                  {activity.days} 天
                </span>
              )}
            </div>
          </div>
          <TaskCheckInButton task={t} />
        </div>
      </TaskMenu>
    );
  }
  const counts: Record<string, number> = {
    today: todayTasks.length,
    tracking: tracked.length,
    projects: p.projects.length,
    inbox: inbox.length,
  };
  const destinations: Record<string, string> = {
    today: 'schedule',
    tracking: 'tracking',
    projects: 'projects',
    inbox: 'inbox',
  };
  function content(card: HomeCard) {
    if (card.id === 'projects') {
      const projects = p.projects.filter(
        (project) =>
          !p.query ||
          `${project.title} ${project.description}`
            .toLowerCase()
            .includes(p.query.toLowerCase()) ||
          p.tasks.some((t) => t.project === project.id && match(t)),
      );
      return projects.length ? (
        projects.map((project) => {
          const tasks = p.tasks.filter((t) => t.project === project.id),
            done = tasks.filter((t) => t.status === 'done').length;
          const pct = tasks.length
              ? Math.round((done / tasks.length) * 100)
              : 0,
            range = projectSchedule(project, p.tasks);
          return (
            <button
              className="home-project ui-interactive-row"
              key={project.id}
              onClick={() => p.navigate(project.id)}
            >
              <div>
                <ProjectBadge project={project} />
                <span>
                  {done}/{tasks.length} · {pct}%
                </span>
              </div>
              <Progress
                className="home-project-progress"
                style={
                  {
                    '--progress-color': colorHex(project.color),
                  } as CSSProperties
                }
                value={pct}
                aria-label={project.title + uiCopy.completionProgress}
              />
              <small>
                {range.start
                  ? `${displayDate(range.start)}–${displayDate(range.end || range.start)}`
                  : uiCopy.unplanned}
              </small>
            </button>
          );
        })
      ) : (
        <div className="home-empty content-empty content-empty-inline">
          {p.query ? uiCopy.noProjectResults : uiCopy.noProjects}
          <button className="subtle" onClick={() => p.navigate('projects')}>
            前往项目
          </button>
        </div>
      );
    }
    const tasks = (
      card.id === 'today'
        ? todayTasks
        : card.id === 'tracking'
          ? tracked
          : inbox
    ).filter(match);
    return tasks.length ? (
      tasks.map((t) => taskRow(t, card.id === 'tracking'))
    ) : (
      <div className="home-empty content-empty content-empty-inline">
        <span>
          {p.query
            ? uiCopy.noTaskResults
            : card.id === 'today'
              ? uiCopy.noTodaySchedule
              : card.id === 'tracking'
                ? '暂无追踪任务'
                : uiCopy.noUnplanned}
        </span>
        {card.id !== 'tracking' && (
          <button
            className="subtle"
            onClick={() => p.onNew(card.id === 'today' ? p.today : '')}
          >
            <Plus size={14} />
            {uiCopy.newTask}</button>
        )}
      </div>
    );
  }
  return (
    <div className="home-dashboard">
      <div className="home-overview">
        <button onClick={() => p.navigate('today-tasks')}>
          <small>今日待办</small>
          <strong>
            {remaining}
          </strong>
        </button>
        <button onClick={() => p.navigate('unplanned-tasks')}>
          <small>{uiCopy.unplanned}</small>
          <strong>{inbox.length}</strong>
        </button>
        <button onClick={() => p.navigate('overdue-tasks')}>
          <small>{uiCopy.overdue}</small>
          <strong className={late.length ? 'delay-text' : ''}>
            {late.length}
          </strong>
        </button>
        <button onClick={() => p.navigate('today-checkins')}>
          <small>{uiCopy.checkInToday}</small>
          <strong>
            {
              p.tasks.filter(t => matchesTaskFocus(t, 'checkins', p.today))
                .length
            }
          </strong>
        </button>
      </div>
      <div className="home-grid">
        {defaultHomeLayout.cards.map((card) => (
          <section key={card.id} className="home-card" data-home-card={card.id}>
            <header className="home-card-header">
              <div className="home-card-heading">
                <div className="home-card-title"><h2>{cardTitles[card.id]}</h2><small>{counts[card.id]}</small></div>
              </div>
              <button
                className="home-card-link inline-action"
                onClick={() => p.navigate(destinations[card.id])}
              >
                查看全部 <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            </header>
            <section
              className="home-card-body"
              // The body scrolls independently; keyboard users need a focus target.
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              aria-label={cardTitles[card.id]}
            >
              {content(card)}
            </section>
          </section>
        ))}
      </div>
    </div>
  );
}
