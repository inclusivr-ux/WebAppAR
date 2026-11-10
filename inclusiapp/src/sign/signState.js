/**
 * Regras de uma partida do Sinalize! — sem DOM, testadas em Node
 * (tests/unit/signState.test.mjs).
 *
 *   start(seed) → embaralha UMA vez (ordem fixa na partida)
 *   nextRound() → [WATCH] o intérprete mostra o sinal
 *               → startTry() [TRY] a vez da criança (cronômetro)
 *               → correct() | fail() → [DONE] → nextRound() … → [FINISHED]
 *
 * Ver o sinal de novo e tentar de novo não tiram pontos; o bônus de rapidez
 * conta só o tempo da vez da criança.
 */
import { Deck } from '../game/deck.js';
import { Stopwatch } from '../game/timer.js';
import { newSeed, seededRandom } from '../game/random.js';
import { stepPoints } from './signScore.js';

export const PHASE = {
  IDLE: 'idle',
  WATCH: 'watch',
  TRY: 'try',
  DONE: 'done',
  FINISHED: 'finished',
};

export class SignMatch {
  /**
   * @param {object} config  SIGN_GAME (signConfig.js)
   * @param {object} [options]
   * @param {() => number} [options.now]  relógio em ms (testes)
   */
  constructor(config, { now = () => performance.now() } = {}) {
    this.config = config;
    this.items = new Map(config.items.map((i) => [i.id, i]));
    this.clock = new Stopwatch(now);
    this.tryTimer = new Stopwatch(now); // soma as tentativas do desafio (bônus de rapidez)
    this.attemptTimer = new Stopwatch(now); // só a tentativa atual (tempo limite)
    this.phase = PHASE.IDLE;
  }

  get rounds() {
    return Math.min(this.config.rounds, this.config.items.length);
  }

  /** Nova partida: nova semente (ou a dada), um embaralhamento, placar zerado. */
  start(seed = newSeed()) {
    this.seed = seed >>> 0;
    this.deck = new Deck(this.config.items.map((i) => i.id), { random: seededRandom(this.seed) });
    this.order = this.deck.order.slice(0, this.rounds);
    this.index = -1;
    this.round = null;
    this.results = [];
    this.stats = { score: 0, signsCorrect: 0, skipped: 0, streak: 0, bestStreak: 0 };
    this.phase = PHASE.IDLE;
    this.tryTimer.reset();
    this.clock.start();
  }

  /** Próximo desafio (o intérprete mostra o sinal). Devolve o item, ou null no fim. */
  nextRound() {
    if (this.phase === PHASE.WATCH || this.phase === PHASE.TRY) return this.round.item;
    this.index += 1;
    if (this.index >= this.order.length) {
      this.phase = PHASE.FINISHED;
      this.round = null;
      this.clock.pause();
      return null;
    }
    const item = this.items.get(this.order[this.index]);
    this.round = { item, number: this.index + 1, tries: 0, result: null };
    this.phase = PHASE.WATCH;
    return item;
  }

  /** Ver o sinal de novo (volta para WATCH, sem perder nada). */
  watchAgain() {
    if (this.phase !== PHASE.TRY && this.phase !== PHASE.WATCH) return;
    this.tryTimer.pause();
    this.attemptTimer.pause();
    this.phase = PHASE.WATCH;
  }

  /** A vez da criança: o cronômetro do bônus corre (soma as tentativas). */
  startTry() {
    if (this.phase !== PHASE.WATCH) return;
    this.round.tries += 1;
    this.phase = PHASE.TRY;
    if (this.round.tries === 1) this.tryTimer.start();
    else this.tryTimer.resume();
    // cada tentativa tem o seu tempo inteiro (antes, a 2ª tentativa já começava com o tempo esgotado)
    this.attemptTimer.start();
  }

  /** Tempo do desafio somando as tentativas (s): é o que conta para o bônus. */
  get tryElapsed() {
    return this.tryTimer.elapsed;
  }

  /** Tempo da tentativa atual (s): é o que conta para o tempo limite. */
  get attemptElapsed() {
    return this.attemptTimer.elapsed;
  }

  /** A câmera reconheceu o sinal. */
  correct() {
    if (this.phase !== PHASE.TRY) return null;
    const seconds = this.tryTimer.elapsed;
    this.tryTimer.pause();
    this.attemptTimer.pause();
    const points = stepPoints(seconds, this.config.scoring.sign);
    const s = this.stats;
    s.score += points.total;
    s.signsCorrect += 1;
    s.streak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    this.round.result = { ok: true, seconds, ...points };
    this.results.push({ id: this.round.item.id, ...this.round.result });
    this.phase = PHASE.DONE;
    return this.round.result;
  }

  /** Não deu: o tempo da tentativa acabou (pode tentar de novo). */
  miss() {
    if (this.phase !== PHASE.TRY) return;
    this.tryTimer.pause();
    this.attemptTimer.pause();
    this.stats.streak = 0;
    this.phase = PHASE.WATCH;
  }

  /** Pular para o próximo (sem pontos). */
  skip() {
    if (this.phase !== PHASE.TRY && this.phase !== PHASE.WATCH) return null;
    this.tryTimer.pause();
    this.attemptTimer.pause();
    this.stats.skipped += 1;
    this.stats.streak = 0;
    this.round.result = { ok: false, skipped: true, total: 0 };
    this.results.push({ id: this.round.item.id, ...this.round.result });
    this.phase = PHASE.DONE;
    return this.round.result;
  }

  pause() { this.clock.pause(); this.tryTimer.pause(); this.attemptTimer.pause(); }

  resume() {
    this.clock.resume();
    if (this.phase === PHASE.TRY) {
      this.tryTimer.resume();
      this.attemptTimer.resume();
    }
  }

  summary() {
    const total = this.order.length;
    const ratio = total ? this.stats.signsCorrect / total : 0;
    const stars = (this.config.stars.find((s) => ratio >= s.min) || { stars: 1 }).stars;
    return { ...this.stats, total, seconds: this.clock.elapsed, stars, seed: this.seed, countsCorrect: 0 };
  }
}
