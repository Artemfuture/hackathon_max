import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { curatedPlan, decodePlan, isPlanCode, toClock } from '../../shared/planner.js';
import { openMaskFor } from './hours.js';
import { DAY, ISO_DATE, dayLabelOf, dayOffsetFor, localIsoDate, localMidnight, utcOffsetMin } from './time.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '..', '..', 'data', 'events.json');
const CAFES_PATH = path.join(__dirname, '..', '..', 'data', 'cafes.json');
const SPORTS_PATH = path.join(__dirname, '..', '..', 'data', 'sports.json');

const raw = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));

function kindOf(event) {
  return event.evening?.kind ?? event.kind;
}
function durationOf(event) {
  return event.evening?.durationMin ?? event.durationMin;
}
function photoOf(event) {
  return event.evening?.photo ?? event.photo;
}

function validate(data) {
  const fail = (message) => {
    throw new Error(`data/events.json: ${message}`);
  };
  const categoryIds = new Set(data.categories.map((c) => c.id));
  const moodIds = new Set((data.moods ?? []).map((m) => m.id));
  const eventsById = new Map();
  const numbers = new Set();
  const clock = /^\d{2}:\d{2}$/;

  for (const event of data.events) {
    if (eventsById.has(event.id)) fail(`повторяется id ${event.id}`);
    eventsById.set(event.id, event);
    const number = event.id.replace(/^\D+/, '');
    if (!/^\d+$/.test(number) || numbers.has(number)) fail(`${event.id}: id должен кончаться уникальным номером`);
    numbers.add(number);
    if (!categoryIds.has(event.category)) fail(`${event.id}: неизвестная категория ${event.category}`);
    if (event.format === 'place') {
      if (!clock.test(event.hours?.open ?? '') || !/^\d{2}:\d{2}$/.test(event.hours?.close ?? '')) {
        fail(`${event.id}: у места нужны часы работы hours.open и hours.close`);
      }
      if (!event.daily) fail(`${event.id}: место с часами работы должно быть daily`);
    } else if (!clock.test(event.time)) {
      fail(`${event.id}: время должно быть в формате ЧЧ:ММ`);
    }
    if (typeof event.lat !== 'number' || typeof event.lon !== 'number') fail(`${event.id}: нет координат`);
    if (event.evening && !event.daily) fail(`${event.id}: событие из планов вечера должно быть daily`);
    if (!(durationOf(event) > 0)) fail(`${event.id}: нужна длительность durationMin`);
    if (!kindOf(event) || !photoOf(event)) fail(`${event.id}: нужны kind и photo`);
    for (const mood of event.moods ?? []) if (!moodIds.has(mood)) fail(`${event.id}: неизвестное настроение ${mood}`);
  }
  for (const plan of data.plans) {
    for (const stop of plan.stops) {
      if (!eventsById.get(stop.eventId)?.evening) fail(`план ${plan.id}: нет события ${stop.eventId} с блоком evening`);
    }
  }
  if (!data.source?.name || !/^\d{4}-\d{2}-\d{2}$/.test(data.source.updatedAt ?? '')) {
    fail('в блоке source нужны name и updatedAt в формате ГГГГ-ММ-ДД');
  }
  for (const place of data.landmarks ?? []) {
    if (!place.id || !place.label || typeof place.lat !== 'number' || typeof place.lon !== 'number') {
      fail(`место ${place.id ?? '?'}: нужны id, label и координаты`);
    }
  }
}
validate(raw);

const CLOCK = /^\d{2}:\d{2}$/;
const numberOf = (id) => String(id).replace(/^\D+/, '');
const STATIC_NUMBERS = new Set(raw.events.map((event) => numberOf(event.id)));
const CATEGORY_IDS = new Set(raw.categories.map((category) => category.id));

