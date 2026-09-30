export const DATE_OPTIONS = [
  { id: 'today', label: 'Сегодня', chip: 'Сегодня' },
  { id: 'tomorrow', label: 'Завтра', chip: 'Завтра' },
  { id: 'weekend', label: 'Выходные', chip: 'В выходные' },
];

export const FROM_OPTIONS = [
  { id: 'now', label: 'Сейчас', chip: 'Сейчас' },
  { id: '12', label: '12:00', chip: 'С 12:00', from: 12 * 60 },
  { id: '16', label: '16:00', chip: 'С 16:00', from: 16 * 60 },
  { id: '19', label: '19:00', chip: 'С 19:00', from: 19 * 60 },
];

export const HOURS_OPTIONS = [
  { id: '1', label: '1 час', chip: '1 час', minutes: 60 },
  { id: '2', label: '2 часа', chip: '2 часа', minutes: 120 },
  { id: '3', label: '3 часа', chip: '3 часа', minutes: 180 },
  { id: '5', label: 'До ночи', chip: 'До ночи', minutes: 300 },
];

export const BUDGET_OPTIONS = [
  { id: 'free', label: '0 ₽', chip: 'Бесплатно', max: 0 },
  { id: '1500', label: 'до 1 500', chip: 'До 1 500 ₽', max: 1500 },
  { id: '3000', label: 'до 3 000', chip: 'До 3 000 ₽', max: 3000 },
  { id: 'any', label: 'Любой', chip: 'Любой бюджет', max: Infinity },
];

export const BENEFIT_OPTIONS = [
  {
    id: 'pushkin',
    title: 'Пушкинская карта',
    hint: 'Культурные события по карте',
    chip: 'Пушкинская карта',
    emoji: '🎫',
  },
  {
    id: 'student',
    title: 'Студенческая льгота',
    hint: 'Для студентов и учащихся',
    chip: 'Студенческая льгота',
    emoji: '🎓',
  },
  { id: 'none', title: 'Без льгот', hint: 'Обычная стоимость', chip: null, emoji: '💳' },
];

export const MOOD_ANY = { id: 'any', label: 'Неважно', hint: 'Подобрать лучшие варианты', emoji: '✨' };

export const labelOf = (options, id, field = 'chip') => options.find((option) => option.id === id)?.[field];
