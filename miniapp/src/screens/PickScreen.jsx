import EventRow from '../components/EventRow.jsx';
import Screen from '../components/Screen.jsx';
import { getCatalog } from '../data/catalog.js';
import { toClock } from '../lib/format.js';
import { dayOffset } from '../lib/clock.js';
import { fitsWindow, insertIntoPlan, onDay, priceForUser } from '../lib/planner.js';
import styles from './Screens.module.css';

export default function PickScreen({ plan, dateId, benefits, notBefore = 0, onBack, onOpen, onAdd }) {
  const inPlan = new Set(plan.stops.map((stop) => stop.item.id));
  const day = dayOffset(dateId);
  const options = getCatalog()
    .events.filter((event) => !inPlan.has(event.id) && onDay(event, day) && fitsWindow(event, notBefore, 24 * 60))
    .map((event) => {
      const result = insertIntoPlan(plan, event, { benefits, notBefore });
      const at = result.ok ? result.plan.stops.find((stop) => stop.item.id === event.id) : null;
      return { event, price: priceForUser(event, benefits), result, at };
    });
  const fits = options.filter((option) => option.result.ok).sort((a, b) => a.at.start - b.at.start);
  const rest = options.filter((option) => !option.result.ok);

  return (
    <Screen
      onBack={onBack}
      title="Добавить в план"
      titleSize="md"
      subtitle={`Ваш вечер: ${toClock(plan.start)}–${toClock(plan.end)}`}
    >
      <h2 className={styles.listTitle}>Встаёт без конфликтов</h2>
      <div className={styles.list}>
        {fits.length === 0 && (
          <p className={styles.muted}>Ничего не помещается между шагами — можно заменить один из них.</p>
        )}
        {fits.map(({ event, price, at }) => (
          <EventRow
            key={event.id}
            event={event}
            price={price}
            note={`В плане: ${toClock(at.start)}–${toClock(at.end)}`}
            actionLabel="Добавить"
            onAction={() => onAdd(event)}
            onOpen={() => onOpen(event)}
          />
        ))}
      </div>

      {rest.length > 0 && (
        <>
          <h2 className={styles.listTitle}>Пересекается по времени</h2>
          <div className={styles.list}>
            {rest.map(({ event, price }) => (
              <EventRow
                key={event.id}
                event={event}
                price={price}
                dimmed
                actionLabel="Добавить"
                onAction={() => onAdd(event)}
                onOpen={() => onOpen(event)}
              />
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
