import type { Task, Project } from './model';
import { lastTaskDate, moveByDate } from './task-scheduling';

export const elapsedDays = (from: string, to: string) =>
  from && to
    ? Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86400000))
    : 0;

// Manual scheduling defines the plan. Automatic rollover bypasses this function
// so it can move the current schedule without changing the user's plan.
export function prepareTracking(
  task: Task,
  previous: Task | undefined,
  today: string,
): Task {
  // A historical display span cannot replace the real schedule on save.
  if (task.calendarHistory && previous)
    task = {
      ...task,
      date: previous.date,
      time: previous.time,
      duration: previous.duration,
    };
  const originalEdit = task.calendarOriginal === true;
  const comparison =
    originalEdit && previous ? originalPlan(previous) : previous;
  const {
    calendarOriginal: _projection,
    calendarHistory: _history,
    completionDrag,
    ...fields
  } = task;
  const tracking = task.tracking ?? !!previous?.tracking;
  const planChanged =
    !!previous &&
    (task.date !== comparison!.date ||
      task.time !== comparison!.time ||
      task.duration !== comparison!.duration);
  const recordPlan = tracking || !!previous?.baselineStart;
  // Ordinary tasks use their schedule as the start/finish fact. Tracking tasks
  // keep an independently recorded actual completion date.
  const scheduledCompletion = task.date
    ? lastTaskDate(task)
    : task.completedOn || previous?.completedOn || today;
  const completedOn =
    task.status === 'done'
      ? tracking
        ? task.completedOn || previous?.completedOn || today
        : scheduledCompletion
      : '';
  if (
    completedOn &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(completedOn) ||
      !Number.isFinite(Date.parse(completedOn)) ||
      new Date(completedOn).toISOString().slice(0, 10) !== completedOn ||
      (tracking && completedOn > today))
  )
    throw Error('完成日期须为今天或以前的有效日期');
  if (tracking && completedOn && completedOn !== previous?.completedOn) {
    const records =
      typeof previous?.checkins === 'string'
        ? (Object.values(JSON.parse(previous.checkins)) as NonNullable<
            Task['checkins']
          >)
        : previous?.checkins || [];
    if (
      records.some(
        (entry) =>
          entry.date > completedOn &&
          !(
            entry.date === previous?.completedOn &&
            entry.note === '完成任务' &&
            entry.minutes === 0
          ),
      )
    )
      throw Error('完成日期之后已有打卡记录，请先调整这些记录');
  }
  let prepared: Task = {
    ...fields,
    ...(originalEdit && previous && !planChanged
      ? {
          date: previous.date,
          time: previous.time,
          duration: previous.duration,
        }
      : {}),
    tracking,
    baselineStart: planChanged
      ? recordPlan
        ? task.date
        : ''
      : previous?.baselineStart || (tracking ? task.date : ''),
    baselineEnd: planChanged
      ? recordPlan
        ? lastTaskDate(task)
        : ''
      : previous?.baselineEnd || (tracking ? lastTaskDate(task) : ''),
    startedOn:
      !tracking && task.status === 'done' && task.date
        ? task.date
        : (previous?.startedOn &&
          completedOn &&
          previous.startedOn > completedOn
            ? completedOn
            : previous?.startedOn) ||
          ((tracking && task.status === 'doing') || task.status === 'done'
            ? completedOn || today
            : ''),
    completedOn,
    rolledDays: planChanged ? 0 : previous?.rolledDays || 0,
  };
  if (
    completionDrag &&
    completedOn &&
    prepared.baselineStart &&
    completedOn < prepared.baselineStart
  )
    throw Error('完成日期不能早于原计划开始日期');
  if (
    task.undoCompletion &&
    previous?.status === 'done' &&
    task.status !== 'done'
  )
    prepared.startedOn = task.startedOn || '';
  // Completion fixes the end of automatic tracking, including historical imports.
  // Always derive it from the original plan, not an already rolled schedule.
  if (
    tracking &&
    completedOn &&
    prepared.baselineStart &&
    prepared.baselineEnd
  ) {
    const planned = { ...prepared, date: prepared.baselineStart };
    const late = elapsedDays(prepared.baselineEnd, completedOn);
    prepared = {
      ...(late
        ? moveByDate(planned, prepared.baselineEnd, completedOn)
        : planned),
      rolledDays: late,
    };
  }
  return prepared;
}

