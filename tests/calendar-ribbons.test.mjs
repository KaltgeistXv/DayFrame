import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
async function module(path) {
  const src = stripTypeScriptTypes(
    readFileSync(new URL(path, import.meta.url), 'utf8'),
  ).replaceAll(
    "'./task-scheduling'",
    JSON.stringify(new URL('../lib/task-scheduling.ts', import.meta.url).href),
  );
  return import(
    'data:text/javascript;base64,' + Buffer.from(src).toString('base64')
  );
}
const { calendarRibbons, calendarLanes, monthRibbons } = await module(
  '../lib/calendar-ribbons.ts',
);
const { calendarEntries, prepareTracking, rollForward } =
  await module('../lib/progress.ts');
const task = {
  id: 'one',
  title: '主视觉细化',
  project: 'design',
  status: 'doing',
  priority: 'medium',
  date: '2026-09-01',
  time: '',
  duration: 2880,
  notes: '',
  tracking: true,
  position: 1,
};
const rolled = rollForward(
  prepareTracking(task, undefined, '2026-09-01'),
  '2026-09-08',
);
void test('month folding expands to available space and reserves a footer only for overflow', () => {
  const tasks = Array.from({ length: 7 }, (_, i) => ({
    ...task,
    tracking: false,
    id: `capacity-${i}`,
  }));
  const render = (height, items = tasks) =>
    monthRibbons(items, '2026-09-01', '2026-09-07', { height });
  assert.equal(render(210).visible.length, 7);
  assert.ok(render(210).hidden.every((n) => n === 0));
  assert.equal(render(118, tasks.slice(0, 4)).visible.length, 4);
  assert.equal(render(118).visible.length, 3);
  assert.equal(render(118).hidden[0], 4);
  assert.equal(render(86).visible.length, 1);
  assert.equal(render(210).visible.length, 7);
});
void test('original, intervening history and latest rollover become one uninterrupted ribbon', () => {
  const rows = calendarRibbons(
    calendarEntries([rolled]),
    '2026-09-01',
    '2026-09-08',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].start, '2026-09-01');
  assert.equal(rows[0].end, '2026-09-08');
  assert.equal(rows[0].lo, 0);
  assert.equal(rows[0].hi, 7);
  assert.equal(rows[0].split, 25);
  assert.equal(rows[0].plan.date, '2026-09-01');
  assert.equal(rows[0].plan.duration, 2880);
  assert.equal(rows[0].plan.calendarOriginal, true);
  assert.equal(rows[0].current.date, '2026-09-07');
});
void test('scrolling clips color boundaries without splitting a task into daily rows', () => {
  const entries = calendarEntries([rolled]);
  assert.equal(
    calendarRibbons(entries, '2026-09-02', '2026-09-06')[0].split,
    20,
  );
  assert.equal(
    calendarRibbons(entries, '2026-09-03', '2026-09-06')[0].split,
    0,
  );
  assert.equal(
    calendarRibbons(entries, '2026-08-29', '2026-09-01')[0].split,
    100,
  );
  assert.equal(calendarRibbons(entries, '2026-10-01', '2026-10-07').length, 0);
});
void test('other events cannot displace one day of a ribbon; project tasks remain adjacent', () => {
  const second = { ...rolled, id: 'two', position: 2 };
  const other = { ...rolled, id: 'three', project: 'other' };
  const ordinary = { ...rolled, id: 'ordinary', tracking: false };
  const rows = calendarRibbons(
    calendarEntries([other, second, ordinary, rolled]),
    '2026-09-01',
    '2026-09-08',
  );
  assert.deepEqual(
    rows.map((r) => r.plan.id),
    ['one', 'two', 'three', 'ordinary'],
  );
});
void test('timed tasks retain their actual schedule, with only read-only history in the all-day lane', () => {
  const timed = rollForward(
    prepareTracking(
      { ...task, time: '10:00', duration: 60 },
      undefined,
      '2026-09-01',
    ),
    '2026-09-08',
  );
  const rows = calendarRibbons(
    calendarEntries([timed]),
    '2026-09-01',
    '2026-09-08',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].historyOnly, true);
  assert.equal(rows[0].split, 0);
  assert.equal(timed.time, '10:00');
  assert.equal(timed.duration, 60);
});

