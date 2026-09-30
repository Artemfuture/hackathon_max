import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LUMI_POSES } from './Lumi.jsx';
import { markTour, tourDone } from '../lib/tour.js';
import styles from './LumiTour.module.css';

const PAD = 8;
const GAP = 14;
const EDGE = 12;

function measure(target) {
  if (!target) return null;
  const node = document.querySelector(`[data-tour="${target}"]`);
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return null;
  return {
    top: Math.max(EDGE, rect.top - PAD),
    left: Math.max(EDGE, rect.left - PAD),
    width: Math.min(window.innerWidth - EDGE * 2, rect.width + PAD * 2),
    height: rect.height + PAD * 2,
  };
}

export default function LumiTour({ id, steps, enabled = true, delay = 450 }) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState(null);
  const [panelH, setPanelH] = useState(220);
  const panelRef = useRef(null);
  const step = steps[index];

  useEffect(() => {
    if (!enabled || tourDone(id)) return undefined;
    const timer = setTimeout(() => setActive(true), delay);
    return () => clearTimeout(timer);
  }, [enabled, id, delay]);

  const finish = useCallback(() => {
    markTour(id);
    setActive(false);
  }, [id]);

  useLayoutEffect(() => {
    if (!active || !step) return undefined;
    const node = step.target && document.querySelector(`[data-tour="${step.target}"]`);
    if (node) node.scrollIntoView({ block: 'center', behavior: 'instant' });
    const refresh = () => setHole(measure(step.target));
    refresh();
    const raf = requestAnimationFrame(refresh);
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [active, step]);

  useLayoutEffect(() => {
    if (panelRef.current) setPanelH(panelRef.current.getBoundingClientRect().height);
  }, [active, index, hole]);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event) => event.key === 'Escape' && finish();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, finish]);

  if (!active || !step) return null;

  const isLast = index === steps.length - 1;
  let panelStyle;
  if (hole) {
    const below = window.innerHeight - (hole.top + hole.height);
    panelStyle =
      below >= panelH + GAP || below >= hole.top
        ? { top: Math.min(hole.top + hole.height + GAP, window.innerHeight - panelH - EDGE) }
        : { top: Math.max(EDGE, hole.top - panelH - GAP) };
  }

  return createPortal(
    <div className={styles.root} role="dialog" aria-modal="true" aria-label={`Подсказка Люми: ${step.title}`}>
      {hole ? <div className={styles.hole} style={hole} /> : <div className={styles.dim} />}
      <div ref={panelRef} className={hole ? styles.panel : styles.panelCenter} style={panelStyle}>
        <img key={step.pose} className={styles.lumi} src={LUMI_POSES[step.pose] ?? LUMI_POSES.hello} alt="" />
        <div className={styles.bubble}>
          <p className={styles.kicker}>Люми</p>
          <h2 className={styles.title}>{step.title}</h2>
          <p className={styles.text}>{step.text}</p>
          <div className={styles.footer}>
            <div className={styles.dots} aria-label={`Шаг ${index + 1} из ${steps.length}`}>
              {steps.map((item, i) => (
                <span key={item.title} className={i === index ? styles.dotActive : styles.dot} />
              ))}
            </div>
            <button type="button" className={styles.skip} onClick={finish}>
              Пропустить
            </button>
            <button type="button" className={styles.next} onClick={() => (isLast ? finish() : setIndex(index + 1))}>
              {isLast ? 'Понятно' : 'Дальше'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
