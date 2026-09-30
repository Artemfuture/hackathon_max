import Button from './Button.jsx';
import EventRow from './EventRow.jsx';
import Lumi from './Lumi.jsx';
import Sheet from './Sheet.jsx';
import StatusCard from './StatusCard.jsx';
import { formatDuration, toClock } from '../lib/format.js';
import { toMin } from '../lib/planner.js';
import styles from './ConflictSheet.module.css';

export default function ConflictSheet({ conflict, onPickSimilar, onReplace, onStartNew, onClose }) {
  if (!conflict) return null;
  const { item, result, similar } = conflict;
  const other = result.conflictWith;
  const kind = item.kind.toLowerCase();
  const start = item.start ? toMin(item.start) : null;
  const end = start != null ? start + item.durationMin : null;
  const overlaps = other && start != null && other.start < end && start < other.end;
  const reason = overlaps
    ? `В плане уже есть ${other.item.kind.toLowerCase()} «${other.item.title}» с ${toClock(other.start)} до ${toClock(other.end)}, а ${kind} идёт с ${item.start} до ${toClock(end)} — время пересекается.`
    : other
      ? result.side === 'before'
        ? `Предыдущий шаг (${other.item.kind.toLowerCase()}) заканчивается в ${toClock(other.end)}, а ${kind} начинается в ${item.start} — не успеть доехать.`
        : `${item.kind} закончится в ${toClock(end)}, а следующий шаг (${other.item.kind.toLowerCase()}) начинается в ${toClock(other.start)} — не успеть доехать.`
      : item.hours
        ? `${item.kind} работает ${item.hours.open}–${item.hours.close}, а в эти часы план уже занят.`
        : 'В этот вечер для него не находится времени между шагами плана.';

  return (
    <Sheet open title={null} onClose={onClose}>
      <div className={styles.head}>
        <Lumi pose="think" size={96} />
        <div>
          <h2 className={styles.title}>Не успеете</h2>
          <p className={styles.reason}>{reason}</p>
        </div>
      </div>
      {result.shortfall > 0 && (
        <StatusCard
          tone="late"
          title={overlaps ? 'Два события в одно время' : `Между событиями не хватает ${formatDuration(result.shortfall)}`}
          text={overlaps ? 'Оставьте одно — или замените шаг кнопкой ниже.' : 'Даже с учётом дороги на такси это невозможно.'}
        />
      )}

      {similar.length > 0 && (
        <>
          <p className={styles.section}>Похожее, что встаёт в план</p>
          <div className={styles.list}>
            {similar.map(({ item: alt }) => (
              <EventRow
                key={alt.id}
                event={alt}
                price={alt.price}
                actionLabel="Добавить"
                onAction={() => onPickSimilar(alt)}
                onOpen={() => onPickSimilar(alt)}
              />
            ))}
          </div>
        </>
      )}

      <div className={styles.actions}>
        {other && (
          <Button variant="secondary" onClick={onReplace}>
            Заменить «{other.item.kind}» на это событие
          </Button>
        )}
        {onStartNew && (
          <Button variant="secondary" onClick={onStartNew}>
            Начать «Мой план» заново с ним
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </Sheet>
  );
}
