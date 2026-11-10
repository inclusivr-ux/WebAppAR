/**
 * Medidor para a equipe testar no celular: abra o app com `?debug=1` no
 * endereço (ex.: …/inclusiapp/?debug=1#/livro).
 *
 *   desenho   quadros desenhados por segundo (o ideal é perto de 60)
 *   rastreio  vezes por segundo que o MindAR analisou a câmera
 *   alvos     quantas imagens ele procura (páginas ou cartas)
 *
 * Se o "desenho" cai, o aparelho está pesado (modelos, tela); se só o
 * "rastreio" cai, o reconhecimento da página é o gargalo.
 */
export function debugEnabled() {
  try {
    const search = new URLSearchParams(window.location.search);
    return search.has('debug') && search.get('debug') !== '0';
  } catch {
    return false;
  }
}

export class DebugHud {
  /**
   * @param {HTMLElement} parent
   * @param {ARSession} session
   * @param {() => string} [extra]  texto a mais (ex.: "palco" ou "página")
   */
  constructor(parent, session, extra = null) {
    this.session = session;
    this.extra = extra;
    this.el = document.createElement('div');
    this.el.className = 'debug-hud';
    this.el.setAttribute('aria-hidden', 'true');
    parent.appendChild(this.el);
    this.last = { t: performance.now(), renders: session.stats.renders, tracks: session.stats.tracks };
    this.timer = setInterval(() => this._tick(), 500);
    this._tick();
  }

  _tick() {
    const s = this.session.stats;
    const now = performance.now();
    const dt = Math.max(0.001, (now - this.last.t) / 1000);
    const fps = (s.renders - this.last.renders) / dt;
    const tps = (s.tracks - this.last.tracks) / dt;
    this.last = { t: now, renders: s.renders, tracks: s.tracks };
    const extra = this.extra ? ` · ${this.extra()}` : '';
    this.el.textContent = `desenho ${fps.toFixed(0)}/s · rastreio ${tps.toFixed(0)}/s · alvos ${this.session.searching}/${this.session.targetCount}${extra}`;
  }

  dispose() {
    clearInterval(this.timer);
    this.el.remove();
  }
}
