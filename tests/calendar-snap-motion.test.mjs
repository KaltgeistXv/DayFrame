import { test } from 'node:test';
import assert from 'node:assert/strict';
import { animateCalendarSnap, bindCalendarSnap } from '../lib/calendar-snap-motion.ts';
function harness(reduced = false) {
  let now = 0,
    next = 0,
    finished = 0;
  const frames = new Map();
  const view = {
    performance: { now: () => now },
    matchMedia: () => ({ matches: reduced }),
    requestAnimationFrame: (fn) => {
      frames.set(++next, fn);
      return next;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  const node = {
    scrollLeft: 100,
    scrollTop: 200,
    ownerDocument: { defaultView: view },
  };
  return {
    node,
    frames,
    done: () => finished++,
    finished: () => finished,
    advance(time) {
      now = time;
      const pending = [...frames.values()];
      frames.clear();
      for (const fn of pending) fn(time);
    },
  };
}
void test('snap glides gradually on both axes and finishes exactly without overshoot', () => {
  for (const axis of ['scrollLeft', 'scrollTop']) {
    const h = harness(),
      origin = h.node[axis],
      positions = [origin];
    animateCalendarSnap(h.node, axis, origin + 16, () => true, h.done);
    assert.equal(h.node[axis], origin);
    for (const time of [16, 80, 160, 240, 320]) {
      h.advance(time);
      positions.push(h.node[axis]);
    }
    assert.ok(positions[1] < origin + 1);
    assert.equal(positions[3], origin + 8);
    assert.equal(positions.at(-1), origin + 16);
    assert.ok(positions.every((p, i) => !i || p >= positions[i - 1]));
    assert.equal(h.frames.size, 0);
    assert.equal(h.finished(), 1);
  }
});
void test('interrupting a snap leaves the current position and cancels remaining frames', () => {
  const h = harness();
  const stop = animateCalendarSnap(
    h.node,
    'scrollLeft',
    116,
    () => true,
    h.done,
  );
  h.advance(80);
  const position = h.node.scrollLeft;
  stop();
  stop();
  h.advance(320);
  assert.equal(h.node.scrollLeft, position);
  assert.equal(h.frames.size, 0);
  assert.equal(h.finished(), 1);
});
void test('user scrolling, navigation and render-window rebases are never overwritten', () => {
  const h = harness();
  animateCalendarSnap(h.node, 'scrollLeft', 116, () => true, h.done);
  h.advance(80);
  h.node.scrollLeft = 700;
  h.advance(160);
  assert.equal(h.node.scrollLeft, 700);
  assert.equal(h.frames.size, 0);
  const drag = harness();
  animateCalendarSnap(drag.node, 'scrollLeft', 116, () => false, drag.done);
  drag.advance(80);
  assert.equal(drag.node.scrollLeft, 100);
  assert.equal(drag.frames.size, 0);
});
void test('reduced motion aligns without scheduling an animation', () => {
  const h = harness(true);
  assert.equal(
    animateCalendarSnap(h.node, 'scrollTop', 216, () => true, h.done),
    null,
  );
  assert.equal(h.node.scrollTop, 216);
  assert.equal(h.frames.size, 0);
});

void test('rapid input and inertia settle once, and animation scroll events cannot loop', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  for (const target of [h.node, h.node.ownerDocument, h.node.ownerDocument.defaultView]) {
    const events = new EventTarget();
    target.addEventListener = events.addEventListener.bind(events);
    target.removeEventListener = events.removeEventListener.bind(events);
    target.dispatchEvent = events.dispatchEvent.bind(events);
  }
  let snaps = 0;
  const dispose = bindCalendarSnap(h.node, 'scrollLeft', () => { snaps++; return 200; }, () => true);
  for (let i = 0; i < 8; i++) {
    h.node.dispatchEvent(new Event('wheel'));
    h.node.scrollLeft += 7;
    h.node.dispatchEvent(new Event('scroll'));
    t.mock.timers.tick(100);
  }
  assert.equal(snaps, 0);
  // Momentum continues after the last wheel event.
  h.node.scrollLeft += 9;
  h.node.dispatchEvent(new Event('scroll'));
  t.mock.timers.tick(219);
  assert.equal(snaps, 0);
  t.mock.timers.tick(1);
  assert.equal(snaps, 1);
  for (const time of [80, 160, 240, 320]) {
    h.advance(time);
    h.node.dispatchEvent(new Event('scroll'));
  }
  t.mock.timers.tick(1000);
  assert.equal(h.node.scrollLeft, 200);
  assert.equal(snaps, 1);
  h.node.scrollLeft = 250;
  h.node.dispatchEvent(new Event('wheel'));
  h.node.dispatchEvent(new Event('scroll'));
  dispose();
  t.mock.timers.tick(1000);
  assert.equal(snaps, 1);
});
