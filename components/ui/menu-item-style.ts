/** Select, dropdown and context menus share one item geometry. */
export const menuItemClass = "relative flex min-h-[var(--ui-menu-row-height)] cursor-default items-center gap-[var(--ui-control-gap)] [border-radius:var(--ui-menu-row-radius)] py-[var(--ui-menu-row-padding-y)] text-[length:var(--ui-text-body)] outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

/** Context and dropdown submenus share the same open/focus behavior. */
export const menuSubTriggerClass = menuItemClass + ' px-[var(--ui-menu-row-padding-x)] focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground data-inset:pl-7';
