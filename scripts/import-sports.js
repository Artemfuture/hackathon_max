#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOsmHours, pickHours } from '../src/data/hours.js';
import { addressOf, distanceM, numberer, overpass } from './overpass.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'sports.json');
const CENTER = { lat: 55.7887, lon: 49.1221 };
const BBOX = '55.68,48.90,55.92,49.35';

const QUERY = `[out:json][timeout:90];
(
  nwr["leisure"~"^(sports_centre|stadium|ice_rink|swimming_pool|fitness_centre|sports_hall)$"]["name"](${BBOX});
  nwr["sport"]["name"](${BBOX});
);
out center tags;`;

const TYPES = {
  ice: { kind: 'Каток', icon: '⛸', photo: 'skating', durationMin: 60, minVisitMin: 40, price: 350, moods: ['move', 'rest'] },
  pool: { kind: 'Бассейн', icon: '🏊', photo: 'swimming', durationMin: 60, minVisitMin: 45, price: 500, moods: ['move', 'rest'] },
  fitness: { kind: 'Фитнес', icon: '🏋', photo: 'sport', durationMin: 90, minVisitMin: 60, price: 800, moods: ['move'], manualOnly: true },
  centre: { kind: 'Спорткомплекс', icon: '🏟', photo: 'sport', durationMin: 90, minVisitMin: 60, price: 400, moods: ['move'], manualOnly: true },
};

function typeOf(tags) {
  const sport = tags.sport ?? '';
  if (tags.leisure === 'ice_rink' || /ice_skating|ice_hockey|figure_skating/.test(sport)) return 'ice';
  if (tags.leisure === 'swimming_pool' || /swimming|water_polo|diving/.test(sport) || /бассейн|плават/i.test(tags.name)) return 'pool';
  if (tags.leisure === 'fitness_centre' || /fitness|yoga/.test(sport)) return 'fitness';
  if (['sports_centre', 'sports_hall', 'stadium'].includes(tags.leisure)) return 'centre';
  return null;
}

const SPORTS = {
  figure_skating: {
    kind: 'Фигурное катание',
    venueType: 'ice',
    icon: '⛸',
    photo: 'skating',
    templates: [
      { level: 'Начинающие', ages: '5–7 лет', days: [1, 3], time: 17 * 60 + 30, durationMin: 45, price: 600 },
      { level: 'Начинающие', ages: '8–12 лет', days: [0, 2, 4], time: 18 * 60 + 30, durationMin: 60, price: 650 },
      { level: 'Продолжающие', ages: '10–14 лет', days: [1, 3, 5], time: 16 * 60, durationMin: 75, price: 750 },
      { level: 'Взрослые с нуля', ages: 'от 18 лет', days: [1, 4], time: 20 * 60 + 30, durationMin: 60, price: 800 },
    ],
  },
  swimming: {
    kind: 'Плавание',
    venueType: 'pool',
    icon: '🏊',
    photo: 'swimming',
    templates: [
      { level: 'Обучение', ages: '6–9 лет', days: [0, 2, 4], time: 16 * 60 + 30, durationMin: 45, price: 550 },
      { level: 'Техника', ages: '10–14 лет', days: [1, 3], time: 18 * 60, durationMin: 60, price: 600 },
      { level: 'Взрослые, обучение', ages: 'от 18 лет', days: [0, 2], time: 20 * 60, durationMin: 60, price: 700 },
      { level: 'Аквааэробика', ages: 'от 18 лет', days: [5, 6], time: 11 * 60, durationMin: 45, price: 500 },
    ],
  },
};
const VENUES_PER_SPORT = 6;

const STRONG = {
  ice: /двор|арен|лед|зилант|ватан|баско|шайб|дюсш/i,
  pool: /бассейн|аква|олимп|буревестник|акчарлак|оргсинтез|водных/i,
};
const WEAK = /baby|бэби|детск|дети|крабик|осьминож|котик|spa|спа|hockey|магазин/i;

function venueScore(venue, type) {
  let score = 0;
  if (STRONG[type]?.test(venue.tags.name)) score += 3;
  if (type === 'ice' && /ice_skating|figure/.test(venue.tags.sport ?? '')) score += 2;
  if (type === 'pool' && venue.tags.leisure === 'sports_centre') score += 1;
  if (WEAK.test(venue.tags.name)) score -= 5;
  return score - distanceM(CENTER, venue.point) / 20000;
}
const DAY_NAMES = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const clock = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const websiteOf = (tags) => {
  const site = tags.website ?? tags['contact:website'] ?? null;
  return site && /^https?:\/\//.test(site) ? site : null;
};

