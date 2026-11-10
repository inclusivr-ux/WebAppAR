import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGN_GAME, clipFor, itemById } from '../../inclusiapp/src/sign/signConfig.js';
import { PHASE, SignMatch } from '../../inclusiapp/src/sign/signState.js';
import { maxRoundScore, stepPoints } from '../../inclusiapp/src/sign/signScore.js';

import { LIBRAS_VIDEOS, VOWEL_CLIPS } from '../../inclusiapp/src/libras/librasVideos.js';

function newMatch(seed = 1) {
  const clock = { now: 0 };
  const match = new SignMatch(SIGN_GAME, { now: () => clock.now });
  match.start(seed);
  return { match, clock };
}

test('os itens: só as 5 vogais, cada uma com a carta do sinal e a carta da letra', () => {
  assert.equal(SIGN_GAME.items.length, 5);
  assert.deepEqual(SIGN_GAME.items.map((i) => i.letter), ['A', 'E', 'I', 'O', 'U']);
  for (const i of SIGN_GAME.items) {
    assert.ok(i.card >= 11 && i.card <= 15, `${i.id}: carta do sinal`);
    assert.equal(i.letterCard, i.card + 5, `${i.id}: carta da letra`);
  }
  assert.equal(itemById('urso'), null);
});

test('o vídeo de cada desafio: a vogal 2 vezes, parando um pouco na vogal', () => {
  for (const item of SIGN_GAME.items) {
    const c = clipFor(item);
    assert.equal(c.repeat, 2);
    assert.ok(c.hold > 0);
    assert.equal(c.src, LIBRAS_VIDEOS[VOWEL_CLIPS[item.letter].video].src);
    assert.ok(c.end > c.start && c.end - c.start < 1.5);
  }
});

test('a ordem é embaralhada uma vez por partida, com semente (mesma semente = mesma ordem)', () => {
  const { match } = newMatch(42);
  const order = match.order.slice();
  assert.equal(order.length, SIGN_GAME.rounds);
  assert.equal(new Set(order).size, order.length);
  assert.deepEqual(newMatch(42).match.order, order);
  assert.notDeepEqual(newMatch(43).match.order, order);
});

test('rodada: olhar → vez → reconhecido = pontos + bônus de rapidez', () => {
  const { match, clock } = newMatch();
  const item = match.nextRound();
  assert.ok(item);
  assert.equal(match.phase, PHASE.WATCH);
  clock.now += 6000; // assistir não conta tempo
  match.startTry();
  assert.equal(match.phase, PHASE.TRY);
  clock.now += 2000;
  const r = match.correct();
  assert.equal(r.base, 100);
  assert.equal(r.bonus, 50);
  assert.equal(match.stats.score, 150);
  assert.equal(match.phase, PHASE.DONE);
});

test('não deu: pode ver de novo e tentar de novo, sem perder pontos (o bônus soma as tentativas)', () => {
  const { match, clock } = newMatch();
  match.nextRound();
  match.startTry();
  clock.now += 15000;
  assert.equal(match.attemptElapsed, 15);
  match.miss();
  assert.equal(match.phase, PHASE.WATCH);
  assert.equal(match.stats.score, 0);
  clock.now += 8000; // revendo o sinal
  match.startTry();
  // a 2ª tentativa começa com o tempo inteiro (antes começava esgotada: "3, 2, 1… QUASE!")
  assert.equal(match.attemptElapsed, 0);
  clock.now += 1000;
  assert.equal(match.attemptElapsed, 1);
  const r = match.correct();
  assert.equal(r.bonus, 5, '16 s de tentativa no total');
  assert.equal(match.round.tries, 2);
});

test('pular: sem pontos e quebra a sequência; o fim dá o resumo com estrelas', () => {
  const { match } = newMatch();
  let n = 0;
  for (let item = match.nextRound(); item; item = match.nextRound(), n++) {
    if (n < SIGN_GAME.rounds - 1) {
      match.startTry();
      match.correct();
    } else {
      match.skip();
    }
  }
  assert.equal(match.phase, PHASE.FINISHED);
  const s = match.summary();
  assert.equal(s.signsCorrect, SIGN_GAME.rounds - 1);
  assert.equal(s.skipped, 1);
  assert.equal(s.bestStreak, SIGN_GAME.rounds - 1);
  assert.equal(s.stars, 2); // 4 de 5
  assert.equal(s.total, SIGN_GAME.rounds);
});

test('pontuação: faixas de rapidez e máximo por desafio', () => {
  assert.deepEqual(stepPoints(2.9, SIGN_GAME.scoring.sign), { base: 100, bonus: 50, total: 150 });
  assert.equal(stepPoints(7, SIGN_GAME.scoring.sign).bonus, 15);
  assert.equal(maxRoundScore(SIGN_GAME.scoring), 150);
});
