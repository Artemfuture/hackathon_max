import { getInitData } from '../bridge.js';

const TIMEOUT_MS = 8000;

async function callServer(path, body) {
  const initData = getInitData();
  if (!initData) return { ok: false, skipped: true };

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Max-Init-Data': initData },
      body: JSON.stringify(body),
      signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(TIMEOUT_MS) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok !== false, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

export const notifyGoing = ({ organizerId, planId, date }) =>
  callServer('/api/going', { organizerId, planId, date });

export const announcePlan = ({ planId, date }) => callServer('/api/plan', { planId, date });

export const requestChatLocation = () => callServer('/api/geo', {});

export function failureText(result, fallback) {
  if (result.data?.error === 'expired') return 'Сессия устарела — закройте приложение и откройте его снова';
  if (result.data?.error === 'unknown_invite') return 'Приглашение устарело — сообщите организатору сами';
  return fallback;
}
