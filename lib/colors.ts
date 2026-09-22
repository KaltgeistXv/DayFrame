export const palette = [
  ['0', '雾蓝', '#93acc8'],
  ['1', '浅紫', '#b5a1cb'],
  ['2', '森林绿', '#9db799'],
  ['3', '石墨灰', '#aaa99c'],
  ['#c66a72', '莓红', '#c66a72'],
  ['#c88455', '杏橙', '#c88455'],
];
export const validColor = (v: unknown): v is string =>
  typeof v === 'string' && (/^[0-3]$/.test(v) || /^#[0-9a-fA-F]{6}$/.test(v));
// Retired presets retain their color family when joining the six-color palette.
const retiredColors: Record<string, string> = {
  '#b09b37': '#c88455',
  '#4d9e96': '2',
  '#5689bb': '0',
  '#7864b2': '1',
  '#af76a1': '1',
  '#857162': '3',
};
export function normalizeColor(value: string): string {
  const v = value.toLowerCase();
  const exact = palette.find(([id, , hex]) => id === v || hex === v);
  if (exact) return exact[0];
  if (retiredColors[v]) return retiredColors[v];
  if (!/^#[0-9a-f]{6}$/.test(v)) return '3';
  const channels = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const source = channels(v);
  let closest = '3',
    distance = Infinity;
  for (const [id, , hex] of palette) {
    const rgb = channels(hex);
    const d = rgb.reduce(
      (sum, channel, i) => sum + (channel - source[i]) ** 2,
      0,
    );
    if (d < distance) {
      closest = id;
      distance = d;
    }
  }
  return closest;
}
export const colorHex = (v: string) =>
  palette.find(([id]) => id === normalizeColor(v))![2];
// Fixed pale background and dark ink preserve readability even for very light custom colors.
export function colorStyle(value: string, strength = 0.15) {
  const hex = colorHex(value),
    channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mix = (factor: number, base: number) =>
    '#' +
    channels
      .map((c) =>
        Math.round(c * factor + base * (1 - factor))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  return {
    backgroundColor: mix(strength, 255),
    color: mix(0.42, 0),
    borderColor: hex,
  };
}
export function colorRules(values: string[]) {
  return [...new Set([...palette.map(([id]) => id), ...values])]
    .filter(validColor)
    .map((v) => {
      const s = colorStyle(v),
        selector = '.color' + (v.startsWith('#') ? '\\' + v : v);
      return `${selector}${selector}{background:${s.backgroundColor};color:${s.color};border-color:${s.borderColor}}${selector}.dot,${selector}.task-tag-dot{background:${colorHex(v)}}`;
    })
    .join('\n');
}

export function normalizeHex(input: string): string | null {
  const value = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(value)) return '#' + value.toLowerCase();
  if (/^[0-9a-fA-F]{3}$/.test(value))
    return '#' + value.replace(/./g, '$&$&').toLowerCase();
  return null;
}
