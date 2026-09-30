const MINUTE = 60_000;
const LAST_CALL_MIN = 10;
const SOON_MS = MINUTE;

export function reminderTime(startsAt, now, lead) {
  let at = startsAt - lead * MINUTE;
  if (at < now + SOON_MS) at = startsAt - LAST_CALL_MIN * MINUTE;
  return at >= now + SOON_MS ? at : null;
}

export function scheduleReminder(store, reminder) {
  const list = store.state.reminders;
  const entry = { attempts: 0, ...reminder };
  const index = list.findIndex((item) => item.key === reminder.key);
  if (index === -1) list.push(entry);
  else list[index] = entry;
  store.touch();
}

export function cancelReminders(store, predicate) {
  const before = store.state.reminders.length;
  store.state.reminders = store.state.reminders.filter((reminder) => !predicate(reminder));
  const removed = before - store.state.reminders.length;
  if (removed > 0) store.touch();
  return removed;
}

export const findReminder = (store, key) => store.state.reminders.find((reminder) => reminder.key === key) ?? null;

export function createReminderLoop({
  store,
  send,
  now = Date.now,
  intervalMs = 30_000,
  maxLateMs = 6 * 60 * MINUTE,
  maxAttempts = 3,
  log = console,
}) {
  let timer = null;
  let busy = false;

  const drop = (reminder) => cancelReminders(store, (item) => item.key === reminder.key);

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const current = now();
      const due = store.state.reminders.filter((reminder) => reminder.at <= current);
      for (const reminder of due) {
        if (current - reminder.at > maxLateMs) {
          log.warn(`Напоминание ${reminder.key} просрочено больше чем на ${maxLateMs / MINUTE} мин — пропущено.`);
          drop(reminder);
          continue;
        }
        try {
          await send(reminder.target, { text: reminder.text, buttons: reminder.buttons });
          drop(reminder);
        } catch (err) {
          reminder.attempts = (reminder.attempts ?? 0) + 1;
          if (reminder.attempts >= maxAttempts) {
            log.error(`Напоминание ${reminder.key} не отправлено после ${maxAttempts} попыток: ${err.message}`);
            drop(reminder);
          } else {
            log.warn(`Напоминание ${reminder.key}: ошибка отправки (${err.message}), повторю позже.`);
            store.touch();
          }
        }
      }
    } finally {
      busy = false;
    }
  }

  return {
    tick,
    start() {
      if (timer) return;
      const run = () => tick().catch((err) => log.error('Ошибка планировщика:', err));
      timer = setInterval(run, intervalMs);
      timer.unref?.();
      run();
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}
