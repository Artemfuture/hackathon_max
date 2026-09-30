import { useRef } from 'react';
import { CalendarIcon } from './icons.jsx';
import { useDragScroll } from '../hooks/useDragScroll.js';
import { isoForOffset } from '../lib/clock.js';
import { cx } from '../lib/format.js';
import styles from './DateStrip.module.css';

const label = (iso, offset) => {
  const date = new Date(`${iso}T12:00:00Z`);
  const weekday =
    offset === 0
      ? 'Сегодня'
      : offset === 1
        ? 'Завтра'
        : date.toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
  const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
  return { weekday, day };
};

export default function DateStrip({ days = 14, selected, marks = new Set(), allLabel, onPick, onCalendar }) {
  const list = Array.from({ length: days }, (_, offset) => ({ iso: isoForOffset(offset), offset }));
  const beyond = selected && !list.some((item) => item.iso === selected);
  const strip = useRef(null);
  useDragScroll(strip);

  return (
    <div className={styles.strip} ref={strip} role="listbox" aria-label="День">
      {allLabel && (
        <button
          type="button"
          className={cx(styles.day, styles.all, !selected && styles.on)}
          aria-selected={!selected}
          onClick={() => onPick(null)}
        >
          {allLabel}
        </button>
      )}
      {list.map(({ iso, offset }) => {
        const { weekday, day } = label(iso, offset);
        return (
          <button
            key={iso}
            type="button"
            className={cx(styles.day, iso === selected && styles.on)}
            aria-selected={iso === selected}
            onClick={() => onPick(iso)}
          >
            <span className={styles.weekday}>{weekday}</span>
            <span className={styles.date}>{day}</span>
            {marks.has(iso) && <span className={styles.mark} aria-hidden="true" />}
          </button>
        );
      })}
      {onCalendar && (
        <button
          type="button"
          className={cx(styles.day, styles.calendar, beyond && styles.on)}
          aria-label="Выбрать дату в календаре"
          onClick={onCalendar}
        >
          <CalendarIcon size={18} />
          <span className={styles.date}>{beyond ? label(selected, 99).day : 'Дата'}</span>
        </button>
      )}
    </div>
  );
}
