import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  changeTaskDates,
  withoutTime,
  atTime,
  moveByDate,
  lastTaskDate,
  unplan,
} from '../lib/task-scheduling.ts';
import { sectionViews, sectionContains } from '../lib/workspace-views.ts';
import { occursOn } from '../lib/planner-interactions.ts';
import { validColor, colorStyle, colorRules } from '../lib/colors.ts';
const t = {
  id: 'a',
  title: 'Trip',
  project: 'p',
  status: 'todo',
  priority: 'medium',
  notes: 'keep',
  tags: ['l'],
  date: '2026-09-05',
  time: '',
  duration: 4320,
};
void test('date-only three-day task moves Sep 5 to Sep 6, including when grabbing continuation', () => {
  for (const [origin, target] of [
    ['2026-09-05', '2026-09-06'],
    ['2026-09-06', '2026-09-07'],
  ]) {
    const moved = withoutTime(t, origin, target);
    assert.equal(moved.date, '2026-09-06');
    assert.equal(lastTaskDate(moved), '2026-09-08');
    assert.equal(moved.time, '');
    assert.equal(moved.duration, 4320);
    assert.deepEqual(moved.tags, t.tags);
    assert.equal(occursOn(moved, '2026-09-05'), false);
    assert.equal(occursOn(moved, '2026-09-08'), true);
  }
});
void test('timed overnight task converts to date-only without losing occupied days', () => {
  const source = { ...t, time: '23:00', duration: 120 };
  const converted = withoutTime(source, '2026-09-06', '2026-09-07');
  assert.equal(converted.date, '2026-09-06');
  assert.equal(converted.time, '');
  assert.equal(lastTaskDate(converted), '2026-09-07');
  assert.equal(converted.duration, 2880);
  assert.equal(withoutTime({ ...source, duration: 60 }).duration, 1440);
});
void test('unplanned tasks can be dragged back into dates and time, with associations retained', () => {
  const unplanned = unplan(t);
  assert.equal(unplanned.date, '');
  assert.equal(unplanned.time, '');
  const moved = moveByDate(unplanned, '', '2026-09-06');
  assert.equal(moved.date, '2026-09-06');
  assert.equal(moved.duration, 4320);
  const timed = atTime({ ...t, duration: 1440 }, '2026-09-06', '10:30');
  assert.equal(timed.time, '10:30');
  assert.equal(timed.duration, 60);
  assert.deepEqual(timed.tags, ['l']);
  assert.equal(timed.project, 'p');
  assert.equal(atTime(t, '2026-09-06', '10:30').duration, 4320);
});
void test('Today cannot include past, future or undated tasks regardless of view and search', () => {
  const today = '2026-09-06';
  const data = [
    { ...t, id: 'past', date: '2026-09-05', duration: 60 },
    { ...t, id: 'future', date: '2026-09-07' },
    { ...t, id: 'inbox', date: '' },
    { ...t, id: 'continuing' },
    { ...t, id: 'today', date: today, duration: 60 },
  ];
  assert.deepEqual(
    data
      .filter((x) => sectionContains('today', x, occursOn(x, today)))
      .map((x) => x.id),
    ['continuing', 'today'],
  );
  assert.deepEqual(sectionViews('today'), ['list']);
  assert.deepEqual(sectionViews('inbox'), [
    'list',
    'board',
    'calendar',
    'heatmap',
  ]);
  assert.deepEqual(sectionViews('label:reading'), sectionViews('all'));
  assert.deepEqual(sectionViews('projects'), []);
  assert.deepEqual(sectionViews('schedule'), ['calendar']);
  assert.deepEqual(sectionViews('p'), [
    'list',
    'board',
    'calendar',
    'timeline',
    'heatmap',
  ]);
});
void test('custom colors are constrained to safe hex; readable ink survives extreme choices', () => {
  for (const invalid of [
    'red',
    '#fff',
    'url(test)',
    '#aabbcc;display:none',
    '4',
    null,
  ])
    assert.equal(validColor(invalid), false);
  const luminance = (hex) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  for (const hex of [
    '#ffffff',
    '#000000',
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#c0ffee',
    '#aabbcc',
  ]) {
    assert.ok(validColor(hex));
    const s = colorStyle(hex);
    assert.ok(
      (luminance(s.backgroundColor) + 0.05) / (luminance(s.color) + 0.05) >=
        4.5,
      hex,
    );
  }
  assert.equal(
    colorRules(['#123456', 'bad</style>']).includes('</style>'),
    false,
  );
  assert.ok(colorRules(['#123456']).includes('.color\\#123456'));
});

void test('replanning retains a saved multi-day duration and a short effort estimate', () => {
  assert.equal(atTime(unplan(t), '2026-09-06', '09:00').duration, 4320);
  assert.equal(
    atTime(unplan({ ...t, duration: 90 }), '2026-09-06', '09:00').duration,
    90,
  );
});

void test('calendar and timeline day handles resize across dates without changing task identity', () => {
  const base = { ...t, date: '2026-09-05', time: '', duration: 1440 };
  const long = changeTaskDates(base, 'end', base.date, '2026-09-08');
  assert.equal(long.duration, 5760);
  assert.equal(lastTaskDate(long), '2026-09-08');
  const trimmed = changeTaskDates(long, 'start', long.date, '2026-09-07');
  assert.equal(trimmed.date, '2026-09-07');
  assert.equal(trimmed.duration, 2880);
  assert.deepEqual(trimmed.tags, base.tags);
  const timed = { ...base, time: '23:00', duration: 120 };
  assert.equal(
    changeTaskDates(timed, 'end', '2026-09-06', '2026-09-08').duration,
    3000,
  );
  const start = changeTaskDates(timed, 'start', timed.date, '2026-09-04');
  assert.equal(start.time, '23:00');
  assert.equal(start.duration, 1560);
});
void test('reverse blank-date selection supports multi-month plans', () => {
  const result = changeTaskDates(t, 'range', '2026-09-08', '2026-09-05');
  assert.equal(result.date, '2026-09-05');
  assert.equal(result.duration, 5760);
  assert.equal(result.time, '');
  assert.equal(
    changeTaskDates(t, 'range', '2026-09-01', '2026-12-01').duration,
    92 * 1440,
  );
});
