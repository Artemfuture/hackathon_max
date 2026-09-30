import Button from '../components/Button.jsx';
import Lumi from '../components/Lumi.jsx';
import LumiTour from '../components/LumiTour.jsx';
import PlanStats from '../components/PlanStats.jsx';
import PlanTimeline from '../components/PlanTimeline.jsx';
import Screen from '../components/Screen.jsx';
import SourceNote from '../components/SourceNote.jsx';
import RouteMap from '../components/RouteMap.jsx';
import StatusCard from '../components/StatusCard.jsx';
import WeatherBadge from '../components/WeatherBadge.jsx';
import { MapIcon, RefreshIcon } from '../components/icons.jsx';
import { openExternal } from '../bridge.js';
import { dayTitle } from '../lib/clock.js';
import { formatDuration, plural, toClock } from '../lib/format.js';
import { yandexMapsRouteUrl } from '../lib/planner.js';
import { weatherFor } from '../lib/weather.js';
import styles from './Screens.module.css';

const TOUR = [
  {
    target: 'plan-status',
    pose: 'think',
    title: 'Всё складывается?',
    text: 'Я проверил время начала, часы работы и дорогу между точками. Здесь видно, сколько остаётся запаса.',
  },
  {
    target: 'plan-timeline',
    pose: 'lead',
    title: 'Мой хвост — ваш маршрут',
    text: 'Между шагами — сколько идти или ехать. Кнопка сразу открывает Яндекс Карты или вызывает такси в Яндекс Go.',
  },
  {
    target: 'plan-add',
    pose: 'found',
    title: 'Можно дополнить',
    text: 'Добавьте событие — я проверю, успеваете ли, и подскажу, если нет.',
  },
];

export default function EveningScreen({
  plan,
  dateId,
  dateText = null,
  origin,
  confirmed = false,
  kicker = null,
  canRebuild = false,
  onBack,
  onOpenEvent,
  onRemove,
  onVisit,
  onAdd,
  onRebuild,
  onChoose,
  onInvite,
  onShareRoute,
  saveLabel = null,
  onSave,
  onCancel,
}) {
  const count = plan.stops.length;
  const weather = dateId ? weatherFor(dateId, plan.start, plan.end) : null;
  const points = [...(origin && plan.firstLeg ? [origin] : []), ...plan.stops.map((stop) => stop.item)];
  const mode = plan.taxiMin > 0 || plan.firstLeg?.mode === 'taxi' ? 'taxi' : 'walk';

  return (
    <Screen
      tabBar={confirmed}
      onBack={onBack}
      kicker={kicker ?? (confirmed ? 'Выбранный вечер' : (plan.label ?? 'Ваш вечер'))}
      title={dateId ? dayTitle(dateId) : (dateText ?? 'Ваш вечер')}
      titleSize="sm"
      subtitle={`${count} ${plural(count, 'точка', 'точки', 'точек')} · ${toClock(plan.start)}–${toClock(plan.end)}`}
      footer={
        confirmed ? (
          <>
            {onInvite && <Button onClick={onInvite}>Пригласить друзей</Button>}
            {onShareRoute && (
              <Button variant="secondary" onClick={onShareRoute}>
                <MapIcon size={18} />
                &nbsp;Поделиться маршрутом
              </Button>
            )}
          </>
        ) : onSave ? (
          <>
            <Button onClick={onSave}>{saveLabel ?? 'Сохранить изменения'}</Button>
            <Button variant="secondary" onClick={onCancel}>
              Отменить
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onChoose}>Выбрать этот план</Button>
            {canRebuild && (
              <Button variant="secondary" onClick={onRebuild}>
                <RefreshIcon size={18} />
                &nbsp;Другой вариант
              </Button>
            )}
          </>
        )
      }
    >
      <div className={styles.planTop}>
        <PlanStats plan={plan} />
        <div data-tour="plan-status">
          {plan.tight ? (
            <StatusCard tone="tight" title="Впритык" text="Между шагами мало времени — выходите без задержек" />
          ) : (
            <StatusCard
              tone="ok"
              title="Всё складывается"
              text={
                plan.reserveMin >= 5
                  ? `Есть ${formatDuration(plan.reserveMin)} запаса`
                  : 'Время рассчитано с учётом дороги'
              }
            />
          )}
        </div>
        {weather && <WeatherBadge weather={weather} />}
      </div>

      <div className={styles.planMap}>
        <RouteMap plan={plan} origin={origin} />
      </div>

      <div className={styles.timelineWrap} data-tour="plan-timeline">
        <PlanTimeline
          plan={plan}
          origin={origin}
          editable={!confirmed}
          onOpen={onOpenEvent}
          onRemove={onRemove}
          onVisit={confirmed ? null : onVisit}
          onAdd={confirmed ? null : onAdd}
        />
      </div>

      <button type="button" className={styles.routeAll} onClick={() => openExternal(yandexMapsRouteUrl(points, mode))}>
        <MapIcon size={18} />
        Весь маршрут в Яндекс Картах
      </button>

      {confirmed && (
        <Lumi
          pose="joy"
          size={90}
          bubble="Отличный план! Напомню в чате с ботом за час до начала."
          className={styles.lumiHint}
        />
      )}

      <SourceNote extra="Время в пути и цена на человека рассчитаны приложением" />
      {!confirmed && <LumiTour id="evening" steps={TOUR} delay={600} />}
    </Screen>
  );
}
