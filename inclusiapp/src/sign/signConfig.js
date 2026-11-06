/**
 * SINALIZE! — configuração (Jogo 3 da sala de jogos).
 *
 *   o jogo sorteia uma letra ou um animal (ordem fixa por partida, com semente)
 *   → mostra a carta → o Fauston faz o sinal DUAS vezes (OLHE)
 *   → 3, 2, 1… SUA VEZ: a criança faz o sinal para a câmera (frontal)
 *   → a câmera reconheceu dentro do tempo: ISSO! + pontos → próximo
 *
 * Sem escanear carta, sem contar animais, sem desenhar a mão na tela.
 * Mude este arquivo para alterar o jogo sem mexer no resto do código.
 */
import { LIBRAS_VIDEOS, VOWEL_CLIPS } from '../libras/librasVideos.js';

export const SIGN_GAME = {
  /**
   * O que pode ser sorteado. `card` = a face da carta com o sinal (cartaN.png).
   * As letras usam o trecho da soletração do Fauston (A de ABELHA...); os
   * animais, o trecho do sinal feito duas vezes (src/libras/librasVideos.js).
   */
  items: [
    { kind: 'letra', id: 'A', letter: 'A', card: 11, label: 'LETRA A' },
    { kind: 'letra', id: 'E', letter: 'E', card: 12, label: 'LETRA E' },
    { kind: 'letra', id: 'I', letter: 'I', card: 13, label: 'LETRA I' },
    { kind: 'letra', id: 'O', letter: 'O', card: 14, label: 'LETRA O' },
    { kind: 'letra', id: 'U', letter: 'U', card: 15, label: 'LETRA U' },
    { kind: 'animal', id: 'abelha', animal: 'abelha', card: 6, label: 'ABELHA' },
    { kind: 'animal', id: 'elefante', animal: 'elefante', card: 7, label: 'ELEFANTE' },
    { kind: 'animal', id: 'iguana', animal: 'iguana', card: 8, label: 'IGUANA' },
    { kind: 'animal', id: 'onca', animal: 'onca', card: 9, label: 'ONÇA' },
    { kind: 'animal', id: 'urso', animal: 'urso', card: 10, label: 'URSO' },
  ],

  /** desafios por partida (no máximo a quantidade de itens) */
  rounds: 10,

  /** a letra (trecho curto) é mostrada duas vezes; o trecho do animal já tem o sinal duas vezes */
  watch: { letterTimes: 2, animalTimes: 1 },

  /**
   * PONTUAÇÃO: sinal reconhecido = `points` + bônus de rapidez (contado do
   * "SUA VEZ!" até a câmera reconhecer). Errar ou pular não tira pontos.
   */
  scoring: {
    sign: {
      points: 100,
      speed: {
        mode: 'tiers',
        tiers: [
          { upTo: 3, bonus: 50 },
          { upTo: 6, bonus: 30 },
          { upTo: 9, bonus: 15 },
          { upTo: Infinity, bonus: 5 },
        ],
      },
    },
  },

  /** estrelas no fim: fração dos sinais certos */
  stars: [{ min: 0.9, stars: 3 }, { min: 0.5, stars: 2 }, { min: 0, stars: 1 }],

  timing: {
    countdown: 3, // 3, 2, 1… antes da vez da criança
    tryFor: 15, // segundos para fazer o sinal (depois: QUASE! e as opções)
    nextMs: 1700, // depois do ISSO!, até o próximo desafio
  },

  /** câmera: 'user' = frontal (padrão; dá para trocar na tela) */
  camera: { facing: 'user', width: 640, height: 480 },

  /**
   * RECONHECIMENTO (MediaPipe Hand Landmarker + src/sign/signRecognizers.js)
   *   fps          análises da câmera por segundo (menos = menos bateria)
   *   minScore     nota mínima (0 … 1) para considerar que a mão faz uma vogal
   *   holdMs       tempo segurando a vogal certa até ela valer
   *   delegate     'GPU' (mais rápido) ou 'CPU' — se a GPU falhar, usa a CPU
   */
  recognition: {
    fps: 12,
    numHands: 2,
    minScore: 0.5,
    holdMs: 700,
    wrongMs: 1600,
    unknownMs: 3200,
    cooldownMs: 2600,
    lostMs: 800,
    smoothing: 0.45,
    delegate: 'GPU',
    minDetectionConfidence: 0.5,
    minPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  },
};

export const itemById = (id) => SIGN_GAME.items.find((i) => i.id === id) || null;

/** O trecho do vídeo do Fauston de cada desafio: { src, start, end, repeat }. */
export function clipFor(item) {
  if (item.kind === 'letra') {
    const c = VOWEL_CLIPS[item.letter];
    return { src: LIBRAS_VIDEOS[c.video].src, start: c.start, end: c.end, repeat: SIGN_GAME.watch.letterTimes };
  }
  const v = LIBRAS_VIDEOS[item.animal];
  const seg = v.signTwice || v.sign;
  return { src: v.src, start: seg.start, end: seg.end, repeat: SIGN_GAME.watch.animalTimes };
}
