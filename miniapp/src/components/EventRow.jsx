import { legIcon } from './icons.jsx';
import { reachLabel, whenLabel } from './EventCard.jsx';
import { cx, priceLabel } from '../lib/format.js';
import styles from './EventRow.module.css';

export default function EventRow({ event, price, reach, note, actionLabel, onAction, onOpen, dimmed = false }) {
  const status = reachLabel(reach);
  return (
    <article className={cx(styles.row, dimmed && styles.dimmed)}>
      <button type="button" className={styles.open} onClick={onOpen}>
        <img className={styles.thumb} src={event.photo} style={{ objectPosition: event.focus }} alt="" loading="lazy" />
        <span className={styles.body}>
          <span className={styles.top}>
            <span className={styles.kind}>{event.kind}</span>
            <span className={styles.time}>{whenLabel(event)}</span>
          </span>
          <span className={styles.title}>{event.title}</span>
          <span className={styles.meta}>
            <span className={styles.price}>{priceLabel(event, price)}</span>
            {reach?.leg && (
              <span className={styles.leg}>
                {legIcon(reach.leg.mode, { size: 12 })}
                {reach.leg.minutes} мин
              </span>
            )}
            {status && <span className={cx(styles.status, styles[status.tone])}>{status.text}</span>}
          </span>
          {note && <span className={styles.note}>{note}</span>}
        </span>
      </button>
      {onAction && (
        <button type="button" className={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </article>
  );
}
