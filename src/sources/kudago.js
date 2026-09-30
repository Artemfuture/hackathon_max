import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseRuTimetable, pickHours } from '../data/hours.js';
import { localIsoDate } from '../data/time.js';

const API = 'https://kudago.com/public-api/v1.4';
const HEADERS = { 'User-Agent': 'dosug-kazan/1.0 (MAX mini-app)' };
const DAYS_AHEAD = 45;
const MAX_PAGES = 6;
const FAR_FUTURE_SEC = 253370754000;
const CITY_CENTER = { lat: 55.7887, lon: 49.1221 };
const MAX_DISTANCE_KM = 25;
const DEFAULT_MUSEUM = { open: '11:00', close: '18:00', days: [false, true, true, true, true, true, true] };

const CATEGORY_MAP = [
  ['theater', 'theatre', 'Спектакль', ['wow', 'rest'], 150],
  ['concert', 'concert', 'Концерт', ['wow'], 120],
  ['stand-up', 'show', 'Стендап', ['wow', 'meet'], 100],
  ['party', 'show', 'Вечеринка', ['wow', 'meet'], 180],
  ['festival', 'show', 'Фестиваль', ['wow', 'meet'], 180],
  ['cinema', 'cinema', 'Кино', ['rest', 'wow'], 120],
  ['exhibition', 'museum', 'Выставка', ['learn', 'rest'], 60],
  ['tour', 'walk', 'Экскурсия', ['learn', 'move'], 90],
  ['quest', 'show', 'Квест', ['meet', 'move'], 90],
  ['education', 'talk', 'Лекция', ['learn', 'meet'], 90],
  ['entertainment', 'show', 'Развлечения', ['wow', 'meet'], 120],
  ['recreation', 'walk', 'Отдых', ['rest', 'move'], 90],
];
const SKIP = new Set(['stock', 'shopping', 'business-events', 'social-activity']);

const KIND_WORDS = {
  выставка: 'Выставка',
  экспозиция: 'Выставка',
  постоянная: 'Выставка',
  экскурсия: 'Экскурсия',
  спектакль: 'Спектакль',
  концерт: 'Концерт',
  'мастер-класс': 'Мастер-класс',
  лекция: 'Лекция',
  фестиваль: 'Фестиваль',
  квест: 'Квест',
  квиз: 'Квиз',
  игра: 'Игра',
  интеллектуальная: 'Игра',
  шоу: 'Шоу',
  стендап: 'Стендап',
  кинопоказ: 'Кино',
  встреча: 'Встреча',
};

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const clock = (value) => {
  if (typeof value !== 'string' || !/^\d{1,2}:\d{2}/.test(value)) return null;
  const text = value.slice(0, 5).padStart(5, '0');
  return text === '00:00' ? null : text;
};
const toMin = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

function distanceKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function splitTitle(title, fallbackKind) {
  const text = String(title ?? '').trim();
  const firstWord = text.split(/\s+/)[0]?.toLowerCase() ?? '';
  const kind = KIND_WORDS[firstWord] ?? fallbackKind;
  const quoted = /«([^»]+)»/.exec(text);
  if (quoted && KIND_WORDS[firstWord]) return { kind, title: capitalize(quoted[1].trim()) };
  return { kind, title: capitalize(text) };
}

export function parsePrice(text, isFree) {
  if (isFree) return { price: 0, priceFrom: false };
  const numbers = [...String(text ?? '').replace(/(\d)\s+(?=\d{3}\b)/g, '$1').matchAll(/\d+/g)].map(Number);
  const paid = numbers.filter((value) => value > 0);
  if (paid.length === 0) return numbers.length > 0 ? { price: 0, priceFrom: false } : null;
  return { price: Math.min(...paid), priceFrom: /^\s*от\s/i.test(text ?? '') || numbers.length > 1 };
}

function categoryOf(raw) {
  const cats = raw.categories ?? [];
  if (cats.some((c) => SKIP.has(c))) return null;
  const entry = CATEGORY_MAP.find(([id]) => cats.includes(id));
  if (!entry) return null;
  const [, category, kind, moods, duration] = entry;
  if (category === 'talk' && /мастер-класс/i.test(raw.title)) {
    return { category: 'masterclass', kind: 'Мастер-класс', moods: ['learn', 'meet'], duration: 90 };
  }
  return { category, kind, moods, duration };
}

