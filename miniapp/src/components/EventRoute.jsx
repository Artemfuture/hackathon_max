import { useMemo, useState } from 'react';
import RouteView from './RouteView.jsx';
import { legIcon } from './icons.jsx';
import { openExternal } from '../bridge.js';
import { cx } from '../lib/format.js';
import { travel, yandexGoUrl, yandexMapsRouteUrl } from '../lib/planner.js';
import styles from './EventRoute.module.css';

const MODES = [
  { id: 'walk', label: 'Пешком' },
  { id: 'taxi', label: 'Такси' },
  { id: 'transit', label: 'Транспорт' },
];

export default function EventRoute({ event, origin, onClose, onOpenEvent }) {
  const road = useMemo(() => travel(origin, event), [origin, event]);
  const [mode, setMode] = useState(road.mode);
  const minutes = { walk: road.walk, taxi: road.taxi, transit: road.transit };
  const stops = useMemo(() => [{ item: event }], [event]);
  const legs = useMemo(
    () => [{ from: origin, to: event, mode, minutes: minutes[mode], approx: mode === 'transit' }],
    [origin, event, mode, road]
  );
  const mapsUrl = yandexMapsRouteUrl([origin, event], mode);

  return (
    <RouteView
      origin={origin}
      originLabel={origin.id === 'geo' ? 'Вы здесь' : origin.label}
      stops={stops}
      legs={legs}
      focus={event}
      yandexUrl={mapsUrl}
      onClose={onClose}
      onOpenItem={onOpenEvent}
      footer={
        <div className={styles.panel}>
          <div className={styles.modes} role="tablist" aria-label="Как добираться">
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={mode === option.id}
                className={cx(styles.mode, mode === option.id && styles.modeOn)}
                onClick={() => setMode(option.id)}
              >
                {legIcon(option.id, { size: 18 })}
                <b>
                  {option.id === 'transit' ? '≈' : ''}
                  {minutes[option.id]} мин
                </b>
                <small>{option.label}</small>
              </button>
            ))}
          </div>
          <p className={styles.note}>
            {mode === 'transit'
              ? 'Время на транспорте — оценка; маршрут с пересадками покажут Яндекс Карты.'
              : `${String(road.km).replace('.', ',')} км · линия по улицам, время — оценка приложения`}
          </p>
          <button
            type="button"
            className={styles.go}
            onClick={() => openExternal(mode === 'taxi' ? yandexGoUrl(origin, event) : mapsUrl)}
          >
            {mode === 'taxi' ? 'Вызвать Яндекс Go' : mode === 'transit' ? 'Маршрут на транспорте' : 'Навигация в Яндекс Картах'}
          </button>
        </div>
      }
    />
  );
}