// A drag on the extended span records an actual finish, never a new baseline.
export function isCompletionDrag(task: Task, origin: string, edge = '') {
  return !!(
    hasRollover(task) &&
    (edge === 'completion' || (!edge && origin > (task.baselineEnd || '')))
  );
}
export function completeByDrag(task: Task, date: string): Task {
  return {
    ...originalPlan(currentCalendarTask(task)),
    status: 'done',
    completedOn: date,
    completionDrag: true,
  };
}

export function rollForward(task: Task, today: string): Task {
  const end = lastTaskDate(task);
  if (!task.tracking || task.status === 'done' || !end || end >= today)
    return task;
  return {
    ...moveByDate(task, end, today),
    rolledDays: (task.rolledDays || 0) + elapsedDays(end, today),
  };
}

export function progressOf(task: Task, today: string) {
  const reference = task.status === 'done' ? task.completedOn || today : today;
  return {
    planned:
      task.baselineStart && task.baselineEnd
        ? elapsedDays(task.baselineStart, task.baselineEnd) + 1
        : 0,
    late: elapsedDays(task.baselineEnd || '', reference),
    working: task.startedOn ? elapsedDays(task.startedOn, reference) + 1 : 0,
    forecastLate: elapsedDays(task.baselineEnd || '', lastTaskDate(task)),
  };
}

export function projectSchedule(project: Project, tasks: Task[]): Project {
  if (project.scheduleMode === 'manual') return project;
  const children = tasks.filter((t) => t.project === project.id && t.date);
  if (!children.length) return { ...project, start: '', end: '' };
  return {
    ...project,
    start: children.map((t) => t.date).sort()[0],
    end: children.map(lastTaskDate).sort().at(-1),
  };
}

export function hasRollover(task: Task) {
  return !!(
    task.tracking &&
    task.date &&
    task.baselineStart &&
    task.date !== task.baselineStart &&
    (task.rolledDays || 0) > 0
  );
}
export function originalPlan(task: Task): Task {
  return hasRollover(task)
    ? { ...task, date: task.baselineStart!, calendarOriginal: true }
    : task;
}
// Fill only the days between the original plan and the current schedule.
// This is a read-only calendar projection, never a new task or a work check-in.
export function calendarEntries(tasks: Task[]): Task[] {
  return tasks.flatMap((task) => {
    if (!hasRollover(task) || task.calendarOriginal || task.calendarHistory)
      return [task];
    const original = originalPlan(task);
    const start = new Date(Date.parse(lastTaskDate(original)) + 86400000)
      .toISOString()
      .slice(0, 10);
    const days = elapsedDays(start, task.date);
    const history: Task[] =
      days > 0
        ? [
            {
              ...task,
              date: start,
              time: '',
              duration: days * 1440,
              calendarHistory: {
                date: task.date,
                time: task.time,
                duration: task.duration,
              },
            },
          ]
        : [];
    return [original, ...history, task];
  });
}
export function currentCalendarTask(task: Task): Task {
  if (!task.calendarHistory) return task;
  const { calendarHistory, ...fields } = task;
  return { ...fields, ...calendarHistory };
}
export const calendarKey = (task: Task) =>
  task.id +
  (task.calendarOriginal
    ? ':original'
    : task.calendarHistory
      ? ':history'
      : ':current');
export const calendarCaption = (task: Task) =>
  task.calendarOriginal
    ? '原计划'
    : task.calendarHistory
      ? '自动顺延'
      : hasRollover(task)
        ? `自动顺延 ${task.rolledDays} 天`
        : '';
