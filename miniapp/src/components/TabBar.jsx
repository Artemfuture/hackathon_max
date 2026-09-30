import { CalendarIcon, HomeIcon, PlusCircleIcon, SearchIcon } from './icons.jsx';
import { cx } from '../lib/format.js';
import styles from './TabBar.module.css';

const TABS = [
  { id: 'home', label: 'Для вас', icon: HomeIcon },
  { id: 'find', label: 'Найти', icon: SearchIcon },
  { id: 'build', label: 'Собрать', icon: PlusCircleIcon },
  { id: 'plans', label: 'Планы', icon: CalendarIcon },
];

export default function TabBar({ active, onChange, badge = {} }) {
  return (
    <nav className={styles.bar} aria-label="Разделы">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={cx(styles.tab, active === id && styles.active)}
          aria-current={active === id ? 'page' : undefined}
          onClick={() => onChange(id)}
          data-tour={`tab-${id}`}
        >
          <span className={styles.icon}>
            <Icon size={24} />
            {badge[id] ? <span className={styles.badge}>{badge[id]}</span> : null}
          </span>
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
