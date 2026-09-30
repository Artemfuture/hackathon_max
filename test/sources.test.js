import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openMaskFor, parseOsmHours, parseRuTimetable, pickHours } from '../src/data/hours.js';
import { getCatalog, getPlannerEvents, setExternalEvents } from '../src/data/events.js';
import { localIsoDate } from '../src/data/time.js';
import { createKudago, normalizeEvent, parsePrice, splitTitle } from '../src/sources/kudago.js';
import { buildPlans, decodePlan, onDay } from '../shared/planner.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-29T12:00:00Z');
const NOW_SEC = Math.floor(NOW / 1000);
const iso = (offset) => localIsoDate(NOW + offset * DAY_MS);
const sec = (text) => Math.floor(Date.parse(text) / 1000);
const FOREVER = 253370754000;

test('часы работы KudaGo: дни недели, «ежедневно», «весь день», касса в скобках не мешает', () => {
  const week = parseRuTimetable('пн, вс 10:00–18:00, вт–сб 10:00–20:00 (касса: пн, вс 10:00–17:00)');
  assert.deepEqual(week[0], [600, 1080]);
  assert.deepEqual(week[1], [600, 1200]);
  assert.deepEqual(pickHours(week).hours, { open: '10:00', close: '18:00' });
  assert.ok(pickHours(week).days.every(Boolean));

  const closedMonday = pickHours(parseRuTimetable('вт–вс 11:00–20:00'));
  assert.deepEqual(closedMonday.days, [false, true, true, true, true, true, true]);
  assert.deepEqual(pickHours(parseRuTimetable('ежедневно 9:00–21:00')).hours, { open: '09:00', close: '21:00' });
  assert.deepEqual(parseRuTimetable('ежедневно весь день')[3], [0, 1440]);
  assert.equal(parseRuTimetable(''), null);
  assert.equal(parseRuTimetable('по записи'), null);
});

test('часы работы OSM: правила через «;» и через запятую, ночь после полуночи, выходной, праздники', () => {
  assert.deepEqual(pickHours(parseOsmHours('Mo-Th,Su 10:00-23:00; Fr-Sa 10:00-24:00')).hours, {
    open: '10:00',
    close: '23:00',
  });
  const late = pickHours(parseOsmHours('Mo-Th 08:00-01:00, Fr,Sa 08:00-03:00, Su 09:00-01:00'));
  assert.deepEqual(late.hours, { open: '09:00', close: '24:00' });
  assert.deepEqual(pickHours(parseOsmHours('00:00-02:00,12:00-24:00')).hours, { open: '12:00', close: '24:00' });
  assert.deepEqual(pickHours(parseOsmHours('Mo off; Tu-Su 12:00-22:00')).days, [false, true, true, true, true, true, true]);
  assert.deepEqual(pickHours(parseOsmHours('PH,Mo-Su 08:00-20:00')).hours, { open: '08:00', close: '20:00' });
  assert.equal(parseOsmHours('open'), null);
  assert.equal(parseOsmHours('sunrise-sunset'), null);
});

test('расписание по дням от сегодня: дни недели, интервал дат и конкретные даты', () => {
  const noMonday = openMaskFor({ days: [false, true, true, true, true, true, true] }, NOW);
  assert.equal(noMonday.length, 61);
  assert.equal(noMonday.slice(0, 8), '11111101');
  assert.equal(openMaskFor({ until: iso(2) }, NOW).slice(0, 4), '1110');
  assert.equal(openMaskFor({ from: iso(3) }, NOW).slice(0, 5), '00011');
  assert.equal(openMaskFor({ dates: [iso(12)] }, NOW).indexOf('1'), 12);
});

test('KudaGo: вид и название из заголовка, цена «от … до …»', () => {
  assert.deepEqual(splitTitle('выставка «Обратная сторона Луны»', 'Выставка'), {
    kind: 'Выставка',
    title: 'Обратная сторона Луны',
  });
  assert.deepEqual(splitTitle('Театрализованные экскурсии с Фонарщиком', 'Экскурсия'), {
    kind: 'Экскурсия',
    title: 'Театрализованные экскурсии с Фонарщиком',
  });
  assert.deepEqual(parsePrice('от 1 200 рублей', false), { price: 1200, priceFrom: true });
  assert.deepEqual(parsePrice('от 0 до 500 рублей', false), { price: 500, priceFrom: true });
  assert.deepEqual(parsePrice('', true), { price: 0, priceFrom: false });
  assert.equal(parsePrice('', false), null);
});

