import readline from 'node:readline';
import { handleUpdate } from '../core/bot.js';
import { createReminderLoop } from '../reminders.js';
import { getStore } from '../state.js';

const CHAT_ID = 'console-user';
const COORDINATES = /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/;

export function startConsoleTransport() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('=== Досуг Казани — консольный режим (для локальной проверки сценария) ===');
  console.log('Введите /start, чтобы начать. Для выбора кнопки введите её номер.');
  console.log('Геолокацию можно «отправить» координатами, например: 55.79, 49.12\n');

  let lastButtons = [];

  function render(message) {
    console.log('\n----------------------------------------');
    console.log(message.text);
    lastButtons = (message.buttons || []).flat();
    lastButtons.forEach((btn, i) => {
      let suffix = '';
      if (btn.url) suffix = ` (ссылка: ${btn.url})`;
      else if (btn.openApp !== undefined) suffix = ' (откроет мини-приложение)';
      else if (btn.requestLocation) suffix = ' (запросит геолокацию)';
      console.log(`  [${i + 1}] ${btn.text}${suffix}`);
    });
    console.log('----------------------------------------');
    rl.prompt();
  }

  createReminderLoop({
    store: getStore(),
    send: async (_target, message) => render(message),
    intervalMs: 5000,
  }).start();

  rl.on('line', (line) => {
    const input = line.trim();
    const asIndex = Number(input);

    if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= lastButtons.length) {
      const btn = lastButtons[asIndex - 1];
      if (btn.url) {
        console.log(`(в реальном MAX-клиенте эта кнопка открыла бы ${btn.url})`);
        rl.prompt();
        return;
      }
      if (btn.openApp !== undefined) {
        const launch = btn.openApp ? `, параметр запуска: ${btn.openApp}` : '';
        console.log(`(в реальном MAX-клиенте откроется мини-приложение${launch})`);
        rl.prompt();
        return;
      }
      if (btn.requestLocation) {
        console.log('(MAX-клиент отправил бы вашу геолокацию; здесь введите координаты, например: 55.79, 49.12)');
        rl.prompt();
        return;
      }
      render(handleUpdate(CHAT_ID, { type: 'callback', action: btn.action }));
      return;
    }

    const coordinates = COORDINATES.exec(input);
    if (coordinates) {
      render(handleUpdate(CHAT_ID, { type: 'location', latitude: Number(coordinates[1]), longitude: Number(coordinates[2]) }));
      return;
    }

    render(handleUpdate(CHAT_ID, { type: 'text', text: input }));
  });

  rl.on('close', () => process.exit(0));
  rl.prompt();
}
