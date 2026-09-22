import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { uiRulesPlugin } from '../scripts/ui-rules-plugin.mjs';

void test('development changes report violations, recovery and release watcher listeners', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dayframe-rule-watch-'));
  const watcher = new EventEmitter();
  const httpServer = new EventEmitter();
  const messages = new EventEmitter();
  let closed = false;
  try {
    for (const dir of ['app', 'components', 'hooks', 'lib']) mkdirSync(path.join(root, dir));
    const logger = { error: (message) => messages.emit('result', message), info: (message) => messages.emit('result', message) };
    uiRulesPlugin().configureServer({ config: { root, logger }, watcher, httpServer });
    const file = path.join(root, 'app/rules.css');
    const reported = () => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No automatic rule feedback')), 3000);
      messages.once('result', (message) => { clearTimeout(timer); resolve(message); });
    });
    writeFileSync(file, '.x{padding:28px}.x{padding:24px}');
    const invalid = reported();
    watcher.emit('change', file);
    assert.match(await invalid, /redundant padding/);
    writeFileSync(file, '.x{padding:24px}');
    const recovered = reported();
    watcher.emit('change', file);
    assert.match(await recovered, /Rules passed/);
    for (const event of ['add', 'change', 'unlink']) assert.equal(watcher.listenerCount(event), 1);
    httpServer.emit('close');
    closed = true;
    for (const event of ['add', 'change', 'unlink']) assert.equal(watcher.listenerCount(event), 0);
  } finally {
    if (!closed) httpServer.emit('close');
    rmSync(root, { recursive: true, force: true });
  }
});
