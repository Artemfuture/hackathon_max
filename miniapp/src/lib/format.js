export const cx = (...names) => names.filter(Boolean).join(' ');

export const toMinutes = (clock) => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
};

export const toClock = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} ч ${m} мин`;
  return h ? `${h} ч` : `${m} мин`;
}

export const formatPrice = (rub) => `${rub.toLocaleString('ru-RU')} р`;

export function priceLabel(event, price, { long = false } = {}) {
  if (price === 0) return 'бесплатно';
  if (event?.priceEstimate) {
    if (event.category === 'food') return `${long ? 'Средний чек' : 'чек'} ≈ ${formatPrice(price)}`;
    return `${long ? 'Разовое посещение ' : ''}≈ ${formatPrice(price)}`;
  }
  if (event?.group) return `${formatPrice(price)} за занятие`;
  return `${event?.priceFrom ? 'от ' : ''}${formatPrice(price)}`;
}

export function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
