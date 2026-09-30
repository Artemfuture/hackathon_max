import { useMemo, useState } from 'react';
import { haptic } from '../bridge.js';
import { dateIdFor, isoDate, nowMinutes } from '../lib/clock.js';
import { GEO_ID, PIN_ID, landmarkOrigin, sanitizePin } from '../lib/geo.js';
import {
  DEFAULT_PREFS,
  applyBotBenefits,
  applyBotPrefs,
  sanitizeBenefits,
  sanitizeMoods,
  sanitizePrefs,
  withValidFrom,
} from '../lib/prefs.js';
import { usePersistentState } from './usePersistentState.js';

const withValidDate = (prefs) => ({ ...prefs, date: dateIdFor(isoDate(prefs.date)) ?? 'today' });

function toggleExclusive(current, id, only) {
  if (id === only) return current.includes(only) ? [] : [only];
  const rest = current.filter((item) => item !== only);
  return rest.includes(id) ? rest.filter((item) => item !== id) : [...rest, id];
}

export function useSettings({ launch, landmarks, moodList }) {
  const firstPlace = landmarks[0]?.id ?? null;
  const [prefs, setPrefs] = usePersistentState('dosug.prefs', DEFAULT_PREFS, sanitizePrefs, (stored) =>
    withValidFrom(withValidDate(applyBotPrefs(stored, launch)), nowMinutes())
  );
  const [moods, setMoods] = usePersistentState('dosug.moods', ['any'], (saved) =>
    sanitizeMoods(
      saved,
      moodList.map((mood) => mood.id)
    )
  );
  const [benefits, setBenefits] = usePersistentState('dosug.benefits', [], sanitizeBenefits, (stored) =>
    applyBotBenefits(stored, launch)
  );
  const [originId, setOriginId] = usePersistentState(
    'dosug.origin',
    firstPlace,
    (saved) => (saved === PIN_ID || landmarks.some((place) => place.id === saved) ? saved : firstPlace),
    (stored) =>
      launch?.kind === 'from' && landmarks.some((place) => place.id === launch.place) ? launch.place : stored
  );
  const [pin, setPin] = usePersistentState('dosug.pin', null, sanitizePin);
  const [geo, setGeo] = useState(() =>
    launch?.kind === 'here' ? { id: GEO_ID, label: 'Точка из чата', lat: launch.lat, lon: launch.lon } : null
  );
  const origin = useMemo(
    () => geo ?? (originId === PIN_ID && pin ? pin : landmarkOrigin(landmarks, originId)),
    [geo, pin, landmarks, originId]
  );

  const updatePrefs = (change) =>
    setPrefs((current) => withValidFrom({ ...current, ...change(current), extra: 0 }, nowMinutes()));

  const changePref = (key, value) => {
    haptic();
    updatePrefs(() => ({ [key]: value }));
  };

  const toggleMood = (id) => {
    haptic();
    setMoods((current) => toggleExclusive(current, id, 'any'));
  };

  const toggleBenefit = (id) => {
    haptic();
    setBenefits((current) => toggleExclusive(current, id, 'none'));
  };

  const pickOrigin = (next) => {
    haptic('success');
    if (next.id === GEO_ID) setGeo(next);
    else {
      setGeo(null);
      if (next.id === PIN_ID) setPin(next);
      setOriginId(next.id);
    }
  };

  const reset = () => {
    setPrefs(DEFAULT_PREFS);
    setMoods(['any']);
    setBenefits([]);
    setPin(null);
    setGeo(null);
    setOriginId(firstPlace);
  };

  return {
    prefs,
    moods,
    benefits,
    origin,
    setPrefs,
    updatePrefs,
    changePref,
    toggleMood,
    toggleBenefit,
    pickOrigin,
    reset,
  };
}
