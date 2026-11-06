/**
 * ZOOLÓGICO DO SEU ZÉ — configuração.
 *
 * Uma caixa de areia: a criança coloca e tira animais do livro e runas das
 * vogais, arrasta um para perto do outro e observa o que acontece. Sem
 * regras, sem tarefas, sem textos para ler: só o que a história mostra.
 *
 * As interações respeitam o livro e as fichas dos animais
 * (repositório inclusivr-animais). Nada de comida, remédio ou objetos de fora.
 */

export const ZOO = {
  /** quantos elementos cabem de uma vez (desempenho em celulares simples) */
  maxItems: 12,
  /** área do chão (unidades da cena; a câmera olha de cima e de frente) */
  ground: { halfWidth: 2.1, halfDepth: 1.25 },
  /** tamanho de cada animal no zoológico (maior medida) */
  sizes: { abelha: 0.34, elefante: 0.95, iguana: 0.72, onca: 0.78, urso: 0.82 },
  /** altura do voo da abelha */
  beeLift: 0.55,
  /** runas das vogais (arte do Igor): pedra apagada e acesa */
  runeHeight: 0.62,
  /** quanto tempo a runa fica acesa depois de encontrar o seu animal (s) */
  runeLit: 25,
  /** distância para dois elementos "se encontrarem" */
  meetDistance: 0.85,
  /** depois de uma interação, o mesmo par só repete depois deste tempo (s) */
  pairCooldown: 14,
  /** cada animal sente uma necessidade de novo depois de [mín, máx] segundos */
  needEvery: [22, 45],
};

/**
 * NECESSIDADES (simples e visuais, sem barras):
 *   fome      só o urso: ele adora mel (pág. 23) — a abelha resolve
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
 * INTERAÇÕES (a ordem importa: vale a primeira que combinar).
 *   a, b        quem se encontra ('*' = qualquer animal)
 *   approach    quem vai até quem ('b' = b vai até a)
 *   a/b clip    a animação de cada um: 'special' (a marca da história) ou 'happy'
 *   satisfies   necessidade que o encontro resolve em `a`
 *   story       de onde vem (para quem mexer aqui conferir)
 */
export const INTERACTIONS = [
  {
    a: 'urso', b: 'abelha', approach: 'b', aClip: 'special', bClip: 'happy', satisfies: ['fome', 'brincar'],
    story: 'O urso come mel (pág. 23, a abelhinha no ombro); a abelha faz o mel.',
  },
  {
    a: 'elefante', b: '*', approach: 'a', aClip: 'special', bClip: 'happy', satisfies: ['brincar'],
    story: 'O elefante da lagoa (pág. 17) brinca de jogar água pela tromba.',
  },
  {
    a: 'onca', b: '*', approach: 'a', aClip: 'special', bClip: 'happy', satisfies: ['brincar'],
    story: 'A onça é brincalhona (pág. 21, as borboletas).',
  },
  {
    a: '*', b: '*', approach: 'b', aClip: 'happy', bClip: 'happy', satisfies: ['brincar'],
    story: 'Os animais voltaram juntos para o zoológico (pág. 24).',
  },
];

/**
 * RUNAS: cada vogal revela o seu animal (A de Abelha, E de Elefante, I de
 * Iguana, O de Onça, U de Urso). Quando o animal chega perto da sua runa, ela
 * acende em turquesa e o animal comemora com a sua animação especial — a
 * iguana ergue a crista, como no sinal de IGUANA.
 */
export const RUNES = ['A', 'E', 'I', 'O', 'U'];
