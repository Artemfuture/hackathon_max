import { useMemo, useState } from 'react';
import Button from '../components/Button.jsx';
import EventRoute from '../components/EventRoute.jsx';
import MapView from '../components/MapView.jsx';
import StatusCard from '../components/StatusCard.jsx';
import { ClockIcon, ExternalIcon, MapIcon, PinIcon, TicketIcon, WalletIcon, legIcon } from '../components/icons.jsx';
import backArrow from '../assets/icon-back.svg';
import { openExternal } from '../bridge.js';
import { dayTitle } from '../lib/clock.js';
import { formatDuration, formatPrice, priceLabel, toClock } from '../lib/format.js';
import { isFlexible, toMin, yandexGoUrl, yandexMapsPointUrl, yandexMapsRouteUrl } from '../lib/planner.js';
import styles from './EventScreen.module.css';

function reachStatus(event, reach, origin) {
  if (!reach?.status) return null;
  const how = reach.leg ? (reach.leg.mode === 'taxi' ? 'на такси' : 'пешком') : '';
  if (isFlexible(event)) {
    if (reach.status === 'late')
      return { tone: 'late', title: 'Уже не успеть', text: `Закрывается в ${toClock(reach.closesAt)}` };
    if (reach.opensAt != null)
      return {
        tone: 'info',
        title: `Откроется в ${toClock(reach.opensAt)}`,
        text: `Работает до ${toClock(reach.closesAt)}`,
      };
    return reach.status === 'tight'
      ? {
          tone: 'tight',
          title: 'Успеете ненадолго',
          text: `Открыто до ${toClock(reach.closesAt)} — останется ${formatDuration(reach.margin)}`,
        }
      : {
          tone: 'ok',
          title: 'Открыто сейчас',
          text: `Работает до ${toClock(reach.closesAt)}${origin ? `, добраться ${how} за ${reach.leg?.minutes ?? 0} мин` : ''}`,
        };
  }
  if (reach.status === 'late')
    return {
      tone: 'late',
      title: 'Не успеваете к началу',
      text: `Опоздание примерно на ${formatDuration(-reach.margin)}`,
    };
  if (reach.status === 'tight')
    return {
      tone: 'tight',
      title: 'Впритык',
      text: `Приедете примерно за ${reach.margin} мин до начала — лучше выходить сразу`,
    };
  return { tone: 'ok', title: 'Успеваете', text: `Приедете примерно за ${formatDuration(reach.margin)} до начала` };
}

function sourceNote(event) {
  if (event.group) return 'Тестовая группа: расписание, возраст, места и цена вымышлены; площадка настоящая (© участники OpenStreetMap)';
  if (event.source === 'kudago') return 'Данные о событии — KudaGo';
  if (event.source === 'osm') {
    return event.category === 'food'
      ? 'Данные о месте — © участники OpenStreetMap; средний чек — оценка по типу заведения'
      : 'Данные об объекте — © участники OpenStreetMap; цена посещения — оценка';
  }
  if (event.source === 'demo') return 'Тестовое событие: программа и цена вымышлены, ссылка ведёт на несуществующий адрес';
  return 'Часы работы и цены примерные — уточняйте на месте';
}

const places = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'место' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'места' : 'мест');

function ways(leg, origin, event) {
  const all = [
    { mode: 'walk', minutes: leg.walk, label: 'Пешком', href: yandexMapsRouteUrl([origin, event], 'walk') },
    { mode: 'taxi', minutes: leg.taxi, label: 'Яндекс Go', href: yandexGoUrl(origin, event) },
    { mode: 'transit', minutes: leg.transit, label: 'Транспорт', href: yandexMapsRouteUrl([origin, event], 'transit') },
  ];
  return leg.mode === 'walk' ? all : [all[1], all[2], all[0]];
}

