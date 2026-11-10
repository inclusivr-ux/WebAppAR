/**
 * JOGOS: Jogo de Cartas, Zoológico e Sinalize!
 *
 * O cartão do jogo de cartas mostra o jogo salvo ou o recorde (só leitura:
 * nada aqui muda os jogos). O Sinalize! não tem pontos desde a versão 2.2.
 */
import { savedGameInfo } from '../game/cardGame.js';
import { storage } from './storage.js';

export function setupSala(screen) {
  const cardsMeta = screen.querySelector('[data-tile-meta="cards"]');
  return {
    enter() {
      const saved = savedGameInfo();
      const record = storage.get('gameRecord', 0);
      cardsMeta.textContent = saved ? `Jogo salvo: ${saved.used} de ${saved.total}` : record ? `Recorde: ${record} pontos` : '';
      cardsMeta.hidden = !cardsMeta.textContent;
    },
  };
}
