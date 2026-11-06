import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSeed, seededRandom } from '../../inclusiapp/src/game/random.js';

test('a mesma semente sempre dá a mesma sequência, em [0, 1)', () => {
  const a = seededRandom(2026);
  const b = seededRandom(2026);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(seededRandom(1)(), seededRandom(2)());
});

test('semente nova: inteiro de 32 bits', () => {
  const s = newSeed();
  assert.ok(Number.isInteger(s) && s >= 0 && s < 2 ** 32);
});