export default function EventScreen({
  event,
  price,
  reach,
  dateId,
  origin,
  mode = 'browse',
  onBack,
  onBuild,
  onAdd,
  onRemove,
}) {
  const status = reachStatus(event, reach, origin);
  const [routeOpen, setRouteOpen] = useState(false);
  const leg = reach?.leg;
  const map = useMemo(() => {
    const target = { lat: event.lat, lon: event.lon, kind: 'stop', index: '★', label: event.place };
    if (!origin || !leg) return { points: [target], legs: [] };
    return {
      points: [{ lat: origin.lat, lon: origin.lon, kind: 'origin', label: origin.label }, target],
      legs: [{ from: origin, to: event, mode: leg.mode }],
    };
  }, [event, origin, leg]);
  const food = event.category === 'food';
  const estimate = event.priceEstimate === true;
  const { group } = event;
  const time = isFlexible(event)
    ? `${event.hours.open}–${event.hours.close} · ${food ? 'посидеть' : 'визит'} ~${formatDuration(event.durationMin)}`
    : `${event.start}—${toClock(toMin(event.start) + event.durationMin)}`;

  const open = (url) => (click) => {
    click.preventDefault();
    openExternal(url);
  };

  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <img
          src={event.photo}
          style={{ objectPosition: event.focus }}
          alt=""
          onError={(click) => {
            if (event.cover && click.currentTarget.src !== event.cover) click.currentTarget.src = event.cover;
          }}
        />
        <button type="button" className={styles.back} onClick={onBack} aria-label="Назад">
          <img src={backArrow} width="18" height="20" alt="" />
        </button>
      </div>

      <main className={styles.sheet}>
        <p className={styles.kind}>{event.kind}</p>
        <h1 className={styles.title}>{event.title}</h1>

        <div className={styles.facts}>
          <div>
            <p className={styles.factMain}>{dateId ? dayTitle(dateId) : 'Ежедневно'}</p>
            <p className={styles.factSub}>{time}</p>
          </div>
          <div className={styles.factRight}>
            <p className={styles.factMain}>{event.place && event.place !== event.title ? event.place : event.kind}</p>
            <a className={styles.address} href={yandexMapsPointUrl(event)} onClick={open(yandexMapsPointUrl(event))}>
              <PinIcon size={13} />
              {event.address ?? 'на карте'}
            </a>
          </div>
        </div>

        {status && (
          <div className={styles.block}>
            <StatusCard tone={status.tone} title={status.title} text={status.text} />
          </div>
        )}

        {leg && origin && (
          <section className={styles.block}>
            <h2 className={styles.h2}>От «{origin.label}» сейчас</h2>
            <div className={styles.map}>
              <MapView points={map.points} legs={map.legs} height={170} interactive={false} />
              <button type="button" className={styles.mapOpen} onClick={() => setRouteOpen(true)}>
                <span className={styles.mapButton}>
                  <MapIcon size={16} /> Маршрут на карте
                </span>
              </button>
            </div>
            <div className={styles.ways}>
              {ways(leg, origin, event).map((way) => (
                <a key={way.mode} className={styles.way} href={way.href} onClick={open(way.href)}>
                  <span className={styles.wayIcon}>{legIcon(way.mode, { size: 18 })}</span>
                  <span className={styles.wayValue}>{way.minutes} мин</span>
                  <span className={styles.wayLabel}>
                    {way.label} <ExternalIcon />
                  </span>
                </a>
              ))}
            </div>
            <p className={styles.note}>
              Время в пути — оценка по расстоянию ({String(leg.km).replace('.', ',')} км), точное покажут Карты.
            </p>
          </section>
        )}

        {group ? (
          <section className={styles.block}>
            <h2 className={styles.h2}>Группа</h2>
            <div className={styles.ticket}>
              <span className={styles.wayIcon}>
                <ClockIcon size={18} />
              </span>
              <div>
                <p className={styles.factMain}>
                  {group.days} в {event.start}, {formatDuration(event.durationMin)}
                </p>
                <p className={styles.factSub}>
                  {group.level} · {group.ages}
                </p>
              </div>
            </div>
            <div className={styles.ticket}>
              <span className={styles.wayIcon}>
                <WalletIcon size={18} />
              </span>
              <div>
                <p className={styles.factMain}>{priceLabel(event, price)}</p>
                <p className={styles.factSub}>
                  Первое занятие — пробное · свободно {group.spots} {places(group.spots)}
                </p>
              </div>
              {event.phone ? (
                <a className={styles.buy} href={`tel:${event.phone.replace(/[^\d+]/g, '')}`}>
                  Позвонить
                </a>
              ) : (
                event.link && (
                  <a className={styles.buy} href={event.link} onClick={open(event.link)}>
                    {event.link.includes('openstreetmap.org') ? 'Карта' : 'Сайт'} <ExternalIcon />
                  </a>
                )
              )}
            </div>
          </section>
        ) : estimate ? (
          <section className={styles.block}>
            <h2 className={styles.h2}>{food ? 'Часы и чек' : 'Часы и цена'}</h2>
            <div className={styles.ticket}>
              <span className={styles.wayIcon}>
                <ClockIcon size={18} />
              </span>
              <div>
                <p className={styles.factMain}>
                  Открыто {event.hours.open}–{event.hours.close}
                </p>
                <p className={styles.factSub}>
                  {food ? `${event.kind}, без билетов и записи` : `${event.kind} · разовое посещение`}
                </p>
              </div>
              {event.link && (
                <a className={styles.buy} href={event.link} onClick={open(event.link)}>
                  {event.link.includes('openstreetmap.org') ? 'Карта' : 'Сайт'} <ExternalIcon />
                </a>
              )}
            </div>
            <div className={styles.ticket}>
              <span className={styles.wayIcon}>
                <WalletIcon size={18} />
              </span>
              <div>
                <p className={styles.factMain}>{priceLabel(event, price, { long: true })}</p>
                <p className={styles.factSub}>
                  {food ? 'Оценка по типу заведения — точные цены в меню' : 'Оценка — точные цены и правила на сайте объекта'}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.block}>
            <h2 className={styles.h2}>Билеты</h2>
            <div className={styles.ticket}>
              <span className={styles.wayIcon}>
                <TicketIcon size={18} />
              </span>
              <div>
                <p className={styles.factMain}>
                  {price === 0 ? 'Бесплатно' : `${priceLabel(event, price)} для вас`}
                  {price !== event.price && <span className={styles.oldPrice}>{formatPrice(event.price)}</span>}
                </p>
                <p className={styles.factSub}>
                  {[
                    event.priceText && event.priceFrom && event.priceText,
                    event.pushkin && 'Пушкинская карта',
                    event.studentPrice != null && `студентам ${formatPrice(event.studentPrice)}`,
                    event.age && `${event.age}`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Льгот нет'}
                </p>
              </div>
              {event.link && (
                <a className={styles.buy} href={event.link} onClick={open(event.link)}>
                  {event.source === 'kudago' ? 'KudaGo' : 'Сайт'} <ExternalIcon />
                </a>
              )}
            </div>
          </section>
        )}

        {event.description && (
          <section className={styles.block}>
            <h2 className={styles.h2}>{isFlexible(event) ? 'О месте' : 'О событии'}</h2>
            <p className={styles.about}>{event.description}</p>
          </section>
        )}

        <p className={styles.sourceNote}>{sourceNote(event)}</p>
      </main>

      {mode !== 'view' && (
        <footer className={styles.footer}>
          {mode === 'pick' && <Button onClick={onAdd}>Добавить в план</Button>}
          {mode === 'inPlan' && (
            <Button variant="secondary" onClick={onRemove}>
              Убрать из плана
            </Button>
          )}
          {mode === 'browse' && (
            <>
              <Button onClick={onBuild}>{food || estimate ? 'Собрать вечер с этим местом' : 'Достроить вечер'}</Button>
              <Button variant="secondary" onClick={onAdd}>
                + В мой план
              </Button>
            </>
          )}
        </footer>
      )}
      {routeOpen && origin && <EventRoute event={event} origin={origin} onClose={() => setRouteOpen(false)} />}
    </div>
  );
}
