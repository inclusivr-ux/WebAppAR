/**
 * Pontuação do Sinalize! (regras em SIGN_GAME.scoring).
 * Reaproveita o cálculo de bônus por faixas de tempo do Jogo de Cartas.
 */
import { timeBonus } from '../game/scoring.js';

/** Pontos de um sinal feito em `seconds`: { base, bonus, total }. */
export function stepPoints(seconds, step) {
  const base = step.points;
  const bonus = timeBonus(seconds, step.speed);
  return { base, bonus, total: base + bonus };
}

function maxBonus(speed) {
  if (speed.mode === 'tiers') return Math.max(0, ...speed.tiers.map((t) => t.bonus));
  return speed.max;
}

/** Maior pontuação possível em um desafio (certo e rapidíssimo). */
export function maxRoundScore(scoring) {
  return scoring.sign.points + maxBonus(scoring.sign.speed);
}
