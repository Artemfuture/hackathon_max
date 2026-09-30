import { useMemo, useState } from 'react';
import { isoDate } from '../lib/clock.js';
import { isArchived, readMyPlans, removeMyPlan, saveMyPlan, setMyPlanStatus } from '../lib/myPlans.js';

export function useSavedPlans() {
  const [entries, setEntries] = useState(readMyPlans);
  const today = isoDate('today');

  const upcoming = useMemo(() => entries.filter((entry) => !isArchived(entry, today)), [entries, today]);
  const marks = useMemo(() => new Set(upcoming.map((entry) => entry.date)), [upcoming]);

  return {
    entries,
    today,
    upcoming,
    marks,
    stats: { upcoming: upcoming.length, past: entries.length - upcoming.length, total: entries.length },
    save: (entry) => setEntries(saveMyPlan(entry)),
    setStatus: (entry, status) => setEntries(setMyPlanStatus(entry, status)),
    remove: (entry) => setEntries(removeMyPlan(entry.id, entry.date)),
    clear: () => setEntries([]),
  };
}
