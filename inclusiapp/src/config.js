/**
 * CONFIGURAÇÃO CENTRAL — SinalizaAção: Animais em Voga
 *
 * Tudo o que liga página do livro → alvo AR → animal → modelo 3D → vídeo de
 * LIBRAS, os pares das cartas e os ajustes de AR ficam aqui.
 * Altere este arquivo para mudar o comportamento do app sem mexer no resto
 * do código. Configurações próprias: zoológico (src/zoo/zooConfig.js),
 * Sinalize (src/sign/signConfig.js) e tempos dos vídeos do intérprete
 * (src/libras/librasVideos.js).
 */

export const APP = {
  name: 'SinalizaAção',
  subtitle: 'Animais em Voga',
  version: '2.2.0',
  links: {
    store: 'https://loja.inclusivr.com.br/',
    site: 'https://inclusivr.com.br/',
  },
};

/**
 * OS 5 ANIMAIS DO LIVRO (modelos 3D do traço do ilustrador, repositório inclusivr-animais)
 *
 *   letter     a vogal (runa) que revela o animal no livro: A de Abelha...
 *   model      .glb leve (meshopt + WebP); `pageModel` substitui no livro
 *              (o elefante da lagoa tem o reflexo turquesa da pág. 15)
 *   portrait   retrato redondo recortado da ilustração do livro
 *   cards      cartas recortáveis: `picture` = face com o desenho,
 *              `sign` = face com o sinal em LIBRAS (as duas faces da MESMA carta)
 *   clips      animações do .glb: `idle` em laço, `walk` em laço (a abelha voa),
 *              `happy` uma vez, `special` uma vez (a marca da história)
 *   flies      a abelha voa (no livro e no zoológico)
 */
export const ANIMALS = [
  {
    id: 'abelha', name: 'Abelha', article: 'a', letter: 'A',
    model: 'assets/models/abelha.glb',
    portrait: 'assets/img/animais/abelha.webp',
    cards: { picture: 1, sign: 6 },
    clips: { idle: 'parado', walk: 'voar', happy: 'feliz', special: null },
    flies: true,
  },
  {
    id: 'elefante', name: 'Elefante', article: 'o', letter: 'E',
    model: 'assets/models/elefante.glb',
    pageModel: 'assets/models/elefante_lagoa.glb',
    portrait: 'assets/img/animais/elefante.webp',
    cards: { picture: 2, sign: 7 },
    clips: { idle: 'parado', walk: 'andar', happy: 'feliz', special: 'agua' },
  },
  {
    id: 'iguana', name: 'Iguana', article: 'a', letter: 'I',
    model: 'assets/models/iguana.glb',
    portrait: 'assets/img/animais/iguana.webp',
    cards: { picture: 5, sign: 8 },
    clips: { idle: 'parado', walk: 'andar', happy: 'feliz', special: 'crista' },
  },
  {
    id: 'onca', name: 'Onça', article: 'a', letter: 'O',
    model: 'assets/models/onca.glb',
    portrait: 'assets/img/animais/onca.webp',
    cards: { picture: 4, sign: 9 },
    clips: { idle: 'parado', walk: 'andar', happy: 'feliz', special: 'brincar' },
  },
  {
    id: 'urso', name: 'Urso', article: 'o', letter: 'U',
    model: 'assets/models/urso.glb',
    portrait: 'assets/img/animais/urso.webp',
    cards: { picture: 3, sign: 10 },
    clips: { idle: 'parado', walk: 'andar', happy: 'feliz', special: 'mel' },
  },
];

export const animalById = (id) => ANIMALS.find((a) => a.id === id) || null;

/**
 * LIVRO EM AR: as páginas que têm realidade aumentada nesta versão.
 *
 * `target` é o índice do alvo em assets/targets/paginas.mind, que segue a
 * numeração dos arquivos em /pag (Pagina1 → 0, Pagina2 → 1, ...). São as
 * mesmas 5 páginas (e o mesmo arquivo) da primeira versão do app.
 * `bookPage` é o número impresso no livro físico (os arquivos de referência
 * da diagramação, como "livro_p15", contam 2 páginas a mais).
 *
 * Coordenadas na página: x de −0,5 (esquerda) a +0,5 (direita); y com +
 * para cima, de −altura/2 a +altura/2, na medida da largura da página.
 *   home   onde o animal está desenhado: é dali que ele salta
 *   size   tamanho do animal em relação à largura da página
 *   lift   altura do voo (abelha), na medida da largura da página
 *
 * A Maga Aia e o Seu Zé em 3D foram arquivados em 10/11/2026 (docs/ARQUIVO.md).
 */
