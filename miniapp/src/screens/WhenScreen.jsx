import Button from '../components/Button.jsx';
import LocationChip from '../components/LocationChip.jsx';
import LumiTour from '../components/LumiTour.jsx';
import Screen from '../components/Screen.jsx';
import TileGroup from '../components/TileGroup.jsx';
import { BUDGET_OPTIONS, DATE_OPTIONS, FROM_OPTIONS, HOURS_OPTIONS } from '../data/options.js';
import { ISO_DATE, dateText, dayShort, nextSlot, nowMinutes } from '../lib/clock.js';
import { toClock } from '../lib/format.js';
import { windowOf } from '../lib/plans.js';
import { isPastFrom } from '../lib/prefs.js';
import styles from './Screens.module.css';

const TOUR = [
  {
    pose: 'hello',
    title: 'Три вопроса — и вечер готов',
    text: 'Сначала — когда вы свободны. Я уложу маршрут в это время вместе с дорогой.',
  },
  {
    target: 'from',
    pose: 'think',
    title: 'С какого времени',
    text: '«Сейчас» — если хочется выйти прямо сейчас: посчитаю, на что вы успеваете.',
  },
  {
    target: 'location',
    pose: 'curious',
    title: 'Откуда выходите',
    text: 'Выберите место или геолокацию — от неё считаю время в пути, пешком и на такси.',
  },
];

export default function WhenScreen({ prefs, origin, onChange, onPickDate, onPickOrigin, onBack, onNext }) {
  const today = prefs.date === 'today';
  const now = nowMinutes();
  const picked = ISO_DATE.test(prefs.date);
  const dates = [
    ...DATE_OPTIONS.map((option) => ({ ...option, sub: dayShort(option.id) })),
    picked
      ? { id: prefs.date, label: 'Дата', sub: dateText(prefs.date, { short: true }) }
      : { id: 'pick', label: 'Дата', sub: 'календарь' },
  ];
  const froms = FROM_OPTIONS.map((option) => {
    if (option.id === 'now') {
      return { ...option, sub: today ? `с ${toClock(nextSlot())}` : 'только сегодня', disabled: !today };
    }
    return isPastFrom(option.id, prefs.date, now) ? { ...option, sub: 'уже прошло', disabled: true } : option;
  });
  const { from, until } = windowOf(prefs);

  return (
    <Screen
      onBack={onBack}
      headerRight={<LocationChip origin={origin} onClick={onPickOrigin} />}
      title="Когда вы свободны?"
      subtitle="Расскажите о вашем вечере — и мы подберем вам варианты"
      footer={
        <Button onClick={onNext}>
          Продолжить · {toClock(from)}–{toClock(until)}
        </Button>
      }
    >
      <div className={styles.tileRows}>
        <TileGroup
          label="День"
          size="lg"
          options={dates}
          selected={prefs.date}
          onChange={(id) => (id === 'pick' || (picked && id === prefs.date) ? onPickDate() : onChange('date', id))}
        />
        <TileGroup
          label="Начало"
          size="md"
          options={froms}
          selected={prefs.from}
          onChange={(id) => onChange('from', id)}
          tour="from"
        />
        <TileGroup
          label="Сколько есть времени"
          options={HOURS_OPTIONS}
          selected={prefs.hours}
          onChange={(id) => onChange('hours', id)}
        />
        <TileGroup
          label="Бюджет на человека"
          options={BUDGET_OPTIONS}
          selected={prefs.budget}
          onChange={(id) => onChange('budget', id)}
        />
      </div>
      <LumiTour id="when" steps={TOUR} />
    </Screen>
  );
}
