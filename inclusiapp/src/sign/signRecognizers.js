/**
 * Reconhecedores do Sinalize! — um por tipo de sinal, todos com a mesma
 * interface:
 *
 *   const r = createRecognizer(item);
 *   r.update(hands, nowMs) → { state, progress (0…1), event: null | 'correct' | 'wrong' }
 *
 * `hands` é o que o HandTracker devolve a cada quadro (os 21 pontos de cada
 * mão na imagem e em 3D, e as notas das vogais).
 *
 * LETRAS (A, E, I, O, U): configuração de mão parada — o classificador das
 * vogais (handSigns.js) e o juiz que olha vários quadros (signJudge.js),
 * testados com a mão 3D e com o MediaPipe.
 *
 * ANIMAIS (ABELHA, ELEFANTE, IGUANA, ONÇA, URSO): sinais com movimento e
 * perto do corpo. Aqui o reconhecimento é SIMPLIFICADO (provisório): cada
 * sinal tem uma regra com o que mais o marca nos vídeos do Fauston (quantas
 * mãos, a mão aberta ou em "F", a altura das mãos e o movimento). As regras
 * foram conferidas nos próprios vídeos (tests/unit/signRecognizers.test.mjs):
 * cada uma aceita o seu sinal e recusa os outros quatro e a soletração.
 * Para crianças de 3 a 8 anos, a regra é generosa: ela confere "o jeito" do
 * sinal, não cada detalhe. O reconhecimento completo pede um modelo treinado
 * com muitas pessoas (o trabalho do Signária IA), que pode entrar aqui com a
 * mesma interface, sem mudar o jogo.
 */
import { SignJudge } from './signJudge.js';
import { handFeatures } from './handSigns.js';

/* ------------------------------------------------------------ medidas de uma mão */
export function describeHand(hand) {
  const f = hand?.world && handFeatures(hand.world);
  if (!f || !hand.points?.length) return null;
  const straight = ['index', 'middle', 'ring', 'pinky'].map((n) => f.fingers[n].straight);
  const extended = straight.filter((s) => s > 0.78).length;
  const pts = hand.points.map((p) => (Array.isArray(p) ? p : [p.x, p.y]));
  const wrist = pts[0];
  const top = Math.min(...[4, 8, 12, 16, 20].map((k) => pts[k][1]));
  const size = Math.hypot(pts[0][0] - pts[9][0], pts[0][1] - pts[9][1]) || 0.1;
  return {
    open: extended >= 4,
    // "F" / "OK": a ponta do polegar encosta no indicador, os outros dedos esticados
    fShape: f.thumb.toIndexTip < 0.45 && straight[1] > 0.8 && straight[2] > 0.75,
    wristX: wrist[0],
    wristY: wrist[1],
    top,
    size,
  };
}

/* ------------------------------------------------------------ regras dos animais */
/**
 * Cada regra recebe as mãos do quadro (describeHand) e o movimento recente
 * (quanto os pulsos andaram no último segundo, em tamanhos de mão) e diz se o
 * quadro "parece" o sinal. `holdMs` = quanto tempo parecendo para valer.
 */
export const ANIMAL_RULES = {
  // URSO: as duas mãos no alto da cabeça (as orelhas)
  urso: { holdMs: 600, test: (h) => h.length === 2 && h.every((x) => x.wristY < 0.32 && x.top < 0.16) },
  // ONÇA: as duas mãos afastadas, uma em "F" (as pintas, os bigodes), mexendo
  onca: { holdMs: 500, test: (h, m) => h.length === 2 && separation(h) > 2.2 && h.some((x) => x.fShape) && !h.every((x) => x.wristY < 0.32) && m > 0.25 },
  // IGUANA: as duas mãos juntas, uma aberta correndo pelo braço da outra (a crista)
  iguana: { holdMs: 700, test: (h, m) => h.length === 2 && separation(h) < 2 && h.some((x) => x.open) && m > 0.35 },
  // ABELHA: uma mão aberta perto do rosto, batendo
  abelha: { holdMs: 900, test: (h, m) => h.length === 1 && h[0].open && h[0].top < 0.27 && h[0].wristY < 0.5 && m > 0.2 },
  // ELEFANTE: uma mão curvada sai do nariz e desce para a frente (a tromba)
  elefante: { holdMs: 0, test: null, trunk: true },
};

