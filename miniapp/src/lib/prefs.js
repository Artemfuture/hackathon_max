import { BENEFIT_OPTIONS, BUDGET_OPTIONS, DATE_OPTIONS, FROM_OPTIONS, HOURS_OPTIONS } from '../data/options.js';

export const DEFAULT_PREFS = { date: 'today', from: 'now', hours: '3', budget: '1500', extra: 0 };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_EXTRA_MIN = 180;

const OPTIONS = {
  date: DATE_OPTIONS,
  from: FROM_OPTIONS,
  hours: HOURS_OPTIONS,
  budget: BUDGET_OPTIONS,
};

export function sanitizePrefs(saved) {
  const prefs = Object.fromEntries(
    Object.entries(OPTIONS).map(([key, options]) => [
      key,
      options.some((option) => option.id === saved?.[key]) ? saved[key] : DEFAULT_PREFS[key],
    ])
  );
  if (ISO_DATE.test(saved?.date ?? '')) prefs.date = saved.date;
  const extra = Number(saved?.extra);
  prefs.extra = Number.isInteger(extra) && extra > 0 && extra <= MAX_EXTRA_MIN && extra % 30 === 0 ? extra : 0;
  return withValidFrom(prefs);
}

export function isPastFrom(id, date, nowMin) {
  const option = FROM_OPTIONS.find((item) => item.id === id);
  return date === 'today' && nowMin != null && option?.from != null && option.from <= nowMin;
}

export function withValidFrom(prefs, nowMin = null) {
  if (prefs.date !== 'today' && prefs.from === 'now') return { ...prefs, from: '19' };
  if (isPastFrom(prefs.from, prefs.date, nowMin)) return { ...prefs, from: 'now' };
  return prefs;
}

export function sanitizeBenefits(saved) {
  const known = new Set(BENEFIT_OPTIONS.map((option) => option.id));
  return Array.isArray(saved) ? saved.filter((id) => known.has(id)) : [];
}

export function sanitizeMoods(saved, known) {
  const ids = new Set([...known, 'any']);
  const moods = Array.isArray(saved) ? saved.filter((id) => ids.has(id)) : [];
  return moods.length ? moods : ['any'];
}

export const isDate = (id) => DATE_OPTIONS.some((option) => option.id === id) || ISO_DATE.test(id ?? '');
export const isBudget = (id) => BUDGET_OPTIONS.some((option) => option.id === id);
export const dateLabel = (id) =>
  DATE_OPTIONS.find((option) => option.id === id)?.chip ??
  (ISO_DATE.test(id ?? '')
    ? new Date(`${id}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    : undefined);

export function applyBotPrefs(stored, launch) {
  return launch?.kind === 'prefs' ? withValidFrom({ ...stored, date: launch.date, budget: launch.budget }) : stored;
}

export function applyBotBenefits(stored, launch) {
  if (launch?.kind !== 'prefs') return stored;
  if (launch.benefit === 'pushkin') return ['pushkin'];
  if (launch.benefit === 'none') return ['none'];
  return stored;
}
