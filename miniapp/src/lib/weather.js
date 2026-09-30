import { getCatalog } from '../data/catalog.js';
import { isoDate } from './clock.js';

const WET = (code) => (code >= 51 && code <= 67) || (code >= 71 && code <= 86) || code >= 95;

function describe(code) {
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

export function weatherFor(dateId, from, until) {
  const weather = getCatalog().weather;
  const hours = weather?.days?.[dateId] ?? weather?.dates?.[isoDate(dateId)];
  if (!Array.isArray(hours)) return null;
  const slice = hours.filter(([hour]) => hour * 60 + 59 >= from && hour * 60 < until);
  if (slice.length === 0) return null;
  const temps = slice.map((h) => h[1]);
  const precip = Math.max(...slice.map((h) => h[2] ?? 0));
  const worst = slice.find((h) => WET(h[3])) ?? slice.reduce((a, b) => (b[3] > a[3] ? b : a));
  return {
    tempMin: Math.round(Math.min(...temps)),
    tempMax: Math.round(Math.max(...temps)),
    precip,
    ...describe(worst[3]),
    rainy: precip >= 55 || WET(worst[3]),
  };
}

export function formatTemp({ tempMin, tempMax }) {
  const sign = (t) => (t > 0 ? `+${t}` : `${t}`);
  return tempMin === tempMax ? `${sign(tempMax)}°` : `${sign(tempMin)}…${sign(tempMax)}°`;
}
