import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
async function source(path) {
  let code = stripTypeScriptTypes(
    readFileSync(new URL(path, import.meta.url), 'utf8'),
  );
  for (const name of ['task-scheduling', 'colors'])
    code = code.replaceAll(
      `'./${name}'`,
      JSON.stringify(new URL(`../lib/${name}.ts`, import.meta.url).href),
    );
  return import(
    'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
  );
}
const { taskSpan, taskDayState, taskRangeStyle, trackingMatches, canCheckIn } =
  await source('../lib/task-appearance.ts');
const { prepareTracking, rollForward, originalPlan } =
  await source('../lib/progress.ts');
const { changeTaskDates } = await import('../lib/task-scheduling.ts');
const { sectionViews, sectionContains } =
  await import('../lib/workspace-views.ts');
const base = {
  id: 'a',
  title: '排版',
  project: 'p',
  status: 'doing',
  priority: 'medium',
  date: '2026-09-01',
  time: '',
  duration: 2880,
  tracking: true,
  notes: '',
};
const rolled = rollForward(
  prepareTracking(base, undefined, '2026-09-01'),
  '2026-09-08',
);
void test('Gantt uses one original-to-current span, never the short shifted duration alone', () => {
  assert.deepEqual(taskSpan(rolled), {
    start: '2026-09-01',
    planEnd: '2026-09-02',
    end: '2026-09-08',
  });
  assert.equal(rolled.date, '2026-09-07');
  assert.equal(rolled.duration, 2880);
});
void test('original, rollover, checked original and checked rollover have distinct ordered strengths', () => {
  const t = {
    ...rolled,
    checkins: [
      { date: '2026-09-02', note: '', minutes: 0 },
      { date: '2026-09-06', note: '', minutes: 0 },
    ],
  };
  const strengths = [
    '2026-09-04',
    '2026-09-01',
    '2026-09-06',
    '2026-09-02',
  ].map((d) => taskDayState(t, d).strength);
  assert.equal(new Set(strengths).size, 4);
  assert.deepEqual(
    [...strengths].sort((a, b) => a - b),
    strengths,
  );
  assert.equal(taskDayState(t, '2026-09-04').checked, false);
  assert.ok(
    taskRangeStyle(
      t,
      '#c66a72',
      '2026-09-03',
      '2026-09-06',
    ).background.includes('100%'),
  );
});
void test('moving original plan on a rolled bar redefines baseline then derives rollover independently', () => {
  const moved = changeTaskDates(
    originalPlan(rolled),
    'move',
    '2026-09-05',
    '2026-09-06',
  );
  const saved = rollForward(
    prepareTracking(moved, rolled, '2026-09-08'),
    '2026-09-08',
  );
  assert.equal(saved.baselineStart, '2026-09-02');
  assert.equal(saved.baselineEnd, '2026-09-03');
  assert.equal(saved.rolledDays, 5);
  assert.deepEqual(taskSpan(saved), {
    start: '2026-09-02',
    planEnd: '2026-09-03',
    end: '2026-09-08',
  });
});
void test('resize edits only original end, retaining intervening display and time of day', () => {
  const timed = rollForward(
    prepareTracking(
      { ...base, time: '23:00', duration: 120 },
      undefined,
      '2026-09-01',
    ),
    '2026-09-08',
  );
  const resized = changeTaskDates(
    originalPlan(timed),
    'end',
    '2026-09-02',
    '2026-09-04',
  );
  const saved = rollForward(
    prepareTracking(resized, timed, '2026-09-08'),
    '2026-09-08',
  );
  assert.equal(saved.time, '23:00');
  assert.equal(saved.baselineEnd, '2026-09-04');
  assert.equal(taskSpan(saved).start, '2026-09-01');
  assert.equal(taskSpan(saved).end, '2026-09-08');
});
void test('ordinary and unplanned tasks never inherit stale tracking presentation', () => {
  const t = { ...rolled, tracking: false };
  assert.equal(taskSpan(t).start, t.date);
  assert.equal(taskDayState(t, t.date).strength, 0.15);
  assert.equal(taskSpan({ ...t, date: '' }).start, '');
  assert.equal(canCheckIn(t, '2026-09-01', '2026-09-08'), false);
});
void test('daily records allow backfill but prevent future and post-completion activity', () => {
  assert.equal(canCheckIn(rolled, '2026-09-02', '2026-09-08'), true);
  assert.equal(canCheckIn(rolled, '2026-09-09', '2026-09-08'), false);
  assert.equal(
    canCheckIn(
      { ...rolled, status: 'done', completedOn: '2026-09-06' },
      '2026-09-07',
      '2026-09-08',
    ),
    false,
  );
  assert.equal(
    canCheckIn(
      { ...rolled, status: 'done', completedOn: '2026-09-06' },
      '2026-09-06',
      '2026-09-08',
    ),
    true,
  );
});
void test('scope includes unfinished and finished tracked tasks; all includes ordinary', () => {
  for (const t of [rolled, { ...rolled, status: 'done' }])
    assert.equal(trackingMatches(t, 'tracked'), true);
  assert.equal(
    trackingMatches({ ...rolled, tracking: false }, 'untracked'),
    true,
  );
  assert.equal(trackingMatches(rolled, 'untracked'), false);
  assert.equal(trackingMatches({ ...rolled, tracking: false }, 'all'), true);
  assert.deepEqual(sectionViews('all'), [
    'list',
    'board',
    'calendar',
    'timeline',
    'heatmap',
  ]);
  assert.deepEqual(sectionViews('tracking'), ['timeline', 'list', 'board']);
  assert.equal(sectionContains('tracking', rolled, false), true);
});
void test('check-in table excludes pre-plan, future and undated cells but retains previous records after replanning', () => {
  const today = '2026-09-08';
  assert.equal(canCheckIn(rolled, '2026-08-31', today), false);
  assert.equal(
    canCheckIn(
      { ...rolled, date: '', baselineStart: '', baselineEnd: '' },
      today,
      today,
    ),
    false,
  );
  assert.equal(
    canCheckIn({ ...base, date: '2026-09-12' }, today, today),
    false,
  );
  const replanned = {
    ...base,
    date: '2026-09-12',
    checkins: [{ date: '2026-09-02', note: 'Before replanning', minutes: 30 }],
  };
  assert.equal(canCheckIn(replanned, '2026-09-02', today), true);
  assert.equal(canCheckIn(replanned, '2026-09-03', today), false);
});
