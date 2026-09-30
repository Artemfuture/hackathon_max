import styles from './IconSlot.module.css';

export default function IconSlot({ children }) {
  return (
    <span className={styles.slot} aria-hidden="true">
      {children ? <span className={styles.emoji}>{children}</span> : <span className={styles.placeholder} />}
    </span>
  );
}