function usableExternal(item, numbers) {
  const number = numberOf(item?.id ?? '');
  if (!/^\d{1,9}$/.test(number) || numbers.has(number)) return false;
  if (!CATEGORY_IDS.has(item.category) || typeof item.lat !== 'number' || typeof item.lon !== 'number') return false;
  if (!item.title || !item.kind || !(item.durationMin > 0) || typeof item.price !== 'number') return false;
  if (!item.schedule || typeof item.schedule !== 'object') return false;
  if (item.format === 'place') return CLOCK.test(item.hours?.open ?? '') && CLOCK.test(item.hours?.close ?? '');
  return CLOCK.test(item.time ?? '');
}

function keepUsable(items, taken) {
  const numbers = new Set(taken);
  return items.filter((item) => {
    if (!usableExternal(item, numbers)) return false;
    numbers.add(numberOf(item.id));
    return true;
  });
}

const cafesData = existsSync(CAFES_PATH) ? JSON.parse(readFileSync(CAFES_PATH, 'utf-8')) : null;
const CAFES = keepUsable(cafesData?.places ?? [], STATIC_NUMBERS);

const sportsData = existsSync(SPORTS_PATH) ? JSON.parse(readFileSync(SPORTS_PATH, 'utf-8')) : null;
const SPORTS = keepUsable(
  [...(sportsData?.venues ?? []), ...(sportsData?.groups ?? [])],
  new Set([...STATIC_NUMBERS, ...CAFES.map((cafe) => numberOf(cafe.id))])
);
const LOCAL_NUMBERS = new Set([...STATIC_NUMBERS, ...CAFES.map((item) => numberOf(item.id)), ...SPORTS.map((item) => numberOf(item.id))]);

let external = [];
let externalUpdatedAt = null;

export function setExternalEvents(items, { updatedAt = null } = {}) {
  external = keepUsable(Array.isArray(items) ? items : [], LOCAL_NUMBERS);
  externalUpdatedAt = updatedAt;
  return external.length;
}

const demoEnabled = () => !/^(0|off|false|no)$/i.test(process.env.DEMO_EVENTS ?? '');

function sourceEvents() {
  const own = demoEnabled() ? raw.events : raw.events.filter((event) => event.format === 'place');
  const sports = demoEnabled() ? SPORTS : SPORTS.filter((item) => !item.group);
  return [...own, ...CAFES, ...sports, ...external];
}

const maskCache = new Map();
function maskOf(event, now) {
  if (!event.schedule) return null;
  const key = `${localIsoDate(now)}|${JSON.stringify(event.schedule)}`;
  let mask = maskCache.get(key);
  if (mask === undefined) {
    if (maskCache.size > 2000) maskCache.clear();
    mask = openMaskFor(event.schedule, now);
    maskCache.set(key, mask);
  }
  return mask;
}

export const CITY = raw.city;
export const CATEGORIES = raw.categories;
export const MOODS = raw.moods ?? [];

export const SOURCE = {
  name: raw.source.name,
  isTest: raw.source.isTest === true,
  updatedAt: raw.source.updatedAt,
};

export const sourceDateLabel = () => SOURCE.updatedAt.split('-').reverse().join('.');

export const LANDMARKS = raw.landmarks ?? [];

export const DATE_IDS = ['today', 'tomorrow', 'weekend'];
export const DATE_LABELS = { today: 'сегодня', tomorrow: 'завтра', weekend: 'в выходные' };

export const MAX_DAYS_AHEAD = 60;

export function isDateId(value, now = Date.now()) {
  if (DATE_IDS.includes(value)) return true;
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const offset = dayOffsetFor(value, now);
  return offset >= 0 && offset <= MAX_DAYS_AHEAD;
}

const asMs = (now) => (now instanceof Date ? now.getTime() : now);

function daysOf(event, now) {
  if (event.daily) return [...DATE_IDS];
  return DATE_IDS.filter((dateId) => dayOffsetFor(dateId, now) === event.dayOffset);
}

