/**
 * Telas explicativas (antes da câmera).
 *
 * Livro: além do passo a passo, mostra QUAIS páginas têm AR (lidas de
 * BOOK_PAGES, config.js) com a miniatura de cada uma e o animal dela.
 *
 * Enquanto a pessoa lê, os arquivos pesados da próxima etapa (biblioteca de
 * AR e imagens de reconhecimento) já começam a baixar em segundo plano —
 * exceto quando o celular está em modo de economia de dados.
 */
import { BOOK, BOOK_PAGES, GAME, animalById } from '../config.js';
import { loadMindAR } from '../ar/arSession.js';
import { prefetchTargets, loadTargets } from '../ar/targets.js';
import { savedGameInfo } from '../game/cardGame.js';
import { unlockAudio } from './sound.js';

const saveData = () => !!navigator.connection?.saveData;

function prefetch(targets) {
  if (saveData()) return;
  loadMindAR().catch(() => {});
  prefetchTargets(targets);
}

function pageItem(page) {
  const li = document.createElement('li');
  li.className = 'paginas__item';
  const animal = animalById(page.animal.id);
  li.innerHTML = `
    <img class="paginas__img" src="${page.thumb}" alt="" width="120" height="120" loading="lazy">
    <span class="sg-selo paginas__selo" aria-hidden="true">${page.bookPage}</span>
    <img class="sg-retrato paginas__quem" src="${animal.portrait}" alt="" width="38" height="38" loading="lazy">
    <span class="paginas__nome">${animal.name}</span>`;
  li.setAttribute('aria-label', `Página ${page.bookPage}: ${animal.name}`);
  return li;
}

function renderPages(list) {
  list.replaceChildren(...BOOK_PAGES.map(pageItem));
}

export function setupBookIntro(screen, { start }) {
  screen.querySelector('[data-action="start-book"]').addEventListener('click', () => {
    unlockAudio();
    start();
  });
  renderPages(screen.querySelector('[data-pages]'));
  return {
    enter() {
      prefetch(BOOK.targets);
    },
  };
}

export function setupGameIntro(screen, { start }) {
  const continueBtn = screen.querySelector('[data-action="continue-game"]');
  screen.querySelector('[data-action="start-game"]').addEventListener('click', () => {
    unlockAudio();
    start({ resume: false });
  });
  continueBtn.addEventListener('click', () => {
    unlockAudio();
    start({ resume: true });
  });
  return {
    enter() {
      prefetch(GAME.targets);
      const saved = savedGameInfo();
      continueBtn.hidden = !saved;
      if (saved) continueBtn.setAttribute('aria-label', `Continuar: ${saved.used} de ${saved.total}, ${saved.score} pontos`);
      if (saveData()) return;
      loadTargets(GAME.targets).catch(() => {});
    },
  };
}
