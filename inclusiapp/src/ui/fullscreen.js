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

/** Liga um botão: mostra só onde funciona e troca o texto (TELA CHEIA / SAIR DA TELA CHEIA). */
export function setupFullscreenButton(button) {
  if (!button || !fullscreenSupported()) return;
  const label = button.querySelector('[data-fullscreen-label]');
  const use = button.querySelector('use');
  const render = () => {
    const on = isFullscreen();
    label.textContent = on ? 'SAIR DA TELA CHEIA' : 'TELA CHEIA';
    use?.setAttribute('href', on ? '#i-tela-normal' : '#i-tela-cheia');
    button.setAttribute('aria-pressed', String(on));
  };
  button.hidden = false;
  button.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', render);
  document.addEventListener('webkitfullscreenchange', render);
  render();
}
