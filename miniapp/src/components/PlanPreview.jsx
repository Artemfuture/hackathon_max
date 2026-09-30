import Collage from './Collage.jsx';
import MiniTimeline from './MiniTimeline.jsx';
import { cx, formatDuration, formatPrice, toClock } from '../lib/format.js';
import styles from './PlanPreview.module.css';

export default function PlanPreview({ plan, collageGap = 30, tone = 'muted' }) {
  return (
    <>
      <div className={styles.collage} style={{ marginTop: collageGap }}>
        <Collage photos={plan.stops.map((stop) => ({ src: stop.item.photo, crop: stop.item.crop }))} />
      </div>

      <div className={styles.timeline}>
        <MiniTimeline
          size="lg"
          start={toClock(plan.start)}
          end={toClock(plan.end)}
          stops={plan.stops.map((stop) => ({ title: stop.item.kind, subtitle: shorten(stop.item.title) }))}
        />
      </div>

      <p className={cx(styles.metrics, tone === 'dark' && styles.dark)}>
        <span>{formatDuration(plan.durationMin)}</span>
        <span>{plan.price === 0 ? 'бесплатно' : `${formatPrice(plan.price)}/чел`}</span>
      </p>
    </>
  );
}

const shorten = (title) => (title.length > 18 ? `${title.slice(0, 17)}…` : title);
