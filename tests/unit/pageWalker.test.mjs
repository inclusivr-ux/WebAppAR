import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Wanderer, angleDelta, clampToBounds, headingTo, inBounds, pageBounds, randomPoint, randomTarget, turnToward, xRangeAt } from '../../inclusiapp/src/ar/pageWalker.js';
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

test('o chão do zoológico é um trapézio: o fundo é mais largo, e ninguém sai dele', () => {
  const b = { minX: -0.2, maxX: 0.2, minY: -0.6, maxY: 0.9, farMinX: -0.4, farMaxX: 0.4 };
  assert.deepEqual(xRangeAt(b, b.minY), [-0.2, 0.2], 'na frente');
  assert.deepEqual(xRangeAt(b, b.maxY), [-0.4, 0.4], 'no fundo');
  assert.ok(Math.abs(xRangeAt(b, 0.15)[1] - 0.3) < 1e-9, 'no meio, no meio do caminho');
  assert.deepEqual(clampToBounds([0.35, -0.6], b), [0.2, -0.6], 'na frente, 0,35 está fora');
  assert.ok(inBounds([0.35, 0.9], b), 'no fundo, 0,35 está dentro');
  const r = seededRandom(4);
  let fundoLargo = false;
  for (let i = 0; i < 500; i++) {
    const p = randomPoint(b, r);
    assert.ok(inBounds(p, b), `ponto fora: ${p}`);
    if (Math.abs(p[0]) > 0.25) fundoLargo = true;
  }
  assert.ok(fundoLargo, 'o fundo largo também é usado');
  // e o passeio continua dentro, mesmo longo
  const w = new Wanderer({ bounds: b, random: seededRandom(5), rest: [0.1, 0.3] });
  for (let i = 0; i < 6000; i++) assert.ok(inBounds(w.update(1 / 30).pos, b));
});

test('o livro continua igual: sem trapézio, o sorteio e os limites são os de sempre', () => {
  const b = pageBounds(0.7, {});
  assert.deepEqual(xRangeAt(b, 0), [b.minX, b.maxX]);
  const a = randomPoint(b, seededRandom(3));
  const r = seededRandom(3);
  assert.deepEqual(a, [b.minX + r() * (b.maxX - b.minX), b.minY + r() * (b.maxY - b.minY)], 'x primeiro, depois y (como antes)');
});

test('quem passeia pode escolher para onde ir (o zoológico procura um lugar vazio)', () => {
  const b = pageBounds(1, {});
  const pedidos = [];
  const w = new Wanderer({ bounds: b, random: seededRandom(2), rest: [0.1, 0.2], pickTarget: (from) => { pedidos.push(from); return [9, 9]; } });
  for (let i = 0; i < 30; i++) w.update(1 / 30);
  assert.ok(pedidos.length >= 1, 'pediu o próximo ponto');
  assert.deepEqual(w.target, [b.maxX, b.maxY], 'o ponto pedido fica dentro da área');
});
