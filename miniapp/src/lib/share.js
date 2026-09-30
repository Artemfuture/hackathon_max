import { toClock } from './format.js';
import { yandexMapsRouteUrl } from './planner.js';

export function routeText(plan, { city, day }) {
  const steps = plan.stops.map(
    (stop, index) =>
      `${index + 1}. ${toClock(stop.start)}–${toClock(stop.end)} · ${stop.item.kind}: ${stop.item.title}` +
      (stop.item.address ? ` (${stop.item.address})` : '')
  );
  const mode = plan.taxiMin > 0 ? 'taxi' : 'walk';
  const maps = yandexMapsRouteUrl(
    plan.stops.map((stop) => stop.item),
    mode
  );
  return [`Маршрут вечера — ${city}, ${day}:`, ...steps, '', `Весь маршрут на карте: ${maps}`].join('\n');
}
