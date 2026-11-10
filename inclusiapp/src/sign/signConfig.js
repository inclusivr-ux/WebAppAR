/**
 * SINALIZE! — configuração (Jogo 3 da sala de jogos).
 *
 *   o jogo sorteia uma VOGAL (ordem fixa por partida, com semente)
 *   → mostra a letra e a carta do sinal → o intérprete faz o sinal DUAS vezes
 *   → SUA VEZ: "FAÇA O SINAL DO A PARA A CÂMERA" (câmera frontal), sem pressa
 *   → a câmera reconheceu: ISSO! → próximo
 *   → a câmera viu outro sinal: QUASE! Olhe de novo… (e a criança continua)
 *
 * Sem pontos e sem tempo (pedido da equipe, 10/11/2026): o relógio passava a
 * ideia de fazer rápido, e o reconhecimento funciona melhor com calma.
 *
 * Só as vogais: são configurações de mão paradas, que a câmera reconhece bem
 * (cerca de 90% nos testes da equipe). Os sinais dos animais têm movimento e
 * saíram do jogo (decisão de 10/11/2026); as regras provisórias deles estão no
 * histórico do git (commit 9ceda81), para o Signária IA.
 *
 * O jogo precisa da câmera (como os outros jogos). A imagem é analisada no
 * aparelho e nunca é gravada nem enviada.
 * Mude este arquivo para alterar o jogo sem mexer no resto do código.
 */
import { LIBRAS_VIDEOS, VOWEL_CLIPS } from '../libras/librasVideos.js';

export const SIGN_GAME = {
  /**
   * O que pode ser sorteado: `card` = a face da carta com o sinal da vogal,
   * `letterCard` = a face com a letra (cartaN.png).
   */
  items: [
    { kind: 'letra', id: 'A', letter: 'A', card: 11, letterCard: 16, label: 'LETRA A' },
    { kind: 'letra', id: 'E', letter: 'E', card: 12, letterCard: 17, label: 'LETRA E' },
    { kind: 'letra', id: 'I', letter: 'I', card: 13, letterCard: 18, label: 'LETRA I' },
    { kind: 'letra', id: 'O', letter: 'O', card: 14, letterCard: 19, label: 'LETRA O' },
    { kind: 'letra', id: 'U', letter: 'U', card: 15, letterCard: 20, label: 'LETRA U' },
  ],

  /** desafios por partida (no máximo a quantidade de itens) */
  rounds: 5,

  /** o intérprete faz a vogal duas vezes (e para um pouco na vogal, ver VOWEL_CLIPS.hold) */
  watch: { letterTimes: 2 },

  timing: {
    nextMs: 1900, // depois do ISSO!, até o próximo desafio
    almostMs: 2600, // quanto tempo o "QUASE!" fica na tela (a criança continua tentando)
    tipAfter: 12, // segundos sem acertar até aparecer UMA dica (luz, mão inteira na tela); nada se perde
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

/** O trecho do vídeo do intérprete de cada desafio: { src, start, end, repeat, hold }. */
export function clipFor(item) {
  const c = VOWEL_CLIPS[item.letter];
  return { src: LIBRAS_VIDEOS[c.video].src, start: c.start, end: c.end, hold: c.hold || 0, repeat: SIGN_GAME.watch.letterTimes };
}
