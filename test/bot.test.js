import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BOT_COMMANDS, handleUpdate } from '../src/core/bot.js';
import { parseLaunchParam } from '../miniapp/src/lib/launch.js';
import { createReminderLoop, scheduleReminder } from '../src/reminders.js';
import { getStore, useStore } from '../src/state.js';
import { createStore } from '../src/store.js';

const NOW = Date.UTC(2026, 8, 21, 9, 0);
const MIN = 60_000;
const USER = 501;

let counter = 0;
const newChat = () => `bot-chat-${++counter}`;
const say = (chatId, text, ctx = {}) => handleUpdate(chatId, { type: 'text', text }, { now: NOW, userId: USER, ...ctx });
const press = (chatId, action, ctx = {}) =>
  handleUpdate(chatId, { type: 'callback', action }, { now: NOW, userId: USER, ...ctx });
const sendLocation = (chatId, latitude, longitude) =>
  handleUpdate(chatId, { type: 'location', latitude, longitude }, { now: NOW, userId: USER });
const buttons = (message) => message.buttons.flat();
const appButton = (message) => buttons(message).find((button) => button.openApp !== undefined);

beforeEach(() => useStore(createStore()));

function planReminder(userId = USER) {
  scheduleReminder(getStore(), {
    key: `plan:${userId}`,
    target: { userId },
    at: NOW + 3 * 60 * MIN,
    text: '🔔 Скоро начнётся ваш вечер: Выставка → Кафе, 19:00–21:30',
    buttons: [[{ text: 'Открыть план', openApp: 'mine_classic_today' }]],
    ref: { planId: 'classic', date: 'today' },
  });
}

test('/start сразу зовёт в приложение и объясняет, зачем остаётся чат', () => {
  const welcome = say(newChat(), '/start');
  assert.equal(appButton(welcome).openApp, '', 'первая кнопка открывает приложение');
  assert.deepEqual(welcome.buttons[0], [appButton(welcome)]);
  assert.ok(buttons(welcome).some((button) => button.requestLocation), 'можно начать от своей геолокации');
  assert.match(welcome.text, /в приложении/);
  assert.match(welcome.text, /напомню о выбранном вечере/);
  assert.match(welcome.text, /«Иду!»/);
});

test('любой текст и кнопки из старых сообщений ведут в приложение, диалог не ломается', () => {
  const chatId = newChat();
  for (const reply of [
    say(chatId, 'привет'),
    say(chatId, '/menu'),
    press(chatId, 'interest:theatre'),
    press(chatId, 'event:evt-002'),
    press(chatId, 'menu:main'),
    press(chatId, 'route:kremlin:0'),
  ]) {
    assert.match(reply.text, /в приложении/);
    assert.equal(appButton(reply).openApp, '');
  }
});

test('геолокация из чата открывает приложение от этой точки и нигде не сохраняется', () => {
  const chatId = newChat();
  const reply = sendLocation(chatId, 55.78751, 49.12234);
  assert.match(reply.text, /Точка получена/);
  const launch = parseLaunchParam(appButton(reply).openApp);
  assert.deepEqual(launch, { kind: 'here', lat: 55.788, lon: 49.122 });
  assert.doesNotMatch(JSON.stringify(getStore().state), /55\.78|49\.12/, 'координат нет в состоянии бота');
});

test('геолокация далеко от города: бот говорит об этом и не подставляет чужую точку', () => {
  const reply = sendLocation(newChat(), 55.7558, 37.6173);
  assert.match(reply.text, /не в городе Казань — до него около 7\d\d км/);
  assert.equal(appButton(reply).openApp, '');
});

test('меню команд: только команды, которые бот понимает, имена без «/»', () => {
  const prompt = say(newChat(), 'что-то непонятное').text;
  assert.ok(BOT_COMMANDS.length > 0 && BOT_COMMANDS.length <= 32);
  for (const { name, description } of BOT_COMMANDS) {
    assert.match(name, /^[a-z_]+$/);
    assert.ok(description);
    assert.notEqual(say(newChat(), `/${name}`).text, prompt, `/${name} обрабатывается`);
  }
});

test('«Как это работает» честно говорит, откуда данные, что тестовое и что хранится', () => {
  const about = press(newChat(), 'menu:about');
  assert.equal(say(newChat(), '/help').text, about.text);
  assert.match(about.text, /KudaGo/);
  assert.match(about.text, /OpenStreetMap/);
  assert.match(about.text, /тестовые/);
  assert.match(about.text, /Геолокацию не запоминает/);
  assert.ok(buttons(about).some((button) => button.action === 'menu:delete'));
});

test('удаление данных: спрашивает подтверждение, потом стирает сессию, приглашения и напоминания', () => {
  const chatId = newChat();
  say(chatId, '/start');
  planReminder();
  getStore().state.invites[String(USER)] = { 'classic:today': NOW };

  const confirm = say(chatId, '/delete');
  assert.match(confirm.text, /Удалить всё/);
  assert.ok(getStore().state.sessions[chatId], 'до подтверждения ничего не удалено');

  const done = press(chatId, 'delete:yes');
  assert.match(done.text, /удалено/);
  assert.equal(getStore().state.sessions[chatId], undefined);
  assert.equal(getStore().state.invites[String(USER)], undefined);
  assert.equal(getStore().state.reminders.length, 0);
});

test('удаление данных: отмена ничего не трогает', () => {
  const chatId = newChat();
  planReminder();
  press(chatId, 'menu:delete');
  press(chatId, 'menu:cancel');
  assert.equal(getStore().state.reminders.length, 1);
});

test('в сессии чата хранится только id пользователя MAX', () => {
  const chatId = newChat();
  getStore().state.sessions[chatId] = { userId: null, interests: ['theatre'], saved: ['evt-002'], budget: 'free' };
  say(chatId, '/start', { userId: 777 });
  assert.deepEqual(getStore().state.sessions[chatId], { userId: 777 });
});

test('/remind_test: без выбранного вечера подсказывает, что делать; с ним — присылает копию напоминания', async () => {
  const chatId = newChat();
  assert.match(say(chatId, '/remind_test').text, /Сначала выбери вечер в приложении/);
  assert.equal(getStore().state.reminders.length, 0);

  planReminder();
  assert.match(say(chatId, '/remind_test').text, /примерно через минуту/);
  const test = getStore().state.reminders.find((reminder) => reminder.key === `test:${chatId}`);
  assert.equal(test.at, NOW + MIN);

  const delivered = [];
  const loop = createReminderLoop({
    store: getStore(),
    send: async (target, message) => delivered.push({ target, message }),
    now: () => NOW + 2 * MIN,
    log: { warn() {}, error() {} },
  });
  await loop.tick();
  assert.equal(delivered.length, 1, 'пришло только тестовое, настоящее ждёт своего времени');
  assert.equal(delivered[0].target.chatId, chatId);
  assert.match(delivered[0].message.text, /Тестовое напоминание[\s\S]*Скоро начнётся ваш вечер/);
  assert.equal(delivered[0].message.buttons[0][0].openApp, 'mine_classic_today');
});
