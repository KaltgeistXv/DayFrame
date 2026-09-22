import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = stripTypeScriptTypes(
  readFileSync(new URL('../lib/progress.ts', import.meta.url), 'utf8'),
).replace(
  "'./task-scheduling'",
  JSON.stringify(new URL('../lib/task-scheduling.ts', import.meta.url).href),
);
const {
  isCompletionDrag,
  completeByDrag,
  prepareTracking,
  rollForward,
  progressOf,
  projectSchedule,
  originalPlan,
  calendarEntries,
  calendarKey,
  currentCalendarTask,
} = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
const task = {
  id: 'test',
  title: 'Task',
  project: 'p',
  status: 'todo',
  priority: 'medium',
  date: '2026-09-05',
  time: '',
  duration: 1440,
  notes: '',
  tracking: true,
};
void test('rollover catches up once and preserves baseline and duration', () => {
  const initial = prepareTracking(task, undefined, '2026-09-05');
  const moved = rollForward(initial, '2026-09-08');
  assert.equal(moved.date, '2026-09-08');
  assert.equal(moved.rolledDays, 3);
  assert.equal(moved.baselineEnd, '2026-09-05');
  assert.equal(moved.duration, 1440);
  assert.equal(rollForward(moved, '2026-09-08'), moved);
  assert.equal(progressOf(moved, '2026-09-08').late, 3);
});
void test('cross-day tasks wait until exclusive end passes, including midnight', () => {
  const t = prepareTracking(
    { ...task, time: '23:00', duration: 1500 },
    undefined,
    '2026-09-05',
  );
  assert.equal(t.baselineEnd, '2026-09-06');
  assert.equal(rollForward(t, '2026-09-06'), t);
  assert.equal(rollForward(t, '2026-09-07').date, '2026-09-06');
  assert.equal(rollForward(t, '2026-09-07').time, '23:00');
});
void test('opt-out, undated and completed tasks never move', () => {
  for (const t of [
    { ...task, tracking: false },
    { ...task, date: '' },
    { ...task, status: 'done' },
  ])
    assert.equal(rollForward(t, '2026-09-10'), t);
});
void test('ordinary task completion follows its schedule and moves with it', () => {
  const ordinary = { ...task, tracking: false };
  const completed = prepareTracking(
    { ...ordinary, status: 'done' },
    ordinary,
    '2026-09-13',
  );
  assert.equal(completed.startedOn, '2026-09-05');
  assert.equal(completed.completedOn, '2026-09-05');

  const moved = prepareTracking(
    { ...completed, date: '2026-09-08' },
    completed,
    '2026-09-13',
  );
  assert.equal(moved.startedOn, '2026-09-08');
  assert.equal(moved.completedOn, '2026-09-08');

  const resized = prepareTracking(
    { ...moved, duration: 3 * 1440 },
    moved,
    '2026-09-13',
  );
  assert.equal(resized.startedOn, '2026-09-08');
  assert.equal(resized.completedOn, '2026-09-10');
});
void test('undated ordinary task and tracked task keep actual completion behavior', () => {
  const undated = prepareTracking(
    { ...task, date: '', tracking: false, status: 'done' },
    undefined,
    '2026-09-13',
  );
  assert.equal(undated.startedOn, '2026-09-13');
  assert.equal(undated.completedOn, '2026-09-13');
  const renamed = prepareTracking(
    { ...undated, title: 'Renamed' },
    undated,
    '2026-09-16',
  );
  assert.equal(renamed.completedOn, '2026-09-13');

  const tracked = prepareTracking(
    { ...task, status: 'done' },
    task,
    '2026-09-13',
  );
  assert.equal(tracked.completedOn, '2026-09-13');
});
void test('manual planning replaces baseline, resets rollover and then tracks against current date', () => {
  const initial = prepareTracking(
    { ...task, status: 'doing' },
    undefined,
    '2026-09-05',
  );
  const rolled = rollForward(initial, '2026-09-08');
  const moved = prepareTracking(
    { ...rolled, date: '2026-09-10', baselineEnd: '2099-01-01' },
    rolled,
    '2026-09-08',
  );
  assert.equal(moved.baselineStart, '2026-09-10');
  assert.equal(moved.baselineEnd, '2026-09-10');
  assert.equal(moved.rolledDays, 0);
  assert.equal(progressOf(moved, '2026-09-08').late, 0);
  const automatic = rollForward(moved, '2026-09-12');
  assert.equal(automatic.baselineEnd, '2026-09-10');
  assert.equal(progressOf(automatic, '2026-09-12').late, 2);
  const done = prepareTracking(
    { ...automatic, status: 'done' },
    automatic,
    '2026-09-12',
  );
  assert.equal(progressOf(done, '2026-10-01').late, 2);
  assert.equal(done.startedOn, '2026-09-05');
  assert.equal(
    prepareTracking({ ...done, status: 'todo' }, done, '2026-09-13')
      .completedOn,
    '',
  );
});
void test('title, tags and status changes preserve automatic tracking; time and duration edits define a new plan', () => {
  const initial = prepareTracking(task, undefined, '2026-09-05');
  const rolled = rollForward(initial, '2026-09-08');
  const edited = prepareTracking(
    { ...rolled, title: 'Renamed', tags: ['label'], status: 'doing' },
    rolled,
    '2026-09-08',
  );
  assert.equal(edited.baselineEnd, '2026-09-05');
  assert.equal(edited.rolledDays, 3);
  for (const patch of [{ time: '01:00' }, { duration: 2880 }]) {
    const planned = prepareTracking(
      { ...edited, ...patch },
      edited,
      '2026-09-08',
    );
    assert.equal(planned.baselineStart, '2026-09-08');
    assert.equal(planned.baselineEnd, '2026-09-09');
    assert.equal(planned.rolledDays, 0);
  }
  const unplanned = prepareTracking(
    { ...edited, date: '', time: '' },
    edited,
    '2026-09-08',
  );
  assert.equal(unplanned.baselineStart, '');
  assert.equal(unplanned.baselineEnd, '');
  assert.equal(progressOf(unplanned, '2026-09-10').late, 0);
});
void test('undated tracked task records baseline at first schedule; copies have fresh history', () => {
  const initial = prepareTracking(
    { ...task, date: '' },
    undefined,
    '2026-09-05',
  );
  assert.equal(initial.baselineEnd, '');
  assert.equal(
    prepareTracking(task, initial, '2026-09-06').baselineEnd,
    '2026-09-05',
  );
  assert.equal(
    prepareTracking(
      { ...task, baselineEnd: '2000-01-01', rolledDays: 99 },
      undefined,
      '2026-09-06',
    ).rolledDays,
    0,
  );
});
void test('auto projects follow child changes; manual plans stay independent', () => {
  const p = {
    id: 'p',
    title: 'Project',
    color: '0',
    description: '',
    scheduleMode: 'auto',
  };
  assert.deepEqual(
    [
      projectSchedule(p, [
        task,
        { ...task, date: '2026-09-08', duration: 2880 },
      ]).start,
      projectSchedule(p, [
        task,
        { ...task, date: '2026-09-08', duration: 2880 },
      ]).end,
    ],
    ['2026-09-05', '2026-09-09'],
  );
  assert.equal(projectSchedule(p, [{ ...task, project: 'q' }]).start, '');
  const manual = {
    ...p,
    scheduleMode: 'manual',
    start: '2026-09-01',
    end: '2026-09-20',
  };
  assert.equal(projectSchedule(manual, [task]), manual);
});

