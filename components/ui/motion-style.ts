/** Surface motion shares durations/easing with CSS interaction rules. */
export const surfaceMotionClass = 'motion-reduce:animate-none motion-reduce:transition-none [animation-duration:var(--motion-popup)] [animation-timing-function:var(--motion-ease)] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-98 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-98';
export const dialogMotionClass = surfaceMotionClass + ' [animation-duration:var(--motion-enter)]';
export const backdropMotionClass = 'motion-reduce:animate-none [animation-duration:var(--motion-enter)] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0';
