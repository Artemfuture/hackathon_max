import Lumi from './Lumi.jsx';
import styles from './EmptyState.module.css';

export default function EmptyState({ title, text, actions, pose = 'sad' }) {
  return (
    <section className={styles.root}>
      <h2 className={styles.title}>{title}</h2>
      {text && <p className={styles.text}>{text}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
      <Lumi pose={pose} size={230} className={styles.lumi} />
    </section>
  );
}
