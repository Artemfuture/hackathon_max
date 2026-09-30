import { useCallback, useMemo, useState } from 'react';
import CalendarSheet from './components/CalendarSheet.jsx';
import ConflictSheet from './components/ConflictSheet.jsx';
import LocationSheet from './components/LocationSheet.jsx';
import MapPicker from './components/MapPicker.jsx';
import MyPlanBar from './components/MyPlanBar.jsx';
import TabBar from './components/TabBar.jsx';
import Toast from './components/Toast.jsx';
import { getCatalog } from './data/catalog.js';
import { botChatLink, getProfile, openMaxLink } from './bridge.js';
import { useDrafts } from './hooks/useDrafts.js';
import { useNavigation } from './hooks/useNavigation.js';
import { usePlan } from './hooks/usePlan.js';
import { useSavedPlans } from './hooks/useSavedPlans.js';
import { useSettings } from './hooks/useSettings.js';
import { useSharing } from './hooks/useSharing.js';
import { dateIdFor, dayWord, isoDate, nowMinutes, numericDate } from './lib/clock.js';
import { priceForUser, reachability } from './lib/planner.js';
import { homeWindow } from './lib/plans.js';
import { MAX_EXTRA_MIN, dateLabel } from './lib/prefs.js';
import { initialStack, inviteFrom, readLaunch } from './lib/startup.js';
import { resetTours } from './lib/tour.js';
import BenefitsScreen from './screens/BenefitsScreen.jsx';
import ConfirmScreen from './screens/ConfirmScreen.jsx';
import EveningScreen from './screens/EveningScreen.jsx';
import EventScreen from './screens/EventScreen.jsx';
import FindScreen from './screens/FindScreen.jsx';
import GoingScreen from './screens/GoingScreen.jsx';
import HomeScreen from './screens/HomeScreen.jsx';
import InviteScreen from './screens/InviteScreen.jsx';
import LoadingScreen from './screens/LoadingScreen.jsx';
import MoodScreen from './screens/MoodScreen.jsx';
import PickScreen from './screens/PickScreen.jsx';
import PlansScreen from './screens/PlansScreen.jsx';
import ProfileScreen from './screens/ProfileScreen.jsx';
import ResultsScreen from './screens/ResultsScreen.jsx';
import WhenScreen from './screens/WhenScreen.jsx';

const WITH_TABBAR = new Set(['home', 'find', 'plans', 'results', 'today']);
const WITH_DRAFT_BAR = new Set(['home', 'find']);

const CALENDAR_TITLES = {
  move: 'На какой день перенести?',
  repeat: 'На какой день повторить?',
  find: 'Что идёт в этот день',
  prefs: 'Когда свободны?',
};
const RESCHEDULE_HINT =
  'Что не идёт в выбранный день, Люми заменит похожим — план можно будет поправить перед сохранением.';
const MARKS_HINT = 'Точкой отмечены дни, на которые уже есть план.';
const STATUS_TOAST = { done: 'Отмечено: пройден', cancelled: 'План в архиве', active: 'План снова впереди' };

const idsOf = (plan) => new Set(plan ? plan.stops.map((stop) => stop.item.id) : []);
const savedDateText = (entry) => (dateIdFor(entry.date) ? null : numericDate(entry.date));

