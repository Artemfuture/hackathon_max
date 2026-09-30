const PROFILE = { walk: 'routed-foot', taxi: 'routed-car', transit: 'routed-car' };
const TIMEOUT_MS = 4000;
const cache = new Map();

const straight = (from, to) => [
  [from.lat, from.lon],
  [to.lat, to.lon],
];

export function routeLine(from, to, mode = 'walk') {
  const key = `${mode}:${from.lat},${from.lon}:${to.lat},${to.lon}`;
  if (cache.has(key)) return cache.get(key);
  const url =
    `https://routing.openstreetmap.de/${PROFILE[mode] ?? PROFILE.walk}/route/v1/driving/` +
    `${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
  const pending = fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
    .then((data) => {
      const coords = data.routes?.[0]?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) throw new Error('empty');
      return { points: coords.map(([lon, lat]) => [lat, lon]), exact: true };
    })
    .catch(() => {
      cache.delete(key);
      return { points: straight(from, to), exact: false };
    });
  cache.set(key, pending);
  return pending;
}
