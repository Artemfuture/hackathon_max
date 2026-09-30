import { useEffect } from 'react';
import styles from './Toast.module.css';

export default function Toast({ message, onHide }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onHide, 2600);
    return () => clearTimeout(timer);
  }, [message, onHide]);

  if (!message) return null;
  return (
    <div className={styles.toast} role="status">
      {message}
    </div>
  );
}