void test('calendar original and rollover share one task ID with separate rendering keys', () => {
  const rolled = rollForward(
    prepareTracking(task, undefined, '2026-09-05'),
    '2026-09-09',
  );
  const entries = calendarEntries([rolled]);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].id, entries[1].id);
  assert.equal(entries[0].date, '2026-09-05');
  assert.equal(entries[1].date, '2026-09-06');
  assert.equal(entries.at(-1).date, '2026-09-09');
  assert.notEqual(calendarKey(entries[0]), calendarKey(entries[1]));
  assert.equal(calendarEntries([{ ...rolled, tracking: false }]).length, 1);
});
void test('editing the original recomputes rollover, including moving original onto the current date', () => {
  const rolled = rollForward(
    prepareTracking(
      {
        ...task,
        checkins: [{ date: '2026-09-06', note: 'worked', minutes: 30 }],
      },
      undefined,
      '2026-09-05',
    ),
    '2026-09-09',
  );
  const updated = rollForward(
    prepareTracking(
      { ...originalPlan(rolled), date: '2026-09-07' },
      rolled,
      '2026-09-09',
    ),
    '2026-09-09',
  );
  assert.equal(updated.baselineStart, '2026-09-07');
  assert.equal(updated.date, '2026-09-09');
  assert.equal(updated.rolledDays, 2);
  assert.deepEqual(updated.checkins, rolled.checkins);
  assert.equal(updated.calendarOriginal, undefined);
  const sameDay = prepareTracking(
    { ...originalPlan(updated), date: '2026-09-09' },
    updated,
    '2026-09-09',
  );
  assert.equal(sameDay.baselineStart, '2026-09-09');
  assert.equal(sameDay.rolledDays, 0);
  assert.equal(calendarEntries([sameDay]).length, 1);
  const undo = rollForward(
    prepareTracking(originalPlan(rolled), updated, '2026-09-09'),
    '2026-09-09',
  );
  assert.equal(undo.baselineStart, '2026-09-05');
  assert.equal(undo.rolledDays, 4);
});
void test('original metadata and completion edits preserve the automatic dates and history', () => {
  const rolled = rollForward(
    prepareTracking(task, undefined, '2026-09-05'),
    '2026-09-09',
  );
  const updated = prepareTracking(
    { ...originalPlan(rolled), title: 'Renamed', status: 'done' },
    rolled,
    '2026-09-09',
  );
  assert.equal(updated.date, rolled.date);
  assert.equal(updated.rolledDays, rolled.rolledDays);
  assert.equal(updated.baselineStart, rolled.baselineStart);
  assert.equal(updated.completedOn, '2026-09-09');
});

