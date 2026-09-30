import { useCallback, useState } from 'react';
import { haptic } from '../bridge.js';
import { dateIdFor, dayOffset, dayWord, isoDate, nextSlot, nowMinutes } from '../lib/clock.js';
import { readDrafts, writeDraft } from '../lib/draft.js';
import { toClock } from '../lib/format.js';
import { insertIntoPlan, isFlexible, removeFromPlan, similarFitting, toMin } from '../lib/planner.js';
import { getPlan, singlePlan, windowOf } from '../lib/plans.js';

export const REPLACE_FAILED = 'Даже после замены не складывается по времени';

function lastStartOf(place) {
  const close = place.hours.close === '24:00' ? '23:59' : place.hours.close;
  return toMin(close) - (place.hours.minVisitMin ?? 30);
}

export function useDrafts({ prefs, benefits, events, notify, onConflict }) {
  const [drafts, setDrafts] = useState(() => readDrafts(isoDate('today')));

  const draftOn = useCallback(
    (dateId) => {
      const id = dateId ? drafts[isoDate(dateId)] : null;
      return id ? getPlan(id, benefits, dateId) : null;
    },
    [drafts, benefits]
  );

  const save = (dateId, plan) => setDrafts((current) => writeDraft(current, isoDate(dateId), plan?.id ?? null));

  const keep = useCallback((dateId, plan) => {
    const date = isoDate(dateId);
    setDrafts((current) => (current[date] === plan.id ? current : writeDraft(current, date, plan.id)));
  }, []);

  const startFrom = (dateId) => (dateId === 'today' ? nextSlot() : windowOf({ ...prefs, date: dateId }).from);

  const add = (target, day = 'today') => {
    const dateId = dateIdFor(isoDate(day)) ?? 'today';
    const today = dateId === 'today';
    const notBefore = today ? nowMinutes() : 0;
    const current = draftOn(dateId);
    if (current?.stops.some((stop) => stop.item.id === target.id)) {
      notify(`Это уже в «Моём плане» на ${dayWord(dateId)}`);
      return;
    }
    if (!current) {
      if (today && !isFlexible(target) && toMin(target.start) < notBefore) {
        notify('Это уже началось — сегодня не успеть');
        return;
      }
      let from = startFrom(dateId);
      if (!today && isFlexible(target)) from = Math.min(from, lastStartOf(target));
      const next = singlePlan(target, benefits, from);
      if (!next || next.start < notBefore) {
        notify(today ? 'Сегодня туда уже не успеть — выберите другой день' : 'В этот день не получается');
        return;
      }
      haptic('success');
      save(dateId, next);
      notify(`«Мой план» на ${dayWord(dateId)}: ${target.kind.toLowerCase()} в ${toClock(next.start)}`);
      return;
    }
    const result = insertIntoPlan(current, target, { benefits, notBefore });
    if (result.ok) {
      haptic('success');
      save(dateId, result.plan);
      const stop = result.plan.stops.find((item) => item.item.id === target.id);
      notify(`Добавил на ${dayWord(dateId)}: ${target.kind.toLowerCase()} в ${toClock(stop.start)}`);
      return;
    }
    if (result.reason === 'duplicate') {
      notify('Это уже в «Моём плане»');
      return;
    }
    haptic();
    onConflict({
      item: target,
      result,
      draftDate: dateId,
      similar: similarFitting(current, target, events, { day: dayOffset(dateId), benefits, notBefore }),
    });
  };

  const replace = ({ item, result, draftDate }) => {
    const current = draftOn(draftDate);
    const notBefore = draftDate === 'today' ? nowMinutes() : 0;
    const without = current && removeFromPlan(current, result.conflictWith.item.id, { benefits });
    const retry = without
      ? insertIntoPlan(without, item, { benefits, notBefore })
      : { ok: true, plan: singlePlan(item, benefits, draftDate === 'today' ? nextSlot() : 0) };
    if (!retry.ok || !retry.plan) {
      notify(REPLACE_FAILED);
      return;
    }
    save(draftDate, retry.plan);
    notify(`Заменил: теперь ${item.kind.toLowerCase()} в «Моём плане»`);
  };

  const restart = ({ item, draftDate }) => {
    const next = singlePlan(item, benefits, startFrom(draftDate));
    if (!next) return;
    save(draftDate, next);
    notify(`Новый «Мой план» на ${dayWord(draftDate)}: ${item.kind.toLowerCase()} в ${toClock(next.start)}`);
  };

  return {
    draftOn,
    add,
    replace,
    restart,
    keep,
    drop: (dateId) => save(dateId, null),
    clear: () => setDrafts({}),
  };
}
