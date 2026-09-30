import { getCatalog } from '../data/catalog.js';
import { BUDGET_OPTIONS, FROM_OPTIONS, HOURS_OPTIONS } from '../data/options.js';
import { dayOffset, nextSlot, nowMinutes } from './clock.js';
import {
  buildPlans,
  curatedPlan,
  decodePlan,
  describePlan,
  fitsWindow,
  isFlexible,
  isPlanCode,
  onDay,
  priceForUser,
  reachability,
  simulate,
  toMin,
} from './planner.js';
import { weatherFor } from './weather.js';

export { priceForUser };

const END_OF_DAY = 24 * 60;
const optionOf = (options, id) => options.find((option) => option.id === id);

export function windowOf(prefs, at = Date.now()) {
  const chosen =
    prefs.from === 'now' && prefs.date === 'today'
      ? nextSlot(at)
      : (optionOf(FROM_OPTIONS, prefs.from)?.from ?? 19 * 60);
  const from = prefs.date === 'today' ? Math.max(chosen, nextSlot(at)) : chosen;
  const minutes = (optionOf(HOURS_OPTIONS, prefs.hours)?.minutes ?? 180) + (prefs.extra ?? 0);
  return { from: Math.min(from, END_OF_DAY), until: Math.min(from + minutes, END_OF_DAY) };
}

export function plannerQuery({ prefs, moods = ['any'], benefits = [], origin = null }, at = Date.now()) {
  const { from, until } = windowOf(prefs, at);
  return {
    day: dayOffset(prefs.date, at),
    from,
    until,
    budget: optionOf(BUDGET_OPTIONS, prefs.budget)?.max ?? Infinity,
    moods,
    benefits,
    origin,
    rainy: weatherFor(prefs.date, from, until)?.rainy ?? false,
  };
}

export function findPlans(selection, options = {}) {
  return buildPlans(getCatalog().events, plannerQuery(selection), options);
}

export function findEvents(selection) {
  const query = plannerQuery(selection);
  const now = selection.prefs.date === 'today' ? nowMinutes() : null;
  const moodFits = (event) => query.moods.includes('any') || event.moods.some((mood) => query.moods.includes(mood));

  return getCatalog()
    .events.filter(
      (event) =>
        onDay(event, query.day) &&
        priceForUser(event, query.benefits) <= query.budget &&
        fitsWindow(event, query.from, query.until)
    )
    .map((event) => ({
      event,
      price: priceForUser(event, query.benefits),
      reach: reachability(event, { origin: query.origin, now }),
      match: moodFits(event),
    }))
    .filter(({ reach }) => reach.status !== 'late')
    .sort(
      (a, b) =>
        Number(b.match) - Number(a.match) ||
        Number(isFlexible(a.event)) - Number(isFlexible(b.event)) ||
        startOf(a.event, query.from) - startOf(b.event, query.from)
    );
}

const startOf = (event, from) => (isFlexible(event) ? Math.max(from, toMin(event.hours.open)) : toMin(event.start));

export function getPlan(planId, benefits = [], day = null) {
  const { events, plans } = getCatalog();
  if (isPlanCode(planId)) return decodePlan(planId, events, { day: day == null ? null : dayOffset(day), benefits });
  const definition = plans.find((plan) => plan.id === planId);
  return definition ? curatedPlan(definition, events, benefits) : null;
}

export const planExists = (planId, day = null) => Boolean(planId && getPlan(planId, [], day));

export function planAround(event, selection) {
  const query = plannerQuery(selection);
  const start = isFlexible(event) ? Math.max(query.from, toMin(event.hours.open)) : toMin(event.start);
  const now = selection.prefs.date === 'today' ? nowMinutes() : 0;
  const around = {
    ...query,
    from: Math.max(now, Math.min(query.from, start)),
    until: Math.min(END_OF_DAY, Math.max(query.until, start + event.durationMin + 90)),
  };
  const [best] = buildPlans(getCatalog().events, around, { include: event, limit: 1 });
  const plan = best ?? singlePlan(event, query.benefits, around.from);
  return plan && { ...plan, label: `Вечер вокруг: ${event.kind.toLowerCase()}` };
}

export function singlePlan(event, benefits = [], from = 19 * 60) {
  const at = isFlexible(event) ? Math.max(from, toMin(event.hours.open)) : toMin(event.start);
  const stops = simulate([event], { at });
  return stops ? describePlan(stops, { benefits }) : null;
}

export function withOrigin(plan, origin) {
  if (!plan) return plan;
  if (!origin) return { ...plan, firstLeg: null, leaveAt: plan.start };
  const first = plan.stops[0].item;
  const leg = reachability(first, { origin }).leg;
  const margin = isFlexible(first) ? 0 : 5;
  return { ...plan, firstLeg: leg, leaveAt: plan.start - leg.minutes - margin };
}

export function homeWindow(at = Date.now()) {
  const now = nowMinutes(at);
  if (now < 9 * 60) return { prefs: { date: 'today', from: '19', hours: '3', budget: 'any' }, day: 'Сегодня' };
  if (now > 22 * 60 + 30) return { prefs: { date: 'tomorrow', from: '19', hours: '3', budget: 'any' }, day: 'Завтра' };
  return { prefs: { date: 'today', from: 'now', hours: '3', budget: 'any' }, day: 'Сегодня' };
}

const THEMES = {
  concert: 'музыки',
  theatre: 'театра',
  museum: 'искусства',
  walk: 'города',
  cinema: 'кино',
  show: 'шоу',
  talk: 'разговоров',
  masterclass: 'творчества',
  sport: 'движения',
};
const FOOD_THEMES = { Кофейня: 'кофе', Кафе: 'уюта', Ресторан: 'ужина', Бар: 'коктейлей', Паб: 'пива' };

export function planTitle(plan) {
  const themes = [];
  for (const stop of plan.stops) {
    const item = stop.item;
    const theme = item.category === 'food' ? (FOOD_THEMES[item.kind] ?? 'ужина') : THEMES[item.category];
    if (theme && !themes.includes(theme)) themes.push(theme);
  }
  const part = plan.start < 17 * 60 ? 'День' : 'Вечер';
  return themes.length ? `${part} ${themes.slice(0, 2).join(' и ')}` : `${part} в городе`;
}

export const planPath = (plan) =>
  plan.stops.map((stop, index) => (index === 0 ? stop.item.kind : stop.item.kind.toLowerCase())).join(' → ');
