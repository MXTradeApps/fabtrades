// node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import {niceTicks, tickLabels} from './ticks.mjs';

test('round dollar steps for a cheap card', () => {
  assert.deepEqual(niceTicks(1.2, 10.8), [2.5, 5, 7.5, 10]);
  assert.deepEqual(tickLabels([2.5, 5, 7.5, 10]), ['$2.50', '$5.00', '$7.50', '$10.00']);
});

test('whole dollars for a pricier card', () => {
  const t = niceTicks(60.4, 95.9);
  assert.deepEqual(t, [70, 80, 90]);
  assert.deepEqual(tickLabels(t), ['$70', '$80', '$90']);
});

test('every tick is inside the range and there are 2 to 6 of them', () => {
  for (const [lo, hi] of [[2.24, 9.72], [17.48, 34.66], [28.74, 52.17], [33.22, 52.26], [408, 493], [0.5, 0.9], [5, 5.4]]) {
    const pad = (hi - lo) * 0.14;
    const t = niceTicks(lo - pad, hi + pad);
    assert.ok(t.length >= 2 && t.length <= 6, `${lo}-${hi}: ${t}`);
    assert.ok(t.every((v) => v >= lo - pad && v <= hi + pad), `${lo}-${hi}: ${t}`);
  }
});

test('thousands get a separator and a flat series still gets one label', () => {
  assert.deepEqual(tickLabels([1000, 2000]), ['$1,000', '$2,000']);
  assert.deepEqual(niceTicks(5, 5), [5]);
});
