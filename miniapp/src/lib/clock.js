import { getCatalog } from '../data/catalog.js';

const DAY_MIN = 24 * 60;
const MINUTE = 60_000;

function cityNow(at = Date.now()) {
  const { serverNow, loadedAt, utcOffsetMin } = getCatalog().clock;
  return new Date(serverNow + (at - loadedAt) + utcOffsetMin * MINUTE);
}

function demoMinutes() {
  if (typeof window === 'undefined') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(window.location.search).get('demo_time') ?? '');
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function nowMinutes(at = Date.now()) {
  const demo = demoMinutes();
  if (demo != null) return demo;
  const local = cityNow(at);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const todayIso = (at) => cityNow(at).toISOString().slice(0, 10);

export function dayOffset(dateId, at = Date.now()) {
  if (dateId === 'today') return 0;
  if (dateId === 'tomorrow') return 1;
  if (ISO_DATE.test(dateId ?? '')) {
    return Math.round(
      (Date.parse(`${dateId}T00:00:00Z`) - Date.parse(`${todayIso(at)}T00:00:00Z`)) / (DAY_MIN * MINUTE)
    );
  }
  const weekday = cityNow(at).getUTCDay();
  return weekday === 0 || weekday === 6 ? 0 : 6 - weekday;
}

export function dayTitle(dateId, at = Date.now()) {
  const date = new Date(cityNow(at).getTime() + dayOffset(dateId, at) * DAY_MIN * MINUTE);
  const text = date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function dayShort(dateId, at = Date.now()) {
  const date = new Date(cityNow(at).getTime() + dayOffset(dateId, at) * DAY_MIN * MINUTE);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
}

export const nextSlot = (at = Date.now()) => Math.ceil((nowMinutes(at) + 5) / 5) * 5;

export function isoDate(dateId, at = Date.now()) {
  if (ISO_DATE.test(dateId ?? '')) return dateId;
  const date = new Date(cityNow(at).getTime() + dayOffset(dateId, at) * DAY_MIN * MINUTE);
  return date.toISOString().slice(0, 10);
}

export function isoForOffset(offset, at = Date.now()) {
  return new Date(cityNow(at).getTime() + offset * DAY_MIN * MINUTE).toISOString().slice(0, 10);
}

export function dateIdFor(iso, at = Date.now()) {
  const offset = dayOffset(iso, at);
  if (offset < 0) return null;
  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  return iso;
}

export function dateText(dateId, { short = false, at = Date.now() } = {}) {
  const date = new Date(`${isoDate(dateId, at)}T12:00:00Z`);
  const options = short
    ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
    : { day: 'numeric', month: 'long', timeZone: 'UTC' };
  return date.toLocaleDateString('ru-RU', options).replace('.', '');
}

export const dayWord = (dateId) => (dateId === 'today' ? 'сегодня' : dateId === 'tomorrow' ? 'завтра' : dateText(dateId));

export const numericDate = (iso) => iso.split('-').reverse().join('.');
