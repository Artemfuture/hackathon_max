import { CalendarIcon, ChevronUpIcon } from './icons.jsx';
import { formatPrice, plural } from '../lib/format.js';
import styles from './MyPlanBar.module.css';

export default function MyPlanBar({ plan, dayText, onOpen }) {
  if (!plan) return null;
  const count = plan.stops.length;
  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <span className={styles.icon}>
          <CalendarIcon size={20} />
          <span className={styles.badge}>{count}</span>
        </span>
        <span className={styles.text}>
          <span className={styles.title}>Мой план{dayText ? ` · ${dayText}` : ''}</span>
          <span className={styles.meta}>
            {count} {plural(count, 'точка', 'точки', 'точек')} · {plan.price === 0 ? 'бесплатно' : formatPrice(plan.price)}
          </span>
        </span>
        <button type="button" className={styles.open} onClick={onOpen}>
          Открыть <ChevronUpIcon size={16} />
        </button>
      </div>
    </div>
  );
}
