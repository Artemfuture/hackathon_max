import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPlannerEvents } from '../src/data/events.js';
import {
  MAX_WALK_MIN,
  adaptPlan,
  onDay,
  START_MARGIN_MIN,
  buildPlans,
  curatedPlan,
  decodePlan,
  encodePlan,
  insertIntoPlan,
  isPlanCode,
  priceForUser,
  reachability,
  removeFromPlan,
  setVisit,
  simulate,
  visitBounds,
  similarFitting,
  toClock,
  toMin,
  travel,
  yandexGoUrl,
  yandexMapsRouteUrl,
} from '../shared/planner.js';

const MONDAY_NOON = Date.UTC(2026, 8, 21, 9, 0);
const events = getPlannerEvents(MONDAY_NOON);
const byId = (id) => events.find((event) => event.id === id);
const TUKAY = { lat: 55.7875, lon: 49.1223 };

test('дорога: рядом — пешком, далеко — на такси; такси быстрее пешком на длинных отрезках', () => {
  const near = travel(TUKAY, byId('evt-203'));
  assert.equal(near.mode, 'walk');
  assert.ok(near.minutes <= MAX_WALK_MIN);

  const far = travel(TUKAY, byId('evt-209'));
  assert.equal(far.mode, 'taxi');
  assert.ok(far.walk > MAX_WALK_MIN);
  assert.ok(far.taxi < far.walk);
  assert.equal(far.minutes, far.taxi);
});

test('проход по плану: на сеанс приходим заранее, место ждёт по часам работы, опоздание — не план', () => {
  const revizor = byId('evt-002');
  const bauman = byId('evt-203');
  const stops = simulate([bauman, revizor], { at: toMin('18:30'), origin: TUKAY });
  assert.ok(stops);
  const [walk, show] = stops;
  assert.ok(walk.end + travel(bauman, revizor).minutes <= toMin('19:30') - START_MARGIN_MIN);
  assert.equal(show.start, toMin('19:30'));

  assert.equal(simulate([revizor], { at: toMin('19:40'), origin: TUKAY }), null, 'к 19:30 уже не успеть');
  const museum = byId('evt-204');
  assert.equal(simulate([museum], { at: toMin('17:50') }), null, 'за 10 минут до закрытия музей не посмотреть');
});

test('подбор: планы укладываются в окно, бюджет и начинаются не раньше, чем человек свободен', () => {
  const query = { day: 'today', from: toMin('18:30'), until: toMin('22:30'), budget: 1500, origin: TUKAY };
  const plans = buildPlans(events, query);
  assert.ok(plans.length >= 2, 'есть из чего выбрать');
  assert.equal(plans[0].label, 'Лучший вариант');
  for (const plan of plans) {
    assert.ok(plan.stops[0].start >= query.from);
    assert.ok(plan.end <= query.until);
    assert.ok(plan.price <= query.budget);
    for (const stop of plan.stops) assert.ok(stop.item.days.includes('today'));
  }
  const firsts = plans.map((plan) => plan.stops[0].item.id);
  assert.equal(new Set(firsts).size, firsts.length, 'варианты начинаются с разного');
});

test('подбор: «бесплатно» даёт только бесплатные точки, с «Пушкинской картой» — и платные по карте', () => {
  const query = { day: 'today', from: toMin('18:00'), until: toMin('23:00'), budget: 0, origin: TUKAY };
  for (const plan of buildPlans(events, query)) assert.equal(plan.price, 0);

  const withCard = buildPlans(events, { ...query, benefits: ['pushkin'] });
  const paidByCard = withCard.flatMap((plan) => plan.stops).filter((stop) => stop.item.price > 0);
  for (const stop of paidByCard) assert.ok(stop.item.pushkin, `${stop.item.id} — по карте`);
});

test('подбор: настроение поднимает подходящие точки наверх', () => {
  const query = { day: 'today', from: toMin('18:30'), until: toMin('22:00'), origin: TUKAY };
  const [move] = buildPlans(events, { ...query, moods: ['move'] });
  assert.ok(move.stops.some((stop) => stop.item.moods.includes('move')));
  const [learn] = buildPlans(events, { ...query, moods: ['learn'] });
  assert.ok(learn.stops.some((stop) => stop.item.moods.includes('learn')));
});

test('подбор: «достроить вечер» оставляет выбранное событие в плане', () => {
  const standup = byId('evt-155');
  const [plan] = buildPlans(
    events,
    { day: 'today', from: toMin('18:00'), until: toMin('23:30'), origin: TUKAY },
    { include: standup }
  );
  assert.ok(plan.stops.some((stop) => stop.item.id === 'evt-155'));
});

