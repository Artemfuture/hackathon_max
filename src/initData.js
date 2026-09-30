import crypto from 'node:crypto';

export const INIT_DATA_MAX_AGE_SEC = 60 * 60;

export function validateInitData(initData, botToken, { maxAgeSec = INIT_DATA_MAX_AGE_SEC, now = Date.now() } = {}) {
  if (typeof initData !== 'string' || !initData || !botToken) return { ok: false, reason: 'missing' };

  const params = [...new URLSearchParams(initData).entries()];
  const hashes = params.filter(([key]) => key === 'hash');
  if (hashes.length !== 1) return { ok: false, reason: 'hash' };
  if (new Set(params.map(([key]) => key)).size !== params.length) return { ok: false, reason: 'duplicate' };

  const launchParams = params
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secretKey).update(launchParams).digest();
  const given = Buffer.from(hashes[0][1], 'hex');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'signature' };
  }

  const data = Object.fromEntries(params);
  const authDate = Number(data.auth_date);
  const ageSec = now / 1000 - authDate;
  if (!Number.isFinite(authDate) || ageSec > maxAgeSec || ageSec < -300) return { ok: false, reason: 'expired' };

  let user;
  try {
    user = JSON.parse(data.user);
  } catch {
    return { ok: false, reason: 'user' };
  }
  if (!Number.isSafeInteger(user?.id)) return { ok: false, reason: 'user' };

  return {
    ok: true,
    user: { id: String(user.id), firstName: String(user.first_name ?? user.name ?? '').trim() },
    startParam: data.start_param ?? null,
    authDate,
  };
}
