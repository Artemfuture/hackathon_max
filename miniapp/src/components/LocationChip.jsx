import { PinIcon } from './icons.jsx';
import styles from './LocationChip.module.css';

export default function LocationChip({ origin, onClick }) {
  return (
    <button
      type="button"
      className={styles.chip}
      onClick={onClick}
      data-tour="location"
      aria-label="Изменить, откуда начинаем"
    >
      <PinIcon size={16} />
      <span className={styles.label}>{origin?.label ?? 'Откуда?'}</span>
    </button>
  );
}
