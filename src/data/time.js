const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

export function utcOffsetMin() {
  const raw = process.env.EVENT_UTC_OFFSET_MIN;
  const value = raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : 180;
}

export function localMidnight(now = Date.now()) {
  const offset = utcOffsetMin() * MINUTE;
  return Math.floor((now + offset) / DAY) * DAY - offset;
}

export function clockOf(ms) {
  const shifted = new Date(ms + utcOffsetMin() * MINUTE);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

export function dayLabelOf(ms) {
  const shifted = new Date(ms + utcOffsetMin() * MINUTE);
  return shifted.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    weekday: 'short',
    timeZone: 'UTC',
  });
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const localIsoDate = (ms) => new Date(ms + utcOffsetMin() * MINUTE).toISOString().slice(0, 10);

export function dayOffsetFor(dateId, now = Date.now()) {
  if (dateId === 'today') return 0;
  if (dateId === 'tomorrow') return 1;
  if (ISO_DATE.test(dateId ?? '')) {
    return Math.round((Date.parse(`${dateId}T00:00:00Z`) - Date.parse(`${localIsoDate(now)}T00:00:00Z`)) / DAY);
  }
  const weekday = new Date(now + utcOffsetMin() * MINUTE).getUTCDay();
  return weekday === 0 || weekday === 6 ? 0 : 6 - weekday;
}
