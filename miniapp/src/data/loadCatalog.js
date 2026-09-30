import { normalizeCatalog, setCatalog } from './catalog.js';

const TIMEOUT_MS = 8000;

export async function loadCatalog({ photos, fallback, fetchFn = fetch, url = '/api/catalog' }) {
  const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
  const res = await fetchFn(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Каталог не загружен: ответ ${res.status}`);

  const catalog = normalizeCatalog(await res.json(), photos, { fallback });
  setCatalog(catalog);
  return catalog;
}
