import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './Sheet.module.css';

export default function Sheet({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className={styles.root} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className={styles.backdrop} aria-label="Закрыть" onClick={onClose} />
      <div className={styles.panel}>
        <span className={styles.grip} aria-hidden="true" />
        {title && <h2 className={styles.title}>{title}</h2>}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
