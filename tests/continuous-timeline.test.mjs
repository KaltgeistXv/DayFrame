import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rebaseWindow,
  timelineWindowCount,
  compensatedScroll,
  monthShift,
  edgeScrollDelta,
  snappedTimelineScroll,
  visibleTimelineColumn,
} from '../lib/timeline-window.ts';
import {
  changeTaskDates,
  lastTaskDate,
  moveByDate,
} from '../lib/task-scheduling.ts';
const task = {
  id: 't',
  title: '排版',
  project: 'p',
  status: 'doing',
  priority: 'medium',
  date: '2026-09-05',
  time: '',
  duration: 3 * 1440,
  notes: '',
  tags: ['design'],
};
void test('rolling window preserves every pixel and the grabbed date through 100 rebases in both directions', () => {
  for (const [cell, count, step, gutter, width] of [
    [60, 63, 21, 220, 1100],
    ...[36, 48, 60, 84, 108].map((cell) => [cell, 147, 49, 220, 1920]),
    [60, 63, 21, 220, 1600],
    [112, 35, 14, 48, 830],
    [640, 15, 5, 48, 688],
    [126.857142857, 35, 14, 48, 936],
  ]) {
    for (const direction of [-1, 1]) {
      let anchor = 0;
      for (let i = 0; i < 100; i++) {
        const left =
          direction < 0 ? cell : gutter + count * cell - width - cell;
        const delta = rebaseWindow(left, width, cell, count, step, gutter);
        assert.equal(delta, direction * step);
        const next = compensatedScroll(left, delta, cell);
        for (const pointer of [gutter + 5, width / 2, width - 5]) {
          const before = anchor + (left + pointer - gutter) / cell;
          const after = anchor + delta + (next + pointer - gutter) / cell;
          assert.ok(Math.abs(before - after) < 1e-10);
        }
        anchor += delta;
      }
    }
  }
});
void test('month navigation crosses years and leap years without overflowing a short month', () => {
  assert.equal(monthShift('2026-12-31', 1), '2027-01-01');
  assert.equal(monthShift('2028-03-31', -1), '2028-02-01');
  assert.equal(monthShift('2026-09-05', 120), '2036-09-01');
  assert.equal(monthShift('2026-09-05', -120), '2016-09-01');
});
void test('drag edge scrolling follows the active calendar axis only near an edge', () => {
  assert.equal(edgeScrollDelta(12, 0, 500, 44), -10);
  assert.equal(edgeScrollDelta(250, 0, 500, 44), 0);
  assert.equal(edgeScrollDelta(490, 0, 500, 44), 10);
  assert.equal(edgeScrollDelta(260, 220, 1000, 36), 0);
});
void test('calendar scrolling always aligns to the nearest boundary', () => {
  for (const cell of [112, 640, 127.5]) {
    for (const offset of [-cell * 0.4, -17, 8, 17, cell * 0.4])
      assert.equal(snappedTimelineScroll(4 * cell + offset, cell, 1), 4 * cell);
    assert.equal(snappedTimelineScroll(4.6 * cell, cell, 1), 5 * cell);
  }
  assert.equal(snappedTimelineScroll(140.5, 140.5, 1), 140.5);
  assert.equal(snappedTimelineScroll(640 * 7 + 170, 640, 7), 640 * 7);
  assert.equal(snappedTimelineScroll(-20, 112, 1), 0);
  assert.equal(snappedTimelineScroll(41, 0, 1), 41);
});
void test('stretch past the former 30-day boundary, move by the continuation, and preserve project metadata', () => {
  const extended = changeTaskDates(task, 'end', '2026-09-07', '2027-01-06');
  assert.equal(lastTaskDate(extended), '2027-01-06');
  const moved = moveByDate(extended, '2026-11-12', '2026-12-12');
  assert.equal(lastTaskDate(moved), '2027-02-05');
  assert.equal(moved.date, '2026-10-05');
  assert.equal(moved.duration, extended.duration);
  assert.equal(moved.project, 'p');
  assert.deepEqual(moved.tags, ['design']);
});

void test('fractional and zoomed scroll offsets keep the intended date column', () => {
  assert.equal(
    visibleTimelineColumn(1509.0908203125, 107.85714285714286, 0.33),
    14,
  );
  assert.equal(visibleTimelineColumn(839.8, 60, 1), 14);
  assert.equal(visibleTimelineColumn(830, 60, 1), 13);
  assert.equal(visibleTimelineColumn(14 * 126.857142857, 126.857142857, 2), 14);
  assert.equal(visibleTimelineColumn(-1, 60), 0);
});

void test('wide and zoomed timelines settle after rebasing without alternating edges', () => {
  for (const width of [800, 1600, 3878, 7680]) {
    const count = timelineWindowCount(width, 60, 63, 21, 220);
    assert.equal(rebaseWindow(21 * 60, width, 60, count, 21), 0);
    for (const left of [60, 220 + count * 60 - width - 60]) {
      const delta = rebaseWindow(left, width, 60, count, 21);
      assert.notEqual(delta, 0);
      assert.equal(
        rebaseWindow(compensatedScroll(left, delta, 60), width, 60, count, 21),
        0,
      );
    }
  }
});
