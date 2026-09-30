import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.js';

const quiet = { warn() {}, error() {} };
const tempFile = () => path.join(mkdtempSync(path.join(os.tmpdir(), 'store-')), 'nested', 'state.json');
const tempFileWithDir = () => {
  const file = tempFile();
  mkdirSync(path.dirname(file), { recursive: true });
  return file;
};

test('хранилище: состояние переживает перезапуск', () => {
  const file = tempFile();
  const first = createStore({ file, log: quiet });
  first.state.sessions['42'] = { step: 'browsing', saved: ['evt-001'] };
  first.state.marker = 17;
  first.touch();
  first.flush();

  const second = createStore({ file, log: quiet });
  assert.deepEqual(second.state.sessions['42'], { step: 'browsing', saved: ['evt-001'] });
  assert.equal(second.state.marker, 17);
  assert.deepEqual(second.state.reminders, []);
});

test('хранилище: запись атомарная — временного файла не остаётся, файл — валидный JSON', () => {
  const file = tempFile();
  const store = createStore({ file, log: quiet });
  store.state.marker = 1;
  store.touch();
  store.flush();

  assert.equal(JSON.parse(readFileSync(file, 'utf8')).marker, 1);
  assert.deepEqual(readdirSync(path.dirname(file)), ['state.json']);
});

test('хранилище: запись откладывается и объединяет подряд идущие правки', async () => {
  const file = tempFile();
  const store = createStore({ file, flushDelayMs: 20, log: quiet });
  store.state.marker = 1;
  store.touch();
  store.state.marker = 2;
  store.touch();
  assert.equal(existsSync(file), false, 'сразу на диск не пишем');

  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).marker, 2);
});

test('хранилище: повреждённый файл откладывается в сторону, бот стартует с чистого состояния', () => {
  const file = tempFileWithDir();
  writeFileSync(file, '{"version": 1, "sessions": ');

  const warnings = [];
  const store = createStore({ file, log: { warn: (m) => warnings.push(m), error() {} } });

  assert.deepEqual(store.state.sessions, {});
  assert.equal(warnings.length, 1);
  assert.ok(readdirSync(path.dirname(file)).some((name) => name.startsWith('state.json.broken-')));
});

test('хранилище: файл неизвестной версии не читается вслепую', () => {
  const file = tempFileWithDir();
  writeFileSync(file, JSON.stringify({ version: 99, sessions: { 1: {} } }));

  const store = createStore({ file, log: quiet });
  assert.deepEqual(store.state.sessions, {});
});

test('хранилище без файла работает только в памяти', () => {
  const store = createStore();
  store.state.marker = 5;
  store.touch();
  store.flush();
  assert.equal(store.state.marker, 5);
});
