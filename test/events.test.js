import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, inCity, walkMinutes } from '../shared/planner.js';
import { CATEGORIES, CITY, LANDMARKS, getCatalog, getPlanSummary, planStartAt } from '../src/data/events.js';
import { clockOf, dayOffsetFor, localMidnight } from '../src/data/time.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MONDAY_NOON = Date.UTC(2026, 8, 21, 9, 0);

test('время считается по часовому поясу города, а не сервера', () => {
  const justAfterMidnight = Date.UTC(2026, 8, 20, 21, 30);
  assert.equal(localMidnight(justAfterMidnight), Date.UTC(2026, 8, 20, 21, 0));
  assert.equal(clockOf(justAfterMidnight), '00:30');
});

test('конкретная дата: сколько дней до неё по часам города', () => {
  assert.equal(dayOffsetFor('2026-09-21', MONDAY_NOON), 0);
  assert.equal(dayOffsetFor('2026-10-01', MONDAY_NOON), 10);
  assert.equal(dayOffsetFor('2026-09-20', MONDAY_NOON), -1);
});

test('«в выходные»: в будни — ближайшая суббота, в субботу и воскресенье — сегодня', () => {
  assert.equal(dayOffsetFor('today', MONDAY_NOON), 0);
  assert.equal(dayOffsetFor('tomorrow', MONDAY_NOON), 1);
  assert.equal(dayOffsetFor('weekend', MONDAY_NOON), 5);
  assert.equal(dayOffsetFor('weekend', MONDAY_NOON + 5 * DAY), 0, 'суббота');
  assert.equal(dayOffsetFor('weekend', MONDAY_NOON + 6 * DAY), 0, 'воскресенье');
});

test('данные: у каждого события и места есть категория, координаты и время или часы работы', () => {
  const categoryIds = new Set(CATEGORIES.map((category) => category.id));
  for (const event of getCatalog(MONDAY_NOON).events) {
    assert.ok(event.title);
    assert.ok(categoryIds.has(event.category), event.id);
    assert.equal(typeof event.lat, 'number');
    assert.equal(typeof event.lon, 'number');
    if (event.start) assert.match(event.start, /^\d{2}:\d{2}$/);
  }
  assert.equal(CITY, 'Казань');
});

test('ежедневные события идут и сегодня, и завтра', () => {
  const events = getCatalog(MONDAY_NOON).events;
  for (const id of ['evt-101', 'evt-102', 'evt-103']) {
    const event = events.find((item) => item.id === id);
    assert.equal(event.daily, true, id);
    assert.ok(event.days.includes('today') && event.days.includes('tomorrow'), id);
  }
});

test('каталог для мини-приложения: события и места со всем, что нужно планировщику; планы ссылаются на существующие события', () => {
  const catalog = getCatalog(MONDAY_NOON);
  assert.equal(catalog.city, 'Казань');
  assert.ok(catalog.events.length >= 30, 'афиша и места города');
  assert.ok(catalog.moods.length >= 5);
  assert.equal(catalog.clock.now, MONDAY_NOON);

  const ids = new Set(catalog.events.map((e) => e.id));
  for (const plan of catalog.plans) {
    for (const stop of plan.stops) assert.ok(ids.has(stop.eventId), `${plan.id}: ${stop.eventId}`);
  }
  for (const event of catalog.events) {
    for (const field of ['kind', 'title', 'photo', 'durationMin', 'days', 'price', 'lat', 'lon', 'moods']) {
      assert.notEqual(event[field], undefined, `${event.id}.${field}`);
    }
    assert.ok(event.start || event.hours, `${event.id}: сеанс или часы работы`);
  }

  const alice = catalog.events.find((e) => e.id === 'evt-009');
  assert.deepEqual(alice.days, []);
  const yoga = catalog.events.find((e) => e.id === 'evt-008');
  assert.deepEqual(yoga.days, []);
  assert.deepEqual(catalog.events.find((e) => e.id === 'evt-002').days, ['today']);
  assert.deepEqual(catalog.events.find((e) => e.id === 'evt-004').days, ['tomorrow']);
  assert.deepEqual(catalog.events.find((e) => e.id === 'evt-012').days, ['weekend']);
});

test('план вечера: виды, время начала и конца', () => {
  assert.deepEqual(getPlanSummary('classic'), {
    id: 'classic',
    kinds: ['Выставка', 'Прогулка', 'Концерт'],
    startMinutes: 19 * 60,
    startTime: '19:00',
    endTime: '22:40',
  });
  assert.equal(getPlanSummary('нет-такого'), null);
});

test('план вечера: момент начала зависит от выбранного дня', () => {
  assert.equal(planStartAt('classic', 'today', MONDAY_NOON), Date.UTC(2026, 8, 21, 16, 0));
  assert.equal(planStartAt('classic', 'tomorrow', MONDAY_NOON), Date.UTC(2026, 8, 22, 16, 0));
  assert.equal(planStartAt('classic', 'weekend', MONDAY_NOON), Date.UTC(2026, 8, 26, 16, 0));
  assert.equal(planStartAt('нет-такого', 'today', MONDAY_NOON), null);
});

test('расстояние: центр Казани — Москва около 720 км, одна и та же точка — 0', () => {
  const kazan = { lat: 55.7988, lon: 49.1052 };
  const moscow = { lat: 55.7558, lon: 37.6173 };
  const km = distanceKm(kazan, moscow);
  assert.ok(km > 700 && km < 740, `получилось ${km}`);
  assert.equal(distanceKm(kazan, kazan), 0);
});

test('пешком: 1 км по прямой — около 16 минут с учётом извилистых улиц', () => {
  assert.equal(walkMinutes(1), 16);
  assert.equal(walkMinutes(0), 1, 'меньше минуты не показываем');
});

test('в городе или нет: считается по расстоянию до известных мест города', () => {
  assert.ok(inCity({ lat: 55.7988, lon: 49.1052 }, LANDMARKS), 'Кремль');
  assert.ok(inCity({ lat: 55.83, lon: 49.2 }, LANDMARKS), 'окраина Казани');
  assert.ok(!inCity({ lat: 55.7558, lon: 37.6173 }, LANDMARKS), 'Москва');
  assert.ok(!inCity({ lat: -55.79, lon: 49.1 }, LANDMARKS), 'южная широта');
});
