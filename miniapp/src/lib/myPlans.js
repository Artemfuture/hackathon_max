import { isoDate } from './clock.js';

const KEY = 'dosug.myPlans';
const LIMIT = 40;
const STATUSES = new Set(['active', 'done', 'cancelled']);

const sameEntry = (a, b) => a.id === b.id && a.date === b.date;

function write(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
  } catch {}
  return list.slice(0, LIMIT);
}

export function readMyPlans() {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list)
      ? list
          .filter((entry) => typeof entry?.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? ''))
          .map((entry) => ({ ...entry, status: STATUSES.has(entry.status) ? entry.status : 'active' }))
      : [];
  } catch {
    return [];
  }
}

export function saveMyPlan({ id, dateId, replace = null }) {
  const entry = { id, date: isoDate(dateId), status: 'active', savedAt: Date.now() };
  const rest = readMyPlans().filter((other) => !sameEntry(other, entry) && !(replace && sameEntry(other, replace)));
  return write([entry, ...rest]);
}

export function setMyPlanStatus(target, status) {
  if (!STATUSES.has(status)) return readMyPlans();
  return write(readMyPlans().map((entry) => (sameEntry(entry, target) ? { ...entry, status } : entry)));
}

export function removeMyPlan(id, date) {
  return write(readMyPlans().filter((entry) => !sameEntry(entry, { id, date })));
}

export const isArchived = (entry, todayIso) => entry.status !== 'active' || entry.date < todayIso;
