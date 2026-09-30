import styles from './Avatar.module.css';

export default function Avatar({ name }) {
  const letter = [...name.trim()][0]?.toUpperCase() ?? '?';
  return (
    <span className={styles.avatar} aria-hidden="true">
      {letter}
    </span>
  );
}
