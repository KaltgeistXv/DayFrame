'use client';
import { durationForTaskEnd } from '@/lib/task-editor';
import { uiCopy, editorSubmitLabel } from '@/lib/ui-copy';
import {
  statuses,
  priorities,
  shift,
  type Task,
  type Project,
  type Label,
} from '@/lib/model';
import { taskEnd } from '@/lib/planner-interactions';
import { lastTaskDate, withoutTime, atTime } from '@/lib/task-scheduling';
import { Trash2 } from 'lucide-react';
import TimePicker from './time-picker';
import Picker from './property-picker';
import TagPicker from './tag-picker';
import TaskDetailSettingRow, {
  TaskDetailPropertyRow,
} from './task-detail-setting-row';
import { CheckInPanel } from './check-in-dialog';
import { DatePicker } from './ui/date-picker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
type CheckInEntry = { date: string; note?: string; minutes?: number };
type Props = {
  task: Task | null;
  detailRecordTask?: Task;
  projects: Project[];
  labels: Label[];
  today: string;
  busy: boolean;
  formError: string;
  detailCheckInDate?: string;
  onChange: (task: Task) => void;
  setFormError: (error: string) => void;
  onClose: () => void;
  onSave: (task: Task) => Promise<void>;
  onDelete: (ids: string[]) => void;
  onCreateProject: () => void;
  onCreateLabel: (title: string) => Promise<string>;
  onSaveCheckIn: (entry: CheckInEntry) => Promise<unknown>;
  onRemoveCheckIn: (date: string) => Promise<unknown>;
};
export default function TaskEditor({
  task,
  detailRecordTask,
  projects,
  labels,
  today,
  busy,
  formError,
  detailCheckInDate,
  onChange,
  setFormError,
  onClose,
  onSave,
  onDelete,
  onCreateProject,
  onCreateLabel,
  onSaveCheckIn,
  onRemoveCheckIn,
}: Props) {
  const hasDetailRecords =
    !!detailRecordTask &&
    (!!detailRecordTask.tracking || !!detailRecordTask.checkins?.length);
  return (
    <Dialog
      open={!!task}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent editorLayout="form" className="editor task-editor">
        <DialogTitle>{task?.id ? '任务详情' : uiCopy.newTask}</DialogTitle>
        <DialogDescription className="sr-only">
          编辑任务信息、排期和每日打卡。
        </DialogDescription>
        {task && (
          <Tabs
            defaultValue="details"
            key={`${task.id || 'new'}:${hasDetailRecords ? 'records' : 'plain'}`}
            className="task-detail-tabs"
          >
            {hasDetailRecords && (
              <TabsList aria-label="任务详情页面">
                <TabsTrigger value="details">任务信息</TabsTrigger>
                <TabsTrigger value="checkins">
                  {uiCopy.checkInRecords}
                  {!!detailRecordTask?.checkins?.length && (
                    <span className="dialog-tab-count">
                      {detailRecordTask.checkins.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="details" keepMounted>
              <form
                className="task-detail-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void onSave(task);
                }}
              >
                <div className="task-detail-scroll">
                  <label className="task-title-field" htmlFor="task-title">
                    {uiCopy.name}
                    <Input
                      id="task-title"
                      variant="title"
                      // User-opened creation form: start keyboard editing at its name field.
                      // oxlint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      required
                      maxLength={200}
                      value={task.title}
                      onChange={(e) =>
                        onChange({ ...task, title: e.target.value })
                      }
                    />
                  </label>
                  <div className="task-property-panel">
                    <TaskDetailPropertyRow
                      label={uiCopy.project}
                      className="task-project-property"
                    >
                      <Picker
                        detail
                        label={uiCopy.project}
                        value={task.project || 'none'}
                        onChange={(v) =>
                          onChange({
                            ...task,
                            project: v === 'none' ? '' : v,
                          })
                        }
                        options={[
                          ['none', uiCopy.noProject],
                          ...projects.map((p) => [p.id, p.title]),
                        ]}
                        createOption={{
                          label: uiCopy.newProject,
                          onSelect: onCreateProject,
                        }}
                      />
                    </TaskDetailPropertyRow>
                    <TaskDetailPropertyRow
                      label={uiCopy.status}
                      className="task-status-property"
                    >
                      <Picker
                        detail
                        label={uiCopy.status}
                        value={task.status}
                        onChange={(status) =>
                          onChange({
                            ...task,
                            status,
                            completedOn:
                              status === 'done' && task.tracking
                                ? task.completedOn || today
                                : task.completedOn,
                          })
                        }
                        options={statuses}
                      />
                    </TaskDetailPropertyRow>
                    <TaskDetailPropertyRow
                      label={uiCopy.priority}
                      className="task-priority-property"
                    >
                      <Picker
                        detail
                        label={uiCopy.priority}
                        value={task.priority}
                        onChange={(priority) => onChange({ ...task, priority })}
                        options={priorities}
                      />
                    </TaskDetailPropertyRow>
                    <TaskDetailPropertyRow
                      label={uiCopy.tags}
                      className="task-tag-property"
                    >
                      <TagPicker
                        variant="task-detail"
                        onCreate={onCreateLabel}
                        labels={labels}
                        value={task.tags || []}
                        onChange={(tags) => onChange({ ...task, tags })}
                      />
                    </TaskDetailPropertyRow>
                  </div>
                  <fieldset className="task-property-panel dialog-field-grid">
                    <legend>{uiCopy.schedule}</legend>
                    <TaskDetailPropertyRow
                      label={uiCopy.startDate}
                      className="task-date-property"
                    >
                      <DatePicker
                        value={task.date}
                        clearable
                        ariaLabel={uiCopy.startDate}
                        onChange={(date) =>
                          onChange({
                            ...task,
                            date,
                            time: date ? task.time : '',
                          })
                        }
                      />
                    </TaskDetailPropertyRow>
                    <TaskDetailPropertyRow
                      label={uiCopy.endDate}
                      className="task-date-property"
                    >
                      <DatePicker
                        min={task.date}
                        max={shift(task.date, 3659)}
                        required
                        disabled={!task.date}
                        value={
                          task.time ? taskEnd(task).date : lastTaskDate(task)
                        }
                        ariaLabel={uiCopy.endDate}
                        onChange={(date) => {
                          if (!date) return;
                          try {
                            onChange({
                              ...task,
                              duration: durationForTaskEnd(task, date),
                            });
                            setFormError('');
                          } catch (error) {
                            setFormError((error as Error).message);
                          }
                        }}
                      />
                    </TaskDetailPropertyRow>
                    <TaskDetailSettingRow
                      label={uiCopy.allDay}
                      disabled={!task.date}
                      checked={!task.time}
                      onCheckedChange={(checked) =>
                        onChange(
                          checked
                            ? withoutTime(task)
                            : atTime(task, task.date, '09:00'),
                        )
                      }
                    />
                    <TaskDetailSettingRow
                      label={uiCopy.autoTracking}
                      checked={!!task.tracking}
                      onCheckedChange={(checked) =>
                        onChange({ ...task, tracking: checked })
                      }
                    />
                    {task.date && task.time && (
                      <>
                        <TaskDetailPropertyRow
                          label={uiCopy.startTime}
                          className="task-time-property"
                        >
                          <TimePicker
                            aria-label={uiCopy.startTime}
                            disabled={busy}
                            value={task.time}
                            onChange={(value) =>
                              onChange(
                                value
                                  ? atTime(task, task.date, value)
                                  : withoutTime(task),
                              )
                            }
                          />
                        </TaskDetailPropertyRow>
                        <TaskDetailPropertyRow
                          label={uiCopy.endTime}
                          className="task-time-property"
                        >
                          <TimePicker
                            aria-label={uiCopy.endTime}
                            disabled={busy}
                            value={taskEnd(task).time}
                            onChange={(value) => {
                              if (!value) return;
                              try {
                                onChange({
                                  ...task,
                                  duration: durationForTaskEnd(
                                    task,
                                    taskEnd(task).date,
                                    value,
                                  ),
                                });
                                setFormError('');
                              } catch (error) {
                                setFormError((error as Error).message);
                              }
                            }}
                          />
                        </TaskDetailPropertyRow>
                      </>
                    )}

                    {task.status === 'done' && task.tracking && (
                      <TaskDetailPropertyRow
                        label="完成日期"
                        className="task-completion-date"
                      >
                        <DatePicker
                          required
                          max={today}
                          value={task.completedOn || today}
                          ariaLabel="完成日期"
                          onChange={(completedOn) =>
                            onChange({
                              ...task,
                              completedOn,
                            })
                          }
                        />
                      </TaskDetailPropertyRow>
                    )}
                  </fieldset>
                  <label className="task-notes-field" htmlFor="task-notes">
                    <span>{uiCopy.notes}</span>
                    <Textarea
                      id="task-notes"
                      aria-label={uiCopy.notes}
                      rows={3}
                      maxLength={10000}
                      placeholder={uiCopy.addNotes}
                      value={task.notes}
                      onChange={(e) =>
                        onChange({ ...task, notes: e.target.value })
                      }
                    />
                  </label>
                </div>
                {formError && (
                  <p role="alert" className="formerror">
                    {formError}
                  </p>
                )}
                <DialogFooter layout="contained" className="formfooter">
                  {task.id && (
                    <Button
                      type="button"
                      variant="destructive-quiet"
                      size="sm"
                      className="task-delete-button"
                      onClick={() => onDelete([task.id])}
                    >
                      <Trash2 size={17} />
                      {uiCopy.deleteTask}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => onClose()}
                  >
                    {uiCopy.cancel}
                  </Button>
                  <Button type="submit" size="sm" disabled={busy}>
                    {editorSubmitLabel(!!task.id, busy)}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
            {hasDetailRecords && detailRecordTask && (
              <TabsContent value="checkins" keepMounted>
                <CheckInPanel
                  initialDate={detailCheckInDate}
                  task={detailRecordTask}
                  project={projects.find(
                    (p) => p.id === detailRecordTask.project,
                  )}
                  today={today}
                  busy={busy}
                  onSave={(entry) => onSaveCheckIn(entry)}
                  onRemove={(date) => onRemoveCheckIn(date)}
                />
              </TabsContent>
            )}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
