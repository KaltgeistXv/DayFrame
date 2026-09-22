import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultHomeLayout,validateHomeLayout,normalizedHomeLayout,reorderHomeCard} from '../lib/home-layout.ts';
void test('home layout is bounded and preserves explicit order, titles, folding and sizes',()=>{
  const edited=structuredClone(defaultHomeLayout);
  edited.sidebarWidth=310;edited.cards[0]={...edited.cards[0],title:'我的重点',width:'full',height:500,collapsed:true};
  assert.deepEqual(validateHomeLayout(edited),edited);
  assert.equal(reorderHomeCard(edited,'today','inbox').cards.at(-1).id,'today');
  assert.equal(reorderHomeCard(edited,'inbox','today').cards[0].id,'inbox');
  assert.equal(reorderHomeCard(edited,'unknown','today'),edited);
  assert.equal(edited.cards[0].id,'today');
});
void test('invalid cards, duplicate sections, empty names and extreme dimensions are rejected',()=>{
  for(const bad of [null,{}, {...defaultHomeLayout,sidebarWidth:10}, {...defaultHomeLayout,cards:[]},
    {...defaultHomeLayout,cards:Array(4).fill(defaultHomeLayout.cards[0])}]) assert.throws(()=>validateHomeLayout(bad));
  for(const patch of [{title:''},{height:601},{height:219},{height:320.5},{width:'arbitrary'},{collapsed:'yes'},{id:'custom'}])
    assert.throws(()=>validateHomeLayout({...defaultHomeLayout,cards:defaultHomeLayout.cards.map((c,i)=>i?c:{...c,...patch})}));
  const fallback=normalizedHomeLayout(undefined);fallback.cards[0].title='Changed';
  assert.equal(defaultHomeLayout.cards[0].title,'今日重点');
});
