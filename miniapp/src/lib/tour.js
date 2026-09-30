const KEY = 'dosug.tours';

function read() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export const tourDone = (id) => Boolean(read()[id]);

export function markTour(id) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: Date.now() }));
  } catch {}
}

export function resetTours() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