test('код плана: ссылка восстанавливает тот же вечер, мусор и чужой день не принимаются', () => {
  const [plan] = buildPlans(events, { day: 'today', from: toMin('18:30'), until: toMin('22:30'), origin: TUKAY });
  assert.ok(isPlanCode(plan.id));
  assert.equal(plan.id, encodePlan(plan.stops, toMin('22:30')));
  assert.match(plan.id, /^r\d+u1350-/, 'в коде — конец окна, чтобы последний визит сократился так же');

  const restored = decodePlan(plan.id, events, { day: 'today' });
  assert.deepEqual(
    restored.stops.map((stop) => [stop.item.id, stop.start, stop.end]),
    plan.stops.map((stop) => [stop.item.id, stop.start, stop.end])
  );
  assert.equal(restored.durationMin, plan.durationMin);

  assert.equal(decodePlan('r1140-999', events), null, 'нет такой точки');
  assert.equal(decodePlan('r1140-101-101', events), null, 'точка дважды');
  assert.equal(decodePlan('classic', events), null);
  assert.equal(decodePlan('r1-002', events), null, 'сеанс не может начаться в 00:01');
  assert.equal(decodePlan('r1170-002', events, { day: 'weekend' }), null);
});

test('редакторский план «Классика» считается по данным: 19:00–22:40, 1 440 ₽, 21 минута пешком', () => {
  const plan = curatedPlan(
    {
      id: 'classic',
      stops: [
        { eventId: 'evt-101', walkBefore: 0 },
        { eventId: 'evt-102', walkBefore: 1 },
        { eventId: 'evt-103', walkBefore: 20 },
      ],
    },
    events
  );
  assert.equal(toClock(plan.start), '19:00');
  assert.equal(toClock(plan.end), '22:40');
  assert.equal(plan.price, 590 + 0 + 850);
  assert.equal(plan.walkMin, 21);
});

test('льготы: «Пушкинская карта» обнуляет цену, студенческая — своя, выгоднее из двух', () => {
  const exhibition = byId('evt-101');
  assert.equal(priceForUser(exhibition, []), 590);
  assert.equal(priceForUser(exhibition, ['student']), 390);
  assert.equal(priceForUser(exhibition, ['pushkin', 'student']), 0);
});

test('«успеваете»: запас до начала, «впритык» и «не успеете»', () => {
  const revizor = byId('evt-002');
  const walk = travel(TUKAY, revizor).minutes;
  assert.equal(reachability(revizor, { origin: TUKAY, now: toMin('18:30') }).status, 'ok');
  assert.equal(reachability(revizor, { origin: TUKAY, now: toMin('19:30') - walk - 3 }).status, 'tight');
  assert.equal(reachability(revizor, { origin: TUKAY, now: toMin('19:31') }).status, 'late');
  assert.equal(reachability(revizor, { origin: TUKAY }).status, null, 'для другого дня статус не считается');
});

test('правка плана: событие встаёт по времени, конфликт объясняется нехваткой минут', () => {
  const kino = byId('evt-157');
  const park = byId('evt-210');
  const base = buildPlans(
    events,
    { day: 'today', from: toMin('19:00'), until: toMin('22:30') },
    { include: kino, limit: 1 }
  )[0];
  assert.ok(base);

  const standup = byId('evt-155');
  const conflict = insertIntoPlan(base, standup);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, 'conflict');
  assert.ok(conflict.shortfall > 0);
  assert.equal(conflict.conflictWith.item.id, 'evt-157');

  const alternatives = similarFitting(base, standup, events, { day: 'today' });
  for (const { plan } of alternatives) assert.ok(plan.stops.length === base.stops.length + 1);

  const withPark = base.stops.some((stop) => stop.item.id === park.id) ? base : insertIntoPlan(base, park).plan;
  assert.ok(withPark.stops.some((stop) => stop.item.id === park.id));
  assert.deepEqual(insertIntoPlan(withPark, park), { ok: false, reason: 'duplicate' });

  const without = removeFromPlan(withPark, park.id);
  assert.ok(!without.stops.some((stop) => stop.item.id === park.id));
});

test('ссылки: маршрут в Яндекс Картах через все точки и Яндекс Go с «откуда» и «куда»', () => {
  const a = { lat: 55.79, lon: 49.12 };
  const b = { lat: 55.8, lon: 49.1 };
  assert.equal(
    yandexMapsRouteUrl([a, b], 'walk'),
    'https://yandex.ru/maps/?mode=routes&rtext=55.79,49.12~55.8,49.1&rtt=pd'
  );
  assert.match(yandexMapsRouteUrl([a, b], 'taxi'), /rtt=auto$/);
  const go = yandexGoUrl(a, b);
  assert.match(go, /^https:\/\/3\.redirect\.appmetrica\.yandex\.com\/route\?/);
  assert.match(go, /start-lat=55\.79&start-lon=49\.12&end-lat=55\.8&end-lon=49\.1/);
  assert.match(go, /ref=dosugkazan/);
  assert.match(go, /appmetrica_tracking_id=25395763362139037$/);
});

