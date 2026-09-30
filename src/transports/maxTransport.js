import { BOT_COMMANDS, handleUpdate } from '../core/bot.js';
import { createNodeFetch, loadMaxCa } from './maxHttp.js';

const DEFAULT_BASE_URL = 'https://platform-api2.max.ru';
const POLL_TIMEOUT_SEC = 30;
const UPDATE_TYPES = ['bot_started', 'message_created', 'message_callback'];
const MAX_TEXT_LENGTH = 4000;
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 60000;
const RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_PAUSE_MS = 1000;

const ERROR_MESSAGE = {
  text: 'Что-то пошло не так 😔 Попробуй ещё раз или вернись в главное меню.',
  buttons: [[{ text: '🏠 Главное меню', action: 'menu:main' }]],
};

export class MaxApiError extends Error {
  constructor(method, path, status, details) {
    super(`MAX API ${method} ${path} failed: ${status}${details ? ` ${details}` : ''}`);
    this.name = 'MaxApiError';
    this.status = status;
  }
}

export function describeError(err) {
  const code = err.cause?.code ?? err.code;
  const reason = err.cause?.message;
  return code ? `${err.message} (${code}${reason ? `: ${reason}` : ''})` : err.message;
}

const isRichButton = (btn) => btn.openApp !== undefined || btn.requestLocation;

const hasRichButtons = (message) => (message.buttons ?? []).flat().some(isRichButton);

function withoutRichButtons(message) {
  const rows = (message.buttons ?? []).map((row) => row.filter((btn) => !isRichButton(btn))).filter((row) => row.length);
  return { ...message, buttons: rows };
}

function toApiButtons(buttons = [], botUsername = null) {
  return buttons.map((row) =>
    row.map((btn) => {
      if (btn.url) return { type: 'link', text: btn.text, url: btn.url };
      if (btn.requestLocation) return { type: 'request_geo_location', text: btn.text };
      if (btn.openApp !== undefined) {
        return {
          type: 'open_app',
          text: btn.text,
          ...(botUsername && { web_app: botUsername }),
          ...(btn.openApp && { payload: btn.openApp }),
        };
      }
      return { type: 'callback', text: btn.text, payload: btn.action };
    })
  );
}

function toApiMessage(message, botUsername) {
  return {
    text: message.text.slice(0, MAX_TEXT_LENGTH),
    attachments: message.buttons?.length
      ? [{ type: 'inline_keyboard', payload: { buttons: toApiButtons(message.buttons, botUsername) } }]
      : undefined,
  };
}

function targetQuery(target) {
  if (target !== null && typeof target === 'object') {
    return target.userId != null ? { user_id: target.userId } : { chat_id: target.chatId };
  }
  return { chat_id: target };
}

