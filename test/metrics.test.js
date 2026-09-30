import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleUpdate } from '../src/core/bot.js';
import { summarize, track } from '../src/metrics.js';
import { getStore, useStore } from '../src/state.js';
import { createStore } from '../src/store.js';

const NOW = Date.UTC(2026, 8, 21, 9, 0);
const DAY = 24 * 60 * 60_000;

const press = (chatId, action, now = NOW) => handleUpdate(chatId, { type: 'callback', action }, { now });
const say = (chatId, text, now = NOW) => handleUpdate(chatId, { type: 'text', text }, { now, userId: 777001 });
const locate = (chatId) =>
  handleUpdate(chatId, { type: 'location', latitude: 55.7875, longitude: 49.1223 }, { now: NOW, userId: 777001 });

beforeEach(() => useStore(createStore()));

test('воронка: /start и геолокация из чата считаются, остальной ввод — нет', () => {
  say('m-1', '/start');
  say('m-1', 'привет');
  press('m-1', 'menu:about');
  locate('m-1');
  const { totals } = summarize(getStore(), { now: NOW });
  assert.equal(totals.start, 1);
  assert.equal(totals.geo, 1);
  assert.equal(totals.app_plan, 0);
});

test('в метриках нет идентификаторов пользователей и чатов, /delete их не трогает', () => {
  say('m-3', '/start');
  press('m-3', 'menu:delete');
  press('m-3', 'delete:yes');
  const saved = JSON.stringify(getStore().state.metrics);
  assert.doesNotMatch(saved, /777001|m-3/);
  assert.equal(summarize(getStore(), { now: NOW }).totals.start, 1);
});

test('хранятся только последние 60 дней, в сводку попадают только выбранные дни', () => {
  const store = getStore();
  track(store, 'start', NOW - 90 * DAY);
  track(store, 'start', NOW - 10 * DAY);
  track(store, 'start', NOW);
  assert.equal(Object.keys(store.state.metrics).length, 2, 'день 90-дневной давности удалён');
  assert.equal(summarize(store, { days: 7, now: NOW }).totals.start, 1);
  assert.equal(summarize(store, { days: 30, now: NOW }).totals.start, 2);
  assert.throws(() => track(store, 'опечатка', NOW), /Неизвестный шаг/);
});

test('/stats показывает воронку, доля выбранных планов — от открытий приложения', () => {
  say('m-4', '/start');
  for (let i = 0; i < 4; i += 1) track(getStore(), 'app_open', NOW);
  track(getStore(), 'app_plan', NOW);
  const stats = say('m-5', '/stats');
  assert.match(stats.text, /только счётчики шагов/);
  assert.match(stats.text, /Открыли бота \(\/start\): 1/);
  assert.match(stats.text, /Открыли мини-приложение: 4/);
  assert.match(stats.text, /Выбрали план в мини-приложении: 1 \(25%\)/);
});
