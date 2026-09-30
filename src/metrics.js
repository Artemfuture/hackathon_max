import { localMidnight, utcOffsetMin } from './data/time.js';

export const FUNNEL = [
  ['start', 'Открыли бота (/start)'],
  ['app_open', 'Открыли мини-приложение'],
  ['geo', 'Прислали геолокацию в чат'],
  ['app_plan', 'Выбрали план в мини-приложении'],
  ['going', 'Друг ответил «Иду!»'],
];

const STEPS = new Set(FUNNEL.map(([step]) => step));
const KEEP_DAYS = 60;
const DAY_MS = 24 * 60 * 60_000;

const dayKey = (now) => new Date(localMidnight(now) + utcOffsetMin() * 60_000).toISOString().slice(0, 10);

function dayCounts(store, now) {
  const metrics = (store.state.metrics ??= {});
  const day = dayKey(now);
  if (!metrics[day]) {
    metrics[day] = {};
    const oldest = dayKey(now - (KEEP_DAYS - 1) * DAY_MS);
    for (const key of Object.keys(metrics)) if (key < oldest) delete metrics[key];
  }
  return metrics[day];
}

export function track(store, step, now = Date.now()) {
  if (!STEPS.has(step)) throw new Error(`Неизвестный шаг воронки: ${step}`);
  const counts = dayCounts(store, now);
  counts[step] = (counts[step] ?? 0) + 1;
  store.touch();
}

export function summarize(store, { days = 7, now = Date.now() } = {}) {
  const metrics = store.state.metrics ?? {};
  const oldest = dayKey(now - (days - 1) * DAY_MS);
  const totals = Object.fromEntries(FUNNEL.map(([step]) => [step, 0]));

  for (const [day, counts] of Object.entries(metrics)) {
    if (day < oldest) continue;
    for (const step of STEPS) totals[step] += counts[step] ?? 0;
  }
  return { days, totals };
}
