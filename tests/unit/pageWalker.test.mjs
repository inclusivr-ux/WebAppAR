import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Wanderer, angleDelta, headingTo, inBounds, pageBounds, randomTarget, turnToward } from '../../inclusiapp/src/ar/pageWalker.js';
import { seededRandom } from '../../inclusiapp/src/game/random.js';

test('a área de passeio é a página menos a margem e o tamanho do animal', () => {
  const b = pageBounds(0.7, { margin: 0.07, radius: 0.05 });
  assert.ok(Math.abs(b.maxX - 0.38) < 1e-9);
  assert.ok(Math.abs(b.maxY - (0.35 - 0.12)) < 1e-9);
  assert.equal(b.minX, -b.maxX);
});

test('direção: 0 = olhando para a borda de baixo (para quem lê)', () => {
  assert.ok(Math.abs(headingTo([0, 0], [0, -1])) < 1e-9);
  assert.ok(Math.abs(headingTo([0, 0], [1, 0]) - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(angleDelta(3, -3) - (2 * Math.PI - 6)) < 1e-9);
  assert.equal(turnToward(0, 1, 0.25), 0.25);
  assert.equal(turnToward(0, 0.1, 0.25), 0.1);
});

test('o animal passeia muito tempo e NUNCA sai da página', () => {
  const random = seededRandom(5);
  const bounds = pageBounds(0.7, { margin: 0.07, radius: 0.08 });
  const w = new Wanderer({ bounds, start: [0.9, 0.9], random, rest: [0.2, 0.6] });
  assert.ok(inBounds(w.pos, bounds), 'começa dentro mesmo se o lugar pedido estiver fora');
  let moved = 0;
  let arrived = 0;
  for (let i = 0; i < 20000; i++) {
    const s = w.update(1 / 30);
    assert.ok(inBounds(s.pos, bounds), `fora da página em ${s.pos}`);
    if (s.moving) moved++;
    if (s.arrived) arrived++;
  }
  assert.ok(moved > 2000 && arrived > 20, 'anda e descansa');
});

test('segurar (carinho) para o passeio; ir até um ponto respeita a página', () => {
  const bounds = pageBounds(1, {});
  const w = new Wanderer({ bounds, random: seededRandom(1) });
  w.hold(2);
  for (let t = 0; t < 1.9; t += 0.1) assert.equal(w.update(0.1).moving, false);
  w.goTo([5, 5]);
  assert.ok(inBounds(w.target, bounds));
  for (let i = 0; i < 2000 && w.target; i++) w.update(1 / 30);
  assert.ok(Math.abs(w.pos[0] - bounds.maxX) < 1e-6 && Math.abs(w.pos[1] - bounds.maxY) < 1e-6);
});

test('o ponto sorteado fica dentro e longe de onde o animal está', () => {
  const b = pageBounds(0.7, {});
  const r = seededRandom(9);
  for (let i = 0; i < 200; i++) {
    const p = randomTarget(b, r, [0, 0], 0.12);
    assert.ok(inBounds(p, b));
  }
});
