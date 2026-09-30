import { track } from '../metrics.js';
import { commit, deleteUserData, getSession, getStore } from '../state.js';
import {
  renderAbout,
  renderAppPrompt,
  renderDeleteConfirm,
  renderDeleted,
  renderLocationReply,
  renderStats,
  renderWelcome,
} from './messages.js';
import { scheduleTestReminder } from './testReminder.js';

export const BOT_COMMANDS = [
  { name: 'start', description: 'Открыть приложение «Досуг Казани»' },
  { name: 'help', description: 'Как это работает и какие данные хранятся' },
  { name: 'delete', description: 'Удалить мои данные' },
  { name: 'stats', description: 'Анонимная статистика бота' },
];

const COMMANDS = {
  '/start': (chatId, session, now) => {
    track(getStore(), 'start', now);
    return renderWelcome();
  },
  '/help': () => renderAbout(),
  'помощь': () => renderAbout(),
  '/delete': () => renderDeleteConfirm(),
  '/stats': (chatId, session, now) => renderStats(now),
  '/remind_test': (chatId, session, now) => scheduleTestReminder(chatId, session, now),
};

const ACTIONS = {
  'menu:about': () => renderAbout(),
  'menu:delete': () => renderDeleteConfirm(),
  'delete:yes': (chatId) => {
    deleteUserData(chatId);
    return renderDeleted();
  },
};

export function handleUpdate(chatId, update, ctx = {}) {
  try {
    return dispatch(chatId, update, ctx);
  } finally {
    commit();
  }
}

function dispatch(chatId, update, ctx) {
  const now = ctx.now ?? Date.now();
  const session = getSession(chatId);
  if (ctx.userId != null) session.userId = ctx.userId;

  if (update.type === 'location') {
    track(getStore(), 'geo', now);
    return renderLocationReply({ lat: update.latitude, lon: update.longitude });
  }

  const handler =
    update.type === 'text' ? COMMANDS[update.text.trim().toLowerCase()] : ACTIONS[update.action];
  return handler ? handler(chatId, session, now) : renderAppPrompt();
}
