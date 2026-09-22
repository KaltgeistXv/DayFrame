import { surfaceMotionClass } from './motion-style';
export const overlayPositionerClass =
  'isolate z-[var(--layer-overlay)] outline-none';

export const overlaySurfaceClass =
  surfaceMotionClass + ' ' + 'max-w-[min(var(--available-width,100vw),calc(100vw-1rem))] border border-border bg-popover text-popover-foreground [border-radius:var(--ui-radius-lg)] [box-shadow:var(--ui-shadow-popover)]';
