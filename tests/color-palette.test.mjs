import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  palette,
  normalizeColor,
  colorHex,
  colorRules,
} from '../lib/colors.ts';

void test('six standard colors normalize idempotently, including hex aliases', () => {
  assert.equal(palette.length, 6);
  assert.equal(new Set(palette.map(([id]) => id)).size, 6);
  for (const [id, , hex] of palette) {
    assert.equal(normalizeColor(id), id);
    assert.equal(normalizeColor(hex.toUpperCase()), id);
    assert.equal(normalizeColor(normalizeColor(hex)), id);
  }
});
void test('retired presets stay in their color family and arbitrary colors join the palette', () => {
  for (const [old, current] of Object.entries({
    '#af76a1': '1',
    '#7864b2': '1',
    '#5689bb': '0',
    '#4d9e96': '2',
    '#857162': '3',
    '#b09b37': '#c88455',
  })) {
    assert.equal(normalizeColor(old), current);
    assert.equal(colorHex(old), colorHex(current));
  }
  for (const color of ['#000000', '#ffffff', '#123456', '#ff6600']) {
    assert.ok(palette.some(([id]) => id === normalizeColor(color)));
  }
});
void test('old class-based badges and direct color renderers use the same standard color', () => {
  const css = colorRules(['#af76a1']);
  assert.ok(css.includes('.color\\#af76a1'));
  assert.ok(css.includes(`background:${colorHex('1')}`));
  for (const [id] of palette) {
    const selector = '.color' + (id.startsWith('#') ? '\\' + id : id);
    assert.ok(css.includes(selector + selector));
  }
});