export default function App() {
  const { landmarks, moods: moodList, events } = getCatalog();
  const [launch] = useState(readLaunch);
  const [invite, setInvite] = useState(() => inviteFrom(launch));
  const [event, setEvent] = useState(null);
  const [eventDate, setEventDate] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [findDate, setFindDate] = useState('today');
  const [calendar, setCalendar] = useState(null);
  const [toast, setToast] = useState(null);
  const hideToast = useCallback(() => setToast(null), []);

  const nav = useNavigation(() => initialStack(launch), { onLeave: () => setInvite(null) });
  const settings = useSettings({ launch, landmarks, moodList });
  const { prefs, moods, benefits, origin } = settings;
  const saved = useSavedPlans();
  const drafts = useDrafts({ prefs, benefits, events, notify: setToast, onConflict: setConflict });
  const current = usePlan({ invite, nav, settings, events, drafts, saved, notify: setToast, onConflict: setConflict });
  const { plan, planDate } = current;
  const { inviteFriend, shareRoute } = useSharing(setToast);

  const { screen, stack } = nav;
  const homeDate = homeWindow().prefs.date;
  const barDate = screen === 'find' ? findDate : homeDate;
  const { draftOn } = drafts;
  const barDraft = useMemo(() => draftOn(barDate), [draftOn, barDate]);
  const homeDraftIds = useMemo(() => idsOf(draftOn(homeDate)), [draftOn, homeDate]);
  const findDraftIds = useMemo(() => idsOf(draftOn(findDate)), [draftOn, findDate]);

  const pickOrigin = (next) => {
    settings.pickOrigin(next);
    setLocationOpen(false);
    setMapOpen(false);
  };

  const openEvent = (next, dateId = null) => {
    setEvent(next);
    setEventDate(dateId);
    nav.go('event');
  };

  const { replaceTop } = nav;
  const finishLoading = useCallback(() => replaceTop('results'), [replaceTop]);

  const clearDevice = () => {
    try {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith('dosug.'))
        .forEach((key) => window.localStorage.removeItem(key));
    } catch {}
    settings.reset();
    saved.clear();
    drafts.clear();
    resetTours();
    setToast('Данные на этом устройстве стёрты');
  };

  const buildFor = (iso) => {
    if (iso) settings.updatePrefs(() => ({ date: dateIdFor(iso) ?? 'today' }));
    nav.switchTab('build');
  };

  const showAllPlans = () => {
    const { prefs: evening } = homeWindow();
    settings.updatePrefs((before) => ({ ...evening, budget: before.budget }));
    nav.reset(['home', 'results']);
  };

  const pickCalendarDay = (iso) => {
    const context = calendar;
    setCalendar(null);
    if (context?.purpose === 'prefs') settings.changePref('date', dateIdFor(iso) ?? 'today');
    else if (context?.purpose === 'find') setFindDate(dateIdFor(iso) ?? 'today');
    else if (context?.purpose === 'move' || context?.purpose === 'repeat') current.reschedule(context, iso);
  };

  const replaceConflicting = () => {
    setConflict(null);
    if (conflict.draftDate) drafts.replace(conflict);
    else current.replace(conflict);
  };

  const restartDraft = () => {
    setConflict(null);
    drafts.restart(conflict);
  };

  const pickSimilar = (alt) => {
    const target = conflict?.draftDate;
    setConflict(null);
    if (target) drafts.add(alt, target);
    else current.add(alt);
  };

  const eventView = useMemo(() => {
    if (!event) return null;
    const fromPlan = stack.includes('evening') || stack.includes('today');
    const dateId = fromPlan ? planDate : (eventDate ?? (stack[0] === 'find' ? findDate : prefs.date));
    const now = dateId === 'today' ? nowMinutes() : null;
    const inPlan = fromPlan && plan?.stops.some((stop) => stop.item.id === event.id);
    let mode = 'browse';
    if (stack.includes('today') || stack.includes('invite')) mode = 'view';
    else if (inPlan) mode = plan.stops.length > 1 ? 'inPlan' : 'view';
    else if (stack.includes('evening')) mode = 'pick';
    return { dateId, mode, price: priceForUser(event, benefits), reach: reachability(event, { origin, now }) };
  }, [event, eventDate, stack, findDate, planDate, plan, prefs.date, benefits, origin]);

  const inviteName = invite?.name ?? 'Друг';
  const pickPlace = () => setLocationOpen(true);

  return (
    <>
      {screen === 'home' && (
        <HomeScreen
          origin={origin}
          benefits={benefits}
          moods={moods}
          draftIds={homeDraftIds}
          hasDraft={Boolean(barDraft)}
          onPickOrigin={pickPlace}
          onSearch={() => nav.switchTab('find')}
          onAllPlans={showAllPlans}
          onAllEvents={() => nav.switchTab('find')}
          onOpenPlan={current.open}
          onOpenEvent={openEvent}
          onAdd={drafts.add}
          onProfile={() => nav.go('profile')}
        />
      )}

      {screen === 'profile' && (
        <ProfileScreen
          profile={getProfile()}
          stats={saved.stats}
          benefits={benefits}
          moods={moods}
          budget={prefs.budget}
          origin={origin}
          botLink={botChatLink()}
          onToggleBenefit={settings.toggleBenefit}
          onToggleMood={settings.toggleMood}
          onBudget={(id) => settings.changePref('budget', id)}
          onPickOrigin={pickPlace}
          onResetTours={() => {
            resetTours();
            setToast('Люми снова покажет подсказки на экранах');
          }}
          onClearDevice={clearDevice}
          onOpenBot={() => openMaxLink(botChatLink())}
          onBack={nav.back}
        />
      )}

      {screen === 'find' && (
        <FindScreen
          origin={origin}
          benefits={benefits}
          dateId={findDate}
          onDate={setFindDate}
          onCalendar={() => setCalendar({ purpose: 'find' })}
          onPickOrigin={pickPlace}
          onOpenEvent={openEvent}
          onAdd={drafts.add}
          draftIds={findDraftIds}
          hasDraft={Boolean(barDraft)}
        />
      )}

      {screen === 'plans' && (
        <PlansScreen
          entries={saved.entries}
          benefits={benefits}
          today={saved.today}
          onOpen={current.openSaved}
          onEdit={current.editSaved}
          onStatus={(entry, status) => {
            saved.setStatus(entry, status);
            setToast(STATUS_TOAST[status] ?? 'Готово');
          }}
          onMove={(target, entry) => setCalendar({ purpose: 'move', plan: target, entry })}
          onRepeat={(target, entry) => setCalendar({ purpose: 'repeat', plan: target, entry })}
          onRemove={(entry) => {
            saved.remove(entry);
            setToast('План удалён');
          }}
          onBuild={buildFor}
          onInvite={(target, entry) => inviteFriend(target, dateIdFor(entry.date))}
          onShareRoute={(target, entry) => shareRoute(target, dateIdFor(entry.date), savedDateText(entry))}
          onProfile={() => nav.go('profile')}
        />
      )}

      {screen === 'when' && (
        <WhenScreen
          prefs={prefs}
          origin={origin}
          onChange={settings.changePref}
          onPickDate={() => setCalendar({ purpose: 'prefs' })}
          onPickOrigin={pickPlace}
          onBack={nav.back}
          onNext={() => nav.go('mood')}
        />
      )}

      {screen === 'mood' && (
        <MoodScreen moods={moods} onToggle={settings.toggleMood} onBack={nav.back} onNext={() => nav.go('benefits')} />
      )}

      {screen === 'benefits' && (
        <BenefitsScreen
          benefits={benefits}
          onToggle={settings.toggleBenefit}
          onBack={nav.back}
          onNext={() => nav.go('loading')}
        />
      )}

      {screen === 'loading' && <LoadingScreen onDone={finishLoading} />}

      {screen === 'results' && (
        <ResultsScreen
          prefs={prefs}
          moods={moods}
          benefits={benefits}
          origin={origin}
          onBack={nav.back}
          onPickOrigin={pickPlace}
          onOpenPlan={current.openFromResults}
          onOpenEvent={openEvent}
          onAddTime={() =>
            settings.setPrefs((before) => ({ ...before, extra: Math.min(MAX_EXTRA_MIN, (before.extra ?? 0) + 30) }))
          }
          onEditTime={() => nav.open(['when'])}
          onTomorrow={() => settings.updatePrefs(() => ({ date: 'tomorrow' }))}
        />
      )}

      {screen === 'event' && event && eventView && (
        <EventScreen
          event={event}
          price={eventView.price}
          reach={eventView.reach}
          dateId={eventView.dateId}
          origin={origin}
          mode={eventView.mode}
          onBack={nav.back}
          onBuild={() => current.buildAround(event, eventView.dateId)}
          onAdd={() =>
            eventView.mode === 'browse'
              ? drafts.add(event, eventView.dateId ?? 'today')
              : current.add(event, eventView.dateId)
          }
          onRemove={() => {
            current.removeStop(event);
            nav.back();
          }}
        />
      )}

      {screen === 'evening' && plan && (
        <EveningScreen
          plan={plan}
          dateId={planDate}
          origin={origin}
          kicker={current.isDraft ? 'Мой план' : null}
          canRebuild={!current.isDraft && (stack.includes('results') || stack[0] === 'home')}
          onBack={nav.back}
          onOpenEvent={openEvent}
          onRemove={current.removeStop}
          onVisit={current.changeVisit}
          onAdd={() => nav.go('pick')}
          onRebuild={current.rebuild}
          onChoose={current.choose}
          saveLabel={current.saveLabel}
          onSave={current.saveLabel ? current.saveEditing : null}
          onCancel={nav.back}
        />
      )}

      {screen === 'pick' && plan && (
        <PickScreen
          plan={plan}
          dateId={planDate}
          benefits={benefits}
          notBefore={current.notBefore}
          onBack={nav.back}
          onOpen={openEvent}
          onAdd={current.add}
        />
      )}

      {screen === 'confirm' && plan && (
        <ConfirmScreen
          plan={plan}
          onBack={nav.back}
          onShare={() => inviteFriend(plan, planDate)}
          onSkip={() => nav.open(['plans', 'today'])}
        />
      )}

      {screen === 'invite' && plan && (
        <InviteScreen
          plan={plan}
          name={inviteName}
          dateLabel={dateLabel(planDate)}
          onAccept={current.acceptInvite}
          onDecline={current.declineInvite}
        />
      )}

      {screen === 'going' && plan && (
        <GoingScreen plan={plan} name={inviteName} onBack={nav.back} onOpenPlan={() => nav.go('today')} />
      )}

      {screen === 'today' && plan && (
        <EveningScreen
          confirmed
          plan={plan}
          dateId={planDate}
          origin={origin}
          onBack={nav.back}
          onOpenEvent={openEvent}
          dateText={current.planDateText}
          onInvite={planDate ? () => inviteFriend(plan, planDate) : null}
          onShareRoute={() => shareRoute(plan, planDate, planDate ? null : current.planDateText)}
        />
      )}

      {WITH_DRAFT_BAR.has(screen) && barDraft && (
        <MyPlanBar
          plan={barDraft}
          dayText={barDate === 'today' ? null : dayWord(barDate)}
          onOpen={() => current.openDraft(barDate)}
        />
      )}

      {WITH_TABBAR.has(screen) && (
        <TabBar active={nav.tab} onChange={nav.switchTab} badge={{ plans: saved.upcoming.length }} />
      )}

      <LocationSheet
        open={locationOpen}
        landmarks={landmarks}
        current={origin}
        onPick={pickOrigin}
        onPickOnMap={() => {
          setLocationOpen(false);
          setMapOpen(true);
        }}
        onClose={() => setLocationOpen(false)}
      />

      <MapPicker open={mapOpen} initial={origin} onPick={pickOrigin} onClose={() => setMapOpen(false)} />

      <CalendarSheet
        open={Boolean(calendar)}
        title={CALENDAR_TITLES[calendar?.purpose] ?? 'Выберите день'}
        hint={calendar?.purpose === 'move' || calendar?.purpose === 'repeat' ? RESCHEDULE_HINT : MARKS_HINT}
        selected={
          calendar?.purpose === 'find' ? isoDate(findDate) : calendar?.purpose === 'prefs' ? isoDate(prefs.date) : null
        }
        marks={saved.marks}
        onPick={pickCalendarDay}
        onClose={() => setCalendar(null)}
      />

      <ConflictSheet
        conflict={conflict}
        onClose={() => setConflict(null)}
        onReplace={replaceConflicting}
        onStartNew={conflict?.draftDate ? restartDraft : null}
        onPickSimilar={pickSimilar}
      />

      <Toast message={toast} onHide={hideToast} />
    </>
  );
}
