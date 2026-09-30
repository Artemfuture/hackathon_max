import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMaxClient, normalizeUpdate, startMaxTransport, MaxApiError } from '../src/transports/maxTransport.js';
import { createStore } from '../src/store.js';

const TOKEN = 'test-token';

function fakeFetch(responses = []) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: new URL(url), init, body: init.body ? JSON.parse(init.body) : undefined });
    const { status = 200, body = {} } = responses.shift() ?? {};
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
  fn.calls = calls;
  return fn;
}

test('клиент: токен идёт в заголовке Authorization, а не в query', async () => {
  const fetchFn = fakeFetch([{ body: { updates: [], marker: 1 } }]);
  const client = createMaxClient({ token: TOKEN, fetchFn });
  await client.getUpdates(undefined);

  const [{ url, init }] = fetchFn.calls;
  assert.equal(url.origin, 'https://platform-api2.max.ru');
  assert.equal(url.pathname, '/updates');
  assert.equal(init.headers.Authorization, TOKEN);
  assert.equal(url.searchParams.has('access_token'), false);
  assert.equal(url.searchParams.get('types'), 'bot_started,message_created,message_callback');
});

test('клиент: sendMessage шлёт chat_id в query и inline-клавиатуру во вложении', async () => {
  const fetchFn = fakeFetch();
  const client = createMaxClient({ token: TOKEN, fetchFn });
  await client.sendMessage(123, {
    text: 'Привет',
    buttons: [
      [{ text: 'Кнопка', action: 'menu:main' }],
      [{ text: 'Билет', url: 'https://example.com' }],
    ],
  });

  const [{ url, init, body }] = fetchFn.calls;
  assert.equal(init.method, 'POST');
  assert.equal(url.pathname, '/messages');
  assert.equal(url.searchParams.get('chat_id'), '123');
  assert.equal(body.text, 'Привет');
  assert.deepEqual(body.attachments, [
    {
      type: 'inline_keyboard',
      payload: {
        buttons: [
          [{ type: 'callback', text: 'Кнопка', payload: 'menu:main' }],
          [{ type: 'link', text: 'Билет', url: 'https://example.com' }],
        ],
      },
    },
  ]);
});

test('клиент: answerCallback передаёт callback_id в query, а не в теле', async () => {
  const fetchFn = fakeFetch();
  const client = createMaxClient({ token: TOKEN, fetchFn });
  await client.answerCallback('cb-1', { text: 'Ок', buttons: [[{ text: 'Меню', action: 'menu:main' }]] });

  const [{ url, body }] = fetchFn.calls;
  assert.equal(url.pathname, '/answers');
  assert.equal(url.searchParams.get('callback_id'), 'cb-1');
  assert.equal(body.callback_id, undefined);
  assert.equal(body.message.text, 'Ок');
});

test('клиент: слишком длинный текст обрезается до лимита MAX (4000 символов)', async () => {
  const fetchFn = fakeFetch();
  const client = createMaxClient({ token: TOKEN, fetchFn });
  await client.sendMessage(1, { text: 'а'.repeat(5000), buttons: [] });
  assert.equal(fetchFn.calls[0].body.text.length, 4000);
});

test('клиент: не-2xx ответ превращается в MaxApiError со статусом', async () => {
  const fetchFn = fakeFetch([{ status: 401, body: { code: 'verify.token' } }]);
  const client = createMaxClient({ token: TOKEN, fetchFn });
  await assert.rejects(client.getMe(), (err) => err instanceof MaxApiError && err.status === 401);
});

test('клиент: без токена не создаётся', () => {
  assert.throws(() => createMaxClient({ token: '' }), /MAX_BOT_TOKEN/);
});

test('normalizeUpdate: bot_started превращается в /start', () => {
  const result = normalizeUpdate({ update_type: 'bot_started', chat_id: 42, user: { user_id: 7 } });
  assert.deepEqual(result, { chatId: 42, userId: 7, update: { type: 'text', text: '/start' } });
});

test('normalizeUpdate: message_created берёт chat_id и текст из message', () => {
  const result = normalizeUpdate({
    update_type: 'message_created',
    message: { sender: { user_id: 7, is_bot: false }, recipient: { chat_id: 42 }, body: { text: 'меню' } },
  });
  assert.deepEqual(result, { chatId: 42, userId: 7, update: { type: 'text', text: 'меню' } });
});

test('normalizeUpdate: без user_id событие всё равно обрабатывается (userId не подставляется)', () => {
  const result = normalizeUpdate({
    update_type: 'message_created',
    message: { recipient: { chat_id: 42 }, body: { text: 'меню' } },
  });
  assert.deepEqual(result, { chatId: 42, update: { type: 'text', text: 'меню' } });
});

