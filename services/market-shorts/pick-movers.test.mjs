// node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import {changes, pickMovers} from './pick-movers.mjs';

const steady = (from, to, n = 31) => Array.from({length: n}, (_, i) => +(from + ((to - from) * i) / (n - 1)).toFixed(2));
const oneSale = (from, to) => [...Array(25).fill(from), ...Array(6).fill(to)];
const row = (name, series) => ({id: name, name, printing: '', img: null, series});

test('changes counts day to day moves inside the window', () => {
  assert.equal(changes(oneSale(40, 15), 7), 1);
  assert.equal(changes(steady(10, 20), 7), 7);
});

test('a single sale on a thin card is dropped', () => {
  const picked = pickMovers([row('Thin promo', oneSale(40.89, 14.99)), row('Real faller', steady(50, 30))]);
  assert.deepEqual(picked.map((c) => c.name), ['Real faller']);
});

test('cheap cards are dropped and risers come before fallers', () => {
  const picked = pickMovers([
    row('Bulk', steady(0.5, 3)),
    row('Up a little', steady(20, 24)),
    row('Up a lot', steady(10, 30)),
    row('Down', steady(60, 40)),
  ]);
  assert.deepEqual(picked.map((c) => `${c.tag}: ${c.name}`), ['BIGGEST RISER: Up a lot', 'RISER: Up a little', 'BIGGEST FALLER: Down']);
});

test('only one printing per card name', () => {
  const picked = pickMovers([row('Same', steady(10, 30)), row('Same', steady(12, 30))]);
  assert.equal(picked.length, 1);
});
