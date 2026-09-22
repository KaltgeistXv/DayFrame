// Keep snap timing consistent across horizontal days and vertical month weeks.
export function animateCalendarSnap(
  node: HTMLElement,
  axis: 'scrollLeft' | 'scrollTop',
  target: number,
  canContinue: () => boolean,
  onFinish: () => void,
): (() => void) | null {
  const view = node.ownerDocument.defaultView;
  if (!view) return null;
  const origin = node[axis];
  if (Math.abs(target - origin) <= 0.5) return null;
  if (view.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    node[axis] = target;
    onFinish();
    return null;
  }
  const started = view.performance.now();
  let frame = 0;
  let active = true;
  let expected = origin;
  const finish = () => {
    if (!active) return;
    active = false;
    view.cancelAnimationFrame(frame);
    onFinish();
  };
  const tick = (now: number) => {
    // A navigation, render-window rebase or user scroll must take precedence.
    if (!canContinue() || Math.abs(node[axis] - expected) > 1) {
      finish();
      return;
    }
    const progress = Math.min(1, Math.max(0, (now - started) / 320));
    const eased =
      progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    node[axis] = progress === 1 ? target : origin + (target - origin) * eased;
    expected = node[axis];
    if (progress === 1) finish();
    else frame = view.requestAnimationFrame(tick);
  };
  frame = view.requestAnimationFrame(tick);
  return finish;
}

// Wait for input AND inertial scrolling to go quiet. Animation-generated scrolls
// cannot schedule another snap; each rest position produces at most one animation.
export function bindCalendarSnap(
  node: HTMLElement,
  axis: 'scrollLeft' | 'scrollTop',
  target: () => number,
  allowed: () => boolean,
) {
  const view = node.ownerDocument.defaultView;
  if (!view) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | null = null;
  let pointerDown = false;
  let resting: number | null = null;
  const clear = () => { clearTimeout(timer); timer = undefined; };
  const interrupt = () => { clear(); cancel?.(); cancel = null; };
  const schedule = () => {
    if (cancel || pointerDown || (resting !== null && Math.abs(node[axis] - resting) <= 0.5)) return;
    clear();
    timer = setTimeout(() => {
      timer = undefined;
      if (pointerDown || !allowed()) return;
      resting = node[axis];
      cancel = animateCalendarSnap(node, axis, target(), () => !pointerDown && allowed(), () => {
        resting = node[axis];
        cancel = null;
      });
    }, 220);
  };
  const input = () => { interrupt(); resting = null; schedule(); };
  const begin = () => { interrupt(); resting = null; pointerDown = true; };
  const end = () => { if (!pointerDown) return; pointerDown = false; schedule(); };
  node.addEventListener('scroll', schedule, { passive: true });
  node.addEventListener('wheel', input, { passive: true });
  node.addEventListener('pointerdown', begin, { passive: true });
  node.addEventListener('keydown', input);
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  view.addEventListener('blur', interrupt);
  node.ownerDocument.addEventListener('dragstart', interrupt);
  return () => {
    interrupt();
    node.removeEventListener('scroll', schedule);
    node.removeEventListener('wheel', input);
    node.removeEventListener('pointerdown', begin);
    node.removeEventListener('keydown', input);
    view.removeEventListener('pointerup', end);
    view.removeEventListener('pointercancel', end);
    view.removeEventListener('blur', interrupt);
    node.ownerDocument.removeEventListener('dragstart', interrupt);
  };
}
