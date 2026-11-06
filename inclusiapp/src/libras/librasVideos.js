/**
 * VÍDEOS DE LIBRAS DO FAUSTON: onde está cada parte em cada vídeo.
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
 * `conferido: false` = falta o Fauston conferir. Para ajustar: mude os números
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
 * As VOGAIS sozinhas: a primeira letra da soletração de cada animal é a
 * vogal da runa (A de ABELHA, E de ELEFANTE, I de IGUANA, O de ONÇA, U de URSO).
 * Assim o Sinalize mostra o Fauston fazendo a letra sem precisar de vídeo novo.
 */
export const VOWEL_CLIPS = {
  A: { video: 'abelha', ...LIBRAS_VIDEOS.abelha.spell[0] },
  E: { video: 'elefante', ...LIBRAS_VIDEOS.elefante.spell[0] },
  I: { video: 'iguana', ...LIBRAS_VIDEOS.iguana.spell[0] },
  O: { video: 'onca', ...LIBRAS_VIDEOS.onca.spell[0] },
  U: { video: 'urso', ...LIBRAS_VIDEOS.urso.spell[0] },
};

/**
 * Índice da letra que o Fauston está fazendo no instante `t` (karaokê), ou
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
