/**
 * Tela "COMO JOGAR" do Sinalize! (antes da câmera).
 *
 * Enquanto a pessoa olha, já baixa em segundo plano o reconhecimento de mãos
 * — exceto no modo de economia de dados do celular. Sem recordes nem pontos
 * desde a versão 2.2.
 */
import { unlockAudio } from '../ui/sound.js';
import { prefetchHandLandmarker } from './handTracker.js';

export function setupSignIntro(screen, { start }) {
  screen.querySelector('[data-action="start-sign"]').addEventListener('click', () => {
    unlockAudio();
    start();
  });
  return {
    enter() {
      if (navigator.connection?.saveData) return;
      prefetchHandLandmarker();
    },
  };
}
