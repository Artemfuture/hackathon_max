import { useMemo, useState } from 'react';
import Carousel from '../components/Carousel.jsx';
import FeedRow from '../components/FeedRow.jsx';
import LumiTour from '../components/LumiTour.jsx';
import PlanHero from '../components/PlanHero.jsx';
import ProfileButton from '../components/ProfileButton.jsx';
import SourceNote from '../components/SourceNote.jsx';
import { CalendarIcon, ChevronDownIcon, PinIcon, SearchIcon, SparkleIcon } from '../components/icons.jsx';
import { getCity } from '../data/catalog.js';
import { dateText } from '../lib/clock.js';
import { cx } from '../lib/format.js';
import { toMin } from '../lib/planner.js';
import { findEvents, findPlans, homeWindow, windowOf } from '../lib/plans.js';
import { formatTemp, weatherFor } from '../lib/weather.js';
import styles from './HomeScreen.module.css';

const TOUR = [
  {
    pose: 'hello',
    title: 'Привет! Я Люми',
    text: 'Помогаю собрать свободное время в вечер: события, кафе, дорога между ними и такси — в одном плане.',
  },
  {
    target: 'location',
    pose: 'curious',
    title: 'Откуда начинаем',
    text: 'От этой точки считаю дорогу. Можно выбрать место в городе или определить, где вы сейчас.',
  },
  {
    target: 'feed',
    pose: 'lead',
    title: '«+ В план»',
    text: 'Добавляйте события и кафе в «Мой план» — я сам расставлю их по времени и посчитаю дорогу.',
  },
  {
    target: 'tab-build',
    pose: 'found',
    title: 'Или соберу за вас',
    text: 'Три коротких вопроса — когда вы свободны, какое настроение и есть ли льготы.',
  },
];

const CHIPS = [
  { id: 'foryou', label: 'Для вас' },
  { id: 'today', label: 'Сегодня' },
  { id: 'near', label: 'Рядом' },
];

const FEED_LIMIT = 6;
const startKey = (item, from) => (item.event.start ? toMin(item.event.start) : Math.max(from, toMin(item.event.hours.open)));

function feedOf(items, chip, from) {
  const sorted = [...items];
  const road = (item) => item.reach.leg?.minutes ?? 0;
  if (chip === 'near') sorted.sort((a, b) => road(a) - road(b));
  else if (chip === 'today') sorted.sort((a, b) => startKey(a, from) - startKey(b, from));
  const real = (item) => Number(item.event.source === 'kudago');
  if (chip === 'foryou') sorted.sort((a, b) => Number(b.match) - Number(a.match) || real(b) - real(a));
  const events = sorted.filter((item) => item.event.category !== 'food');
  const food = sorted
    .filter((item) => item.event.category === 'food')
    .sort((a, b) => Number(b.match) - Number(a.match) || road(a) - road(b));
  if (chip === 'near') return sorted.slice(0, FEED_LIMIT);
  const out = events.slice(0, FEED_LIMIT - 2);
  if (food[0]) out.splice(Math.min(2, out.length), 0, food[0]);
  if (food[1]) out.push(food[1]);
  return out.slice(0, FEED_LIMIT);
}

export default function HomeScreen({
  origin,
  benefits,
  moods,
  draftIds,
  hasDraft,
  onPickOrigin,
  onSearch,
  onAllPlans,
  onAllEvents,
  onOpenPlan,
  onOpenEvent,
  onAdd,
  onProfile,
}) {
  const [chip, setChip] = useState('foryou');
  const { prefs, day } = homeWindow();
  const selection = useMemo(() => ({ prefs, moods, benefits, origin }), [prefs.date, prefs.from, moods, benefits, origin]);
  const plans = useMemo(() => findPlans(selection, { limit: 3 }), [selection]);
  const items = useMemo(
    () => findEvents({ ...selection, prefs: { ...prefs, hours: '5' } }).filter(({ event }) => !event.manualOnly),
    [selection]
  );
  const { from, until } = windowOf(prefs);
  const feed = useMemo(() => feedOf(items, chip, from), [items, chip, from]);
  const weather = weatherFor(prefs.date, from, until);
  const title = prefs.date === 'tomorrow' ? 'Что хочется завтра?' : 'Что хочется сегодня?';

  return (
    <div className={cx(styles.root, hasDraft && styles.withBar)}>
      <main className={styles.column}>
        <header className={styles.top}>
          <div className={styles.where}>
            <button type="button" className={styles.place} onClick={onPickOrigin} data-tour="location">
              <PinIcon size={18} />
              <span>{origin?.label ?? getCity()}</span>
              <ChevronDownIcon size={16} />
            </button>
            <p className={styles.date}>
              <CalendarIcon size={15} />
              {day}, {dateText(prefs.date)}
              {weather && (
                <span className={styles.weather}>
                  {' '}
                  · {weather.emoji} {formatTemp(weather)}
                </span>
              )}
            </p>
          </div>
          <ProfileButton onClick={onProfile} />
        </header>

        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          <button type="button" className={styles.search} onClick={onSearch} aria-label="Искать на карте">
            <SearchIcon size={22} />
          </button>
        </div>

        <div className={styles.sectionHead}>
          <h2>Готовые планы для вас</h2>
          <button type="button" onClick={onAllPlans}>
            Все планы
          </button>
        </div>
        {plans.length > 0 ? (
          <Carousel>
            {plans.map((plan, index) => (
              <PlanHero key={plan.id} plan={plan} best={index === 0} onOpen={() => onOpenPlan(plan, prefs.date)} />
            ))}
          </Carousel>
        ) : (
          <p className={styles.empty}>Сейчас ничего не складывается — соберите вечер на другое время.</p>
        )}

        <div className={styles.sectionHead}>
          <h2>События для вас</h2>
          <button type="button" onClick={onAllEvents}>
            Все события
          </button>
        </div>
        <div className={styles.chips} role="tablist">
          {CHIPS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={chip === option.id}
              className={cx(styles.chip, chip === option.id && styles.chipOn)}
              onClick={() => setChip(option.id)}
            >
              {option.id === 'foryou' && <SparkleIcon size={15} />}
              {option.label}
            </button>
          ))}
        </div>
        <div className={styles.feed} data-tour="feed">
          {feed.map(({ event, price, reach }) => (
            <FeedRow
              key={event.id}
              event={event}
              price={price}
              reach={reach}
              day={day}
              inPlan={draftIds.has(event.id)}
              onOpen={() => onOpenEvent(event, prefs.date)}
              onAdd={() => onAdd(event, prefs.date)}
            />
          ))}
          {feed.length === 0 && <p className={styles.empty}>На сегодня уже всё — загляните в «Найти» на завтра.</p>}
        </div>

        <SourceNote extra="Дорога и «успеваете» рассчитаны приложением от выбранной точки" />
      </main>
      <LumiTour id="home-v2" steps={TOUR} />
    </div>
  );
}