void test('two-day plans fill every missing day without altering the real duration or effort history', () => {
  const rolled = rollForward(
    prepareTracking(
      {
        ...task,
        date: '2026-09-03',
        duration: 2880,
        checkins: [{ date: '2026-09-05', note: 'work', minutes: 20 }],
      },
      undefined,
      '2026-09-03',
    ),
    '2026-09-08',
  );
  const entries = calendarEntries([rolled]);
  assert.equal(rolled.date, '2026-09-07');
  const history = entries.find((t) => t.calendarHistory);
  assert.equal(history.date, '2026-09-05');
  assert.equal(history.duration, 2880);
  for (let day = 3; day <= 8; day++) {
    const date = Date.parse(`2026-09-0${day}`);
    const found = entries.filter(
      (t) =>
        date >= Date.parse(t.date) &&
        date < Date.parse(t.date) + t.duration * 60000,
    );
    assert.equal(found.length, 1, `day ${day} missing or duplicated`);
  }
  assert.deepEqual(currentCalendarTask(history), rolled);
  const saved = prepareTracking(
    { ...history, title: 'Rename historical card' },
    rolled,
    '2026-09-08',
  );
  assert.equal(saved.date, rolled.date);
  assert.equal(saved.duration, 2880);
  assert.equal(saved.calendarHistory, undefined);
  assert.deepEqual(saved.checkins, rolled.checkins);
  assert.equal(new Set(entries.map(calendarKey)).size, 3);
});
void test('adjacent, overnight and finished schedules do not invent extra days or booked hours', () => {
  const adjacent = rollForward(
    prepareTracking(task, undefined, '2026-09-05'),
    '2026-09-06',
  );
  assert.equal(calendarEntries([adjacent]).length, 2);
  const timed = rollForward(
    prepareTracking(
      { ...task, time: '23:00', duration: 120 },
      undefined,
      '2026-09-05',
    ),
    '2026-09-10',
  );
  const history = calendarEntries([timed]).find((t) => t.calendarHistory);
  assert.equal(history.date, '2026-09-07');
  assert.equal(history.time, '');
  assert.equal(history.duration, 2880);
  assert.equal(currentCalendarTask(history).time, '23:00');
  const done = { ...timed, status: 'done', completedOn: '2026-09-10' };
  const later = rollForward(done, '2026-10-01');
  assert.equal(later, done);
  assert.deepEqual(calendarEntries([later]), calendarEntries([done]));
  assert.equal(calendarEntries([{ ...done, tracking: false }]).length, 1);
});

