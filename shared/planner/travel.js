export const DETOUR = 1.3;
const WALK_KMH = 5;
const TAXI_KMH = 24;
const TAXI_PICKUP_MIN = 6;
const TRANSIT_KMH = 16;
const TRANSIT_WAIT_MIN = 8;
const EARTH_RADIUS_KM = 6371;
export const MAX_WALK_MIN = 20;
export const CITY_RADIUS_KM = 40;

const toRad = (deg) => (deg * Math.PI) / 180;

export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export const nearestKm = (point, places) =>
  places.length ? Math.min(...places.map((place) => distanceKm(point, place))) : 0;

export const inCity = (point, places) => point.lat > 0 && point.lon > 0 && nearestKm(point, places) <= CITY_RADIUS_KM;

export const walkMinutes = (km) => Math.max(1, Math.round((km * DETOUR * 60) / WALK_KMH));

export function travel(from, to) {
  const straight = distanceKm(from, to);
  const km = straight * DETOUR;
  const walk = walkMinutes(straight);
  const taxi = Math.round(TAXI_PICKUP_MIN + (km / TAXI_KMH) * 60);
  const transit = Math.round(TRANSIT_WAIT_MIN + (km / TRANSIT_KMH) * 60);
  const mode = walk <= MAX_WALK_MIN ? 'walk' : 'taxi';
  return {
    km: Math.round(km * 10) / 10,
    walk,
    taxi,
    transit,
    mode,
    minutes: mode === 'walk' ? walk : taxi,
  };
}
