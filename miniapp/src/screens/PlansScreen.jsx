import { useMemo, useState } from 'react';
import Button from '../components/Button.jsx';
import CalendarSheet from '../components/CalendarSheet.jsx';
import DateStrip from '../components/DateStrip.jsx';
import Lumi from '../components/Lumi.jsx';
import MiniTimeline from '../components/MiniTimeline.jsx';
import ProfileButton from '../components/ProfileButton.jsx';
import Screen from '../components/Screen.jsx';
import Sheet from '../components/Sheet.jsx';
import { CalendarIcon, CheckIcon, CloseIcon, MapIcon, PlusIcon, RefreshIcon } from '../components/icons.jsx';
import { dateText } from '../lib/clock.js';
import { cx, formatDuration, formatPrice, toClock } from '../lib/format.js';
import { isArchived } from '../lib/myPlans.js';
import { getPlan } from '../lib/plans.js';
import styles from './PlansScreen.module.css';

const dateTitle = (iso) => {
  const text = new Date(`${iso}T12:00:00Z`).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const STATUS = {
  done: { label: 'Пройден', tone: 'ok' },
  cancelled: { label: 'Неактуален', tone: 'muted' },
  past: { label: 'День прошёл', tone: 'muted' },
};

function PlanSummary({ entry, plan, badge }) {
  return (
    <>
      <span className={styles.head}>
        <span className={styles.date}>{dateTitle(entry.date)}</span>
        {badge && <span className={cx(styles.badge, styles[badge.tone])}>{badge.label}</span>}
      </span>
      <MiniTimeline
        size="sm"
        start={toClock(plan.start)}
        end={toClock(plan.end)}
        stops={plan.stops.map((stop) => ({ title: stop.item.kind }))}
      />
      <span className={styles.meta}>
        {formatDuration(plan.durationMin)} · {plan.price === 0 ? 'бесплатно' : `${formatPrice(plan.price)}/чел`}
      </span>
    </>
  );
}

export default function PlansScreen({
  entries,
  benefits,
  today,
  onOpen,
  onEdit,
  onInvite,
  onShareRoute,
  onStatus,
  onMove,
  onRepeat,
  onRemove,
  onBuild,
  onProfile,
}) {
  const [tab, setTab] = useState('upcoming');
  const [day, setDay] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [menu, setMenu] = useState(null);

  const resolved = useMemo(
    () =>
      entries
        .map((entry) => ({ entry, plan: getPlan(entry.id, benefits) }))
        .filter(({ plan }) => plan)
        .sort((a, b) => a.entry.date.localeCompare(b.entry.date) || a.plan.start - b.plan.start),
    [entries, benefits]
  );
  const upcoming = resolved.filter(({ entry }) => !isArchived(entry, today));
  const archive = resolved.filter(({ entry }) => isArchived(entry, today)).reverse();
  const marks = useMemo(
    () => new Set(resolved.filter(({ entry }) => !isArchived(entry, today)).map(({ entry }) => entry.date)),
    [resolved, today]
  );
  const shown = day ? upcoming.filter(({ entry }) => entry.date === day) : upcoming;
  const header = <ProfileButton onClick={onProfile} />;

  if (resolved.length === 0) {
    return (
      <Screen tabBar headerRight={header} title="Мои планы" titleSize="md">
        <section className={styles.empty}>
          <Lumi
            pose="hello"
            size={140}
            float
            bubble="Здесь появятся вечера, которые вы выберете. Соберём первый?"
            side="top"
          />
          <Button onClick={() => onBuild()}>Собрать вечер</Button>
        </section>
      </Screen>
    );
  }

  const act = (action) => () => {
    action(menu);
    setMenu(null);
  };

  return (
    <Screen tabBar headerRight={header} title="Мои планы" titleSize="md">
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'upcoming'}
          className={cx(styles.tab, tab === 'upcoming' && styles.tabOn)}
          onClick={() => setTab('upcoming')}
        >
          Впереди <span>{upcoming.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'archive'}
          className={cx(styles.tab, tab === 'archive' && styles.tabOn)}
          onClick={() => setTab('archive')}
        >
          Архив <span>{archive.length}</span>
        </button>
      </div>

      {tab === 'upcoming' && (
        <>
          <DateStrip
            days={21}
            selected={day}
            marks={marks}
            allLabel="Все"
            onPick={setDay}
            onCalendar={() => setCalendarOpen(true)}
          />
          <div className={styles.list}>
            {shown.length === 0 && (
              <div className={styles.none}>
                <p>{day ? `На ${dateText(day)} планов нет.` : 'Впереди планов нет.'}</p>
                <Button variant="secondary" onClick={() => onBuild(day ?? undefined)}>
                  <PlusIcon size={18} />
                  &nbsp;Собрать вечер{day ? ` на ${dateText(day)}` : ''}
                </Button>
              </div>
            )}
            {shown.map(({ entry, plan }) => (
              <article key={`${entry.id}:${entry.date}`} className={styles.entry}>
                <button type="button" className={styles.open} onClick={() => onOpen(plan, entry)}>
                  <PlanSummary entry={entry} plan={plan} />
                </button>
                <div className={styles.actions}>
                  <button type="button" onClick={() => onEdit(plan, entry)}>
                    <RefreshIcon size={15} /> Изменить
                  </button>
                  <button type="button" onClick={() => onInvite(plan, entry)}>
                    <PlusIcon size={15} /> Позвать
                  </button>
                  <button type="button" onClick={() => onShareRoute(plan, entry)}>
                    <MapIcon size={15} /> Маршрут
                  </button>
                  <button
                    type="button"
                    className={styles.more}
                    aria-label="Ещё действия с планом"
                    onClick={() => setMenu({ entry, plan })}
                  >
                    ⋯
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'archive' && (
        <div className={cx(styles.list, styles.archiveList)}>
          {archive.length === 0 && <p className={styles.none}>Здесь будут пройденные и неактуальные планы.</p>}
          {archive.map(({ entry, plan }) => {
            const pastActive = entry.status === 'active';
            const badge = STATUS[pastActive ? 'past' : entry.status];
            const canRestore = !pastActive && entry.date >= today;
            return (
              <article key={`${entry.id}:${entry.date}`} className={cx(styles.entry, styles.archived)}>
                <button type="button" className={styles.open} onClick={() => onOpen(plan, entry)}>
                  <PlanSummary entry={entry} plan={plan} badge={badge} />
                </button>
                {pastActive && (
                  <div className={styles.ask}>
                    <span>Как прошло?</span>
                    <button type="button" onClick={() => onStatus(entry, 'done')}>
                      <CheckIcon size={15} /> Был
                    </button>
                    <button type="button" onClick={() => onStatus(entry, 'cancelled')}>
                      <CloseIcon size={15} /> Не состоялся
                    </button>
                  </div>
                )}
                <div className={styles.actions}>
                  <button type="button" onClick={() => onRepeat(plan, entry)}>
                    <CalendarIcon size={15} /> Повторить
                  </button>
                  {canRestore && (
                    <button type="button" onClick={() => onStatus(entry, 'active')}>
                      <RefreshIcon size={15} /> Вернуть
                    </button>
                  )}
                  <button type="button" className={styles.remove} onClick={() => onRemove(entry)}>
                    <CloseIcon size={15} /> Удалить
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CalendarSheet
        open={calendarOpen}
        title="Планы по дням"
        hint="Точкой отмечены дни, на которые уже есть план."
        selected={day}
        marks={marks}
        onPick={(iso) => {
          setDay(iso);
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />

      <Sheet open={Boolean(menu)} title={menu ? dateTitle(menu.entry.date) : ''} onClose={() => setMenu(null)}>
        {menu && (
          <div className={styles.menu}>
            <button type="button" onClick={act(({ entry }) => onStatus(entry, 'done'))}>
              <CheckIcon size={18} /> Отметить пройденным
            </button>
            <button type="button" onClick={act(({ plan, entry }) => onMove(plan, entry))}>
              <CalendarIcon size={18} /> Перенести на другой день
            </button>
            <button type="button" onClick={act(({ entry }) => onStatus(entry, 'cancelled'))}>
              <CloseIcon size={18} /> Неактуален — в архив
            </button>
            <button type="button" className={styles.danger} onClick={act(({ entry }) => onRemove(entry))}>
              Удалить план
            </button>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
