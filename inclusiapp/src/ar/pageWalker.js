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

export function clampToBounds([x, y], b) {
  return [Math.min(b.maxX, Math.max(b.minX, x)), Math.min(b.maxY, Math.max(b.minY, y))];
}

export function inBounds([x, y], b, eps = 1e-9) {
  return x >= b.minX - eps && x <= b.maxX + eps && y >= b.minY - eps && y <= b.maxY + eps;
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
  return x - b.minX < tolerance || b.maxX - x < tolerance || y - b.minY < tolerance || b.maxY - y < tolerance;
}

/** Um ponto ao acaso dentro do retângulo, longe o bastante de `from`. */
export function randomTarget(b, random = Math.random, from = null, minDist = 0.12) {
  let best = null;
  for (let i = 0; i < 8; i++) {
    const p = [b.minX + random() * (b.maxX - b.minX), b.minY + random() * (b.maxY - b.minY)];
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
  constructor({
    bounds, start = [0, 0], heading = 0, speed = 0.09, turnSpeed = 3.2,
    rest = [1.6, 4.2], random = Math.random,
  }) {
    this.bounds = bounds;
    this.pos = clampToBounds(start, bounds);
    this.heading = heading;
    this.speed = speed;
    this.turnSpeed = turnSpeed;
    this.restRange = rest;
    this.random = random;
    this.target = null;
    this.restLeft = this._restTime() * 0.5;
    this.paused = false;
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

  update(dt) {
    const out = { pos: this.pos, heading: this.heading, moving: false, arrived: false, edge: false };
    if (this.paused) return out;
    if (!this.target) {
      this.restLeft -= dt;
      if (this.restLeft > 0) return out;
      this.target = randomTarget(this.bounds, this.random, this.pos);
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
      this.pos = clampToBounds([this.pos[0] + (dx / dist) * step, this.pos[1] + (dy / dist) * step], this.bounds);
      out.moving = true;
    }
    out.pos = this.pos;
    return out;
  }
}
