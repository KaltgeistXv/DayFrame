import { compileSource } from './helpers/compile-source.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  navigationOrder,
  currentSection,
  navigationIds,
  defaultAppearance,
  validateAppearance,
} from '../lib/appearance.ts';
const source = (path, aliases = {}) => compileSource(new URL(path, import.meta.url), aliases);
const views = source('../lib/calendar-views.ts', {
  './task-scheduling': new URL('../lib/task-scheduling.ts', import.meta.url)
    .href,
});
const {
  monthGrid,
  monthWeeks,
  monthVisibleWeekCount,
  tasksOnDate,
  shiftCalendarYear,
  startOfCalendarWeek,
} = await import(views);
const task = {
  id: 't',
  title: '跨月任务',
  project: 'p',
  status: 'doing',
  priority: 'medium',
  date: '2028-02-28',
  time: '',
  duration: 4320,
  notes: '',
};
void test('month grids start Monday, include leap day and span year boundaries', () => {
  const feb = monthGrid('2028-02-01');
  assert.equal(feb.length, 42);
  assert.equal(new Date(feb[0]).getUTCDay(), 1);
  assert.ok(feb.includes('2028-02-29'));
  assert.ok(monthGrid('2026-01-01').includes('2025-12-31'));
  assert.equal(shiftCalendarYear('2028-02-29', 1), '2029-02-28');
  assert.equal(shiftCalendarYear('2028-02-29', 4), '2032-02-29');
});
void test('week view anchors any selected date to its Monday', () => {
  assert.equal(startOfCalendarWeek('2026-09-09'), '2026-09-07');
  assert.equal(startOfCalendarWeek('2026-09-13'), '2026-09-07');
  assert.equal(startOfCalendarWeek('2026-09-14'), '2026-09-14');
  assert.equal(startOfCalendarWeek('2027-01-01'), '2026-12-28');
});
void test('visible month range includes every date even when boundary weeks belong to adjacent sections', () => {
  for (let year = 2026; year <= 2028; year++) {
    for (let month = 1; month <= 12; month++) {
      const date = `${year}-${String(month).padStart(2, '0')}-01`;
      const rows = monthVisibleWeekCount(date);
      const first = Date.parse(startOfCalendarWeek(date));
      const end = new Date(date + 'T12:00:00Z');
      end.setUTCMonth(end.getUTCMonth() + 1, 0);
      assert.ok(rows >= 4 && rows <= 6);
      assert.ok(
        first + rows * 7 * 86400000 >
          Date.parse(end.toISOString().slice(0, 10)),
      );
      assert.ok(
        first + (rows - 1) * 7 * 86400000 <=
          Date.parse(end.toISOString().slice(0, 10)),
      );
    }
  }
  assert.equal(monthVisibleWeekCount('2026-09-09'), 5);
  assert.equal(monthVisibleWeekCount('2026-08-01'), 6);
  assert.equal(monthVisibleWeekCount('2027-02-01'), 4);
});
void test('continuous month sections assign every week once without duplicate dates', () => {
  const months = Array.from({ length: 24 }, (_, offset) => {
    const date = new Date('2026-01-01T12:00:00Z');
    date.setUTCMonth(date.getUTCMonth() + offset);
    return date.toISOString().slice(0, 10);
  });
  const weeks = months.flatMap(monthWeeks);
  const dates = weeks.flat();
  assert.ok(weeks.every((week) => week.length === 7));
  assert.equal(new Set(dates).size, dates.length);
  for (let i = 1; i < dates.length; i++)
    assert.equal(Date.parse(dates[i]) - Date.parse(dates[i - 1]), 86400000);
  assert.ok(dates.includes('2026-02-28'));
  assert.ok(dates.includes('2027-01-01'));
});
void test('year counts deduplicate rollover projections and respect overnight exclusive end', () => {
  assert.equal(
    tasksOnDate([task, { ...task, calendarOriginal: true }], '2028-02-29')
      .length,
    1,
  );
  assert.equal(tasksOnDate([task], '2028-03-01').length, 1);
  assert.equal(
    tasksOnDate([{ ...task, time: '23:00', duration: 60 }], '2028-02-29')
      .length,
    0,
  );
});
void test('legacy calendar and tracking entries map to the unified tasks section without losing navigation order', () => {
  assert.equal(currentSection('schedule'), 'all');
  assert.equal(currentSection('tracking'), 'all');
  assert.deepEqual(
    navigationOrder([
      'projects',
      'schedule',
      'inbox',
      'all',
      'today',
      'tracking',
    ]),
    ['projects', 'inbox', 'all', 'today'],
  );
  assert.equal(navigationIds.includes('schedule'), false);
  assert.deepEqual(
    validateAppearance({
      ...defaultAppearance,
      hiddenNav: ['schedule', 'inbox'],
    }).hiddenNav,
    ['inbox'],
  );
});
void test('year overview renders twelve months and 366 selectable dates in a leap year', async () => {
  const { default: Year } = await import(
    source('../components/year-calendar.tsx', {
      '@/lib/calendar-views': views,
      '@/lib/colors': new URL('../lib/colors.ts', import.meta.url).href,
    })
  );
  const html = renderToStaticMarkup(
    React.createElement(Year, {
      date: '2028-02-29',
      today: '2028-02-29',
      tasks: [task],
      projects: [],
      onDay() {},
      onMonth() {},
      onYear() {},
      onDrop() {},
    }),
  );
  assert.equal((html.match(/class="year-month"/g) || []).length, 12);
  assert.equal((html.match(/tabindex="0"/g) || []).length, 366);
  assert.match(html, /2028-02-29，1项任务，打开日视图/);
});

