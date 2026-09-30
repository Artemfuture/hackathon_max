import { cx } from '../lib/format.js';
import styles from './MiniTimeline.module.css';

export default function MiniTimeline({ stops, start, end, size = 'sm' }) {
  const columns = { '--n': stops.length };
  return (
    <div className={cx(styles.root, styles[size])}>
      <div className={styles.times}>
        <span>{start}</span>
        <span>{end}</span>
      </div>
      <div className={styles.track} style={columns}>
        {stops.map((stop, index) => (
          <span key={index} className={styles.dot} />
        ))}
      </div>
      <div className={styles.labels} style={columns}>
        {stops.map((stop, index) => (
          <div key={index} className={styles.label} title={[stop.title, stop.subtitle].filter(Boolean).join(' — ')}>
            <span className={styles.name}>{stop.title}</span>
            {stop.subtitle && <span className={styles.sub}>{stop.subtitle}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
