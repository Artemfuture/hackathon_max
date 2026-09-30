import { START_MARGIN_MIN, TIGHT_MARGIN_MIN, toMin } from './time.js';
import { travel } from './travel.js';
import { MIN_VISIT_MIN, hoursOf, isFlexible, onDay, sessionOf } from './schedule.js';
import { customVisits, describePlan, simulate } from './plan.js';

export function reachability(item, { origin = null, now = null } = {}) {
  const leg = origin ? travel(origin, item) : null;
  if (now == null) return { leg, status: null, margin: null };
  const arrive = now + (leg?.minutes ?? 0);

  if (isFlexible(item)) {
    const h = hoursOf(item);
    if (arrive >= h.close - h.min) return { leg, status: 'late', margin: h.close - arrive, closesAt: h.close };
    if (arrive < h.open) return { leg, status: 'ok', margin: h.open - arrive, opensAt: h.open, closesAt: h.close };
    const stay = h.close - arrive;
    return { leg, status: stay < h.ideal ? 'tight' : 'ok', margin: stay, closesAt: h.close, open: true };
  }

  const margin = toMin(item.start) - arrive;
  if (margin < 0) return { leg, status: 'late', margin };
  return { leg, status: margin < TIGHT_MARGIN_MIN ? 'tight' : 'ok', margin };
}

function startOf(sequence, plan, notBefore = 0) {
  const [first, second] = sequence;
  if (!isFlexible(first)) return toMin(first.start);
  if (first.id === plan.stops[0].item.id) return plan.stops[0].start;
  const before =
    plan.stops[0].start - first.durationMin - (second ? travel(first, second).minutes + START_MARGIN_MIN : 0);
  return Math.max(hoursOf(first).open, before, notBefore);
}

export function insertIntoPlan(plan, item, { benefits = [], notBefore = 0 } = {}) {
  const items = plan.stops.map((stop) => stop.item);
  if (items.some((other) => other.id === item.id)) return { ok: false, reason: 'duplicate' };

  let best = null;
  for (let position = 0; position <= items.length; position += 1) {
    const sequence = [...items.slice(0, position), item, ...items.slice(position)];
    const stops = simulate(sequence, { at: startOf(sequence, plan, notBefore), visits: customVisits(plan.stops) });
    if (!stops || stops[0].start < notBefore) continue;
    const waiting = stops.slice(1).reduce((total, stop) => total + stop.wait, 0);
    const shift = Math.abs(stops[0].start - plan.start) + Math.max(0, stops[stops.length - 1].end - plan.end) * 0.5;
    const cost = waiting + shift;
    if (!best || cost < best.cost) best = { stops, cost };
  }
  if (best) return { ok: true, plan: describePlan(best.stops, { benefits }) };

  if (!isFlexible(item)) {
    const s = sessionOf(item);
    const before = [...plan.stops].reverse().find((stop) => stop.start <= s.start) ?? null;
    const after = plan.stops.find((stop) => stop.start > s.start) ?? null;
    if (before && before.end + START_MARGIN_MIN + travel(before.item, item).minutes > s.start) {
      const shortfall = before.end + START_MARGIN_MIN + travel(before.item, item).minutes - s.start;
      return { ok: false, reason: 'conflict', shortfall, conflictWith: before, side: 'before' };
    }
    if (after && !isFlexible(after.item)) {
      const shortfall = s.end + START_MARGIN_MIN + travel(item, after.item).minutes - after.start;
      if (shortfall > 0) return { ok: false, reason: 'conflict', shortfall, conflictWith: after, side: 'after' };
    }
  }
  return { ok: false, reason: 'no_fit', shortfall: null };
}

export function removeFromPlan(plan, itemId, { benefits = [] } = {}) {
  const items = plan.stops.map((stop) => stop.item).filter((item) => item.id !== itemId);
  if (items.length === 0) return null;
  const first = items[0];
  const kept = plan.stops.find((stop) => stop.item.id === first.id);
  const stops = simulate(items, { at: kept.start, visits: customVisits(plan.stops) });
  return stops ? describePlan(stops, { benefits }) : null;
}

export function visitBounds(plan, itemId) {
  const stop = plan.stops.find((candidate) => candidate.item.id === itemId);
  if (!stop || !isFlexible(stop.item)) return null;
  const h = hoursOf(stop.item);
  return { min: MIN_VISIT_MIN, max: Math.min(h.close - stop.start, 240), current: stop.end - stop.start };
}

