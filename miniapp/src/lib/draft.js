const KEY = 'dosug.drafts';
const OLD_KEY = 'dosug.draft';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function read() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') return saved;
    const old = JSON.parse(window.localStorage.getItem(OLD_KEY) ?? 'null');
    return old && typeof old.id === 'string' && ISO.test(old.date ?? '') ? { [old.date]: old.id } : {};
  } catch {
    return {};
  }
}

export function readDrafts(todayIso) {
  return Object.fromEntries(
    Object.entries(read()).filter(([date, id]) => ISO.test(date) && typeof id === 'string' && date >= todayIso)
  );
}

export function writeDraft(drafts, date, id) {
  const next = { ...drafts };
  if (id) next[date] = id;
  else delete next[date];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.localStorage.removeItem(OLD_KEY);
  } catch {}
  return next;
}
