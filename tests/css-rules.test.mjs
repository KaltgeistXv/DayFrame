import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactCss } from '../scripts/css-rules.mjs';

void test('CSS cleanup removes only identical superseded declarations and preserves cascade order', () => {
  const result = compactCss(
    '.a { color: red; padding: 8px } .b {color:blue} .a {color:red}',
  );
  assert.equal(result.removed, 1);
  assert.ok(result.css.indexOf('.b') < result.css.lastIndexOf('.a'));
  assert.match(result.css, /padding: 8px/);
  assert.equal(compactCss(result.css).removed, 0);
});

void test('CSS cleanup preserves different values, media conditions, importance, layers and keyframes', () => {
  const css =
    '.a {color:red!important;display:block;display:grid} .a {color:red} @media (min-width:800px){.a {color:red}} @layer test {.a {color:red}} @keyframes pulse{0%{opacity:0}100%{opacity:0}}';
  assert.equal(compactCss(css).removed, 0);
  assert.equal(compactCss(css).css, css);
});

const { supersededDeclarations } = await import('../scripts/css-rules.mjs');
const { default: postcss } = await import('postcss');
function shadowed(css) {
  return supersededDeclarations(postcss.parse(css)).map((d) => d.toString());
}

void test('superseded style audit requires every comma branch to be replaced', () => {
  assert.deepEqual(shadowed('.a,.b {color:red} .a {color:blue}'), []);
  assert.deepEqual(shadowed('.a,.b {color:red} .a {color:blue} .b {color:green}'), ['color:red']);
  assert.deepEqual(shadowed('.a:is(.b,.c) {color:red} .a:is(.b,.c) {color:blue}'), ['color:red']);
});

void test('superseded style audit respects priority, conditions and fallback declarations', () => {
  assert.deepEqual(shadowed('.a {color:red!important} .a {color:blue}'), []);
  assert.deepEqual(shadowed('.a {color:red} .a {color:blue!important}'), ['color:red']);
  assert.deepEqual(shadowed('.a {color:red} @media(max-width:600px){.a{color:blue}}'), []);
  assert.deepEqual(shadowed('@media(max-width:600px){.a{color:red}} @media(max-width:600px){.a{color:blue}}'), ['color:red']);
  assert.deepEqual(shadowed('@layer base{.a{color:red}} @layer app{.a{color:blue}}'), []);
  assert.deepEqual(shadowed('.a{display:block;display:grid} .a{display:flex}'), []);
  assert.deepEqual(shadowed('.a{color:red} .a:hover{color:blue} @keyframes x{0%{opacity:0}100%{opacity:0}}'), []);
});


void test('equivalent compound :is choices share coverage without losing specificity', () => {
  assert.deepEqual(shadowed('.scope :is(.a,.b){color:red} .scope .a{color:blue} .scope .b{color:blue}'), ['color:red']);
  assert.deepEqual(shadowed('.scope .a{color:red} .scope :is(.a,.b){color:blue}'), ['color:red']);
  assert.deepEqual(shadowed('.scope :is(.a,.b.c){color:red} .scope .a{color:blue} .scope .b.c{color:blue}'), []);
  assert.deepEqual(shadowed('.scope :where(.a,.b){color:red} .scope .a{color:blue} .scope .b{color:blue}'), []);
  assert.deepEqual(shadowed('.scope:is(.a .b,.c){color:red} .scope.a .b{color:blue} .scope.c{color:blue}'), []);
});
