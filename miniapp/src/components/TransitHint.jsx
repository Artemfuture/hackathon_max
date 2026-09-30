import { ExternalIcon, legIcon } from './icons.jsx';
import { openExternal } from '../bridge.js';
import { yandexGoUrl, yandexMapsRouteUrl } from '../lib/planner.js';
import styles from './TransitHint.module.css';

const MODE_TEXT = { walk: 'пешком', taxi: 'на такси', transit: 'на транспорте' };

export default function TransitHint({ leg, from, to, compact = false }) {
  if (!leg) return null;
  const taxi = leg.mode === 'taxi';
  const href = taxi ? yandexGoUrl(from, to) : yandexMapsRouteUrl([from, to], leg.mode);
  const alternative = taxi ? `пешком ${leg.walk} мин` : leg.walk > 12 ? `на такси ~${leg.taxi} мин` : null;

  const open = (event) => {
    event.preventDefault();
    openExternal(href);
  };

  return (
    <div className={compact ? styles.compact : styles.hint}>
      <span className={styles.icon}>{legIcon(leg.mode, { size: 15 })}</span>
      <span className={styles.label}>
        {leg.minutes} мин {MODE_TEXT[leg.mode]}
        {alternative && <span className={styles.alt}> · {alternative}</span>}
      </span>
      <a className={styles.action} href={href} target="_blank" rel="noopener noreferrer" onClick={open}>
        {taxi ? 'Яндекс Go' : 'Маршрут'}
        <ExternalIcon />
      </a>
    </div>
  );
}
