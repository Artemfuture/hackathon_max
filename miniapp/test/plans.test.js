import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog as serverCatalog } from '../../src/data/events.js';
import { normalizeCatalog, setCatalog } from '../src/data/catalog.js';
import { nowMinutes, nextSlot } from '../src/lib/clock.js';
import { onDay, toClock, toMin } from '../src/lib/planner.js';
import {
  findEvents,
  findPlans,
  getPlan,
  planAround,
  planExists,
  singlePlan,
  windowOf,
  withOrigin,
} from '../src/lib/plans.js';
import {
  DEFAULT_PREFS,
  applyBotBenefits,
  applyBotPrefs,
  isPastFrom,
  withValidFrom,
  sanitizeBenefits,
  sanitizeMoods,
  sanitizePrefs,
} from '../src/lib/prefs.js';

const MONDAY_EVENING = Date.UTC(2026, 8, 21, 15, 0);
const TUKAY = { id: 'tukay', label: 'Площадь Тукая', lat: 55.7875, lon: 49.1223 };
const PHOTOS = { exhibition: '/e.png', walk: '/w.png', concert: '/c.png', city: '/city.svg' };

before(() => {
  const raw = { ...serverCatalog(MONDAY_EVENING), clock: { now: MONDAY_EVENING, utcOffsetMin: 180 } };
  setCatalog(normalizeCatalog(raw, PHOTOS, { loadedAt: Date.now() }));
});

const selection = (prefs = {}, rest = {}) => ({
  prefs: { ...DEFAULT_PREFS, ...prefs },
  moods: ['any'],
  benefits: [],
  origin: TUKAY,
  ...rest,
});

test('часы города: «сейчас» — время сервера, «Сейчас» начинается с ближайших круглых 5 минут', () => {
  assert.equal(nowMinutes(), 18 * 60);
  assert.equal(nextSlot(), 18 * 60 + 5);
});

test('окно «Когда вы свободны?»: сейчас + сколько есть времени, «Добавить 30 мин» его расширяет', () => {
  assert.deepEqual(windowOf({ ...DEFAULT_PREFS, from: 'now', hours: '3' }), { from: 1085, until: 1265 });
  assert.deepEqual(windowOf({ ...DEFAULT_PREFS, date: 'tomorrow', from: '19', hours: '2' }), {
    from: 1140,
    until: 1260,
  });
  assert.equal(windowOf({ ...DEFAULT_PREFS, from: '19', hours: '5' }).until, 24 * 60, 'не дальше полуночи');
  assert.equal(windowOf({ ...DEFAULT_PREFS, date: 'tomorrow', from: '16', hours: '1', extra: 30 }).until, 16 * 60 + 90);
});

test('сегодня нельзя начать в прошлом: в 18:00 «с 12:00» превращается в «Сейчас»', () => {
  assert.equal(isPastFrom('12', 'today', 18 * 60), true);
  assert.equal(isPastFrom('16', 'today', 18 * 60), true);
  assert.equal(isPastFrom('19', 'today', 18 * 60), false);
  assert.equal(isPastFrom('12', 'tomorrow', 18 * 60), false, 'завтра — любое время');
  assert.equal(withValidFrom({ ...DEFAULT_PREFS, from: '12' }, 18 * 60).from, 'now');
  assert.equal(withValidFrom({ ...DEFAULT_PREFS, date: 'tomorrow', from: 'now' }).from, '19');
  assert.equal(windowOf({ ...DEFAULT_PREFS, from: '12', hours: '2' }).from, 1085);
});

test('варианты вечера: в окне, в бюджете, с дорогой от точки старта; лучший подписан', () => {
  const plans = findPlans(selection({ from: 'now', hours: '3', budget: '1500' }));
  assert.ok(plans.length >= 2);
  assert.equal(plans[0].label, 'Лучший вариант');
  for (const plan of plans) {
    assert.ok(plan.stops[0].start >= 1085);
    assert.ok(plan.end <= 1265);
    assert.ok(plan.price <= 1500);
    assert.ok(plan.firstLeg, 'известна дорога до первой точки');
    assert.ok(plan.leaveAt <= plan.start);
  }
});

test('льготы меняют цену плана, «бесплатно» оставляет только бесплатное', () => {
  for (const plan of findPlans(selection({ budget: 'free', from: '19', hours: '3' }))) assert.equal(plan.price, 0);
  const pushkin = findPlans(selection({ budget: 'free', from: '19', hours: '3' }, { benefits: ['pushkin'] }));
  assert.ok(pushkin.length > 0);
  for (const plan of pushkin) assert.equal(plan.price, 0);
});

test('события: уже начавшиеся сегодня не предлагаются, у остальных есть «успеваете» от точки', () => {
  const list = findEvents(selection({ from: 'now', hours: '5', budget: 'any' }));
  assert.ok(list.length > 0);
  for (const { event, reach } of list) {
    if (event.start) assert.ok(toMin(event.start) >= 1085, `${event.id} ещё не начался`);
    assert.notEqual(reach.status, 'late');
    assert.ok(reach.leg);
  }
});

