import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeLaunchParam, parseLaunchParam } from '../src/lib/launch.js';

test('параметр запуска: имя с кириллицей переживает кодирование', () => {
  const param = encodeLaunchParam({ kind: 'plan', planId: 'classic', date: 'today', userId: 42, name: 'Виталий' });
  assert.match(param, /^[A-Za-z0-9_-]+$/, 'в ссылке только безопасные символы');
  assert.deepEqual(parseLaunchParam(param), {
    kind: 'plan',
    planId: 'classic',
    date: 'today',
    userId: '42',
    name: 'Виталий',
  });
});

test('параметр запуска: без имени разбирается, имя пустое, неизвестный id — null', () => {
  const param = encodeLaunchParam({ kind: 'going', planId: 'calm', date: 'tomorrow' });
  assert.equal(param, 'going_calm_tomorrow_0');
  const parsed = parseLaunchParam(param);
  assert.equal(parsed.name, null);
  assert.equal(parsed.userId, null);
});

test('параметр запуска: имя с «_» и «-» внутри base64 не ломает разбор', () => {
  for (const name of ['Ёж??', 'Ян>>', 'А~~~~', 'Zoë♥♥']) {
    const param = encodeLaunchParam({ kind: 'plan', planId: 'classic', date: 'today', userId: 7, name });
    assert.equal(parseLaunchParam(param).name, name);
  }
});

test('параметр запуска: длинное имя обрезается', () => {
  const param = encodeLaunchParam({ kind: 'plan', planId: 'classic', date: 'today', userId: 7, name: 'а'.repeat(200) });
  assert.equal(parseLaunchParam(param).name.length, 40);
});

test('параметр запуска: свой вечер (mine) и подборка из бота (prefs)', () => {
  assert.equal(encodeLaunchParam({ kind: 'mine', planId: 'calm', date: 'weekend' }), 'mine_calm_weekend');
  assert.deepEqual(parseLaunchParam('mine_calm_weekend'), { kind: 'mine', planId: 'calm', date: 'weekend' });

  const prefs = encodeLaunchParam({ kind: 'prefs', date: 'today', budget: 'free', benefit: 'pushkin' });
  assert.equal(prefs, 'prefs_today_free_pushkin');
  assert.deepEqual(parseLaunchParam(prefs), { kind: 'prefs', date: 'today', budget: 'free', benefit: 'pushkin' });
});

test('параметр запуска: мусор и чужие виды игнорируются', () => {
  assert.equal(parseLaunchParam(null), null);
  assert.equal(parseLaunchParam(''), null);
  assert.equal(parseLaunchParam('hello'), null);
  assert.equal(parseLaunchParam('admin_classic_today_1'), null);
  assert.equal(parseLaunchParam('plan_classic'), null);
  assert.equal(parseLaunchParam('plan_classic_today'), null, 'без id организатора приглашение не принимается');
  assert.equal(parseLaunchParam('plan_classic_today_abc'), null, 'id должен быть числом');
  assert.equal(parseLaunchParam('prefs_today_free'), null);
  assert.equal(parseLaunchParam('mine_calm'), null);
});

test('параметр запуска: повреждённое имя не роняет разбор', () => {
  const parsed = parseLaunchParam('plan_classic_today_5_%%%');
  assert.equal(parsed.planId, 'classic');
  assert.equal(parsed.name, null);
});

test('ссылки из «рядом» в боте: от известного места и от присланной точки', () => {
  assert.equal(encodeLaunchParam({ kind: 'from', place: 'kremlin' }), 'from_kremlin');
  assert.deepEqual(parseLaunchParam('from_kremlin'), { kind: 'from', place: 'kremlin' });
  assert.equal(parseLaunchParam('from_Кремль'), null);

  assert.equal(encodeLaunchParam({ kind: 'here', lat: 55.78751, lon: 49.12234 }), 'here_55788_49122');
  assert.deepEqual(parseLaunchParam('here_55788_49122'), { kind: 'here', lat: 55.788, lon: 49.122 });
  assert.equal(parseLaunchParam('here_55788'), null);
  assert.equal(parseLaunchParam('here_999999_49122'), null);
});

test('код плана из планировщика проходит в ссылке-приглашении без искажений', () => {
  const param = encodeLaunchParam({ kind: 'plan', planId: 'r1140-101-203-155', date: 'today', userId: 7, name: 'Аня' });
  assert.deepEqual(parseLaunchParam(param), {
    kind: 'plan',
    planId: 'r1140-101-203-155',
    date: 'today',
    userId: '7',
    name: 'Аня',
  });
  assert.match(param, /^[A-Za-z0-9_-]+$/);
});
