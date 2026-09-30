import { findReminder, scheduleReminder } from '../reminders.js';
import { getStore } from '../state.js';

const MINUTE = 60_000;
const openApp = [[{ text: '🎉 Открыть «Досуг Казани»', openApp: '' }]];

export function scheduleTestReminder(chatId, session, now) {
  const planned = session.userId != null ? findReminder(getStore(), `plan:${session.userId}`) : null;
  if (!planned) {
    return {
      text:
        'Сначала выбери вечер в приложении — после этого /remind_test через минуту пришлёт, ' +
        'как будет выглядеть напоминание о нём.',
      buttons: openApp,
    };
  }
  scheduleReminder(getStore(), {
    key: `test:${chatId}`,
    target: { chatId },
    at: now + MINUTE,
    text: `🧪 Тестовое напоминание (команда /remind_test)\n\n${planned.text}`,
    buttons: planned.buttons,
  });
  return {
    text: 'Готово: тестовое напоминание придёт примерно через минуту — так выглядит настоящее.',
    buttons: openApp,
  };
}