test('план по ссылке: код планировщика и редакторский «classic» восстанавливаются, чужой — нет', () => {
  const [plan] = findPlans(selection({ from: '19', hours: '3' }));
  const restored = getPlan(plan.id, [], 'today');
  assert.equal(toClock(restored.start), toClock(plan.start));
  assert.deepEqual(
    restored.stops.map((s) => s.item.id),
    plan.stops.map((s) => s.item.id)
  );

  const classic = getPlan('classic', ['pushkin']);
  assert.equal(toClock(classic.start), '19:00');
  assert.equal(toClock(classic.end), '22:40');
  assert.equal(classic.price, 850, 'выставка по «Пушкинской карте» бесплатно');

  assert.equal(planExists('classic'), true);
  assert.equal(planExists('r1140-999999'), false);
  assert.equal(planExists('нет-такого'), false);
});

test('«Достроить вечер» оставляет событие в плане; «только это событие» — план из одного шага', () => {
  const standup = serverCatalog(MONDAY_EVENING).events.find((e) => e.id === 'evt-155');
  const around = planAround({ ...standup, photo: '/x.png' }, selection({ from: '19', hours: '2' }));
  assert.ok(around.stops.some((stop) => stop.item.id === 'evt-155'));
  assert.match(around.label, /стендап/);

  const single = singlePlan(standup);
  assert.equal(single.stops.length, 1);
  assert.equal(toClock(single.start), '20:00');
});

test('дорога от точки старта пересчитывается для любого плана', () => {
  const classic = getPlan('classic');
  const withLeg = withOrigin(classic, TUKAY);
  assert.ok(withLeg.firstLeg.minutes > 0);
  assert.equal(withLeg.leaveAt, classic.start - withLeg.firstLeg.minutes - 5);
  assert.equal(withOrigin(classic, null).firstLeg, null);
});

test('фильтры из бота: день и бюджет подставляются, «не важно» оставляет прежние льготы', () => {
  const stored = { date: 'tomorrow', from: '16', hours: '2', budget: '3000', extra: 0 };
  const launch = { kind: 'prefs', date: 'today', budget: 'free', benefit: 'pushkin' };

  assert.deepEqual(applyBotPrefs(stored, launch), { date: 'today', from: '16', hours: '2', budget: 'free', extra: 0 });
  assert.equal(
    applyBotPrefs({ ...stored, from: 'now' }, { ...launch, date: 'tomorrow' }).from,
    '19',
    '«Сейчас» бывает только сегодня'
  );
  assert.deepEqual(applyBotBenefits(['student'], launch), ['pushkin']);
  assert.deepEqual(applyBotBenefits(['student'], { ...launch, benefit: 'none' }), ['none']);
  assert.deepEqual(applyBotBenefits(['student'], { ...launch, benefit: 'unset' }), ['student']);
  assert.equal(applyBotPrefs(stored, { kind: 'plan' }), stored, 'другие ссылки фильтры не трогают');
});

test('сохранённые в устройстве значения приводятся к актуальным справочникам', () => {
  assert.deepEqual(sanitizePrefs({ date: 'вчера', budget: 'any' }), { ...DEFAULT_PREFS, budget: 'any' });
  assert.equal(sanitizePrefs({ ...DEFAULT_PREFS, extra: 45 }).extra, 0, 'только шаги по 30 минут');
  assert.equal(sanitizePrefs({ ...DEFAULT_PREFS, extra: 60 }).extra, 60);
  assert.deepEqual(sanitizeBenefits(['pushkin', 'что-то']), ['pushkin']);
  assert.deepEqual(sanitizeBenefits(null), []);
  assert.deepEqual(sanitizeMoods(['rest', 'хаос'], ['rest', 'move']), ['rest']);
  assert.deepEqual(sanitizeMoods([], ['rest']), ['any'], 'пусто — «Неважно»');
});

test('«Поделиться маршрутом»: шаги со временем и адресом и ссылка на весь маршрут в Яндекс Картах, без цен', async () => {
  const { routeText } = await import('../src/lib/share.js');
  const [plan] = findPlans(selection({ from: '19', hours: '3' }));
  const text = routeText(plan, { city: 'Казань', day: 'сегодня' });
  assert.match(text, /^Маршрут вечера — Казань, сегодня:/);
  assert.equal(
    text.split('\n').filter((line) => /^\d\. \d{2}:\d{2}–\d{2}:\d{2} · /.test(line)).length,
    plan.stops.length
  );
  assert.match(text, /https:\/\/yandex\.ru\/maps\/\?mode=routes&rtext=/);
  assert.doesNotMatch(text, /₽| р\b/, 'цены не пишем — у получателя свои льготы');
});

test('конкретные даты: сегодня и завтра — словами, дальше — «ГГГГ-ММ-ДД», прошлое — нет', async () => {
  const { dateIdFor, dayOffset, isoForOffset, dateText } = await import('../src/lib/clock.js');
  const { isDate, dateLabel } = await import('../src/lib/prefs.js');
  assert.equal(dateIdFor(isoForOffset(0)), 'today');
  assert.equal(dateIdFor(isoForOffset(1)), 'tomorrow');
  assert.equal(dateIdFor(isoForOffset(5)), isoForOffset(5));
  assert.equal(dateIdFor(isoForOffset(-1)), null);
  assert.equal(dayOffset(isoForOffset(9)), 9);
  assert.equal(isDate('2026-10-03'), true);
  assert.equal(isDate('вчера'), false);
  assert.equal(dateLabel('2026-10-03'), '3 октября');
  assert.equal(dateText('2026-10-03'), '3 октября');

  const iso = isoForOffset(9);
  const plans = findPlans(selection({ date: iso, from: '19', hours: '3' }));
  assert.ok(plans.length > 0);
  for (const plan of plans) for (const stop of plan.stops) assert.ok(onDay(stop.item, 9));
});
