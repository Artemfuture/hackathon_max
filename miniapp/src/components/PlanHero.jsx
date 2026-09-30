import { ArrowRightIcon, ClockIcon, SparkleIcon, WalletIcon } from './icons.jsx';
import { formatDuration, formatPrice } from '../lib/format.js';
import { planPath, planTitle } from '../lib/plans.js';
import styles from './PlanHero.module.css';

function coverOf(plan) {
  const real = plan.stops.find((stop) => stop.item.image);
  return (real ?? plan.stops[0]).item.photo;
}

export default function PlanHero({ plan, best = false, onOpen }) {
  return (
    <article className={styles.card}>
      <img className={styles.photo} src={coverOf(plan)} alt="" loading="lazy" />
      <div className={styles.shade} />
      <div className={styles.content}>
        <span className={styles.badge}>
          <SparkleIcon size={14} />
          {best ? 'Подходит вам' : (plan.label ?? 'Другой вариант')}
        </span>
        <h3 className={styles.title}>{planTitle(plan)}</h3>
        <p className={styles.path}>{planPath(plan)}</p>
        <div className={styles.bottom}>
          <span className={styles.fact}>
            <ClockIcon size={15} />
            {formatDuration(plan.durationMin)}
          </span>
          <span className={styles.fact}>
            <WalletIcon size={15} />
            {plan.price === 0 ? '0 ₽' : formatPrice(plan.price)}
          </span>
          <button type="button" className={styles.open} onClick={onOpen}>
            Посмотреть план <ArrowRightIcon size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
