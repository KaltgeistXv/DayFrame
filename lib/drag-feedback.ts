// Visual feedback only: existing drop handlers retain ownership of validation and data.
export function installDragFeedback(doc: Document) {
  const win = doc.defaultView;
  if (!win) return () => {};
  let source: Element | null = null;
  let target: Element | null = null;
  let frame = 0;
  let overFrame = 0;
  let pendingOver: DragEvent | null = null;
  let preview: HTMLCanvasElement | null = null;
  let resizing = false;
  let resizeBar: Element | null = null;
  let outline: HTMLDivElement | null = null;
  let label: HTMLDivElement | null = null;
  const highlight = (next: Element | null) => {
    if (target === next) return;
    target?.classList.remove('df-drop-target');
    target?.classList.remove('df-drop-insert');
    target = next;
    target?.classList.add('df-drop-target');
    if (target?.getAttribute?.('data-drop-kind') === 'insert') target.classList.add('df-drop-insert');
  };
  const stop = () => {
    win.cancelAnimationFrame(frame);
    win.cancelAnimationFrame(overFrame);
    overFrame = 0;
    pendingOver = null;
    frame = 0;
    preview?.remove();
    preview = null;
    source?.classList.remove('df-drag-source');
    resizeBar?.classList.remove('df-resize-source');
    outline?.remove();
    label?.remove();
    outline = null;
    label = null;
    resizeBar = null;
    resizing = false;
    source = null;
    highlight(null);
    delete doc.documentElement.dataset.dayframeDragging;
  };
  const start = (event: DragEvent) => {
    stop();
    const el = event.target as Element | null;
    if (event.defaultPrevented || !el?.closest?.('.workspaceRoot')) return;
    source = el.closest('[draggable="true"]');
    if (!source) return;
    resizing = !!source.closest('.ribbon-handle');
    if (resizing) {
      resizeBar = source.closest('.tracked-ribbon');
      resizeBar?.classList.add('df-resize-source');
      outline = doc.createElement('div');
      outline.className = 'df-resize-outline';
      outline.hidden = true;
      outline.setAttribute('aria-hidden', 'true');
      label = doc.createElement('div');
      label.className = 'df-resize-label';
      label.hidden = true;
      label.setAttribute('role', 'status');
      doc.body.appendChild(outline);
      doc.body.appendChild(label);
      if (event.dataTransfer) {
        preview = doc.createElement('canvas');
        preview.width = 1;
        preview.height = 1;
        preview.style.cssText =
          'position:fixed;pointer-events:none;left:0;top:0';
        doc.body.appendChild(preview);
        event.dataTransfer.setDragImage(preview, 0, 0);
      }
    } else if (event.dataTransfer) {
      const info = source.closest<HTMLElement>('[data-drag-title]');
      const title =
        info?.dataset.dragTitle ||
        source.querySelector('.boardtitle, .task-row-title, .taskname, .unplanned-name, h3')?.textContent ||
        source.textContent ||
        '';
      preview = createDragPreview(doc, title, info?.dataset.dragProject);
      if (preview) event.dataTransfer.setDragImage(preview, 23, 27);
    }
    doc.documentElement.dataset.dayframeDragging = 'true';
    // Keep the browser's captured drag image opaque; dim only the original.
    frame = win.requestAnimationFrame(() => {
      if (event.defaultPrevented) {
        stop();
        return;
      }
      if (!resizing) source?.classList.add('df-drag-source');
      preview?.remove();
      preview = null;
      frame = 0;
    });
  };
  const paintOver = (event: DragEvent) => {
    const el = event.target as Element | null;
    if (!source || !event.defaultPrevented || !el?.closest) {
      highlight(null);
      if (outline) outline.hidden = true;
      if (label) label.hidden = true;
      return;
    }
    const ribbonRow = el.closest('.month-ribbon-week, .alldayrow');
    let next = ribbonRow
      ? Array.from(ribbonRow.querySelectorAll('[data-range-date]')).find(
          (cell) => {
            const rect = cell.getBoundingClientRect();
            return event.clientX >= rect.left && event.clientX < rect.right;
          },
        ) || null
      : el.closest(
          '[data-schedule-drop], [data-task-unplan], [data-task-delete], [data-task-date], .task-timeline-row, .calendar-unplanned, .taskrow, .boardcard, [data-drop-kind], .boardcolumn, .projectcard, .projectnav, .foldergroup, .unfiled, .dragtrash',
        );
    // Automatic sorting drops into the status column, never pretends to reorder a card.
    if (next?.getAttribute?.('data-drop-kind') === 'status-child') {
      next = next.closest('[data-drop-kind="status"]');
    }
    if (resizing && outline && label && resizeBar) {
      highlight(null);
      const cell = next as HTMLElement | null;
      const date =
        cell?.dataset.rangeDate ||
        cell?.dataset.scheduleDrop ||
        cell?.dataset.taskDate;
      if (!cell || !date || date === 'unplanned') {
        outline.hidden = true;
        label.hidden = true;
        return;
      }
      const origin = resizeBar.getBoundingClientRect(),
        rect = cell.getBoundingClientRect();
      const isStart = !!source.closest('.ribbon-start');
      const completion = !!source.closest('.completion-handle');
      const row = cell.closest('.month-ribbon-week, .alldayrow');
      const sourceRow = resizeBar.closest('.month-ribbon-week, .alldayrow');
      const sameRow = row === sourceRow;
      const cells = row?.querySelectorAll('[data-range-date]');
      const first = cells?.[0]?.getBoundingClientRect();
      const last = cells?.[cells.length - 1]?.getBoundingClientRect();
      const left = isStart
        ? rect.left
        : sameRow
          ? origin.left
          : first?.left || rect.left;
      const right = isStart
        ? sameRow
          ? origin.right
          : last?.right || rect.right
        : rect.right;
      const sourceRowTop = sourceRow?.getBoundingClientRect().top || origin.top;
      const top = sameRow
        ? origin.top
        : (row?.getBoundingClientRect().top || rect.top) +
          origin.top -
          sourceRowTop;
      outline.hidden = right <= left;
      outline.style.cssText = `left:${left}px;top:${top}px;width:${Math.max(0, right - left)}px;height:${origin.height}px`;
      label.hidden = false;
      label.textContent = `${completion ? '实际完成' : isStart ? '原计划开始' : '原计划结束'} · ${date}`;
      label.style.cssText = `left:${Math.max(8, Math.min(event.clientX + 12, win.innerWidth - 240))}px;top:${Math.max(8, event.clientY - 38)}px`;
      return;
    }
    highlight(next && next !== source && !source.contains(next) ? next : null);
  };
  const over = (event: DragEvent) => {
    pendingOver = event;
    if (overFrame) return;
    overFrame = win.requestAnimationFrame(() => {
      overFrame = 0;
      const latest = pendingOver;
      pendingOver = null;
      if (latest) paintOver(latest);
    });
  };
  const leave = (event: DragEvent) => {
    if (!event.relatedTarget) {
      win.cancelAnimationFrame(overFrame);
      overFrame = 0;
      pendingOver = null;
      highlight(null);
      if (outline) outline.hidden = true;
      if (label) label.hidden = true;
    }
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') stop();
  };
  doc.addEventListener('dragstart', start, true);
  doc.addEventListener('dragover', over);
  // Capture cleanup even when a nested drop handler stops propagation.
  doc.addEventListener('drop', stop, true);
  doc.addEventListener('dragend', stop, true);
  doc.addEventListener('dragleave', leave);
  doc.addEventListener('keydown', key, true);
  win.addEventListener('blur', stop);
  return () => {
    stop();
    doc.removeEventListener('dragstart', start, true);
    doc.removeEventListener('dragover', over);
    doc.removeEventListener('drop', stop, true);
    doc.removeEventListener('dragend', stop, true);
    doc.removeEventListener('dragleave', leave);
    doc.removeEventListener('keydown', key, true);
    win.removeEventListener('blur', stop);
  };
}

