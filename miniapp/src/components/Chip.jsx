import { cx } from '../lib/format.js';
import styles from './Chip.module.css';

export default function Chip({ children, className }) {
  return <span className={cx(styles.chip, className)}>{children}</span>;
}
