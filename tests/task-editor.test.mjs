import './helpers/register-tsx.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { durationForTaskEnd } = await import('../lib/task-editor.ts');
import { uiCopy } from '../lib/ui-copy.ts';

const allDay = { date: '2026-09-14', time: '', duration: 1440 };
const timed = { date: '2026-09-14', time: '23:30', duration: 60 };

void test('end-date edits keep inclusive all-day and exclusive timed range semantics', () => {
  assert.equal(durationForTaskEnd(allDay, '2026-09-14'), 1440);
  assert.equal(durationForTaskEnd(allDay, '2026-09-16'), 4320);
  assert.equal(durationForTaskEnd(timed, '2026-09-15'), 60);
  assert.equal(durationForTaskEnd(timed, '2026-09-16'), 1500);
  assert.equal(durationForTaskEnd(timed, '2026-09-15', '00:15'), 45);
});

void test('both end controls enforce minimum durations and the same maximum span', () => {
  assert.equal(durationForTaskEnd(timed, timed.date, '23:35'), 5);
  assert.throws(() => durationForTaskEnd(timed, timed.date, '23:34'), {
    message: uiCopy.endTimeTooEarly,
  });
  assert.throws(() => durationForTaskEnd(allDay, '2026-09-13'), {
    message: uiCopy.endDateTooEarly,
  });
  const endDate = new Date(Date.parse(allDay.date) + 3659 * 86400000)
    .toISOString()
    .slice(0, 10);
  assert.equal(durationForTaskEnd(allDay, endDate), 5270400);
  assert.throws(() => durationForTaskEnd(allDay, '2040-01-01'), {
    message: uiCopy.scheduleTooLong,
  });
  assert.throws(() => durationForTaskEnd(timed, '2040-01-01', '00:30'), {
    message: uiCopy.scheduleTooLong,
  });
});

void test('invalid dates and times report the control that needs correction', () => {
  assert.throws(() => durationForTaskEnd(allDay, ''), {
    message: uiCopy.invalidEndDate,
  });
  assert.throws(() => durationForTaskEnd(timed, '2026-09-15', 'invalid'), {
    message: uiCopy.invalidEndTime,
  });
});
