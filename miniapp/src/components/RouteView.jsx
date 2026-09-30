import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { createMap } from './MapView.jsx';
import { ChevronLeftIcon, ExternalIcon, MinusIcon, NavigateIcon, PlusIcon } from './icons.jsx';
import { openExternal } from '../bridge.js';
import { routeLine } from '../lib/routes.js';
import styles from './RouteView.module.css';

const escape = (text) =>
  String(text ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const LEG_ICONS = {
  walk: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 3 3v3M9 11l3-3 3 1.5 2 3M12 8l-1.5 5.5"/></svg>',
  taxi: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16V11l2-5h10l2 5v5"/><path d="M4 16h16v3H4zM7 19v1.5M17 19v1.5M5 11h14"/></svg>',
  transit: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="13" rx="3"/><path d="M5 11h14M8 20l1.5-3M16 20l-1.5-3"/><circle cx="8.5" cy="14" r=".6"/><circle cx="15.5" cy="14" r=".6"/></svg>',
};
const LEG_TEXT = { walk: 'Пешком', taxi: 'На такси', transit: 'Транспорт' };

function pinIcon(label, halo) {
  const html =
    `<span class="${styles.pinWrap}">${halo ? `<span class="${styles.halo}"></span>` : ''}` +
    `<svg class="${styles.pin}" viewBox="0 0 36 46" width="36" height="46"><path d="M18 45c-1.4-5-12-14.6-12-25a12 12 0 0 1 24 0c0 10.4-10.6 20-12 25z" fill="#6c2bff" stroke="#fff" stroke-width="3"/></svg>` +
    `<span class="${styles.pinLabel}">${label}</span></span>`;
  return L.divIcon({ html, className: styles.icon, iconSize: [36, 46], iconAnchor: [18, 44] });
}

const meIcon = (label) =>
  L.divIcon({
    html: `<span class="${styles.me}"><span class="${styles.meDot}"></span>${label ? `<span class="${styles.meLabel}">${escape(label)}</span>` : ''}</span>`,
    className: styles.icon,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const legIcon = (leg, left) =>
  L.divIcon({
    html:
      `<span class="${styles.leg}${left ? ` ${styles.toLeft}` : ''}"><span class="${styles.legIcon}">${LEG_ICONS[leg.mode] ?? LEG_ICONS.walk}</span>` +
      `<span><b>${leg.approx ? '≈' : ''}${leg.minutes} мин</b><small>${LEG_TEXT[leg.mode] ?? ''}</small></span></span>`,
    className: styles.icon,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

const cardIcon = (item, side) =>
  L.divIcon({
    html:
      `<span class="${styles.card} ${styles[side]}"><img src="${escape(item.photo)}" alt="" />` +
      `<span class="${styles.cardText}"><b>${escape(item.title)}</b><small>${escape(item.place && item.place !== item.title ? item.place : item.kind)}</small></span>` +
      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg></span>`,
    className: styles.icon,
    iconSize: [0, 0],
    iconAnchor: [0, 58],
  });

export default function RouteView({ origin, originLabel, stops, legs, focus, yandexUrl, onClose, onOpenItem, footer }) {
  const box = useRef(null);
  const map = useRef(null);
  const open = useRef(onOpenItem);
  open.current = onOpenItem;
  const [lines, setLines] = useState('loading');

  useEffect(() => {
    const instance = createMap(box.current, { zoom: 15 });
    instance.zoomControl.remove();
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return undefined;
    let cancelled = false;
    const group = L.layerGroup().addTo(instance);
    const points = [...(origin ? [origin] : []), ...stops.map((stop) => stop.item)];
    if (points.length === 0) return undefined;

    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lon]));
    if (points.length === 1) instance.setView(bounds.getCenter(), 16, { animate: false });
    else instance.fitBounds(bounds, { paddingTopLeft: [60, 190], paddingBottomRight: [70, 230], maxZoom: 16, animate: false });
    const width = instance.getSize().x;
    const onRight = (latLng) => instance.latLngToContainerPoint(latLng).x > width / 2;

    if (origin) L.marker([origin.lat, origin.lon], { icon: meIcon(originLabel), interactive: false, zIndexOffset: 500 }).addTo(group);
    stops.forEach((stop) => {
      const main = focus && stop.item.id === focus.id;
      L.marker([stop.item.lat, stop.item.lon], { icon: pinIcon(stop.label ?? '', main), zIndexOffset: main ? 900 : 700 })
        .on('click', () => open.current?.(stop.item))
        .addTo(group);
    });
    if (focus) {
      const x = instance.latLngToContainerPoint([focus.lat, focus.lon]).x;
      const side = x > width * 0.62 ? 'left' : x < width * 0.38 ? 'right' : 'center';
      L.marker([focus.lat, focus.lon], { icon: cardIcon(focus, side), zIndexOffset: 1000 })
        .on('click', () => open.current?.(focus))
        .addTo(group);
    }

    setLines(legs.length ? 'loading' : 'ready');
    let pending = legs.length;
    let approx = false;
    for (const leg of legs) {
      routeLine(leg.from, leg.to, leg.mode === 'walk' ? 'walk' : 'taxi').then(({ points: line, exact }) => {
        if (cancelled) return;
        approx = approx || !exact;
        pending -= 1;
        if (pending === 0) setLines(approx ? 'approx' : 'ready');
        L.polyline(line, { color: '#fff', weight: 10, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(group);
        L.polyline(line, {
          color: leg.mode === 'transit' ? '#8a6bff' : '#4b22f5',
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: leg.mode === 'walk' ? '0.1 11' : leg.mode === 'transit' ? '10 9' : null,
        }).addTo(group);
        const middle = line[Math.floor(line.length / 2)];
        L.marker(middle, { icon: legIcon(leg, onRight(middle)), interactive: false, zIndexOffset: 800 }).addTo(group);
      });
    }
    return () => {
      cancelled = true;
      group.remove();
    };
  }, [origin, originLabel, stops, legs, focus]);

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Маршрут на карте">
      <div ref={box} className={styles.map} />
      <button type="button" className={styles.back} onClick={onClose} aria-label="Назад">
        <ChevronLeftIcon size={24} />
      </button>
      {yandexUrl && (
        <button type="button" className={styles.external} onClick={() => openExternal(yandexUrl)}>
          Открыть в картах <ExternalIcon size={16} />
        </button>
      )}
      <div className={styles.controls}>
        {origin && (
          <button
            type="button"
            className={styles.control}
            onClick={() => map.current?.setView([origin.lat, origin.lon], 16, { animate: true })}
            aria-label="Ко мне"
          >
            <NavigateIcon size={20} />
          </button>
        )}
        <div className={styles.zoom}>
          <button type="button" onClick={() => map.current?.zoomIn()} aria-label="Приблизить">
            <PlusIcon size={20} />
          </button>
          <button type="button" onClick={() => map.current?.zoomOut()} aria-label="Отдалить">
            <MinusIcon size={20} />
          </button>
        </div>
      </div>
      {lines !== 'ready' && (
        <p className={styles.lineStatus} role="status">
          {lines === 'loading' ? 'Строю маршрут по улицам…' : 'Маршрут по улицам не загрузился — показана прямая'}
        </p>
      )}
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>,
    document.body
  );
}
