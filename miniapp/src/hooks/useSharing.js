import { getCity } from '../data/catalog.js';
import { getUserId, getUserName, haptic, launchLink, shareText } from '../bridge.js';
import { announcePlan } from '../lib/api.js';
import { toClock } from '../lib/format.js';
import { encodeLaunchParam } from '../lib/launch.js';
import { dateLabel } from '../lib/prefs.js';
import { routeText } from '../lib/share.js';

export function useSharing(notify) {
  const send = async (payload, copied) => {
    try {
      const how = await shareText(payload);
      haptic('success');
      if (how === 'clipboard') notify(copied);
    } catch (error) {
      if (error?.name !== 'AbortError') notify('Не получилось поделиться. Попробуйте ещё раз');
    }
  };

  const inviteFriend = (plan, dateId) => {
    announcePlan({ planId: plan.id, date: dateId });
    const name = getUserName();
    const link = launchLink(encodeLaunchParam({ kind: 'plan', planId: plan.id, date: dateId, name, userId: getUserId() }));
    const stops = plan.stops.map((stop) => stop.item.kind).join(' → ');
    const text =
      `${name ? `${name} приглашает` : 'Приглашаю'} на вечер (${getCity()}, ${dateLabel(dateId)?.toLowerCase()}): ` +
      `${stops}, ${toClock(plan.start)}–${toClock(plan.end)}.`;
    return send({ text, link }, 'Ссылка-приглашение скопирована');
  };

  const shareRoute = (plan, dateId, dayText = null) => {
    const day = dayText ?? dateLabel(dateId)?.toLowerCase() ?? 'в выбранный день';
    const text = routeText(plan, { city: getCity(), day });
    const link = dateId ? launchLink(encodeLaunchParam({ kind: 'mine', planId: plan.id, date: dateId })) : null;
    return send({ text, link }, 'Маршрут скопирован — вставьте его в любой чат');
  };

  return { inviteFriend, shareRoute };
}
