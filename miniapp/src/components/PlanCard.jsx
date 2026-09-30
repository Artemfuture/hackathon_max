import Button from './Button.jsx';
import MiniTimeline from './MiniTimeline.jsx';
import { legIcon } from './icons.jsx';
import { formatDuration, formatPrice, toClock } from '../lib/format.js';
import styles from './PlanCard.module.css';

export default function PlanCard({ plan, onOpen, tour }) {
  const road = plan.travelMin + (plan.firstLeg?.minutes ?? 0);
  const mode = plan.taxiMin > 0 || plan.firstLeg?.mode === 'taxi' ? 'taxi' : 'walk';
  return (
    <article className={styles.card} data-tour={tour}>
      <button type="button" className={styles.covers} onClick={onOpen} aria-label="Посмотреть план">
        {plan.stops.map((stop) => (
          <img
            key={stop.item.id}
            src={stop.item.photo}
            style={{ objectPosition: stop.item.focus }}
            alt=""
            loading="lazy"
          />
        ))}
        {plan.label && <span className={styles.label}>{plan.label}</span>}
      </button>
      <div className={styles.body}>
        <MiniTimeline
          size="sm"
          start={toClock(plan.start)}
          end={toClock(plan.end)}
          stops={plan.stops.map((stop) => ({ title: stop.item.kind }))}
        />
        <p className={styles.metrics}>
          <span>{formatDuration(plan.durationMin)}</span>
          <span>{plan.price === 0 ? 'бесплатно' : `${formatPrice(plan.price)}/чел`}</span>
          <span className={styles.road}>
            {legIcon(mode, { size: 12 })}
            {road} мин
          </span>
        </p>
        <Button variant="card" onClick={onOpen}>
          Посмотреть план
        </Button>
      </div>
    </article>
  );
}