export function setVisit(plan, itemId, minutes, { benefits = [] } = {}) {
  const bounds = visitBounds(plan, itemId);
  if (!bounds) return { ok: false, reason: 'fixed' };
  if (minutes < bounds.min || minutes > bounds.max) return { ok: false, reason: 'bounds', bounds };
  const visits = { ...customVisits(plan.stops), [itemId]: minutes };
  const items = plan.stops.map((stop) => stop.item);
  const stops = simulate(items, { at: plan.stops[0].start, visits });
  if (stops) return { ok: true, plan: describePlan(stops, { benefits }) };
  const index = items.findIndex((item) => item.id === itemId);
  const blocked = plan.stops.slice(index + 1).find((stop) => !isFlexible(stop.item)) ?? null;
  return { ok: false, reason: 'conflict', conflictWith: blocked };
}

function singleStop(item, { start, visit = null, notBefore = 0, benefits = [] }) {
  const at = Math.max(notBefore, isFlexible(item) ? Math.max(hoursOf(item).open, start) : toMin(item.start));
  const stops = simulate([item], { at, visits: visit ? { [item.id]: visit } : {} });
  return stops && stops[0].start >= notBefore ? describePlan(stops, { benefits }) : null;
}

export function adaptPlan(plan, events, { day, benefits = [], notBefore = 0 } = {}) {
  let current = null;
  const lost = [];
  for (const stop of plan.stops) {
    if (!onDay(stop.item, day)) {
      lost.push(stop);
      continue;
    }
    const visit = stop.custom ? stop.end - stop.start : null;
    if (!current) {
      current = singleStop(stop.item, { start: stop.start, visit, notBefore, benefits });
      if (!current) lost.push(stop);
      continue;
    }
    const result = insertIntoPlan(current, stop.item, { benefits, notBefore });
    if (result.ok) current = result.plan;
    else lost.push(stop);
  }

  const replaced = [];
  for (const stop of lost) {
    const taken = new Set((current?.stops ?? []).map((kept) => kept.item.id));
    const similar = events
      .filter(
        (other) =>
          onDay(other, day) &&
          !taken.has(other.id) &&
          other.id !== stop.item.id &&
          (other.category === stop.item.category || (other.moods ?? []).some((mood) => stop.item.moods?.includes(mood)))
      )
      .sort(
        (a, b) =>
          Number(b.category === stop.item.category) - Number(a.category === stop.item.category) ||
          Math.abs(startGuess(a, stop.start) - stop.start) - Math.abs(startGuess(b, stop.start) - stop.start)
      );
    for (const other of similar) {
      const next = current
        ? insertIntoPlan(current, other, { benefits, notBefore })
        : { ok: true, plan: singleStop(other, { start: stop.start, notBefore, benefits }) };
      if (next.ok && next.plan) {
        current = next.plan;
        replaced.push({ from: stop.item, to: other });
        break;
      }
    }
  }

  const dropped = lost
    .filter((stop) => !replaced.some((swap) => swap.from.id === stop.item.id))
    .map((stop) => stop.item);
  return current ? { ok: true, plan: current, replaced, dropped } : { ok: false, replaced: [], dropped };
}

const startGuess = (item, fallback) =>
  isFlexible(item) ? Math.max(hoursOf(item).open, Math.min(fallback, hoursOf(item).close - 30)) : toMin(item.start);

export function similarFitting(plan, item, events, { day, benefits = [], notBefore = 0, limit = 3 } = {}) {
  const inPlan = new Set(plan.stops.map((stop) => stop.item.id));
  return events
    .filter((other) => other.id !== item.id && !inPlan.has(other.id) && onDay(other, day))
    .filter(
      (other) => other.category === item.category || (other.moods ?? []).some((mood) => item.moods?.includes(mood))
    )
    .map((other) => ({ other, result: insertIntoPlan(plan, other, { benefits, notBefore }) }))
    .filter(({ result }) => result.ok)
    .sort(
      (a, b) =>
        Number(b.other.category === item.category) - Number(a.other.category === item.category) ||
        a.result.plan.durationMin - b.result.plan.durationMin
    )
    .slice(0, limit)
    .map(({ other, result }) => ({ item: other, plan: result.plan }));
}
