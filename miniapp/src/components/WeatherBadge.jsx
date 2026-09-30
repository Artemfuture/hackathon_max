import { formatTemp } from '../lib/weather.js';
import styles from './WeatherBadge.module.css';

export default function WeatherBadge({ weather }) {
  if (!weather) return null;
  return (
    <p className={styles.badge} title="Прогноз Open-Meteo">
      <span aria-hidden="true">{weather.emoji}</span>
      <span>
        {formatTemp(weather)} · {weather.label}
        {weather.precip >= 30 ? `, осадки ${weather.precip}%` : ''}
      </span>
      {weather.rainy && <span className={styles.hint}>прогулки ниже в подборке</span>}
    </p>
  );
}
