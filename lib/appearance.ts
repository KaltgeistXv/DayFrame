export const navigationIds = ['today', 'inbox', 'all', 'projects'];
export const navigationNames: Record<string, string> = {
  today: '首页',
  inbox: '收集箱',
  all: '任务',
  projects: '项目',
};
export function currentSection(id: string) {
  return ['tracking', 'schedule'].includes(id) ? 'all' : id;
}
export function navigationOrder(order: string[]) {
  return [
    ...new Set([
      ...order.filter((id) => navigationIds.includes(id)),
      ...navigationIds,
    ]),
  ];
}
export type Appearance = {
  sidebarVisible: boolean;
  showProjects: boolean;
  showTags: boolean;
  showSearch: boolean;
  showProfile: boolean;
  hiddenNav: string[];
  sidebarWidth: number;
  motion: boolean;
};
export const defaultAppearance: Appearance = {
  sidebarVisible: true,
  showProjects: true,
  showTags: true,
  showSearch: true,
  showProfile: true,
  hiddenNav: [],
  sidebarWidth: 256,
  motion: true,
};
export function validateAppearance(value: unknown): Appearance {
  const a = value as Appearance;
  if (
    !a ||
    [
      'sidebarVisible',
      'showProjects',
      'showTags',
      'showSearch',
      'showProfile',
      'motion',
    ].some((k) => typeof a[k as keyof Appearance] !== 'boolean') ||
    !Number.isInteger(a.sidebarWidth) ||
    a.sidebarWidth < 220 ||
    a.sidebarWidth > 340 ||
    !Array.isArray(a.hiddenNav) ||
    new Set(a.hiddenNav).size !== a.hiddenNav.length ||
    a.hiddenNav.some(
      (id) =>
        !navigationIds.includes(id) && !['tracking', 'schedule'].includes(id),
    )
  )
    throw Error('界面设置无效');
  return {
    sidebarVisible: a.sidebarVisible,
    showProjects: a.showProjects,
    showTags: a.showTags,
    showSearch: a.showSearch,
    showProfile: a.showProfile,
    hiddenNav: a.hiddenNav.filter(
      (id) => !['tracking', 'schedule'].includes(id),
    ),
    sidebarWidth: a.sidebarWidth,
    motion: a.motion,
  };
}
export function appearanceOf(value: unknown): Appearance {
  try {
    return validateAppearance(value);
  } catch {
    return { ...defaultAppearance, hiddenNav: [] };
  }
}
