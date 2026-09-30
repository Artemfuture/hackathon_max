const WITH_PERSON = new Set(['plan', 'going']);
const MAX_NAME_LENGTH = 40;

function toBase64Url(text) {
  let binary = '';
  new TextEncoder().encode(text).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export function encodeLaunchParam({ kind, planId, date, name, userId, budget, benefit, place, lat, lon }) {
  if (kind === 'prefs') return [kind, date, budget, benefit].join('_');
  if (kind === 'from') return [kind, place].join('_');
  if (kind === 'here') return [kind, Math.round(lat * 1000), Math.round(lon * 1000)].join('_');
  if (kind === 'mine') return [kind, planId, date].join('_');

  const parts = [kind, planId, date, userId ?? 0];
  if (name) parts.push(toBase64Url(name.slice(0, MAX_NAME_LENGTH)));
  return parts.join('_');
}

export function parseLaunchParam(value) {
  if (!value) return null;
  const [kind, first, second, third, ...rest] = value.split('_');

  if (kind === 'prefs') {
    return first && second && third ? { kind, date: first, budget: second, benefit: third } : null;
  }
  if (kind === 'mine') {
    return first && second ? { kind, planId: first, date: second } : null;
  }
  if (kind === 'from') {
    return /^[a-z0-9-]{1,32}$/.test(first ?? '') && second === undefined ? { kind, place: first } : null;
  }
  if (kind === 'here') {
    const lat = Number(first) / 1000;
    const lon = Number(second) / 1000;
    const valid = /^\d{1,5}$/.test(first ?? '') && /^\d{1,6}$/.test(second ?? '') && lat <= 90 && lon <= 180;
    return valid ? { kind, lat, lon } : null;
  }
  if (!WITH_PERSON.has(kind) || !first || !second || !/^\d+$/.test(third ?? '')) return null;

  let name = null;
  if (rest.length > 0) {
    try {
      name = fromBase64Url(rest.join('_')).slice(0, MAX_NAME_LENGTH).trim() || null;
    } catch {
      name = null;
    }
  }
  return { kind, planId: first, date: second, userId: third === '0' ? null : third, name };
}
