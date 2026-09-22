import { compileSource } from './helpers/compile-source.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const asModule = (code) =>
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const compile = (path, aliases = {}) => compileSource(new URL(path, import.meta.url), aliases);
const schedule = new URL('../lib/task-scheduling.ts', import.meta.url).href;
const appearance = compile('../lib/task-appearance.ts', {
  './task-scheduling': schedule,
  './colors': new URL('../lib/colors.ts', import.meta.url).href,
});
const progress = compile('../lib/progress.ts', {
  './task-scheduling': schedule,
});
// DOM-free component test: isolate portal/context actions, render the actual row/grid.
const actions = asModule(
  `import React from ${JSON.stringify(import.meta.resolve('react'))}; export function TaskMenu({children}){return children;} export function TaskCheckInButton(){return null;} export function useTaskDeletionConfirmation(){return () => {}} export function useWorkspaceToday(){return '2026-09-08';} export function DailyCheckIn({date}){return React.createElement('button',{'data-check-date':date},date);}`,
);
const url = compile('../components/task-timeline-row.tsx', {
  '@/lib/calendar-date': new URL('../lib/calendar-date.ts', import.meta.url)
    .href,
  '@/lib/task-appearance': appearance,
  '@/lib/progress': progress,
  '@/lib/task-scheduling': schedule,
  '@/lib/model': new URL('../lib/model.ts', import.meta.url).href,
  '@/components/task-menu': actions,
});
const { default: Row } = await import(url);
const dates = [
  '2026-09-04',
  '2026-09-05',
  '2026-09-06',
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
];
const task = {
  id: 't',
  title: '排版',
  project: '',
  status: 'doing',
  priority: 'medium',
  date: '2026-09-08',
  time: '',
  duration: 1440,
  tracking: true,
  baselineStart: '2026-09-05',
  baselineEnd: '2026-09-05',
  rolledDays: 3,
  notes: '',
};
const render = (t) =>
  renderToStaticMarkup(
    React.createElement(Row, {
      task: t,
      dates,
      busy: false,
      onEdit() {},
      onMove() {},
    }),
  );
void test('only four eligible days render check-in cells at their actual date columns', () => {
  const html = render(task);
  assert.equal((html.match(/class="gantt-checkin-cell"/g) || []).length, 4);
  assert.doesNotMatch(
    html,
    /data-check-date="2026-09-04"|data-check-date="2026-09-09"/,
  );
  assert.match(html, /class="gantt-checkin-cell" style="grid-column:3"/);
  assert.match(html, /data-check-date="2026-09-08"/);
});
void test('unplanned and future tasks do not reserve an empty check-in row', () => {
  for (const t of [
    { ...task, date: '', baselineStart: '', baselineEnd: '' },
    { ...task, date: '2026-09-10', rolledDays: 0 },
  ]) {
    const html = render(t);
    assert.doesNotMatch(
      html,
      /with-checkins|gantt-checkin-cell|data-check-date/,
    );
  }
});

void test('timeline keeps the title and progress in the pinned column without duplicate bar labels or a third action line', () => {
  const html = render(task);
  assert.doesNotMatch(html, /gantt-bar-label|gantt-checkin-label/);
  assert.match(
    html,
    /aria-label="排版 · 2026\/09\/05至2026\/09\/08，编辑或拖动调整排期"/,
  );
  assert.match(html, /data-check-date="2026-09-08"/);
});
