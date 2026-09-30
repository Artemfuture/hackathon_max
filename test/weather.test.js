import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../src/weather.js';

test('погода: осадки и температура за выбранные часы, дождь — «дождливо»', () => {
  const hours = [
    [18, 12.4, 10, 3],
    [19, 11.6, 70, 61],
    [20, 10.2, 40, 3],
    [23, 8, 0, 0],
  ];
  const evening = summarize(hours, 18 * 60, 21 * 60);
  assert.deepEqual(
    { min: evening.tempMin, max: evening.tempMax, precip: evening.precip, label: evening.label, rainy: evening.rainy },
    { min: 10, max: 12, precip: 70, label: 'дождь', rainy: true }
  );
  assert.equal(summarize(hours, 22 * 60, 23 * 60 + 30).rainy, false);
  assert.equal(summarize(hours, 1 * 60, 2 * 60), null, 'нет прогноза на эти часы');
});
