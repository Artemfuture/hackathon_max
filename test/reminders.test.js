import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelReminders,
  createReminderLoop,
  findReminder,
  reminderTime,
  scheduleReminder,
} from '../src/reminders.js';
import { createStore } from '../src/store.js';

const MIN = 60_000;
const NOW = Date.UTC(2026, 8, 21, 9, 0);
const quiet = { warn() {}, error() {} };

const reminder = (key, at, extra = {}) => ({ key, target: { chatId: 1 }, at, text: `текст ${key}`, ...extra });

test('время напоминания: за час до начала, если времени достаточно', () => {
  assert.equal(reminderTime(NOW + 5 * 60 * MIN, NOW, 60), NOW + 4 * 60 * MIN);
});

test('время напоминания: если событие скоро — за 10 минут до начала', () => {
  assert.equal(reminderTime(NOW + 40 * MIN, NOW, 60), NOW + 30 * MIN);
});

test('время напоминания: если начинается меньше чем через 10 минут или уже началось — null', () => {
  assert.equal(reminderTime(NOW + 8 * MIN, NOW, 60), null);
  assert.equal(reminderTime(NOW - 5 * MIN, NOW, 60), null);
});

test('постановка с тем же ключом заменяет напоминание, а не дублирует', () => {
  const store = createStore();
  scheduleReminder(store, reminder('a', NOW + MIN));
  scheduleReminder(store, reminder('a', NOW + 2 * MIN));
  assert.equal(store.state.reminders.length, 1);
  assert.equal(findReminder(store, 'a').at, NOW + 2 * MIN);
});

test('отмена убирает напоминание по ключу и по условию', () => {
  const store = createStore();
  scheduleReminder(store, reminder('a', NOW));
  scheduleReminder(store, reminder('b', NOW, { target: { chatId: 2 } }));
  scheduleReminder(store, reminder('c', NOW, { target: { chatId: 2 } }));

  assert.equal(cancelReminders(store, ({ key }) => key === 'a'), 1);
  assert.equal(cancelReminders(store, ({ key }) => key === 'a'), 0);
  assert.equal(cancelReminders(store, ({ target }) => target.chatId === 2), 2);
  assert.equal(store.state.reminders.length, 0);
});

test('цикл: отправляет подошедшие напоминания и оставляет будущие', async () => {
  const store = createStore();
  scheduleReminder(store, reminder('due', NOW - MIN));
  scheduleReminder(store, reminder('later', NOW + 30 * MIN));

  const sent = [];
  const loop = createReminderLoop({
    store,
    send: async (target, message) => sent.push({ target, message }),
    now: () => NOW,
    log: quiet,
  });
  await loop.tick();

  assert.deepEqual(sent, [{ target: { chatId: 1 }, message: { text: 'текст due', buttons: undefined } }]);
  assert.deepEqual(store.state.reminders.map((r) => r.key), ['later']);
});

test('цикл: слишком старое напоминание пропускается без отправки', async () => {
  const store = createStore();
  scheduleReminder(store, reminder('old', NOW - 7 * 60 * MIN));
  const sent = [];
  const loop = createReminderLoop({ store, send: async (...args) => sent.push(args), now: () => NOW, log: quiet });
  await loop.tick();

  assert.equal(sent.length, 0);
  assert.equal(store.state.reminders.length, 0);
});

test('цикл: неудачная отправка повторяется, а после лимита попыток напоминание снимается', async () => {
  const store = createStore();
  scheduleReminder(store, reminder('flaky', NOW - MIN));
  let attempts = 0;
  const loop = createReminderLoop({
    store,
    send: async () => {
      attempts += 1;
      throw new Error('MAX недоступен');
    },
    now: () => NOW,
    maxAttempts: 3,
    log: quiet,
  });

  await loop.tick();
  assert.equal(store.state.reminders.length, 1, 'после первой ошибки напоминание остаётся');
  await loop.tick();
  await loop.tick();

  assert.equal(attempts, 3);
  assert.equal(store.state.reminders.length, 0, 'после трёх попыток снято, чтобы не слать бесконечно');
});

test('цикл: одновременные проходы не отправляют одно напоминание дважды', async () => {
  const store = createStore();
  scheduleReminder(store, reminder('once', NOW - MIN));
  let sent = 0;
  const loop = createReminderLoop({
    store,
    send: async () => {
      sent += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
    },
    now: () => NOW,
    log: quiet,
  });

  await Promise.all([loop.tick(), loop.tick()]);
  assert.equal(sent, 1);
});
