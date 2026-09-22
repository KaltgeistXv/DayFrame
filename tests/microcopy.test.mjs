import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/register-tsx.mjs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const { Calendar } = await import('../components/ui/calendar.tsx');
import { displayDate } from '../lib/calendar-date.ts';

void test('calendar announces Chinese navigation and combined today/selected state', () => {
  const date = new Date(2026, 8, 12, 12);
  const html = renderToStaticMarkup(
    React.createElement(Calendar, {
      month: date,
      today: date,
      selected: date,
      mode: 'single',
    }),
  );
  assert.match(html, /aria-label="上个月"/);
  assert.match(html, /aria-label="下个月"/);
  assert.match(html, /aria-label="2026年9月12日，今天，已选中"/);
  assert.doesNotMatch(html, /Go to the|Today,|, selected/);
});

void test('calendar keeps caller-provided accessible labels', () => {
  const html = renderToStaticMarkup(
    React.createElement(Calendar, {
      month: new Date(2026, 8, 12, 12),
      labels: { labelNext: () => '查看下月记录' },
    }),
  );
  assert.match(html, /aria-label="查看下月记录"/);
});

void test('date copy formatting preserves stored dates and does not interpret a timezone', () => {
  const stored = '2026-09-12';
  assert.equal(displayDate(stored), '2026/09/12');
  assert.equal(stored, '2026-09-12');
  assert.equal(displayDate('09-12'), '09/12');
  assert.equal(displayDate(''), '');
});
