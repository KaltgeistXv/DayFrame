import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { serverCalendarDate, dateHeading } from '../lib/calendar-date.ts';
void test('server snapshot handles Shanghai midnight while UTC is still the prior day', () => {
  assert.equal(
    serverCalendarDate(new Date('2026-09-05T15:59:59Z')),
    '2026-09-05',
  );
  assert.equal(
    serverCalendarDate(new Date('2026-09-05T16:00:00Z')),
    '2026-09-06',
  );
  assert.equal(dateHeading('2026-09-06'), '9月6日星期日');
});
void test('serialized date heading is identical across server/client timezones, including near midnight', () => {
  const script = `import {serverCalendarDate,dateHeading} from './lib/calendar-date.ts'; process.stdout.write(JSON.stringify([serverCalendarDate(new Date('2026-09-05T18:57:00Z')),dateHeading('2026-09-06'),dateHeading('2028-02-29')]));`;
  const outputs = [
    'UTC',
    'Asia/Shanghai',
    'America/Los_Angeles',
    'Pacific/Kiritimati',
  ].map((TZ) =>
    execFileSync(
      process.execPath,
      ['--experimental-strip-types', '--input-type=module', '-e', script],
      { env: { ...process.env, TZ }, encoding: 'utf8' },
    ),
  );
  for (const output of outputs) assert.equal(output, outputs[0]);
  assert.deepEqual(JSON.parse(outputs[0]), [
    '2026-09-06',
    '9月6日星期日',
    '2月29日星期二',
  ]);
});
