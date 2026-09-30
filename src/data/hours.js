import { DAY, localIsoDate, localMidnight, utcOffsetMin } from './time.js';

const END_OF_DAY = 24 * 60;
const RU_DAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const OSM_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const clockMin = (text) => {
  const [h, m] = text.split(':').map(Number);
  return h * 60 + m;
};

export const minClock = (minutes) =>
  minutes >= END_OF_DAY
    ? '24:00'
    : `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

function interval(open, close) {
  const from = clockMin(open);
  let to = clockMin(close);
  if (to <= from) to = END_OF_DAY;
  return [from, Math.min(to, END_OF_DAY)];
}

function dayList(text, names) {
  const days = new Set();
  for (const part of text.split(',').map((piece) => piece.trim()).filter(Boolean)) {
    const [from, to] = part.split(/\s*[–-]\s*/);
    const a = names.indexOf(from);
    const b = to === undefined ? a : names.indexOf(to);
    if (a < 0 || b < 0) return null;
    for (let i = a; ; i = (i + 1) % 7) {
      days.add(i);
      if (i === b) break;
    }
  }
  return days;
}

export function parseRuTimetable(text) {
  if (typeof text !== 'string') return null;
  const clean = text.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  if (/^(ежедневно )?(весь день|круглосуточно)$/.test(clean)) return Array(7).fill([0, END_OF_DAY]);

  const week = Array(7).fill(null);
  const day = '(?:пн|вт|ср|чт|пт|сб|вс)';
  const rule = new RegExp(
    `((?:${day}(?:\\s*[–-]\\s*${day})?\\s*,?\\s*)+|ежедневно\\s*)(\\d{1,2}:\\d{2})\\s*[–-]\\s*(\\d{1,2}:\\d{2})`,
    'g'
  );
  let found = false;
  for (const match of clean.matchAll(rule)) {
    const days = match[1].trim().startsWith('ежедневно')
      ? new Set([0, 1, 2, 3, 4, 5, 6])
      : dayList(match[1].replace(/,\s*$/, ''), RU_DAYS);
    if (!days) return null;
    for (const index of days) week[index] = interval(match[2], match[3]);
    found = true;
  }
  return found ? week : null;
}

export function parseOsmHours(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  if (text.trim() === '24/7') return Array(7).fill([0, END_OF_DAY]);

  const week = Array(7).fill(null);
  let found = false;
  const rules = text
    .replace(/(\d{2}\+?)\s*,\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)\b)/g, '$1; ')
    .split(';')
    .map((piece) => piece.trim().replace(/\b(?:PH|SH)\s*,\s*|\s*,\s*(?:PH|SH)\b/g, ''))
    .filter(Boolean);
  for (const rawRule of rules) {
    if (/\b(?:PH|SH)\b/.test(rawRule)) continue;
    const match = /^(?:([A-Za-z,\s-]+?)\s+)?(off|closed|(?:\d{1,2}:\d{2}-\d{1,2}:\d{2}\+?(?:\s*,\s*)?)+)$/.exec(rawRule);
    if (!match) return null;
    const days = match[1] ? dayList(match[1].replace(/\s+/g, ''), OSM_DAYS) : new Set([0, 1, 2, 3, 4, 5, 6]);
    if (!days) return null;
    let value = null;
    if (!/^(off|closed)$/.test(match[2])) {
      const ranges = match[2]
        .split(',')
        .map((piece) => piece.trim().replace(/\+$/, ''))
        .filter(Boolean)
        .map((piece) => interval(...piece.split('-')));
      value = ranges.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    }
    for (const index of days) week[index] = value;
    found = true;
  }
  return found ? week : null;
}

export function pickHours(week, { minLength = 60 } = {}) {
  if (!Array.isArray(week) || week.every((day) => !day)) return null;
  const opens = [...new Set(week.filter(Boolean).map(([open]) => open))];
  const closes = [...new Set(week.filter(Boolean).map(([, close]) => close))];
  let best = null;
  for (const open of opens) {
    for (const close of closes) {
      if (close - open < minLength) continue;
      const days = week.map((day) => Boolean(day) && day[0] <= open && day[1] >= close);
      const count = days.filter(Boolean).length;
      const score = count * (close - open);
      if (!best || score > best.score || (score === best.score && count > best.count)) {
        best = { open, close, days, count, score };
      }
    }
  }
  return best ? { hours: { open: minClock(best.open), close: minClock(best.close) }, days: best.days } : null;
}

const weekdayOf = (ms) => (new Date(ms + utcOffsetMin() * 60_000).getUTCDay() + 6) % 7;

export const HORIZON_DAYS = 61;

export function openMaskFor(schedule, now = Date.now()) {
  const midnight = localMidnight(now);
  const dates = schedule.dates ? new Set(schedule.dates) : null;
  let mask = '';
  for (let offset = 0; offset < HORIZON_DAYS; offset += 1) {
    const ms = midnight + offset * DAY + 12 * 60 * 60_000;
    const iso = localIsoDate(ms);
    const open =
      (!schedule.days || schedule.days[weekdayOf(ms)] === true) &&
      (!schedule.from || iso >= schedule.from) &&
      (!schedule.until || iso <= schedule.until) &&
      (!dates || dates.has(iso));
    mask += open ? '1' : '0';
  }
  return mask;
}
