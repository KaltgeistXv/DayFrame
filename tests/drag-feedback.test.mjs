import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  installDragFeedback,
  createDragPreview,
} from '../lib/drag-feedback.ts';

function harness() {
  const handlers = new Map(),
    frames = new Map();
  let id = 0;
  const surface = () => ({
    addEventListener(name, fn) {
      handlers.set(name, fn);
    },
    removeEventListener(name, fn) {
      if (handlers.get(name) === fn) handlers.delete(name);
    },
  });
  const doc = {
    ...surface(),
    documentElement: { dataset: {} },
    defaultView: {
      ...surface(),
      requestAnimationFrame(fn) {
        frames.set(++id, fn);
        return id;
      },
      cancelAnimationFrame(id) {
        frames.delete(id);
      },
    },
  };
  const element = (matches = {}) => ({
    classList: {
      values: new Set(),
      add(v) {
        this.values.add(v);
      },
      remove(v) {
        this.values.delete(v);
      },
    },
    closest(selector) {
      return matches[selector] || matches.fallback || null;
    },
    contains(el) {
      return this === el;
    },
  });
  const source = element();
  source.closest = (s) =>
    s === '.workspaceRoot' || s === '[draggable="true"]' ? source : null;
  const target = element();
  const targetChild = element({ fallback: target });
  targetChild.closest = (s) =>
    s === '.month-ribbon-week, .alldayrow' ? null : target;
  const emit = (name, props = {}) =>
    handlers.get(name)?.({ target: source, ...props });
  const flush = () => {
    for (const fn of frames.values()) fn();
    frames.clear();
  };
  const cleanup = installDragFeedback(doc);
  const has = (el, cls) => el.classList.values.has(cls);
  return {
    doc,
    source,
    target,
    targetChild,
    emit,
    flush,
    cleanup,
    has,
    handlers,
    frames,
    element,
  };
}

void test('drag source dims after image capture; only accepted targets highlight', () => {
  const h = harness();
  h.emit('dragstart');
  assert.equal(h.has(h.source, 'df-drag-source'), false);
  h.flush();
  assert.equal(h.has(h.source, 'df-drag-source'), true);
  h.emit('dragover', { target: h.targetChild, defaultPrevented: false });
  h.flush();
  assert.equal(h.has(h.target, 'df-drop-target'), false);
  h.emit('dragover', { target: h.targetChild, defaultPrevented: true });
  h.flush();
  assert.equal(h.has(h.target, 'df-drop-target'), true);
  h.emit('dragover', { target: h.targetChild, defaultPrevented: false });
  h.flush();
  assert.equal(h.has(h.target, 'df-drop-target'), false);
  h.cleanup();
});

void test('drop, cancellation, blur and unmount remove feedback and pending frames', () => {
  for (const action of ['drop', 'dragend', 'keydown', 'blur', 'unmount']) {
    const h = harness();
    h.emit('dragstart');
    h.flush();
    h.emit('dragover', { target: h.targetChild, defaultPrevented: true });
  h.flush();
    if (action === 'unmount') h.cleanup();
    else h.emit(action, { key: 'Escape' });
    assert.equal(h.has(h.source, 'df-drag-source'), false, action);
    assert.equal(h.has(h.target, 'df-drop-target'), false, action);
    assert.equal(
      h.doc.documentElement.dataset.dayframeDragging,
      undefined,
      action,
    );
    h.cleanup();
    assert.equal(h.handlers.size, 0);
  }
  const h = harness();
  h.emit('dragstart');
  h.emit('drop');
  h.flush();
  assert.equal(h.has(h.source, 'df-drag-source'), false);
  assert.equal(h.frames.size, 0);
  h.cleanup();
});

void test('ribbon drop highlights the date under the pointer, not the whole week', () => {
  const h = harness();
  const cells = [h.element(), h.element()];
  cells.forEach(
    (cell, i) =>
      (cell.getBoundingClientRect = () => ({
        left: i * 100,
        right: (i + 1) * 100,
      })),
  );
  const row = { querySelectorAll: () => cells };
  const ribbon = h.element({ '.month-ribbon-week, .alldayrow': row });
  h.emit('dragstart');
  h.emit('dragover', { target: ribbon, defaultPrevented: true, clientX: 110 });
  h.flush();
  assert.equal(h.has(cells[0], 'df-drop-target'), false);
  assert.equal(h.has(cells[1], 'df-drop-target'), true);
  h.emit('dragleave', { relatedTarget: null });
  assert.equal(h.has(cells[1], 'df-drop-target'), false);
  h.emit('dragover', { target: ribbon, defaultPrevented: true, clientX: 30 });
  h.flush();
  assert.equal(h.has(cells[0], 'df-drop-target'), true);
  h.cleanup();
});