export function createMaxClient({ token, baseUrl = DEFAULT_BASE_URL, fetchFn = fetch, sleepFn = sleep }) {
  if (!token) {
    throw new Error('MAX_BOT_TOKEN is required to start the MAX transport');
  }

  let botUsername = null;

  async function call(path, { method = 'GET', query = {}, body, signal } = {}) {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    for (let attempt = 0; ; attempt++) {
      const res = await fetchFn(url, {
        method,
        headers: { Authorization: token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });

      if (res.status === 429 && attempt < RATE_LIMIT_RETRIES) {
        await sleepFn(RATE_LIMIT_PAUSE_MS, signal);
        continue;
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new MaxApiError(method, path, res.status, errText);
      }
      return res.json();
    }
  }

  async function sendWithFallback(send, message) {
    try {
      return await send(message);
    } catch (err) {
      if (err instanceof MaxApiError && err.status === 400 && hasRichButtons(message)) {
        console.warn('MAX отклонил сообщение с кнопкой приложения/геолокации, отправляю без неё:', err.message);
        return send(withoutRichButtons(message));
      }
      throw err;
    }
  }

  return {
    setBotUsername: (username) => {
      botUsername = username ?? null;
    },

    getMe: () => call('/me'),

    setCommands: (commands) => call('/me/commands', { method: 'PATCH', body: { commands } }),

    getUpdates: (marker, signal) =>
      call('/updates', {
        query: { marker, timeout: POLL_TIMEOUT_SEC, types: UPDATE_TYPES.join(',') },
        signal,
      }),

    sendMessage: (target, message) =>
      sendWithFallback(
        (msg) => call('/messages', { method: 'POST', query: targetQuery(target), body: toApiMessage(msg, botUsername) }),
        message
      ),

    answerCallback: (callbackId, message) =>
      sendWithFallback(
        (msg) =>
          call('/answers', {
            method: 'POST',
            query: { callback_id: callbackId },
            body: { message: toApiMessage(msg, botUsername) },
          }),
        message
      ),
  };
}

export function normalizeUpdate(raw) {
  const withUser = (result, userId) => (userId != null ? { ...result, userId } : result);

  switch (raw.update_type) {
    case 'bot_started':
      return raw.chat_id
        ? withUser({ chatId: raw.chat_id, update: { type: 'text', text: '/start' } }, raw.user?.user_id)
        : null;

    case 'message_created': {
      const { message } = raw;
      const chatId = message?.recipient?.chat_id;
      if (!chatId || message.sender?.is_bot) return null;
      const userId = message.sender?.user_id;

      const location = message.body?.attachments?.find((item) => item?.type === 'location');
      if (Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude)) {
        return withUser(
          { chatId, update: { type: 'location', latitude: location.latitude, longitude: location.longitude } },
          userId
        );
      }

      const text = message.body?.text;
      return text ? withUser({ chatId, update: { type: 'text', text } }, userId) : null;
    }

    case 'message_callback': {
      const chatId = raw.message?.recipient?.chat_id;
      const { callback } = raw;
      if (!chatId || !callback?.callback_id || !callback.payload) return null;
      return withUser(
        {
          chatId,
          update: { type: 'callback', action: callback.payload },
          callbackId: callback.callback_id,
        },
        callback.user?.user_id
      );
    }

    default:
      return null;
  }
}

async function processUpdate(client, raw) {
  const normalized = normalizeUpdate(raw);
  if (!normalized) return;
  const { chatId, userId, update, callbackId } = normalized;

  let message;
  try {
    message = handleUpdate(chatId, update, { userId });
  } catch (err) {
    console.error('Ошибка обработки события:', err);
    message = ERROR_MESSAGE;
  }

  try {
    if (callbackId) {
      try {
        await client.answerCallback(callbackId, message);
        return;
      } catch (err) {
        console.error('Не удалось ответить на callback, отправляю новым сообщением:', err.message);
      }
    }
    await client.sendMessage(chatId, message);
  } catch (err) {
    console.error('Не удалось отправить сообщение:', err.message);
  }
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function defaultFetch() {
  const ca = loadMaxCa();
  if (!ca) {
    console.warn(
      'Корневой сертификат Минцифры не найден (certs/russian_trusted_root_ca.pem): соединение с MAX ' +
        'будет проверяться только по стандартным центрам сертификации и, скорее всего, не установится.'
    );
  }
  return createNodeFetch({ ca });
}

export async function startMaxTransport({ token, baseUrl, fetchFn = defaultFetch(), store = null }) {
  const client = createMaxClient({ token, baseUrl, fetchFn });
  const me = await client.getMe();
  client.setBotUsername(me.username);
  await client
    .setCommands(BOT_COMMANDS)
    .catch((err) => console.warn('Не удалось обновить меню команд бота:', describeError(err)));
  console.log(
    `MAX transport: подключён как ${me.name ?? me.first_name} (@${me.username}). ` +
      'Long polling запущен, Ctrl+C для остановки.'
  );

  const abort = new AbortController();
  let marker = store?.state.marker ?? undefined;

  async function loop() {
    let retryMs = RETRY_BASE_MS;
    while (!abort.signal.aborted) {
      try {
        const { updates = [], marker: nextMarker } = await client.getUpdates(marker, abort.signal);
        marker = nextMarker ?? marker;
        if (store && marker !== undefined && store.state.marker !== marker) {
          store.state.marker = marker;
          store.touch();
        }
        retryMs = RETRY_BASE_MS;
        for (const raw of updates) await processUpdate(client, raw);
      } catch (err) {
        if (abort.signal.aborted) return;
        if (err instanceof MaxApiError && err.status === 401) throw err;
        console.error(`Ошибка при опросе MAX API, повтор через ${retryMs / 1000}с:`, describeError(err));
        await sleep(retryMs, abort.signal);
        retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
      }
    }
  }

  return { client, me, stop: () => abort.abort(), done: loop() };
}
