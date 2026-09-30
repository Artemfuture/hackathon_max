const MIRRORS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export async function overpass(query, { tries = 2 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'dosug-kazan/1.0 (hackathon)' },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) throw new Error(`ответ ${res.status}`);
        return (await res.json()).elements;
      } catch (err) {
        lastError = err;
        console.warn(`Overpass ${url}: ${err.message}`);
      }
    }
  }
  throw lastError ?? new Error('Overpass не ответил');
}

const toRad = (deg) => (deg * Math.PI) / 180;

export function distanceM(a, b) {
  const h =
    Math.sin(toRad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

export function addressOf(tags) {
  const street = tags['addr:street'];
  if (!street) return null;
  return [street, tags['addr:housenumber']].filter(Boolean).join(', ');
}

export function numberer(previous, first) {
  const numbers = new Map(previous.map((item) => [item.key, Number(item.id.replace(/^\D+/, ''))]));
  let next = Math.max(first - 1, ...numbers.values()) + 1;
  return (key) => {
    if (!numbers.has(key)) numbers.set(key, next++);
    return numbers.get(key);
  };
}
