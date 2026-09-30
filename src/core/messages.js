import { CITY, LANDMARKS, SOURCE, catalogSources, sourceDateLabel } from '../data/events.js';
import { FUNNEL, summarize } from '../metrics.js';
import { getStore } from '../state.js';
import { inCity, nearestKm } from '../../shared/planner.js';

const openApp = (text = '🎉 Открыть «Досуг Казани»', payload = '') => [{ text, openApp: payload }];
const shareLocation = [{ text: '📍 Начать от моего места', requestLocation: true }];

const ruDate = (iso) => iso.split('-').reverse().join('.');

function sourceLine() {
  const sources = catalogSources();
  const parts = [];
  const kudago = sources.find((source) => source.id === 'kudago');
  if (kudago) parts.push(`KudaGo${kudago.updatedAt ? `, данные на ${ruDate(kudago.updatedAt)}` : ''}`);
  if (sources.some((source) => source.id === 'osm')) parts.push('кафе и спортивные объекты — © участники OpenStreetMap');
  if (sources.some((source) => source.id === 'demo')) {
    const what = SOURCE.isTest ? `${SOURCE.name} (события и цены вымышлены)` : SOURCE.name;
    parts.push(`${what}, данные на ${sourceDateLabel()}`);
  }
  return `ℹ️ Источник: ${parts.join('; ')}.`;
}

export function renderWelcome() {
  return {
    text:
      'Привет! Я Люми — дракончик-проводник бота «Досуг Казани» 🐉\n\n' +
      'Соберу вечер под твоё свободное время: события, кафе и спорт рядом, дорога между ними, карта и такси. ' +
      'Всё это — в приложении, открой его кнопкой ниже.\n\n' +
      'А здесь, в чате, я:\n' +
      '• напомню о выбранном вечере перед началом;\n' +
      '• сообщу, когда друг ответит «Иду!» на твоё приглашение.\n\n' +
      'Если хочешь, чтобы дорогу я считал от места, где ты сейчас, — отправь геолокацию кнопкой «📍».',
    buttons: [openApp(), shareLocation, [{ text: 'ℹ️ Как это работает', action: 'menu:about' }]],
  };
}

export function renderAppPrompt() {
  return {
    text:
      'Подборка событий, карта и план вечера — в приложении, открой его кнопкой ниже 👇\n\n' +
      'В этот чат приходят напоминания о выбранном вечере и ответы друзей на приглашения.',
    buttons: [openApp(), shareLocation],
  };
}

export const launchFromPoint = ({ lat, lon }) => `here_${Math.round(lat * 1000)}_${Math.round(lon * 1000)}`;

export function renderLocationReply(point) {
  if (!inCity(point, LANDMARKS)) {
    return {
      text:
        `Похоже, ты сейчас не в городе ${CITY} — до него около ${Math.round(nearestKm(point, LANDMARKS))} км. ` +
        'Приложение показывает афишу этого города: выбери в нём место, от которого считать дорогу.',
      buttons: [openApp()],
    };
  }
  return {
    text:
      '📍 Точка получена. Открой приложение — посчитаю дорогу и время до каждого места от неё.\n\n' +
      'Координаты я не сохраняю: они есть только в кнопке ниже (с точностью около 100 м).',
    buttons: [openApp('🗺 Открыть от этой точки', launchFromPoint(point))],
  };
}

export function renderLocationRequest() {
  return {
    text:
      'Нажми кнопку ниже и отправь геолокацию — я открою приложение от этой точки.\n\n' +
      'Если отправить не получается (например, в веб-версии MAX), выбери в приложении место на карте.',
    buttons: [shareLocation, openApp('Выбрать место в приложении')],
  };
}

export function renderAbout() {
  return {
    text:
      '«Досуг Казани» — прототип для хакатона MAX (трек «Досуг и развлечения»).\n\n' +
      'Как устроено: подборка событий, карта, план вечера с дорогой, маршрут и приглашения друзьям — в мини-приложении. ' +
      'Этот чат — вход в него и уведомления: напоминание перед выбранным вечером и «<имя> идёт!», когда друг принял ' +
      'приглашение. Геолокацию, отправленную сюда, приложение использует как точку старта.\n\n' +
      'Данные: выставки, экскурсии и спектакли — из афиши KudaGo, кафе и спортивные объекты — из OpenStreetMap. ' +
      'Концерты, стендап, группы секций и часть других событий — тестовые, подготовленные для демонстрации: ' +
      'в приложении у каждой точки указан источник.\n' +
      `${sourceLine()}\n\n` +
      'Что бот хранит: твой идентификатор в MAX, напоминания о выбранных вечерах и приглашения, чтобы сообщить, ' +
      'когда друг ответит. Геолокацию не запоминает. Ещё бот считает, сколько раз за день проходят шаги сценария ' +
      '(/stats) — только числа, без данных о тебе. Всё сохранённое можно стереть кнопкой ниже или командой /delete.',
    buttons: [openApp(), [{ text: '🗑 Удалить мои данные', action: 'menu:delete' }]],
  };
}

export function renderDeleteConfirm() {
  return {
    text: 'Удалить всё, что бот о тебе хранит: напоминания и приглашения? Это нельзя отменить.',
    buttons: [
      [{ text: '🗑 Да, удалить', action: 'delete:yes' }],
      [{ text: '↩️ Отмена', action: 'menu:cancel' }],
    ],
  };
}

export function renderDeleted() {
  return {
    text:
      'Готово: всё, что бот хранил о тебе, удалено. Планы, сохранённые в самом приложении, ' +
      'стираются в его профиле: «Стереть данные на этом устройстве».',
    buttons: [openApp()],
  };
}

const percent = (part, whole) => (whole ? ` (${Math.round((part / whole) * 100)}%)` : '');

export function renderStats(now) {
  const { days, totals } = summarize(getStore(), { days: 7, now });
  const lines = FUNNEL.map(
    ([step, label]) => `${label}: ${totals[step]}${step === 'app_plan' ? percent(totals.app_plan, totals.app_open) : ''}`
  );
  return {
    text:
      `📊 Статистика за ${days} дней — только счётчики шагов, без данных пользователей.\n\n` +
      `${lines.join('\n')}\n\n` +
      'Процент у выбранных планов — от числа открытий приложения.',
    buttons: [openApp()],
  };
}
