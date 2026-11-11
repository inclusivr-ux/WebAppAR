/**
 * TELA CHEIA (pedido da equipe, 10/11/2026): o app ocupa a tela toda, sem a
 * barra do navegador.
 *
 * Usa a Fullscreen API. O botão só aparece onde o navegador deixa: o Chrome
 * do Android deixa; o Safari do iPhone não (lá, "Adicionar à Tela de Início"
 * abre o app sem a barra). Instalado como aplicativo, ele já abre em tela
 * cheia (manifest.webmanifest: "display": "fullscreen").
 */
const root = document.documentElement;

export function fullscreenSupported() {
  const can = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const enabled = document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? can;
  const installed = window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches;
  return can && enabled !== false && !installed;
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export async function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      await (root.requestFullscreen || root.webkitRequestFullscreen).call(root, { navigationUI: 'hide' });
    }
  } catch (err) {
    console.warn('[tela cheia]', err);
  }
}

/**
 * Liga um botão: mostra só onde funciona e troca o ícone (abrir / fechar a
 * tela cheia) e o nome ("Tela cheia" / "Sair da tela cheia"), que fica para
 * os leitores de tela e na dica do mouse. Na tela inicial o botão é só o
 * ícone, como os botões dos jogos (desde a versão 2.2.1).
 */
export function setupFullscreenButton(button) {
  if (!button || !fullscreenSupported()) return;
  const label = button.querySelector('[data-fullscreen-label]');
  const use = button.querySelector('use');
  const render = () => {
    const on = isFullscreen();
    const name = on ? 'Sair da tela cheia' : 'Tela cheia';
    if (label) label.textContent = name.toUpperCase();
    button.setAttribute('aria-label', name);
    button.title = name;
    use?.setAttribute('href', on ? '#i-tela-normal' : '#i-tela-cheia');
  };
  button.hidden = false;
  button.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', render);
  document.addEventListener('webkitfullscreenchange', render);
  render();
}
