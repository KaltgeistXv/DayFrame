'use client';
import TaskEditor from './task-editor';
import { uiCopy } from '@/lib/ui-copy';
import {
  navigationTarget,
  matchesTaskFocus,
  statusGroupKey,
  taskFocusOptions,
  type TaskFocus,
} from '@/lib/navigation-policy';
import DragActionDock from './drag-action-dock';
import { ViewToolbar } from './ui/view-toolbar';
import GanttCollapseControl from './gantt-collapse-control';
import { useGanttCollapse } from '@/hooks/use-gantt-collapse';
import { useWorkspaceData } from '@/hooks/use-workspace-data';
import { originalPlan, currentCalendarTask } from '@/lib/progress';
import { useNativeEdgeScroll } from '@/hooks/use-native-edge-scroll';
import { useDragFeedback } from '@/hooks/use-drag-feedback';
import { dateHeading, serverCalendarDate } from '@/lib/calendar-date';
import { colorRules } from '@/lib/colors';
import { trackingMatches } from '@/lib/task-appearance';
import { navigationNames, currentSection } from '@/lib/appearance';
import { sectionViews, sectionContains } from '@/lib/workspace-views';
import { lastTaskDate, unplan } from '@/lib/task-scheduling';
import Organization, {
  type OrganizationEditor,
} from '@/components/organization';
import ProjectCollection from '@/components/project-collection';
import { ProjectOverviewContent } from '@/components/project-overview-content';
import HomeDashboard from '@/components/home-dashboard';
import InterfaceSettings from '@/components/interface-settings';
import CheckInDialog from '@/components/check-in-dialog';
import ProjectBadge from '@/components/project-badge';
import { projectSchedule } from '@/lib/progress';
import {
  TaskMenu,
  TaskCheckInButton,
  TaskActionsProvider,
  ItemMenu,
} from '@/components/task-menu';
import { type Preferences } from '@/lib/model';
import ProjectEditor from '@/components/project-editor';
import Picker from '@/components/property-picker';
import { createProjectDraft, isSavedProject } from '@/lib/project-editor';
import { taskStart, occursOn } from '@/lib/planner-interactions';
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from 'react';
import {
  Sun,
  PanelLeft,
  PanelLeftClose,
  Pin,
  Inbox,
  CheckCheck,
  CalendarDays,
  Layers,
  Plus,
  List,
  Columns3,
  ChartNoAxesGantt,
  Grid2X2,
  SlidersHorizontal,
  Settings2,
  ArrowDownWideNarrow,
  Check,
  Flag,
  RotateCw,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  blankTask,
  day,
  shift,
  statuses,
  priorities,
  validateTask,
  type Task,
  type Project,
} from '@/lib/model';
const nav = [
  { id: 'today', label: '首页', icon: Sun },
  { id: 'inbox', label: '收集箱', icon: Inbox },
  { id: 'all', label: '任务', icon: CheckCheck },
  { id: 'projects', label: '项目', icon: Layers },
];
const CalendarView = lazy(() => import('@/components/calendar-view'));
const ProjectGantt = lazy(() => import('@/components/project-gantt'));
const ProgressDashboard = lazy(() => import('@/components/progress-dashboard'));
const ActivityHeatmap = lazy(() => import('@/components/activity-heatmap'));

function ViewLoading() {
  return (
    <output className="view-loading" aria-live="polite">
      {uiCopy.loading}
    </output>
  );
}

type FilterField = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
};
function FilterToggle({
  open,
  count,
  onClick,
}: {
  open: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={
        'subtle filter-toggle scope-control toolbar-icon-control ' +
        (open ? 'selected' : '')
      }
      aria-expanded={open}
      aria-label={
        count > 0 ? `筛选与排序，已应用 ${count} 项筛选` : '筛选与排序'
      }
      data-filtered={count > 0 || undefined}
      onClick={onClick}
      title={count > 0 ? `筛选与排序 · 已应用 ${count} 项` : '筛选与排序'}
    >
      <SlidersHorizontal size={16} aria-hidden="true" />
    </button>
  );
}
function FilterPanel({
  open,
  fields,
  sorting,
  clear,
}: {
  open: boolean;
  fields: FilterField[];
  sorting?: FilterField;
  clear: () => void;
}) {
  const active = fields.filter((field) => field.value !== 'all');
  return (
    <>
      {open && (
        <div className="filterbar unified-filter-panel">
          <div className="filter-fields">
            {fields.map((field) => (
              <div className="filter-field" key={field.label}>
                <span>{field.label}</span>
                <Picker {...field} />
              </div>
            ))}
          </div>
          {sorting && (
            <div className="filter-sort">
              <span>
                <ArrowDownWideNarrow size={14} />
                排序
              </span>
              <Picker {...sorting} />
            </div>
          )}
        </div>
      )}
      {active.length > 0 && (
        <div className="active-filter-summary" aria-label="已应用的筛选">
          <div className="filter-chips">
            {active.map((field) => (
              <button
                key={field.label}
                onClick={() => field.onChange('all')}
                title={'移除' + field.label + '筛选'}
              >
                {field.label}：
                {field.options.find(([id]) => id === field.value)?.[1] ||
                  field.value}{' '}
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
          <button className="filter-clear" onClick={clear}>
            清除筛选
          </button>
        </div>
      )}
    </>
  );
}
export default function WorkspacePage({
  initialDate,
}: {
  initialDate: string;
}) {
  return (
    <SidebarProvider>
      <Workspace initialDate={initialDate} />
    </SidebarProvider>
  );
}
function rememberedView(id: string) {
  const allowed = sectionViews(id);
  try {
    const saved = localStorage.getItem('patmi:view:' + id);
    if (saved === 'planner' && allowed.includes('calendar')) return 'calendar';
    if (saved && allowed.includes(saved)) return saved;
  } catch {}
  return allowed[0] || 'list';
}

type TaskToolContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: unknown;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: { title: string; date?: string }) => Promise<unknown>;
    },
    options: { signal: AbortSignal },
  ) => unknown;
};

