import { cx } from '../lib/format.js';
import styles from './TileGroup.module.css';

export default function TileGroup({ label, options, selected, onChange, size = 'sm', tour }) {
  return (
    <fieldset className={styles.group} data-tour={tour}>
      <legend className={styles.label}>{label}</legend>
      <div className={styles.tiles} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={cx(styles.tile, styles[size], option.id === selected && styles.selected)}
            aria-pressed={option.id === selected}
            disabled={option.disabled}
            onClick={() => onChange(option.id)}
          >
            <span className={styles.value}>{option.label}</span>
            {option.sub && <span className={styles.sub}>{option.sub}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