function toCatalogEvent(event, now) {
  const { evening } = event;
  const mask = maskOf(event, now);
  return {
    id: event.id,
    kind: kindOf(event),
    title: event.title,
    category: event.category,
    place: event.place,
    address: event.address ?? null,
    lat: event.lat,
    lon: event.lon,
    photo: photoOf(event),
    ...(evening?.focus && { focus: evening.focus }),
    ...(evening?.crop && { crop: evening.crop }),
    start: event.format === 'place' ? null : event.time,
    durationMin: durationOf(event),
    ...(event.hours && { hours: event.hours }),
    days: mask ? DATE_IDS.filter((dateId) => mask[dayOffsetFor(dateId, now)] === '1') : daysOf(event, now),
    daily: event.daily === true,
    dayOffset: mask ? mask.indexOf('1') : (event.dayOffset ?? 0),
    ...(mask && { openMask: mask }),
    price: event.price,
    ...(event.priceFrom && { priceFrom: true }),
    ...(event.priceEstimate && { priceEstimate: true }),
    ...(event.priceText && { priceText: event.priceText }),
    ...(event.image && { image: event.image }),
    ...(event.age && { age: event.age }),
    ...(event.icon && { icon: event.icon }),
    ...(event.phone && { phone: event.phone }),
    ...(event.group && { group: event.group }),
    ...(event.manualOnly && { manualOnly: true }),
    source: event.source ?? (event.format === 'place' ? 'city' : 'demo'),
    ...((evening?.studentPrice ?? event.studentPrice) != null && { studentPrice: evening?.studentPrice ?? event.studentPrice }),
    pushkin: event.pushkin,
    free: event.free,
    moods: event.moods ?? [],
    outdoor: event.outdoor === true,
    description: event.description,
    link: event.link,
  };
}

export function getPlannerEvents(now = Date.now()) {
  const ms = asMs(now);
  return sourceEvents()
    .map((e) => toCatalogEvent(e, ms))
    .filter((e) => !e.openMask || e.dayOffset >= 0);
}

export function catalogSources() {
  return [
    demoEnabled() && { id: 'demo', name: SOURCE.name, isTest: true, updatedAt: SOURCE.updatedAt },
    external.length > 0 && { id: 'kudago', name: 'KudaGo', url: 'https://kudago.com', updatedAt: externalUpdatedAt },
    (CAFES.length > 0 || SPORTS.length > 0) && {
      id: 'osm',
      name: 'OpenStreetMap',
      url: 'https://www.openstreetmap.org/copyright',
      updatedAt: cafesData?.source?.updatedAt ?? null,
    },
  ].filter(Boolean);
}

export function getCatalog(now = Date.now()) {
  const ms = asMs(now);
  return {
    city: raw.city,
    source: SOURCE,
    clock: { now: ms, utcOffsetMin: utcOffsetMin(), today: dayLabelOf(ms), weekend: dayLabelOf(localMidnight(ms) + dayOffsetFor('weekend', ms) * DAY) },
    sources: catalogSources(),
    categories: CATEGORIES,
    moods: MOODS,
    landmarks: LANDMARKS,
    events: getPlannerEvents(ms),
    plans: raw.plans,
  };
}

export function resolvePlan(planId, dateId = null, now = Date.now()) {
  const events = getPlannerEvents(now);
  if (isPlanCode(planId)) {
    const day = dateId == null ? null : isDateId(dateId, now) ? dayOffsetFor(dateId, now) : -1;
    return decodePlan(planId, events, { day });
  }
  const definition = raw.plans.find((p) => p.id === planId);
  return definition ? curatedPlan(definition, events) : null;
}

export function getPlanSummary(planId, dateId = null, now = Date.now()) {
  const plan = typeof planId === 'string' ? resolvePlan(planId, dateId, now) : null;
  if (!plan) return null;
  return {
    id: plan.id,
    kinds: plan.stops.map((stop) => stop.item.kind),
    startMinutes: plan.start,
    startTime: toClock(plan.start),
    endTime: toClock(plan.end),
  };
}

export function planStartAt(planId, dateId, now = Date.now()) {
  const summary = getPlanSummary(planId, null, now);
  if (!summary) return null;
  return localMidnight(now) + dayOffsetFor(dateId, now) * DAY + summary.startMinutes * 60_000;
}