async function main() {
  const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { venues: [], groups: [] };
  const venueNumber = numberer(previous.venues.map((item) => ({ key: item.osm, id: item.id })), 70001);
  const groupNumber = numberer(previous.groups.map((item) => ({ key: item.key, id: item.id })), 60001);

  const elements = await overpass(QUERY);
  const seen = new Set();
  const all = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    const point = element.type === 'node' ? element : element.center;
    const type = typeOf(tags);
    if (!point || !tags.name || !type || tags.access === 'private') continue;
    const key = `${tags.name.toLowerCase()}|${Math.round(point.lat * 1000)}|${Math.round(point.lon * 1000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const osm = `${element.type}/${element.id}`;
    all.push({ osm, tags, point, type, picked: pickHours(parseOsmHours(tags.opening_hours)) });
  }
  all.sort((a, b) => distanceM(CENTER, a.point) - distanceM(CENTER, b.point));

  const round = (value) => Math.round(value * 1e6) / 1e6;
  const venues = all
    .filter((venue) => venue.picked && venue.picked.days.some(Boolean))
    .map(({ osm, tags, point, type, picked }) => {
      const profile = TYPES[type];
      return {
        id: `osm-${venueNumber(osm)}`,
        osm,
        format: 'place',
        category: 'sport',
        kind: profile.kind,
        icon: profile.icon,
        title: capitalize(tags.name),
        place: capitalize(tags.name),
        address: addressOf(tags),
        lat: round(point.lat),
        lon: round(point.lon),
        hours: { ...picked.hours, minVisitMin: profile.minVisitMin },
        schedule: { days: picked.days },
        durationMin: profile.durationMin,
        price: profile.price,
        priceEstimate: true,
        free: false,
        pushkin: false,
        moods: profile.moods,
        photo: profile.photo,
        outdoor: tags.leisure === 'stadium',
        ...(profile.manualOnly && { manualOnly: true }),
        description: `${profile.kind}${tags.sport ? ` (${tags.sport.replace(/_/g, ' ').replace(/;/g, ', ')})` : ''}. Разовое посещение — оценка, точные цены и правила — на сайте объекта.`,
        link: websiteOf(tags) ?? `https://www.openstreetmap.org/${osm}`,
        phone: tags.phone ?? tags['contact:phone'] ?? null,
        source: 'osm',
      };
    });

  const groups = [];
  for (const [sportId, sport] of Object.entries(SPORTS)) {
    const places = all
      .filter((venue) => venue.type === sport.venueType)
      .sort((a, b) => venueScore(b, sport.venueType) - venueScore(a, sport.venueType))
      .slice(0, VENUES_PER_SPORT);
    places.forEach((venue, venueIndex) => {
      sport.templates.forEach((template, templateIndex) => {
        const shift = (venueIndex % 3) * 30;
        const days = template.days.map((day) => (day + (venueIndex % 2)) % 7);
        const start = template.time + shift;
        const key = `${venue.osm}|${sportId}|${templateIndex}`;
        const flags = Array.from({ length: 7 }, (_, day) => days.includes(day));
        groups.push({
          id: `sg-${groupNumber(key)}`,
          key,
          category: 'sport',
          kind: sport.kind,
          icon: sport.icon,
          title: `${template.level}, ${template.ages}`,
          place: capitalize(venue.tags.name),
          address: addressOf(venue.tags),
          lat: round(venue.point.lat),
          lon: round(venue.point.lon),
          time: clock(start),
          durationMin: template.durationMin,
          price: template.price + venueIndex * 50,
          free: false,
          pushkin: false,
          moods: ['move', 'learn'],
          photo: sport.photo,
          outdoor: false,
          manualOnly: true,
          description:
            `Тестовая группа: расписание, возраст и цена вымышлены, площадка настоящая. ` +
            `${sport.kind}, ${template.level.toLowerCase()} (${template.ages}): ${days.map((day) => DAY_NAMES[day]).join(', ')} в ${clock(start)}, ` +
            `${template.durationMin} мин. Первое занятие — пробное.`,
          link: websiteOf(venue.tags) ?? `https://www.openstreetmap.org/${venue.osm}`,
          phone: venue.tags.phone ?? venue.tags['contact:phone'] ?? null,
          source: 'demo',
          schedule: { days: flags },
          group: {
            sport: sportId,
            level: template.level,
            ages: template.ages,
            days: [...days].sort((a, b) => a - b).map((day) => DAY_NAMES[day]).join(', '),
            spots: 3 + ((venueIndex + templateIndex) % 6),
          },
        });
      });
    });
  }

  const data = {
    source: {
      name: 'OpenStreetMap',
      license: 'ODbL — © участники OpenStreetMap',
      updatedAt: new Date().toISOString().slice(0, 10),
      groups: 'тестовые данные: группы, расписание и цены вымышлены',
    },
    venues,
    groups,
  };
  writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
  const count = (list, field) => Object.entries(list.reduce((acc, item) => ({ ...acc, [item[field]]: (acc[item[field]] ?? 0) + 1 }), {}));
  console.log(`Объекты с часами работы: ${venues.length} — ${count(venues, 'kind').map(([k, n]) => `${k} ${n}`).join(', ')}`);
  console.log(`Тестовые группы: ${groups.length} — ${count(groups, 'kind').map(([k, n]) => `${k} ${n}`).join(', ')}`);
}

main().catch((err) => {
  console.error(`Не удалось выгрузить спортивные объекты: ${err.message}`);
  process.exit(1);
});
