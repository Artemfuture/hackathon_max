import { useEffect, useState } from 'react';
import { haptic } from '../bridge.js';
import { announcePlan, failureText, notifyGoing } from '../lib/api.js';
import { dateIdFor, dateText, dayOffset, nowMinutes, numericDate } from '../lib/clock.js';
import { toClock } from '../lib/format.js';
import { adaptPlan, insertIntoPlan, removeFromPlan, setVisit, similarFitting } from '../lib/planner.js';
import { findPlans, getPlan, planAround, singlePlan, windowOf, withOrigin } from '../lib/plans.js';
import { withValidFrom } from '../lib/prefs.js';
import { REPLACE_FAILED } from './useDrafts.js';

function adaptNote(result, dateId) {
  const parts = result.replaced.map((swap) => `${swap.from.kind.toLowerCase()} → «${swap.to.title}»`);
  if (result.dropped.length) parts.push(`без: ${result.dropped.map((item) => item.kind.toLowerCase()).join(', ')}`);
  return parts.length ? `На ${dateText(dateId)}: ${parts.join('; ')}` : `Всё из плана идёт и ${dateText(dateId)}`;
}

export function usePlan({ invite, nav, settings, events, drafts, saved, notify, onConflict }) {
  const { prefs, moods, benefits, origin } = settings;
  const selection = { prefs, moods, benefits, origin };
  const [plan, setPlan] = useState(() =>
    invite ? withOrigin(getPlan(invite.planId, benefits, invite.date), null) : null
  );
  const [planDate, setPlanDate] = useState(invite?.date ?? prefs.date);
  const [planDateText, setPlanDateText] = useState(null);
  const [seenPlans, setSeenPlans] = useState([]);
  const [editing, setEditing] = useState(null);

  const inEvening = nav.has('evening');
  const notBefore = planDate === 'today' ? nowMinutes() : 0;
  const isDraft = editing?.mode === 'draft';

  useEffect(() => {
    if (editing && !inEvening) setEditing(null);
  }, [editing, inEvening]);

  const { keep } = drafts;
  useEffect(() => {
    if (isDraft && plan && planDate) keep(planDate, plan);
  }, [isDraft, plan, planDate, keep]);

  useEffect(() => {
    setPlan((current) => (current ? withOrigin(current, invite ? null : origin) : current));
  }, [origin, invite]);

  const show = (next, dateId, text = null) => {
    setPlan(withOrigin(next, origin));
    setPlanDate(dateId);
    setPlanDateText(text);
  };

  const open = (next, dateId) => {
    show(next, dateId);
    setSeenPlans((current) => [...new Set([...current, next.id])]);
    nav.go('evening');
  };

  const openFromResults = (next, dateId) => {
    setSeenPlans(findPlans(selection).map((item) => item.id));
    open(next, dateId);
  };

  const rebuild = () => {
    const [next] = findPlans(selection, { limit: 1, skipIds: seenPlans });
    if (!next) {
      notify('Других вариантов под эти условия нет — попробуйте другое время');
      return;
    }
    haptic('success');
    setSeenPlans((current) => [...current, next.id]);
    setPlan(withOrigin(next, origin));
  };

  const buildAround = (target, dateId = prefs.date) => {
    const next = planAround(target, {
      ...selection,
      prefs: withValidFrom({ ...prefs, date: dateId }, nowMinutes()),
    });
    if (!next) {
      notify('Не получилось собрать вечер вокруг этого события');
      return;
    }
    show(next, dateId);
    setSeenPlans([next.id]);
    nav.replaceTop('evening');
  };

  const add = (target, dateId) => {
    if (!inEvening || !plan) {
      const next = singlePlan(target, benefits, windowOf(prefs).from);
      if (!next) return;
      show(next, dateId ?? prefs.date);
      nav.replaceTop('evening');
      return;
    }
    const result = insertIntoPlan(plan, target, { benefits, notBefore });
    if (result.ok) {
      haptic('success');
      setPlan(withOrigin(result.plan, origin));
      nav.backTo('evening');
      const stop = result.plan.stops.find((item) => item.item.id === target.id);
      notify(`Добавил: ${target.kind.toLowerCase()} в ${toClock(stop.start)}`);
      return;
    }
    if (result.reason === 'duplicate') {
      notify('Это событие уже в плане');
      return;
    }
    onConflict({
      item: target,
      result,
      similar: similarFitting(plan, target, events, { day: dayOffset(planDate), benefits, notBefore }),
    });
  };

  const replace = ({ item, result }) => {
    const without = removeFromPlan(plan, result.conflictWith.item.id, { benefits });
    const retry = without ? insertIntoPlan(without, item, { benefits, notBefore }) : { ok: false };
    if (!retry.ok) {
      notify(REPLACE_FAILED);
      return;
    }
    setPlan(withOrigin(retry.plan, origin));
    nav.backTo('evening');
  };

  const changeVisit = (item, minutes) => {
    const result = setVisit(plan, item.id, minutes, { benefits });
    if (result.ok) {
      haptic();
      setPlan(withOrigin(result.plan, origin));
      return;
    }
    if (result.reason === 'conflict' && result.conflictWith) {
      const next = result.conflictWith;
      notify(`Дольше нельзя: не успеете на ${next.item.kind.toLowerCase()} в ${toClock(next.start)}`);
    } else if (result.reason === 'bounds') {
      notify(minutes < result.bounds.min ? 'Меньше 10 минут не поставить' : 'Дольше место не работает');
    }
  };

  const removeStop = (item) => {
    const next = removeFromPlan(plan, item.id, { benefits });
    if (next) setPlan(withOrigin(next, origin));
  };

  const choose = () => {
    nav.go('confirm');
    saved.save({ id: plan.id, dateId: planDate });
    if (isDraft) {
      drafts.drop(planDate);
      setEditing(null);
    }
    announcePlan({ planId: plan.id, date: planDate }).then((result) => {
      if (result.skipped || (result.ok && result.data?.unchanged)) return;
      notify(
        result.ok
          ? 'План сохранён в чате с ботом'
          : failureText(result, 'Не получилось отправить план в чат. Вернитесь и выберите его ещё раз')
      );
    });
  };

  const acceptInvite = async () => {
    saved.save({ id: plan.id, dateId: planDate });
    setPlan(withOrigin(plan, origin));
    nav.go('today');
    if (!invite?.userId) return;
    const result = await notifyGoing({ organizerId: invite.userId, planId: invite.planId, date: invite.date });
    if (result.skipped || result.data?.notified === false) return;
    notify(
      result.ok
        ? 'Организатор получил уведомление'
        : failureText(result, 'Не получилось уведомить организатора — сообщите ему сами')
    );
  };

  const declineInvite = () => {
    setPlan(null);
    nav.goHome();
  };

  const openSaved = (target, entry) => {
    const dateId = dateIdFor(entry.date);
    show(target, dateId, dateId ? null : numericDate(entry.date));
    nav.go('today');
  };

  const editSaved = (target, entry) => {
    show(target, dateIdFor(entry.date) ?? 'today');
    setEditing({ entry, mode: 'edit' });
    nav.go('evening');
  };

  const reschedule = ({ plan: target, entry, purpose }, iso) => {
    const dateId = dateIdFor(iso);
    if (!dateId) return;
    const result = adaptPlan(target, events, {
      day: dayOffset(dateId),
      benefits,
      notBefore: dateId === 'today' ? nowMinutes() : 0,
    });
    if (!result.ok) {
      notify(`На ${dateText(dateId)} ничего из плана не проходит — соберите новый вечер`);
      return;
    }
    show(result.plan, dateId);
    setEditing({ entry, mode: purpose });
    nav.go('evening');
    notify(adaptNote(result, dateId));
  };

  const saveEditing = () => {
    const replaced = editing.mode === 'repeat' ? null : editing.entry;
    saved.save({ id: plan.id, dateId: planDate, replace: replaced });
    announcePlan({ planId: plan.id, date: planDate });
    notify(editing.mode === 'edit' ? 'План обновлён' : `План на ${dateText(planDate)} сохранён`);
    setEditing(null);
    nav.open(['plans']);
  };

  const openDraft = (dateId) => {
    const target = drafts.draftOn(dateId);
    if (!target) return;
    show(target, dateId);
    setSeenPlans([target.id]);
    setEditing({ mode: 'draft' });
    nav.go('evening');
  };

  const saveLabel =
    editing && !isDraft ? (editing.mode === 'edit' ? 'Сохранить изменения' : `Сохранить на ${dateText(planDate)}`) : null;

  return {
    plan,
    planDate,
    planDateText,
    isDraft,
    notBefore,
    saveLabel,
    open,
    openFromResults,
    rebuild,
    buildAround,
    add,
    replace,
    changeVisit,
    removeStop,
    choose,
    acceptInvite,
    declineInvite,
    openSaved,
    editSaved,
    reschedule,
    saveEditing,
    openDraft,
  };
}
