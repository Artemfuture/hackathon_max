import { DATE_IDS } from './data/events.js';
import { DAY, dayOffsetFor, localMidnight, utcOffsetMin } from './data/time.js';

const FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=55.79&longitude=49.12' +
  '&hourly=temperature_2m,precipitation_probability,weather_code&timezone=auto&forecast_days=8';

const TTL_MS = 30 * 60_000;
const WAIT_MS = 1500;

export function describeCode(code) {
  if (code === 0) return { label: 'ясно', emoji: '☀️' };
  if (code <= 2) return { label: 'переменная облачность', emoji: '⛅' };
  if (code === 3) return { label: 'пасмурно', emoji: '☁️' };
  if (code === 45 || code === 48) return { label: 'туман', emoji: '🌫' };
  if (code >= 51 && code <= 57) return { label: 'морось', emoji: '🌦' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: 'дождь', emoji: '🌧' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'снег', emoji: '🌨' };
  if (code >= 95) return { label: 'гроза', emoji: '⛈' };
  return { label: 'облачно', emoji: '☁️' };
}

const WET_CODES = (code) => (code >= 51 && code <= 67) || (code >= 71 && code <= 86) || code >= 95;

export function summarize(hours, from, until) {
  const slice = hours.filter(([hour]) => hour * 60 + 59 >= from && hour * 60 < until);
  if (slice.length === 0) return null;
  const temps = slice.map((h) => h[1]);
  const precip = Math.max(...slice.map((h) => h[2] ?? 0));
  const worst = slice.find((h) => WET_CODES(h[3])) ?? slice.reduce((a, b) => (b[3] > a[3] ? b : a));
  const { label, emoji } = describeCode(worst[3]);
  return {
    tempMin: Math.round(Math.min(...temps)),
    tempMax: Math.round(Math.max(...temps)),
    precip,
    label,
    emoji,
    rainy: precip >= 55 || WET_CODES(worst[3]),
  };
}

function localDateString(ms) {
  return new Date(ms + utcOffsetMin() * 60_000).toISOString().slice(0, 10);
}

export function createWeather({ fetchFn = globalThis.fetch, now = Date.now, log = console } = {}) {
  let cache = null;
  let inflight = null;

  async function refresh() {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const res = await fetchFn(FORECAST_URL, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) throw new Error(`ответ ${res.status}`);
        const data = await res.json();
        const { time, temperature_2m: temp, precipitation_probability: prob, weather_code: code } = data.hourly;
        const byDate = {};
        time.forEach((stamp, i) => {
          const [date, clock] = stamp.split('T');
          (byDate[date] ??= []).push([Number(clock.slice(0, 2)), temp[i], prob?.[i] ?? 0, code[i]]);
        });
        cache = { at: now(), byDate };
      } catch (err) {
        log.warn?.(`Погода недоступна: ${err.message}`);
      } finally {
        inflight = null;
      }
      return cache;
    })();
    return inflight;
  }

  const fresh = () => cache && now() - cache.at < TTL_MS;

  function daysSnapshot() {
    if (!cache) return null;
    const current = now();
    const days = {};
    for (const dateId of DATE_IDS) {
      const date = localDateString(localMidnight(current) + dayOffsetFor(dateId, current) * DAY);
      if (cache.byDate[date]) days[dateId] = cache.byDate[date];
    }
    const dates = {};
    for (let offset = 0; offset < 8; offset += 1) {
      const date = localDateString(localMidnight(current) + offset * DAY);
      if (cache.byDate[date]) dates[date] = cache.byDate[date];
    }
    return Object.keys(days).length ? { source: 'Open-Meteo', days, dates } : null;
  }

  return {
    refresh,
    async snapshot() {
      if (!fresh()) await Promise.race([refresh(), new Promise((resolve) => setTimeout(resolve, WAIT_MS))]);
      return daysSnapshot();
    },
    peek(dateId, from, until) {
      const days = daysSnapshot()?.days;
      return days?.[dateId] ? summarize(days[dateId], from, until) : null;
    },
  };
}

export const weather = createWeather();
