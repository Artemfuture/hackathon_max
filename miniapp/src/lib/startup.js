import { getStartParam } from '../bridge.js';
import { parseLaunchParam } from './launch.js';
import { planExists } from './plans.js';
import { isBudget, isDate } from './prefs.js';

const BOT_BENEFITS = new Set(['pushkin', 'none', 'unset']);
const WITH_INVITE = new Set(['plan', 'going', 'mine']);

export function readLaunch() {
  const launch = parseLaunchParam(getStartParam());
  if (!launch) return null;
  if (launch.kind === 'prefs') {
    return isDate(launch.date) && isBudget(launch.budget) && BOT_BENEFITS.has(launch.benefit) ? launch : null;
  }
  if (launch.kind === 'from' || launch.kind === 'here') return launch;
  return isDate(launch.date) && planExists(launch.planId, launch.date) ? launch : null;
}

export const inviteFrom = (launch) => (launch && WITH_INVITE.has(launch.kind) ? launch : null);

export function initialStack(launch) {
  switch (launch?.kind) {
    case 'plan':
      return ['invite'];
    case 'going':
      return ['going'];
    case 'mine':
      return ['plans', 'today'];
    case 'prefs':
      return ['when', 'mood', 'benefits', 'results'];
    default:
      return ['home'];
  }
}