const place = { id: 18393, title: 'галерея современного искусства', address: 'ул. Карла Маркса, 57', coords: { lat: 55.7955, lon: 49.1359 } };

test('KudaGo: спектакль в конкретный день — сеанс с длительностью, выставка — место с часами площадки', () => {
  const [show] = normalizeEvent(
    {
      id: 221344,
      title: 'спектакль «Иисус Христос — суперзвезда»',
      categories: ['theater'],
      price: 'от 500 рублей',
      is_free: false,
      place,
      images: [{ image: 'https://media.kudago.com/images/event/04/92/x.jpeg' }],
      site_url: 'https://kzn.kudago.com/event/x/',
      dates: [
        { start: sec('2025-12-07T15:00:00Z'), end: sec('2025-12-07T17:30:00Z'), start_time: '18:00:00', end_time: '20:30:00', schedules: [] },
        { start: sec(`${iso(12)}T15:00:00Z`), end: sec(`${iso(12)}T17:30:00Z`), start_time: '18:00:00', end_time: '20:30:00', schedules: [] },
      ],
    },
    { nowSec: NOW_SEC }
  );
  assert.equal(show.kind, 'Спектакль');
  assert.equal(show.title, 'Иисус Христос — суперзвезда');
  assert.equal(show.time, '18:00');
  assert.equal(show.durationMin, 150);
  assert.deepEqual(show.schedule, { dates: [iso(12)] });
  assert.equal(show.image, 'https://media.kudago.com/thumbs/640x384/images/event/04/92/x.jpeg');
  assert.equal(show.source, 'kudago');

  const [exhibition] = normalizeEvent(
    {
      id: 225337,
      title: 'выставка «Обратная сторона Луны»',
      categories: ['exhibition'],
      price: 'от 250 до 500 рублей',
      is_free: false,
      place,
      dates: [{ start: sec('2026-06-03T00:00:00Z'), end: FOREVER, is_endless: true, start_time: null, schedules: [], use_place_schedule: true }],
    },
    { nowSec: NOW_SEC, timetables: new Map([[18393, 'вт–вс 11:00–20:00 (касса: вт–вс 11:00–19:30)']]) }
  );
  assert.equal(exhibition.format, 'place');
  assert.deepEqual(exhibition.hours, { open: '11:00', close: '20:00', minVisitMin: 30 });
  assert.deepEqual(exhibition.schedule.days, [false, true, true, true, true, true, true]);
  assert.equal(exhibition.schedule.from, '2026-06-03');
  assert.equal(exhibition.price, 250);
});

test('KudaGo: «по записи» без времени, акции и события за городом не попадают в каталог', () => {
  const base = { price: '500 рублей', is_free: false, place, dates: [{ start: -62135433000, end: FOREVER, is_endless: true, is_startless: true, schedules: [], use_place_schedule: true }] };
  assert.deepEqual(normalizeEvent({ ...base, id: 1, title: 'мастер-класс по росписи', categories: ['education'] }, { nowSec: NOW_SEC }), []);
  assert.deepEqual(normalizeEvent({ ...base, id: 2, title: 'акция «Скидки»', categories: ['stock', 'education'] }, { nowSec: NOW_SEC }), []);
  const far = { ...place, coords: { lat: 55.3, lon: 48.4 } };
  assert.deepEqual(normalizeEvent({ ...base, id: 3, title: 'выставка «Далеко»', categories: ['exhibition'], place: far }, { nowSec: NOW_SEC }), []);
});

test('KudaGo: загрузка страницами, копия в файл и снимок после перезапуска; ошибка сети не стирает прошлую афишу', async (t) => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'kudago-')), 'kudago.json');
  const event = {
    id: 5,
    title: 'экскурсия «Огни Казани»',
    categories: ['tour'],
    price: '300 рублей',
    is_free: false,
    place: { id: 7, title: 'площадь Тукая', coords: { lat: 55.7875, lon: 49.1223 } },
    dates: [{ start: -62135433000, end: FOREVER, is_endless: true, is_startless: true, start_time: '20:00:00', schedules: [] }],
  };
  const pages = {
    events1: { results: [event], next: 'https://kudago.com/public-api/v1.4/events/?page=2' },
    events2: { results: [{ ...event, id: 6, title: 'экскурсия «Ночная Казань»' }], next: null },
  };
  let calls = 0;
  const fetchFn = async (url) => {
    calls += 1;
    const body = url.includes('/places/') ? { results: [] } : url.includes('page=2') ? pages.events2 : pages.events1;
    return { ok: true, json: async () => body };
  };
  const quiet = { log() {}, warn() {} };
  const kudago = createKudago({ file, fetchFn, now: () => NOW, log: quiet });
  await kudago.refresh();
  assert.equal(kudago.snapshot().length, 2);
  assert.equal(calls, 3);

  const restarted = createKudago({ file, fetchFn: async () => { throw new Error('нет сети'); }, now: () => NOW, log: quiet });
  assert.equal(restarted.snapshot().length, 2);
  await restarted.refresh();
  assert.equal(restarted.snapshot().length, 2);
  t.diagnostic(`кэш: ${file}`);
});

