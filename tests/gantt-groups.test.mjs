import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ganttGroups } from '../lib/gantt-groups.ts';
void test('interleaved scheduled and unplanned tasks regroup without changing chosen order or data', () => {
  const tasks = [{ id:'b1',project:'b',date:'' },{ id:'a1',project:'a',date:'2026-09-08' },{ id:'b2',project:'b',date:'2026-09-09' },{ id:'a2',project:'a',date:'' }];
  const before=JSON.stringify(tasks);
  const groups=ganttGroups(tasks,[{id:'a'},{id:'b'},{id:'empty'}]);
  assert.deepEqual(groups.map(g=>[g.id,g.tasks.map(t=>t.id)]),[['a',['a1','a2']],['b',['b1','b2']]]);
  assert.equal(JSON.stringify(tasks),before);
});
void test('unassigned and orphaned tasks stay accessible in a separate group; empty groups are omitted', () => {
  const groups=ganttGroups([{id:'t',project:''},{id:'o',project:'removed'}],[{id:'a'}]);
  assert.equal(groups.length,1);
  assert.equal(groups[0].project,undefined);
  assert.deepEqual(groups[0].tasks.map(t=>t.id),['t','o']);
  assert.deepEqual(ganttGroups([],[]),[]);
});
