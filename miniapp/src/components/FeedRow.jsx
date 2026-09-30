import { CalendarIcon, PinIcon, PlusIcon, legIcon } from './icons.jsx';
import { cx, priceLabel } from '../lib/format.js';
import { isFlexible } from '../lib/planner.js';
import styles from './FeedRow.module.css';

export function whenText(event, day) {
  if (!isFlexible(event)) return `${day}, ${event.start}`;
  const close = event.hours.close === '24:00' ? '24:00' : event.hours.close;
  return `${day}, ${event.hours.open}–${close}`;
}

export default function FeedRow({ event, price, reach, day, inPlan = false, onOpen, onAdd }) {
  const leg = reach?.leg;
  const where = event.place && event.place !== event.title ? event.place : (event.address ?? event.kind);
  return (
    <article className={styles.row}>
      <button type="button" className={styles.open} onClick={onOpen} aria-label={`Подробнее: ${event.title}`}>
        <img
          className={styles.photo}
          src={event.photo}
          style={{ objectPosition: event.focus }}
          alt=""
          loading="lazy"
          onError={(error) => {
            if (event.cover && error.currentTarget.src !== event.cover) error.currentTarget.src = event.cover;
          }}
        />
        <span className={styles.body}>
          <span className={styles.title}>{event.title}</span>
          <span className={styles.line}>
            <CalendarIcon size={14} />
            <span>{whenText(event, day)}</span>
          </span>
          <span className={styles.line}>
            <PinIcon size={14} />
            <span className={styles.where}>{where}</span>
            {leg && (
              <span className={styles.leg}>
                · {legIcon(leg.mode, { size: 12 })}
                {leg.minutes} мин
              </span>
            )}
          </span>
          <span className={styles.price}>{priceLabel(event, price)}</span>
        </span>
      </button>
      <button
        type="button"
        className={cx(styles.add, inPlan && styles.added)}
        onClick={onAdd}
        aria-label={inPlan ? 'Уже в плане' : `Добавить в план: ${event.title}`}
      >
        <span className={styles.plus}>{inPlan ? '✓' : <PlusIcon size={22} />}</span>
        <span className={styles.addLabel}>{inPlan ? 'В плане' : 'В план'}</span>
      </button>
    </article>
  );
}
