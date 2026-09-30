import Button from './Button.jsx';
import DateStrip from './DateStrip.jsx';
import Sheet from './Sheet.jsx';
import { dateIdFor, isoDate } from '../lib/clock.js';
import { DEFAULT_FILTERS, PRICES, TIMES } from '../lib/findFilters.js';
import { cx } from '../lib/format.js';
import styles from './FilterSheet.module.css';

function Option({ on, onClick, children }) {
  return (
    <button type="button" className={cx(styles.option, on && styles.optionOn)} onClick={onClick}>
      {children}
    </button>
  );
}

export default function FilterSheet({ open, filters, onChange, dateId, onDate, onCalendar, moods, found, onClose }) {
  const today = dateId === 'today';
  const set = (key, value) => onChange((current) => ({ ...current, [key]: value }));
  const toggle = (key) => onChange((current) => ({ ...current, [key]: !current[key] }));

  return (
    <Sheet
      open={open}
      title="Фильтры"
      onClose={onClose}
      footer={
        <div className={styles.filterFooter}>
          <Button variant="secondary" onClick={() => onChange(DEFAULT_FILTERS)}>
            Сбросить
          </Button>
          <Button onClick={onClose}>Показать {found}</Button>
        </div>
      }
    >
      <h3 className={styles.filterTitle}>День</h3>
      <DateStrip
        selected={isoDate(dateId)}
        onPick={(iso) => onDate(dateIdFor(iso) ?? 'today')}
        onCalendar={() => {
          onClose();
          onCalendar();
        }}
      />
      <h3 className={styles.filterTitle}>Время</h3>
      <div className={styles.options}>
        {TIMES.filter((option) => !option.todayOnly || today).map((option) => (
          <Option key={option.id} on={filters.time === option.id} onClick={() => set('time', option.id)}>
            {option.label}
          </Option>
        ))}
      </div>
      <h3 className={styles.filterTitle}>Цена для вас</h3>
      <div className={styles.options}>
        {PRICES.map((option) => (
          <Option key={option.id} on={filters.price === option.id} onClick={() => set('price', option.id)}>
            {option.label}
          </Option>
        ))}
      </div>
      <h3 className={styles.filterTitle}>Ещё</h3>
      <div className={styles.options}>
        <Option on={filters.pushkin} onClick={() => toggle('pushkin')}>
          🎫 Пушкинская карта
        </Option>
        {today && (
          <Option on={filters.openNow} onClick={() => toggle('openNow')}>
            🟢 Открыто сейчас
          </Option>
        )}
      </div>
      <h3 className={styles.filterTitle}>Настроение</h3>
      <div className={styles.options}>
        {moods.map((option) => (
          <Option
            key={option.id}
            on={filters.mood === option.id}
            onClick={() => onChange((current) => ({ ...current, mood: current.mood === option.id ? null : option.id }))}
          >
            {option.emoji} {option.label}
          </Option>
        ))}
      </div>
    </Sheet>
  );
}
