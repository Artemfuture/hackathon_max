import { ClockIcon, RouteIcon, WalletIcon } from './icons.jsx';
import { formatDuration, formatPrice } from '../lib/format.js';
import styles from './PlanStats.module.css';

export default function PlanStats({ plan }) {
  const road = plan.travelMin + (plan.firstLeg?.minutes ?? 0);
  const items = [
    { icon: <ClockIcon />, value: formatDuration(plan.durationMin), label: 'общее время' },
    { icon: <WalletIcon />, value: plan.price === 0 ? '0 ₽' : `≈ ${formatPrice(plan.price)}`, label: 'на 1 человека' },
    { icon: <RouteIcon />, value: `${road} мин`, label: 'в пути' },
  ];
  return (
    <dl className={styles.stats}>
      {items.map((item) => (
        <div key={item.label} className={styles.item}>
          <span className={styles.icon}>{item.icon}</span>
          <div>
            <dt className={styles.value}>{item.value}</dt>
            <dd className={styles.label}>{item.label}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
