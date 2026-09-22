import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/register-tsx.mjs';
const { navigationTarget, matchesTaskFocus, statusGroupKey } = await import('../lib/navigation-policy.ts');
const today = '2026-09-14';
const base = { id: 'a', title: 'Task', project: '', status: 'doing', date: today, time: '', duration: 1440, priority: 'medium', notes: '' };
void test('metric entries select their own result set instead of the generic tracking view', () => {
  assert.equal(navigationTarget('today-tasks').focus, 'today');
  assert.equal(navigationTarget('overdue-tasks').focus, 'overdue');
  assert.equal(navigationTarget('today-checkins').focus, 'checkins');
  assert.equal(navigationTarget('unplanned-tasks').section, 'inbox');
  assert.equal(navigationTarget('unplanned-tasks').completion, 'active');
  assert.equal(navigationTarget('my-project'), null);
});
void test('today results include spanning tasks but exclude completed and undated tasks', () => {
  assert.equal(matchesTaskFocus({...base, date:'2026-09-13', duration:4320}, 'today', today), true);
  assert.equal(matchesTaskFocus({...base, status:'done'}, 'today', today), false);
  assert.equal(matchesTaskFocus({...base, date:''}, 'today', today), false);
  assert.equal(matchesTaskFocus({...base, date:'2026-09-15'}, 'today', today), false);
});
void test('today check-ins include completed and ordinary tasks with a real record', () => {
  assert.equal(matchesTaskFocus({...base, status:'done', checkins:[{date:today}]}, 'checkins', today), true);
  assert.equal(matchesTaskFocus({...base, tracking:true, checkins:[{date:'2026-09-13'}]}, 'checkins', today), false);
  assert.equal(matchesTaskFocus(base, 'checkins', today), false);
});
void test('overdue entry excludes untracked and completed work', () => {
  assert.equal(matchesTaskFocus({...base, tracking:true, date:'2026-09-10', baselineStart:'2026-09-10', baselineEnd:'2026-09-10'}, 'overdue', today), true);
  assert.equal(matchesTaskFocus({...base, date:'2026-09-10'}, 'overdue', today), false);
  assert.equal(matchesTaskFocus({...base, tracking:true, status:'done'}, 'overdue', today), false);
});
void test('explicit schedule entry selects today; ordinary entry leaves date and view choice to the user', () => {
  assert.equal(navigationTarget('schedule').today, true);
  assert.equal(navigationTarget('schedule').view, 'calendar');
  assert.equal(navigationTarget('all'), null);
});
void test('status collapse belongs to its section, independent of presentation', () => {
  assert.equal(statusGroupKey('a', 'done'), 'a:status:done');
  assert.notEqual(statusGroupKey('a', 'done'), statusGroupKey('b', 'done'));
});
