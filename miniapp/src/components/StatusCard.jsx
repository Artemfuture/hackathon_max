import { AlertIcon, CheckIcon, ClockIcon } from './icons.jsx';
import { cx } from '../lib/format.js';
import styles from './StatusCard.module.css';

export default function StatusCard({ tone = 'ok', title, text, children }) {
  const Icon = tone === 'ok' ? CheckIcon : tone === 'info' ? ClockIcon : AlertIcon;
  return (
    <div className={cx(styles.card, styles[tone])} role="status">
      <span className={styles.icon}>
        <Icon size={18} strokeWidth="2.4" />
      </span>
      <div className={styles.text}>
        <p className={styles.title}>{title}</p>
        {text && <p className={styles.sub}>{text}</p>}
      </div>
      {children}
    </div>
  );
}
