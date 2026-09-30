import { END_OF_DAY, START_MARGIN_MIN } from './time.js';
import { travel } from './travel.js';
import { fitsWindow, hoursOf, isFlexible, onDay, priceForUser, sessionOf } from './schedule.js';
import { describePlan, encodePlan } from './plan.js';

export const MAX_WAIT_MIN = 50;

const MOOD_ANY = 'any';

function moodMatch(item, moods) {
  if (moods.length === 0 || moods.includes(MOOD_ANY)) return 0.5;
  return (item.moods ?? []).some((mood) => moods.includes(mood)) ? 1 : 0;
}

function itemScore(item, query) {
  let score = moodMatch(item, query.moods) * 3;
  if (!isFlexible(item)) score += 1.2;
  if (item.source === 'kudago') score += 0.8;
  if (query.origin) score -= travel(query.origin, item).minutes * 0.03;
  if (query.rainy && item.outdoor) score -= 1.5;
  return score;
}

function planScore(stops, query) {
  const window = query.until - query.from;
  const active = stops.reduce((total, stop) => total + (stop.end - stop.start), 0);
  const legs = stops.map((stop) => stop.leg).filter(Boolean);
  let score = 0;
  for (const stop of stops) {
    score += moodMatch(stop.item, query.moods) * 3;
    if (!isFlexible(stop.item)) score += 1.2;
    if (stop.item.source === 'kudago') score += 0.8;
    if (query.rainy && stop.item.outdoor) score -= 1.5;
    score -= priceForUser(stop.item, query.benefits) * 0.0008;
  }
  score += Math.min(1, active / window) * 6;
  score -= stops.slice(1).reduce((total, stop) => total + stop.wait, 0) * 0.04;
  score -= stops[0].wait * 0.015;
  score -= legs.reduce((total, leg) => total + leg.minutes * (leg.mode === 'taxi' ? 0.08 : 0.05), 0);
  if (stops[0].leg) score -= stops[0].leg.minutes * 0.03;
  if (stops.length >= 2) score += 1.5;
  score += (new Set(stops.map((stop) => stop.item.category)).size - 1) * 0.5;
  if (stops.length >= 2) {
    if (ONCE_PER_PLAN.has(stops[stops.length - 1].item.category)) score += 0.6;
    if (ONCE_PER_PLAN.has(stops[0].item.category)) score -= 0.3;
  }
  return score;
}

const MAX_CANDIDATES = 26;
const CATEGORY_POOL_LIMIT = { food: 6, sport: 5 };
const DEFAULT_POOL_LIMIT = 10;
const ONCE_PER_PLAN = new Set(['food']);

function limitedPool(ranked) {
  const taken = {};
  const pool = [];
  for (const item of ranked) {
    const limit = CATEGORY_POOL_LIMIT[item.category] ?? DEFAULT_POOL_LIMIT;
    if ((taken[item.category] ?? 0) >= limit) continue;
    taken[item.category] = (taken[item.category] ?? 0) + 1;
    pool.push(item);
    if (pool.length >= MAX_CANDIDATES) break;
  }
  return pool;
}

export function candidatesFor(events, query, { exclude = [] } = {}) {
  const skip = new Set(exclude);
  return events.filter(
    (item) =>
      !skip.has(item.id) &&
      !item.manualOnly &&
      onDay(item, query.day) &&
      priceForUser(item, query.benefits) <= query.budget &&
      fitsWindow(item, query.from, query.until)
  );
}

function normalizeQuery(query) {
  return {
    moods: [],
    benefits: [],
    budget: Infinity,
    origin: null,
    rainy: false,
    ...query,
    until: Math.min(query.until, END_OF_DAY),
  };
}

function maxStopsFor(windowMin) {
  if (windowMin <= 90) return 2;
  if (windowMin <= 200) return 3;
  return 4;
}

function extend(stops, item, { at, origin, until }) {
  const count = stops.length;
  let prev = stops[count - 1] ?? null;
  const leg = prev ? travel(prev.item, item) : origin ? travel(origin, item) : null;

  if (prev && isFlexible(prev.item) && !isFlexible(item)) {
    const latest = sessionOf(item).start - START_MARGIN_MIN - leg.minutes;
    if (prev.end > latest) {
      if (latest - prev.start < hoursOf(prev.item).min) return null;
      prev = { ...prev, end: latest };
    }
  }

  const arrive = (prev ? prev.end : at) + (leg?.minutes ?? 0);
  let start;
  let end;
  if (isFlexible(item)) {
    const h = hoursOf(item);
    start = Math.max(arrive, h.open);
    const latest = Math.min(h.close, until);
    if (latest - start < h.min) return null;
    end = Math.min(start + h.ideal, latest);
  } else {
    const s = sessionOf(item);
    if (arrive > (leg ? s.start - START_MARGIN_MIN : s.start)) return null;
    start = s.start;
    end = s.end;
  }
  if (end > until) return null;
  const wait = start - arrive;
  if (count > 0 && wait > MAX_WAIT_MIN) return null;

  const next = count > 0 ? stops.slice(0, -1) : [];
  if (prev) next.push(prev);
  next.push({ item, leg, arrive, start, end, wait });
  return next;
}

