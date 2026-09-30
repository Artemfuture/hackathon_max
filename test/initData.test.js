import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInitData } from '../src/initData.js';
import { TEST_TOKEN as TOKEN, signedInitData } from './support/signedInitData.js';

const NOW = Date.UTC(2026, 8, 21, 9, 0);
const authDate = Math.floor(NOW / 1000);

const base = (extra = {}) => ({
  auth_date: String(authDate),
  query_id: 'q1',
  user: JSON.stringify({ id: 555, first_name: 'Анна', last_name: 'Иванова' }),
  ...extra,
});

test('корректно подписанные данные принимаются, пользователь и параметр запуска извлекаются', () => {
  const result = validateInitData(signedInitData(base({ start_param: 'plan_classic_today_7' })), TOKEN, { now: NOW });
  assert.equal(result.ok, true);
  assert.deepEqual(result.user, { id: '555', firstName: 'Анна' });
  assert.equal(result.startParam, 'plan_classic_today_7');
});

test('подмена любого поля ломает подпись', () => {
  const genuine = new URLSearchParams(signedInitData(base()));
  genuine.set('user', JSON.stringify({ id: 999, first_name: 'Чужой' }));
  assert.deepEqual(validateInitData(genuine.toString(), TOKEN, { now: NOW }), { ok: false, reason: 'signature' });
});

test('подпись, сделанная другим токеном, не проходит', () => {
  const foreign = signedInitData(base(), 'другой-токен');
  assert.deepEqual(validateInitData(foreign, TOKEN, { now: NOW }), { ok: false, reason: 'signature' });
});

test('нужен ровно один hash', () => {
  const noHash = new URLSearchParams(base()).toString();
  assert.equal(validateInitData(noHash, TOKEN, { now: NOW }).reason, 'hash');
  assert.equal(validateInitData(`${signedInitData(base())}&hash=00`, TOKEN, { now: NOW }).reason, 'hash');
});

test('повторяющийся параметр отклоняется, даже если подпись посчитана с ним', () => {
  const fields = base();
  const signed = new URLSearchParams(signedInitData(fields));
  signed.append('query_id', 'q2');
  assert.equal(validateInitData(signed.toString(), TOKEN, { now: NOW }).reason, 'duplicate');
});

test('пустые данные и отсутствие токена отклоняются', () => {
  assert.equal(validateInitData('', TOKEN).reason, 'missing');
  assert.equal(validateInitData(undefined, TOKEN).reason, 'missing');
  assert.equal(validateInitData(signedInitData(base()), '').reason, 'missing');
});

test('устаревшие данные запуска отклоняются, свежие с небольшим расхождением часов — нет', () => {
  const dayAndMore = signedInitData(base({ auth_date: String(authDate - 25 * 3600) }));
  assert.equal(validateInitData(dayAndMore, TOKEN, { now: NOW }).reason, 'expired');

  const hourAndMore = signedInitData(base({ auth_date: String(authDate - 3600 - 60) }));
  assert.equal(validateInitData(hourAndMore, TOKEN, { now: NOW }).reason, 'expired');
  const halfHour = signedInitData(base({ auth_date: String(authDate - 1800) }));
  assert.equal(validateInitData(halfHour, TOKEN, { now: NOW }).ok, true);

  const future = signedInitData(base({ auth_date: String(authDate + 3600) }));
  assert.equal(validateInitData(future, TOKEN, { now: NOW }).reason, 'expired');

  const skewed = signedInitData(base({ auth_date: String(authDate + 60) }));
  assert.equal(validateInitData(skewed, TOKEN, { now: NOW }).ok, true);
});

test('без auth_date или без пользователя данные не принимаются', () => {
  const noDate = base();
  delete noDate.auth_date;
  assert.equal(validateInitData(signedInitData(noDate), TOKEN, { now: NOW }).reason, 'expired');

  assert.equal(validateInitData(signedInitData(base({ user: 'не json' })), TOKEN, { now: NOW }).reason, 'user');
  assert.equal(
    validateInitData(signedInitData(base({ user: JSON.stringify({ first_name: 'Аноним' }) })), TOKEN, { now: NOW }).reason,
    'user'
  );
});

test('пробелы и «+» в значениях не портят проверку', () => {
  const user = JSON.stringify({ id: 1, first_name: 'Анна Мария+' });
  const result = validateInitData(signedInitData(base({ user })), TOKEN, { now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.user.firstName, 'Анна Мария+');
});