function Workspace({ initialDate }: { initialDate: string }) {
  const [tagFilter, setTagFilter] = useState('all'),
    [projectView, setProjectView] = useState('cards'),
    [folderFilter, setFolderFilter] = useState('all'),
    [projectSort, setProjectSort] = useState('manual'),
    [completionFilter, setCompletionFilter] = useState('all');
  const [interfaceOpen, setInterfaceOpen] = useState(false);
  const [organizationEditor, setOrganizationEditor] =
    useState<OrganizationEditor | null>(null);
  useEffect(() => {
    document.documentElement.dataset.patmiMotion = 'on';
  }, []);
  const [section, setSection] = useState('today'),
    [viewChoice, setView] = useState('planner'),
    [priority, setPriority] = useState('all'),
    [trackingScope, setTrackingScope] = useState('all'),
    [taskFocus, setTaskFocus] = useState<TaskFocus>('all'),
    [taskProjectFilter, setTaskProjectFilter] = useState('all'),
    [sort, setSort] = useState('date'),
    [showFilters, setShowFilters] = useState(false),
    [viewFocused, setViewFocused] = useState(false);
  const initializeNavigation = useCallback((preferences: Preferences) => {
    setSection(preferences.startView);
    setView(rememberedView(preferences.startView));
  }, []);
  const {
    tasks,
    projects,
    folders,
    labels,
    preferences,
    ready,
    error,
    setError,
    busy,
    notice,
    setNotice,
    undo,
    undoLast,
    load,
    mutate,
    pending,
  } = useWorkspaceData(initializeNavigation);
  const [closedGroups, setClosedGroups] = useGanttCollapse(busy);
  const allowedViews = sectionViews(section);
  const view = allowedViews.includes(viewChoice)
    ? viewChoice
    : allowedViews[0] || 'list';
  const groupKey = (status: string) => statusGroupKey(section, status);
  const toggleGroup = (key: string) =>
    setClosedGroups((ids) =>
      ids.includes(key) ? ids.filter((id) => id !== key) : [...ids, key],
    );
  const [checkInId, setCheckInId] = useState('');
  const [checkInDate, setCheckInDate] = useState<string>();
  const [detailCheckInDate, setDetailCheckInDate] = useState<string>();
  const checkInTask = tasks.find((t) => t.id === checkInId);
  const [task, setTask] = useState<Task | null>(null),
    [project, setProject] = useState<Project | null>(null),
    [removal, setRemoval] = useState<{
      id: string;
      kind: string;
      title: string;
      ids?: string[];
    } | null>(null),
    [formError, setFormError] = useState('');
  const [dragId, setDragId] = useState('');
  const [today, setToday] = useState(initialDate),
    [anchor, setAnchor] = useState(initialDate);
  const projectDraftForTask = useRef(false);
  const { setOpenMobile, setOpen, open, isMobile, openMobile } = useSidebar();
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const sidebarNode = useRef<HTMLDivElement>(null);
  const workspaceScroll = useRef<HTMLDivElement>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showPeek() {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    if (!open && !isMobile) setSidebarPeek(true);
  }
  function hidePeekSoon() {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => {
      if (
        !sidebarNode.current?.contains(document.activeElement) &&
        !document.querySelector('[role="menu"],[role="dialog"]')
      )
        setSidebarPeek(false);
    }, 240);
  }
  useEffect(
    () => () => {
      if (peekTimer.current) clearTimeout(peekTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!sidebarPeek) return;
    const outside = (e: PointerEvent) => {
      if (
        !(e.target as HTMLElement).closest(
          '[data-slot="sidebar-container"],[data-sidebar-toggle],[role="menu"],[role="dialog"],[role="listbox"]',
        )
      )
        setSidebarPeek(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !document.querySelector('[role="menu"],[role="dialog"]')
      )
        setSidebarPeek(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [sidebarPeek]);
  function setSidebarPinned(value: boolean) {
    if (isMobile) {
      setOpenMobile(value);
      return;
    }
    setSidebarPeek(false);
    setOpen(value);
  }
  useEffect(() => {
    // Hydrate from the serialized server snapshot first; use the browser clock
    // only after mounting, including after resuming a tab across midnight.
    const localDate = serverCalendarDate();
    async function initialize() {
      await load();
      const current = serverCalendarDate();
      setToday(current);
      setAnchor(current);
    }
    void initialize();
    let lastDate = localDate;
    const refreshDate = () => {
      const current = serverCalendarDate();
      setToday(current);
      if (current !== lastDate && !pending.current) {
        lastDate = current;
        void load();
      }
    };
    const id = setInterval(refreshDate, 60000);
    window.addEventListener('focus', refreshDate);
    document.addEventListener('visibilitychange', refreshDate);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', refreshDate);
      document.removeEventListener('visibilitychange', refreshDate);
    };
  }, [load, pending]);
  useEffect(() => {
    workspaceScroll.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [section]);
  function chooseView(value: string) {
    if (!allowedViews.includes(value)) return;
    setView(value);
    try {
      localStorage.setItem('patmi:view:' + section, value);
    } catch {}
  }
  async function createLabel(title: string) {
    const existing = labels.find(
      (l) => l.title.toLowerCase() === title.toLowerCase(),
    );
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    await mutate(
      { action: 'saveLabel', item: { id, title, color: '0' } },
      '标签已创建',
    );
    return id;
  }
  function navigate(id: string) {
    setSidebarPeek(false);
    setOpenMobile(false);
    const target = navigationTarget(id);
    const nextSection = target?.section || currentSection(id);
    // Re-selecting the current location must not reset the user's context.
    if (!target && nextSection === section) return;
    setSection(nextSection);
    setTrackingScope(target?.tracking || 'all');
    setTaskFocus(target?.focus || 'all');
    setCompletionFilter(target?.completion || 'all');
    setPriority('all');
    setTaskProjectFilter('all');
    setFolderFilter('all');
    setTagFilter('all');
    setShowFilters(false);
    if (target?.today) setAnchor(today);
    setView(target?.view || rememberedView(nextSection));
    if (target) {
      setClosedGroups((ids) =>
        ids.filter((key) => !key.startsWith(nextSection + ':status:')),
      );
      workspaceScroll.current?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
  function newTask(
    date = section === 'inbox'
      ? ''
      : section === 'today' || taskFocus === 'today'
        ? today
        : view === 'calendar'
          ? anchor
          : '',
    status = 'todo',
  ) {
    setFormError('');
    setTask({
      ...blankTask(date),
      tracking: trackingScope === 'tracked',
      status,
      project: projects.some((p) => p.id === section)
        ? section
        : projects.some((p) => p.id === taskProjectFilter)
          ? taskProjectFilter
          : '',
      priority: priority === 'all' ? 'medium' : priority,
      tags: labels.some((l) => 'label:' + l.id === section)
        ? [section.slice(6)]
        : tagFilter !== 'all'
          ? [tagFilter]
          : [],
    });
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        document.querySelector('[role=dialog],[role=alertdialog],[role=menu]')
      )
        return;
      const input =
        e.target instanceof HTMLElement &&
        !!e.target.closest(
          'input,textarea,[contenteditable=true],[role=combobox]',
        );
      if (
        !input &&
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'f'
      ) {
        e.preventDefault();
        setViewFocused((value) => !value);
      } else if (viewFocused && e.key === 'Escape') {
        e.preventDefault();
        setViewFocused(false);
      } else if (!input && !task && !project && !removal && e.key === 'n') {
        e.preventDefault();
        setFormError('');
        setTask(blankTask(day()));
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [task, project, removal, viewFocused]);
  useEffect(() => {
    if (!viewFocused) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [viewFocused]);
  useEffect(() => {
    const ctx = (document as Document & { modelContext?: TaskToolContext })
      .modelContext;
    if (!ctx?.registerTool) return;
    const ctrl = new AbortController();
    Promise.resolve(
      ctx.registerTool(
        {
          name: 'create_task',
          title: uiCopy.create,
          description: '创建任务并保存到 DayFrame 工作台。',
          inputSchema: {
            type: 'object',
            properties: { title: { type: 'string' }, date: { type: 'string' } },
            required: ['title'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async (input: { title: string; date?: string }) => {
            const t = validateTask({ ...blankTask(), ...input });
            const d = await mutate(
              { action: 'saveTask', task: t },
              uiCopy.taskCreated,
            );
            return { saved: true, totalTasks: d.tasks.length };
          },
        },
        { signal: ctrl.signal },
      ),
    ).catch(() => {});
    return () => ctrl.abort();
  }, [mutate]);
  const activeLabel = labels.find((l) => 'label:' + l.id === section);
  const activeProject = projects.find((p) => p.id === section);
  function editSection() {
    if (busy || !ready) return;
    if (activeProject) projectEdit(activeProject);
    else if (activeLabel)
      setOrganizationEditor({ kind: 'Label', ...activeLabel });
  }
  const title = activeLabel
    ? '#' + activeLabel.title
    : activeProject?.title ||
      nav.find((n) => n.id === section)?.label ||
      '首页';
  const source = useMemo(
    () =>
      tasks.filter(
        (t) =>
          sectionContains(section, t, occursOn(t, today)) &&
          (!activeLabel ||
            t.tags?.includes(activeLabel.id) ||
            projects
              .find((p) => p.id === t.project)
              ?.tags?.includes(activeLabel.id)),
      ),
    [tasks, section, today, activeLabel, projects],
  );
  const matchingTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (completionFilter === 'all' ||
            (completionFilter === 'done'
              ? t.status === 'done'
              : t.status !== 'done')) &&
          matchesTaskFocus(t, taskFocus, today) &&
          trackingMatches(t, trackingScope) &&
          (taskProjectFilter === 'all' ||
            (t.project || '') === taskProjectFilter) &&
          (folderFilter === 'all' ||
            (projects.find((p) => p.id === t.project)?.folder || '') ===
              folderFilter) &&
          (priority === 'all' || t.priority === priority) &&
          (tagFilter === 'all' ||
            t.tags?.includes(tagFilter) ||
            projects
              .find((p) => p.id === t.project)
              ?.tags?.includes(tagFilter)),
      ),
    [
      tasks,
      completionFilter,
      trackingScope,
      taskFocus,
      today,
      taskProjectFilter,
      folderFilter,
      priority,
      tagFilter,
      projects,
    ],
  );
  const filtered = useMemo(() => {
    const sourceIds = new Set(source.map((item) => item.id));
    return matchingTasks
      .filter((t) => sourceIds.has(t.id))
      .sort((a, b) =>
        sort === 'manual'
          ? (a.position || 0) - (b.position || 0)
          : sort === 'priority'
            ? ['high', 'medium', 'low'].indexOf(a.priority) -
              ['high', 'medium', 'low'].indexOf(b.priority)
            : (a.date || '9999').localeCompare(b.date || '9999') ||
              a.time.localeCompare(b.time),
      );
  }, [matchingTasks, source, sort]);
  const batchTasks = useCallback(
    async (next: Task[]) => {
      try {
        await mutate(
          { action: 'saveTasks', tasks: next },
          next.length === 1 && next[0].completionDrag
            ? `已标记 ${next[0].completedOn} 完成`
            : next.length > 1
              ? `已更新 ${next.length} 项任务`
              : '已更新任务',
        );
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    },
    [mutate, setError],
  );
  const quick = useCallback(
    async (t: Task, changes: Partial<Task>) => {
      try {
        await batchTasks([{ ...t, ...changes }]);
      } catch {}
    },
    [batchTasks],
  );
  function askDelete(ids: string[]) {
    const existing = tasks.filter((t) => ids.includes(t.id));
    if (!existing.length || busy) return;
    setFormError('');
    setRemoval({
      id: existing[0].id,
      kind: existing.length === 1 ? 'Task' : 'Tasks',
      title:
        existing.length === 1 ? existing[0].title : `${existing.length} 项任务`,
      ids: existing.map((t) => t.id),
    });
    setDragId('');
  }
  async function saveProject(p: Project) {
    try {
      await mutate({ action: 'saveProject', project: p }, uiCopy.projectSaved);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  function closeProjectEditor() {
    projectDraftForTask.current = false;
    setProject(null);
  }
  function projectEdit(
    p?: Project,
    date?: string,
    end?: string,
    assignToTask = false,
  ) {
    projectDraftForTask.current = assignToTask;
    setFormError('');
    setProject(
      p
        ? { ...p }
        : createProjectDraft({
            folder: folderFilter === 'all' ? '' : folderFilter,
            date,
            end,
          }),
    );
  }
  function deleteProject(p: Project) {
    setFormError('');
    setRemoval({ id: p.id, kind: 'Project', title: p.title });
  }
  async function duplicate(t: Task) {
    try {
      await mutate(
        {
          action: 'saveTask',
          task: { ...t, id: '', title: t.title + '（副本）' },
        },
        '已复制任务',
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function reorderTask(id: string, target: string) {
    if (sort !== 'manual') {
      setError(uiCopy.manualSortHint);
      return;
    }
    try {
      await mutate(
        { action: 'moveItem', kind: 'tasks', id, target },
        '已调整任务顺序',
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const listener = (event: Event) => {
      const d = (event as CustomEvent).detail,
        t = tasks.find((t) => t.id === d.taskId);
      if (t) void quick(t, { project: d.project });
    };
    window.addEventListener('patmi-move-to-project', listener);
    return () => window.removeEventListener('patmi-move-to-project', listener);
  }, [tasks, quick]);
  useEffect(() => {
    const listener = (event: Event) => {
      const d = (event as CustomEvent<{ taskId: string; label: string }>)
        .detail;
      const t = tasks.find((t) => t.id === d.taskId);
      if (
        t &&
        labels.some((l) => l.id === d.label) &&
        !t.tags?.includes(d.label)
      )
        void quick(t, { tags: [...(t.tags || []), d.label] });
    };
    window.addEventListener('patmi-add-label', listener);
    return () => window.removeEventListener('patmi-add-label', listener);
  }, [tasks, labels, quick]);
  const shownProjects = projects
    .map((p) => projectSchedule(p, tasks))
    .filter(
      (p) =>
        (completionFilter === 'all' ||
          (() => {
            const children = tasks.filter((t) => t.project === p.id);
            const complete =
              children.length > 0 && children.every((t) => t.status === 'done');
            return completionFilter === 'done' ? complete : !complete;
          })()) &&
        (folderFilter === 'all' || (p.folder || '') === folderFilter) &&
        (tagFilter === 'all' || p.tags?.includes(tagFilter)),
    )
    .sort((a, b) =>
      projectSort === 'name'
        ? a.title.localeCompare(b.title, 'zh-CN')
        : projectSort === 'date'
          ? (a.start || '9999').localeCompare(b.start || '9999')
          : (a.position || 0) - (b.position || 0),
    );
  // Keep deleted filter targets and labels out of the next committed render.
  {
    if (
      folderFilter !== 'all' &&
      folderFilter &&
      !folders.some((f) => f.id === folderFilter)
    )
      setFolderFilter('all');
    if (tagFilter !== 'all' && !labels.some((l) => l.id === tagFilter))
      setTagFilter('all');
    if (
      taskProjectFilter !== 'all' &&
      taskProjectFilter &&
      !projects.some((p) => p.id === taskProjectFilter)
    )
      setTaskProjectFilter('all');
  }
  {
    if (
      ready &&
      section.startsWith('label:') &&
      !labels.some((l) => 'label:' + l.id === section)
    ) {
      setSection('all');
      setView('list');
    }
  }

  const commonFields: FilterField[] = [
    {
      label: '文件夹',
      value: folderFilter,
      onChange: setFolderFilter,
      options: [
        ['all', '全部文件夹'],
        ['', uiCopy.uncategorized],
        ...folders.map((f) => [f.id, f.title]),
      ],
    },
    {
      label: uiCopy.tags,
      value: tagFilter,
      onChange: setTagFilter,
      options: [['all', '全部标签'], ...labels.map((l) => [l.id, l.title])],
    },
    {
      label: '完成状态',
      value: completionFilter,
      onChange: setCompletionFilter,
      options: [
        ['all', '全部状态'],
        ['active', '未完成'],
        ['done', '已完成'],
      ],
    },
  ];
  const taskFields: FilterField[] = [
    {
      label: '任务范围',
      value: taskFocus,
      onChange: (value) => setTaskFocus(value as TaskFocus),
      options: taskFocusOptions,
    },
    {
      label: '项目',
      value: taskProjectFilter,
      onChange: setTaskProjectFilter,
      options: [
        ['all', '全部项目'],
        ['', uiCopy.noProject],
        ...projects.map((p) => [p.id, p.title]),
      ],
    },
    ...commonFields,
    {
      label: uiCopy.priority,
      value: priority,
      onChange: setPriority,
      options: [['all', '全部优先级'], ...priorities],
    },
    {
      label: '追踪状态',
      value: trackingScope,
      onChange: setTrackingScope,
      options: [
        ['all', uiCopy.allTasks],
        ['tracked', uiCopy.tracking],
        ['untracked', '普通任务'],
      ],
    },
  ];
  const taskSorting: FilterField = {
    label: '任务排序',
    value: sort,
    onChange: setSort,
    options: [
      ['manual', '手动排序'],
      ['date', '按日期'],
      ['priority', '按优先级'],
    ],
  };
  const projectSorting: FilterField = {
    label: '项目排序',
    value: projectSort,
    onChange: setProjectSort,
    options: [
      ['manual', '手动排序'],
      ['name', '按名称'],
      ['date', '按开始日期'],
    ],
  };
  const clearFilters = () => {
    setTaskFocus('all');
    setPriority('all');
    setTagFilter('all');
    setFolderFilter('all');
    setCompletionFilter('all');
    setTrackingScope('all');
    setTaskProjectFilter('all');
  };
  const taskFilterCount = taskFields.filter((f) => f.value !== 'all').length;
  const projectFilterCount = commonFields.filter(
    (f) => f.value !== 'all',
  ).length;

  const viewFilters =
    showFilters ||
    (section === 'projects' ? projectFilterCount : taskFilterCount) > 0 ? (
      <div className="view-filter-panel">
        <FilterPanel
          open={showFilters}
          fields={section === 'projects' ? commonFields : taskFields}
          sorting={section === 'projects' ? projectSorting : taskSorting}
          clear={clearFilters}
        />
      </div>
    ) : null;

  function badge(t: Task) {
    const p = projects.find((p) => p.id === t.project);
    return <ProjectBadge project={p} />;
  }
  function dateLabel(s: string) {
    return !s
      ? uiCopy.unplanned
      : s === today
        ? '今天'
        : s === shift(today, 1)
          ? '明天'
          : `${Number(s.slice(5, 7))}月${Number(s.slice(8))}日`;
  }
  const detailRecordTask = tasks.find((t) => t.id === task?.id);
  async function saveTaskDraft(task: Task) {
    try {
      setFormError('');
      if (
        !task.id &&
        section === 'projects' &&
        projectView === 'calendar' &&
        !task.project
      )
        throw Error(uiCopy.chooseProject);
      const t = validateTask(task);
      const saved = await mutate(
        {
          action: 'saveTask',
          task: t,
        },
        task.id ? uiCopy.taskSaved : uiCopy.taskCreated,
      );
      const updated = saved.tasks.find((item: Task) => item.id === t.id) || t;
      const isNew = !task.id;
      if (isNew || updated.status !== detailRecordTask?.status) {
        setClosedGroups((ids) =>
          ids.filter((key) => key !== statusGroupKey(section, updated.status)),
        );
      }
      const previousPlan = detailRecordTask
        ? originalPlan(detailRecordTask)
        : null;
      const scheduleChanged =
        !previousPlan ||
        task.date !== previousPlan.date ||
        task.time !== previousPlan.time ||
        task.duration !== previousPlan.duration;
      if (updated.date && (isNew || scheduleChanged)) {
        setAnchor(updated.date);
        window.dispatchEvent(
          new CustomEvent('patmi-focus-date', {
            detail: {
              date: updated.date,
              time: updated.time,
            },
          }),
        );
      }
      setTask(null);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }
  async function updateDetailCheckIn(
    action: 'saveCheckIn' | 'deleteCheckIn',
    entry: { date: string; note?: string; minutes?: number },
  ) {
    if (!detailRecordTask) return;
    const before = detailRecordTask;
    const saved = await mutate(
      { action, id: before.id, ...entry },
      action === 'saveCheckIn' ? uiCopy.checkInSaved : uiCopy.checkInDeleted,
    );
    const updated = saved.tasks.find((t: Task) => t.id === before.id);
    // Keep unsaved plan/title edits while reflecting the persisted activity status.
    if (updated)
      setTask((draft) =>
        draft?.id === before.id
          ? {
              ...draft,
              checkins: updated.checkins,
              startedOn: updated.startedOn,
              status:
                draft.status === before.status ? updated.status : draft.status,
            }
          : draft,
      );
    return saved;
  }
  function edit(t: Task, date?: string) {
    setDetailCheckInDate(date);
    setTask({ ...originalPlan(currentCalendarTask(t)) });
    setFormError('');
  }
  function row(t: Task) {
    return (
      <TaskMenu key={t.id} task={t}>
        <div
          onDragOver={(e) => {
            if (sort === 'manual' && !busy) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = e.dataTransfer.getData('text/plain');
            if (id && id !== t.id) void reorderTask(id, t.id);
          }}
          data-drop-kind={sort === 'manual' ? 'insert' : undefined}
          className={
            'taskrow ui-interactive-row ' +
            (t.status === 'done' ? 'completed' : '')
          }
          key={t.id}
        >
          <Checkbox
            className="taskcheck"
            checked={t.status === 'done'}
            disabled={busy}
            aria-label={
              (t.status === 'done' ? '标记未完成：' : '标记完成：') + t.title
            }
            onCheckedChange={(v) =>
              void quick(t, { status: v ? 'done' : 'todo' })
            }
          />
          <div className="task-row-main">
            <button
              className="taskname"
              data-task-id={t.id}
              draggable={!busy}
              onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
              onClick={() => edit(t)}
            >
              {t.title}
              {t.notes && (
                <span className="notesmark" title="有任务备注">
                  {' '}
                  ≡
                </span>
              )}
            </button>
            {t.project || t.tags?.length ? (
              <div className="task-row-identity">
                {badge(t)}
                <span className="rowtags">
                  {(t.tags || []).map((id) => {
                    const l = labels.find((l) => l.id === id);
                    return l ? (
                      <span
                        key={id}
                        className={'pill tag-badge color' + l.color}
                      >
                        #{l.title}
                      </span>
                    ) : null;
                  })}
                </span>
              </div>
            ) : null}
          </div>
          <div className="task-row-actions">
            <TaskCheckInButton task={t} />
            {t.priority === 'high' && (
              <Flag size={13} className="high" aria-label="高优先级" />
            )}
            <button
              className={
                'datebutton ' +
                (t.date &&
                taskStart(t) + t.duration * 60000 <=
                  Date.parse(today + 'T00:00:00Z') &&
                t.status !== 'done'
                  ? 'overdue'
                  : '')
              }
              onClick={() => edit(t)}
            >
              {dateLabel(t.date)}
              {t.date &&
                lastTaskDate(t) !== t.date &&
                `–${dateLabel(lastTaskDate(t))}`}
              {t.time && <span> {t.time}</span>}
            </button>
          </div>
        </div>
      </TaskMenu>
    );
  }
  useNativeEdgeScroll();
  useDragFeedback();
  const scopeControls = (
    <div className="scope-toolbar-controls">
      <FilterToggle
        open={showFilters}
        count={section === 'projects' ? projectFilterCount : taskFilterCount}
        onClick={() => setShowFilters(!showFilters)}
      />
      {((section === 'projects' && projectView === 'board') ||
        (section !== 'projects' &&
          section !== 'today' &&
          (view === 'list' || view === 'board'))) && (
        <GanttCollapseControl
          groupIds={statuses
            .filter(
              ([status]) =>
                section === 'projects' ||
                view === 'board' ||
                filtered.some((t) => t.status === status),
            )
            .map(([status]) => groupKey(status))}
          collapsed={closedGroups}
          setCollapsed={setClosedGroups}
          disabled={busy}
          subject="分组"
        />
      )}
      <span className="view-result-count">
        {section === 'projects'
          ? `${shownProjects.length} 个项目`
          : `${filtered.length} 项`}
      </span>
    </div>
  );
  return (
    <TaskActionsProvider
      value={{
        projects,
        labels,
        busy,
        today,
        checkIn: (t, date) => {
          setCheckInDate(date);
          setCheckInId(t.id);
        },
        toggleCheckIn: (t, date) => {
          const entry = t.checkins?.find((c) => c.date === date);
          void mutate(
            entry
              ? { action: 'deleteCheckIn', id: t.id, date }
              : { action: 'saveCheckIn', id: t.id, date, note: '', minutes: 0 },
            entry ? '已撤销当日打卡' : uiCopy.checkInSaved,
          ).catch((e) => setError(e.message));
        },
        edit,
        update: (t, c) => void quick(t, c),
        remove: askDelete,
        duplicate: (t) => void duplicate(t),
      }}
    >
      {checkInTask && (
        <CheckInDialog
          initialDate={checkInDate}
          task={checkInTask}
          project={projects.find((p) => p.id === checkInTask.project)}
          today={today}
          busy={busy}
          onClose={() => setCheckInId('')}
          onSave={(entry) =>
            mutate(
              { action: 'saveCheckIn', id: checkInTask.id, ...entry },
              uiCopy.checkInSaved,
            )
          }
          onRemove={(date) =>
            mutate(
              { action: 'deleteCheckIn', id: checkInTask.id, date },
              uiCopy.checkInDeleted,
            )
          }
        />
      )}
      {interfaceOpen && (
        <InterfaceSettings
          preferences={preferences}
          busy={busy}
          onClose={() => setInterfaceOpen(false)}
          save={mutate}
        />
      )}
      <style>
        {colorRules([
          ...projects.map((p) => p.color),
          ...labels.map((l) => l.color),
        ])}
      </style>
      <div
        className="workspaceRoot"
        data-motion="on"
        style={
          {
            '--sidebar-width': '256px',
          } as React.CSSProperties
        }
        onDragStartCapture={(e) => {
          if ((e.target as HTMLElement).closest('.ribbon-handle')) return;
          const el = (e.target as HTMLElement).closest<HTMLElement>(
            '[data-task-id]',
          );
          if (el) setDragId(el.dataset.taskId || '');
        }}
        onDragEndCapture={() => {
          setDragId('');
        }}
      >
        <Sidebar
          ref={isMobile ? undefined : sidebarNode}
          className={sidebarPeek && !open ? 'sidebar-peek' : ''}
          inert={!isMobile && !open && !sidebarPeek}
          onMouseEnter={showPeek}
          onMouseLeave={hidePeekSoon}
          onBlur={hidePeekSoon}
        >
          <SidebarHeader>
            <div className="brand">
              <span className="mark">D.</span>DayFrame
              <button
                className="iconbtn sidebar-pin"
                disabled={busy}
                title={open || isMobile ? '收起侧栏' : '固定侧栏'}
                aria-label={open || isMobile ? '收起侧栏' : '固定侧栏'}
                onClick={() => setSidebarPinned(isMobile ? false : !open)}
              >
                {open || isMobile ? (
                  <PanelLeftClose size={17} />
                ) : (
                  <Pin size={16} />
                )}
              </button>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <div className="navspace">
              <SidebarMenu>
                {preferences.navOrder
                  .filter((id) => id !== 'tracking')
                  .map((id) => nav.find((n) => n.id === id)!)
                  .filter(Boolean)
                  .map((n) => (
                    <SidebarMenuItem
                      key={n.id}
                      className={
                        n.id === 'tracking' ? 'tracking-nav-child' : undefined
                      }
                    >
                      <SidebarMenuButton
                        isActive={section === n.id}
                        onClick={() => navigate(n.id)}
                      >
                        <n.icon />
                        <span>{navigationNames[n.id] || n.label}</span>
                        {n.id === 'inbox' && tasks.some((t) => !t.date) && (
                          <small className="navcount">
                            {tasks.filter((t) => !t.date).length}
                          </small>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
              <Organization
                editor={organizationEditor}
                onEditorChange={setOrganizationEditor}
                projects={projects}
                folders={folders}
                labels={labels}
                active={section}
                busy={busy}
                navigate={navigate}
                editProject={projectEdit}
                deleteProject={deleteProject}
                save={mutate}
              />
            </div>
          </SidebarContent>
          <SidebarFooter>
            <div className="profile">
              <span className="avatar">L</span>
              <span className="workspace-profile-name" title={preferences.name}>
                {preferences.name}
              </span>
              <button
                type="button"
                className="iconbtn workspace-settings-button"
                aria-label="设置"
                title="设置"
                onClick={() => setInterfaceOpen(true)}
              >
                <Settings2 size={17} />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <div className="workspace-scroll" ref={workspaceScroll}>
            <main
              className="main page-shell"
              key={section}
              data-section={section}
              data-focused={viewFocused}
              aria-label={viewFocused ? `${title}专注视图` : undefined}
            >
              <div
                className={
                  'heading page-header' +
                  (section !== 'today' ? ' has-module-navigation' : '')
                }
              >
                <div>
                  <h1 className="section-title-row">
                    {(!open || isMobile) && (
                      <button
                        className="iconbtn sidebar-reveal"
                        data-sidebar-toggle
                        title="显示侧栏"
                        aria-label="显示侧栏"
                        aria-expanded={isMobile ? openMobile : sidebarPeek}
                        disabled={busy}
                        onMouseEnter={showPeek}
                        onMouseLeave={hidePeekSoon}
                        onClick={() =>
                          setSidebarPinned(isMobile ? !openMobile : true)
                        }
                      >
                        <PanelLeft size={18} />
                      </button>
                    )}
                    {activeProject || activeLabel ? (
                      <button
                        type="button"
                        className="editable-section-title"
                        title="双击编辑名称及详情"
                        onDoubleClick={editSection}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'F2') {
                            e.preventDefault();
                            editSection();
                          }
                        }}
                      >
                        {title}
                      </button>
                    ) : (
                      title
                    )}
                  </h1>
                  {(activeProject?.description || section === 'today') && (
                    <p>{activeProject?.description || dateHeading(today)}</p>
                  )}
                </div>
                <div className="module-heading-row page-toolbar">
                  {ready &&
                    section !== 'today' &&
                    (section === 'projects' ? (
                      <Tabs
                        value={projectView}
                        onValueChange={(v) => {
                          const next = String(v);
                          setProjectView(next);
                        }}
                      >
                        <TabsList
                          variant="default"
                          className="module-view-tabs"
                        >
                          <TabsTrigger value="cards">
                            <Layers size={14} />
                            总览
                          </TabsTrigger>
                          <TabsTrigger value="list">
                            <List size={14} />
                            列表
                          </TabsTrigger>
                          <TabsTrigger value="board">
                            <Columns3 size={14} />
                            看板
                          </TabsTrigger>
                          <TabsTrigger value="calendar">
                            <CalendarDays size={14} />
                            日历
                          </TabsTrigger>
                          <TabsTrigger value="gantt">
                            <ChartNoAxesGantt size={14} />
                            甘特图
                          </TabsTrigger>
                          <TabsTrigger value="heatmap">
                            <Grid2X2 size={14} />
                            热力图
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    ) : (
                      <Tabs
                        value={view}
                        onValueChange={(v) => chooseView(String(v))}
                      >
                        <TabsList
                          variant="default"
                          className={
                            'module-view-tabs ' +
                            (allowedViews.length === 1 ? 'single-view' : '')
                          }
                        >
                          {(
                            [
                              ['list', '列表', List],
                              ['board', '看板', Columns3],
                              ['calendar', '日历', CalendarDays],
                              ['timeline', '甘特图', ChartNoAxesGantt],
                              ['heatmap', '热力图', Grid2X2],
                            ] as const
                          )
                            .filter(([v]) => allowedViews.includes(String(v)))
                            .map(([v, l, Icon]) => (
                              <TabsTrigger key={v} value={v}>
                                <Icon />
                                {l}
                              </TabsTrigger>
                            ))}
                        </TabsList>
                      </Tabs>
                    ))}
                  <div className="headingactions page-header-actions">
                    <button
                      className="subtle view-focus-button"
                      aria-pressed={viewFocused}
                      aria-label={viewFocused ? '退出专注模式' : '进入专注模式'}
                      title={
                        viewFocused
                          ? '退出专注模式（Esc 或 ⌘⇧F）'
                          : '专注模式（⌘⇧F，Windows 使用 Ctrl+Shift+F）'
                      }
                      onClick={() => setViewFocused((value) => !value)}
                    >
                      {viewFocused ? (
                        <Minimize2 size={16} />
                      ) : (
                        <Maximize2 size={16} />
                      )}
                      <span>{viewFocused ? '退出专注' : '专注'}</span>
                    </button>
                    <button
                      className="primary"
                      disabled={!ready || busy}
                      onClick={() =>
                        section === 'projects' ? projectEdit() : newTask()
                      }
                    >
                      <Plus size={16} />
                      {section === 'projects'
                        ? uiCopy.newProject
                        : uiCopy.newTask}
                    </button>
                  </div>
                </div>
              </div>
              {error && (
                <div role="alert" className="error">
                  {error}
                  <button onClick={() => void load()}>
                    <RotateCw size={14} />
                    重新加载
                  </button>
                  <button onClick={() => setError('')} aria-label="关闭提示">
                    ×
                  </button>
                </div>
              )}
              {!ready ? (
                <div className="empty">
                  <RotateCw size={24} />
                  <p>{error ? uiCopy.connectionFailed : uiCopy.loading}</p>
                </div>
              ) : section === 'today' ? (
                <>
                  <HomeDashboard
                    tasks={tasks}
                    projects={projects}
                    today={today}
                    busy={busy}
                    query=""
                    onEdit={edit}
                    onUpdate={(t, c) => void quick(t, c)}
                    onNew={(date) => newTask(date)}
                    navigate={navigate}
                  />
                </>
              ) : section === 'projects' ? (
                <div className="workspace fullwidth">
                  <section
                    className="content-surface project-view-surface"
                    key={projectView}
                  >
                    {['cards', 'list', 'board'].includes(projectView) && (
                      <ViewToolbar className="viewbar projecttoolbar page-toolbar">
                        {scopeControls}
                      </ViewToolbar>
                    )}
                    {['cards', 'list', 'board'].includes(projectView) &&
                      viewFilters}
                    {projectView === 'list' || projectView === 'board' ? (
                      <ProjectCollection
                        view={projectView}
                        collapsed={statuses
                          .filter(([status]) =>
                            closedGroups.includes(groupKey(status)),
                          )
                          .map(([status]) => status)}
                        onToggleGroup={(status) =>
                          toggleGroup(groupKey(status))
                        }
                        projects={shownProjects}
                        tasks={tasks}
                        folders={folders}
                        labels={labels}
                        onOpen={navigate}
                        onEdit={projectEdit}
                        busy={busy}
                        onColorChange={(project, color) =>
                          void saveProject({ ...project, color })
                        }
                        onDelete={deleteProject}
                        onNew={() => projectEdit()}
                      />
                    ) : projectView === 'heatmap' ? (
                      <Suspense fallback={<ViewLoading />}>
                        <ActivityHeatmap
                          toolbarStart={scopeControls}
                          toolbarBelow={viewFilters}
                          groupByProject
                          tasks={tasks}
                          projects={shownProjects}
                          today={today}
                          onEdit={edit}
                        />
                      </Suspense>
                    ) : projectView === 'gantt' ? (
                      <Suspense fallback={<ViewLoading />}>
                        <ProjectGantt
                          toolbarStart={scopeControls}
                          toolbarBelow={viewFilters}
                          onNewTask={(project, date) => {
                            setFormError('');
                            setTask({ ...blankTask(date || ''), project });
                          }}
                          onOrderTask={(id, target, after) => {
                            void mutate(
                              {
                                action: 'moveItem',
                                kind: 'tasks',
                                id,
                                target,
                                after,
                                preserveStatus: true,
                              },
                              '任务顺序已更新',
                            ).catch((e) => setError(e.message));
                          }}
                          tasks={tasks.filter((t) =>
                            shownProjects.some(
                              (project) => project.id === t.project,
                            ),
                          )}
                          projects={shownProjects}
                          busy={busy}
                          onNew={(date, end) =>
                            projectEdit(undefined, date, end)
                          }
                          onEditTask={edit}
                          onEditProject={projectEdit}
                          onMoveTask={(t, c) => void quick(t, c)}
                          onSaveProject={saveProject}
                          onBatchMoveTasks={batchTasks}
                          onDeleteProject={deleteProject}
                        />
                      </Suspense>
                    ) : projectView === 'calendar' ? (
                      <Suspense fallback={<ViewLoading />}>
                        <CalendarView
                          toolbarStart={scopeControls}
                          toolbarBelow={viewFilters}
                          tasks={tasks.filter((t) =>
                            shownProjects.some((p) => p.id === t.project),
                          )}
                          allTasks={tasks}
                          projects={shownProjects}
                          today={today}
                          date={anchor}
                          onDateChange={setAnchor}
                          busy={busy}
                          scopeKey="project-calendar"
                          onEdit={edit}
                          onMove={quick}
                          onBatch={batchTasks}
                          onDelete={askDelete}
                          onNew={(date, time, duration) => {
                            setFormError('');
                            setTask({
                              ...blankTask(date),
                              time: time || '',
                              duration: duration || 1440,
                              project:
                                shownProjects.length === 1
                                  ? shownProjects[0].id
                                  : '',
                            });
                          }}
                        />
                      </Suspense>
                    ) : (
                      <div className="projectgrid">
                        {shownProjects.map((p) => {
                          return (
                            <ItemMenu
                              key={p.id}
                              color={p.color}
                              busy={busy}
                              onColorChange={(color) =>
                                void saveProject({ ...p, color })
                              }
                              edit={() => projectEdit(p)}
                              remove={() => deleteProject(p)}
                            >
                              {/* Drag alternative; keyboard users use the card buttons and menus. */}
                              {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                              <article
                                className="projectcard"
                                draggable={projectSort === 'manual' && !busy}
                                onDragStart={(e) =>
                                  e.dataTransfer.setData(
                                    'application/x-patmi-project',
                                    p.id,
                                  )
                                }
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const id = e.dataTransfer.getData(
                                    'application/x-patmi-project',
                                  );
                                  if (
                                    id &&
                                    id !== p.id &&
                                    projectSort === 'manual'
                                  )
                                    void mutate({
                                      action: 'moveItem',
                                      kind: 'projects',
                                      id,
                                      target: p.id,
                                    }).catch((e) => setError(e.message));
                                }}
                              >
                                <ProjectOverviewContent
                                  project={p}
                                  tasks={tasks}
                                  folders={folders}
                                  labels={labels}
                                  onOpen={() => navigate(p.id)}
                                />
                              </article>
                            </ItemMenu>
                          );
                        })}
                        <button
                          className="newproject content-create-action"
                          onClick={() => projectEdit()}
                        >
                          <Plus size={23} />
                          {uiCopy.newProject}
                        </button>
                      </div>
                    )}
                  </section>
                </div>
              ) : (
                <>
                  <div
                    className={
                      'workspace ' +
                      (view !== 'list' || section !== 'today'
                        ? 'fullwidth'
                        : '')
                    }
                  >
                    <section className="content-surface">
                      <Tabs
                        className={
                          view === 'list' ? 'task-list-tabs' : undefined
                        }
                        value={view}
                        onValueChange={(v) => chooseView(String(v))}
                      >
                        {!['calendar', 'timeline', 'heatmap'].includes(
                          view,
                        ) && (
                          <ViewToolbar className="viewbar page-toolbar">
                            {scopeControls}
                          </ViewToolbar>
                        )}
                        {!['calendar', 'timeline', 'heatmap'].includes(view) &&
                          viewFilters}

                        <TabsContent value="list" className="task-list-content">
                          {view === 'list' && (
                            <>
                              {statuses.map(([s, label]) => {
                                const group = filtered.filter(
                                  (t) => t.status === s,
                                );
                                return group.length ? (
                                  <div key={s}>
                                    <div className="sectionlabel">
                                      <span className={'statusdot ' + s} />
                                      <button
                                        className="group-disclosure"
                                        aria-expanded={
                                          !closedGroups.includes(groupKey(s))
                                        }
                                        onClick={() => toggleGroup(groupKey(s))}
                                      >
                                        {label}
                                        <small>{group.length}</small>
                                      </button>
                                    </div>
                                    {!closedGroups.includes(groupKey(s)) &&
                                      group.map(row)}
                                  </div>
                                ) : null;
                              })}
                              {!filtered.length && (
                                <div className="empty content-empty content-empty-panel">
                                  <CheckCheck size={30} />
                                  <h3>
                                    {taskFilterCount > 0
                                      ? uiCopy.noTaskResults
                                      : uiCopy.noTasks}
                                  </h3>
                                  {taskFilterCount > 0 && (
                                    <p>{uiCopy.searchHint}</p>
                                  )}
                                </div>
                              )}
                              <button
                                className="addrow inline-create-action"
                                onClick={() => newTask()}
                              >
                                <Plus size={16} />
                                {uiCopy.newTask}
                                <kbd>N</kbd>
                              </button>
                            </>
                          )}
                        </TabsContent>
                        <TabsContent value="board">
                          {view === 'board' && (
                            <>
                              <div className="board">
                                {statuses.map(([s, l]) => (
                                  <div
                                    className="column"
                                    data-drop-kind="status"
                                    data-drop-label={l}
                                    key={s}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      const t = tasks.find(
                                        (t) =>
                                          t.id ===
                                          e.dataTransfer.getData('text/plain'),
                                      );
                                      if (t && !busy)
                                        void quick(t, { status: s });
                                    }}
                                  >
                                    <div className="columnhead">
                                      <span className={'statusdot ' + s} />
                                      <button
                                        className="group-disclosure"
                                        aria-expanded={
                                          !closedGroups.includes(groupKey(s))
                                        }
                                        onClick={() => toggleGroup(groupKey(s))}
                                      >
                                        {l}
                                        <small>
                                          {
                                            filtered.filter(
                                              (t) => t.status === s,
                                            ).length
                                          }
                                        </small>
                                      </button>
                                      <button
                                        className="iconbtn"
                                        aria-label={'新建' + l + '任务'}
                                        onClick={() => newTask(undefined, s)}
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>
                                    <div
                                      className="group-content"
                                      hidden={closedGroups.includes(
                                        groupKey(s),
                                      )}
                                    >
                                      {filtered
                                        .filter((t) => t.status === s)
                                        .map((t) => (
                                          <TaskMenu key={t.id} task={t}>
                                            {/* Drag alternative; keyboard users use the card buttons and menus. */}
                                            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                                            <article
                                              className="boardcard"
                                              data-drop-kind={
                                                sort === 'manual'
                                                  ? 'insert'
                                                  : 'status-child'
                                              }
                                              onDragOver={(e) =>
                                                e.preventDefault()
                                              }
                                              onDrop={(e) => {
                                                if (sort !== 'manual') return;
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const id =
                                                  e.dataTransfer.getData(
                                                    'text/plain',
                                                  );
                                                if (id && id !== t.id)
                                                  void reorderTask(id, t.id);
                                              }}
                                              key={t.id}
                                              data-task-id={t.id}
                                              draggable={!busy}
                                              onDragStart={(e) =>
                                                e.dataTransfer.setData(
                                                  'text/plain',
                                                  t.id,
                                                )
                                              }
                                            >
                                              <div className="board-card-header">
                                                <button
                                                  onClick={() => edit(t)}
                                                  className={
                                                    'boardtitle ' +
                                                    (s === 'done'
                                                      ? 'strike'
                                                      : '')
                                                  }
                                                >
                                                  {t.title}
                                                </button>
                                                <TaskCheckInButton task={t} />
                                              </div>
                                              {(t.project ||
                                                (t.tags || []).length > 0) && (
                                                <div className="board-identity">
                                                  {badge(t)}
                                                  <span className="board-tags">
                                                    {(t.tags || []).map(
                                                      (id) => {
                                                        const label =
                                                          labels.find(
                                                            (item) =>
                                                              item.id === id,
                                                          );
                                                        return label ? (
                                                          <span
                                                            key={id}
                                                            className={
                                                              'pill tag-badge color' +
                                                              label.color
                                                            }
                                                          >
                                                            #{label.title}
                                                          </span>
                                                        ) : null;
                                                      },
                                                    )}
                                                  </span>
                                                </div>
                                              )}
                                              <div className="board-card-footer">
                                                <Picker
                                                  label={uiCopy.status}
                                                  value={t.status}
                                                  onChange={(status) =>
                                                    void quick(t, { status })
                                                  }
                                                  options={statuses}
                                                />
                                                <div className="cardmeta">
                                                  <span
                                                    className={
                                                      t.priority === 'high'
                                                        ? 'high'
                                                        : ''
                                                    }
                                                  >
                                                    {
                                                      priorities.find(
                                                        ([p]) =>
                                                          p === t.priority,
                                                      )?.[1]
                                                    }
                                                  </span>
                                                  <span>
                                                    {dateLabel(t.date)}
                                                  </span>
                                                </div>
                                              </div>
                                            </article>
                                          </TaskMenu>
                                        ))}
                                      <button
                                        className="addrow inline-create-action"
                                        onClick={() => newTask(undefined, s)}
                                      >
                                        <Plus size={14} />
                                        {uiCopy.newTask}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </TabsContent>
                        <TabsContent value="calendar">
                          {view === 'calendar' && (
                            <>
                              <Suspense fallback={<ViewLoading />}>
                                <CalendarView
                                  toolbarStart={scopeControls}
                                  toolbarBelow={viewFilters}
                                  tasks={filtered}
                                  allTasks={tasks}
                                  projects={projects}
                                  today={today}
                                  date={anchor}
                                  onDateChange={setAnchor}
                                  busy={busy}
                                  scopeKey={section}
                                  onEdit={edit}
                                  onMove={quick}
                                  onBatch={batchTasks}
                                  onDelete={askDelete}
                                  onNew={(date, time, duration) => {
                                    setFormError('');
                                    setTask({
                                      ...blankTask(date),
                                      time: time || '',
                                      duration: duration || 1440,
                                      project: activeProject?.id || '',
                                      tags: activeLabel ? [activeLabel.id] : [],
                                      tracking: trackingScope === 'tracked',
                                    });
                                  }}
                                />
                              </Suspense>
                            </>
                          )}
                        </TabsContent>
                        <TabsContent value="heatmap">
                          {view === 'heatmap' && (
                            <>
                              <Suspense fallback={<ViewLoading />}>
                                <ActivityHeatmap
                                  toolbarStart={scopeControls}
                                  toolbarBelow={viewFilters}
                                  key={section}
                                  project={activeProject}
                                  tasks={filtered}
                                  projects={projects}
                                  today={today}
                                  onEdit={edit}
                                />
                              </Suspense>
                            </>
                          )}
                        </TabsContent>
                        <TabsContent value="timeline">
                          {view === 'timeline' && (
                            <>
                              <Suspense fallback={<ViewLoading />}>
                                <ProgressDashboard
                                  toolbarStart={scopeControls}
                                  toolbarBelow={viewFilters}
                                  key={section}
                                  tasks={filtered}
                                  projects={projects}
                                  today={today}
                                  busy={busy}

                                  scope={trackingScope}
                                  onEdit={edit}
                                  onMove={quick}
                                  onOrder={
                                    sort === 'manual'
                                      ? (id, target, after) => {
                                          void mutate(
                                            {
                                              action: 'moveItem',
                                              kind: 'tasks',
                                              id,
                                              target,
                                              after,
                                              preserveStatus: true,
                                            },
                                            '任务顺序已更新',
                                          ).catch((e) => setError(e.message));
                                        }
                                      : undefined
                                  }
                                />
                              </Suspense>
                            </>
                          )}
                        </TabsContent>
                      </Tabs>
                    </section>
                  </div>
                </>
              )}
              <footer className="workspacefoot">
                <span className="footmark">D.</span>{' '}
                <span>N 新建任务 · ⌘⇧F 专注</span>
              </footer>
            </main>
          </div>
        </SidebarInset>
        <TaskEditor
          task={task}
          detailRecordTask={detailRecordTask}
          projects={projects}
          labels={labels}
          today={today}
          busy={busy}
          formError={formError}
          detailCheckInDate={detailCheckInDate}
          onChange={setTask}
          setFormError={setFormError}
          onClose={() => setTask(null)}
          onSave={saveTaskDraft}
          onDelete={askDelete}
          onCreateProject={() =>
            projectEdit(undefined, undefined, undefined, true)
          }
          onCreateLabel={createLabel}
          onSaveCheckIn={(entry) => updateDetailCheckIn('saveCheckIn', entry)}
          onRemoveCheckIn={(date) =>
            updateDetailCheckIn('deleteCheckIn', { date })
          }
        />
        <ProjectEditor
          key={project?.id || 'closed'}
          project={project}
          projects={projects}
          folders={folders}
          labels={labels}
          busy={busy}
          onChange={setProject}
          onCreateLabel={createLabel}
          onDelete={deleteProject}
          onClose={closeProjectEditor}
          onSave={async (draft) => {
            await mutate(
              { action: 'saveProject', project: draft },
              isSavedProject(draft, projects)
                ? uiCopy.projectSaved
                : uiCopy.projectCreated,
            );
            if (projectDraftForTask.current) {
              setTask((current) =>
                current ? { ...current, project: draft.id } : current,
              );
            }
          }}
        />
        <AlertDialog
          open={!!removal}
          onOpenChange={(open) => {
            if (!open && !busy) setRemoval(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogTitle>删除「{removal?.title}」？</AlertDialogTitle>
            <AlertDialogDescription>
              {removal?.kind === 'Project'
                ? uiCopy.deleteProjectHint
                : uiCopy.deleteTaskHint}
            </AlertDialogDescription>
            {removal?.ids && removal.ids.length > 1 && (
              <ul className="deletelist">
                {tasks
                  .filter((t) => removal.ids!.includes(t.id))
                  .map((t) => (
                    <li key={t.id}>{t.title}</li>
                  ))}
              </ul>
            )}
            {formError && (
              <p className="formerror" role="alert">
                {formError}
              </p>
            )}
            <div className="formfooter">
              <button
                className="subtle"
                disabled={busy}
                onClick={() => setRemoval(null)}
              >
                {uiCopy.cancel}
              </button>
              <button
                className="primary deleteconfirm"
                disabled={busy}
                onClick={async () => {
                  if (!removal) return;
                  try {
                    if (removal.kind === 'Project') {
                      await mutate(
                        { action: 'deleteProject', id: removal.id },
                        '已删除项目',
                      );
                      closeProjectEditor();
                      if (section === removal.id) navigate('projects');
                    } else {
                      const ids = removal.ids || [removal.id];
                      await mutate(
                        { action: 'deleteTasks', ids },
                        `已删除 ${ids.length} 项任务`,
                      );
                      setTask(null);
                    }
                    setRemoval(null);
                  } catch (e) {
                    setFormError((e as Error).message);
                  }
                }}
              >
                {busy
                  ? uiCopy.deleting
                  : removal?.kind === 'Project'
                    ? uiCopy.deleteProject
                    : uiCopy.deleteTask}
              </button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
        {dragId && (
          <DragActionDock
            disabled={busy}
            onDrop={(action, event) => {
              const id = event.dataTransfer.getData('text/plain') || dragId;
              if (action === 'delete') askDelete([id]);
              else {
                const task = tasks.find((task) => task.id === id);
                setDragId('');
                if (task) void quick(task, unplan(task));
              }
            }}
          />
        )}
        {notice && (
          <output className="toast">
            <Check size={15} />
            <span>{notice}</span>
            {undo && (
              <button disabled={busy} onClick={() => void undoLast()}>
                撤销
              </button>
            )}
            <button
              className="toastclose"
              aria-label="关闭提示"
              onClick={() => {
                setNotice('');
              }}
            >
              ×
            </button>
          </output>
        )}
      </div>
    </TaskActionsProvider>
  );
}
