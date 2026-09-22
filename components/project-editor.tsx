'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Project, Folder, Label } from '@/lib/model';
import { isSavedProject } from '@/lib/project-editor';
import { uiCopy, editorSubmitLabel } from '@/lib/ui-copy';
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { TaskDetailPropertyRow } from '@/components/task-detail-setting-row';
import Picker from '@/components/property-picker';
import TagPicker from '@/components/tag-picker';
import ColorPreview from '@/components/color-preview';

export default function ProjectEditor({
  project,
  projects,
  folders,
  labels,
  busy,
  onChange,
  onSave,
  onClose,
  onDelete,
  onCreateLabel,
}: {
  project: Project | null;
  projects: Project[];
  folders: Folder[];
  labels: Label[];
  busy: boolean;
  onChange: (project: Project) => void;
  onSave: (project: Project) => Promise<void>;
  onClose: () => void;
  onDelete: (project: Project) => void;
  onCreateLabel: (title: string) => Promise<string>;
}) {
  const [formError, setFormError] = useState('');
  const persisted = isSavedProject(project, projects);
  return (
    <Dialog
      open={!!project}
      onOpenChange={(open) => {
        if (!open && !busy) {
          onClose();
        }
      }}
    >
      <DialogContent
        editorLayout="form"
        className="editor task-editor project-editor"
      >
        <DialogTitle>
          {persisted ? uiCopy.editProject : uiCopy.newProject}
        </DialogTitle>
        <DialogDescription className="sr-only">
          编辑项目属性。
        </DialogDescription>
        {project && (
          <form
            className="task-detail-form project-detail-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              try {
                setFormError('');
                await onSave(project);
                onClose();
              } catch (e) {
                setFormError((e as Error).message);
              }
            }}
          >
            <DialogBody className="task-detail-scroll project-detail-scroll">
              <div className="task-title-field">
                <label htmlFor="project-title">{uiCopy.name}</label>
                <Input
                  variant="title"
                  id="project-title"
                  // User-opened creation form: start keyboard editing at its name field.
                  // oxlint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  required
                  maxLength={100}
                  value={project.title}
                  onChange={(e) =>
                    onChange({ ...project, title: e.target.value })
                  }
                />
              </div>
              <div className="task-property-panel">
                <TaskDetailPropertyRow
                  label={uiCopy.folder}
                  className="task-project-property"
                >
                  <Picker
                    detail
                    label={uiCopy.folder}
                    value={project.folder || 'none'}
                    onChange={(folder) =>
                      onChange({
                        ...project,
                        folder: folder === 'none' ? '' : folder,
                      })
                    }
                    options={[
                      ['none', uiCopy.uncategorized],
                      ...folders.map((f) => [f.id, f.title]),
                    ]}
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
                    value={project.tags || []}
                    onChange={(tags) => onChange({ ...project, tags })}
                  />
                </TaskDetailPropertyRow>
                <TaskDetailPropertyRow
                  label={uiCopy.scheduleMode}
                  className="project-schedule-property"
                >
                  <Picker
                    detail
                    label={uiCopy.scheduleMode}
                    value={
                      project.scheduleMode ||
                      (project.start ? 'manual' : 'auto')
                    }
                    onChange={(scheduleMode) =>
                      onChange({ ...project, scheduleMode })
                    }
                    options={[
                      ['auto', uiCopy.autoSchedule],
                      ['manual', uiCopy.manualSchedule],
                    ]}
                  />
                </TaskDetailPropertyRow>
                <TaskDetailPropertyRow
                  label={uiCopy.color}
                  className="project-color-property"
                >
                  <ColorPreview
                    value={project.color}
                    title={project.title}
                    onChange={(color) => onChange({ ...project, color })}
                  />
                </TaskDetailPropertyRow>
                {(project.scheduleMode ||
                  (project.start ? 'manual' : 'auto')) === 'manual' && (
                  <>
                    <TaskDetailPropertyRow
                      label={uiCopy.startDate}
                      className="task-date-property"
                    >
                      <DatePicker
                        value={project.start || ''}
                        clearable
                        ariaLabel={uiCopy.startDate}
                        onChange={(start) =>
                          onChange({
                            ...project,
                            start,
                            end: start ? project.end || start : '',
                          })
                        }
                      />
                    </TaskDetailPropertyRow>
                    <TaskDetailPropertyRow
                      label={uiCopy.endDate}
                      className="task-date-property"
                    >
                      <DatePicker
                        min={project.start || undefined}
                        value={project.end || ''}
                        clearable
                        ariaLabel={uiCopy.endDate}
                        onChange={(end) =>
                          onChange({
                            ...project,
                            end,
                            start: end ? project.start || end : '',
                          })
                        }
                      />
                    </TaskDetailPropertyRow>
                  </>
                )}
              </div>
              <div className="task-notes-field">
                <label htmlFor="project-description">
                  {uiCopy.description}
                </label>
                <Textarea
                  id="project-description"
                  maxLength={2000}
                  rows={3}
                  value={project.description}
                  placeholder={uiCopy.addDescription}
                  onChange={(e) =>
                    onChange({ ...project, description: e.target.value })
                  }
                />
              </div>
            </DialogBody>
            {formError && (
              <p role="alert" className="formerror">
                {formError}
              </p>
            )}
            <DialogFooter
              layout="contained"
              className="formfooter project-detail-footer"
            >
              {persisted && (
                <Button
                  variant="destructive-quiet"
                  size="sm"
                  className="task-delete-button"
                  disabled={busy}
                  type="button"
                  onClick={() => onDelete(project)}
                >
                  <Trash2 size={17} />
                  {uiCopy.deleteProject}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={busy}
              >
                {uiCopy.cancel}
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {editorSubmitLabel(persisted, busy)}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
