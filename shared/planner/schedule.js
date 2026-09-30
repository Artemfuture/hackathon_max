import { END_OF_DAY, toMin } from './time.js';

export const DAY_IDS = ['today', 'tomorrow', 'weekend'];
export const MIN_VISIT_MIN = 10;
export const VISIT_STEP_MIN = 10;

export function priceForUser(item, benefits = []) {
  if (benefits.includes('pushkin') && item.pushkin) return 0;
  if (benefits.includes('student') && item.studentPrice != null) return Math.min(item.price, item.studentPrice);
  return item.price;
}

export function onDay(item, day) {
  if (day == null) return true;
  if (typeof day === 'number') {
    if (typeof item.openMask === 'string') return item.openMask[day] === '1';
    return item.daily === true || item.dayOffset === day;
  }
  return Boolean(item.days?.includes(day));
}

export const isFlexible = (item) => Boolean(item.hours);

export function hoursOf(item, visit = null) {
  const close = item.hours.close === '24:00' ? END_OF_DAY : toMin(item.hours.close);
  return {
    open: toMin(item.hours.open),
    close: close <= toMin(item.hours.open) ? END_OF_DAY : close,
    ideal: visit ?? item.durationMin,
    min: visit ?? Math.min(item.durationMin, item.hours.minVisitMin ?? 20),
  };
}

export function sessionOf(item) {
  const start = toMin(item.start);
  return { start, end: start + item.durationMin };
}

export function fitsWindow(item, from, until) {
  if (isFlexible(item)) {
    const h = hoursOf(item);
    return Math.min(h.close, until) - Math.max(h.open, from) >= h.min;
  }
  const s = sessionOf(item);
  return s.start >= from && s.end <= until;
}