const isoOf = (seconds) => (seconds > 0 && seconds < FAR_FUTURE_SEC ? localIsoDate(seconds * 1000) : null);

export function occurrencesOf(raw, { nowSec, timetables = new Map(), category }) {
  const out = [];
  for (const date of raw.dates ?? []) {
    if (!(date.end >= nowSec || date.is_endless)) continue;
    const from = isoOf(date.start);
    const until = date.is_endless ? null : isoOf(date.end);
    const start = clock(date.start_time);
    const end = clock(date.end_time);
    const range = { ...(from && { from }), ...(until && { until }) };

    if (Array.isArray(date.schedules) && date.schedules.length > 0) {
      for (const rule of date.schedules) {
        const time = clock(rule.start_time);
        if (!time) continue;
        const days = [0, 1, 2, 3, 4, 5, 6].map((day) => rule.days_of_week?.includes(day) === true);
        const stop = clock(rule.end_time);
        if (stop && toMin(stop) - toMin(time) >= 180) {
          out.push({ type: 'place', hours: { open: time, close: stop }, schedule: { days, ...range } });
        } else {
          const durationMin = stop && toMin(stop) > toMin(time) ? toMin(stop) - toMin(time) : undefined;
          out.push({ type: 'session', time, durationMin, schedule: { days, ...range } });
        }
      }
      continue;
    }

    const singleDay = from && (until === from || (!until && !date.is_endless) || date.end - date.start <= 16 * 3600);
    if (start && singleDay) {
      const length = end && toMin(end) > toMin(start) ? toMin(end) - toMin(start) : null;
      if (length && length >= 240) {
        out.push({ type: 'place', hours: { open: start, close: end }, schedule: { dates: [from] } });
      } else {
        out.push({ type: 'session', time: start, durationMin: length ?? undefined, schedule: { dates: [from] } });
      }
      continue;
    }

    if (start && end && toMin(end) - toMin(start) >= 180) {
      out.push({ type: 'place', hours: { open: start, close: end }, schedule: { ...range } });
      continue;
    }
    if (start && category === 'walk') {
      out.push({ type: 'session', time: start, schedule: { ...range } });
      continue;
    }
    if (!start && category === 'museum') {
      const found = pickHours(parseRuTimetable(timetables.get(raw.place?.id)));
      const picked = found && !(found.hours.open === '00:00' && found.hours.close === '24:00') ? found : null;
      const hours = picked ? picked.hours : { open: DEFAULT_MUSEUM.open, close: DEFAULT_MUSEUM.close };
      const days = picked ? picked.days : DEFAULT_MUSEUM.days;
      out.push({ type: 'place', hours, schedule: { days, ...range }, placeHours: Boolean(picked) });
    }
  }
  return out;
}