test('normalizeUpdate: вложение-геолокация превращается в событие location', () => {
  const result = normalizeUpdate({
    update_type: 'message_created',
    message: {
      sender: { user_id: 7, is_bot: false },
      recipient: { chat_id: 42 },
      body: { text: null, attachments: [{ type: 'location', latitude: 55.79, longitude: 49.12 }] },
    },
  });
  assert.deepEqual(result, {
    chatId: 42,
    userId: 7,
    update: { type: 'location', latitude: 55.79, longitude: 49.12 },
  });
});

test('normalizeUpdate: геолокация без координат игнорируется, а не роняет разбор', () => {
  const result = normalizeUpdate({
    update_type: 'message_created',
    message: {
      sender: { user_id: 7, is_bot: false },
      recipient: { chat_id: 42 },
      body: { text: null, attachments: [{ type: 'location' }] },
    },
  });
  assert.equal(result, null);
});

test('normalizeUpdate: сообщения от ботов и без текста игнорируются', () => {
  assert.equal(
    normalizeUpdate({
      update_type: 'message_created',
      message: { sender: { is_bot: true }, recipient: { chat_id: 42 }, body: { text: 'эхо' } },
    }),
    null
  );
  assert.equal(
    normalizeUpdate({
      update_type: 'message_created',
      message: { sender: { is_bot: false }, recipient: { chat_id: 42 }, body: { text: null } },
    }),
    null
  );
});

test('normalizeUpdate: message_callback берёт chat_id из верхнеуровневого message', () => {
  const result = normalizeUpdate({
    update_type: 'message_callback',
    callback: { callback_id: 'cb-1', payload: 'budget:free', user: { user_id: 7 } },
    message: { recipient: { chat_id: 42 }, body: { text: '...' } },
  });
  assert.deepEqual(result, {
    chatId: 42,
    userId: 7,
    update: { type: 'callback', action: 'budget:free' },
    callbackId: 'cb-1',
  });
});

test('normalizeUpdate: callback без исходного сообщения и неизвестные типы игнорируются', () => {
  assert.equal(
    normalizeUpdate({ update_type: 'message_callback', callback: { callback_id: 'cb-1', payload: 'x' } }),
    null
  );
  assert.equal(normalizeUpdate({ update_type: 'dialog_muted', chat_id: 42 }), null);
});

test('транспорт: полный цикл — проверка токена, приём события, ответ пользователю', async () => {
  const fetchFn = fakeFetch([
    { body: { user_id: 1, name: 'Тест', username: 'test_bot' } },
    { body: { commands: [] } },
    { body: { updates: [{ update_type: 'bot_started', chat_id: 42, user: { user_id: 7 } }], marker: 10 } },
    { body: { message: {} } },
  ]);

  const originalFetch = fetchFn;
  let transport;
  const wrapped = async (url, init) => {
    const res = await originalFetch(url, init);
    if (new URL(url).pathname === '/messages') transport.stop();
    return res;
  };

  transport = await startMaxTransport({ token: TOKEN, fetchFn: wrapped });
  await transport.done;

  const paths = fetchFn.calls.map((c) => c.url.pathname);
  assert.deepEqual(paths, ['/me', '/me/commands', '/updates', '/messages']);
  const commands = fetchFn.calls[1];
  assert.equal(commands.init.method, 'PATCH');
  assert.ok(commands.body.commands.some((c) => c.name === 'start'));
  assert.ok(commands.body.commands.every((c) => !c.name.startsWith('/') && c.description));
  const send = fetchFn.calls[3];
  assert.equal(send.url.searchParams.get('chat_id'), '42');
  assert.match(send.body.text, /Досуг Казани/);
  assert.equal(send.body.attachments[0].type, 'inline_keyboard');
});

test('транспорт: если MAX не принял меню команд, бот всё равно запускается', async () => {
  const fetchFn = fakeFetch([
    { body: { user_id: 1, name: 'Тест', username: 'test_bot' } },
    { status: 400, body: { code: 'bad.request' } },
  ]);
  const warn = console.warn;
  console.warn = () => {};
  try {
    const transport = await startMaxTransport({ token: TOKEN, fetchFn });
    transport.stop();
    await transport.done;
  } finally {
    console.warn = warn;
  }
  assert.deepEqual(fetchFn.calls.slice(0, 2).map((c) => c.url.pathname), ['/me', '/me/commands']);
});

test('транспорт: невалидный токен (401) на старте — понятная ошибка, а не тихое зависание', async () => {
  const fetchFn = fakeFetch([{ status: 401, body: { code: 'verify.token' } }]);
  await assert.rejects(startMaxTransport({ token: 'bad', fetchFn }), (err) => err.status === 401);
});

