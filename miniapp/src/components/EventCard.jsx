import Button from './Button.jsx';
import { legIcon } from './icons.jsx';
import { cx, priceLabel, toClock } from '../lib/format.js';
import { toMin } from '../lib/planner.js';
import styles from './EventCard.module.css';

export function whenLabel(event) {
  return event.start ? event.start : `до ${event.hours.close === '24:00' ? '24:00' : event.hours.close}`;
}

export function reachLabel(reach) {
  if (!reach?.status) return null;
  if (reach.status === 'late') return { tone: 'late', text: 'Не успеваете' };
  if (reach.open) return { tone: reach.status, text: reach.status === 'tight' ? 'Скоро закроется' : 'Открыто сейчас' };
  if (reach.opensAt != null) return { tone: 'ok', text: `Откроется в ${toClock(reach.opensAt)}` };
  return reach.status === 'tight' ? { tone: 'tight', text: 'Впритык' } : { tone: 'ok', text: 'Успеваете' };
}

export default function EventCard({ event, price, reach, dateLabel, actionLabel, onAction, onOpen }) {
  const status = reachLabel(reach);
  const leg = reach?.leg;
  return (
    <article className={cx(styles.card, styles.carousel)}>
      <button type="button" className={styles.openArea} onClick={onOpen} aria-label={`Подробнее: ${event.title}`}>
        <img className={styles.cover} src={event.photo} style={{ objectPosition: event.focus }} alt="" loading="lazy" />
        {status && <span className={cx(styles.status, styles[status.tone])}>{status.text}</span>}
      </button>
      <div className={styles.body}>
        <div className={styles.head}>
          <h3 className={styles.kind}>{event.kind}</h3>
          <span className={styles.price}>{priceLabel(event, price)}</span>
        </div>
        <p className={styles.title}>{event.title}</p>
        <p className={styles.meta}>
          <span>
            {dateLabel} · {whenLabel(event)}
          </span>
          {leg && (
            <span className={styles.leg}>
              {legIcon(leg.mode, { size: 12 })}
              {leg.minutes} мин
            </span>
          )}
          {event.pushkin && <span className={styles.pushkin}>Пушкинская</span>}
        </p>
        {onAction && (
          <Button variant="cardSm" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </article>
  );
}

export const startMinutes = (event) => (event.start ? toMin(event.start) : toMin(event.hours.open));