void test('external or cancelled drags cannot activate internal feedback', () => {
  const h = harness();
  for (const props of [{ target: h.element() }, { defaultPrevented: true }]) {
    h.emit('dragstart', props);
    h.emit('dragover', { target: h.targetChild, defaultPrevented: true });
  h.flush();
    h.flush();
    assert.equal(h.has(h.target, 'df-drop-target'), false);
    assert.equal(h.doc.documentElement.dataset.dayframeDragging, undefined);
  }
  h.cleanup();
});

function canvasDocument() {
  const labels = [],
    attached = new Set();
  const context = {
    scale() {},
    beginPath() {},
    roundRect() {},
    fill() {},
    stroke() {},
    arc() {},
    measureText(value) {
      return { width: Array.from(value).length * 14 };
    },
    fillText(value) {
      labels.push(value);
    },
  };
  const doc = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return {
        style: {},
        setAttribute() {},
        getContext: () => context,
        remove() {
          attached.delete(this);
        },
      };
    },
    body: {
      appendChild(el) {
        attached.add(el);
      },
    },
  };
  return { doc, labels, attached, context };
}

void test('drag bitmap contains only bounded title/project text, no copied page content', () => {
  const h = canvasDocument();
  const preview = createDragPreview(
    h.doc,
    '作品集排版'.repeat(20),
    '视觉设计项目',
  );
  assert.equal(preview.width, 276);
  assert.equal(preview.height, 74);
  assert.equal(h.labels.length, 2);
  assert.ok(h.labels[0].endsWith('…'));
  assert.ok(Array.from(h.labels[0]).length * 14 <= 216);
  assert.equal(h.labels[1], '视觉设计项目');
  preview.remove();
  assert.equal(h.attached.size, 0);
  const plain = createDragPreview(h.doc, '普通任务');
  assert.equal(plain.height, 54);
  plain.remove();
});

void test('native drag uses compact bitmap synchronously and removes it after capture or cancel', () => {
  for (const end of ['frame', 'drop', 'blur', 'unmount']) {
    const h = harness(),
      c = canvasDocument();
    Object.assign(h.doc, c.doc);
    const closest = h.source.closest.bind(h.source);
    h.source.closest = (s) =>
      s === '[data-drag-title]'
        ? { dataset: { dragTitle: '作品集排版', dragProject: '视觉设计' } }
        : closest(s);
    let image;
    h.emit('dragstart', {
      dataTransfer: {
        setDragImage(el, x, y) {
          image = el;
          assert.equal(x, 23);
          assert.equal(y, 27);
        },
      },
    });
    assert.equal(image.width, 276);
    assert.equal(c.attached.size, 1);
    assert.deepEqual(c.labels, ['作品集排版', '视觉设计']);
    if (end === 'frame') h.flush();
    else if (end === 'unmount') h.cleanup();
    else h.emit(end);
    assert.equal(c.attached.size, 0, end);
    h.cleanup();
  }
});