// A standalone bitmap avoids browser drag snapshots capturing composited ancestors.
export function createDragPreview(doc: Document, title: string, project = '') {
  const canvas = doc.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const width = 276, height = project ? 74 : 54;
  const ratio = Math.max(1, Math.min(doc.defaultView?.devicePixelRatio || 1, 3));
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  if (ratio !== 1) ctx.scale(ratio, ratio);
  const theme = doc.defaultView?.getComputedStyle?.(doc.documentElement);
  const token = (name: string, fallback: string) => theme?.getPropertyValue(name).trim() || fallback;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText =
    `position:fixed;left:0;top:0;width:${width}px;height:${height}px;pointer-events:none;z-index:-1`;
  ctx.shadowColor = token('--drag-preview-shadow-color', '#14182014');
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = token('--background', '#ffffff');
  ctx.beginPath();
  ctx.roundRect(6, 6, 264, height - 12, 10);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = token('--ui-border-surface', '#e8ebf0');
  ctx.lineWidth = 1;
  ctx.stroke();
  const text = (value: string, y: number, font: string, color: string) => {
    ctx.font = font;
    ctx.fillStyle = color;
    const chars = Array.from(value.replace(/\s+/g, ' ').trim());
    let label = chars.join('');
    while (chars.length && ctx.measureText(label).width > 216) {
      chars.pop();
      label = chars.join('') + '…';
    }
    ctx.fillText(label, 18, y);
  };
  // Let the browser resolve rem units, font variables and fallbacks before painting.
  // Canvas does not resolve CSS custom properties in ctx.font on its own.
  doc.body.appendChild(canvas);
  const font = (size: string, weight: string) => {
    canvas.style.font = `var(${weight}) var(${size}) var(--ui-font-sans)`;
    const resolved = doc.defaultView?.getComputedStyle?.(canvas);
    return resolved?.fontSize && resolved.fontFamily
      ? `${resolved.fontWeight} ${resolved.fontSize} ${resolved.fontFamily}`
      : ctx.font;
  };
  text(title, 31, font('--ui-text-body', '--ui-weight-medium'), token('--foreground', '#292a2d'));
  if (project) text(project, 50, font('--ui-text-caption', '--ui-weight-regular'), token('--muted-foreground', '#70757e'));
  return canvas;
}
