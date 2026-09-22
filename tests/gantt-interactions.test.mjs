import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  changeProjectRange,
  rangeDays,
  ganttDayIndex,
} from '../lib/gantt-interactions.ts';
import { normalizeHex } from '../lib/colors.ts';
const p = {
  id: 'p',
  title: 'Launch',
  description: '',
  color: '0',
  start: '2026-09-05',
  end: '2026-09-09',
  folder: 'work',
  tags: ['design'],
};
void test('Gantt moving from any grabbed day preserves range, labels and folder', () => {
  const n = changeProjectRange(p, 'move', '2026-09-07', '2026-09-10');
  assert.equal(n.start, '2026-09-08');
  assert.equal(n.end, '2026-09-12');
  assert.equal(rangeDays(n.start, n.end), 5);
  assert.equal(n.folder, p.folder);
  assert.deepEqual(n.tags, p.tags);
  assert.equal(
    changeProjectRange(
      { ...p, start: '2026-12-30', end: '2027-01-02' },
      'move',
      '2026-12-31',
      '2027-01-02',
    ).end,
    '2027-01-04',
  );
});
void test('Gantt resize clamps at one day and keeps opposite edge fixed', () => {
  const s = changeProjectRange(p, 'start', p.start, '2026-09-12');
  assert.equal(s.start, p.end);
  assert.equal(s.end, p.end);
  const e = changeProjectRange(p, 'end', p.end, '2026-09-01');
  assert.equal(e.end, p.start);
  assert.equal(e.start, p.start);
  assert.equal(
    changeProjectRange(p, 'end', p.end, '2026-10-01').start,
    p.start,
  );
});
void test('Unscheduled project accepts reverse range selection and inclusive leap dates', () => {
  const n = changeProjectRange(
    { ...p, start: '', end: '' },
    'range',
    '2028-03-01',
    '2028-02-28',
  );
  assert.equal(n.start, '2028-02-28');
  assert.equal(n.end, '2028-03-01');
  assert.equal(rangeDays(n.start, n.end), 3);
});
void test('Hex entry accepts shorthand and rejects malformed or unsafe values', () => {
  assert.equal(normalizeHex(' AbC '), '#aabbcc');
  assert.equal(normalizeHex('#ABCDEF'), '#abcdef');
  assert.equal(normalizeHex('000'), '#000000');
  for (const bad of ['', '12', 'abcd', 'ggg', '#abc;', 'url(red)'])
    assert.equal(normalizeHex(bad), null);
});

void test('project drag selects the same date at every zoom and after horizontal scrolling', () => {
  for (const cell of [36, 48, 60, 84, 108]) {
    for (const left of [0, -840, -2000]) {
      for (const index of [0, 21, 49, 100, 146]) {
        assert.equal(
          ganttDayIndex(
            left + 220 + cell * (index + 0.5),
            left,
            220,
            cell,
            147,
          ),
          index,
        );
      }
      assert.equal(ganttDayIndex(left + 210, left, 220, cell, 147), 0);
      assert.equal(
        ganttDayIndex(left + 220 + 200 * cell, left, 220, cell, 147),
        146,
      );
    }
  }
});
