/**
 * ZOOLÓGICO EM AR — configuração.
 *
 * A criança abre o livro na página 22 (o zoológico cheio, a volta ao
 * zoológico) e aponta o celular. Depois coloca as CARTAS em cima da página:
 *   - carta de um animal (o desenho ou o sinal em LIBRAS) → o animal salta da
 *     carta para o zoológico;
 *   - carta de uma vogal (o sinal em LIBRAS ou a letra) → aparece a LETRA do
 *     português, grande e animada: o par entre o sinal e a letra.
 * Todos ficam juntos na página e se encontram: o que acontece depende de
 * quem está lá (as interações da história, abaixo). A Maga Aia e o Seu Zé
 * vêm pelos botões (ainda não têm carta). Tocar = carinho; a casinha leva
 * alguém para descansar (sai do zoológico).
 *
 * As interações respeitam o livro e as fichas dos animais (repositório
 * inclusivr-animais). Nada de comida, remédio ou objetos de fora.
 */
import { ANIMALS, CARD_PAIRS } from '../config.js';

export const ZOO = {
  /** alvos: 0 = a página do zoológico; 1..20 = as cartas (tools/montar-zoologico.py) */
  targets: 'assets/targets/zoologico',
  pageTarget: 0,
  bookPage: 22,
  pageThumb: 'assets/img/paginas/pagina22.webp',
  /**
   * Ajustes do MindAR: a página e UMA carta ao mesmo tempo (maxTrack 2). A
   * carta que já trouxe alguém deixa de ser procurada, para o celular achar
   * a próxima carta que a criança colocar.
   */
  tuning: { filterMinCF: 0.001, filterBeta: 1, warmupTolerance: 3, missTolerance: 8, maxTrack: 2 },
  /** quantos cabem de uma vez (desempenho em celulares simples) */
  maxItems: 12,
  /** tamanho de cada um na página (fração da largura da página) */
  sizes: { abelha: 0.16, elefante: 0.26, iguana: 0.26, onca: 0.23, urso: 0.24, letra: 0.12, personagem: 0.28 },
  /** onde a Aia e o Seu Zé estão desenhados na página (é dali que eles saltam) */
  homes: { seuze: [-0.24, -0.08], aia: [0.24, -0.2] },
  beeLift: 0.06,
  /** distância (fração da largura da página) para dois "se encontrarem" */
  meetDistance: 0.16,
  /** depois de uma interação, o mesmo par só repete depois deste tempo (s) */
  pairCooldown: 14,
  /** cada animal sente uma necessidade de novo depois de [mín, máx] segundos */
  needEvery: [22, 45],
  /** de tempos em tempos [mín, máx] (s), um animal vai visitar alguém (a sua letra ou um amigo) */
  visitEvery: [7, 14],
  /** quanto tempo a letra fica acesa depois de encontrar o seu animal (s) */
  letterLit: 20,
  /** a mesma carta, vista de novo, só chama o animal depois deste tempo (s) */
  cardCooldown: 6,
  /** sem a página, depois deste tempo (ms) aparece "volte para o zoológico" */
  holdGraceMs: 1200,
  lostGraceMs: 4500,
};

/**
 * CARTAS → o que aparece (as duas faces de cada carta valem).
 * Carta N do baralho = alvo N do zoologico.mind.
 */
export const ZOO_CARDS = (() => {
  const map = {};
  for (const a of ANIMALS) {
    map[a.cards.picture] = { kind: 'animal', type: a.id, face: 'desenho' };
    map[a.cards.sign] = { kind: 'animal', type: a.id, face: 'sinal' };
  }
  for (const p of CARD_PAIRS.filter((c) => c.kind === 'letra')) {
    map[p.answer] = { kind: 'letra', type: p.id, face: 'sinal' };
    map[p.show] = { kind: 'letra', type: p.id, face: 'letra' };
  }
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
