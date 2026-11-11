/**
 * O espaço do zoológico (inclusiapp/src/zoo/zooSpace.js), pedido da equipe em
 * 11/11/2026: "todos estão muito amontoados [...] Seria melhor que eles
 * andassem para ocupar mais os espaços da tela do celular".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zooFloor, stageProjector, freeSpot, keepApart, occupied } from '../../inclusiapp/src/zoo/zooSpace.js';
import { Wanderer, inBounds } from '../../inclusiapp/src/ar/pageWalker.js';
import { defaultRadius } from '../../inclusiapp/src/zoo/zooState.js';
import { ZOO, LETTERS } from '../../inclusiapp/src/zoo/zooConfig.js';
import { seededRandom } from '../../inclusiapp/src/game/random.js';

// a câmera do MindAR (45° na vertical) e a parte livre da tela como no app:
// a barra de cima (~58 px) + o espaço dos balões, e uma linha de retratos embaixo
const FOV = 45;
const telas = { celular: [390, 844], pequeno: [360, 640], tablet: [768, 1024], deitado: [844, 390] };
function livre([w, h]) {
  const s = ZOO.screen;
  return { top: (58 + s.headroom) / h, bottom: 1 - (s.trayRow + s.gap) / h, left: s.side / w, right: 1 - s.side / w };
}
const BIG = Math.max(...Object.values(ZOO.sizes));
const BODY = { radius: BIG * 0.5, height: BIG };

test('o chão ocupa a parte livre da tela: os pés na frente e a cabeça no fundo encostam nas bordas, nunca passam', () => {
  for (const [nome, tela] of Object.entries(telas)) {
    const camera = { fov: FOV, aspect: tela[0] / tela[1] };
    const safe = livre(tela);
    const f = zooFloor(camera, ZOO.stage, safe, BODY);
    const tela2 = stageProjector(camera, ZOO.stage);
    const eps = 0.002;
    // frente: os pés (e o corpo inteiro dos lados)
    for (const x of [f.minX - BODY.radius, f.maxX + BODY.radius]) {
      const p = tela2(x, f.minY, 0);
      assert.ok(p.y <= safe.bottom + eps && p.x >= safe.left - eps && p.x <= safe.right + eps, `${nome}: frente fora da tela ${JSON.stringify(p)}`);
    }
    // fundo: a cabeça do maior bicho fica abaixo da barra de cima
    for (const x of [f.farMinX - BODY.radius, f.farMaxX + BODY.radius]) {
      const p = tela2(x, f.maxY, BODY.height);
      assert.ok(p.y >= safe.top - eps && p.x >= safe.left - eps && p.x <= safe.right + eps, `${nome}: fundo fora da tela ${JSON.stringify(p)}`);
    }
    // e encosta nas bordas: usa a altura livre inteira
    assert.ok(Math.abs(tela2(0, f.minY, 0).y - safe.bottom) < 0.01, `${nome}: a frente não chega embaixo`);
    assert.ok(Math.abs(tela2(0, f.maxY, BODY.height).y - safe.top) < 0.01, `${nome}: o fundo não chega em cima`);
  }
});

test('no celular em pé, o chão fica quase duas vezes mais fundo que na 2.2, e o fundo é mais largo (a perspectiva)', () => {
  const tela = telas.celular;
  const f = zooFloor({ fov: FOV, aspect: tela[0] / tela[1] }, ZOO.stage, livre(tela), BODY);
  const antes = ZOO.bounds.maxY - ZOO.bounds.minY; // 0,8 na 2.2
  assert.ok(f.maxY - f.minY >= antes * 1.7, `fundo ${(f.maxY - f.minY).toFixed(2)} contra ${antes}`);
  assert.ok(f.farMaxX > f.maxX * 1.3, 'o fundo é mais largo que a frente');
  // a altura da tela que o chão ocupa: de uns 45% (2.2) para mais de 70%
  const p = stageProjector({ fov: FOV, aspect: tela[0] / tela[1] }, ZOO.stage);
  assert.ok(p(0, f.minY).y - p(0, f.maxY).y > 0.6, 'o chão (dos pés da frente aos pés do fundo) cobre boa parte da tela');
});

test('espaço pessoal: dois no mesmo lugar se separam devagar (sem pulo) e ficam lado a lado', () => {
  const a = { pos: [0, 0], r: 0.1 };
  const b = { pos: [0, 0], r: 0.08 };
  const dt = 1 / 60;
  const speed = 0.6;
  let last = [a.pos.slice(), b.pos.slice()];
  for (let i = 0; i < 180; i++) {
    keepApart([a, b], dt, { gap: ZOO.personalGap, speed });
    const passo = Math.max(Math.hypot(a.pos[0] - last[0][0], a.pos[1] - last[0][1]), Math.hypot(b.pos[0] - last[1][0], b.pos[1] - last[1][1]));
    assert.ok(passo <= speed * dt + 1e-9, `pulo de ${passo}`);
    last = [a.pos.slice(), b.pos.slice()];
  }
  const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]);
  assert.ok(d >= a.r + b.r + ZOO.personalGap - 1e-6, `ainda um dentro do outro: ${d}`);
  assert.equal(keepApart([a, b], dt, { gap: ZOO.personalGap }), 0, 'depois de separados, ninguém se mexe');
});

test('na profundidade, o espaço pessoal é maior (um bicho alto na frente tapa quem está atrás)', () => {
  const frente = { pos: [0, 0], r: 0.1 };
  const atras = { pos: [0, 0.05], r: 0.08 };
  const dt = 1 / 60;
  for (let i = 0; i < 240; i++) {
    const antes = [frente.pos.slice(), atras.pos.slice()];
    keepApart([frente, atras], dt, { gap: ZOO.personalGap, depth: ZOO.depthSpace });
    const passo = Math.max(Math.hypot(frente.pos[0] - antes[0][0], frente.pos[1] - antes[0][1]), Math.hypot(atras.pos[0] - antes[1][0], atras.pos[1] - antes[1][1]));
    assert.ok(passo <= 0.6 * dt + 1e-9, `pulo de ${passo}`);
  }
  const dy = atras.pos[1] - frente.pos[1];
  assert.ok(dy >= (0.18 + ZOO.personalGap) * ZOO.depthSpace - 1e-3, `atrás, só ${dy.toFixed(3)}`);
  assert.ok(Math.abs(atras.pos[0] - frente.pos[0]) < 1e-9, 'um atrás do outro: o empurrão é só para trás');
});

test('espaço pessoal: quem está parado numa animação (fixo) não é empurrado; o outro desvia', () => {
  const fixo = { pos: [0, 0], r: 0.1, fixed: true };
  const outro = { pos: [0.05, 0], r: 0.1 };
  for (let i = 0; i < 120; i++) keepApart([fixo, outro], 1 / 60, { gap: 0.02 });
  assert.deepEqual(fixo.pos, [0, 0]);
  assert.ok(outro.pos[0] >= 0.22 - 1e-6);
});

test('lugar vazio: com o lado esquerdo ocupado, o passeio vai para o lado vazio', () => {
  const bounds = { minX: -0.4, maxX: 0.4, minY: -0.6, maxY: 0.6 };
  const others = [];
  for (let y = -0.5; y <= 0.5; y += 0.25) others.push({ x: -0.3, y, r: 0.09 }, { x: -0.1, y, r: 0.09 });
  for (let seed = 1; seed <= 20; seed++) {
    const p = freeSpot(bounds, others, seededRandom(seed), { r: 0.09 });
    assert.ok(inBounds(p, bounds));
    assert.ok(p[0] > 0.05, `semente ${seed}: escolheu ${p}`);
    assert.ok(!occupied(p, others.map((o) => ({ pos: [o.x, o.y], r: o.r })), 0.09), 'não cai em cima de ninguém');
  }
});

test('os 10 chegam juntos no meio e, em 60 s, se espalham pelo chão inteiro, sem ninguém dentro do outro', () => {
  const tela = telas.celular;
  const floor = zooFloor({ fov: FOV, aspect: tela[0] / tela[1] }, ZOO.stage, livre(tela), BODY);
  const random = seededRandom(11);
  const bichos = ['abelha', 'elefante', 'iguana', 'onca', 'urso'].map((t) => ({ kind: 'animal', type: t }))
    .concat(LETTERS.map((l) => ({ kind: 'letra', type: l })));
  const bodies = bichos.map((b, i) => ({
    r: defaultRadius(b.kind, b.type),
    pos: [0.001 * i, 0.001 * (i % 3)],
  }));
  const crowd = (self) => bodies.filter((b) => b !== self).flatMap((b) => {
    const list = [{ x: b.pos[0], y: b.pos[1], r: b.r }];
    if (b.walk.target) list.push({ x: b.walk.target[0], y: b.walk.target[1], r: b.r });
    return list;
  });
  for (const b of bodies) {
    b.walk = new Wanderer({ bounds: floor, start: b.pos, speed: 0.08, rest: [1.4, 3.8], random, pickTarget: (pos) => freeSpot(floor, crowd(b), random, { from: pos, r: b.r, depth: ZOO.depthSpace }) });
    b.pos = b.walk.pos;
  }
  const dt = 1 / 30;
  for (let t = 0; t < 60; t += dt) {
    for (const b of bodies) b.pos = b.walk.pos;
    keepApart(bodies, dt, { gap: ZOO.personalGap, depth: ZOO.depthSpace, bounds: floor });
    for (const b of bodies) {
      if (b.walk.target && occupied(b.walk.target, bodies, b.r, b, ZOO.personalGap, ZOO.depthSpace)) b.walk.target = b.walk.nextTarget();
      b.walk.update(dt);
    }
  }
  for (const b of bodies) b.pos = b.walk.pos;
  let juntos = 0;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const d = Math.hypot(bodies[i].pos[0] - bodies[j].pos[0], bodies[i].pos[1] - bodies[j].pos[1]);
      if (d < (bodies[i].r + bodies[j].r) * 0.95) juntos += 1;
    }
  }
  assert.equal(juntos, 0, 'ninguém dentro do outro');
  const ys = bodies.map((b) => b.pos[1]);
  const xs = bodies.map((b) => b.pos[0]);
  const fundo = floor.maxY - floor.minY;
  const largura = floor.farMaxX - floor.farMinX;
  assert.ok(Math.max(...ys) - Math.min(...ys) > fundo * 0.55, `espalhados na profundidade: ${(Math.max(...ys) - Math.min(...ys)).toFixed(2)} de ${fundo.toFixed(2)}`);
  assert.ok(Math.max(...xs) - Math.min(...xs) > largura * 0.5, `espalhados na largura: ${(Math.max(...xs) - Math.min(...xs)).toFixed(2)} de ${largura.toFixed(2)}`);
  assert.ok(bodies.every((b) => inBounds(b.pos, floor, 1e-6)), 'todos no chão');
});