void test('ordinary all-day tasks share the ribbon layout without enabling tracking or changing dates', () => {
  const ordinary = {
    ...task,
    id: 'ordinary',
    date: '2026-09-02',
    tracking: false,
    status: 'done',
    duration: 4320,
  };
  const rows = calendarRibbons(
    calendarEntries([ordinary]),
    '2026-09-01',
    '2026-09-08',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].lo, 1);
  assert.equal(rows[0].hi, 3);
  assert.equal(rows[0].split, 100);
  assert.deepEqual(rows[0].plan, ordinary);
  assert.equal(rows[0].historyOnly, false);
  assert.equal(
    calendarRibbons(
      [
        { ...ordinary, time: '10:00' },
        { ...ordinary, date: '' },
      ],
      '2026-09-01',
      '2026-09-08',
    ).length,
    0,
  );
});

void test('month ribbons include timed plans and rollover without changing original time or duration', () => {
  const timed = rollForward(
    prepareTracking(
      { ...task, time: '23:30', duration: 120 },
      undefined,
      '2026-09-01',
    ),
    '2026-09-08',
  );
  const entries = calendarEntries([timed]);
  const before = JSON.stringify(entries);
  const first = monthRibbons(entries, '2026-08-31', '2026-09-06').visible;
  const second = monthRibbons(entries, '2026-09-07', '2026-09-13').visible;
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.deepEqual(
    [first[0].lo, first[0].hi, second[0].lo, second[0].hi],
    [1, 6, 0, 1],
  );
  assert.equal(first[0].plan.time, '23:30');
  assert.equal(first[0].plan.duration, 120);
  assert.equal(first[0].plan.calendarOriginal, true);
  assert.equal(first[0].historyOnly, false);
  assert.equal(second[0].split, 0);
  assert.equal(JSON.stringify(entries), before);
});
void test('month lanes pack nonoverlapping tasks and expose every hidden item per date', () => {
  const ordinary = { ...task, tracking: false, duration: 1440 };
  const entries = ['a', 'b', 'c', 'd'].map((id) => ({ ...ordinary, id }));
  entries.push({ ...ordinary, id: 'later', date: '2026-09-03' });
  const { visible, hidden } = monthRibbons(entries, '2026-08-31', '2026-09-06');
  assert.deepEqual(
    visible.map((r) => [r.plan.id, r.lane]),
    [
      ['a', 0],
      ['b', 1],
      ['c', 2],
      ['later', 0],
    ],
  );
  assert.deepEqual(hidden, [0, 1, 0, 0, 0, 0, 0]);
});
void test('longer date ranges are placed above shorter ranges in month and week ribbons', () => {
  const ordinary = { ...task, tracking: false };
  const entries = [
    { ...ordinary, id: 'short', project: 'a', duration: 1440 },
    { ...ordinary, id: 'medium', project: 'b', duration: 2880 },
    { ...ordinary, id: 'long', project: 'c', duration: 5760 },
  ];
  assert.deepEqual(
    calendarRibbons(entries, '2026-09-01', '2026-09-07').map((r) => r.plan.id),
    ['long', 'medium', 'short'],
  );
  assert.deepEqual(
    monthRibbons(entries, '2026-09-01', '2026-09-07').visible.map((r) => [
      r.plan.id,
      r.lane,
    ]),
    [
      ['long', 0],
      ['medium', 1],
      ['short', 2],
    ],
  );
});
void test('week lanes reuse every free row instead of leaving avoidable gaps', () => {
  const ordinary = { ...task, tracking: false };
  const entries = [
    { ...ordinary, id: 'anchor', duration: 10080 },
    { ...ordinary, id: 'early-a', duration: 2880 },
    { ...ordinary, id: 'early-b', duration: 2880 },
    { ...ordinary, id: 'late-long', date: '2026-09-03', duration: 2880 },
    { ...ordinary, id: 'late-short', date: '2026-09-03', duration: 1440 },
  ];
  const lanes = calendarLanes(entries, '2026-09-01', '2026-09-07');
  assert.deepEqual(
    lanes.map((r) => [r.plan.id, r.lane]),
    [
      ['anchor', 0],
      ['early-a', 1],
      ['early-b', 2],
      ['late-long', 1],
      ['late-short', 2],
    ],
  );
  assert.deepEqual(
    lanes
      .filter((r) => r.lo <= 2 && r.hi >= 2)
      .map((r) => r.lane)
      .sort(),
    [0, 1, 2],
  );
});
void test('dragging a continuation shifts the original plan by the grabbed date delta', async () => {
  const { changeTaskDates } = await import('../lib/task-scheduling.ts');
  const plan = monthRibbons(
    calendarEntries([rolled]),
    '2026-09-07',
    '2026-09-13',
  ).visible[0].plan;
  const moved = changeTaskDates(plan, 'move', '2026-09-08', '2026-09-10');
  assert.equal(moved.date, '2026-09-03');
  assert.equal(moved.duration, 2880);
  assert.equal(moved.calendarOriginal, true);
});
