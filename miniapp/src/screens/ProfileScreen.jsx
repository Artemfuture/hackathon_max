import { useState } from 'react';
import Button from '../components/Button.jsx';
import CheckRow from '../components/CheckRow.jsx';
import Lumi from '../components/Lumi.jsx';
import Screen from '../components/Screen.jsx';
import SourceNote from '../components/SourceNote.jsx';
import TileGroup from '../components/TileGroup.jsx';
import { ExternalIcon, PinIcon } from '../components/icons.jsx';
import { getCatalog } from '../data/catalog.js';
import { BENEFIT_OPTIONS, BUDGET_OPTIONS } from '../data/options.js';
import { cx, plural } from '../lib/format.js';
import styles from './ProfileScreen.module.css';

export default function ProfileScreen({
  profile,
  stats,
  benefits,
  moods,
  budget,
  origin,
  botLink,
  onToggleBenefit,
  onToggleMood,
  onBudget,
  onPickOrigin,
  onResetTours,
  onClearDevice,
  onOpenBot,
  onBack,
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const moodList = getCatalog().moods;
  const initial = [...(profile?.name ?? '').trim()][0]?.toUpperCase();

  return (
    <Screen onBack={onBack} title="Профиль" titleSize="md">
      <section className={styles.card}>
        {profile?.photo ? (
          <img className={styles.avatar} src={profile.photo} alt="" referrerPolicy="no-referrer" />
        ) : profile ? (
          <span className={styles.avatar}>{initial ?? '?'}</span>
        ) : (
          <Lumi pose="curious" size={64} />
        )}
        <div className={styles.who}>
          <p className={styles.name}>{profile?.name ?? 'Гость'}</p>
          <p className={styles.sub}>
            {profile
              ? profile.username
                ? `@${profile.username} · MAX`
                : 'Вы вошли через MAX'
              : 'Откройте приложение в MAX, чтобы звать друзей и получать напоминания'}
          </p>
        </div>
      </section>

      <dl className={styles.stats}>
        <div>
          <dt>{stats.upcoming}</dt>
          <dd>{plural(stats.upcoming, 'вечер впереди', 'вечера впереди', 'вечеров впереди')}</dd>
        </div>
        <div>
          <dt>{stats.past}</dt>
          <dd>{plural(stats.past, 'уже прошёл', 'уже прошли', 'уже прошли')}</dd>
        </div>
        <div>
          <dt>{stats.total}</dt>
          <dd>{plural(stats.total, 'план выбран', 'плана выбрано', 'планов выбрано')}</dd>
        </div>
      </dl>

      <h2 className={styles.h2}>Откуда обычно выхожу</h2>
      <button type="button" className={styles.origin} onClick={onPickOrigin}>
        <span className={styles.originIcon}>
          <PinIcon size={18} />
        </span>
        <span className={styles.originLabel}>{origin?.label ?? 'Не выбрано'}</span>
        <span className={styles.change}>Изменить</span>
      </button>

      <h2 className={styles.h2}>Льготы</h2>
      <div className={styles.rows}>
        {BENEFIT_OPTIONS.map((option) => (
          <CheckRow
            key={option.id}
            icon={option.emoji}
            title={option.title}
            hint={option.hint}
            checked={benefits.includes(option.id)}
            onChange={() => onToggleBenefit(option.id)}
          />
        ))}
      </div>

      <h2 className={styles.h2}>Что обычно хочется</h2>
      <div className={styles.pills}>
        {moodList.map((mood) => (
          <button
            key={mood.id}
            type="button"
            className={cx(styles.pill, moods.includes(mood.id) && styles.pillOn)}
            aria-pressed={moods.includes(mood.id)}
            onClick={() => onToggleMood(mood.id)}
          >
            {mood.emoji} {mood.label}
          </button>
        ))}
      </div>

      <div className={styles.block}>
        <TileGroup label="Бюджет на человека" options={BUDGET_OPTIONS} selected={budget} onChange={onBudget} />
      </div>

      <h2 className={styles.h2}>Подсказки и данные</h2>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onResetTours}>
          Показать подсказки Люми заново
        </Button>
        {botLink && (
          <Button variant="secondary" onClick={onOpenBot}>
            Открыть чат с ботом <ExternalIcon />
          </Button>
        )}
      </div>
      <p className={styles.note}>
        На этом устройстве хранятся только ваши настройки, точка старта и выбранные планы. Бот хранит фильтры,
        сохранённые события и напоминания — их стирает команда /delete в чате с ботом.
      </p>
      <button
        type="button"
        className={cx(styles.danger, confirmClear && styles.dangerConfirm)}
        onClick={() => {
          if (!confirmClear) {
            setConfirmClear(true);
            return;
          }
          setConfirmClear(false);
          onClearDevice();
        }}
      >
        {confirmClear ? 'Точно стереть? Нажмите ещё раз' : 'Стереть данные на этом устройстве'}
      </button>

      <SourceNote />
    </Screen>
  );
}
