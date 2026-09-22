'use client';
import { uiCopy, editorSubmitLabel } from '@/lib/ui-copy';
import ColorPreview from '@/components/color-preview';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { useState } from 'react';
import { useGanttCollapse } from '@/hooks/use-gantt-collapse';
import {
  Folder as FolderIcon,
  Plus,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaskDetailPropertyRow } from '@/components/task-detail-setting-row';
import { ItemMenu } from '@/components/task-menu';
import type { Project, Folder, Label } from '@/lib/model';
export type OrganizationEditor = {
  kind: 'Folder' | 'Label';
  id: string;
  title: string;
  color: string;
};
type Props = {
  editor: OrganizationEditor | null;
  onEditorChange: (editor: OrganizationEditor | null) => void;
  projects: Project[];
  folders: Folder[];
  labels: Label[];
  active: string;
  busy: boolean;
  navigate: (id: string) => void;
  editProject: (p?: Project) => void;
  deleteProject: (p: Project) => void;
  save: (payload: unknown, message?: string) => Promise<unknown>;
};
export default function Organization(p: Props) {
  const { editor, onEditorChange: setEditor } = p;
  const [closed, setClosed] = useGanttCollapse(p.busy);
  const [removal, setRemoval] = useState<{
      kind: string;
      id: string;
      title: string;
    } | null>(null),
    [error, setError] = useState('');
  const allFoldersClosed =
    p.folders.length > 0 &&
    p.folders.every((folder) => closed.includes(folder.id));
  async function act(payload: unknown, message?: string) {
    const action = (payload as { action?: string }).action;
    const feedback =
      message ||
      (
        {
          moveItem: '导航顺序已更新',
          saveProject: uiCopy.projectSaved,
          saveTask: uiCopy.taskSaved,
        } as Record<string, string>
      )[action || ''] ||
      '工作空间已更新';
    try {
      setError('');
      await p.save(payload, feedback);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  function projectNode(project: Project) {
    const siblings = p.projects.filter(
        (x) => (x.folder || '') === (project.folder || ''),
      ),
      i = siblings.findIndex((x) => x.id === project.id);
    return (
      <ItemMenu
        key={project.id}
        color={project.color}
        busy={p.busy}
        onColorChange={color => void act({ action: 'saveProject', project: { ...project, color } }, '项目颜色已更新')}
        edit={() => p.editProject(project)}
        remove={() => p.deleteProject(project)}
        up={
          i > 0
            ? () =>
                void act({
                  action: 'moveItem',
                  kind: 'projects',
                  id: project.id,
                  target: siblings[i - 1].id,
                })
            : undefined
        }
        down={
          i < siblings.length - 1
            ? () =>
                void act({
                  action: 'moveItem',
                  kind: 'projects',
                  id: project.id,
                  target: siblings[i + 1].id,
                  after: true,
                })
            : undefined
        }
      >
        <button
          draggable={!p.busy}
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData('application/x-patmi-project', project.id);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = e.dataTransfer.getData('application/x-patmi-project'),
              taskId = e.dataTransfer.getData('text/plain');
            if (id)
              void act({
                action: 'moveItem',
                kind: 'projects',
                id,
                target: project.id,
              });
            else if (taskId) {
              const event = new CustomEvent('patmi-move-to-project', {
                detail: { taskId, project: project.id },
              });
              window.dispatchEvent(event);
            }
          }}
          className={'projectnav ' + (p.active === project.id ? 'active' : '')}
          onClick={() => p.navigate(project.id)}
          onDoubleClick={() => p.editProject(project)}
        >
          <span className={'dot color' + project.color} />
          <span>{project.title}</span>
          <GripVertical size={12} className="grip" />
        </button>
      </ItemMenu>
    );
  }
  function folderDrop(e: React.DragEvent, folder: string) {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData('application/x-patmi-project'),
      project = p.projects.find((x) => x.id === id);
    if (project)
      void act({ action: 'saveProject', project: { ...project, folder } });
  }
  return (
    <>
      <div>
        <div className="navlabel">
          项目与文件夹
          <div>
            <button
              type="button"
              title={allFoldersClosed ? '展开全部文件夹' : '折叠全部文件夹'}
              aria-label={
                allFoldersClosed ? '展开全部文件夹' : '折叠全部文件夹'
              }
              disabled={p.folders.length === 0}
              onClick={() =>
                setClosed(
                  allFoldersClosed ? [] : p.folders.map((folder) => folder.id),
                )
              }
            >
              {allFoldersClosed ? (
                <ChevronsUpDown size={14} />
              ) : (
                <ChevronsDownUp size={14} />
              )}
            </button>
            <button
              title={uiCopy.newFolder}
              aria-label={uiCopy.newFolder}
              onClick={() => {
                setError('');
                setEditor({ kind: 'Folder', id: '', title: '', color: '0' });
              }}
            >
              <FolderIcon size={14} />
            </button>
            <button
              title={uiCopy.newProject}
              aria-label={uiCopy.newProject}
              onClick={() => p.editProject()}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div>
          {p.folders.map((f, i) => (
            <Collapsible
              key={f.id}
              open={!closed.includes(f.id)}
              className="foldergroup"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => folderDrop(e, f.id)}
            >
              <ItemMenu
                edit={() => {
                  setError('');
                  setEditor({ kind: 'Folder', ...f, color: '0' });
                }}
                remove={() =>
                  setRemoval({ kind: 'Folder', id: f.id, title: f.title })
                }
                up={
                  i > 0
                    ? () =>
                        void act({
                          action: 'moveItem',
                          kind: 'folders',
                          id: f.id,
                          target: p.folders[i - 1].id,
                        })
                    : undefined
                }
                down={
                  i < p.folders.length - 1
                    ? () =>
                        void act({
                          action: 'moveItem',
                          kind: 'folders',
                          id: f.id,
                          target: p.folders[i + 1].id,
                          after: true,
                        })
                    : undefined
                }
              >
                <button
                  className="folderheading"
                  aria-expanded={!closed.includes(f.id)}
                  draggable={!p.busy}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('application/x-patmi-folder', f.id);
                  }}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData(
                      'application/x-patmi-folder',
                    );
                    if (id) {
                      e.preventDefault();
                      e.stopPropagation();
                      void act({
                        action: 'moveItem',
                        kind: 'folders',
                        id,
                        target: f.id,
                      });
                    }
                  }}
                  onClick={() =>
                    setClosed((a) =>
                      a.includes(f.id)
                        ? a.filter((id) => id !== f.id)
                        : [...a, f.id],
                    )
                  }
                  onDoubleClick={() => {
                    setError('');
                    setEditor({ kind: 'Folder', ...f, color: '0' });
                  }}
                >
                  <ChevronDown
                    size={13}
                    style={{
                      transform: closed.includes(f.id) ? 'rotate(-90deg)' : '',
                    }}
                  />
                  <FolderIcon size={14} />
                  <span>{f.title}</span>
                  <small>
                    {p.projects.filter((x) => x.folder === f.id).length}
                  </small>
                </button>
              </ItemMenu>
              <CollapsibleContent className="folder-collapse">
                <div className="folderchildren">
                  {p.projects.filter((x) => x.folder === f.id).map(projectNode)}
                  {!p.projects.some((x) => x.folder === f.id) && (
                    <span className="dropempty">
                      拖入项目以添加
                    </span>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
          <div
            className="unfiled"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => folderDrop(e, '')}
          >
            {p.folders.length > 0 && <small>{uiCopy.uncategorized}</small>}
            {p.projects.filter((x) => !x.folder).map(projectNode)}
          </div>
        </div>
      </div>
      <div>
        <div className="navlabel">
          {uiCopy.tags}<button
            aria-label={uiCopy.newLabel}
            onClick={() => {
              setError('');
              setEditor({ kind: 'Label', id: '', title: '', color: '0' });
            }}
          >
            <Plus size={14} />
          </button>
        </div>
        {p.labels.map((l) => (
          <ItemMenu
            key={l.id}
            color={l.color}
            busy={p.busy}
            onColorChange={color => void act({ action: 'saveLabel', item: { ...l, color } }, '标签颜色已更新')}
            edit={() => {
              setError('');
              setEditor({ kind: 'Label', ...l });
            }}
            remove={() =>
              setRemoval({ kind: 'Label', id: l.id, title: l.title })
            }
          >
            <button
              className={
                'projectnav ' + (p.active === 'label:' + l.id ? 'active' : '')
              }
              onClick={() => p.navigate('label:' + l.id)}
              title="查看关联任务"
              onDragOver={(e) => {
                if (!p.busy && e.dataTransfer.types.includes('text/plain'))
                  e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const taskId = e.dataTransfer.getData('text/plain');
                if (taskId)
                  window.dispatchEvent(
                    new CustomEvent('patmi-add-label', {
                      detail: { taskId, label: l.id },
                    }),
                  );
              }}
            >
              <span className={'pill sidebar-tag-icon color' + l.color}>#</span>
              {l.title}
            </button>
          </ItemMenu>
        ))}
      </div>
      {error && !editor && (
        <p className="formerror" role="alert">
          {error}
        </p>
      )}
      <Dialog
        open={!!editor}
        onOpenChange={(v) => {
          if (!v && !p.busy) setEditor(null);
        }}
      >
        <DialogContent editorLayout="compact" className="editor organization-editor">
          <DialogTitle>
            {editor?.id ? uiCopy.edit : '新建'}
            {editor?.kind === 'Folder' ? '文件夹' : uiCopy.tags}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {uiCopy.edit}{editor?.kind === 'Folder' ? '文件夹' : uiCopy.tags}属性。
          </DialogDescription>
          {editor && (
            <form
              className="organization-edit-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await act(
                    { action: 'save' + editor.kind, item: editor },
                    `${editor.kind === 'Folder' ? '文件夹' : uiCopy.tags}已${editorSubmitLabel(!!editor.id)}`,
                  )
                )
                  setEditor(null);
              }}
            >
              <DialogBody className="organization-edit-body">
                <TaskDetailPropertyRow label={uiCopy.name}>
                  <Input
                    aria-label={uiCopy.name}
                    className="organization-name-input"
                    required
                    maxLength={100}
                    // User-opened creation form: start keyboard editing at its name field.
                    // oxlint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    value={editor.title}
                    onChange={(e) =>
                      setEditor({ ...editor, title: e.target.value })
                    }
                  />
                </TaskDetailPropertyRow>
                {editor.kind === 'Label' && (
                  <TaskDetailPropertyRow label={uiCopy.color}>
                    <ColorPreview
                      value={editor.color}
                      title={editor.title || '我的标签'}
                      onChange={(color) => setEditor({ ...editor, color })}
                    />
                  </TaskDetailPropertyRow>
                )}
                {error && (
                  <p className="formerror" role="alert">
                    {error}
                  </p>
                )}
              </DialogBody>
              <DialogFooter
                layout="contained"
                className="formfooter organization-edit-footer"
              >
                {editor.id && (
                  <Button
                    type="button"
                    variant="destructive-quiet"
                    size="sm"
                    className="organization-delete-action"
                    disabled={p.busy}
                    onClick={() =>
                      setRemoval({
                        kind: editor.kind,
                        id: editor.id,
                        title: editor.title,
                      })
                    }
                  >
                    <Trash2 size={14} />
                    {uiCopy.remove}{editor.kind === 'Folder' ? '文件夹' : uiCopy.tags}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={p.busy}
                  onClick={() => setEditor(null)}
                >
                  {uiCopy.cancel}</Button>
                <Button type="submit" size="sm" disabled={p.busy}>
                  {editorSubmitLabel(!!editor.id, p.busy)}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!removal}
        onOpenChange={(v) => {
          if (!v && !p.busy) setRemoval(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>删除「{removal?.title}」？</AlertDialogTitle>
          <AlertDialogDescription>
            {removal?.kind === 'Folder'
              ? '保留文件夹内的所有项目，并移至未分类。'
              : '删除此标签及其关联，保留所有任务和项目。'}
          </AlertDialogDescription>
          {error && <p className="formerror">{error}</p>}
          <AlertDialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRemoval(null)}
            >
              {uiCopy.cancel}</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={p.busy}
              onClick={async () => {
                if (
                  removal &&
                  (await act(
                    {
                      action: 'delete' + removal.kind,
                      id: removal.id,
                    },
                    `${removal.kind === 'Folder' ? '文件夹' : uiCopy.tags}已删除`,
                  ))
                ) {
                  if (editor?.id === removal.id && editor.kind === removal.kind)
                    setEditor(null);
                  setRemoval(null);
                }
              }}
            >
              {uiCopy.remove}{removal?.kind === 'Folder' ? '文件夹' : uiCopy.tags}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
