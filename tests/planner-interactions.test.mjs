import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectionRange,
  resized,
  shiftedTask,
  deltaTo,
  layoutEvents,
  endLabel,
  intersects,
  dragDelta,
  rangeAcross,
  occursOn,
  taskEnd,
  taskStart,
} from '../lib/planner-interactions.ts';
const task = {
  id: 'a',
  title: 'Design review',
  project: '',
  date: '2026-09-05',
  time: '09:00',
  duration: 60,
  status: 'todo',
  priority: 'medium',
  notes: '',
};
void test('range selection snaps to quarters without adding an extra block at exact boundaries', () => {
  assert.deepEqual(selectionRange(540, 600), { start: 540, duration: 60 });
  assert.deepEqual(selectionRange(603, 540), { start: 540, duration: 60 });
  assert.deepEqual(selectionRange(540, 541), { start: 540, duration: 15 });
  assert.deepEqual(selectionRange(1428, 1500), { start: 1425, duration: 15 });
  assert.deepEqual(selectionRange(10, -100), { start: 0, duration: 15 });
});
void test('resizing the start keeps end fixed; resizing the end keeps start fixed', () => {
  const start = resized(task, 'start', 570);
  assert.equal(start.time, '09:30');
  assert.equal(start.duration, 30);
  const end = resized(task, 'end', 645);
  assert.equal(end.time, '09:00');
  assert.equal(end.duration, 105);
  assert.equal(resized(task, 'end', 520).duration, 15);
  assert.equal(resized(task, 'start', 650).time, '09:45');
  assert.equal(resized({ ...task, time: '23:00' }, 'end', 1605).duration, 225);
});
void test('group moves retain durations and relative intervals across midnight and month boundaries', () => {
  const a = { ...task, date: '2026-09-30', time: '23:45', duration: 90 };
  const b = {
    ...task,
    id: 'b',
    date: '2026-10-01',
    time: '00:30',
    duration: 30,
  };
  const delta = deltaTo(a, '2026-10-01', 15),
    nextA = shiftedTask(a, delta),
    nextB = shiftedTask(b, delta);
  assert.equal(nextA.time, '00:15');
  assert.equal(nextA.date, '2026-10-01');
  assert.equal(nextA.duration, 90);
  assert.equal(nextB.time, '01:00');
  assert.equal(nextB.duration, 30);
  assert.equal(shiftedTask(task, -600).date, '2026-09-04');
});
void test('overlapping events share lanes and non-overlapping groups regain full width', () => {
  const out = layoutEvents(
    [
      task,
      { ...task, id: 'b', time: '09:30' },
      { ...task, id: 'c', time: '11:00' },
    ],
    task.date,
  );
  assert.deepEqual(
    out.map((t) => [t.id, t.lane, t.lanes]),
    [
      ['a', 0, 2],
      ['b', 1, 2],
      ['c', 0, 1],
    ],
  );
  const overnight = { ...task, time: '23:30', duration: 90 };
  assert.equal(layoutEvents([overnight], '2026-09-05')[0].visibleDuration, 30);
  assert.equal(layoutEvents([overnight], '2026-09-06')[0].visibleDuration, 60);
  assert.equal(
    layoutEvents([{ ...overnight, duration: 30 }], '2026-09-06').length,
    0,
  );
  assert.equal(endLabel(overnight), '次日 01:00');
});
void test('marquee uses actual intersections; just touching an edge does not select a task', () => {
  assert.ok(
    intersects(
      { left: 0, top: 0, right: 10, bottom: 10 },
      { left: 9, top: 9, right: 20, bottom: 20 },
    ),
  );
  assert.equal(
    intersects(
      { left: 0, top: 0, right: 10, bottom: 10 },
      { left: 10, top: 0, right: 20, bottom: 10 },
    ),
    false,
  );
});

void test('multi-day tasks include intermediate dates and exclude an exact midnight end', () => {
  const t = { ...task, date: '2026-09-30', time: '23:00', duration: 2940 };
  assert.deepEqual(taskEnd(t), { date: '2026-10-03', time: '00:00' });
  assert.equal(layoutEvents([t], '2026-10-01')[0].visibleDuration, 1440);
  assert.equal(layoutEvents([t], '2026-10-02')[0].visibleDuration, 1440);
  assert.equal(occursOn(t, '2026-10-03'), false);
});
void test('dragging a continuation shifts the whole original task by pointer displacement', () => {
  const t = { ...task, time: '23:00', duration: 1800 };
  const delta = dragDelta('2026-09-06', 120, '2026-09-07', 165),
    moved = shiftedTask(t, delta);
  assert.equal(delta, 1485);
  assert.equal(moved.date, '2026-09-06');
  assert.equal(moved.time, '23:45');
  assert.equal(moved.duration, t.duration);
});
void test('range selection and either resize edge can cross days', () => {
  assert.deepEqual(rangeAcross('2026-09-07', 120, '2026-09-05', 1380), {
    date: '2026-09-05',
    start: 1380,
    duration: 1620,
  });
  const end = resized(task, 'end', 2 * 1440 + 600);
  assert.equal(end.duration, 2940);
  const before = resized(task, 'start', -60);
  assert.equal(before.date, '2026-09-04');
  assert.equal(before.time, '23:00');
  assert.equal(
    taskStart(before) + before.duration * 60000,
    taskStart(task) + task.duration * 60000,
  );
});
