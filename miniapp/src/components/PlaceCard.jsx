import Button from './Button.jsx';
import { markOf } from './FindMap.jsx';
import { whenText } from './FeedRow.jsx';
import { CloseIcon, PlusIcon, RouteIcon, legIcon } from './icons.jsx';
import { priceLabel } from '../lib/format.js';
import styles from './PlaceCard.module.css';

export default function PlaceCard({ item, dayLabel, siblings, inPlan, onSelect, onOpen, onRoute, onAdd, onClose }) {
  const { event, price, reach } = item;

  return (
    <article className={styles.card}>
      <button type="button" className={styles.cardClose} onClick={onClose} aria-label="Закрыть">
        <CloseIcon size={16} />
      </button>
      <button type="button" className={styles.cardOpen} onClick={onOpen}>
        <img
          className={styles.cardPhoto}
          src={event.photo}
          alt=""
          onError={(error) => {
            if (event.cover && error.currentTarget.src !== event.cover) error.currentTarget.src = event.cover;
          }}
        />
        <span className={styles.cardBody}>
          <span className={styles.cardKind} style={{ color: markOf(event.category).color }}>
            {event.kind}
          </span>
          <span className={styles.cardTitle}>{event.title}</span>
          <span className={styles.cardMeta}>{whenText(event, dayLabel)}</span>
          <span className={styles.cardMeta}>
            {reach.leg && (
              <>
                {legIcon(reach.leg.mode, { size: 12 })} {reach.leg.minutes} мин ·{' '}
              </>
            )}
            <b>{priceLabel(event, price)}</b>
          </span>
        </span>
      </button>
      {siblings.length > 0 && (
        <div className={styles.siblings}>
          <span>Ещё здесь:</span>
          {siblings.slice(0, 6).map(({ event: other }) => (
            <button key={other.id} type="button" onClick={() => onSelect(other.id)}>
              {other.group ? `${other.start} · ${other.group.ages}` : other.title}
            </button>
          ))}
        </div>
      )}
      <div className={styles.cardActions}>
        <button type="button" className={styles.routeButton} onClick={onRoute} aria-label="Маршрут на карте">
          <RouteIcon size={22} />
        </button>
        <Button variant="secondary" onClick={onOpen}>
          Подробнее
        </Button>
        <Button onClick={onAdd}>
          {inPlan ? (
            '✓ В плане'
          ) : (
            <>
              <PlusIcon size={18} /> В план
            </>
          )}
        </Button>
      </div>
    </article>
  );
}
