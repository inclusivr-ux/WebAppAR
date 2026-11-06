import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPenalty, hitScore, timeBonus } from '../../inclusiapp/src/game/scoring.js';
import { formatClock, formatSeconds, Stopwatch } from '../../inclusiapp/src/game/timer.js';
import { GAME } from '../../inclusiapp/src/config.js';

const linear = { mode: 'linear', max: 100, fullUntil: 5, zeroAt: 40 };

test('bônus linear: cheio, decrescente e zero', () => {
  assert.equal(timeBonus(0, linear), 100);
  assert.equal(timeBonus(5, linear), 100);
  assert.equal(timeBonus(22.5, linear), 50);
  assert.equal(timeBonus(40, linear), 0);
  assert.equal(timeBonus(300, linear), 0);
  // quanto mais rápido, maior (monotônico)
  let prev = Infinity;
  for (let t = 0; t <= 45; t += 0.5) {
    const b = timeBonus(t, linear);
    assert.ok(b <= prev);
    prev = b;
  }
});

test('modo tiers reproduz a tabela do jogo original (Unity)', () => {
  // a tabela do ARCombinationGameManager.cs (o jogo de cartas usa hoje o modo linear)
  const tiers = { mode: 'tiers', tiers: [{ upTo: 3, bonus: 100 }, { upTo: 6, bonus: 70 }, { upTo: 10, bonus: 40 }, { upTo: Infinity, bonus: 10 }] };
  assert.equal(timeBonus(2.9, tiers), 100);
  assert.equal(timeBonus(3, tiers), 100);
  assert.equal(timeBonus(5, tiers), 70);
  assert.equal(timeBonus(9.9, tiers), 40);
  assert.equal(timeBonus(60, tiers), 10);
});

test('jogo de cartas: errar não tira pontos (público de 3 a 8 anos)', () => {
  assert.equal(GAME.scoring.wrongPenalty, 0);
  assert.deepEqual(applyPenalty(100, GAME.scoring), { score: 100, deducted: 0 });
});

test('acerto = pontos fixos + bônus', () => {
  const scoring = { ...GAME.scoring, hitPoints: 100, timeBonus: linear };
  assert.deepEqual(hitScore(3, scoring), { base: 100, bonus: 100, total: 200 });
  assert.deepEqual(hitScore(60, scoring), { base: 100, bonus: 0, total: 100 });
});

test('penalidade nunca deixa a pontuação negativa', () => {
  const scoring = { ...GAME.scoring, wrongPenalty: 20, minScore: 0 };
  assert.deepEqual(applyPenalty(100, scoring), { score: 80, deducted: 20 });
  assert.deepEqual(applyPenalty(10, scoring), { score: 0, deducted: 10 });
  assert.deepEqual(applyPenalty(0, scoring), { score: 0, deducted: 0 });
});

test('cronômetro: tempo, pausa e retomada', () => {
  let now = 0;
  const sw = new Stopwatch(() => now);
  sw.start();
  now = 4200;
  assert.equal(sw.elapsed, 4.2);
  sw.pause();
  now = 10000;
  assert.equal(sw.elapsed, 4.2);
  sw.resume();
  now = 11000;
  assert.equal(sw.elapsed, 5.2);
  sw.start();
  assert.equal(sw.elapsed, 0);
});

test('formatação de tempo', () => {
  assert.equal(formatClock(8.4), '00:08');
  assert.equal(formatClock(75), '01:15');
  assert.equal(formatSeconds(4.23), '4,2 s');
});