void test('month rendering shows one compact ribbon per week and keeps date actions and original resize handles', async () => {
  const scheduling = new URL('../lib/task-scheduling.ts', import.meta.url).href;
  const { default: Month } = await import(
    source('../components/month-calendar.tsx', {
      'lucide-react': import.meta.resolve('lucide-react'),
      '@/lib/calendar-views': views,
      '@/lib/calendar-ribbons': source('../lib/calendar-ribbons.ts', {
        './task-scheduling': scheduling,
      }),
      '@/lib/task-scheduling': scheduling,
      '@/lib/progress': source('../lib/progress.ts', {
        './task-scheduling': scheduling,
      }),
      '@/lib/task-appearance': source('../lib/task-appearance.ts', {
        './task-scheduling': scheduling,
        './colors': new URL('../lib/colors.ts', import.meta.url).href,
      }),
      './task-menu':
        'data:text/javascript,export function TaskMenu(p){return p.children}',
    })
  );
  const html = renderToStaticMarkup(
    React.createElement(Month, {
      month: '2026-09-01',
      today: '2026-09-08',
      selected: '2026-09-08',
      range: null,
      tasks: [{ ...task, date: '2026-09-04', duration: 7200 }],
      projects: [{ id: 'p', title: '作品集', color: '1' }],
      busy: false,
      onDay() {},
      onNew() {},
      onEdit() {},
      onDrop() {},
    }),
  );
  assert.equal((html.match(/month-task-ribbon/g) || []).length, 2);
  assert.equal((html.match(/data-range-date=/g) || []).length, 28);
  assert.equal((html.match(/class="weekday"/g) || []).length, 0);
  assert.match(html, /9月1日/);
  assert.equal((html.match(/调整开始日期/g) || []).length, 1);
  assert.equal((html.match(/调整结束日期/g) || []).length, 1);
  assert.match(html, /continues-before/);
  assert.match(html, /continues-after/);
  assert.match(html, /grid-column:5 \/ 8/);
  assert.match(html, /grid-column:1 \/ 3/);
  assert.equal((html.match(/作品集/g) || []).length, 4);
  assert.doesNotMatch(html, /calendar-task-body/);
  const picked = [];
  const tree = Month({
    month: '2026-09-01',
    today: '2026-09-08',
    selected: '',
    range: null,
    tasks: [{ ...task, date: '2026-09-04', duration: 7200 }],
    projects: [],
    busy: false,
    onDay() {},
    onNew() {},
    onDrop() {},
    onEdit: (task, date) => picked.push(date),
  });
  const bodies = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node?.props) return;
    if (node.props.className === 'tracked-ribbon-body') bodies.push(node);
    visit(node.props.children);
  }
  visit(tree);
  const event = (x) => ({
    detail: 1,
    clientX: x,
    currentTarget: {
      closest: () => ({
        getBoundingClientRect: () => ({ left: 0, width: 700 }),
      }),
    },
  });
  bodies[0].props.onClick(event(650));
  bodies[1].props.onClick(event(150));
  assert.deepEqual(picked, ['2026-09-06', '2026-09-08']);
});

void test('all calendar periods share the same date, today, arrows and period control layout', async () => {
  const { default: Toolbar } = await import(
    source('../components/calendar-toolbar.tsx', {
      'lucide-react': import.meta.resolve('lucide-react'),
      './date-navigator':
        'data:text/javascript,export default function DateNavigator(){return "DATE"}',
    })
  );
  for (const period of ['year', 'month', 'week', 'day']) {
    const events = [];
    const tree = Toolbar({
      date: '2026-09-08',
      period,
      onDate() {},
      onToday: () => events.push('today'),
      onMove: (n) => events.push(n),
      children: 'PERIOD',
      toolbarStart: 'FILTERS',
      toolbarBelow: 'EXPANDED_FILTERS',
    });
    const html = renderToStaticMarkup(tree);
    assert.match(html, /calendar-unified-toolbar/);
    assert.ok(html.indexOf('calendar-toolbar-actions') < html.indexOf('DATE'));
    assert.ok(html.indexOf('今天') < html.indexOf('PERIOD'));
    assert.ok(html.indexOf('FILTERS') < html.indexOf('DATE'));
    assert.ok(html.indexOf('PERIOD') < html.indexOf('EXPANDED_FILTERS'));
    const toolbarRow = tree.props.children.find((child) => child?.props?.className === 'calendar-toolbar-actions');
    const controls = toolbarRow.props.children.find((child) => child?.props?.onPrevious);
    const actions = controls.type(controls.props).props.children;
    actions[0].props.onClick();
    actions[1].props.onClick();
    actions[2].props.onClick();
    assert.deepEqual(events, [-1, 'today', 1]);
  }
});
