import './helpers/register-tsx.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const { default: YearCalendar } = await import('../components/year-calendar.tsx');
void test('only the owning month highlights today and selection, keeping six weeks per month', () => {
  const html = renderToStaticMarkup(React.createElement(YearCalendar, {
    date: '2026-09-01', today: '2026-09-01', tasks: [], projects: [],
    onDay() {}, onMonth() {}, onYear() {}, onDrop() {},
  }));
  assert.equal((html.match(/class="year-month"/g) || []).length, 12);
  assert.equal((html.match(/class="year-day /g) || []).length, 12 * 42);
  assert.equal((html.match(/class="year-day [^"]*is-today/g) || []).length, 1);
  assert.equal((html.match(/class="year-day [^"]*is-selected/g) || []).length, 1);
});
