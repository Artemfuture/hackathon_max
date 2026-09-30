import { useEffect, useState } from 'react';
import Lumi from '../components/Lumi.jsx';
import Screen from '../components/Screen.jsx';
import { cx } from '../lib/format.js';
import styles from './LoadingScreen.module.css';

const STEPS = ['Ищу подходящие события', 'Проверяю время и маршруты', 'Собираю лучший вариант'];
const STEP_MS = 650;

export default function LoadingScreen({ onDone }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      onDone();
      return undefined;
    }
    const timer = setTimeout(() => setStep((value) => value + 1), step === STEPS.length - 1 ? STEP_MS + 150 : STEP_MS);
    return () => clearTimeout(timer);
  }, [step, onDone]);

  const current = Math.min(step, STEPS.length - 1);
  return (
    <Screen bare>
      <div className={styles.root} aria-live="polite">
        <h1 className={styles.title}>Собираю ваш план</h1>
        <p className={styles.text}>Проверяю варианты и собираю их в маршрут</p>
        <Lumi pose="fly" size={260} className={styles.lumi} />
        <div className={styles.progress}>
          <span className={styles.track}>
            <span className={styles.fill} style={{ width: `${(current / (STEPS.length - 1)) * 100}%` }} />
          </span>
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={cx(
                styles.point,
                index < step && styles.done,
                index === current && step < STEPS.length && styles.now
              )}
            >
              {index < step ? '✓' : ''}
            </span>
          ))}
        </div>
        <p className={styles.stepLabel}>{STEPS[current]}</p>
      </div>
    </Screen>
  );
}
