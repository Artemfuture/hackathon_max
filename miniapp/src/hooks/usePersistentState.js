import { useEffect, useState } from 'react';

export function usePersistentState(key, initial, sanitize = (value) => value, adjust = (value) => value) {
  const [value, setValue] = useState(() => {
    let stored = initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) stored = sanitize(JSON.parse(raw));
    } catch {}
    return adjust(stored);
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue];
}