void test('resize uses an invisible native image and an anchored range, never a moving card', () => {
  for (const end of ['drop', 'dragend', 'keydown', 'blur', 'unmount']) {
    const h = harness(),
      c = canvasDocument();
    const nodes = [];
    h.doc.body = c.doc.body;
    h.doc.createElement = (tag) => {
      if (tag === 'canvas') return c.doc.createElement(tag);
      const node = {
        style: {},
        setAttribute() {},
        remove() {
          c.attached.delete(this);
        },
      };
      nodes.push(node);
      return node;
    };
    h.doc.defaultView.innerWidth = 1000;
    const cell = h.element();
    cell.dataset = { rangeDate: '2026-07-18' };
    cell.getBoundingClientRect = () => ({ left: 200, right: 300, top: 60 });
    const row = {
      querySelectorAll: () => [cell],
      getBoundingClientRect: () => ({ top: 60 }),
    };
    cell.closest = () => row;
    const bar = h.element();
    bar.closest = () => row;
    bar.getBoundingClientRect = () => ({
      left: 40,
      right: 400,
      top: 90,
      height: 18,
    });
    h.source.closest = (s) => {
      if (
        [
          '.workspaceRoot',
          '[draggable="true"]',
          '.ribbon-handle',
          '.completion-handle',
        ].includes(s)
      )
        return h.source;
      if (s === '.tracked-ribbon') return bar;
      return null;
    };
    let image;
    h.emit('dragstart', {
      dataTransfer: {
        setDragImage(el, x, y) {
          image = el;
          assert.equal(x, 0);
          assert.equal(y, 0);
        },
      },
    });
    assert.equal(image.width, 1);
    assert.equal(image.height, 1);
    h.flush();
    assert.equal(h.has(h.source, 'df-drag-source'), false);
    assert.equal(h.has(bar, 'df-resize-source'), true);
    h.emit('dragover', {
      target: cell,
      defaultPrevented: true,
      clientX: 250,
      clientY: 95,
    });
  h.flush();
    assert.match(
      nodes[0].style.cssText,
      /left:40px;top:90px;width:260px;height:18px/,
    );
    assert.equal(nodes[1].textContent, '实际完成 · 2026-07-18');
    assert.equal(h.has(cell, 'df-drop-target'), false);
    if (end === 'unmount') h.cleanup();
    else h.emit(end, { key: 'Escape' });
    assert.equal(c.attached.size, 0);
    assert.equal(h.has(bar, 'df-resize-source'), false);
    h.cleanup();
  }
});

void test('dragover bursts coalesce and pending feedback cannot survive a drop', () => {
  const h = harness();
  h.emit('dragstart');
  h.flush();
  for (let i = 0; i < 20; i++) h.emit('dragover', { target: h.targetChild, defaultPrevented: true });
  assert.equal(h.frames.size, 1);
  assert.equal(h.has(h.target, 'df-drop-target'), false);
  h.emit('dragover', { target: h.targetChild, defaultPrevented: false });
  h.flush();
  assert.equal(h.has(h.target, 'df-drop-target'), false);
  h.emit('dragover', { target: h.targetChild, defaultPrevented: true });
  h.emit('drop');
  h.flush();
  assert.equal(h.has(h.target, 'df-drop-target'), false);
  h.cleanup();
});


void test('high density preview preserves logical size and uses a sharp backing bitmap', () => {
  const h = canvasDocument();
  h.doc.defaultView = {devicePixelRatio: 2};
  const preview = createDragPreview(h.doc, '清晰预览', '项目');
  assert.equal(preview.width, 552);
  assert.equal(preview.height, 148);
  assert.match(preview.style.cssText, /width:276px;height:74px/);
});
void test('manual reordering marks an insertion point and clears it on exit', () => {
  const h = harness();
  h.target.getAttribute = name => name === 'data-drop-kind' ? 'insert' : null;
  h.emit('dragstart'); h.flush();
  h.emit('dragover', {target:h.targetChild, defaultPrevented:true}); h.flush();
  assert.equal(h.has(h.target, 'df-drop-insert'), true);
  h.emit('drop');
  assert.equal(h.has(h.target, 'df-drop-insert'), false);
});
void test('automatically sorted cards highlight the receiving status column', () => {
  const h = harness(), column = h.element();
  h.target.getAttribute = name => name === 'data-drop-kind' ? 'status-child' : null;
  h.target.closest = () => column;
  h.emit('dragstart'); h.flush();
  h.emit('dragover', {target:h.targetChild, defaultPrevented:true}); h.flush();
  assert.equal(h.has(column, 'df-drop-target'), true);
  assert.equal(h.has(h.target, 'df-drop-target'), false);
  h.emit('drop');
  assert.equal(h.has(column, 'df-drop-target'), false);
});


void test('drag bitmap resolves global font family, size and weight rather than using private defaults', () => {
  const h = canvasDocument(), fonts = [];
  h.context.fillText = function() { fonts.push(this.font); };
  h.doc.defaultView = {
    getComputedStyle(element) {
      if (!element?.style?.font) return {getPropertyValue: () => ''};
      assert.match(element.style.font, /var\(--ui-font-sans\)/);
      const caption = element.style.font.includes('--ui-text-caption');
      assert.match(element.style.font, caption ? /--ui-weight-regular/ : /--ui-weight-medium/);
      return {fontFamily: '"Shared Font", sans-serif', fontSize: caption ? '15px' : '18px', fontWeight: caption ? '400' : '600'};
    },
  };
  createDragPreview(h.doc, '任务', '项目');
  assert.deepEqual(fonts, ['600 18px "Shared Font", sans-serif', '400 15px "Shared Font", sans-serif']);
});
