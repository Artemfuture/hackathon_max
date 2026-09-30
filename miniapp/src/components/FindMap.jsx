import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { createMap } from './MapView.jsx';
import styles from './FindMap.module.css';

const MARKS = {
  food: { color: '#ea7a1e', emoji: '☕' },
  museum: { color: '#7c3aed', emoji: '🖼' },
  walk: { color: '#0e9f6e', emoji: '🚶' },
  theatre: { color: '#db2777', emoji: '🎭' },
  concert: { color: '#e11d48', emoji: '🎶' },
  show: { color: '#f59e0b', emoji: '🎤' },
  talk: { color: '#2563eb', emoji: '🗣' },
  masterclass: { color: '#0891b2', emoji: '🎨' },
  sport: { color: '#16a34a', emoji: '🏃' },
  cinema: { color: '#4f46e5', emoji: '🎬' },
};
export const markOf = (category) => MARKS[category] ?? { color: '#471aff', emoji: '•' };

function pinIcon(event, selected) {
  const mark = markOf(event.category);
  const emoji = event.icon ?? mark.emoji;
  const html = `<span class="${styles.pin}${selected ? ` ${styles.selected}` : ''}" style="--pin:${mark.color}">${emoji}</span>`;
  const size = selected ? 42 : 32;
  return L.divIcon({ html, className: styles.icon, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

const originIcon = () =>
  L.divIcon({ html: `<span class="${styles.origin}"></span>`, className: styles.icon, iconSize: [22, 22], iconAnchor: [11, 11] });

export default function FindMap({ items, origin, selectedId, onSelect, focus = 0, fitKey = null, bottomInset = 0 }) {
  const box = useRef(null);
  const map = useRef(null);
  const layers = useRef(null);
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    const instance = createMap(box.current, {
      center: origin ? [origin.lat, origin.lon] : undefined,
      zoom: 15,
    });
    instance.zoomControl.setPosition('topright');
    const renderer = L.canvas({ tolerance: 10 });
    layers.current = {
      food: L.layerGroup().addTo(instance),
      pins: L.layerGroup().addTo(instance),
      origin: L.layerGroup().addTo(instance),
      renderer,
    };
    instance.on('click', () => select.current(null));
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const group = layers.current;
    if (!group) return;
    group.food.clearLayers();
    group.pins.clearLayers();
    for (const { event } of items) {
      const selected = event.id === selectedId;
      if (event.category === 'food' && !selected) {
        L.circleMarker([event.lat, event.lon], {
          renderer: group.renderer,
          radius: 6,
          color: '#fff',
          weight: 2,
          fillColor: markOf('food').color,
          fillOpacity: 0.95,
        })
          .on('click', (click) => {
            L.DomEvent.stopPropagation(click);
            select.current(event.id);
          })
          .addTo(group.food);
        continue;
      }
      L.marker([event.lat, event.lon], {
        icon: pinIcon(event, selected),
        keyboard: false,
        zIndexOffset: selected ? 1000 : 0,
      })
        .on('click', (click) => {
          L.DomEvent.stopPropagation(click);
          select.current(event.id);
        })
        .addTo(group.pins);
    }
  }, [items, selectedId]);

  useEffect(() => {
    const group = layers.current;
    if (!group) return;
    group.origin.clearLayers();
    if (origin) L.marker([origin.lat, origin.lon], { icon: originIcon(), interactive: false }).addTo(group.origin);
  }, [origin]);

  useEffect(() => {
    const instance = map.current;
    const chosen = items.find((item) => item.event.id === selectedId)?.event;
    if (!instance || !chosen) return;
    const point = instance.project([chosen.lat, chosen.lon], instance.getZoom()).add([0, bottomInset / 2]);
    instance.panTo(instance.unproject(point, instance.getZoom()), { animate: true });
  }, [selectedId]);

  useEffect(() => {
    if (focus > 0 && origin && map.current) map.current.setView([origin.lat, origin.lon], 15, { animate: true });
  }, [focus, origin]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !fitKey || items.length === 0 || items.length > 80) return;
    const view = instance.getBounds();
    if (items.some(({ event }) => view.contains([event.lat, event.lon]))) return;
    const points = [...items.map(({ event }) => [event.lat, event.lon]), ...(origin ? [[origin.lat, origin.lon]] : [])];
    instance.fitBounds(L.latLngBounds(points), { paddingTopLeft: [30, 170], paddingBottomRight: [30, 200], maxZoom: 15 });
  }, [fitKey]);

  useEffect(() => {
    const timer = setTimeout(() => map.current?.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, []);

  return <div ref={box} className={styles.map} />;
}
