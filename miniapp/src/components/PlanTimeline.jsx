import TransitHint from './TransitHint.jsx';
import { ClockIcon, CloseIcon, PinIcon, PlusIcon } from './icons.jsx';
import { cx, formatDuration, priceLabel, toClock } from '../lib/format.js';
import { VISIT_STEP_MIN, isFlexible, visitBounds } from '../lib/planner.js';
import styles from './PlanTimeline.module.css';

function VisitStepper({ plan, stop, onVisit }) {
  const bounds = visitBounds(plan, stop.item.id);
  if (!bounds) return null;
  const minutes = stop.end - stop.start;
  const change = (delta) => onVisit(stop.item, Math.max(bounds.min, Math.min(bounds.max, minutes + delta)));
  return (
    <div className={styles.visit}>
      <ClockIcon size={14} />
      <span className={styles.visitLabel}>На месте</span>
      <button
        type="button"
        className={styles.visitButton}
        aria-label="Меньше времени на месте"
        disabled={minutes <= bounds.min}
        onClick={() => change(-VISIT_STEP_MIN)}
      >
        −
      </button>
      <span className={styles.visitValue} aria-live="polite">
        {formatDuration(minutes)}
      </span>
      <button
        type="button"
        className={styles.visitButton}
        aria-label="Больше времени на месте"
        disabled={minutes >= bounds.max}
        onClick={() => change(VISIT_STEP_MIN)}
      >
        +
      </button>
    </div>
  );
}

export default function PlanTimeline({ plan, origin, onOpen, onRemove, onVisit, onAdd, editable = false }) {
  return (
    <>
      <ol className={styles.list}>
        {origin && plan.firstLeg && (
          <li className={cx(styles.item, styles.leg)}>
            <span className={styles.time}>{toClock(plan.leaveAt)}</span>
            <span className={styles.dotStart} aria-hidden="true" />
            <div className={styles.legBody}>
              <p className={styles.fromLabel}>Выйти от «{origin.label}»</p>
              <TransitHint leg={plan.firstLeg} from={origin} to={plan.stops[0].item} compact />
            </div>
          </li>
        )}

        {plan.stops.map((stop, index) => (
          <li key={stop.item.id} className={styles.group}>
            {index > 0 && (
              <div className={cx(styles.item, styles.leg)}>
                <span className={styles.time} />
                <span className={styles.gap} aria-hidden="true" />
                <div className={styles.legBody}>
                  <TransitHint leg={stop.leg} from={plan.stops[index - 1].item} to={stop.item} compact />
                  {stop.wait >= 10 && (
                    <p className={styles.wait}>
                      {stop.wait >= 60
                        ? `Свободное время — ${formatDuration(stop.wait)}`
                        : `До начала останется ${formatDuration(stop.wait)}`}
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className={cx(styles.item, styles.stop)}>
              <span className={styles.time}>
                {toClock(stop.start)}
                <span className={styles.timeEnd}>{toClock(stop.end)}</span>
              </span>
              <span className={styles.dot} aria-hidden="true" />
              <div className={styles.card}>
                <button type="button" className={styles.open} onClick={() => onOpen?.(stop.item)}>
                  <img
                    className={styles.thumb}
                    src={stop.item.photo}
                    style={{ objectPosition: stop.item.focus }}
                    alt=""
                    loading="lazy"
                  />
                  <span className={styles.body}>
                    <span className={styles.kind}>{stop.item.kind}</span>
                    <span className={styles.title}>{stop.item.title}</span>
                    <span className={styles.meta}>
                      <PinIcon size={12} />
                      <span>{stop.item.address ?? stop.item.place}</span>
                    </span>
                    <span className={styles.price}>
                      {editable && onVisit && isFlexible(stop.item)
                        ? ''
                        : `${formatDuration(stop.end - stop.start)} · `}
                      {priceLabel(stop.item, stop.price)}
                    </span>
                  </span>
                </button>
                {editable && onVisit && <VisitStepper plan={plan} stop={stop} onVisit={onVisit} />}
                {editable && plan.stops.length > 1 && (
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Убрать «${stop.item.title}» из плана`}
                    onClick={() => onRemove?.(stop.item)}
                  >
                    <CloseIcon size={16} />
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}

        <li className={cx(styles.item, styles.end)}>
          <span className={styles.time}>{toClock(plan.end)}</span>
          <span className={styles.dotEnd} aria-hidden="true" />
          <p className={styles.endLabel}>Вечер завершён</p>
        </li>
      </ol>

      {editable && onAdd && (
        <button type="button" className={styles.add} onClick={onAdd} data-tour="plan-add">
          <span className={styles.addIcon}>
            <PlusIcon size={18} />
          </span>
          Добавить событие
        </button>
      )}
    </>
  );
}
