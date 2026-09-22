// Keep both scroll buffers outside the visible viewport, including browser zoom.
export function timelineWindowCount(
  viewport: number,
  cell: number,
  initial: number,
  step: number,
  gutter = 220,
) {
  return Math.max(
    initial,
    Math.ceil(Math.max(0, viewport - gutter) / cell) + 2 * step,
  );
}

// A bounded render window with no calendar-date boundary. Rebase by whole cells
// so the date under the pointer stays fixed while dragging across buffers.
export function rebaseWindow(
  left: number,
  viewport: number,
  cell: number,
  count: number,
  step: number,
  gutter = 220,
) {
  const max = gutter + count * cell - viewport;
  if (left < cell * 3) return -step;
  if (left > max - cell * 3) return step;
  return 0;
}
export function compensatedScroll(left: number, shift: number, cell: number) {
  return left - shift * cell;
}

export function snappedTimelineScroll(
  left: number,
  cell: number,
  pageDays: number,
) {
  if (cell <= 0 || pageDays <= 0) return left;
  const position = Math.max(0, left);
  const page = cell * pageDays;
  const target = Math.round(position / page) * page;
  return target;
}

export function edgeScrollDelta(
  pointer: number,
  start: number,
  end: number,
  threshold: number,
) {
  return pointer < start + threshold ? -10 : pointer > end - threshold ? 10 : 0;
}

export function monthShift(date: string, offset: number) {
  const d = new Date(date.slice(0, 7) + '-01T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
}

// Scroll offsets are quantized to physical pixels (including browser zoom).
// Preserve a snapped column when rounding puts it just before its boundary.
export function visibleTimelineColumn(
  left: number,
  cell: number,
  pixelRatio = 1,
) {
  if (cell <= 0) return 0;
  const index = Math.max(0, left) / cell;
  const nearest = Math.round(index);
  const tolerance = Math.min(cell / 4, 1 / Math.max(0.1, pixelRatio));
  return Math.abs(left - nearest * cell) <= tolerance
    ? nearest
    : Math.floor(index);
}
