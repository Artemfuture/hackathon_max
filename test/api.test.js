import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApi } from '../src/api.js';
import { findReminder } from '../src/reminders.js';
import { createWebServer } from '../src/server.js';
import { createStore } from '../src/store.js';
import { parseLaunchParam } from '../miniapp/src/lib/launch.js';
import { getPlannerEvents } from '../src/data/events.js';
import { buildPlans, toMin } from '../shared/planner.js';
import { TEST_TOKEN, signedInitData } from './support/signedInitData.js';

const NOW = Date.UTC(2026, 8, 21, 9, 0);
const MIN = 60_000;
const PLAN_STARTS = Date.UTC(2026, 8, 21, 16, 0);
const quiet = { warn() {}, error() {} };

let server;
let base;
let store;
let sent;
let failNextSend;

const launchAs = (id, firstName, extra = {}) =>
  signedInitData({
    auth_date: String(Math.floor(NOW / 1000)),
    user: JSON.stringify({ id, first_name: firstName }),
    ...extra,
  });

const post = (route, body, initData) =>
  fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(initData ? { 'X-Max-Init-Data': initData } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

before(async () => {
  const dist = path.join(mkdtempSync(path.join(os.tmpdir(), 'api-')), 'dist');
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Досуг</title>');

  store = createStore();
  const api = createApi({
    botToken: TEST_TOKEN,
    store,
    now: () => NOW,
    leadMinutes: 60,
    log: quiet,
    notify: async (target, message) => {
      if (failNextSend) {
        failNextSend = false;
        throw new Error('MAX недоступен');
      }
      sent.push({ target, message });
    },
  });
  server = createWebServer({ rootDir: dist, api });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

beforeEach(() => {
  sent = [];
  failNextSend = false;
  store.state.reminders = [];
  store.state.invites = {};
});

const invite = (organizerId, planId, date, at = NOW) => {
  (store.state.invites[organizerId] ??= {})[`${planId}:${date}`] = at;
};

test('GET /api/catalog: каталог отдаётся без авторизации и без кэширования', async () => {
  const res = await fetch(`${base}/api/catalog`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal(res.headers.get('cache-control'), 'no-store');

  const catalog = await res.json();
  assert.equal(catalog.city, 'Казань');
  assert.ok(catalog.events.length >= 30);
  assert.equal(catalog.plans.length, 3);
  assert.equal(catalog.weather, null, 'без источника погоды прогноз просто не приходит');
  assert.equal(catalog.source.isTest, true);
  assert.match(catalog.source.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test('запросы без подписи запуска или с чужой подписью отклоняются', async () => {
  const body = { planId: 'classic', date: 'today', organizerId: '7' };
  assert.equal((await post('/api/going', body)).status, 401);
  assert.equal((await post('/api/going', body, 'hash=00&user=%7B%7D')).status, 401);

  const foreign = signedInitData(
    { auth_date: String(Math.floor(NOW / 1000)), user: JSON.stringify({ id: 1, first_name: 'Х' }) },
    'чужой-токен'
  );
  assert.equal((await post('/api/going', body, foreign)).status, 401);
  assert.equal(sent.length, 0);
});

test('устаревшие данные запуска: 401 с кодом expired, чтобы приложение попросило открыть его заново', async () => {
  const stale = signedInitData({
    auth_date: String(Math.floor(NOW / 1000) - 2 * 3600),
    user: JSON.stringify({ id: 7, first_name: 'Анна' }),
  });
  const res = await post('/api/plan', { planId: 'classic', date: 'today' }, stale);
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { ok: false, error: 'expired' });

  const forged = await post('/api/plan', { planId: 'classic', date: 'today' }, 'hash=00&user=%7B%7D');
  assert.equal((await forged.json()).error, 'unauthorized');
  assert.equal(sent.length, 0);
});

test('«Иду!»: организатор получает сообщение с именем гостя и кнопкой открытия плана', async () => {
  invite('7', 'classic', 'today');
  const res = await post('/api/going', { planId: 'classic', date: 'today', organizerId: '7' }, launchAs(555, 'Анна'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, notified: true });

  assert.equal(sent.length, 1);
  const { target, message } = sent[0];
  assert.deepEqual(target, { userId: 7 });
  assert.match(message.text, /🎉 Анна идёт!/);
  assert.match(message.text, /сегодня: Выставка → Прогулка → Концерт, 19:00–22:40/);

  const [[button]] = message.buttons;
  assert.equal(button.text, 'Открыть план');
  assert.match(button.openApp, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(parseLaunchParam(button.openApp), {
    kind: 'going',
    planId: 'classic',
    date: 'today',
    userId: '555',
    name: 'Анна',
  });
});

test('«Иду!»: повторное нажатие не шлёт организатору второе сообщение', async () => {
  invite('7', 'calm', 'tomorrow');
  const body = { planId: 'calm', date: 'tomorrow', organizerId: '7' };
  await post('/api/going', body, launchAs(555, 'Анна'));
  const again = await (await post('/api/going', body, launchAs(555, 'Анна'))).json();

  assert.deepEqual(again, { ok: true, notified: false, reason: 'duplicate' });
  assert.equal(sent.length, 1);
});

test('«Иду!»: организатор, открывший свою же ссылку, не получает уведомление сам себе', async () => {
  const res = await post('/api/going', { planId: 'calm', date: 'today', organizerId: '555' }, launchAs(555, 'Анна'));
  assert.deepEqual(await res.json(), { ok: true, notified: false, reason: 'self' });
  assert.equal(sent.length, 0);
});

test('«Иду!»: если MAX не принял сообщение — 502, и повторная попытка потом сработает', async () => {
  invite('9', 'music', 'today');
  const body = { planId: 'music', date: 'today', organizerId: '9' };
  failNextSend = true;
  assert.equal((await post('/api/going', body, launchAs(600, 'Борис'))).status, 502);

  const retry = await post('/api/going', body, launchAs(600, 'Борис'));
  assert.equal(retry.status, 200);
  assert.equal(sent.length, 1, 'неудачная попытка не считается выполненной');
});

test('геолокация через чат: бот присылает кнопку «📍» тому, кто открыл приложение, и не спамит', async () => {
  const res = await post('/api/geo', {}, launchAs(701, 'Вера'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, sent: true });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].target, { userId: 701 });
  assert.ok(sent[0].message.buttons.flat().some((button) => button.requestLocation));

  const again = await (await post('/api/geo', {}, launchAs(701, 'Вера'))).json();
  assert.deepEqual(again, { ok: true, sent: false, reason: 'duplicate' });
  assert.equal(sent.length, 1, 'повторное нажатие в течение 30 секунд не дублирует сообщение');
});

test('геолокация через чат: без подписи запуска — 401; сбой MAX — 502, и повтор сработает', async () => {
  assert.equal((await post('/api/geo', {})).status, 401);
  failNextSend = true;
  assert.equal((await post('/api/geo', {}, launchAs(702, 'Глеб'))).status, 502);
  assert.equal((await post('/api/geo', {}, launchAs(702, 'Глеб'))).status, 200);
  assert.equal(sent.length, 1);
});

test('«Иду!»: писать можно только тому, кто сам выбрал этот план, — произвольному пользователю нет', async () => {
  const body = { planId: 'classic', date: 'today', organizerId: '424242' };
  const res = await post('/api/going', body, launchAs(555, 'Спамер'));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'unknown_invite');

  invite('424242', 'calm', 'today');
  assert.equal((await post('/api/going', body, launchAs(555, 'Спамер'))).status, 403);
  assert.equal(sent.length, 0);
});

test('«Иду!»: приглашение создаётся выбором плана организатором и действует две недели', async () => {
  const body = { planId: 'classic', date: 'today', organizerId: '321' };

  await post('/api/plan', { planId: 'classic', date: 'today' }, launchAs(321, 'Организатор'));
  sent = [];
  assert.equal((await post('/api/going', body, launchAs(555, 'Анна'))).status, 200);
  assert.deepEqual(sent[0].target, { userId: 321 });

  store.state.invites['321']['classic:today'] = NOW - 15 * 24 * 60 * MIN;
  sent = [];
  assert.equal((await post('/api/going', body, launchAs(556, 'Борис'))).status, 403);
  assert.equal(sent.length, 0);
});

test('«Иду!»: неверные данные в теле запроса — 400 с понятным кодом', async () => {
  const init = launchAs(555, 'Анна');
  const cases = [
    [{ planId: 'нет-такого', date: 'today', organizerId: '7' }, 'bad_plan'],
    [{ planId: 'classic', date: 'вчера', organizerId: '7' }, 'bad_date'],
    [{ planId: 'classic', date: 'today', organizerId: 'abc' }, 'bad_organizer'],
    [{ planId: 'classic', date: 'today', organizerId: '0' }, 'bad_organizer'],
    [{ planId: 'classic', date: 'today' }, 'bad_organizer'],
    [{}, 'bad_plan'],
  ];
  for (const [body, error] of cases) {
    const res = await post('/api/going', body, init);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal((await res.json()).error, error);
  }
  assert.equal((await post('/api/going', '{это не json', init)).status, 400);
  assert.equal(sent.length, 0);
});

test('слишком большое тело запроса — 413', async () => {
  const huge = JSON.stringify({ planId: 'classic', date: 'today', organizerId: '7', filler: 'я'.repeat(9000) });
  assert.equal((await post('/api/going', huge, launchAs(555, 'Анна'))).status, 413);
});

test('выбор плана: пользователю приходит сообщение в чат и ставится напоминание за час', async () => {
  const res = await post('/api/plan', { planId: 'classic', date: 'today' }, launchAs(555, 'Анна'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, reminderAt: PLAN_STARTS - 60 * MIN });

  const { target, message } = sent[0];
  assert.deepEqual(target, { userId: 555 });
  assert.match(message.text, /✅ Вечер выбран: Выставка → Прогулка → Концерт, 19:00–22:40/);
  assert.match(message.text, /Напомню в 18:00 — за 60 мин до начала/);
  assert.deepEqual(parseLaunchParam(message.buttons[0][0].openApp), { kind: 'mine', planId: 'classic', date: 'today' });

  const reminder = findReminder(store, 'plan:555');
  assert.deepEqual(reminder.target, { userId: 555 });
  assert.equal(reminder.at, PLAN_STARTS - 60 * MIN);
  assert.match(reminder.text, /Скоро начнётся ваш вечер/);
});

test('выбор плана: тот же выбор второй раз молчит, другой заменяет напоминание', async () => {
  const init = launchAs(555, 'Анна');
  await post('/api/plan', { planId: 'classic', date: 'today' }, init);
  const same = await (await post('/api/plan', { planId: 'classic', date: 'today' }, init)).json();
  assert.equal(same.unchanged, true);
  assert.equal(sent.length, 1);

  await post('/api/plan', { planId: 'calm', date: 'tomorrow' }, init);
  assert.equal(sent.length, 2);
  assert.equal(store.state.reminders.length, 1, 'напоминание одно на пользователя');
  assert.equal(findReminder(store, 'plan:555').ref.planId, 'calm');
});

test('выбор плана: если начало слишком скоро, сообщение приходит, а напоминание не ставится', async () => {
  const soon = signedInitData({
    auth_date: String(Math.floor((PLAN_STARTS - 15 * MIN) / 1000)),
    user: JSON.stringify({ id: 556, first_name: 'Вика' }),
  });
  const lateApi = createApi({
    botToken: TEST_TOKEN,
    store,
    now: () => PLAN_STARTS - 5 * MIN,
    log: quiet,
    notify: async (target, message) => sent.push({ target, message }),
  });
  const lateServer = createWebServer({ rootDir: os.tmpdir(), api: lateApi });
  await new Promise((resolve) => lateServer.listen(0, '127.0.0.1', resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${lateServer.address().port}/api/plan`, {
      method: 'POST',
      headers: { 'X-Max-Init-Data': soon },
      body: JSON.stringify({ planId: 'classic', date: 'today' }),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).reminderAt, null);
    assert.match(sent[0].message.text, /напоминание не ставлю/);
    assert.equal(findReminder(store, 'plan:556'), null);
  } finally {
    lateServer.close();
  }
});

test('лимит запросов: после 20 запросов в минуту от одного пользователя — 429', async () => {
  const init = launchAs(999, 'Спамер');
  const body = { planId: 'classic', date: 'today', organizerId: '7' };
  let last;
  for (let i = 0; i < 21; i += 1) last = await post('/api/going', body, init);
  assert.equal(last.status, 429);
});

test('неизвестный путь — 404 в JSON, неверный метод — 405, сама страница отдаётся как раньше', async () => {
  const missing = await fetch(`${base}/api/unknown`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, 'not_found');

  const wrongMethod = await fetch(`${base}/api/catalog`, { method: 'POST' });
  assert.equal(wrongMethod.status, 405);

  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Досуг/);
});

test('метрики: открытие приложения, выбор плана и «Иду!» считаются без данных пользователей', async () => {
  store.state.metrics = {};
  await fetch(`${base}/api/catalog`);
  await post('/api/plan', { planId: 'calm', date: 'tomorrow' }, launchAs(9001, 'Олег'));
  await post('/api/going', { planId: 'calm', date: 'tomorrow', organizerId: '9001' }, launchAs(9002, 'Ира'));

  const [counts] = Object.values(store.state.metrics);
  assert.equal(counts.app_open, 1);
  assert.equal(counts.app_plan, 1);
  assert.equal(counts.going, 1);
  assert.doesNotMatch(JSON.stringify(store.state.metrics), /9001|9002|Олег|Ира/);
});

test('план из планировщика (код «r…»): бот пишет шаги и время, ставит напоминание; план на чужой день отклоняется', async () => {
  const [plan] = buildPlans(getPlannerEvents(NOW), { day: 'today', from: toMin('19:00'), until: toMin('22:00') }, { limit: 1 });
  sent = [];
  const res = await post('/api/plan', { planId: plan.id, date: 'today' }, launchAs(777, 'Лена'));
  assert.equal(res.status, 200);
  const [message] = sent;
  assert.match(message.message.text, new RegExp(plan.stops.map((stop) => stop.item.kind).join(' → ')));
  assert.equal(parseLaunchParam(message.message.buttons[0][0].openApp).planId, plan.id);
  assert.ok(findReminder(store, 'plan:777'));

  const wrongDay = await post('/api/plan', { planId: 'r1170-002', date: 'weekend' }, launchAs(777, 'Лена'));
  assert.equal(wrongDay.status, 400);
  assert.equal((await wrongDay.json()).error, 'bad_plan');
});

test('план на конкретную дату «ГГГГ-ММ-ДД»: принимается на 60 дней вперёд, прошедшая дата — нет', async () => {
  sent = [];
  const future = await post('/api/plan', { planId: 'r1140-101', date: '2026-10-01' }, launchAs(888, 'Оля'));
  assert.equal(future.status, 200);
  assert.match(sent[0].message.text, /1 октября/);
  assert.equal(parseLaunchParam(sent[0].message.buttons[0][0].openApp).date, '2026-10-01');

  const past = await post('/api/plan', { planId: 'r1140-101', date: '2026-09-20' }, launchAs(888, 'Оля'));
  assert.equal(past.status, 400);
  const tooFar = await post('/api/plan', { planId: 'r1140-101', date: '2027-03-01' }, launchAs(888, 'Оля'));
  assert.equal(tooFar.status, 400);
  const wrong = await post('/api/plan', { planId: 'r1170-002', date: '2026-10-01' }, launchAs(888, 'Оля'));
  assert.equal((await wrong.json()).error, 'bad_plan');
});