export function normalizeEvent(raw, { nowSec, timetables } = {}) {
  const place = raw.place;
  const coords = place?.coords;
  if (!coords || typeof coords.lat !== 'number' || place.is_closed) return [];
  if (distanceKm(CITY_CENTER, coords) > MAX_DISTANCE_KM) return [];
  const category = categoryOf(raw);
  if (!category) return [];
  const price = parsePrice(raw.price, raw.is_free);
  if (!price) return [];
  const names = splitTitle(raw.title, category.kind);
  const occurrences = occurrencesOf(raw, { nowSec, timetables, category: category.category });
  const image = raw.images?.[0]?.image?.replace(/\/images\/(.+)$/, '/thumbs/640x384/images/$1') ?? null;

  const seen = new Set();
  const items = [];
  for (const occurrence of occurrences) {
    const key = occurrence.type === 'session' ? `s${occurrence.time}` : `p${occurrence.hours.open}${occurrence.hours.close}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const index = items.length;
    if (index >= 10) break;
    const base = {
      id: `kg-7${String(raw.id * 10 + index).padStart(7, '0')}`,
      kudagoId: raw.id,
      category: category.category,
      kind: names.kind,
      title: names.title,
      place: capitalize(place.title ?? ''),
      address: place.address || null,
      lat: coords.lat,
      lon: coords.lon,
      price: price.price,
      ...(price.priceFrom && { priceFrom: true }),
      priceText: raw.is_free ? 'бесплатно' : raw.price || null,
      free: price.price === 0,
      pushkin: (raw.tags ?? []).some((tag) => /пушкинск/i.test(tag)),
      moods: category.moods,
      photo: category.category,
      image,
      outdoor: category.category === 'walk',
      description: String(raw.description ?? '').trim().slice(0, 600),
      link: raw.site_url,
      age: raw.age_restriction ? String(raw.age_restriction) : null,
      source: 'kudago',
      schedule: occurrence.schedule,
    };
    if (occurrence.type === 'session') {
      items.push({ ...base, time: occurrence.time, durationMin: occurrence.durationMin ?? category.duration });
    } else {
      const length = toMin(occurrence.hours.close) - toMin(occurrence.hours.open);
      items.push({
        ...base,
        format: 'place',
        hours: { ...occurrence.hours, minVisitMin: Math.min(30, length) },
        durationMin: Math.min(category.duration, length),
      });
    }
  }
  return items;
}

async function getJson(fetchFn, url) {
  const res = await fetchFn(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`KudaGo ответил ${res.status}`);
  return res.json();
}

export function createKudago({
  location = 'kzn',
  file = null,
  fetchFn = globalThis.fetch,
  now = Date.now,
  log = console,
  onUpdate = () => {},
} = {}) {
  let cache = null;
  let inflight = null;

  if (file && existsSync(file)) {
    try {
      const saved = JSON.parse(readFileSync(file, 'utf8'));
      if (Array.isArray(saved.items)) cache = saved;
    } catch (err) {
      log.warn?.(`KudaGo: копия афиши не читается (${err.message}) — загружу заново`);
    }
  }

  async function fetchAll() {
    const nowSec = Math.floor(now() / 1000);
    const fields = 'id,title,dates,place,price,is_free,categories,images,site_url,description,age_restriction,tags';
    let url =
      `${API}/events/?location=${location}&actual_since=${nowSec}&actual_until=${nowSec + DAYS_AHEAD * 86400}` +
      `&page_size=100&fields=${fields}&expand=place,dates&text_format=text`;
    const events = [];
    for (let page = 0; url && page < MAX_PAGES; page += 1) {
      const data = await getJson(fetchFn, url);
      events.push(...(data.results ?? []));
      url = data.next;
    }

    const placeIds = [...new Set(events.map((event) => event.place?.id).filter(Boolean))];
    const timetables = new Map();
    for (let i = 0; i < placeIds.length; i += 100) {
      const ids = placeIds.slice(i, i + 100).join(',');
      try {
        const data = await getJson(fetchFn, `${API}/places/?ids=${ids}&page_size=100&fields=id,timetable`);
        for (const place of data.results ?? []) if (place.timetable) timetables.set(place.id, place.timetable);
      } catch (err) {
        log.warn?.(`KudaGo: часы площадок не загрузились (${err.message}) — возьму обычные часы музеев`);
      }
    }
    return events.flatMap((event) => normalizeEvent(event, { nowSec, timetables }));
  }

  function save() {
    if (!file) return;
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      const temp = `${file}.tmp`;
      writeFileSync(temp, JSON.stringify(cache));
      renameSync(temp, file);
    } catch (err) {
      log.warn?.(`KudaGo: не удалось сохранить копию афиши (${err.message})`);
    }
  }

  async function refresh() {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const items = await fetchAll();
        cache = { at: now(), items };
        save();
        onUpdate(items);
        log.log?.(`KudaGo: ${items.length} записей афиши`);
      } catch (err) {
        log.warn?.(`KudaGo недоступен: ${err.message}`);
      } finally {
        inflight = null;
      }
      return cache;
    })();
    return inflight;
  }

  return {
    refresh,
    snapshot: () => cache?.items ?? [],
    updatedAt: () => (cache ? localIsoDate(cache.at) : null),
  };
}
