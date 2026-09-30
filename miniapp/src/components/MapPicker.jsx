import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button.jsx';
import { CloseIcon, LocateIcon, PinIcon } from './icons.jsx';
import { createMap } from './MapView.jsx';
import { getCity } from '../data/catalog.js';
import { requestPosition } from '../lib/geo.js';
import styles from './MapPicker.module.css';

const KAZAN_VIEWBOX = '48.85,55.92,49.40,55.68';

async function searchAddress(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    viewbox: KAZAN_VIEWBOX,
    bounded: '1',
    'accept-language': 'ru',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(String(res.status));
  const list = await res.json();
  return list.map((place) => ({
    label: place.name || place.display_name.split(',')[0],
    detail: place.display_name.split(',').slice(1, 3).join(',').trim(),
    lat: Number(place.lat),
    lon: Number(place.lon),
  }));
}

export default function MapPicker({ open, initial, onPick, onClose }) {
  const box = useRef(null);
  const map = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');
  const [label, setLabel] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const center = initial ? [initial.lat, initial.lon] : undefined;
    const instance = createMap(box.current, { center, zoom: 16 });
    instance.on('dragstart', () => setLabel(null));
    map.current = instance;
    setTimeout(() => instance.invalidateSize(), 200);
    return () => {
      instance.remove();
      map.current = null;
    };
  }, [open, initial]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const search = async (event) => {
    event.preventDefault();
    if (query.trim().length < 3) return;
    setStatus('searching');
    try {
      const found = await searchAddress(query.trim());
      setResults(found);
      setStatus(found.length ? 'idle' : 'empty');
    } catch {
      setStatus('error');
    }
  };

  const goTo = (place) => {
    map.current?.setView([place.lat, place.lon], 17);
    setLabel(place.label);
    setResults([]);
  };

  const locate = async () => {
    setStatus('locating');
    try {
      const here = await requestPosition();
      map.current?.setView([here.lat, here.lon], 17);
      setLabel('Где я сейчас');
      setStatus('idle');
    } catch (error) {
      setStatus(error?.message === 'far' ? 'geo-far' : 'geo-error');
    }
  };

  const done = () => {
    const center = map.current.getCenter();
    onPick({
      id: 'pin',
      label: label ?? 'Точка на карте',
      lat: Math.round(center.lat * 1e5) / 1e5,
      lon: Math.round(center.lng * 1e5) / 1e5,
    });
  };

  const hint = {
    searching: 'Ищу…',
    empty: 'Ничего не нашлось в Казани — уточните адрес',
    error: 'Поиск адреса недоступен — передвиньте карту к нужному месту',
    locating: 'Определяю, где вы…',
    'geo-error': 'Не получилось определить — разрешите геолокацию или передвиньте карту',
    'geo-far': `Вы сейчас не в городе ${getCity()} — передвиньте карту к нужному месту`,
  }[status];

  return createPortal(
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Выбор точки на карте">
      <div ref={box} className={styles.map} />
      <span className={styles.pin} aria-hidden="true">
        <PinIcon size={40} strokeWidth="2" />
      </span>

      <div className={styles.top}>
        <form className={styles.search} onSubmit={search}>
          <input
            type="search"
            value={query}
            placeholder="Адрес или место в Казани"
            aria-label="Адрес или место"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" className={styles.find}>
            Найти
          </button>
        </form>
        <button type="button" className={styles.close} aria-label="Закрыть" onClick={onClose}>
          <CloseIcon size={20} />
        </button>
      </div>

      {(results.length > 0 || hint) && (
        <div className={styles.results}>
          {hint && <p className={styles.hint}>{hint}</p>}
          {results.map((place) => (
            <button
              key={`${place.lat},${place.lon}`}
              type="button"
              className={styles.result}
              onClick={() => goTo(place)}
            >
              <span className={styles.resultLabel}>{place.label}</span>
              {place.detail && <span className={styles.resultDetail}>{place.detail}</span>}
            </button>
          ))}
        </div>
      )}

      <div className={styles.bottom}>
        <button type="button" className={styles.locate} onClick={locate} aria-label="Где я сейчас">
          <LocateIcon size={22} />
        </button>
        <p className={styles.caption}>Передвиньте карту, чтобы булавка стояла там, откуда выходите</p>
        <Button onClick={done}>Начать отсюда</Button>
      </div>
    </div>,
    document.body
  );
}
