import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activityByDay,
  heatmapYear,
  heatmapLevel,
  trackedActivityGroups,
  heatmapGroups,
} from '../lib/activity-heatmap.ts';

const task = {
  id: 'a',
  title: '排版',
  project: 'p',
  status: 'doing',
  tracking: true,
  date: '2026-09-11',
  baselineStart: '2026-07-05',
  baselineEnd: '2026-07-08',
};
void test('activity counts unique tasks per day, including completion, without counting rollover', () => {
  const done = {
    ...task,
    status: 'done',
    completedOn: '2026-07-18',
    checkins: [
      { date: '2026-07-17' },
      { date: '2026-07-18' },
      { date: '2026-07-18' },
    ],
  };
  const days = activityByDay(
    [
      done,
      { ...done, calendarOriginal: true },
      { ...task, id: 'b', status: 'done', completedOn: '2026-07-18' },
    ],
    '2026-09-11',
  );
  assert.equal(days.get('2026-07-18').length, 2);
  assert.equal(days.get('2026-07-17').length, 1);
  assert.equal(days.has('2026-07-05'), false);
  assert.equal(days.has('2026-09-11'), false);
});
void test('future and invalid entries are excluded; zero-minute check-ins count', () => {
  const days = activityByDay(
    [
      {
        ...task,
        checkins: [
          { date: '2026-09-11', minutes: 0 },
          { date: '2026-09-12' },
          { date: '2026-02-30' },
          { date: 'invalid' },
        ],
      },
    ],
    '2026-09-11',
  );
  assert.deepEqual([...days.keys()], ['2026-09-11']);
});
void test('manual replan keeps historical activity and deleting a check-in updates totals', () => {
  const withRecord = { ...task, checkins: [{ date: '2026-07-06' }] };
  assert.deepEqual(
    [...activityByDay([withRecord], '2026-09-11').keys()],
    [
      ...activityByDay(
        [{ ...withRecord, date: '2026-10-01', baselineStart: '2026-10-01' }],
        '2026-09-11',
      ).keys(),
    ],
  );
  assert.equal(
    activityByDay([{ ...withRecord, checkins: [] }], '2026-09-11').size,
    0,
  );
  assert.equal(
    activityByDay([{ ...task, completedOn: '2026-07-18' }], '2026-09-11').size,
    0,
  );
});
void test('overview includes ordinary tasks; project grouping only includes tracked tasks', () => {
  const ordinary = {
    ...task,
    id: 'b',
    tracking: false,
    checkins: [{ date: '2026-09-11' }],
  };
  assert.equal(
    activityByDay([ordinary], '2026-09-11').get('2026-09-11').length,
    1,
  );
  const groups = trackedActivityGroups(
    [
      task,
      ordinary,
      { ...task, id: 'c', project: '' },
      { ...task, id: 'd', project: 'deleted' },
    ],
    [{ id: 'p', title: '作品集' }],
  );
  assert.deepEqual(
    groups.map((g) => [g.title, g.tasks.length]),
    [
      ['作品集', 1],
      ['独立追踪任务', 2],
    ],
  );
});
void test('calendar covers a full year once, Monday first, with correct leap dates', () => {
  for (const [year, length] of [
    [2026, 365],
    [2024, 366],
    [2000, 366],
    [2100, 365],
    [1, 365],
  ]) {
    const cells = heatmapYear(year);
    const dates = cells.filter(Boolean);
    assert.equal(dates.length, length);
    assert.equal(new Set(dates).size, length);
    assert.equal(cells.length % 7, 0);
    for (let i = 0; i < cells.length; i++)
      if (cells[i])
        assert.equal(
          (new Date(cells[i] + 'T12:00:00Z').getUTCDay() + 6) % 7,
          i % 7,
        );
  }
});
void test('all projects share a monotonic fixed color scale', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 6, 7, 100].map(heatmapLevel),
    [0, 1, 2, 2, 3, 3, 4, 4],
  );
});

void test('heatmap global scope includes assigned, unassigned and non-tracking activity', () => {
  const tasks = [task, { ...task, id: 'b', project: '', tracking: false }];
  assert.deepEqual(heatmapGroups(tasks, [])[0].tasks, tasks);
});

void test('project groups keep assigned, unassigned and non-tracking tasks', () => {
  const projects = [
    { id: 'p', title: '项目一' },
    { id: 'q', title: '项目二' },
    { id: 'empty', title: '空项目' },
  ];
  const tasks = [
    { ...task, checkins: [{ date: '2026-09-10' }] },
    {
      ...task,
      id: 'b',
      tracking: false,
      status: 'done',
      completedOn: '2026-09-10',
    },
    { ...task, id: 'c', project: 'q' },
    { ...task, id: 'd', project: '' },
  ];
  const groups = heatmapGroups(tasks, projects, { groupByProject: true });
  assert.deepEqual(
    groups.map((group) => group.tasks.map((task) => task.id)),
    [['a', 'b'], ['c'], [], ['d']],
  );
  assert.equal(groups[3].title, '无项目');
  assert.equal(
    activityByDay(groups[0].tasks, '2026-09-12').get('2026-09-10').length,
    2,
  );
  assert.equal(activityByDay(groups[2].tasks, '2026-09-12').size, 0);
  assert.deepEqual(heatmapGroups(tasks, projects)[0].tasks, tasks);
});

void test('an ordinary completed task remains visible in the unassigned heatmap group', () => {
  const ordinary = {
    ...task,
    id: 'shanghai',
    title: '2609 · 上海一人游',
    project: '',
    tracking: false,
    status: 'done',
    completedOn: '2026-09-02',
    checkins: [{ date: '2026-09-02', minutes: 0 }],
  };
  const groups = heatmapGroups([ordinary], [], { groupByProject: true });
  assert.deepEqual(groups.map((group) => group.title), ['无项目']);
  assert.deepEqual(
    activityByDay(groups[0].tasks, '2026-09-16')
      .get('2026-09-02')
      .map((entry) => entry.id),
    ['shanghai'],
  );
});

void test('single project scope cannot include another project even when grouping requested', () => {
  const tasks = [task, { ...task, id: 'b', project: 'q' }];
  const groups = heatmapGroups(
    tasks,
    [
      { id: 'p', title: '项目一' },
      { id: 'q', title: '项目二' },
    ],
    { projectId: 'p', groupByProject: true },
  );
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].tasks.map((task) => task.id),
    ['a'],
  );
  assert.deepEqual(
    heatmapGroups(tasks, [], { projectId: 'empty' })[0].tasks,
    [],
  );
  assert.deepEqual(heatmapGroups(tasks, [], { groupByProject: true }), []);
});
