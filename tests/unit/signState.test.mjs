import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGN_GAME, clipFor, itemById } from '../../inclusiapp/src/sign/signConfig.js';
import { PHASE, SignMatch } from '../../inclusiapp/src/sign/signState.js';

import { LIBRAS_VIDEOS, VOWEL_CLIPS } from '../../inclusiapp/src/libras/librasVideos.js';

function newMatch(seed = 1) {
  const match = new SignMatch(SIGN_GAME);
  match.start(seed);
  return { match };
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

test('sem pontos e sem tempo: a configuração não tem placar, estrelas, contagem nem tempo limite', () => {
  assert.equal(SIGN_GAME.scoring, undefined);
  assert.equal(SIGN_GAME.stars, undefined);
  assert.equal(SIGN_GAME.timing.countdown, undefined);
  assert.equal(SIGN_GAME.timing.tryFor, undefined);
  assert.ok(SIGN_GAME.timing.tipAfter >= 8, 'a dica vem com calma');
});

test('rodada: olhar → vez → reconhecido = ISSO! (sem pontos)', () => {
  const { match } = newMatch();
  const item = match.nextRound();
  assert.ok(item);
  assert.equal(match.phase, PHASE.WATCH);
  match.startTry();
  assert.equal(match.phase, PHASE.TRY);
  const r = match.correct();
  assert.deepEqual(r, { ok: true, tries: 1, almost: 0 });
  assert.equal(match.stats.signsCorrect, 1);
  assert.equal(match.phase, PHASE.DONE);
  assert.equal(match.stats.score, undefined);
});

test('QUASE: a câmera viu outro sinal, conta o "quase" e a criança continua tentando', () => {
  const { match } = newMatch();
  match.nextRound();
  match.almost(); // olhando o vídeo: não conta
  assert.equal(match.round.almost, 0);
  match.startTry();
  match.almost();
  match.almost();
  assert.equal(match.phase, PHASE.TRY, 'o "quase" não tira a vez');
  assert.equal(match.round.almost, 2);
  match.watchAgain();
  assert.equal(match.phase, PHASE.WATCH);
  match.startTry();
  const r = match.correct();
  assert.equal(r.tries, 2);
  assert.equal(r.almost, 2);
  assert.equal(match.stats.almost, 2);
});

test('pular e o fim: "você fez X de 5", com cada vogal (certa ou pulada)', () => {
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
  assert.equal(s.total, SIGN_GAME.rounds);
  assert.deepEqual(s.results.map((r) => r.id), match.order);
  assert.deepEqual(s.results.map((r) => r.ok), [true, true, true, true, false]);
  assert.equal(s.stars, undefined);
});

test('a primeira vez vem em ordem: A, E, I, O, U (pedido da equipe, 11/11/2026)', () => {
  const match = new SignMatch(SIGN_GAME);
  match.start(7, { inOrder: true });
  assert.deepEqual(match.order, ['A', 'E', 'I', 'O', 'U']);
  assert.equal(match.inOrder, true);
  assert.equal(match.nextRound().letter, 'A');
  assert.ok(SIGN_GAME.orderKey, 'o aparelho guarda que a primeira partida terminou');
});

test('depois, sorteada: nunca sai A, E, I, O, U, e a mesma semente dá a mesma ordem', () => {
  const vistas = new Set();
  for (let seed = 1; seed <= 500; seed++) {
    const { match } = newMatch(seed);
    assert.equal(match.inOrder, false);
    assert.notDeepEqual(match.order, ['A', 'E', 'I', 'O', 'U'], `semente ${seed}`);
    assert.deepEqual([...match.order].sort(), ['A', 'E', 'I', 'O', 'U'], 'as cinco vogais, uma vez cada');
    assert.deepEqual(newMatch(seed).match.order, match.order);
    vistas.add(match.order.join(''));
  }
  assert.ok(vistas.size > 60, `ordens diferentes de verdade: ${vistas.size}`);
});

test('o aviso do sorteio é curto (uns 3 segundos) e não tem relógio de jogo', () => {
  const total = SIGN_GAME.timing.drawMs + SIGN_GAME.timing.drawShowMs;
  assert.ok(total >= 2000 && total <= 3500, `${total} ms`);
});
