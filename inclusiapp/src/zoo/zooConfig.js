/**
 * ZOOLÓGICO EM AR — configuração.
 *
 * Desde a versão 2.2 (10/11/2026), sem a página 22: as CARTAS são os
 * validadores. A criança mostra uma carta para a câmera, em qualquer posição
 * (girada, de lado, de cabeça para baixo):
 *   - carta de um animal (o desenho ou o sinal em LIBRAS) → o animal salta da
 *     carta para o zoológico, no palco de brincar (o "chão" invisível na
 *     frente da câmera, o mesmo do livro);
 *   - carta de uma vogal (o sinal em LIBRAS ou a letra) → aparece a LETRA do
 *     português, grande e animada: o par entre o sinal e a letra.
 * A carta que já trouxe alguém deixa de ser procurada (as duas faces), e com
 * os 10 no zoológico (5 animais + 5 letras) o reconhecimento das cartas
 * para: o celular só desenha. Todos passeiam pelo chão inteiro, cada um com
 * o seu espaço (zooSpace.js), e de vez em quando se encontram lado a lado: o
 * que acontece depende de quem está lá (as interações da história, abaixo).
 * Tocar = carinho; a casinha leva alguém para descansar (sai do zoológico).
 *
 * As interações respeitam o livro e as fichas dos animais (repositório
 * inclusivr-animais). Nada de comida, remédio ou objetos de fora.
 */
import { ANIMALS, CARD_PAIRS, GAME, STAGE } from '../config.js';

export const ZOO = {
  /** as 20 faces das cartas (o mesmo arquivo do jogo de cartas): alvo N−1 = cartaN.png */
  targets: GAME.targets,
  /** o palco do zoológico: o mesmo do livro, visto mais de cima (cabe todo mundo, um atrás do outro) */
  stage: { ...STAGE, elevation: 55, widthFrac: 1.2, centerY: -0.03, maxHeightFrac: 0.72 },
  /**
   * O chão (coordenadas da página do palco). Desde a versão 2.2.1, ele é
   * calculado quando a câmera abre (zooSpace.js: zooFloor), para ocupar a tela
   * entre a barra de cima e a fileira de retratos; este é só o começo.
   */
  bounds: { minX: -0.3, maxX: 0.3, minY: -0.38, maxY: 0.42 },
  /**
   * A parte da tela que fica livre para o chão (px): espaço acima da cabeça
   * para os balões, folga sobre a fileira de retratos (que tem 1 ou 2 linhas)
   * e nos lados, e a altura de uma linha de retratos antes de ela aparecer.
   */
  screen: { headroom: 28, gap: 6, side: 8, trayRow: 70 },
  /** quantos cabem de uma vez: um de cada (5 animais + 5 letras) */
  maxItems: 10,
  /**
   * Tamanho de cada um no palco (fração da largura da página do palco).
   * Uns 15% menores desde a versão 2.2.1, para os 10 caberem com espaço.
   */
  sizes: { abelha: 0.14, elefante: 0.22, iguana: 0.22, onca: 0.2, urso: 0.2, letra: 0.11 },
  beeLift: 0.06,
  /** uma carta que voltou a valer (a casinha) só chama de novo depois deste tempo (s) */
  cardCooldown: 4,
  /**
   * Espaço pessoal: entre dois, pelo menos a soma dos raios mais esta folga
   * (ninguém entra no outro).
   */
  personalGap: 0.025,
  /**
   * Na profundidade, o espaço pessoal é maior (×1,25): visto de cima, um
   * bicho alto na frente tapa quem está logo atrás.
   */
  depthSpace: 1.25,
  /** a letra é larga e fica de frente para quem olha: espaço pessoal ×1,35 (senão "U" e "I" viram "UI") */
  letterSpace: 1.35,
  /** dois "se encontram" lado a lado: a soma dos raios mais esta folga */
  meetGap: 0.06,
  /** depois de uma interação, o mesmo par só repete depois deste tempo (s) */
  pairCooldown: 14,
  /** cada animal sente uma necessidade de novo depois de [mín, máx] segundos */
  needEvery: [22, 45],
  /**
   * De tempos em tempos [mín, máx] (s), um animal vai visitar alguém (a sua
   * letra ou um amigo). Era [7, 14] até a versão 2.2: com 5 animais, havia uma
   * visita a cada 2 segundos e todos se juntavam num lugar só.
   */
  visitEvery: [16, 30],
  /** quanto tempo dura uma visita (s): ninguém visita quem já está recebendo visita */
  visitTime: 8,
  /** quanto tempo a letra fica acesa depois de encontrar o seu animal (s) */
  letterLit: 20,
};

