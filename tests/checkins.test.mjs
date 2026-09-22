import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { checkInStats } from '../lib/checkins.ts';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import ts from 'typescript';
const source = stripTypeScriptTypes(readFileSync(new URL('../lib/progress.ts', import.meta.url), 'utf8'))
  .replace("'./task-scheduling'", JSON.stringify(new URL('../lib/task-scheduling.ts', import.meta.url).href));
const {prepareTracking,rollForward,progressOf}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const task={id:'t',title:'Layout',date:'2026-09-05',time:'',duration:1440,project:'p',status:'doing',tracking:true,priority:'medium',notes:''};
void test('daily effort does not finish a task or prevent rollover; dates and history survive manual rescheduling',()=>{
  const initial=prepareTracking(task,undefined,'2026-09-05');
  const worked={...initial,checkins:[{date:'2026-09-05',minutes:60,note:'Two pages'}]};
  const next=rollForward(worked,'2026-09-06');
  assert.equal(next.date,'2026-09-06');assert.equal(next.status,'doing');assert.equal(progressOf(next,'2026-09-06').late,1);
  assert.deepEqual(next.checkins,worked.checkins);
  const day2={...next,checkins:[...next.checkins,{date:'2026-09-06',minutes:45,note:'More pages'}]};
  const next2=rollForward(day2,'2026-09-07');
  assert.equal(next2.date,'2026-09-07');assert.equal(progressOf(next2,'2026-09-07').late,2);
  assert.equal(checkInStats([next2],'2026-09-07').days,2);
  const planned=prepareTracking({...next2,date:'2026-09-10'},next2,'2026-09-07');
  assert.deepEqual(planned.checkins,day2.checkins);
  assert.equal(planned.baselineEnd,'2026-09-10');
});
void test('project effort counts unique actual days across tasks, not elapsed or duplicate dates',()=>{
  const tasks=[{...task,checkins:[{date:'2026-09-05',minutes:60,note:''},{date:'2026-09-06',minutes:0,note:''}]},
    {...task,id:'t2',checkins:[{date:'2026-09-05',minutes:30,note:''}]}];
  assert.deepEqual(checkInStats(tasks,'2026-09-06'),{days:2,minutes:90,today:true,latest:'2026-09-06',gap:0});
  assert.equal(checkInStats(tasks,'2026-09-09').gap,3);
  assert.equal(checkInStats([task],'2026-09-09').gap,null);
});
void test('unassigned tasks render no project placeholder; assigned tasks render the actual name',async()=>{
  const output=ts.transpileModule(readFileSync(new URL('../components/project-badge.tsx',import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}}).outputText.replace(/(["'])react\/jsx-runtime\1/g,JSON.stringify(import.meta.resolve('react/jsx-runtime')));
  const {default:Badge}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
  assert.equal(renderToStaticMarkup(React.createElement(Badge,{})),'');
  const html=renderToStaticMarkup(React.createElement(Badge,{project:{id:'p',title:'作品集',color:'0'}}));
  assert.match(html,/project-badge/);assert.match(html,/作品集/);assert.doesNotMatch(html,/属于项目|无项目/);
});