const BRANCHING = [MAX_CANDIDATES, 16, 10, 8];

function searchPlans(events, rawQuery, { include = null, exclude = [] } = {}) {
  const query = normalizeQuery(rawQuery);
  const pool = limitedPool(
    candidatesFor(events, query, { exclude })
      .map((item) => ({ item, score: itemScore(item, query) }))
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
  );
  if (include && !pool.some((item) => item.id === include.id)) {
    if (!onDay(include, query.day)) return [];
    pool.unshift(include);
  }

  const maxStops = maxStopsFor(query.until - query.from);
  const context = { at: query.from, origin: query.origin, until: query.until };
  const found = [];
  const used = new Set();

  const visit = (stops, price) => {
    if (stops.length > 0 && (!include || used.has(include.id))) {
      found.push({ stops, score: planScore(stops, query) });
    }
    if (stops.length >= maxStops) return;
    const last = stops[stops.length - 1]?.item;
    const limit = BRANCHING[stops.length] ?? 8;
    let tried = 0;
    for (const item of pool) {
      if (tried >= limit && item !== include) continue;
      if (used.has(item.id)) continue;
      if (last && last.category === item.category) continue;
      const sameCategory = stops.filter((stop) => stop.item.category === item.category).length;
      if (sameCategory >= (ONCE_PER_PLAN.has(item.category) ? 1 : 2)) continue;
      const cost = price + priceForUser(item, query.benefits);
      if (cost > query.budget) continue;
      const next = extend(stops, item, context);
      if (!next) continue;
      tried += 1;
      used.add(item.id);
      visit(next, cost);
      used.delete(item.id);
    }
  };
  visit([], 0);

  return found.sort((a, b) => b.score - a.score);
}

const overlap = (a, b) => {
  const ids = new Set(a.map((stop) => stop.item.id));
  const common = b.filter((stop) => ids.has(stop.item.id)).length;
  return common / Math.min(a.length, b.length);
};

export function buildPlans(events, rawQuery, { limit = 3, include = null, exclude = [], skipIds = [] } = {}) {
  const query = normalizeQuery(rawQuery);
  const skipped = new Set(skipIds);
  const ranked = searchPlans(events, query, { include, exclude });
  const chosen = [];
  for (const candidate of ranked) {
    if (chosen.length >= limit) break;
    if (skipped.has(encodePlan(candidate.stops, query.until))) continue;
    const similar = chosen.some(
      (plan) => plan.stops[0].item.id === candidate.stops[0].item.id || overlap(plan.stops, candidate.stops) > 0.5
    );
    if (!similar) chosen.push(candidate);
  }

  const plans = chosen.map(({ stops, score }) => ({
    ...describePlan(stops, { benefits: query.benefits, firstLeg: stops[0].leg, until: query.until }),
    score,
  }));
  labelPlans(plans);
  return plans;
}

function labelPlans(plans) {
  if (plans.length === 0) return;
  plans[0].label = 'Лучший вариант';
  const rest = plans.slice(1);
  const cheapest = Math.min(...plans.map((plan) => plan.price));
  const shortestRoad = Math.min(...plans.map((plan) => plan.travelMin + (plan.firstLeg?.minutes ?? 0)));
  for (const plan of rest) {
    const road = plan.travelMin + (plan.firstLeg?.minutes ?? 0);
    if (plan.price === cheapest && plan.price < plans[0].price) plan.label = plan.price === 0 ? 'Бесплатно' : 'Дешевле';
    else if (road === shortestRoad && road < plans[0].travelMin + (plans[0].firstLeg?.minutes ?? 0))
      plan.label = 'Меньше дороги';
    else if (plan.stops.length > plans[0].stops.length) plan.label = 'Насыщеннее';
    else if (plan.stops.length < plans[0].stops.length) plan.label = 'Спокойнее';
    else plan.label = 'Другой вариант';
  }
}
