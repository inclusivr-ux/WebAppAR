/**
 * Tela "COMO JOGAR" do Sinalize! (antes da câmera).
 *
 * Mostra o recorde salvo e, enquanto a pessoa olha, já baixa em segundo
 * plano o reconhecimento de mãos e o primeiro vídeo — exceto no modo de
 * economia de dados do celular.
 */
import { storage } from '../ui/storage.js';
import { unlockAudio } from '../ui/sound.js';
import { loadRecords } from './signRecords.js';
import { prefetchHandLandmarker } from './handTracker.js';

export function setupSignIntro(screen, { start }) {
  const button = screen.querySelector('[data-action="start-sign"]');
  const box = screen.querySelector('[data-records]');
  const score = box.querySelector('[data-record-score]');
  button.addEventListener('click', () => {
    unlockAudio();
    start();
  });
  return {
    enter() {
      const records = loadRecords(storage);
      box.hidden = !records.matches;
      score.textContent = records.bestScore;
      if (navigator.connection?.saveData) return;
      prefetchHandLandmarker();
    },
  };
}
