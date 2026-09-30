import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const VERSION = 1;

const emptyState = () => ({
  version: VERSION,
  sessions: {},
  reminders: [],
  invites: {},
  marker: null,
  metrics: {},
});

export function createStore({ file = null, flushDelayMs = 200, log = console } = {}) {
  let dirty = false;
  let timer = null;

  function load() {
    if (!file) return emptyState();

    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') return emptyState();
      throw err;
    }

    try {
      const parsed = JSON.parse(text);
      if (parsed?.version !== VERSION) throw new Error(`неизвестная версия ${parsed?.version}`);
      return { ...emptyState(), ...parsed };
    } catch (err) {
      const backup = `${file}.broken-${Date.now()}`;
      renameSync(file, backup);
      log.warn(`Файл состояния повреждён (${err.message}). Сохранён как ${backup}, начинаю с чистого состояния.`);
      return emptyState();
    }
  }

  const state = load();

  function writeNow() {
    if (!file || !dirty) return;
    mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.tmp`;
    writeFileSync(temp, JSON.stringify(state));
    renameSync(temp, file);
    dirty = false;
  }

  return {
    state,

    touch() {
      dirty = true;
      if (!file || timer) return;
      timer = setTimeout(() => {
        timer = null;
        try {
          writeNow();
        } catch (err) {
          log.error('Не удалось сохранить состояние:', err.message);
        }
      }, flushDelayMs);
      timer.unref?.();
    },

    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      writeNow();
    },
  };
}
