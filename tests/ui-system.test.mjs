import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditUiRules } from '../scripts/check-ui-system.mjs';
void test('detects missing tokens even when CSS supplies a fallback', () => {
  assert.match(
    auditUiRules({ 'app/a.css': '.x {color:var(--ui-missing, red)}' }).join(),
    /undefined token/,
  );
});
void test('accepts shared and locally scoped tokens and external font variables', () => {
  assert.deepEqual(
    auditUiRules({
      'app/ui-tokens.css':
        ':root {--ui-font:var(--font-external);--ui-space:8px}',
      'app/a.css': '.x {--ui-local:var(--ui-space);padding:var(--ui-local)}',
    }),
    [],
  );
});
void test('finds cycles introduced only by the dark theme', () => {
  const errors = auditUiRules({
    'app/ui-tokens.css':
      ':root {--ui-a: red; --ui-b:var(--ui-a)} .dark {--ui-a:var(--ui-b)}',
  });
  assert.ok(errors.some((e) => e.startsWith('dark: circular')));
  assert.ok(!errors.some((e) => e.startsWith('light: circular')));
});
void test('prevents old aliases and per-component animation timings from returning', () => {
  const errors = auditUiRules({
    'components/ui/dialog.tsx': 'var(--ui-body) duration-100',
  });
  assert.ok(errors.some((e) => e.includes('obsolete token')));
  assert.ok(errors.some((e) => e.includes('shared motion')));
});

void test('prevents divergent labels for the same action without inspecting user content', () => {
  const errors = auditUiRules({
    'components/menu.tsx': '<button>移回收集箱</button>',
    'components/form.tsx': '<Picker label="项目颜色" />',
    'lib/data.ts': 'const userTitle = "项目名称";',
  });
  assert.equal(errors.length, 2);
  assert.ok(errors.every((error) => error.includes('use shared copy')));
  assert.deepEqual(
    auditUiRules({
      'components/menu.tsx': '<button>{uiCopy.cancelSchedule}</button>',
    }),
    [],
  );
});

void test('guards shared control timings, elevation and layers outside the original popup shortlist', () => {
  const errors = auditUiRules({
    'components/ui/sheet.tsx': 'duration-200 z-50 shadow-lg',
    'components/ui/switch.tsx': 'transition-all duration-150',
  });
  assert.ok(errors.some((e) => e.includes('shared layer')));
  assert.ok(errors.some((e) => e.includes('shared elevation')));
  assert.ok(errors.some((e) => e.includes('required properties')));
  assert.ok(errors.filter((e) => e.includes('shared motion')).length === 2);
});

void test('guards all registered copy and redundant CSS while allowing user data and contextual overrides', () => {
  const errors = auditUiRules({
    'lib/ui-copy.ts': 'export const uiCopy = { saved: "打卡记录已保存" }',
    'components/panel.tsx': '<output>打卡记录已保存</output>',
    'lib/data.ts': 'const note = "打卡记录已保存";',
    'app/test.css':
      '.a {padding:8px} .a {padding:8px} @media print {.a {padding:4px}}',
  });
  assert.equal(errors.length, 2);
  assert.ok(errors.some((e) => e.includes('reference uiCopy')));
  assert.ok(errors.some((e) => e.includes('redundant padding')));
});

void test('tracks lazy views and reexports; flags every orphan component', () => {
  const files = {
    'app/page.tsx': "import Panel from '@/components/panel';",
    'components/panel.tsx':
      "const Calendar = lazy(() => import('./calendar'));",
    'components/calendar.tsx': "export { Button } from './ui/button';",
    'components/ui/button.tsx': 'export function Button() {}',
    'components/orphan.tsx': 'export default function Orphan() {}',
    'components/ui/catalog.tsx': 'duration-100',
  };
  assert.deepEqual(auditUiRules(files), [
    'components/orphan.tsx: component is not reachable from an app entry',
    'components/ui/catalog.tsx: component is not reachable from an app entry',
  ]);
});


void test('rejects superseded styles while preserving responsive and fallback rules', () => {
  assert.equal(auditUiRules({'app/a.css': '.a {padding:28px} .a {padding:24px}'}).length, 1);
  assert.deepEqual(auditUiRules({'app/a.css': '.a {display:block;display:grid;padding:24px} @media (max-width:600px) {.a {padding:16px}}'}), []);
});


void test('system fonts cannot be replaced by local CSS stacks or font loaders', () => {
  assert.equal(auditUiRules({'app/a.css': '.a{font-family:Arial}'}).length, 1);
  assert.equal(auditUiRules({'components/a.tsx': "import { Inter } from 'next/font/google';"}).length, 1);
  assert.deepEqual(auditUiRules({'app/a.css': '.a{font-family:var(--ui-font-sans)}.b{font-family:inherit}', 'app/ui-tokens.css': ':root{--ui-font-sans:system-ui,sans-serif}'}), []);
});


void test('font shorthand cannot bypass the system-font guard', () => {
  assert.equal(auditUiRules({ 'app/a.css': '.a{font:12px Arial}\n.b{font:italic 23px Georgia}' }).length, 2);
  assert.deepEqual(auditUiRules({ 'app/a.css': '.a{font:inherit}.b{font:12px/1.5 var(--ui-font-sans)}', 'app/ui-tokens.css': ':root{--ui-font-sans:system-ui,sans-serif}' }), []);
});
