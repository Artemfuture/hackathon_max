import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.js';
import { createReminderLoop } from './reminders.js';
import { setExternalEvents } from './data/events.js';
import { createWebServer } from './server.js';
import { createKudago } from './sources/kudago.js';
import { weather } from './weather.js';
import { useStore } from './state.js';
import { createStore } from './store.js';
import { startConsoleTransport } from './transports/consoleTransport.js';
import { describeError, startMaxTransport } from './transports/maxTransport.js';

try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const TRANSPORT = process.argv.includes('--console') ? 'console' : process.env.TRANSPORT || 'max';
const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = process.env.STATE_FILE || path.join(projectRoot, 'state', 'state.json');

if (!/^(0|off|false|no)$/i.test(process.env.KUDAGO ?? '')) {
  const kudago = createKudago({
    location: process.env.KUDAGO_LOCATION || 'kzn',
    file: path.join(path.dirname(stateFile), 'kudago.json'),
    onUpdate: (items) => setExternalEvents(items, { updatedAt: kudago.updatedAt() }),
  });
  setExternalEvents(kudago.snapshot(), { updatedAt: kudago.updatedAt() });
  kudago.refresh();
  setInterval(() => kudago.refresh(), 3 * 60 * 60_000).unref();
}

if (TRANSPORT === 'console') {
  startConsoleTransport();
} else {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) {
    console.error(
      'MAX_BOT_TOKEN не задан. Укажите токен бота, выданный организаторами, в .env, ' +
        'либо запустите локальный режим командой: npm run dev:console'
    );
    process.exit(1);
  }

  const baseUrl = process.env.MAX_API_BASE_URL || undefined;
  const port = Number(process.env.PORT) || 3000;
  const miniappDir = process.env.MINIAPP_DIR || path.join(projectRoot, 'miniapp', 'dist');
  const leadMinutes = Number(process.env.REMINDER_LEAD_MINUTES) || 60;
  const checkSeconds = Number(process.env.REMINDER_CHECK_SECONDS) || 30;

  const store = createStore({ file: stateFile });
  useStore(store);

  let maxClient = null;
  const notify = (target, message) =>
    maxClient ? maxClient.sendMessage(target, message) : Promise.reject(new Error('MAX ещё не подключён'));

  const api = createApi({ botToken: token, notify, store, leadMinutes, weather });

  weather.refresh().then((cache) => cache || setTimeout(() => weather.refresh(), 60_000).unref());
  setInterval(() => weather.refresh(), 30 * 60_000).unref();

  createWebServer({ rootDir: miniappDir, api }).listen(port, () =>
    console.log(`Мини-приложение: http://localhost:${port} (проверка: /healthz)`)
  );

  const reminders = createReminderLoop({
    store,
    send: notify,
    intervalMs: checkSeconds * 1000,
  });

  startMaxTransport({ token, baseUrl, store })
    .then(({ client, done }) => {
      maxClient = client;
      reminders.start();
      return done;
    })
    .catch((err) => {
      console.error('MAX-транспорт остановлен:', describeError(err));
      if (err.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY') {
        console.error(
          'Подсказка: положите корневой сертификат Минцифры в certs/russian_trusted_root_ca.pem (см. README).'
        );
      }
      store.flush();
      process.exit(1);
    });

  const shutdown = () => {
    store.flush();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