test('время на месте: меняется вручную, попадает в код плана и не даёт опоздать на следующий сеанс', () => {
  const bauman = byId('evt-203');
  const kino = byId('evt-157');
  const stops = simulate([bauman, kino], { at: toMin('18:30') });
  const plan = decodePlan(encodePlan(stops), events);
  assert.equal(visitBounds(plan, 'evt-157'), null, 'у сеанса время задано афишей');

  const shorter = setVisit(plan, 'evt-203', 20);
  assert.equal(shorter.ok, true);
  const walk = shorter.plan.stops[0];
  assert.equal(walk.end - walk.start, 20);
  assert.match(shorter.plan.id, /-203d20-157$/, 'выставленное время — в коде плана');

  const restored = decodePlan(shorter.plan.id, events);
  assert.equal(restored.stops[0].end - restored.stops[0].start, 20, 'у друга по ссылке те же 20 минут');
  assert.equal(restored.id, shorter.plan.id);

  const tooLong = setVisit(shorter.plan, 'evt-203', 90);
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.conflictWith.item.id, 'evt-157', 'с 18:30 до кино в 19:30 полтора часа не пробыть');
  assert.equal(setVisit(plan, 'evt-203', 5).reason, 'bounds', 'меньше 10 минут нельзя');
  assert.equal(decodePlan('r1110-203d5-157', events), null, 'и в ссылке тоже');
  assert.equal(decodePlan('r1170d20-157', events), null);
  assert.equal(decodePlan('r1170-157d30', events), null, 'время на месте — только у мест, не у сеансов');

  const withPark = insertIntoPlan(shorter.plan, byId('evt-210'));
  assert.equal(withPark.ok, true);
  const kept = withPark.plan.stops.find((stop) => stop.item.id === 'evt-203');
  assert.equal(kept.end - kept.start, 20);
});

test('день плана: номер дня от сегодня — ежедневные точки идут всегда, разовые — в свой день', () => {
  const daily = byId('evt-101');
  const revizor = byId('evt-002');
  const concert = byId('evt-004');
  assert.equal(onDay(daily, 12), true);
  assert.equal(onDay(revizor, 0), true);
  assert.equal(onDay(revizor, 3), false);
  assert.equal(onDay(concert, 1), true);
  assert.equal(onDay(concert, 'tomorrow'), true, 'прежний формат дня тоже понимается');
  assert.equal(onDay(concert, null), true, 'день не важен');
});

test('перенос плана: что идёт и в новый день — остаётся, разовое заменяется похожим', () => {
  const [plan] = buildPlans(
    events,
    { day: 0, from: toMin('18:30'), until: toMin('23:00') },
    { include: byId('evt-002'), limit: 1 }
  );
  assert.ok(
    plan.stops.some((stop) => stop.item.id === 'evt-002'),
    'в плане «Ревизор» — он идёт только сегодня'
  );

  const moved = adaptPlan(plan, events, { day: 10 });
  assert.equal(moved.ok, true);
  assert.ok(!moved.plan.stops.some((stop) => stop.item.id === 'evt-002'), 'через 10 дней «Ревизора» нет');
  for (const stop of moved.plan.stops) assert.ok(onDay(stop.item, 10), `${stop.item.id} идёт в новый день`);
  const swap = moved.replaced.find((item) => item.from.id === 'evt-002');
  if (swap) {
    const original = byId('evt-002');
    assert.ok(
      swap.to.category === original.category || swap.to.moods.some((mood) => original.moods.includes(mood)),
      'замена той же категории или настроения'
    );
  }
  else assert.ok(moved.dropped.some((item) => item.id === 'evt-002'));

  const same = adaptPlan(plan, events, { day: 0 });
  assert.deepEqual(
    same.plan.stops.map((stop) => stop.item.id),
    plan.stops.map((stop) => stop.item.id),
    'в тот же день план не меняется'
  );
});

test('свой план: между точками можно оставить долгую паузу, а сеанс — закончиться после полуночи', () => {
  const museum = {
    id: 'kg-70000010',
    kind: 'Выставка',
    title: 'Утренняя выставка',
    category: 'museum',
    lat: 55.7955,
    lon: 49.1359,
    hours: { open: '10:00', close: '18:00', minVisitMin: 30 },
    durationMin: 60,
    daily: true,
    price: 200,
    moods: ['learn'],
  };
  const night = {
    id: 'kg-70000020',
    kind: 'Вечеринка',
    title: 'Ночной сет',
    category: 'show',
    lat: 55.7905,
    lon: 49.1225,
    start: '23:00',
    durationMin: 180,
    daily: true,
    price: 800,
    moods: ['wow'],
  };
  const all = [...events, museum, night];

  const [morning] = buildPlans(all, { day: 0, from: toMin('11:00'), until: toMin('12:00') }, { include: museum, limit: 1 });
  const theatre = byId('evt-002');
  const added = insertIntoPlan(morning, theatre);
  assert.equal(added.ok, true, 'спектакль вечером встаёт в план с утренней выставкой');
  const gap = added.plan.stops.find((stop) => stop.item.id === theatre.id).wait;
  assert.ok(gap > 50, `пауза ${gap} мин не мешает`);
  assert.ok(decodePlan(added.plan.id, all, { day: 0 }), 'и такой план открывается по коду');

  const late = insertIntoPlan(added.plan, night);
  assert.equal(late.ok, true, 'сеанс до 02:00 встаёт последним');
  assert.equal(late.plan.end, toMin('23:00') + 180);
  assert.equal(toClock(late.plan.end), '02:00');
  assert.ok(decodePlan(late.plan.id, all, { day: 0 }));
});
