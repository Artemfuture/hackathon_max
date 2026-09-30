import { useMemo, useRef, useState } from 'react';
import EventRoute from '../components/EventRoute.jsx';
import FeedRow from '../components/FeedRow.jsx';
import FilterSheet from '../components/FilterSheet.jsx';
import FindMap, { markOf } from '../components/FindMap.jsx';
import PlaceCard from '../components/PlaceCard.jsx';
import Sheet from '../components/Sheet.jsx';
import SourceNote from '../components/SourceNote.jsx';
import { CalendarIcon, CloseIcon, ListIcon, LocateIcon, MapIcon, PinIcon, SearchIcon, SlidersIcon } from '../components/icons.jsx';
import { getCatalog } from '../data/catalog.js';
import { dateText, dayOffset, nowMinutes } from '../lib/clock.js';
import { DEFAULT_FILTERS, activeFilterCount, maxPriceOf, windowFor } from '../lib/findFilters.js';
import { useDragScroll } from '../hooks/useDragScroll.js';
import { cx, plural } from '../lib/format.js';
import { fitsWindow, isFlexible, onDay, priceForUser, reachability, toMin } from '../lib/planner.js';
import styles from './FindScreen.module.css';

export default function FindScreen({
  origin,
  benefits,
  dateId,
  onDate,
  onCalendar,
  onPickOrigin,
  onOpenEvent,
  onAdd,
  draftIds,
  hasDraft,
}) {
  const { events, moods, categories } = getCatalog();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [kind, setKind] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const [routeFor, setRouteFor] = useState(null);
  const chipsRef = useRef(null);
  useDragScroll(chipsRef);
  const kindsRef = useRef(null);

  const today = dateId === 'today';
  const now = today ? nowMinutes() : null;
  const day = dayOffset(dateId);
  const dayLabel = today ? 'Сегодня' : dateId === 'tomorrow' ? 'Завтра' : dateText(dateId, { short: true });

  const matching = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const { from, until } = windowFor(filters.time, now);
    const maxPrice = maxPriceOf(filters);
    return events
      .filter((event) => onDay(event, day))
      .filter((event) => {
        const text = `${event.title} ${event.place} ${event.kind} ${event.description ?? ''}`.toLowerCase();
        return words.every((word) => text.includes(word));
      })
      .filter((event) => priceForUser(event, benefits) <= maxPrice)
      .filter((event) => !filters.pushkin || event.pushkin)
      .filter((event) => !filters.mood || event.moods.includes(filters.mood))
      .filter((event) => fitsWindow(event, from, until))
      .map((event) => ({ event, price: priceForUser(event, benefits), reach: reachability(event, { origin, now }) }))
      .filter(({ reach }) => !(now != null && reach.status === 'late'))
      .filter(({ event, reach }) => !filters.openNow || !today || (isFlexible(event) ? reach.open : toMin(event.start) - now <= 90));
  }, [events, day, query, filters, benefits, origin, now, today]);

  const counts = useMemo(() => {
    const result = {};
    for (const { event } of matching) result[event.category] = (result[event.category] ?? 0) + 1;
    return result;
  }, [matching]);

  const inCategory = useMemo(
    () => (category === 'all' ? matching : matching.filter(({ event }) => event.category === category)),
    [matching, category]
  );
  const kinds = useMemo(() => {
    if (category !== 'sport') return [];
    const result = new Map();
    for (const { event } of inCategory) {
      const entry = result.get(event.kind) ?? { kind: event.kind, icon: event.icon ?? '🏃', count: 0, groups: 0 };
      entry.count += 1;
      if (event.group) entry.groups += 1;
      result.set(event.kind, entry);
    }
    return [...result.values()].sort((a, b) => b.groups - a.groups || b.count - a.count);
  }, [inCategory, category]);

  useDragScroll(kindsRef, kinds.length > 1);

  const items = useMemo(() => {
    const chosen = kind ? inCategory.filter(({ event }) => event.kind === kind) : inCategory;
    const road = (item) => item.reach.leg?.minutes ?? 0;
    return [...chosen].sort((a, b) => road(a) - road(b));
  }, [inCategory, kind]);

  const chips = [
    { id: 'all', label: 'Всё', count: matching.length },
    ...categories
      .filter((item) => counts[item.id])
      .map((item) => ({ id: item.id, label: `${item.emoji} ${item.label}`, count: counts[item.id] })),
  ];
  const selected = items.find((item) => item.event.id === selectedId) ?? null;
  const siblings = selected
    ? items.filter(
        ({ event }) =>
          event.id !== selected.event.id &&
          Math.abs(event.lat - selected.event.lat) < 1e-4 &&
          Math.abs(event.lon - selected.event.lon) < 1e-4
      )
    : [];
  const activeFilters = activeFilterCount(filters);

  const pick = (id) => {
    setSelectedId(id);
    if (id) setListOpen(false);
  };
  const bottomInset = hasDraft ? 84 : 0;

  return (
    <div className={styles.root} style={{ '--draft-inset': `${bottomInset}px` }}>
      <FindMap
        items={items}
        origin={origin}
        selectedId={selectedId}
        onSelect={pick}
        focus={focus}
        fitKey={category === 'all' ? null : `${category}:${kind ?? ''}:${dateId}`}
        bottomInset={selected ? 220 : 80}
      />

      <div className={styles.top}>
        <div className={styles.searchRow}>
          <label className={styles.search}>
            <SearchIcon size={20} />
            <input
              type="search"
              placeholder="Кафе, выставка, спектакль…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Поиск по карте"
            />
            {query && (
              <button type="button" className={styles.clear} onClick={() => setQuery('')} aria-label="Очистить поиск">
                <CloseIcon size={16} />
              </button>
            )}
          </label>
          <button
            type="button"
            className={cx(styles.round, activeFilters > 0 && styles.roundOn)}
            onClick={() => setFiltersOpen(true)}
            aria-label="Фильтры"
          >
            <SlidersIcon size={20} />
            {activeFilters > 0 && <span className={styles.count}>{activeFilters}</span>}
          </button>
        </div>
        <div className={styles.chips} ref={chipsRef}>
          <button type="button" className={cx(styles.chip, styles.dateChip)} onClick={onCalendar}>
            <CalendarIcon size={15} />
            {dayLabel}
          </button>
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={cx(styles.chip, category === chip.id && styles.chipOn)}
              style={chip.id !== 'all' ? { '--dot': markOf(chip.id).color } : undefined}
              onClick={() => {
                setCategory(chip.id);
                setKind(null);
                setSelectedId(null);
              }}
            >
              {chip.label}
              <span className={styles.chipCount}>{chip.count}</span>
            </button>
          ))}
        </div>
        {kinds.length > 1 && (
          <div className={cx(styles.chips, styles.subChips)} ref={kindsRef}>
            <button
              type="button"
              className={cx(styles.chip, styles.subChip, !kind && styles.chipOn)}
              onClick={() => setKind(null)}
            >
              Все виды
            </button>
            {kinds.map((option) => (
              <button
                key={option.kind}
                type="button"
                className={cx(styles.chip, styles.subChip, kind === option.kind && styles.chipOn)}
                onClick={() => {
                  setKind(kind === option.kind ? null : option.kind);
                  setSelectedId(null);
                }}
              >
                {option.icon} {option.kind}
                <span className={styles.chipCount}>
                  {option.groups > 0 ? `${option.groups} ${plural(option.groups, 'группа', 'группы', 'групп')}` : option.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.bottom}>
        <div className={styles.tools}>
          <button type="button" className={styles.tool} onClick={onPickOrigin} aria-label="Откуда считать дорогу">
            <PinIcon size={16} />
            <span>{origin?.label ?? 'Откуда?'}</span>
          </button>
          <button type="button" className={styles.round} onClick={() => setFocus((value) => value + 1)} aria-label="Ко мне">
            <LocateIcon size={20} />
          </button>
        </div>

        {selected ? (
          <PlaceCard
            item={selected}
            dayLabel={dayLabel}
            siblings={siblings}
            inPlan={draftIds.has(selected.event.id)}
            onSelect={setSelectedId}
            onOpen={() => onOpenEvent(selected.event)}
            onRoute={() => setRouteFor(selected.event)}
            onAdd={() => onAdd(selected.event, dateId)}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <button type="button" className={styles.summary} onClick={() => setListOpen(true)}>
            <span>
              <b>{items.length}</b> {plural(items.length, 'место', 'места', 'мест')} и событий
              {today ? ' — можно успеть сегодня' : ` на ${dateText(dateId)}`}
            </span>
            <span className={styles.summaryAction}>
              <ListIcon size={18} /> Списком
            </span>
          </button>
        )}
      </div>

      {routeFor && origin && (
        <EventRoute
          event={routeFor}
          origin={origin}
          onClose={() => setRouteFor(null)}
          onOpenEvent={(item) => {
            setRouteFor(null);
            onOpenEvent(item);
          }}
        />
      )}

      <Sheet open={listOpen} title={`${dayLabel}: ${items.length} ${plural(items.length, 'место', 'места', 'мест')}`} onClose={() => setListOpen(false)}>
        <div className={styles.list}>
          {items.slice(0, 80).map(({ event, price, reach }) => (
            <FeedRow
              key={event.id}
              event={event}
              price={price}
              reach={reach}
              day={dayLabel}
              inPlan={draftIds.has(event.id)}
              onOpen={() => onOpenEvent(event)}
              onAdd={() => onAdd(event, dateId)}
            />
          ))}
          {items.length > 80 && <p className={styles.more}>Показаны 80 ближайших — уточните поиск или категорию.</p>}
          {items.length === 0 && <p className={styles.more}>Ничего не нашлось — смягчите фильтры или выберите другой день.</p>}
          <button type="button" className={styles.toMap} onClick={() => setListOpen(false)}>
            <MapIcon size={18} /> На карте
          </button>
        </div>
        <SourceNote />
      </Sheet>

      <FilterSheet
        open={filtersOpen}
        filters={filters}
        onChange={setFilters}
        dateId={dateId}
        onDate={onDate}
        onCalendar={onCalendar}
        moods={moods}
        found={items.length}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  );
}
