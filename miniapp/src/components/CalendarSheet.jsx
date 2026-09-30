import Sheet from './Sheet.jsx';
import { isoForOffset } from '../lib/clock.js';
import { cx } from '../lib/format.js';
import styles from './CalendarSheet.module.css';

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const monthTitle = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function months(maxDays) {
  const first = isoForOffset(0);
  const last = isoForOffset(maxDays);
  const result = [];
  let cursor = new Date(`${first.slice(0, 8)}01T12:00:00Z`);
  while (cursor.toISOString().slice(0, 7) <= last.slice(0, 7)) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
    const cells = [...Array(lead).fill(null)];
    for (let day = 1; day <= days; day += 1) {
      cells.push(new Date(Date.UTC(year, month, day, 12)).toISOString().slice(0, 10));
    }
    result.push({ key: `${year}-${month}`, title: monthTitle(cells[lead]), cells });
    cursor = new Date(Date.UTC(year, month + 1, 1, 12));
  }
  return { months: result, first, last };
}

export default function CalendarSheet({
  open,
  title = 'Выберите день',
  selected,
  marks = new Set(),
  maxDays = 60,
  hint,
  onPick,
  onClose,
}) {
  if (!open) return null;
  const { months: list, first, last } = months(maxDays);

  return (
    <Sheet open title={title} onClose={onClose}>
      {hint && <p className={styles.hint}>{hint}</p>}
      {list.map((month) => (
        <section key={month.key} className={styles.month}>
          <h3 className={styles.title}>{month.title}</h3>
          <div className={styles.grid}>
            {WEEKDAYS.map((day) => (
              <span key={day} className={styles.weekday}>
                {day}
              </span>
            ))}
            {month.cells.map((iso, index) => {
              if (!iso) return <span key={`gap-${index}`} />;
              const disabled = iso < first || iso > last;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  className={cx(styles.day, iso === first && styles.today, iso === selected && styles.selected)}
                  aria-pressed={iso === selected}
                  aria-label={new Date(`${iso}T12:00:00Z`).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    timeZone: 'UTC',
                  })}
                  onClick={() => onPick(iso)}
                >
                  {Number(iso.slice(8))}
                  {marks.has(iso) && <span className={styles.mark} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </Sheet>
  );
}
