import { getCatalog } from '../data/catalog.js';
import { inCity, nearestKm } from './planner.js';

export const GEO_ID = 'geo';
export const PIN_ID = 'pin';

export function requestPosition({ timeoutMs = 10000, landmarks = getCatalog().landmarks } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('unsupported'));
      return;
    }
    const guard = setTimeout(() => reject(new Error('timeout')), timeoutMs + 2000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(guard);
        const point = {
          id: GEO_ID,
          label: 'Вы здесь',
          lat: Math.round(position.coords.latitude * 1e5) / 1e5,
          lon: Math.round(position.coords.longitude * 1e5) / 1e5,
          accuracy: Math.round(position.coords.accuracy),
        };
        if (landmarks.length && !inCity(point, landmarks)) {
          reject(Object.assign(new Error('far'), { km: Math.round(nearestKm(point, landmarks)) }));
          return;
        }
        resolve(point);
      },
      (error) => {
        clearTimeout(guard);
        reject(error);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}

export function landmarkOrigin(landmarks, id) {
  const place = landmarks.find((item) => item.id === id) ?? landmarks[0] ?? null;
  return place ? { id: place.id, label: place.label, emoji: place.emoji, lat: place.lat, lon: place.lon } : null;
}

export function sanitizePin(saved) {
  const valid =
    saved &&
    typeof saved.lat === 'number' &&
    typeof saved.lon === 'number' &&
    Math.abs(saved.lat - 55.79) < 0.5 &&
    Math.abs(saved.lon - 49.12) < 0.8;
  return valid
    ? { id: PIN_ID, label: String(saved.label ?? 'Точка на карте').slice(0, 60), lat: saved.lat, lon: saved.lon }
    : null;
}
