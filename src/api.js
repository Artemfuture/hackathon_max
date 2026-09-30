import { renderLocationRequest } from './core/messages.js';
import { DATE_LABELS, getCatalog, getPlanSummary, isDateId, planStartAt } from './data/events.js';
import { clockOf, dayLabelOf } from './data/time.js';
import { validateInitData } from './initData.js';
import { track } from './metrics.js';
import { findReminder, reminderTime, scheduleReminder } from './reminders.js';

const MAX_BODY_BYTES = 8 * 1024;
const DUPLICATE_WINDOW_MS = 10 * 60_000;
const GEO_REQUEST_GAP_MS = 30_000;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const NAME_LIMIT = 40;
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const INVITES_PER_USER = 20;

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size <= MAX_BODY_BYTES) chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > MAX_BODY_BYTES) return reject(new HttpError(413, 'too_large'));
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        return body && typeof body === 'object' ? resolve(body) : reject(new HttpError(400, 'bad_json'));
      } catch {
        return reject(new HttpError(400, 'bad_json'));
      }
    });
    req.on('error', reject);
  });
}

const encodeName = (name) => Buffer.from(name.slice(0, NAME_LIMIT), 'utf8').toString('base64url');

export function goingLaunchParam({ planId, date, guestId, guestName }) {
  const parts = ['going', planId, date, guestId];
  if (guestName) parts.push(encodeName(guestName));
  return parts.join('_');
}

const dayText = (dateId, startAt) => DATE_LABELS[dateId] && dateId !== 'weekend' ? DATE_LABELS[dateId] : dayLabelOf(startAt);