export const BOOK_PAGES = [
  // tamanhos maiores desde 10/11/2026 (a abelha e a iguana estavam pequenas para tocar)
  { target: 0, bookPage: 13, thumb: 'assets/img/paginas/pagina-ar1.webp', animal: { id: 'abelha', home: [-0.04, -0.26], size: 0.27, lift: 0.08 } },
  { target: 1, bookPage: 15, thumb: 'assets/img/paginas/pagina-ar2.webp', animal: { id: 'elefante', home: [-0.05, 0.0], size: 0.34 } },
  { target: 2, bookPage: 17, thumb: 'assets/img/paginas/pagina-ar3.webp', animal: { id: 'iguana', home: [-0.28, -0.17], size: 0.4 } },
  { target: 3, bookPage: 19, thumb: 'assets/img/paginas/pagina-ar4.webp', animal: { id: 'onca', home: [0.0, -0.14], size: 0.34 } },
  { target: 4, bookPage: 21, thumb: 'assets/img/paginas/pagina-ar5.webp', animal: { id: 'urso', home: [0.25, 0.0], size: 0.35 } },
];

export const pageByTarget = (target) => BOOK_PAGES.find((p) => p.target === target) || null;
export const pageOfAnimal = (id) => BOOK_PAGES.find((p) => p.animal?.id === id) || null;

/**
 * O PALCO DE BRINCAR: uma "página" invisível na frente da câmera, onde o
 * animal fica quando a página do livro sai da câmera (e onde o zoológico
 * acontece). Coordenadas da câmera: centro da tela, +y para cima.
 *   elevation  inclinação do "chão" (graus): 90 = visto de cima, 0 = de lado
 *   widthFrac  largura da página do palco, em frações da largura da tela
 *   maxHeightFrac  em paisagem, a largura não passa desta fração da altura
 *   centerY    altura do centro (fração da altura da tela; − = abaixo do meio)
 *   minZoom / maxZoom  limites da pinça
 *   walk       área do passeio no palco: fração da metade da largura da tela
 *              (o animal não sai da tela) e profundidade (fração da página)
 */
export const STAGE = {
  elevation: 24,
  widthFrac: 1.45,
  maxHeightFrac: 0.8,
  centerY: -0.17,
  minZoom: 0.6,
  maxZoom: 2.4,
  walk: { screen: 0.86, depth: 0.16 },
};

export const BOOK = {
  targets: 'assets/targets/paginas', // .mind / .mind.gz / .json
  /** segundos sem encontrar página até mostrar a dica de aproximar/afastar */
  notFoundHintAfter: 8,
  /** margem da página onde o animal não anda (fração da largura) */
  margin: 0.07,
  /**
   * A PÁGINA É O VALIDADOR: depois que o animal saltou da página, ele fica na
   * tela para brincar, mesmo que a câmera perca a página.
   *   smoothMs      o animal segue a página com este amortecimento: o
   *                 rastreio atualiza a pose 10 a 20 vezes por segundo, e o
   *                 desenho, 60 (sem isso, o animal anda "aos saltinhos")
   *   stageAfterMs  a página sumiu: depois deste tempo, o animal desliza
   *                 para o palco de brincar e continua lá
   *   glideMs       duração da viagem página ↔ palco
   *   refocusMs     depois de perder a página, procura primeiro a mesma
   *                 página por este tempo (reencontra mais rápido)
   */
  smoothMs: 70,
  stageAfterMs: 150,
  glideMs: 650,
  refocusMs: 1500,
};

/**
 * MÚSICA: a trilha do sound design da InclusiVR ("oogway morrendo"), em laço
 * e baixinha (ui/music.js). Para trocar: ponha o MP3 em assets/musica/ (nome
 * sem acento nem espaço) e escreva o nome do arquivo em
 * assets/musica/musica.json ("arquivo"). Sem arquivo, o botão MÚSICA não aparece.
 *   volume   0 … 1. A trilha foi medida em −22 LUFS (o começo, mais calmo,
 *            em −29); com 0,45 ela fica perto de −29 LUFS: um fundo, por
 *            baixo dos efeitos, que ainda se ouve no alto-falante do celular
 *   fadeIn   segundos para entrar suave
 */
export const MUSIC = {
  list: 'assets/musica/musica.json',
  volume: 0.45,
  fadeIn: 2.5,
};

