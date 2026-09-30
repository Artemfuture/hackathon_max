import { useMemo, useState } from 'react';
import MapView from './MapView.jsx';
import RouteView from './RouteView.jsx';
import { ExternalIcon, MapIcon } from './icons.jsx';
import { openExternal } from '../bridge.js';
import { yandexMapsRouteUrl } from '../lib/planner.js';
import styles from './RouteMap.module.css';

function mapData(plan, origin) {
  const start = origin && plan.firstLeg ? origin : null;
  const points = [
    ...(start ? [{ lat: start.lat, lon: start.lon, kind: 'origin', label: `Старт: ${start.label}` }] : []),
    ...plan.stops.map((stop, index) => ({
      lat: stop.item.lat,
      lon: stop.item.lon,
      kind: 'stop',
      index: index + 1,
      label: `${index + 1}. ${stop.item.title}`,
    })),
  ];
  const legs = [
    ...(start ? [{ from: start, to: plan.stops[0].item, mode: plan.firstLeg.mode }] : []),
    ...plan.stops
      .slice(1)
      .map((stop, index) => ({ from: plan.stops[index].item, to: stop.item, mode: stop.leg?.mode ?? 'walk' })),
  ];
  return { points, legs, route: [...(start ? [start] : []), ...plan.stops.map((stop) => stop.item)] };
}

export default function RouteMap({ plan, origin, height = 200 }) {
  const [expanded, setExpanded] = useState(false);
  const { points, legs, route } = useMemo(() => mapData(plan, origin), [plan, origin]);
  const mode = plan.taxiMin > 0 || plan.firstLeg?.mode === 'taxi' ? 'taxi' : 'walk';
  const openYandex = () => openExternal(yandexMapsRouteUrl(route, mode));
  const fullRoute = useMemo(() => {
    const start = origin && plan.firstLeg ? origin : null;
    return {
      origin: start,
      stops: plan.stops.map((stop, index) => ({ item: stop.item, label: String(index + 1) })),
      legs: [
        ...(start ? [{ from: start, to: plan.stops[0].item, mode: plan.firstLeg.mode, minutes: plan.firstLeg.minutes }] : []),
        ...plan.stops.slice(1).map((stop, index) => ({
          from: plan.stops[index].item,
          to: stop.item,
          mode: stop.leg?.mode ?? 'walk',
          minutes: stop.leg?.minutes ?? 0,
        })),
      ],
    };
  }, [plan, origin]);

  return (
    <div className={styles.card}>
      <MapView points={points} legs={legs} height={height} />
      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={() => setExpanded(true)}>
          <MapIcon size={16} /> Развернуть
        </button>
        <button type="button" className={styles.action} onClick={openYandex}>
          Яндекс Карты <ExternalIcon />
        </button>
      </div>

      {expanded && (
        <RouteView
          origin={fullRoute.origin}
          originLabel={fullRoute.origin ? (origin.id === 'geo' ? 'Вы здесь' : origin.label) : null}
          stops={fullRoute.stops}
          legs={fullRoute.legs}
          focus={plan.stops[0].item}
          yandexUrl={yandexMapsRouteUrl(route, mode)}
          onClose={() => setExpanded(false)}
          footer={
            <div className={styles.legend}>
              <span>
                <i className={styles.walk} /> пешком
              </span>
              <span>
                <i className={styles.taxi} /> такси
              </span>
              <button type="button" className={styles.yandex} onClick={openYandex}>
                Навигация в Яндекс Картах <ExternalIcon />
              </button>
            </div>
          }
        />
      )}
    </div>
  );
}
