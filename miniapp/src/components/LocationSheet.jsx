import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { ChatIcon, CheckIcon, LocateIcon, MapIcon } from './icons.jsx';
import { botChatLink, isInMax, openMaxLink } from '../bridge.js';
import { getCity } from '../data/catalog.js';
import { failureText, requestChatLocation } from '../lib/api.js';
import { requestPosition, GEO_ID, PIN_ID } from '../lib/geo.js';
import { cx } from '../lib/format.js';
import styles from './LocationSheet.module.css';

const CHAT_HINT = 'Бот пришлёт кнопку «📍» — после отправки приложение откроется от этой точки';

function geoError(error) {
  if (error?.message === 'far') {
    return `Вы сейчас не в городе ${getCity()} — до него около ${error.km} км. Выберите место в городе ниже`;
  }
  if (error?.code === 1) return 'Доступ к геолокации запрещён — разрешите его или выберите точку ниже';
  if (error?.message === 'unsupported') return 'Здесь геолокация недоступна — выберите точку ниже';
  if (error?.code === 3 || error?.message === 'timeout') {
    return 'Телефон не ответил вовремя — попробуйте ещё раз или выберите точку ниже';
  }
  return 'Не получилось определить — попробуйте ещё раз или выберите точку ниже';
}

export default function LocationSheet({ open, landmarks, current, onPick, onPickOnMap, onClose }) {
  const [state, setState] = useState({ status: 'idle', message: null });
  const [chat, setChat] = useState({ status: 'idle', message: null });

  const locate = async () => {
    setState({ status: 'loading', message: null });
    try {
      const origin = await requestPosition();
      setState({ status: 'idle', message: null });
      onPick(origin);
    } catch (error) {
      setState({ status: 'error', message: geoError(error) });
    }
  };

  const viaChat = async () => {
    setChat({ status: 'loading', message: null });
    const result = await requestChatLocation();
    if (!result.ok) {
      setChat({ status: 'error', message: failureText(result, 'Не получилось написать в чат — выберите точку ниже') });
      return;
    }
    setChat({ status: 'idle', message: 'Кнопка «📍» ждёт вас в чате с ботом' });
    const link = botChatLink();
    if (link) openMaxLink(link);
  };

  const pinned = current?.id === PIN_ID;

  return (
    <Sheet open={open} title="Откуда начинаем?" onClose={onClose}>
      <p className={styles.lead}>От этой точки посчитаю дорогу и время до каждого места.</p>
      <div className={styles.options}>
        <button type="button" className={cx(styles.option, current?.id === GEO_ID && styles.selected)} onClick={locate}>
          <span className={styles.icon}>
            <LocateIcon size={20} />
          </span>
          <span className={styles.text}>
            <span className={styles.title}>{state.status === 'loading' ? 'Определяю…' : 'Где я сейчас'}</span>
            <span className={cx(styles.hint, state.status === 'error' && styles.error)}>
              {state.message ?? 'По геолокации телефона, никуда не отправляется'}
            </span>
          </span>
          {current?.id === GEO_ID && <CheckIcon size={20} className={styles.check} />}
        </button>

        <button type="button" className={cx(styles.option, pinned && styles.selected)} onClick={onPickOnMap}>
          <span className={styles.icon}>
            <MapIcon size={20} />
          </span>
          <span className={styles.text}>
            <span className={styles.title}>{pinned ? current.label : 'Точка на карте'}</span>
            <span className={styles.hint}>
              {pinned ? 'Нажмите, чтобы поправить' : 'Найти адрес или поставить булавку точно'}
            </span>
          </span>
          {pinned && <CheckIcon size={20} className={styles.check} />}
        </button>

        {isInMax() && (
          <button type="button" className={styles.option} onClick={viaChat}>
            <span className={styles.icon}>
              <ChatIcon size={20} />
            </span>
            <span className={styles.text}>
              <span className={styles.title}>
                {chat.status === 'loading' ? 'Пишу в чат…' : 'Отправить геолокацию в чат'}
              </span>
              <span className={cx(styles.hint, chat.status === 'error' && styles.error)}>
                {chat.message ?? CHAT_HINT}
              </span>
            </span>
          </button>
        )}
      </div>

      <p className={styles.section}>Или рядом с местом</p>
      <div className={styles.grid}>
        {landmarks.map((place) => (
          <button
            key={place.id}
            type="button"
            className={cx(styles.place, current?.id === place.id && styles.selected)}
            onClick={() =>
              onPick({ id: place.id, label: place.label, emoji: place.emoji, lat: place.lat, lon: place.lon })
            }
          >
            <span className={styles.emoji} aria-hidden="true">
              {place.emoji ?? '📍'}
            </span>
            <span className={styles.placeLabel}>{place.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
