/**
 * Regras do Jogo de Cartas (sem DOM — testável em Node).
 *
 * Cada desafio é um PAR: o jogo mostra uma face (o desenho do animal ou a
 * letra) e a criança precisa achar e mostrar a face com o SINAL em LIBRAS
 * que combina (a outra face da mesma carta física). O objetivo é relacionar
 * o animal ao seu sinal — não achar a mesma imagem da tela.
 *
 *   nova partida → embaralha UMA vez, com semente (a ordem fica fixa)
 *   desafio → carta certa = acerto (+pontos e bônus de rapidez) → próximo
 *           → a face do desenho do mesmo par = "vire a carta" (sem perder nada)
 *           → outra carta = "quase!" (sem perder pontos: errar não pune)
 *   pular → próximo desafio
 *   acabaram os pares → fim da partida (resumo); nova partida = nova semente
 */
import { Deck } from './deck.js';
import { hitScore } from './scoring.js';
import { Stopwatch } from './timer.js';
import { newSeed, seededRandom } from './random.js';

export const PHASE = Object.freeze({
  IDLE: 'idle', // aguardando o próximo desafio
  SEARCHING: 'searching', // desafio na tela, cronômetro correndo
  RESOLVED: 'resolved', // acertou ou pulou
  MATCH_COMPLETE: 'matchComplete', // todos os pares da partida foram usados
});

const emptyStats = () => ({ score: 0, hits: 0, errors: 0, flips: 0, skips: 0, bestTime: null });

export class CardGameEngine {
  /**
   * @param {object} opts
   * @param {Array<{id: string, show: number, answer: number}>} opts.pairs  CARD_PAIRS (config.js)
   * @param {object} opts.scoring         GAME.scoring
   * @param {number} [opts.hintCooldown]  s até repetir o aviso da mesma carta errada
   * @param {number} [opts.seed]          semente da partida (nova se não vier)
   * @param {object} [opts.state]         estado salvo (toJSON) para continuar
   */
  constructor({ pairs, scoring, hintCooldown = 3, seed = null, now = () => performance.now(), state = null }) {
    this.pairs = new Map(pairs.map((p) => [p.id, p]));
    this.ids = pairs.map((p) => p.id);
    this.scoring = scoring;
    this.hintCooldown = hintCooldown;
    this.now = now;
    this.stopwatch = new Stopwatch(now);
    const restored = state && this._restore(state);
    if (!restored) this.newMatch(seed ?? newSeed());
  }

  _restore(state) {
    if (!Number.isInteger(state.seed) || !state.deck) return false;
    const deck = new Deck(this.ids, { random: seededRandom(state.seed), state: state.deck });
    // o baralho salvo não serve mais (as cartas mudaram): começa outra partida
    if (deck.order.join() !== (state.deck.order || []).join()) return false;
    this.seed = state.seed;
    this.deck = deck;
    this.stats = { ...emptyStats(), ...(state.stats || {}) };
    this.current = null;
    this.phase = PHASE.IDLE;
    this.hints = new Map();
    if (state.phase === PHASE.SEARCHING && state.current && deck.last === state.current) {
      this.current = state.current;
      this.phase = PHASE.SEARCHING;
      this.stopwatch.start();
    } else if (deck.isCycleComplete) {
      this.phase = PHASE.MATCH_COMPLETE;
    }
    return true;
  }

  /** Nova partida: nova semente, um embaralhamento, placar zerado. */
  newMatch(seed = newSeed()) {
    this.seed = seed >>> 0;
    this.deck = new Deck(this.ids, { random: seededRandom(this.seed) });
    this.stats = emptyStats();
    this.current = null;
    this.phase = PHASE.IDLE;
    this.hints = new Map();
  }

  get elapsed() { return this.stopwatch.elapsed; }
  get total() { return this.deck.size; }
  get round() { return this.deck.drawnInCycle; }
  get pair() { return this.current ? this.pairs.get(this.current) : null; }
  get matchComplete() { return this.deck.isCycleComplete && this.phase !== PHASE.SEARCHING; }

  /** Próximo desafio da sequência fixa. Devolve o par, ou null no fim da partida. */
  startMission() {
    if (this.deck.isCycleComplete) {
      this.phase = PHASE.MATCH_COMPLETE;
      this.current = null;
      return null;
    }
    this.current = this.deck.draw();
    this.phase = PHASE.SEARCHING;
    this.hints = new Map();
    this.stopwatch.start();
    return this.pair;
  }

  /**
   * Uma carta (número do arquivo cartaN.png) foi reconhecida pela câmera.
   *   { type: 'hit', ... }      a face do sinal do par: acerto
   *   { type: 'flip', ... }     a face do desenho do mesmo par: vire a carta
   *   { type: 'wrong', ... }    outra carta (sem perder pontos)
   *   { type: 'ignored', ... }  fora de hora, ou aviso repetido cedo demais
   */
  detect(card) {
    if (this.phase !== PHASE.SEARCHING) return { type: 'ignored', reason: 'not-searching', card };
    const pair = this.pair;
    if (card === pair.answer) {
      const seconds = this.stopwatch.elapsed;
      this.stopwatch.pause();
      const points = hitScore(seconds, this.scoring);
      this.stats.score += points.total;
      this.stats.hits += 1;
      if (this.stats.bestTime === null || seconds < this.stats.bestTime) this.stats.bestTime = seconds;
      this.phase = PHASE.RESOLVED;
      return { type: 'hit', card, pair, seconds, ...points, score: this.stats.score };
    }
    const t = this.now() / 1000;
    const last = this.hints.get(card);
    if (last !== undefined && t - last < this.hintCooldown) return { type: 'ignored', reason: 'cooldown', card };
    this.hints.set(card, t);
    if (card === pair.show) {
      this.stats.flips += 1;
      return { type: 'flip', card, pair };
    }
    this.stats.errors += 1;
    return { type: 'wrong', card, pair, score: this.stats.score };
  }

  /** Botão Pular: vai para o próximo desafio. */
  skip() {
    if (this.phase !== PHASE.SEARCHING) return { type: 'ignored', reason: 'not-searching' };
    const pair = this.pair;
    this.stopwatch.pause();
    this.stats.skips += 1;
    this.phase = PHASE.RESOLVED;
    return { type: 'skipped', pair };
  }

  /** Resumo da partida; `stars` de 1 a 3. */
  summary() {
    const total = this.deck.size;
    const ratio = total ? this.stats.hits / total : 0;
    const stars = ratio >= 0.999 && !this.stats.skips ? 3 : ratio >= 0.6 ? 2 : 1;
    return { used: this.deck.drawnInCycle, total, seed: this.seed, stars, ...this.stats };
  }

  pause() { this.stopwatch.pause(); }

  resume() { if (this.phase === PHASE.SEARCHING) this.stopwatch.resume(); }

  toJSON() {
    return { seed: this.seed, deck: this.deck.toJSON(), stats: this.stats, current: this.current, phase: this.phase };
  }
}
