let current = null;

const isClock = (value) => typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);

function usable(event) {
  return (
    event &&
    typeof event.id === 'string' &&
    typeof event.lat === 'number' &&
    typeof event.lon === 'number' &&
    event.durationMin > 0 &&
    (isClock(event.start) || (isClock(event.hours?.open) && isClock(event.hours?.close))) &&
    Array.isArray(event.days)
  );
}

export function normalizeCatalog(raw, photos, { fallback = 'city', loadedAt = Date.now() } = {}) {
  if (!raw || !Array.isArray(raw.events) || !Array.isArray(raw.plans)) {
    throw new Error('Каталог имеет неожиданный формат');
  }

  const events = raw.events.filter(usable).map((event) => {
    const cover = photos[event.photo] ?? photos[fallback] ?? null;
    const image = typeof event.image === 'string' && /^https:\/\//.test(event.image) ? event.image : null;
    return { ...event, moods: Array.isArray(event.moods) ? event.moods : [], photo: image ?? cover, cover };
  });
  const known = new Set(events.map((event) => event.id));
  const plans = raw.plans.filter(
    (plan) => Array.isArray(plan.stops) && plan.stops.length > 0 && plan.stops.every((stop) => known.has(stop.eventId))
  );

  if (events.length === 0) throw new Error('В каталоге нет событий');
  return {
    city: String(raw.city ?? ''),
    source: normalizeSource(raw.source),
    sources: Array.isArray(raw.sources) ? raw.sources.filter((item) => item && item.id && item.name) : [],
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    clock: normalizeClock(raw.clock, loadedAt),
    day: cityDay(normalizeClock(raw.clock, loadedAt), loadedAt),
    moods: Array.isArray(raw.moods) ? raw.moods : [],
    landmarks: Array.isArray(raw.landmarks) ? raw.landmarks.filter((place) => typeof place.lat === 'number') : [],
    weather: raw.weather?.days ? raw.weather : null,
    events,
    plans,
  };
}

function normalizeSource(source) {
  if (!source || typeof source !== 'object' || !source.name) return null;
  const updatedAt = /^\d{4}-\d{2}-\d{2}$/.test(source.updatedAt ?? '') ? source.updatedAt : null;
  return { name: String(source.name), isTest: source.isTest === true, updatedAt };
}

function normalizeClock(clock, loadedAt) {
  const offset = Number.isFinite(clock?.utcOffsetMin) ? clock.utcOffsetMin : 180;
  const serverNow = Number.isFinite(clock?.now) ? clock.now : loadedAt;
  return { serverNow, loadedAt, utcOffsetMin: offset };
}

const DAY_MS = 24 * 60 * 60_000;

function cityDay(clock, at = Date.now()) {
  return new Date(clock.serverNow + (at - clock.loadedAt) + clock.utcOffsetMin * 60_000).toISOString().slice(0, 10);
}

function shiftedTo(catalog, day) {
  const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${catalog.day}T00:00:00Z`)) / DAY_MS);
  if (diff <= 0) return { ...catalog, day };
  const events = catalog.events.map((event) => {
    if (typeof event.openMask === 'string') {
      const openMask = event.openMask.slice(diff) + '0'.repeat(Math.min(diff, event.openMask.length));
      return { ...event, openMask, dayOffset: openMask.indexOf('1') };
    }
    return event.daily ? event : { ...event, dayOffset: (event.dayOffset ?? 0) - diff };
  });
  return { ...catalog, day, events };
}

export function setCatalog(catalog) {
  current = catalog;
}

export function getCatalog() {
  if (!current) throw new Error('Каталог ещё не загружен');
  if (current.clock && current.day) {
    const today = cityDay(current.clock);
    if (today !== current.day) current = shiftedTo(current, today);
  }
  return current;
}

export const getCity = () => getCatalog().city;

export const getSource = () => getCatalog().source;

export const getSources = () => getCatalog().sources ?? [];

export const getEvent = (id) => getCatalog().events.find((event) => event.id === id) ?? null;
