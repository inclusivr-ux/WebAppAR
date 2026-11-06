/**
 * JOGOS: Jogo de Cartas, Zoológico e Sinalize!
 *
 * Os cartões mostram o recorde de cada jogo (só leitura: nada aqui muda os jogos).
 */
import { savedGameInfo } from '../game/cardGame.js';
import { storage } from './storage.js';
import { loadRecords } from '../sign/signRecords.js';

export function setupSala(screen) {
  const cardsMeta = screen.querySelector('[data-tile-meta="cards"]');
  const signMeta = screen.querySelector('[data-tile-meta="sign"]');
  return {
    enter() {
      const saved = savedGameInfo();
      const record = storage.get('gameRecord', 0);
      cardsMeta.textContent = saved ? `Jogo salvo: ${saved.used} de ${saved.total}` : record ? `Recorde: ${record} pontos` : '';
      cardsMeta.hidden = !cardsMeta.textContent;
      const records = loadRecords(storage);
      signMeta.textContent = records.matches ? `Recorde: ${records.bestScore} pontos` : '';
      signMeta.hidden = !signMeta.textContent;
    },
  };
}
