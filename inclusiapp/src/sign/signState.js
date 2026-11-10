/**
 * Regras de uma partida do Sinalize! — sem DOM, testadas em Node
 * (tests/unit/signState.test.mjs).
 *
 *   start(seed) → embaralha UMA vez (ordem fixa na partida)
 *   nextRound() → [WATCH] o intérprete mostra o sinal
 *               → startTry() [TRY] a vez da criança (sem tempo limite)
 *                   almost() a câmera viu outro sinal: "QUASE!" (continua em TRY)
 *               → correct() | skip() → [DONE] → nextRound() … → [FINISHED]
 *
 * Sem pontos e sem cronômetro desde a versão 2.2 (pedido da equipe): o jogo
 * só sabe se a criança fez o sinal (certo), se pulou e quantos "quase" houve.
 */
import { Deck } from '../game/deck.js';
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

  /** Nova partida: nova semente (ou a dada) e um embaralhamento. */
  start(seed = newSeed()) {
    this.seed = seed >>> 0;
    this.deck = new Deck(this.config.items.map((i) => i.id), { random: seededRandom(this.seed) });
    this.order = this.deck.order.slice(0, this.rounds);
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
