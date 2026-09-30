import { cancelReminders } from './reminders.js';
import { createStore } from './store.js';

let store = createStore();

export function useStore(next) {
  store = next;
}

export const getStore = () => store;

export const commit = () => store.touch();

export function getSession(chatId) {
  const key = String(chatId);
  const { sessions } = store.state;
  sessions[key] = { userId: sessions[key]?.userId ?? null };
  return sessions[key];
}

export function deleteUserData(chatId) {
  const key = String(chatId);
  const userId = store.state.sessions[key]?.userId;
  delete store.state.sessions[key];
  if (userId != null) delete store.state.invites[String(userId)];
  cancelReminders(store, ({ target }) => {
    const ownChat = target.chatId != null && String(target.chatId) === key;
    const ownUser = userId != null && target.userId != null && String(target.userId) === String(userId);
    return ownChat || ownUser;
  });
  commit();
}
