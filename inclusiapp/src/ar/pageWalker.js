/**
 * Passeio dentro da página (sem DOM e sem Three.js — testado em Node).
 *
 * Coordenadas da página (as mesmas das âncoras do MindAR): x de −0,5 a +0,5,
 * y de −altura/2 a +altura/2 (na medida da largura), +y para cima.
 * O animal escolhe um ponto, vira para ele, anda, descansa um pouco e
 * escolhe outro — sempre dentro da página: ele nunca sai dela.
 *
 * Direção (heading): 0 = olhando para a borda de baixo da página (para quem
 * lê); positivo gira no sentido anti-horário visto de cima.
 */

/** Retângulo onde o animal pode andar (a página menos a margem e o tamanho dele). */
export function pageBounds(aspect, { margin = 0.07, radius = 0 } = {}) {
  const hx = Math.max(0.02, 0.5 - margin - radius);
  const hy = Math.max(0.02, aspect / 2 - margin - radius);
  return { minX: -hx, maxX: hx, minY: -hy, maxY: hy };
}

/**
 * Os limites de x na altura y. A área é um retângulo (a página do livro) ou um
 * trapézio (o chão do zoológico, desde a versão 2.2.1): com `farMinX`/`farMaxX`,
 * minX/maxX valem na borda da frente (minY) e farMinX/farMaxX na do fundo
 * (maxY), porque a perspectiva deixa o fundo mais largo na tela.
 */
export function xRangeAt(b, y) {
  if (b.farMinX == null && b.farMaxX == null) return [b.minX, b.maxX];
  const k = b.maxY > b.minY ? Math.min(1, Math.max(0, (y - b.minY) / (b.maxY - b.minY))) : 0;
  return [b.minX + ((b.farMinX ?? b.minX) - b.minX) * k, b.maxX + ((b.farMaxX ?? b.maxX) - b.maxX) * k];
}

export function clampToBounds([x, y], b) {
  const cy = Math.min(b.maxY, Math.max(b.minY, y));
  const [x0, x1] = xRangeAt(b, cy);
  return [Math.min(x1, Math.max(x0, x)), cy];
}

export function inBounds([x, y], b, eps = 1e-9) {
  if (y < b.minY - eps || y > b.maxY + eps) return false;
  const [x0, x1] = xRangeAt(b, y);
  return x >= x0 - eps && x <= x1 + eps;
}

/** Um ponto ao acaso dentro da área (retângulo ou trapézio). */
export function randomPoint(b, random = Math.random) {
  if (b.farMinX == null && b.farMaxX == null) {
    return [b.minX + random() * (b.maxX - b.minX), b.minY + random() * (b.maxY - b.minY)];
  }
  const y = b.minY + random() * (b.maxY - b.minY);
  const [x0, x1] = xRangeAt(b, y);
  return [x0 + random() * (x1 - x0), y];
}

/** Direção para olhar de `from` para `to`. */
export function headingTo([x0, y0], [x1, y1]) {
  return Math.atan2(x1 - x0, -(y1 - y0));
}

/** Diferença de ângulos em (−π, π]. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Gira `current` em direção a `target`, no máximo `maxStep` radianos. */
export function turnToward(current, target, maxStep) {
  const d = angleDelta(current, target);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

/** Perto da borda (para o animal "espiar" a beirada e voltar). */
export function nearEdge([x, y], b, tolerance = 0.03) {
  const [x0, x1] = xRangeAt(b, y);
  return x - x0 < tolerance || x1 - x < tolerance || y - b.minY < tolerance || b.maxY - y < tolerance;
}

/** Um ponto ao acaso dentro da área, longe o bastante de `from`. */
export function randomTarget(b, random = Math.random, from = null, minDist = 0.12) {
  let best = null;
  for (let i = 0; i < 8; i++) {
    const p = randomPoint(b, random);
    const d = from ? Math.hypot(p[0] - from[0], p[1] - from[1]) : Infinity;
    if (d >= minDist) return p;
    if (!best || d > best.d) best = { p, d };
  }
  return best.p;
}

/**
 * O passeio: alterna "andando" e "descansando".
 *   update(dt) → { pos, heading, moving, arrived, edge }
 *   arrived = chegou agora a um ponto; edge = esse ponto fica na beirada
 */
export class Wanderer {
  /**
   * @param {object} opts
   * @param {(from: number[]) => number[]} [opts.pickTarget]  quem escolhe o próximo ponto do
   *        passeio (o zoológico procura um lugar vazio); sem ele, um ponto ao acaso
   */
  constructor({
    bounds, start = [0, 0], heading = 0, speed = 0.09, turnSpeed = 3.2,
    rest = [1.6, 4.2], random = Math.random, pickTarget = null,
  }) {
    this.bounds = bounds;
    this.pos = clampToBounds(start, bounds);
    this.heading = heading;
    this.speed = speed;
    this.turnSpeed = turnSpeed;
    this.restRange = rest;
    this.random = random;
    this.pickTarget = pickTarget;
    this.target = null;
    this.restLeft = this._restTime() * 0.5;
    this.paused = false;
  }

  /** O próximo ponto do passeio. */
  nextTarget() {
    return this.pickTarget
      ? clampToBounds(this.pickTarget(this.pos), this.bounds)
      : randomTarget(this.bounds, this.random, this.pos);
  }

  _restTime() {
    const [a, b] = this.restRange;
    return a + this.random() * (b - a);
  }

  /** Para de andar por um tempo (ex.: carinho); depois volta a passear. */
  hold(seconds = 0) {
    this.target = null;
    this.restLeft = Math.max(this.restLeft, seconds);
  }

  /** Vai até um ponto escolhido (ex.: chamar o animal); o ponto fica dentro da página. */
  goTo(point) {
    this.target = clampToBounds(point, this.bounds);
    this.restLeft = 0;
  }

  /**
   * Troca a área do passeio (a página do livro ↔ o palco de brincar). Se o
   * animal ficou fora da área nova, ele volta andando (sem pulo).
   */
  setBounds(bounds) {
    this.bounds = bounds;
    if (!inBounds(this.pos, bounds)) {
      this.target = clampToBounds(this.pos, bounds);
      this.restLeft = 0;
    } else if (this.target && !inBounds(this.target, bounds)) {
      this.target = clampToBounds(this.target, bounds);
    }
  }

  update(dt) {
    const out = { pos: this.pos, heading: this.heading, moving: false, arrived: false, edge: false };
    if (this.paused) return out;
    if (!this.target) {
      this.restLeft -= dt;
      if (this.restLeft > 0) return out;
      this.target = this.nextTarget();
    }
    const want = headingTo(this.pos, this.target);
    this.heading = turnToward(this.heading, want, this.turnSpeed * dt);
    out.heading = this.heading;
    // só anda quando já está quase de frente para o ponto (vira primeiro)
    if (Math.abs(angleDelta(this.heading, want)) > 0.6) return out;
    const dx = this.target[0] - this.pos[0];
    const dy = this.target[1] - this.pos[1];
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (dist <= step) {
      this.pos = clampToBounds(this.target, this.bounds);
      out.arrived = true;
      out.edge = nearEdge(this.pos, this.bounds);
      this.target = null;
      this.restLeft = this._restTime();
    } else {
      const next = [this.pos[0] + (dx / dist) * step, this.pos[1] + (dy / dist) * step];
      // fora da área (ela acabou de mudar): anda de volta sem ser "puxado" para dentro
      this.pos = inBounds(this.pos, this.bounds) ? clampToBounds(next, this.bounds) : next;
      out.moving = true;
    }
    out.pos = this.pos;
    return out;
  }
}
