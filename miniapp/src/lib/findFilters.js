import { NIGHT_END } from './planner.js';

export const TIMES = [
  { id: 'all', label: 'Весь день' },
  { id: 'now', label: 'Ближайшие 2 часа', todayOnly: true },
  { id: 'day', label: 'Днём', from: 12 * 60, until: 17 * 60 },
  { id: 'evening', label: 'Вечером', from: 17 * 60, until: NIGHT_END },
];

export const PRICES = [
  { id: 'any', label: 'Любая', max: Infinity },
  { id: 'free', label: 'Бесплатно', max: 0 },
  { id: '500', label: 'До 500 ₽', max: 500 },
  { id: '1500', label: 'До 1 500 ₽', max: 1500 },
];

export const DEFAULT_FILTERS = { time: 'all', price: 'any', pushkin: false, openNow: false, mood: null };

export function windowFor(time, now) {
  const start = now ?? 0;
  if (time === 'now' && now != null) return { from: now, until: Math.min(now + 120, 24 * 60) };
  const option = TIMES.find((item) => item.id === time);
  if (option?.from != null) return { from: Math.max(option.from, start), until: option.until };
  return { from: start, until: NIGHT_END };
}

export const maxPriceOf = (filters) => PRICES.find((item) => item.id === filters.price)?.max ?? Infinity;

export const activeFilterCount = (filters) =>
  Number(filters.time !== 'all') +
  Number(filters.price !== 'any') +
  Number(filters.pushkin) +
  Number(filters.openNow) +
  Number(Boolean(filters.mood));
