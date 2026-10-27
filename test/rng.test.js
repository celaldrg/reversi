import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/rng.js';

const take = (rng, count) => Array.from({ length: count }, () => rng());

test('the same seed replays the same sequence', () => {
  assert.deepEqual(take(createRng(42), 20), take(createRng(42), 20));
});

test('different seeds give different sequences', () => {
  assert.notDeepEqual(take(createRng(1), 5), take(createRng(2), 5));
});

test('values are spread over [0, 1)', () => {
  const values = take(createRng(7), 10000);
  assert.ok(values.every((value) => value >= 0 && value < 1));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(Math.abs(mean - 0.5) < 0.02, `mean ${mean}`);
});
