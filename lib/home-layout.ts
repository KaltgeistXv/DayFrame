export type HomeCard = {
  id: string;
  title: string;
  width: 'half' | 'full';
  height: number;
  collapsed: boolean;
};
export type HomeLayout = { cards: HomeCard[]; sidebarWidth: number };
export const defaultHomeLayout: HomeLayout = {
  sidebarWidth: 256,
  cards: [
    {
      id: 'today',
      title: '今日重点',
      width: 'half',
      height: 340,
      collapsed: false,
    },
    {
      id: 'tracking',
      title: '任务追踪',
      width: 'half',
      height: 340,
      collapsed: false,
    },
    {
      id: 'projects',
      title: '项目进度',
      width: 'half',
      height: 340,
      collapsed: false,
    },
    {
      id: 'inbox',
      title: '收集箱',
      width: 'half',
      height: 340,
      collapsed: false,
    },
  ],
};
export function validateHomeLayout(value: unknown): HomeLayout {
  const v = value as HomeLayout;
  if (
    !v ||
    !Array.isArray(v.cards) ||
    v.cards.length !== 4 ||
    new Set(v.cards.map((c) => c?.id)).size !== 4 ||
    !Number.isInteger(v.sidebarWidth) ||
    v.sidebarWidth < 220 ||
    v.sidebarWidth > 340
  )
    throw Error('首页布局无效');
  return {
    sidebarWidth: v.sidebarWidth,
    cards: v.cards.map((c) => {
      if (
        !c ||
        !defaultHomeLayout.cards.some((d) => d.id === c.id) ||
        typeof c.title !== 'string' ||
        !c.title.trim() ||
        c.title.length > 30 ||
        !['half', 'full'].includes(c.width) ||
        !Number.isInteger(c.height) ||
        c.height < 220 ||
        c.height > 600 ||
        typeof c.collapsed !== 'boolean'
      )
        throw Error('卡片设置无效');
      return {
        id: c.id,
        title: c.title.trim(),
        width: c.width,
        height: c.height,
        collapsed: c.collapsed,
      };
    }),
  };
}
export function normalizedHomeLayout(value: unknown): HomeLayout {
  try {
    return validateHomeLayout(value);
  } catch {
    return structuredClone(defaultHomeLayout);
  }
}
export function reorderHomeCard(
  layout: HomeLayout,
  source: string,
  target: string,
): HomeLayout {
  const from = layout.cards.find((c) => c.id === source);
  if (!from || source === target || !layout.cards.some((c) => c.id === target))
    return layout;
  const cards = layout.cards.filter((c) => c.id !== source);
  cards.splice(
    layout.cards.findIndex((c) => c.id === target),
    0,
    from,
  );
  return { ...layout, cards };
}
