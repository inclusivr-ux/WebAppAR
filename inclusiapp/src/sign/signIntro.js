/**
 * Tela "COMO JOGAR" do Sinalize! (antes da câmera).
 *
 * Enquanto a pessoa olha, já baixa em segundo plano o reconhecimento de mãos
 * — exceto no modo de economia de dados do celular. Sem recordes nem pontos
 * desde a versão 2.2.
 */
import { unlockAudio } from '../ui/sound.js';
import { storage } from '../ui/storage.js';
import { prefetchHandLandmarker } from './handTracker.js';
import { SIGN_GAME } from './signConfig.js';

export function setupSignIntro(screen, { start }) {
  screen.querySelector('[data-action="start-sign"]').addEventListener('click', () => {
    unlockAudio();
    start();
  });
  const order = screen.querySelector('[data-sign-order]');
  return {
    enter() {
      // a ordem das vogais: em ordem na primeira vez, sorteada depois (sem surpresa)
      if (order) {
        order.innerHTML = storage.get(SIGN_GAME.orderKey, false)
          ? 'As vogais vêm <strong>sorteadas</strong>: cada partida tem uma ordem diferente.'
          : 'Na primeira vez, as vogais vêm <strong>em ordem</strong>: A, E, I, O, U. Depois, elas são <strong>sorteadas</strong>.';
      }
      if (navigator.connection?.saveData) return;
      prefetchHandLandmarker();
    },
  };
}
