/**
 * VÍDEOS DE LIBRAS DO INTÉRPRETE: onde está cada parte em cada vídeo.
 *
 * Cada vídeo (videos/<animal>.mp4) tem duas partes seguidas:
 *   1. a SOLETRAÇÃO do nome, letra por letra (datilologia);
 *   2. o SINAL do animal (gravado mais de uma vez, sem cortes).
 *
 * `signTwice` é o trecho com o sinal feito DUAS vezes (o Sinalize mostra só
 * esse trecho: os vídeos repetem o sinal de 2 a 4 vezes).
 *
 * Os tempos estão em segundos. Foram medidos com o reconhecimento de mãos
 * (tools/medir-libras.mjs: uma letra por pausa da mão) e conferidos quadro a
 * quadro, com erro de cerca de 0,1 s. Cada letra vai do meio da passagem
 * anterior até o meio da próxima, para o destaque nunca "pular" um quadro.
 *
 * `conferido: false` = falta o intérprete conferir. Para ajustar: mude os números
 * e veja no app (Livro → página do animal → LIBRAS → SOLETRAR).
 */
export const LIBRAS_VIDEOS = {
  abelha: {
    src: 'videos/abelha.mp4',
    word: 'ABELHA',
    spell: [
      { letter: 'A', start: 0.4, end: 1.22 },
      { letter: 'B', start: 1.22, end: 2.22 },
      { letter: 'E', start: 2.22, end: 2.88 },
      { letter: 'L', start: 2.88, end: 3.88 },
      { letter: 'H', start: 3.88, end: 4.38 },
      { letter: 'A', start: 4.38, end: 5.25 },
    ],
    sign: { start: 5.3, end: 10.55 },
    signTwice: { start: 5.3, end: 10.55 },
    conferido: false,
  },
  elefante: {
    src: 'videos/elefante.mp4',
    word: 'ELEFANTE',
    spell: [
      { letter: 'E', start: 0.95, end: 1.55 },
      { letter: 'L', start: 1.55, end: 2.55 },
      { letter: 'E', start: 2.55, end: 3.22 },
      { letter: 'F', start: 3.22, end: 4.05 },
      { letter: 'A', start: 4.05, end: 4.8 },
      { letter: 'N', start: 4.8, end: 5.7 },
      { letter: 'T', start: 5.7, end: 6.38 },
      { letter: 'E', start: 6.38, end: 7.2 },
    ],
    sign: { start: 7.25, end: 13.45 },
    signTwice: { start: 7.25, end: 13.45 },
    conferido: false,
  },
  iguana: {
    src: 'videos/iguana.mp4',
    word: 'IGUANA',
    spell: [
      { letter: 'I', start: 0.4, end: 1.37 },
      { letter: 'G', start: 1.37, end: 1.98 },
      { letter: 'U', start: 1.98, end: 2.88 },
      { letter: 'A', start: 2.88, end: 3.62 },
      { letter: 'N', start: 3.62, end: 4.38 },
      { letter: 'A', start: 4.38, end: 5.3 },
    ],
    sign: { start: 5.55, end: 17.1 },
    signTwice: { start: 5.55, end: 14.5 },
    conferido: false,
  },
  onca: {
    src: 'videos/onca.mp4',
    word: 'ONÇA',
    spell: [
      { letter: 'O', start: 0.85, end: 1.58 },
      { letter: 'N', start: 1.58, end: 2.42 },
      { letter: 'Ç', start: 2.42, end: 3.22 },
      { letter: 'A', start: 3.22, end: 4.4 },
    ],
    sign: { start: 4.95, end: 18.1 },
    signTwice: { start: 4.95, end: 11.0 },
    conferido: false,
  },
  urso: {
    src: 'videos/urso.mp4',
    word: 'URSO',
    spell: [
      { letter: 'U', start: 0.95, end: 1.9 },
      { letter: 'R', start: 1.9, end: 2.42 },
      { letter: 'S', start: 2.42, end: 3.05 },
      { letter: 'O', start: 3.05, end: 4.05 },
    ],
    sign: { start: 4.55, end: 9.9 },
    signTwice: { start: 4.55, end: 9.9 },
    conferido: false,
  },
};

/**
 * As VOGAIS sozinhas (Sinalize!): a primeira letra da soletração de cada
 * animal é a vogal (A de ABELHA, E de ELEFANTE, I de IGUANA, O de ONÇA, U de
 * URSO). O trecho começa com a mão subindo do repouso e TERMINA enquanto a mão
 * ainda está parada na vogal, antes de começar a letra seguinte (o U de URSO
 * não mostra o R). Medido quadro a quadro em 10/11/2026 (a cada 0,1 s):
 *   A  mão parada de 0,5 a 1,2 s; em 1,3 s começa o B
 *   E  mão parada de 1,0 a 1,52 s; a partir de 1,55 s vai para o L
 *   I  mão parada de 0,5 a 1,15 s; em 1,2 s começa o G
 *   O  mão parada de 1,0 a 1,5 s; em 1,6 s começa o N
 *   U  mão parada de 1,2 a 1,62 s; em 1,7 s os dedos começam a cruzar (R)
 * `hold`: no fim de cada vez, o vídeo fica parado na vogal por este tempo (s),
 * para a criança ver bem a mão.
 */
export const VOWEL_CLIPS = {
  A: { video: 'abelha', start: 0.3, end: 1.2, hold: 0.7 },
  E: { video: 'elefante', start: 0.7, end: 1.52, hold: 0.7 },
  I: { video: 'iguana', start: 0.25, end: 1.13, hold: 0.7 },
  O: { video: 'onca', start: 0.75, end: 1.5, hold: 0.7 },
  U: { video: 'urso', start: 0.95, end: 1.6, hold: 0.7 },
};

/**
 * Índice da letra que o intérprete está fazendo no instante `t` (karaokê), ou
 * −1 antes da primeira letra. Depois da última, continua na última.
 */
export function letterAt(spell, t) {
  if (!spell?.length || t < spell[0].start) return -1;
  for (let i = spell.length - 1; i >= 0; i--) if (t >= spell[i].start) return i;
  return -1;
}

/** Trecho do vídeo de cada atividade: 'sign' (sinal) ou 'spell' (soletrar). */
export function segmentOf(video, mode) {
  if (mode === 'spell') return { start: video.spell[0].start, end: video.spell[video.spell.length - 1].end };
  return { ...video.sign };
}