test('клиент: кнопки open_app и request_geo_location передаются в формате MAX', async () => {
  const fetchFn = fakeFetch();
  const client = createMaxClient({ token: TOKEN, fetchFn });
  client.setBotUsername('dosug_bot');
  await client.sendMessage(1, {
    text: 'Меню',
    buttons: [
      [{ text: 'Вечер', openApp: 'prefs_today_free_none' }],
      [{ text: 'Без параметра', openApp: '' }],
      [{ text: 'Рядом', requestLocation: true }],
    ],
  });

  assert.deepEqual(fetchFn.calls[0].body.attachments[0].payload.buttons, [
    [{ type: 'open_app', text: 'Вечер', web_app: 'dosug_bot', payload: 'prefs_today_free_none' }],
    [{ type: 'open_app', text: 'Без параметра', web_app: 'dosug_bot' }],
    [{ type: 'request_geo_location', text: 'Рядом' }],
  ]);
});

test('клиент: личное сообщение пользователю уходит с user_id, а не chat_id', async () => {
  const fetchFn = fakeFetch();
  const client = createMaxClient({ token: TOKEN, fetchFn });
  await client.sendMessage({ userId: 77 }, { text: 'Привет', buttons: [] });
  const { url } = fetchFn.calls[0];
  assert.equal(url.searchParams.get('user_id'), '77');
  assert.equal(url.searchParams.has('chat_id'), false);
});

test('клиент: если MAX отклонил кнопку приложения (400), сообщение уходит без неё', async () => {
  const fetchFn = fakeFetch([{ status: 400, body: { code: 'proto.payload' } }, { body: { message: {} } }]);
  const client = createMaxClient({ token: TOKEN, fetchFn });
  await client.sendMessage(1, {
    text: 'Меню',
    buttons: [[{ text: 'Вечер', openApp: '' }], [{ text: 'Меню', action: 'menu:main' }]],
  });

  assert.equal(fetchFn.calls.length, 2);
  assert.deepEqual(fetchFn.calls[1].body.attachments[0].payload.buttons, [
    [{ type: 'callback', text: 'Меню', payload: 'menu:main' }],
  ]);
});

test('клиент: 400 для сообщения без особых кнопок не повторяется', async () => {
  const fetchFn = fakeFetch([{ status: 400, body: {} }]);
  const client = createMaxClient({ token: TOKEN, fetchFn });
  await assert.rejects(client.sendMessage(1, { text: 'Привет', buttons: [] }), (err) => err.status === 400);
  assert.equal(fetchFn.calls.length, 1);
});

test('клиент: при 429 подождёт и повторит запрос', async () => {
  const fetchFn = fakeFetch([{ status: 429, body: {} }, { body: { message: {} } }]);
  const pauses = [];
  const client = createMaxClient({ token: TOKEN, fetchFn, sleepFn: async (ms) => pauses.push(ms) });
  await client.sendMessage(1, { text: 'Привет', buttons: [] });
  assert.equal(fetchFn.calls.length, 2);
  assert.equal(pauses.length, 1);
});

test('клиент: 429 не повторяется бесконечно', async () => {
  const fetchFn = fakeFetch([{ status: 429 }, { status: 429 }, { status: 429 }, { status: 429 }]);
  const client = createMaxClient({ token: TOKEN, fetchFn, sleepFn: async () => {} });
  await assert.rejects(client.sendMessage(1, { text: 'Привет', buttons: [] }), (err) => err.status === 429);
  assert.equal(fetchFn.calls.length, 3);
});

test('транспорт: позиция long polling сохраняется в хранилище и используется после перезапуска', async () => {
  const store = createStore();
  store.state.marker = 5;
  const fetchFn = fakeFetch([
    { body: { user_id: 1, name: 'Тест', username: 'test_bot' } },
    { body: { commands: [] } },
    { body: { updates: [], marker: 9 } },
  ]);
  let transport;
  let polls = 0;
  const wrapped = async (url, init) => {
    const res = await fetchFn(url, init);
    if (new URL(url).pathname === '/updates' && ++polls === 2) transport.stop();
    return res;
  };

  transport = await startMaxTransport({ token: TOKEN, fetchFn: wrapped, store });
  await transport.done;

  const updates = fetchFn.calls.filter((call) => call.url.pathname === '/updates');
  assert.equal(updates[0].url.searchParams.get('marker'), '5', 'опрос продолжился с сохранённой позиции');
  assert.equal(updates[1].url.searchParams.get('marker'), '9', 'следующий опрос идёт с новой позиции');
  assert.equal(store.state.marker, 9, 'новая позиция записана в хранилище');
});
