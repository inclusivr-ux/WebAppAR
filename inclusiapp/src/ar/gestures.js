/**
 * Gestos no palco de brincar (Pointer Events: toque, mouse e caneta).
 * Vieram do "Modo Interação" da primeira versão do app (JLeo), com dois
 * ajustes: o toque curto é o carinho, e os gestos de girar e aproximar só
 * valem no palco (na página do livro, quem mexe é o celular).
 *
 *   toque curto ............ carinho (onTap); duplo toque fora do animal volta ao início
 *   1 dedo / mouse ......... girar o animal (com inércia ao soltar)
 *   2 dedos: pinça ......... aumentar / diminuir
 *   2 dedos: torcer ........ girar em torno do chão
 *   2 dedos: arrastar ...... mover na tela
 *   roda do mouse .......... zoom    | botão direito ou Shift ... mover
 *
 * Não altera o objeto diretamente: publica as mudanças em `state`
 * (yaw, pitch, zoom, panX, panY) e quem usa aplica no objeto 3D.
 */

const ROTATE_SPEED = 0.0105; // radianos por pixel
const FRICTION = 4.5; // decaimento da inércia (1/s)
const DOUBLE_TAP_MS = 320;
const TAP_MOVE = 12; // px: mais que isso já é arrastar
const TAP_MS = 450;

export class GestureController {
  /**
   * @param {HTMLElement} element
   * @param {object} [opts]
   * @param {(e: PointerEvent) => boolean} [opts.onTap]  toque curto; devolve true se acertou alguém
   */
  constructor(element, { minZoom = 0.5, maxZoom = 2.5, onChange = null, onInteract = null, onTap = null } = {}) {
    this.element = element;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.onChange = onChange;
    this.onInteract = onInteract;
    this.onTap = onTap;
    this.pointers = new Map();
    this.state = { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 };
    this.velocity = { yaw: 0, pitch: 0 };
    this.listening = false;
    /** girar, aproximar e mover (só no palco); o toque curto vale sempre */
    this.manipulate = false;
    this.lastTap = 0;
    this.gesture = null;

    this._down = (e) => this.pointerDown(e);
    this._move = (e) => this.pointerMove(e);
    this._up = (e) => this.pointerUp(e);
    this._wheel = (e) => this.wheel(e);
    this._menu = (e) => { if (this.manipulate) e.preventDefault(); };
  }

  /** Começa a ouvir os dedos. */
  attach() {
    if (this.listening) return;
    this.listening = true;
    const el = this.element;
    el.addEventListener('pointerdown', this._down);
    el.addEventListener('pointermove', this._move);
    el.addEventListener('pointerup', this._up);
    el.addEventListener('pointercancel', this._up);
    el.addEventListener('lostpointercapture', this._up);
    el.addEventListener('wheel', this._wheel, { passive: false });
    el.addEventListener('contextmenu', this._menu);
  }

  detach() {
    if (!this.listening) return;
    this.listening = false;
    const el = this.element;
    el.removeEventListener('pointerdown', this._down);
    el.removeEventListener('pointermove', this._move);
    el.removeEventListener('pointerup', this._up);
    el.removeEventListener('pointercancel', this._up);
    el.removeEventListener('lostpointercapture', this._up);
    el.removeEventListener('wheel', this._wheel);
    el.removeEventListener('contextmenu', this._menu);
    this.pointers.clear();
    this.gesture = null;
    this.velocity.yaw = this.velocity.pitch = 0;
  }

  /** Liga ou desliga girar/aproximar/mover (o toque continua valendo). */
  setManipulate(on) {
    this.manipulate = on;
    if (!on) this.velocity.yaw = this.velocity.pitch = 0;
  }

  reset() {
    Object.assign(this.state, { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 });
    this.velocity.yaw = this.velocity.pitch = 0;
    this.onChange?.(this.state, { reset: true });
  }

  _emit(delta) {
    this.onChange?.(this.state, delta);
    this.onInteract?.();
  }

