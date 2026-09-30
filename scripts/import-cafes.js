#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOsmHours, pickHours } from '../src/data/hours.js';
import { addressOf, distanceM, overpass } from './overpass.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'cafes.json');
const CENTER = { lat: 55.7887, lon: 49.1221 };
const RADIUS_M = Number(process.env.RADIUS_M) || 4500;
const LIMIT = Number(process.env.LIMIT) || 400;
const FIRST_NUMBER = 50001;

const QUERY = `[out:json][timeout:60];
nwr["amenity"~"^(cafe|restaurant|bar|pub)$"]["name"](around:${RADIUS_M},${CENTER.lat},${CENTER.lon});
out center tags;`;

const TYPES = {
  coffee: { kind: 'Кофейня', photo: 'cafe', durationMin: 40, minVisitMin: 20, price: 350, moods: ['rest', 'meet'] },
  cafe: { kind: 'Кафе', photo: 'cafe', durationMin: 60, minVisitMin: 30, price: 700, moods: ['rest', 'meet'] },
  restaurant: { kind: 'Ресторан', photo: 'cafe', durationMin: 90, minVisitMin: 45, price: 1500, moods: ['rest', 'meet'] },
  bar: { kind: 'Бар', photo: 'bar', durationMin: 90, minVisitMin: 40, price: 1000, moods: ['meet', 'wow'] },
  pub: { kind: 'Паб', photo: 'bar', durationMin: 90, minVisitMin: 40, price: 1000, moods: ['meet', 'rest'] },
};

const CUISINES = {
  coffee_shop: 'кофе',
  tea: 'чай',
  regional: 'местная',
  local: 'местная',
  tatar: 'татарская',
  russian: 'русская',
  pizza: 'пицца',
  italian: 'итальянская',
  italian_pizza: 'пицца',
  pasta: 'паста',
  burger: 'бургеры',
  breakfast: 'завтраки',
  brunch: 'бранчи',
  chinese: 'китайская',
  georgian: 'грузинская',
  oriental: 'восточная',
  uzbek: 'узбекская',
  american: 'американская',
  vietnamese: 'вьетнамская',
  japanese: 'японская',
  sushi: 'суши',
  asian: 'азиатская',
  korean: 'корейская',
  thai: 'тайская',
  indian: 'индийская',
  turkish: 'турецкая',
  greek: 'греческая',
  german: 'немецкая',
  french: 'французская',
  mexican: 'мексиканская',
  seafood: 'морепродукты',
  fish: 'рыба',
  grill: 'гриль',
  barbecue: 'гриль',
  steak_house: 'стейки',
  cake: 'десерты',
  dessert: 'десерты',
  ice_cream: 'мороженое',
  crepe: 'блины',
  bubble_tea: 'бабл-ти',
  vegetarian: 'вегетарианская',
  vegan: 'веганская',
  international: 'международная',
  european: 'европейская',
};

function typeOf(tags) {
  const cuisine = (tags.cuisine ?? '').split(';');
  if (tags.amenity === 'cafe' && (cuisine.includes('coffee_shop') || /кофе|coffee/i.test(tags.name))) return 'coffee';
  return tags.amenity;
}

function describe(tags, type) {
  const cuisines = [
    ...new Set(
      (tags.cuisine ?? '')
        .split(';')
        .map((c) => CUISINES[c.trim()])
        .filter(Boolean)
    ),
  ];
  const parts = [];
  if (cuisines.length) parts.push(`Кухня: ${cuisines.slice(0, 4).join(', ')}.`);
  if (tags.outdoor_seating === 'yes') parts.push('Есть летняя веранда.');
  if (!parts.length) parts.push(`${TYPES[type].kind} в центре города.`);
  return parts.join(' ');
}

async function main() {
  const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { places: [] };
  const numbers = new Map(previous.places.map((place) => [place.osm, Number(place.id.replace(/^\D+/, ''))]));
  let next = Math.max(FIRST_NUMBER - 1, ...numbers.values()) + 1;

  const elements = await overpass(QUERY);
  const places = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    const point = element.type === 'node' ? element : element.center;
    if (!point || !tags.name) continue;
    const picked = pickHours(parseOsmHours(tags.opening_hours));
    if (!picked || picked.days.every((open) => !open)) continue;
    const type = typeOf(tags);
    const profile = TYPES[type];
    if (!profile) continue;
    const osm = `${element.type}/${element.id}`;
    places.push({
      osm,
      distance: distanceM(CENTER, point),
      type,
      tags,
      point,
      picked,
      profile,
    });
  }

  places.sort((a, b) => a.distance - b.distance);
  const seen = new Set();
  const chosen = [];
  for (const place of places) {
    const key = `${place.tags.name.toLowerCase()}|${Math.round(place.point.lat * 2000)}|${Math.round(place.point.lon * 2000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(place);
    if (chosen.length >= LIMIT) break;
  }

  const output = chosen.map(({ osm, type, tags, point, picked, profile }) => {
    if (!numbers.has(osm)) numbers.set(osm, next++);
    const website = tags.website ?? tags['contact:website'] ?? null;
    return {
      id: `osm-${numbers.get(osm)}`,
      osm,
      format: 'place',
      category: 'food',
      kind: profile.kind,
      title: tags.name,
      place: tags.name,
      address: addressOf(tags),
      lat: Math.round(point.lat * 1e6) / 1e6,
      lon: Math.round(point.lon * 1e6) / 1e6,
      hours: { ...picked.hours, minVisitMin: profile.minVisitMin },
      schedule: { days: picked.days },
      openingHours: tags.opening_hours,
      durationMin: profile.durationMin,
      price: profile.price,
      priceEstimate: true,
      free: false,
      pushkin: false,
      moods: profile.moods,
      photo: profile.photo,
      outdoor: false,
      description: describe(tags, type),
      link: website && /^https?:\/\//.test(website) ? website : `https://www.openstreetmap.org/${osm}`,
      source: 'osm',
    };
  });

  const data = {
    source: {
      name: 'OpenStreetMap',
      license: 'ODbL — © участники OpenStreetMap',
      updatedAt: new Date().toISOString().slice(0, 10),
      center: CENTER,
      radiusM: RADIUS_M,
    },
    places: output,
  };
  writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
  console.log(`Сохранено ${output.length} заведений в ${path.relative(ROOT, OUT)} (найдено ${elements.length}).`);
}

main().catch((err) => {
  console.error(`Не удалось выгрузить кафе: ${err.message}`);
  process.exit(1);
});
