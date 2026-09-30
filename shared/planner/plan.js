import { END_OF_DAY, NIGHT_END, START_MARGIN_MIN, TIGHT_MARGIN_MIN, toMin } from './time.js';
import { travel } from './travel.js';
import { MIN_VISIT_MIN, hoursOf, isFlexible, onDay, priceForUser, sessionOf } from './schedule.js';

export function simulate(sequence, { at, origin = null, until = NIGHT_END, visits = {} }) {
  const stops = [];
  let t = at;
  let pos = origin;

  for (let i = 0; i < sequence.length; i += 1) {
    const item = sequence[i];
    const leg = pos ? travel(pos, item) : null;
    const arrive = t + (leg?.minutes ?? 0);
    let start;
    let end;

    const custom = isFlexible(item) && visits[item.id] != null;
    if (isFlexible(item)) {
      const h = hoursOf(item, visits[item.id]);
      start = Math.max(arrive, h.open);
      let latest = Math.min(h.close, until);
      const next = sequence[i + 1];
      if (next && !isFlexible(next)) {
        latest = Math.min(latest, sessionOf(next).start - START_MARGIN_MIN - travel(item, next).minutes);
      }
      if (latest - start < h.min) return null;
      end = Math.min(start + h.ideal, latest);
    } else {
      const s = sessionOf(item);
      const deadline = leg ? s.start - START_MARGIN_MIN : s.start;
      if (arrive > deadline) return null;
      start = s.start;
      end = s.end;
    }

    if (end > until) return null;
    const wait = start - arrive;
    stops.push({ item, leg, arrive, start, end, wait, ...(custom && { custom: true }) });
    t = end;
    pos = item;
  }
  return stops;
}

export const customVisits = (stops) =>
  Object.fromEntries(stops.filter((stop) => stop.custom).map((stop) => [stop.item.id, stop.end - stop.start]));

const numberOf = (id) => String(id).replace(/^\D+/, '');

export function encodePlan(stops, until = null) {
  const window = until != null && until < END_OF_DAY ? `u${until}` : '';
  const points = stops.map((stop) => `${numberOf(stop.item.id)}${stop.custom ? `d${stop.end - stop.start}` : ''}`);
  return `r${stops[0].start}${window}-${points.join('-')}`;
}

const CODE_RE = /^r(\d{1,4})(?:u(\d{1,4}))?((?:-\d{1,9}(?:d\d{1,3})?){1,6})$/;
export const isPlanCode = (value) => typeof value === 'string' && CODE_RE.test(value);

export function describePlan(stops, { benefits = [], firstLeg = null, until = null, id = null } = {}) {
  const priced = stops.map((stop, index) => ({
    ...stop,
    leg: index === 0 ? null : stop.leg,
    price: priceForUser(stop.item, benefits),
  }));
  const legs = priced.map((stop) => stop.leg).filter(Boolean);
  const start = priced[0].start;
  const end = priced[priced.length - 1].end;
  const sum = (values) => values.reduce((total, value) => total + value, 0);
  const margins = priced
    .slice(1)
    .map((stop) => stop.wait)
    .concat(until != null ? [until - end] : []);

  return {
    id: id ?? encodePlan(priced, until),
    stops: priced,
    firstLeg,
    start,
    end,
    leaveAt: firstLeg ? start - firstLeg.minutes - (isFlexible(priced[0].item) ? 0 : START_MARGIN_MIN) : start,
    durationMin: end - start,
    price: sum(priced.map((stop) => stop.price)),
    travelMin: sum(legs.map((leg) => leg.minutes)),
    walkMin: sum(legs.filter((leg) => leg.mode === 'walk').map((leg) => leg.minutes)),
    taxiMin: sum(legs.filter((leg) => leg.mode === 'taxi').map((leg) => leg.minutes)),
    reserveMin: Math.max(0, sum(margins)),
    tight: priced.some(
      (stop, index) => index > 0 && !isFlexible(stop.item) && stop.wait < TIGHT_MARGIN_MIN - START_MARGIN_MIN
    ),
  };
}

export function decodePlan(code, events, { day = null, benefits = [] } = {}) {
  const match = CODE_RE.exec(code ?? '');
  if (!match) return null;
  const byNumber = new Map(events.map((event) => [numberOf(event.id), event]));
  const points = match[3]
    .slice(1)
    .split('-')
    .map((part) => {
      const [number, visit] = part.split('d');
      return { item: byNumber.get(number), visit: visit == null ? null : Number(visit) };
    });
  const sequence = points.map((point) => point.item);
  if (sequence.some((item) => !item)) return null;
  if (new Set(sequence.map((item) => item.id)).size !== sequence.length) return null;
  if (day != null && sequence.some((item) => !onDay(item, day))) return null;
  const visits = {};
  for (const { item, visit } of points) {
    if (visit == null) continue;
    if (!isFlexible(item) || visit < MIN_VISIT_MIN) return null;
    visits[item.id] = visit;
  }
  const at = Number(match[1]);
  const until = match[2] ? Number(match[2]) : NIGHT_END;
  const stops = simulate(sequence, { at, until, visits });
  if (!stops || stops[0].start !== at) return null;
  return describePlan(stops, { benefits, id: code, until: match[2] ? until : null });
}

export function curatedPlan(definition, events, benefits = []) {
  const byId = new Map(events.map((event) => [event.id, event]));
  const items = definition.stops.map((stop) => byId.get(stop.eventId));
  if (items.some((item) => !item)) return null;
  const stops = definition.stops.map((stop, index) => {
    const item = items[index];
    const start = toMin(item.start);
    const leg = index === 0 ? null : { mode: 'walk', minutes: stop.walkBefore, walk: stop.walkBefore, km: null };
    return { item, leg, arrive: start, start, end: start + item.durationMin, wait: 0 };
  });
  return describePlan(stops, { benefits, id: definition.id });
}