  pointerDown(e) {
    if (e.button !== undefined && e.button > 2) return;
    this.element.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, x0: e.clientX, y0: e.clientY, t0: e.timeStamp });
    this.velocity.yaw = this.velocity.pitch = 0;
    this._startGesture(e);
    if (this.manipulate) this.onInteract?.();
  }

  _startGesture(e) {
    const pts = [...this.pointers.values()];
    if (pts.length === 1) {
      const pan = e?.button === 2 || e?.shiftKey;
      this.gesture = { type: pan ? 'pan' : 'rotate', last: { ...pts[0] }, moved: 0, single: true };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      this.gesture = {
        type: 'multi',
        dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        zoom: this.state.zoom,
      };
    }
  }

  pointerMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p || !this.gesture) return;
    const prev = { ...p };
    p.x = e.clientX;
    p.y = e.clientY;
    p.t = e.timeStamp;
    const g = this.gesture;
    if (g.type === 'rotate' || g.type === 'pan') {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      g.moved += Math.abs(dx) + Math.abs(dy);
      if (!this.manipulate) return;
      const dt = Math.max(1, e.timeStamp - prev.t) / 1000;
      if (g.type === 'rotate') {
        this.state.yaw += dx * ROTATE_SPEED;
        this.state.pitch += dy * ROTATE_SPEED * 0.6;
        this.state.pitch = Math.max(-0.35, Math.min(0.9, this.state.pitch));
        // velocidade suavizada para a inércia
        this.velocity.yaw = 0.7 * this.velocity.yaw + 0.3 * ((dx * ROTATE_SPEED) / dt);
        this.velocity.pitch = 0;
        this._emit({ yaw: dx * ROTATE_SPEED, pitch: dy * ROTATE_SPEED });
      } else {
        this._pan(dx, dy);
      }
      return;
    }
    if (!this.manipulate) return;
    // dois dedos: pinça + torção + arrasto
    const [a, b] = [...this.pointers.values()];
    if (!b) return;
    const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const zoom = Math.min(this.maxZoom, Math.max(this.minZoom, g.zoom * (dist / g.dist)));
    let twist = angle - g.angle;
    if (twist > Math.PI) twist -= 2 * Math.PI;
    if (twist < -Math.PI) twist += 2 * Math.PI;
    g.angle = angle;
    this.state.zoom = zoom;
    this.state.yaw += twist;
    this._pan(mid.x - g.mid.x, mid.y - g.mid.y);
    g.mid = mid;
    this._emit({ yaw: twist, zoom });
  }

  _pan(dx, dy) {
    const h = this.element.clientHeight || 1;
    this.state.panX = Math.max(-0.6, Math.min(0.6, this.state.panX + dx / h));
    this.state.panY = Math.max(-0.6, Math.min(0.6, this.state.panY - dy / h));
    this._emit({ pan: true });
  }

  pointerUp(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const g = this.gesture;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      // toque curto (um dedo, quase sem mexer): carinho; duplo toque fora do animal volta ao início
      const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
      if (g?.single && g.moved < TAP_MOVE && moved < TAP_MOVE && e.timeStamp - p.t0 < TAP_MS) {
        this.velocity.yaw = this.velocity.pitch = 0;
        const hit = this.onTap?.(e);
        if (hit || !this.manipulate) {
          this.lastTap = 0;
        } else if (e.timeStamp - this.lastTap < DOUBLE_TAP_MS) {
          this.lastTap = 0;
          this.reset();
        } else {
          this.lastTap = e.timeStamp;
        }
      }
      this.gesture = null;
    } else {
      // de 2 para 1 dedo: recomeça como rotação sem pular (e não vale como toque)
      this._startGesture();
      if (this.gesture) this.gesture.single = false;
      this.velocity.yaw = this.velocity.pitch = 0;
    }
  }

  wheel(e) {
    if (!this.manipulate) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    this.state.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.state.zoom * factor));
    this._emit({ zoom: this.state.zoom });
  }

  /** Inércia: chamar a cada quadro. Devolve true se algo mudou. */
  update(dt) {
    if (!this.manipulate || this.pointers.size || (!this.velocity.yaw && !this.velocity.pitch)) return false;
    const decay = Math.exp(-FRICTION * dt);
    this.velocity.yaw *= decay;
    this.velocity.pitch *= decay;
    if (Math.abs(this.velocity.yaw) < 0.01 && Math.abs(this.velocity.pitch) < 0.01) {
      this.velocity.yaw = this.velocity.pitch = 0;
      return false;
    }
    const dy = this.velocity.yaw * dt;
    this.state.yaw += dy;
    this.onChange?.(this.state, { yaw: dy });
    return true;
  }
}