test('каталог: кафе из OSM и афиша KudaGo рядом с тестовой, расписание по дням, пометка источников', () => {
  const [show] = normalizeEvent(
    {
      id: 221344,
      title: 'спектакль «Суперзвезда»',
      categories: ['theater'],
      price: '500 рублей',
      is_free: false,
      place,
      dates: [{ start: sec(`${iso(2)}T16:00:00Z`), end: sec(`${iso(2)}T18:30:00Z`), start_time: '19:00:00', end_time: '21:30:00', schedules: [] }],
    },
    { nowSec: NOW_SEC }
  );
  assert.equal(setExternalEvents([show, { ...show, id: 'kg-101' }, { id: 'kg-x' }], { updatedAt: iso(0) }), 1);
  try {
    const catalog = getCatalog(NOW);
    const cafes = catalog.events.filter((event) => event.category === 'food');
    assert.ok(cafes.length >= 100, 'кафе из data/cafes.json в каталоге');
    assert.ok(cafes.every((cafe) => cafe.source === 'osm' && cafe.hours && typeof cafe.openMask === 'string'));
    assert.deepEqual(
      catalog.sources.map((source) => source.id),
      ['demo', 'kudago', 'osm']
    );

    const item = catalog.events.find((event) => event.id === show.id);
    assert.equal(item.dayOffset, 2);
    assert.equal(onDay(item, 2), true);
    assert.equal(onDay(item, 1), false);
    assert.equal(item.days.includes('today'), false);

    assert.equal(item.start, '19:00');

    const events = getPlannerEvents(NOW);
    const [plan] = buildPlans(events, { day: 2, from: 18 * 60, until: 23 * 60 }, { include: item });
    assert.ok(plan.stops.some((stop) => stop.item.id === show.id));
    assert.ok(decodePlan(plan.id, events, { day: 2 }));
    assert.equal(decodePlan(plan.id, events, { day: 1 }), null);
  } finally {
    setExternalEvents([]);
  }
});

test('планировщик: в вечере не больше одного кафе, и сотни кафе не вытесняют события', () => {
  const events = getPlannerEvents(NOW);
  const plans = buildPlans(events, { day: 0, from: 17 * 60, until: 23 * 60 }, { limit: 3 });
  assert.ok(plans.length > 0);
  for (const plan of plans) {
    assert.ok(plan.stops.filter((stop) => stop.item.category === 'food').length <= 1);
    assert.ok(plan.stops.some((stop) => stop.item.category !== 'food'));
  }
});

test('спорт: настоящие катки и бассейны из OSM и тестовые группы секций на них', () => {
  const events = getPlannerEvents(NOW);
  const venues = events.filter((event) => event.category === 'sport' && event.source === 'osm');
  const groups = events.filter((event) => event.group);
  assert.ok(venues.some((venue) => venue.kind === 'Каток') && venues.some((venue) => venue.kind === 'Бассейн'));
  assert.ok(venues.every((venue) => venue.hours && venue.priceEstimate));
  const sports = new Set(groups.map((group) => group.kind));
  assert.deepEqual([...sports].sort(), ['Плавание', 'Фигурное катание']);
  for (const group of groups) {
    assert.equal(group.source, 'demo', 'группы помечены тестовыми');
    assert.equal(group.manualOnly, true);
    assert.match(group.start, /^\d{2}:\d{2}$/);
    assert.ok(group.group.ages && group.group.level && group.group.days);
    assert.ok(group.openMask.includes('1'), 'группа занимается хотя бы раз в ближайшие недели');
  }

  const plans = buildPlans(events, { day: 1, from: 16 * 60, until: 23 * 60 }, { limit: 3 });
  assert.ok(plans.every((plan) => plan.stops.every((stop) => !stop.item.manualOnly)));
  const skating = groups.find((group) => group.kind === 'Фигурное катание' && onDay(group, 1));
  const [withSkating] = buildPlans(events, { day: 1, from: 15 * 60, until: 23 * 60 }, { include: skating, limit: 1 });
  assert.ok(withSkating.stops.some((stop) => stop.item.id === skating.id));
});