void test('historical completion ends tracking on the actual date, preserving the original plan', () => {
  const historical = prepareTracking(
    {
      ...task,
      date: '2026-07-05',
      duration: 5760,
      status: 'done',
      completedOn: '2026-07-18',
    },
    undefined,
    '2026-09-09',
  );
  assert.equal(historical.baselineStart, '2026-07-05');
  assert.equal(historical.baselineEnd, '2026-07-08');
  assert.equal(historical.date, '2026-07-15');
  assert.equal(historical.completedOn, '2026-07-18');
  assert.equal(historical.rolledDays, 10);
  assert.equal(progressOf(historical, '2026-09-09').late, 10);
  assert.equal(rollForward(historical, '2026-10-01'), historical);
  assert.deepEqual(
    prepareTracking(originalPlan(historical), historical, '2026-09-09'),
    historical,
  );
  const entries = calendarEntries([historical]);
  assert.equal(entries[0].date, '2026-07-05');
  assert.equal(entries.at(-1).date, '2026-07-15');
});
void test('correcting a rolled task completion uses its original plan and validates history', () => {
  const planned = prepareTracking(
    { ...task, date: '2026-07-05', duration: 5760 },
    undefined,
    '2026-09-09',
  );
  const rolled = rollForward(planned, '2026-09-09');
  const done = prepareTracking(
    { ...rolled, status: 'done', completedOn: '2026-07-18' },
    rolled,
    '2026-09-09',
  );
  assert.equal(done.rolledDays, 10);
  assert.equal(done.baselineEnd, '2026-07-08');
  assert.equal(done.date, '2026-07-15');
  for (const completedOn of ['2026-09-10', '2026-02-30', 'bad'])
    assert.throws(
      () =>
        prepareTracking(
          { ...rolled, status: 'done', completedOn },
          rolled,
          '2026-09-09',
        ),
      /完成日期/,
    );
  const previous = {
    ...rolled,
    status: 'done',
    completedOn: '2026-09-09',
    checkins: [{ date: '2026-09-09', note: '完成任务', minutes: 0 }],
  };
  assert.equal(
    prepareTracking(
      { ...previous, completedOn: '2026-07-18' },
      previous,
      '2026-09-09',
    ).completedOn,
    '2026-07-18',
  );
  previous.checkins[0].note = '实际工作';
  assert.throws(
    () =>
      prepareTracking(
        { ...previous, completedOn: '2026-07-18' },
        previous,
        '2026-09-09',
      ),
    /打卡记录/,
  );
});

void test('dragging the delayed span completes on the drop day without moving the original plan', () => {
  const planned = prepareTracking(
    { ...task, date: '2026-07-05', duration: 5760 },
    undefined,
    '2026-07-05',
  );
  const rolled = rollForward(planned, '2026-09-09');
  assert.equal(isCompletionDrag(rolled, '2026-07-08'), false);
  assert.equal(isCompletionDrag(rolled, '2026-07-09'), true);
  assert.equal(isCompletionDrag(rolled, '2026-07-09', 'end'), false);
  assert.equal(isCompletionDrag(rolled, '2026-09-09', 'completion'), true);
  assert.equal(
    isCompletionDrag({ ...rolled, tracking: false }, '2026-09-09'),
    false,
  );
  const done = prepareTracking(
    completeByDrag(rolled, '2026-07-18'),
    rolled,
    '2026-09-09',
  );
  assert.equal(done.completedOn, '2026-07-18');
  assert.equal(done.baselineStart, '2026-07-05');
  assert.equal(done.baselineEnd, '2026-07-08');
  assert.equal(done.rolledDays, 10);
  assert.equal(done.completionDrag, undefined);
  assert.equal(rollForward(done, '2026-10-01'), done);
  assert.throws(
    () =>
      prepareTracking(
        completeByDrag(rolled, '2026-09-10'),
        rolled,
        '2026-09-09',
      ),
    /完成日期/,
  );
  assert.throws(
    () =>
      prepareTracking(
        completeByDrag(rolled, '2026-07-04'),
        rolled,
        '2026-09-09',
      ),
    /原计划开始/,
  );
  const restored = prepareTracking(
    { ...originalPlan(rolled), undoCompletion: true },
    done,
    '2026-09-09',
  );
  assert.equal(restored.status, 'todo');
  assert.equal(restored.completedOn, '');
  assert.equal(restored.startedOn, rolled.startedOn);
  assert.equal(rollForward(restored, '2026-09-09').date, rolled.date);
});
