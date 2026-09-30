import { useCallback, useEffect, useRef, useState } from 'react';
import { haptic, setBackButton } from '../bridge.js';

const TAB_ROOT = { home: 'home', find: 'find', build: 'when', plans: 'plans' };
const ROOT_TAB = Object.fromEntries(Object.entries(TAB_ROOT).map(([tab, screen]) => [screen, tab]));

export function useNavigation(initial, { onLeave }) {
  const [stack, setStack] = useState(initial);
  const screen = stack[stack.length - 1];
  const tab = ROOT_TAB[stack[0]] ?? 'home';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const go = (name) => {
    haptic('impact');
    setStack((current) => [...current, name]);
  };

  const replaceTop = useCallback((name) => setStack((current) => [...current.slice(0, -1), name]), []);

  const reset = (names) => {
    onLeave();
    setStack(names);
  };

  const goHome = () => reset(['home']);

  const switchTab = (next) => {
    haptic();
    reset([TAB_ROOT[next]]);
  };

  const back = () => (stack.length > 1 ? setStack((current) => current.slice(0, -1)) : goHome());

  const backTo = (name) =>
    setStack((current) => {
      const index = current.lastIndexOf(name);
      return index >= 0 ? current.slice(0, index + 1) : current;
    });

  const backRef = useRef(back);
  backRef.current = back;
  const canGoBack = !(stack.length === 1 && screen === 'home');
  useEffect(() => setBackButton(canGoBack ? () => backRef.current() : null), [canGoBack]);

  const has = (name) => stack.includes(name);

  return { stack, screen, tab, has, go, replaceTop, open: setStack, reset, goHome, switchTab, back, backTo };
}
