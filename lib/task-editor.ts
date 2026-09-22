import type { Task } from './model';
import { taskStart, taskEnd } from './planner-interactions';
import { uiCopy } from './ui-copy';

/** Date-only ranges include their last day; timed ranges have an exclusive end.
 * Both end controls use the same duration limits as task validation.
 */
export function durationForTaskEnd(
  task: Task,
  date: string,
  time?: string,
): number {
  const duration = task.time
    ? (Date.parse(`${date}T${time ?? taskEnd(task).time}:00Z`) -
        taskStart(task)) /
      60000
    : ((Date.parse(date) - Date.parse(task.date)) / 86400000 + 1) * 1440;
  if (!Number.isFinite(duration))
    throw Error(
      time === undefined ? uiCopy.invalidEndDate : uiCopy.invalidEndTime,
    );
  if (duration > 5270400) throw Error(uiCopy.scheduleTooLong);
  if (duration < (task.time ? 5 : 1440))
    throw Error(task.time ? uiCopy.endTimeTooEarly : uiCopy.endDateTooEarly);
  return duration;
}
