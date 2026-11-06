import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CardGameEngine, PHASE } from '../../inclusiapp/src/game/gameState.js';
import { CARD_PAIRS, GAME } from '../../inclusiapp/src/config.js';

function setup({ seed = 7, state = null } = {}) {
  let now = 0;
  const clock = { advance: (s) => { now += s * 1000; } };
  const engine = new CardGameEngine({ pairs: CARD_PAIRS, scoring: GAME.scoring, hintCooldown: 3, seed, now: () => now, state });
  return { engine, clock };
}

test('os pares ligam o desenho (ou a letra) à face do sinal em LIBRAS da mesma carta', () => {
  assert.equal(CARD_PAIRS.length, 10);
  const shows = new Set(CARD_PAIRS.map((p) => p.show));
  const answers = new Set(CARD_PAIRS.map((p) => p.answer));
  assert.equal(shows.size, 10);
  assert.equal(answers.size, 10);
  for (const p of CARD_PAIRS) {
    assert.ok(p.answer >= 6 && p.answer <= 15, `${p.id}: a resposta é uma face de LIBRAS (6 a 15)`);
    assert.ok(!answers.has(p.show), `${p.id}: a face mostrada nunca é uma face de sinal`);
  }
  assert.deepEqual(CARD_PAIRS.find((p) => p.id === 'elefante'), { ...CARD_PAIRS.find((p) => p.id === 'elefante'), show: 2, answer: 7 });
  assert.equal(CARD_PAIRS.find((p) => p.id === 'urso').answer, 10);
  assert.equal(CARD_PAIRS.find((p) => p.id === 'A').answer, 11);
});

test('a carta do sinal certo é acerto: pontos + bônus de rapidez', () => {
  const { engine, clock } = setup();
  const pair = engine.startMission();
  assert.equal(engine.phase, PHASE.SEARCHING);
  clock.advance(4);
  const r = engine.detect(pair.answer);
  assert.equal(r.type, 'hit');
  assert.equal(r.base, GAME.scoring.hitPoints);
  assert.equal(r.bonus, GAME.scoring.timeBonus.max);
  assert.equal(engine.stats.score, r.total);
  assert.equal(engine.phase, PHASE.RESOLVED);
});

test('a face do desenho do mesmo par pede para virar a carta, sem perder nada', () => {
  const { engine } = setup();
  const pair = engine.startMission();
  const r = engine.detect(pair.show);
  assert.equal(r.type, 'flip');
  assert.equal(engine.stats.score, 0);
  assert.equal(engine.phase, PHASE.SEARCHING);
});

test('outra carta: "quase!", sem perder pontos, e o aviso não se repete logo em seguida', () => {
  const { engine, clock } = setup();
  const first = engine.startMission();
  engine.detect(first.answer);
  const pair = engine.startMission();
  const before = engine.stats.score;
  const wrong = CARD_PAIRS.find((p) => p.id !== pair.id).answer;
  assert.equal(engine.detect(wrong).type, 'wrong');
  assert.equal(engine.stats.score, before);
  assert.equal(engine.detect(wrong).type, 'ignored');
  clock.advance(3.5);
  assert.equal(engine.detect(wrong).type, 'wrong');
  assert.equal(engine.stats.errors, 2);
});

test('embaralha UMA vez: a mesma semente dá a mesma sequência; uma partida nova muda a ordem', () => {
  const order = (seed) => {
    const { engine } = setup({ seed });
    const ids = [];
    for (let p = engine.startMission(); p; p = engine.startMission()) {
      ids.push(p.id);
      engine.skip();
    }
    return ids;
  };
  const a = order(123);
  assert.equal(a.length, 10);
  assert.equal(new Set(a).size, 10, 'cada par uma vez por partida');
  assert.deepEqual(order(123), a);
  assert.notDeepEqual(order(124), a);
});

test('fim da partida e resumo com estrelas; nova partida zera o placar', () => {
  const { engine } = setup();
  for (let p = engine.startMission(); p; p = engine.startMission()) engine.detect(p.answer);
  assert.equal(engine.phase, PHASE.MATCH_COMPLETE);
  assert.ok(engine.matchComplete);
  const s = engine.summary();
  assert.equal(s.hits, 10);
  assert.equal(s.stars, 3);
  const seed = engine.seed;
  engine.newMatch(seed + 1);
  assert.equal(engine.stats.score, 0);
  assert.equal(engine.round, 0);
});

test('pular conta como pulo e as estrelas caem', () => {
  const { engine } = setup();
  for (let p = engine.startMission(), i = 0; p; p = engine.startMission(), i++) {
    if (i < 5) engine.detect(p.answer);
    else engine.skip();
  }
  const s = engine.summary();
  assert.equal(s.skips, 5);
  assert.equal(s.stars, 1);
});

test('continuar depois: o estado salvo retoma a mesma sequência e a mesma carta', () => {
  const { engine } = setup({ seed: 99 });
  engine.detect(engine.startMission().answer);
  const current = engine.startMission();
  const saved = JSON.parse(JSON.stringify(engine.toJSON()));
  const { engine: again } = setup({ state: saved });
  assert.equal(again.seed, 99);
  assert.equal(again.phase, PHASE.SEARCHING);
  assert.equal(again.pair.id, current.id);
  assert.equal(again.stats.hits, 1);
  assert.equal(again.detect(current.answer).type, 'hit');
});

test('estado salvo inválido: começa uma partida nova', () => {
  const { engine } = setup({ state: { seed: 'x', deck: null } });
  assert.equal(engine.phase, PHASE.IDLE);
  assert.equal(engine.total, 10);
});
