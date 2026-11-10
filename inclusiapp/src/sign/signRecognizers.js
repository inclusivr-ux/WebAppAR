/**
 * Reconhecedor do Sinalize!, com a mesma interface para qualquer sinal:
 *
 *   const r = createRecognizer(item);
 *   r.update(hands, nowMs) → { state, progress (0…1), event: null | 'correct' | 'wrong' }
 *
 * `hands` é o que o HandTracker devolve a cada quadro (os 21 pontos de cada
 * mão na imagem e em 3D, e as notas das vogais).
 *
 * VOGAIS (A, E, I, O, U): configuração de mão parada — o classificador das
 * vogais (handSigns.js) e o juiz que olha vários quadros (signJudge.js),
 * testados com a mão 3D e com os vídeos do intérprete.
 *
 * Os sinais dos animais (com movimento) saíram do jogo em 10/11/2026. Um
 * reconhecimento completo pede um modelo treinado com muitas pessoas (o
 * trabalho do Signária IA), que pode entrar aqui com a mesma interface.
 */
import { SignJudge } from './signJudge.js';

class VowelRecognizer {
  constructor(letter, opts) {
    this.judge = new SignJudge(letter, opts);
  }

  update(hands, now) {
    const r = this.judge.update(hands, now);
    return { state: r.state, progress: r.progress, event: r.event, seen: r.seen };
  }
}

/** Reconhecedor para um item do jogo ({ kind: 'letra', letter }). */
export function createRecognizer(item, opts = {}) {
  if (item.kind !== 'letra') throw new Error(`Sinal sem reconhecedor: ${item.id}`);
  return new VowelRecognizer(item.letter, opts);
}
