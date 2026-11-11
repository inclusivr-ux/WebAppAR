/**
 * Regras de uma partida do Sinalize! — sem DOM, testadas em Node
 * (tests/unit/signState.test.mjs).
 *
 *   start(seed, { inOrder }) → a ordem da partida: na primeira vez no aparelho,
 *               A, E, I, O, U; depois, sorteada (uma vez por partida, com semente,
 *               e nunca igual a A, E, I, O, U), com o aviso "SORTEANDO AS VOGAIS..."
 *               (pedido da equipe, 11/11/2026: "só pra não pegar ninguém de surpresa")
 *   nextRound() → [WATCH] o intérprete mostra o sinal
 *               → startTry() [TRY] a vez da criança (sem tempo limite)
 *                   almost() a câmera viu outro sinal: "QUASE!" (continua em TRY)
 *               → correct() | skip() → [DONE] → nextRound() … → [FINISHED]
 *
 * Sem pontos e sem cronômetro desde a versão 2.2 (pedido da equipe): o jogo
 * só sabe se a criança fez o sinal (certo), se pulou e quantos "quase" houve.
 */
import { Deck, shuffle } from '../game/deck.js';
import { newSeed, seededRandom } from '../game/random.js';

export const PHASE = {
  IDLE: 'idle',
  WATCH: 'watch',
  TRY: 'try',
  DONE: 'done',
  FINISHED: 'finished',
};

export class SignMatch {
  /** @param {object} config  SIGN_GAME (signConfig.js) */
  constructor(config) {
    this.config = config;
    this.items = new Map(config.items.map((i) => [i.id, i]));
    this.phase = PHASE.IDLE;
  }

  get rounds() {
    return Math.min(this.config.rounds, this.config.items.length);
  }

  /**
   * Nova partida.
   * @param {number} [seed]  a semente do sorteio (a mesma semente dá a mesma ordem)
   * @param {{inOrder?: boolean}} [opts]  inOrder: na ordem A, E, I, O, U (a primeira vez)
   */
  start(seed = newSeed(), { inOrder = false } = {}) {
    this.seed = seed >>> 0;
    this.inOrder = inOrder;
    const ids = this.config.items.map((i) => i.id);
    const inSequence = (order) => order.every((id, i) => id === ids[i]);
    if (inOrder) {
      this.order = ids.slice(0, this.rounds);
    } else {
      const random = seededRandom(this.seed);
      this.deck = new Deck(ids, { random });
      this.order = this.deck.order.slice(0, this.rounds);
      // sorteado de verdade: nunca a mesma ordem da primeira vez
      for (let i = 0; i < 20 && inSequence(this.order); i++) this.order = shuffle(ids, random).slice(0, this.rounds);
      if (inSequence(this.order)) this.order = [...this.order.slice(1), this.order[0]];
    }
    this.index = -1;
    this.round = null;
    this.results = [];
    this.stats = { signsCorrect: 0, skipped: 0, almost: 0 };
    this.phase = PHASE.IDLE;
  }

  /** Próximo desafio (o intérprete mostra o sinal). Devolve o item, ou null no fim. */
  nextRound() {
    if (this.phase === PHASE.WATCH || this.phase === PHASE.TRY) return this.round.item;
    this.index += 1;
    if (this.index >= this.order.length) {
      this.phase = PHASE.FINISHED;
      this.round = null;
      return null;
    }
    const item = this.items.get(this.order[this.index]);
    this.round = { item, number: this.index + 1, tries: 0, almost: 0, result: null };
    this.phase = PHASE.WATCH;
    return item;
  }

  /** Ver o sinal de novo (volta para WATCH, sem perder nada). */
  watchAgain() {
    if (this.phase !== PHASE.TRY && this.phase !== PHASE.WATCH) return;
    this.phase = PHASE.WATCH;
  }

  /** A vez da criança (quantas vezes ela olhou e tentou fica guardado). */
  startTry() {
    if (this.phase !== PHASE.WATCH) return;
    this.round.tries += 1;
    this.phase = PHASE.TRY;
  }

  /** A câmera viu outro sinal (ou uma mão que não é vogal) por um tempo: "QUASE!". */
  almost() {
    if (this.phase !== PHASE.TRY) return;
    this.round.almost += 1;
    this.stats.almost += 1;
  }

  /** A câmera reconheceu o sinal. */
  correct() {
    if (this.phase !== PHASE.TRY) return null;
    this.stats.signsCorrect += 1;
    this.round.result = { ok: true, tries: this.round.tries, almost: this.round.almost };
    this.results.push({ id: this.round.item.id, ...this.round.result });
    this.phase = PHASE.DONE;
    return this.round.result;
  }

  /** Pular para o próximo. */
  skip() {
    if (this.phase !== PHASE.TRY && this.phase !== PHASE.WATCH) return null;
    this.stats.skipped += 1;
    this.round.result = { ok: false, skipped: true };
    this.results.push({ id: this.round.item.id, ...this.round.result });
    this.phase = PHASE.DONE;
    return this.round.result;
  }

  /** Fim: quantos sinais certos de quantos, e cada vogal (certa ou pulada). */
  summary() {
    return {
      signsCorrect: this.stats.signsCorrect,
      skipped: this.stats.skipped,
      total: this.order.length,
      results: this.results.map((r) => ({ id: r.id, ok: r.ok })),
      seed: this.seed,
    };
  }
}
