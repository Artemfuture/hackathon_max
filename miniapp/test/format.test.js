import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, formatPrice, toClock, toMinutes } from '../src/lib/format.js';

test('формат времени: часы и минуты переводятся туда и обратно', () => {
  assert.equal(toMinutes('19:00'), 1140);
  assert.equal(toClock(1360), '22:40');
  assert.equal(toClock(toMinutes('07:05')), '07:05');
});

test('длительность записывается как в макете: «3 ч 40 мин»', () => {
  assert.equal(formatDuration(220), '3 ч 40 мин');
  assert.equal(formatDuration(120), '2 ч');
  assert.equal(formatDuration(40), '40 мин');
});

test('цена: рубли с пробелом-разделителем тысяч', () => {
  assert.equal(formatPrice(850), '850 р');
  assert.equal(formatPrice(1500).replace(/\s/g, ' '), '1 500 р');
});
