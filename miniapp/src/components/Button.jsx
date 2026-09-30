import { cx } from '../lib/format.js';
import styles from './Button.module.css';

export default function Button({ variant = 'primary', className, type = 'button', ...props }) {
  return <button type={type} className={cx(styles.button, styles[variant], className)} {...props} />;
}