/**
 * CARTAS → o que aparece (as duas faces de cada carta valem).
 * Chave = o alvo no cartas.mind (carta N do baralho = alvo N−1);
 * `twin` = o alvo da outra face da mesma carta.
 */
export const ZOO_CARDS = (() => {
  const map = {};
  const pair = (a, b, kind, type, faceA, faceB) => {
    map[a - 1] = { kind, type, face: faceA, card: a, target: a - 1, twin: b - 1 };
    map[b - 1] = { kind, type, face: faceB, card: b, target: b - 1, twin: a - 1 };
  };
  for (const a of ANIMALS) pair(a.cards.picture, a.cards.sign, 'animal', a.id, 'desenho', 'sinal');
  for (const p of CARD_PAIRS.filter((c) => c.kind === 'letra')) pair(p.show, p.answer, 'letra', p.id, 'letra', 'sinal');
  return map;
})();

/**
 * NECESSIDADES (simples e visuais, sem barras):
 *   fome      só o urso: ele adora mel (pág. 21) — a abelha resolve
 *   brincar   os outros animais querem brincar — um amigo perto ou o carinho resolvem
 * Depois aparecem "feliz" (coração) e "satisfeito" (o sinal de certo) por um tempo.
 */
export const NEEDS = {
  abelha: 'brincar',
  elefante: 'brincar',
  iguana: 'brincar',
  onca: 'brincar',
  urso: 'fome',
};

/** Ícone do balão de cada estado (ícones de linha do index.html). */
export const NEED_ICONS = { fome: 'mel', brincar: 'bola', feliz: 'coracao', satisfeito: 'check' };

/**
 * INTERAÇÕES entre animais (a ordem importa: vale a primeira que combinar).
 *   a, b        quem se encontra ('*' = qualquer animal)
 *   approach    quem vai até quem ('b' = b vai até a)
 *   a/b clip    a animação de cada um: 'special' (a marca da história) ou 'happy'
 *   satisfies   necessidade que o encontro resolve em `a`
 *   story       de onde vem (números do livro impresso)
 */
export const INTERACTIONS = [
  {
    a: 'urso', b: 'abelha', approach: 'b', aClip: 'special', bClip: 'happy', satisfies: ['fome', 'brincar'],
    story: 'O urso come mel (pág. 21, a abelhinha no ombro); a abelha faz o mel.',
  },
  {
    a: 'elefante', b: '*', approach: 'a', aClip: 'special', bClip: 'happy', satisfies: ['brincar'],
    story: 'O elefante da lagoa (pág. 15) brinca de jogar água pela tromba.',
  },
  {
    a: 'onca', b: '*', approach: 'a', aClip: 'special', bClip: 'happy', satisfies: ['brincar'],
    story: 'A onça é brincalhona (pág. 19, as borboletas).',
  },
  {
    a: '*', b: '*', approach: 'b', aClip: 'happy', bClip: 'happy', satisfies: ['brincar'],
    story: 'Os animais voltaram juntos para o zoológico (pág. 22).',
  },
];

/**
 * LETRAS: cada vogal é a inicial de um animal (A de Abelha, E de Elefante, I
 * de Iguana, O de Onça, U de Urso). Quando o animal chega perto da sua letra,
 * ela acende em turquesa (a magia de Signária) e o animal comemora com a sua
 * animação especial — como as runas acesas no livro.
 */
export const LETTERS = ['A', 'E', 'I', 'O', 'U'];
export const LETTER_OF = { abelha: 'A', elefante: 'E', iguana: 'I', onca: 'O', urso: 'U' };