/**
 * VÍDEOS DE LIBRAS: chroma key calibrado para o fundo verde-limão dos vídeos.
 * O "score" de fundo de cada pixel é  s + hueWeight·h, onde
 *   s = (min(R,G) − B) / max(R,G,B)   (saturação amarelo-esverdeada)
 *   h = (G − R) / max(R,G,B)          (verde acima do vermelho)
 * Pixels com score acima de `high` ficam transparentes; abaixo de `low`, opacos.
 */
export const LIBRAS = {
  chroma: {
    hueWeight: 2.0,
    low: 0.24,
    high: 0.4,
    minLuma: 0.12, // pixels muito escuros (cabelo, camiseta) nunca são removidos
    despill: 0.75, // remove o reflexo verde na pele/cabelo
  },
  /** recorte do quadro do vídeo [x0, y0, x1, y1] (0..1) — tira bordas vazias */
  crop: [0.04, 0.0, 0.96, 1.0],
};

/**
 * JOGO DE CARTAS: o jogo mostra o animal (ou a letra) e a criança procura,
 * entre as cartas com a face de LIBRAS para cima, o sinal correspondente.
 *
 * Cada par é uma carta física de duas faces (cartas/cartaN.png):
 *   show    face que o jogo mostra na tela (desenho do animal ou a letra)
 *   answer  face com o sinal em LIBRAS que a criança precisa escanear
 * As cartas são lidas de assets/targets/cartas.json (npm run targets).
 */
export const CARD_PAIRS = [
  ...ANIMALS.map((a) => ({ id: a.id, kind: 'animal', label: a.name, show: a.cards.picture, answer: a.cards.sign, image: a.portrait })),
  ...[['A', 16, 11], ['E', 17, 12], ['I', 18, 13], ['O', 19, 14], ['U', 20, 15]].map(([letter, show, answer]) => ({
    id: letter, kind: 'letra', label: `Letra ${letter}`, show, answer, image: `assets/img/cartas-mini/carta${show}.webp`,
  })),
];

export const GAME = {
  targets: 'assets/targets/cartas',
  /** nomes das faces (textos acessíveis e mensagens); faces sem nome viram "Carta N" */
  labels: {
    1: 'Abelha', 2: 'Elefante', 3: 'Urso', 4: 'Onça', 5: 'Iguana',
    6: 'ABELHA em LIBRAS', 7: 'ELEFANTE em LIBRAS', 8: 'IGUANA em LIBRAS', 9: 'ONÇA em LIBRAS', 10: 'URSO em LIBRAS',
    11: 'Letra A em LIBRAS', 12: 'Letra E em LIBRAS', 13: 'Letra I em LIBRAS', 14: 'Letra O em LIBRAS', 15: 'Letra U em LIBRAS',
    16: 'Letra A', 17: 'Letra E', 18: 'Letra I', 19: 'Letra O', 20: 'Letra U',
  },
  scoring: {
    /** pontos por acerto */
    hitPoints: 100,
    /** errar não tira pontos (público de 3 a 8 anos): a criança tenta outra carta */
    wrongPenalty: 0,
    minScore: 0,
    /** bônus de rapidez: `max` até `fullUntil` s, caindo até 0 em `zeroAt` s */
    timeBonus: { mode: 'linear', max: 50, fullUntil: 8, zeroAt: 45 },
  },
  /** a mesma carta errada só mostra o aviso de novo depois deste tempo (s) */
  wrongHintCooldown: 3,
  /** depois do acerto: comemoração até o próximo desafio (s) */
  delayNextMission: 1.6,
  /** embaralhar: só no começo da partida (s) */
  shuffleTime: 1.4,
};

/**
 * Ajustes do MindAR (rastreamento), filtro "One Euro" aplicado à pose:
 *  - filterMinCF: menor = mais estável parado (porém com mais atraso)
 *  - filterBeta : maior = acompanha melhor movimentos rápidos (porém treme mais)
 *  - warmupTolerance: quadros seguidos vendo a imagem até mostrá-la
 *  - missTolerance  : quadros sem ver a imagem até considerá-la perdida
 * Padrão do MindAR: 0.001 / 1000 / 5 / 5.
 */
export const AR = {
  camera: { width: 640, height: 480 },
  maxPixelRatio: 2,
  book: { filterMinCF: 0.001, filterBeta: 1, warmupTolerance: 4, missTolerance: 8 },
  game: { filterMinCF: 0.001, filterBeta: 1000, warmupTolerance: 3, missTolerance: 4 },
};
