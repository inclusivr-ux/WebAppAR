/**
 * Efeitos visuais leves (sem bibliotecas), no estilo do Signária:
 * faíscas mágicas = quadradinhos turquesa semitransparentes (acerto,
 * recompensa, magia) e corações de carinho. Respeitam "reduzir movimento".
 */
export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';

/**
 * Faíscas (e corações) saindo de um ponto da tela.
 * @param {HTMLElement} host  elemento posicionado (position: relative/absolute/fixed)
 */
export function sparkle(host, x, y, { count = 14, hearts = false, spread = 90 } = {}) {
  if (prefersReducedMotion()) return;
  const layer = document.createElement('div');
  layer.className = 'faiscas';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('i');
    const a = Math.random() * Math.PI * 2;
    const d = spread * (0.4 + Math.random() * 0.8);
    piece.style.setProperty('--x', `${x}px`);
    piece.style.setProperty('--y', `${y}px`);
    piece.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    piece.style.setProperty('--dy', `${Math.sin(a) * d - 40}px`);
    piece.style.setProperty('--s', `${6 + Math.random() * 8}px`);
    piece.style.setProperty('--d', `${0.8 + Math.random() * 0.6}s`);
    piece.style.setProperty('--t', `${Math.random() * 0.12}s`);
    layer.appendChild(piece);
  }
  if (hearts) {
    for (let i = 0; i < 3; i++) {
      const h = document.createElement('b');
      h.className = 'coracao';
      h.innerHTML = HEART;
      h.style.left = `${x - 14 + (i - 1) * 26}px`;
      h.style.top = `${y - 20}px`;
      h.style.animationDelay = `${i * 0.12}s`;
      layer.appendChild(h);
    }
  }
  host.appendChild(layer);
  setTimeout(() => layer.remove(), 1800);
}

/** Comemoração no meio da tela (acerto, fim de partida). */
export function celebrate(host = document.body, count = 40) {
  const r = host.getBoundingClientRect();
  sparkle(host, r.width / 2, r.height * 0.42, { count, spread: Math.min(r.width, 520) * 0.45 });
}

/** Compatibilidade com o nome antigo. */
export const confetti = celebrate;
