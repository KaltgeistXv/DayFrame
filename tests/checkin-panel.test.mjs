import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/register-tsx.mjs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const { CheckInPanel } = await import('../components/check-in-dialog.tsx');
const task = {
  id: 't',
  title: '排版',
  tracking: true,
  status: 'doing',
  checkins: [
    { date: '2026-09-07', note: '初稿', minutes: 30 },
    { date: '2026-09-08', note: '调整版式', minutes: 60 },
  ],
};
function render(t = task, initialDate) {
  return renderToStaticMarkup(
    React.createElement(CheckInPanel, {
      task: t,
      initialDate,
      today: '2026-09-08',
      busy: false,
      onSave() {},
      onRemove() {},
    }),
  );
}
void test('task detail activity panel shows editable day, notes and most recent history first', () => {
  const html = render();
  assert.match(html, /2026\/09\/08/);
  assert.match(html, />调整版式<\/textarea>/);
  assert.doesNotMatch(html, /type="number"/);
  assert.match(html, /已打卡<\/dt><dd>2 天/);
  assert.match(html, /保存记录/);
  assert.match(html, /删除记录/);
  const history = html.slice(html.indexOf('checkin-history'));
  assert.ok(history.indexOf('2026/09/08') < history.indexOf('2026/09/07'));
  assert.doesNotMatch(html, /<form/);
  assert.equal(
    (html.match(/<button/g) || []).length,
    (html.match(/<button type="button"/g) || []).length,
  );
});
void test('completion day notes remain editable while completion check-in is retained', () => {
  const html = render({ ...task, status: 'done', completedOn: '2026-09-07' });
  assert.match(html, /2026\/09\/07/);
  assert.match(html, />初稿<\/textarea>/);
  assert.match(html, /保存记录/);
  assert.doesNotMatch(html, /删除记录/);
});
void test('empty tracked task can add its first record', () => {
  const html = render({ ...task, checkins: [] });
  assert.match(html, /保存记录/);
  assert.match(html, /暂无打卡记录/);
  assert.doesNotMatch(html, /删除记录/);
});

void test('opening from a historical date loads that day rather than today', () => {
  const html = render(task, '2026-09-07');
  assert.match(html, /2026\/09\/07/);
  assert.match(html, />初稿<\/textarea>/);
});
void test('opening from a future date retains the selected day without offering a check-in', () => {
  const html = render(task, '2026-09-10');
  assert.match(html, /2026\/09\/10/);
  assert.match(html, /不能为未来日期打卡/);
  assert.doesNotMatch(html, /保存记录/);
});

void test('future and unscheduled tasks offer records instead of an unavailable today check-in', async () => {
  const { TaskActionsProvider, TaskCheckInButton } =
    await import('../components/task-menu.tsx');
  const base = {
    id: 't',
    title: 'Demo',
    project: '',
    status: 'todo',
    priority: 'medium',
    date: '2026-09-20',
    time: '',
    duration: 1440,
    notes: '',
    tracking: true,
    checkins: [],
  };
  const renderButton = (task) =>
    renderToStaticMarkup(
      React.createElement(
        TaskActionsProvider,
        {
          value: {
            today: '2026-09-12',
            busy: false,
            projects: [],
            labels: [],
            checkIn() {},
            toggleCheckIn() {},
            edit() {},
            update() {},
            remove() {},
            duplicate() {},
          },
        },
        React.createElement(TaskCheckInButton, { task }),
      ),
    );
  assert.match(renderButton(base), /打卡记录/);
  assert.doesNotMatch(renderButton(base), /今日打卡/);
  assert.match(renderButton({ ...base, date: '' }), /打卡记录/);
  assert.match(renderButton({ ...base, date: '2026-09-12' }), /今日打卡/);
});

// Task details may stay mounted while a second dialog is open.
void test('multiple activity panels have independent accessible history headings', () => {
  const html = renderToStaticMarkup(
    React.createElement(React.Fragment, null,
      ...['first', 'second'].map(id => React.createElement(CheckInPanel, {
        key: id, task: { ...task, id }, today: '2026-09-08', busy: false,
        onSave() {}, onRemove() {},
      })),
    ),
  );
  const historyIds = [...html.matchAll(/class="checkin-history" aria-labelledby="([^"]+)"/g)].map(match => match[1]);
  assert.equal(historyIds.length, 2);
  assert.equal(new Set(historyIds).size, 2);
  for (const id of historyIds) assert.ok(html.includes(`id="${id}"`));
  assert.match(html, /aria-pressed="true" class="active"/);
});
