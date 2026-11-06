import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGN_GAME, clipFor, itemById } from '../../inclusiapp/src/sign/signConfig.js';
import { PHASE, SignMatch } from '../../inclusiapp/src/sign/signState.js';
import { maxRoundScore, stepPoints } from '../../inclusiapp/src/sign/signScore.js';

import { LIBRAS_VIDEOS } from '../../inclusiapp/src/libras/librasVideos.js';

function newMatch(seed = 1) {
  const clock = { now: 0 };
  const match = new SignMatch(SIGN_GAME, { now: () => clock.now });
  match.start(seed);
  return { match, clock };
}

test('os itens: 5 vogais e 5 animais, cada um com a carta do sinal', () => {
  assert.equal(SIGN_GAME.items.length, 10);
  assert.deepEqual(SIGN_GAME.items.filter((i) => i.kind === 'letra').map((i) => i.letter), ['A', 'E', 'I', 'O', 'U']);
  for (const i of SIGN_GAME.items) assert.ok(i.card >= 6 && i.card <= 15, `${i.id}: carta de LIBRAS`);
  assert.equal(itemById('urso').card, 10);
});

test('o vídeo de cada desafio: a letra 2 vezes; o animal no trecho com o sinal duas vezes', () => {
  const a = clipFor(itemById('A'));
  assert.equal(a.repeat, 2);
  assert.ok(a.end > a.start && a.end - a.start < 1.5);
  const urso = clipFor(itemById('urso'));
  assert.equal(urso.src, LIBRAS_VIDEOS.urso.src);
  assert.ok(urso.start >= LIBRAS_VIDEOS.urso.sign.start - 1e-9);
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
  match.miss();
  assert.equal(match.phase, PHASE.WATCH);
  assert.equal(match.stats.score, 0);
  clock.now += 8000; // revendo o sinal
  match.startTry();
  clock.now += 1000;
  const r = match.correct();
  assert.equal(r.bonus, 5, '16 s de tentativa no total');
  assert.equal(match.round.tries, 2);
});

test('pular: sem pontos e quebra a sequência; o fim dá o resumo com estrelas', () => {
  const { match } = newMatch();
  let n = 0;
  for (let item = match.nextRound(); item; item = match.nextRound(), n++) {
    if (n < 9) {
      match.startTry();
      match.correct({ self: n % 2 === 0 });
    } else {
      match.skip();
    }
  }
  assert.equal(match.phase, PHASE.FINISHED);
  const s = match.summary();
  assert.equal(s.signsCorrect, 9);
  assert.equal(s.skipped, 1);
  assert.equal(s.bestStreak, 9);
  assert.equal(s.stars, 3);
  assert.equal(s.total, SIGN_GAME.rounds);
});

test('pontuação: faixas de rapidez e máximo por desafio', () => {
  assert.deepEqual(stepPoints(2.9, SIGN_GAME.scoring.sign), { base: 100, bonus: 50, total: 150 });
  assert.equal(stepPoints(7, SIGN_GAME.scoring.sign).bonus, 15);
  assert.equal(maxRoundScore(SIGN_GAME.scoring), 150);
});