export function createApi({ botToken, notify, store, now = Date.now, leadMinutes = 60, weather = null, log = console }) {
  const recent = new Map();
  const hits = new Map();

  function allowed(userId) {
    const current = now();
    const list = (hits.get(userId) ?? []).filter((time) => current - time < RATE_WINDOW_MS);
    if (list.length >= RATE_LIMIT) {
      hits.set(userId, list);
      return false;
    }
    list.push(current);
    hits.set(userId, list);
    if (hits.size > 5000) hits.clear();
    return true;
  }

  function seenRecently(key) {
    const current = now();
    for (const [existing, time] of recent) if (current - time > DUPLICATE_WINDOW_MS) recent.delete(existing);
    return recent.has(key);
  }

  function rememberInvite(userId, planId, date) {
    const mine = (store.state.invites[userId] ??= {});
    mine[`${planId}:${date}`] = now();
    for (const key of Object.keys(mine).sort((a, b) => mine[b] - mine[a]).slice(INVITES_PER_USER)) delete mine[key];
    store.touch();
  }

  function inviteIsKnown(organizerId, planId, date) {
    const created = store.state.invites[organizerId]?.[`${planId}:${date}`];
    return typeof created === 'number' && now() - created <= INVITE_TTL_MS;
  }

  function parseChoice(body) {
    const plan = typeof body.planId === 'string' ? getPlanSummary(body.planId, body.date, now()) : null;
    if (!plan) throw new HttpError(400, 'bad_plan');
    if (!isDateId(body.date, now())) throw new HttpError(400, 'bad_date');
    return { plan, date: body.date };
  }

  async function choosePlan({ user, body }) {
    const { plan, date } = parseChoice(body);
    const current = now();
    const startAt = planStartAt(plan.id, date, current);
    const key = `plan:${user.id}`;
    rememberInvite(user.id, plan.id, date);

    const existing = findReminder(store, key);
    if (existing?.ref?.planId === plan.id && existing.ref.date === date) {
      return { ok: true, reminderAt: existing.at, unchanged: true };
    }

    const at = reminderTime(startAt, current, leadMinutes);
    const openPlan = [[{ text: 'Открыть план', openApp: `mine_${plan.id}_${date}` }]];
    const route = `${plan.kinds.join(' → ')}, ${plan.startTime}–${plan.endTime}`;
    const reminderLine = at
      ? `\n\n🔔 Напомню в ${clockOf(at)} — за ${Math.round((startAt - at) / 60_000)} мин до начала.`
      : '\n\nНачало уже совсем скоро или прошло, поэтому напоминание не ставлю.';

    try {
      await notify({ userId: Number(user.id) }, {
        text: `✅ Вечер выбран: ${route}\n📅 ${dayText(date, startAt)}${reminderLine}`,
        buttons: openPlan,
      });
    } catch (err) {
      log.warn(`Не удалось написать пользователю ${user.id} про выбранный план: ${err.message}`);
      throw new HttpError(502, 'notify_failed');
    }

    if (at) {
      scheduleReminder(store, {
        key,
        target: { userId: Number(user.id) },
        at,
        text: `🔔 Скоро начнётся ваш вечер: ${route}\n\nТы выбрал этот план в мини-приложении. Это единственное напоминание о нём.`,
        buttons: openPlan,
        ref: { planId: plan.id, date },
      });
    }
    track(store, 'app_plan', current);
    return { ok: true, reminderAt: at };
  }

  async function guestGoing({ user, body }) {
    const { plan, date } = parseChoice(body);
    const organizerId = String(body.organizerId ?? '');
    if (!/^[1-9]\d{0,14}$/.test(organizerId)) throw new HttpError(400, 'bad_organizer');
    if (organizerId === user.id) return { ok: true, notified: false, reason: 'self' };
    if (!inviteIsKnown(organizerId, plan.id, date)) throw new HttpError(403, 'unknown_invite');

    const key = `${user.id}:${organizerId}:${plan.id}:${date}`;
    if (seenRecently(key)) return { ok: true, notified: false, reason: 'duplicate' };

    const guest = user.firstName.slice(0, NAME_LIMIT) || 'Друг';
    try {
      await notify({ userId: Number(organizerId) }, {
        text:
          `🎉 ${guest} идёт!\n\nВечер ${dayText(date, planStartAt(plan.id, date, now()))}: ` +
          `${plan.kinds.join(' → ')}, ${plan.startTime}–${plan.endTime}.`,
        buttons: [[{
          text: 'Открыть план',
          openApp: goingLaunchParam({ planId: plan.id, date, guestId: user.id, guestName: guest }),
        }]],
      });
    } catch (err) {
      log.warn(`Не удалось уведомить организатора ${organizerId}: ${err.message}`);
      throw new HttpError(502, 'notify_failed');
    }
    recent.set(key, now());
    track(store, 'going', now());
    return { ok: true, notified: true };
  }

  async function requestLocation({ user }) {
    const key = `geo:${user.id}`;
    const last = recent.get(key);
    if (last != null && now() - last < GEO_REQUEST_GAP_MS) return { ok: true, sent: false, reason: 'duplicate' };
    try {
      await notify({ userId: Number(user.id) }, renderLocationRequest());
    } catch (err) {
      log.warn(`Не удалось попросить геолокацию у пользователя ${user.id}: ${err.message}`);
      throw new HttpError(502, 'notify_failed');
    }
    recent.set(key, now());
    return { ok: true, sent: true };
  }

  const routes = {
    'GET /api/catalog': {
      public: true,
      run: async () => {
        track(store, 'app_open', now());
        return { ...getCatalog(now()), weather: weather ? await weather.snapshot() : null };
      },
    },
    'HEAD /api/catalog': { public: true, run: async () => getCatalog(now()) },
    'POST /api/plan': { run: choosePlan },
    'POST /api/going': { run: guestGoing },
    'POST /api/geo': { run: requestLocation },
  };
  const knownPaths = new Set(Object.keys(routes).map((route) => route.split(' ')[1]));

  async function handle(req, res, pathname) {
    if (!pathname.startsWith('/api/')) return false;

    try {
      const route = routes[`${req.method} ${pathname}`];
      if (!route) {
        throw knownPaths.has(pathname) ? new HttpError(405, 'method_not_allowed') : new HttpError(404, 'not_found');
      }

      let user = null;
      if (!route.public) {
        const auth = validateInitData(req.headers['x-max-init-data'], botToken, { now: now() });
        if (!auth.ok) {
          log.warn(`Запрос ${pathname} отклонён: данные запуска не прошли проверку (${auth.reason}).`);
          throw new HttpError(401, auth.reason === 'expired' ? 'expired' : 'unauthorized');
        }
        user = auth.user;
        if (!allowed(user.id)) throw new HttpError(429, 'too_many_requests');
      }

      const body = req.method === 'POST' ? await readJson(req) : {};
      sendJson(res, 200, await route.run({ user, body }));
      return true;
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { ok: false, error: err.code });
        return true;
      }
      log.error(`Ошибка в ${pathname}:`, err);
      sendJson(res, 500, { ok: false, error: 'internal' });
      return true;
    }
  }

  return { handle };
}
