import { useMemo } from 'react';
import Button from '../components/Button.jsx';
import Carousel from '../components/Carousel.jsx';
import Chip from '../components/Chip.jsx';
import EmptyState from '../components/EmptyState.jsx';
import EventCard from '../components/EventCard.jsx';
import LocationChip from '../components/LocationChip.jsx';
import Lumi from '../components/Lumi.jsx';
import LumiTour from '../components/LumiTour.jsx';
import PlanCard from '../components/PlanCard.jsx';
import Screen from '../components/Screen.jsx';
import SourceNote from '../components/SourceNote.jsx';
import WeatherBadge from '../components/WeatherBadge.jsx';
import { getCatalog } from '../data/catalog.js';
import { BENEFIT_OPTIONS, BUDGET_OPTIONS, labelOf } from '../data/options.js';
import { toClock } from '../lib/format.js';
import { findEvents, findPlans, windowOf } from '../lib/plans.js';
import { dateLabel as dayLabel } from '../lib/prefs.js';
import { weatherFor } from '../lib/weather.js';
import styles from './Screens.module.css';

const TOUR = [
  {
    target: 'plan-best',
    pose: 'found',
    title: 'Готовые варианты вечера',
    text: 'Каждый уже уложен в ваше время: события, дорога между ними и цена на человека. Откройте, чтобы посмотреть маршрут.',
  },
  {
    target: 'events',
    pose: 'curious',
    title: 'Или соберите сами',
    text: '«Успеваете» я считаю от вашей точки. Нажмите на событие — и я дострою вокруг него вечер.',
  },
];

function lumiLine(plan, origin) {
  const first = plan.firstLeg;
  if (first && origin) {
    const how = first.mode === 'taxi' ? `${first.minutes} мин на такси` : `${first.minutes} мин пешком`;
    return `Нашёл вариант! До первой точки — ${how} от «${origin.label}».`;
  }
  return `Нашёл вариант! Начало в ${toClock(plan.start)}, всё успеваете.`;
}

export default function ResultsScreen({
  prefs,
  moods,
  benefits,
  origin,
  onBack,
  onPickOrigin,
  onOpenPlan,
  onOpenEvent,
  onAddTime,
  onEditTime,
  onTomorrow,
}) {
  const { plans, events } = useMemo(() => {
    const selection = { prefs, moods, benefits, origin };
    return { plans: findPlans(selection), events: findEvents(selection) };
  }, [prefs, moods, benefits, origin]);
  const { from, until } = windowOf(prefs);
  const weather = weatherFor(prefs.date, from, until);
  const dateLabel = dayLabel(prefs.date);
  const moodLabels = getCatalog()
    .moods.filter((mood) => moods.includes(mood.id))
    .map((mood) => `${mood.emoji} ${mood.label}`);

  const chips = [
    dateLabel,
    `${toClock(from)}–${toClock(until)}`,
    labelOf(BUDGET_OPTIONS, prefs.budget),
    ...moodLabels,
    ...benefits.map((id) => labelOf(BENEFIT_OPTIONS, id)),
  ].filter(Boolean);

  const empty = plans.length === 0 && events.length === 0;

  return (
    <Screen
      tabBar
      onBack={onBack}
      headerRight={<LocationChip origin={origin} onClick={onPickOrigin} />}
      title={empty ? null : 'Вот что подходит на этот вечер'}
      titleSize="md"
    >
      {empty ? (
        <EmptyState
          title="Рядом ничего не подошло"
          text="Не нашли подходящих событий в выбранное время."
          actions={
            <>
              {until < 24 * 60 && <Button onClick={onAddTime}>Добавить 30 мин</Button>}
              {prefs.date === 'today' && until >= 23 * 60 && <Button onClick={onTomorrow}>Посмотреть на завтра</Button>}
              <Button variant="secondary" onClick={onPickOrigin}>
                Изменить локацию
              </Button>
              <Button variant="secondary" onClick={onEditTime}>
                Выбрать другое время
              </Button>
            </>
          }
        />
      ) : (
        <>
          <div className={styles.chips}>
            {chips.map((label) => (
              <Chip key={label}>{label}</Chip>
            ))}
          </div>
          {weather && (
            <div className={styles.weatherRow}>
              <WeatherBadge weather={weather} />
            </div>
          )}

          {plans.length > 0 && (
            <>
              <Lumi pose="found" size={74} bubble={lumiLine(plans[0], origin)} className={styles.lumiHint} />
              <Carousel title="Готовые планы">
                {plans.map((plan, index) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    tour={index === 0 ? 'plan-best' : undefined}
                    onOpen={() => onOpenPlan(plan, prefs.date)}
                  />
                ))}
              </Carousel>
            </>
          )}

          {events.length > 0 && (
            <Carousel title="События и места" tour="events">
              {events.map(({ event, price, reach }) => (
                <EventCard
                  key={event.id}
                  event={event}
                  price={price}
                  reach={reach}
                  dateLabel={dateLabel}
                  actionLabel="Подробнее"
                  onAction={() => onOpenEvent(event)}
                  onOpen={() => onOpenEvent(event)}
                />
              ))}
            </Carousel>
          )}

          <SourceNote extra="Дорога, «успеваете» и цена на человека рассчитаны приложением" />
          <LumiTour id="results" steps={TOUR} enabled={plans.length > 0} />
        </>
      )}
    </Screen>
  );
}