/** Distância entre os dois pulsos, em tamanhos de mão. */
function separation(h) {
  const size = (h[0].size + h[1].size) / 2 || 0.1;
  return Math.abs(h[1].wristX - h[0].wristX) / size;
}

class AnimalRecognizer {
  constructor(animal, { graceMs = 300 } = {}) {
    this.animal = animal;
    this.rule = ANIMAL_RULES[animal];
    this.graceMs = graceMs;
    this.history = []; // [{ now, hands }]
    this.holdStart = null;
    this.lastMatch = null;
    this.done = false;
  }

  _motion(now) {
    // quanto os pulsos andaram (em tamanhos de mão) no último segundo
    const recent = this.history.filter((f) => now - f.now <= 1000 && f.hands.length);
    let best = 0;
    for (let i = 1; i < recent.length; i++) {
      const a = recent[i - 1].hands;
      const b = recent[i].hands;
      if (a.length !== b.length) continue;
      for (let k = 0; k < a.length; k++) {
        best += Math.hypot(a[k].wristX - b[k].wristX, a[k].wristY - b[k].wristY) / Math.max(0.05, b[k].size);
      }
    }
    return best;
  }

  _trunk(now) {
    // uma mão curvada (não aberta) que estava no rosto e desceu bastante em até 1,5 s
    const recent = this.history.filter((f) => now - f.now <= 1500 && f.hands.length === 1);
    if (recent.length < 5) return false;
    const ys = recent.map((f) => f.hands[0].wristY);
    const startHigh = Math.min(...ys.slice(0, Math.ceil(ys.length / 2)));
    const end = ys[ys.length - 1];
    const curved = recent.filter((f) => !f.hands[0].open).length / recent.length;
    return startHigh < 0.42 && end - startHigh > 0.3 && curved >= 0.6;
  }

  update(rawHands, now) {
    const hands = (rawHands || []).map(describeHand).filter(Boolean)
      .sort((a, b) => a.wristX - b.wristX);
    this.history.push({ now, hands });
    while (this.history.length && now - this.history[0].now > 2000) this.history.shift();
    if (!hands.length) {
      this.holdStart = null;
      return { state: 'nohand', progress: 0, event: null };
    }
    let looks;
    if (this.rule.trunk) looks = this._trunk(now);
    else looks = this.rule.test(hands, this._motion(now));
    if (looks) this.lastMatch = now;
    const holding = looks || (this.lastMatch !== null && now - this.lastMatch <= this.graceMs);
    if (!holding) {
      this.holdStart = null;
      return { state: 'other', progress: 0, event: null };
    }
    if (this.holdStart === null) this.holdStart = now;
    const progress = this.rule.holdMs ? Math.min(1, (now - this.holdStart) / this.rule.holdMs) : 1;
    let event = null;
    if (progress >= 1 && !this.done) {
      this.done = true;
      event = 'correct';
    }
    return { state: 'match', progress, event };
  }
}

class VowelRecognizer {
  constructor(letter, opts) {
    this.judge = new SignJudge(letter, opts);
  }

  update(hands, now) {
    const r = this.judge.update(hands, now);
    return { state: r.state, progress: r.progress, event: r.event, seen: r.seen };
  }
}

/** Reconhecedor para um item do jogo ({ kind: 'letra', letter } ou { kind: 'animal', animal }). */
export function createRecognizer(item, opts = {}) {
  if (item.kind === 'letra') return new VowelRecognizer(item.letter, opts);
  return new AnimalRecognizer(item.animal, opts);
}
