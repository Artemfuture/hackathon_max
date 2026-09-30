import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { routeLine } from '../lib/routes.js';
import styles from './MapView.module.css';

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">участники OpenStreetMap</a>';

const LINE = { walk: '#4b22f5', taxi: '#4b22f5', transit: '#8a6bff' };

function icon(point) {
  const html =
    point.kind === 'origin'
      ? `<span class="${styles.origin}"></span>`
      : `<span class="${styles.stop}">${point.index ?? ''}</span>`;
  return L.divIcon({ html, className: styles.icon, iconSize: [28, 28], iconAnchor: [14, 14] });
}

export function createMap(node, { interactive = true, center = [55.7887, 49.1221], zoom = 14 } = {}) {
  const map = L.map(node, {
    center,
    zoom,
    zoomControl: interactive,
    dragging: interactive,
    touchZoom: interactive,
    doubleClickZoom: interactive,
    scrollWheelZoom: interactive,
    boxZoom: false,
    keyboard: false,
  });
  node.classList.add('dosug-map');
  L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
  map.attributionControl.setPrefix(false);
  return map;
}

export default function MapView({ points, legs = [], height = 220, interactive = true }) {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    const instance = createMap(box.current, { interactive });
    map.current = instance;
    layer.current = L.layerGroup().addTo(instance);
    return () => {
      instance.remove();
      map.current = null;
      layer.current = null;
    };
  }, [interactive]);

  useEffect(() => {
    const instance = map.current;
    const group = layer.current;
    if (!instance || !group || points.length === 0) return undefined;
    let cancelled = false;
    group.clearLayers();

    for (const point of points) {
      const marker = L.marker([point.lat, point.lon], {
        icon: icon(point),
        keyboard: false,
        zIndexOffset: point.kind === 'origin' ? -100 : 100 + (point.index ?? 0),
      }).addTo(group);
      if (point.label) marker.bindTooltip(point.label, { direction: 'top', offset: [0, -14] });
    }
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lon]));
    if (points.length === 1) instance.setView(bounds.getCenter(), 15);
    else instance.fitBounds(bounds, { paddingTopLeft: [30, 30], paddingBottomRight: [30, 64], maxZoom: 16 });

    for (const leg of legs) {
      routeLine(leg.from, leg.to, leg.mode).then(({ points: line }) => {
        if (cancelled) return;
        L.polyline(line, { color: '#fff', weight: 8, opacity: 0.8, lineCap: 'round' }).addTo(group);
        L.polyline(line, {
          color: LINE[leg.mode] ?? LINE.walk,
          weight: 4,
          opacity: 0.95,
          dashArray: leg.mode === 'walk' ? '0.1 8' : null,
          lineCap: 'round',
        }).addTo(group);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [points, legs]);

  useEffect(() => {
    const timer = setTimeout(() => map.current?.invalidateSize(), 250);
    return () => clearTimeout(timer);
  }, [height]);

  return <div ref={box} className={styles.map} style={{ height }} />;
}
