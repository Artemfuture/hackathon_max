import IconSlot from './IconSlot.jsx';
import { cx } from '../lib/format.js';
import styles from './Row.module.css';

export default function CheckRow({ icon, title, hint, checked, onChange, tour }) {
  return (
    <label className={cx(styles.row, checked && styles.rowSelected)} data-tour={tour}>
      <IconSlot>{icon}</IconSlot>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.hint}>{hint}</span>
      </span>
      <input className={styles.checkInput} type="checkbox" checked={checked} onChange={onChange} />
      <span className={cx(styles.box, checked && styles.boxChecked)} aria-hidden="true">
        {checked && (
          <svg viewBox="0 0 22 22" width="22" height="22" fill="none">
            <path
              d="M5.5 11.5l3.8 3.8L16.5 7.5"
              stroke="#fafaff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </label>
  );
}
