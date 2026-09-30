import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog as serverCatalog } from '../../src/data/events.js';
import { getCatalog, normalizeCatalog, setCatalog } from '../src/data/catalog.js';
import { loadCatalog } from '../src/data/loadCatalog.js';

const PHOTOS = { exhibition: '/e.png', walk: '/w.png', concert: '/c.png', city: '/city.svg' };

const fakeResponse = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

test('каталог сервера бота проходит разбор мини-приложения: события, места, планы и справочники целы', () => {
  const raw = serverCatalog();
  const catalog = normalizeCatalog(raw, PHOTOS);

  assert.equal(catalog.city, 'Казань');
  assert.equal(catalog.events.length, raw.events.length, 'ни одно событие не потерялось');
  assert.equal(catalog.plans.length, 3);
  assert.ok(
    catalog.events.some((event) => event.hours),
    'есть места с часами работы'
  );
  assert.ok(catalog.moods.length >= 5, 'настроения для экрана «Как хочется провести время?»');
  assert.ok(catalog.landmarks.some((place) => place.id === 'kremlin'));
  assert.equal(catalog.source.isTest, true, 'тестовая афиша помечена');
  assert.match(catalog.source.updatedAt, /^\d{4}-\d{2}-\d{2}$/);

  const [exhibition, walk, concert] = ['evt-101', 'evt-102', 'evt-103'].map((id) =>
    catalog.events.find((e) => e.id === id)
  );
  assert.deepEqual([exhibition.photo, walk.photo, concert.photo], ['/e.png', '/w.png', '/c.png']);
});

test('источник без названия или с кривой датой не ломает каталог', () => {
  const raw = serverCatalog();
  assert.equal(normalizeCatalog({ ...raw, source: undefined }, PHOTOS).source, null);
  const oddDate = normalizeCatalog({ ...raw, source: { name: 'Афиша', updatedAt: 'вчера' } }, PHOTOS).source;
  assert.deepEqual(oddDate, { name: 'Афиша', isTest: false, updatedAt: null });
});

test('неизвестный ключ фото получает запасную обложку, а событие без времени и координат отбрасывается вместе с планами', () => {
  const raw = serverCatalog();
  const catalog = normalizeCatalog(raw, { exhibition: '/e.png', walk: '/w.png', city: '/city.svg' });
  assert.equal(catalog.events.find((e) => e.id === 'evt-103').photo, '/city.svg');
  assert.equal(catalog.plans.length, 3);

  const broken = { ...raw, events: raw.events.map((e) => (e.id === 'evt-103' ? { ...e, lat: undefined } : e)) };
  const cleaned = normalizeCatalog(broken, PHOTOS);
  assert.ok(!cleaned.events.some((e) => e.id === 'evt-103'));
  assert.deepEqual(
    cleaned.plans.map((plan) => plan.id),
    ['calm'],
    'остался только план без концерта'
  );
});

test('часы сервера: «сейчас» считается от времени города, а не телефона', () => {
  const raw = { ...serverCatalog(), clock: { now: 1000, utcOffsetMin: 180 } };
  assert.deepEqual(normalizeCatalog(raw, PHOTOS, { loadedAt: 5000 }).clock, {
    serverNow: 1000,
    loadedAt: 5000,
    utcOffsetMin: 180,
  });
  const noClock = normalizeCatalog({ ...raw, clock: undefined }, PHOTOS, { loadedAt: 7 }).clock;
  assert.deepEqual(noClock, { serverNow: 7, loadedAt: 7, utcOffsetMin: 180 });
});

test('пустой или неожиданный каталог — ошибка, а не пустой экран', () => {
  assert.throws(() => normalizeCatalog(null, PHOTOS), /формат/);
  assert.throws(() => normalizeCatalog({ events: [], plans: [] }, PHOTOS), /нет событий/);
  assert.throws(() => normalizeCatalog({ events: 'нет', plans: [] }, PHOTOS), /формат/);
});

test('загрузка: успешный ответ становится текущим каталогом', async () => {
  const loaded = await loadCatalog({ photos: PHOTOS, fetchFn: async () => fakeResponse(serverCatalog()) });
  assert.equal(getCatalog(), loaded);
});

test('загрузка: ошибка сервера и сетевой сбой пробрасываются, чтобы показать экран «повторить»', async () => {
  await assert.rejects(loadCatalog({ photos: PHOTOS, fetchFn: async () => fakeResponse({}, 503) }), /503/);
  await assert.rejects(
    loadCatalog({
      photos: PHOTOS,
      fetchFn: async () => {
        throw new Error('нет сети');
      },
    }),
    /нет сети/
  );
});

test('загрузка: неудача не затирает уже загруженный каталог', async () => {
  const good = normalizeCatalog(serverCatalog(), PHOTOS);
  setCatalog(good);
  await assert.rejects(loadCatalog({ photos: PHOTOS, fetchFn: async () => fakeResponse({}, 500) }));
  assert.equal(getCatalog(), good);
});

test('приложение открыто через полночь: расписание сдвигается на новый день', async () => {
  const { getCatalog: current } = await import('../src/data/catalog.js');
  const offset = 180;
  const loadedAt = Date.now() - 30 * 60_000;
  const serverNow = Date.parse('2026-09-29T23:45:00Z') - offset * 60_000;
  const event = {
    id: 'sg-60001',
    kind: 'Фигурное катание',
    title: 'Начинающие',
    category: 'sport',
    lat: 55.8,
    lon: 49.1,
    start: '18:30',
    durationMin: 60,
    days: [],
    dayOffset: 1,
    openMask: '0101001',
    price: 600,
    moods: [],
    photo: 'sport',
  };
  const raw = { city: 'Казань', clock: { now: serverNow, utcOffsetMin: offset }, events: [event], plans: [] };
  setCatalog(normalizeCatalog(raw, { sport: 'sport.svg' }, { loadedAt }));
  const [shifted] = current().events;
  assert.equal(current().day, '2026-09-30');
  assert.equal(shifted.openMask, '1010010', 'вчерашний «завтра» стал «сегодня»');
  assert.equal(shifted.dayOffset, 0);
});
