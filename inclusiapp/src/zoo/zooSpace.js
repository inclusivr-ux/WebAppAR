/**
 * O ESPAÇO DO ZOOLÓGICO (sem DOM — testado em Node: tests/unit/zooSpace.test.mjs).
 *
 * Pedido da equipe (11/11/2026), no teste da 2.2: "todos estão muito
 * amontoados [...] Seria melhor que eles andassem para ocupar mais os espaços
 * da tela do celular". Três peças:
 *
 *   zooFloor   o chão do zoológico ocupa a tela entre a barra de cima e a
 *              fileira de retratos de baixo. Ele é um trapézio: a perspectiva
 *              deixa o fundo mais largo na tela.
 *   freeSpot   um lugar vazio: longe dos outros e de para onde eles estão indo.
 *   keepApart  espaço pessoal: quem fica perto demais desliza para o lado
 *              (sem pulo), e ninguém entra no outro.
 *
 * O espaço pessoal é um pouco maior na profundidade (`depth`, ZOO.depthSpace):
 * visto de cima, um bicho alto na frente tapa quem está logo atrás.
 *
 * Coordenadas: as da página do palco (as mesmas de ar/pageWalker.js), em
 * larguras da página; +y vai para o fundo (para cima na tela).
 */
import { Group, PerspectiveCamera, Vector3 } from '../../vendor/three/three.module.min.js';
import { makePose, stagePose } from '../ar/poseFollower.js';
import { clampToBounds, randomPoint } from '../ar/pageWalker.js';

/**
 * Onde um ponto do palco aparece na tela, com a câmera e o palco do app (o
 * mesmo stagePose, sem os gestos). Devolve (x, y, altura) → frações da tela
 * (0 = esquerda/topo).
 * @param {{fov: number, aspect: number}} camera
 * @param {object} stage  ZOO.stage
 */
export function stageProjector(camera, stage) {
  const cam = new PerspectiveCamera(camera.fov, camera.aspect || 1, 1, 1e6);
  cam.updateMatrixWorld();
  const pose = stagePose(cam, stage, {}, makePose());
  const group = new Group();
  group.position.copy(pose.p);
  group.quaternion.copy(pose.q);
  group.scale.setScalar(pose.s);
  group.updateMatrixWorld();
  const v = new Vector3();
  return (x, y, h = 0) => {
    v.set(x, y, h).applyMatrix4(group.matrixWorld).project(cam);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  };
}

/** Busca binária: o maior valor em [lo, hi] em que `ok` ainda vale. */
function largest(lo, hi, ok) {
  if (!ok(lo)) return lo;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * O chão do zoológico: a maior área do palco que cabe na parte livre da tela.
 *   - no fundo, a cabeça do maior bicho fica abaixo da barra de cima;
 *   - na frente, os pés ficam acima da fileira de retratos;
 *   - dos lados, o corpo inteiro fica dentro da tela (na frente e no fundo).
 *
 * @param {{fov: number, aspect: number}} camera  a câmera do app (MindAR)
 * @param {object} stage   ZOO.stage
 * @param {{top: number, bottom: number, left: number, right: number}} safe
 *        a parte livre da tela, em frações (0 = topo/esquerda)
 * @param {{radius?: number, height?: number, depth?: number}} [body]
 *        o maior bicho (meia largura e altura, em larguras da página) e o
 *        quanto o chão pode ir para frente/fundo, no máximo
 * @returns {{minX, maxX, minY, maxY, farMinX, farMaxX}}  um trapézio (pageWalker.js)
 */
export function zooFloor(camera, stage, safe, { radius = 0.1, height = 0.2, depth = 1.6 } = {}) {
  const screen = stageProjector(camera, stage);
  const maxY = largest(0, depth, (y) => screen(0, y, height).y >= safe.top);
  const minY = -largest(0, depth, (y) => screen(0, -y, 0).y <= safe.bottom);
  // dos lados: os pés e a cabeça (que fica mais perto da câmera e "abre" um pouco na tela)
  const inside = (x, y, h) => screen(x + radius, y, h).x <= safe.right && screen(-x - radius, y, h).x >= safe.left;
  const half = (y) => largest(0, 4, (x) => inside(x, y, 0) && inside(x, y, height));
  const near = Math.max(0.04, half(minY));
  const far = Math.max(near, half(maxY));
  return { minX: -near, maxX: near, minY, maxY, farMinX: -far, farMaxX: far };
}

/** Distância com a profundidade (y) contando menos: precisa de mais espaço atrás. */
export function spaceBetween(dx, dy, depth = 1) {
  return Math.hypot(dx, dy / depth);
}

/**
 * Um lugar vazio no chão: entre pontos sorteados, o que fica mais longe dos
 * outros (de onde eles estão e de para onde estão indo), sem andar demais.
 *
 * @param {object} bounds  o chão (retângulo ou trapézio)
 * @param {{x: number, y: number, r?: number}[]} others  os outros (e os destinos deles)
 * @param {() => number} random
 * @param {object} [opts]
 * @param {number[]} [opts.from]     de onde sai (prefere não atravessar o zoológico inteiro)
 * @param {number} [opts.r]          o raio de quem vai
 * @param {number[]} [opts.hint]     um lado preferido (onde a carta apareceu)
 * @param {number} [opts.depth]      quanto a profundidade pede de espaço a mais
 * @param {number} [opts.tries]
 */
export function freeSpot(bounds, others, random, { from = null, r = 0, hint = null, depth = 1, tries = 24 } = {}) {
  let best = null;
  for (let i = 0; i < tries; i++) {
    const p = randomPoint(bounds, random);
    // a folga até o vizinho mais perto (descontando os tamanhos)
    let room = Infinity;
    for (const o of others) room = Math.min(room, spaceBetween(o.x - p[0], o.y - p[1], depth) - (o.r || 0) - r);
    if (room === Infinity) room = 1;
    // quanto mais espaço, melhor (até bem longe: num chão largo, todos se espalham)
    let score = Math.min(room, 0.8);
    // um pouco de preferência por perto (para não atravessar o zoológico toda hora)
    if (from) score -= 0.025 * Math.hypot(p[0] - from[0], p[1] - from[1]);
    if (hint) score -= 0.02 * Math.abs(hint[0] - p[0]);
    if (!best || score > best.score) best = { p, score };
  }
  return clampToBounds(best.p, bounds);
}

/**
 * Espaço pessoal: quem ficou mais perto que a soma dos raios (mais a folga)
 * desliza para o lado, devagar (no máximo `speed` larguras da página por
 * segundo), e fica dentro do chão. Muda `pos` de cada corpo.
 *
 * @param {{pos: number[], r: number, fixed?: boolean}[]} bodies
 * @param {number} dt  segundos
 * @param {{gap?: number, speed?: number, depth?: number, bounds?: object}} [opts]
 * @returns {number}  quantos pares estavam perto demais
 */
export function keepApart(bodies, dt, { gap = 0.025, speed = 0.6, depth = 1, bounds = null } = {}) {
  let crowded = 0;
  const maxStep = speed * dt;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      if (a.fixed && b.fixed) continue;
      // a conta é feita com a profundidade "encolhida" (precisa de mais espaço atrás)
      const dx = b.pos[0] - a.pos[0];
      const dy = (b.pos[1] - a.pos[1]) / depth;
      const d = Math.hypot(dx, dy);
      const want = a.r + b.r + gap;
      if (d >= want) continue;
      crowded += 1;
      // a direção do empurrão; no mesmo lugar, de lado (sempre o mesmo lado para o mesmo par)
      let ux = dx / d;
      let uy = dy / d;
      if (d < 1e-6) {
        const side = (i + j) % 2 ? 1 : -1;
        ux = side * 0.958;
        uy = 0.287;
      }
      // de volta ao chão de verdade: y anda `depth` vezes mais (o passo conta na conta
      // "encolhida"; o deslocamento de verdade fica no limite de velocidade)
      uy *= depth;
      const real = Math.hypot(ux, uy);
      const step = Math.min(want - d, maxStep / real);
      const shareA = a.fixed ? 0 : b.fixed ? 1 : 0.5;
      const shareB = 1 - shareA;
      a.pos[0] -= ux * step * shareA;
      a.pos[1] -= uy * step * shareA;
      b.pos[0] += ux * step * shareB;
      b.pos[1] += uy * step * shareB;
    }
  }
  if (bounds) {
    for (const body of bodies) {
      const [x, y] = clampToBounds(body.pos, bounds);
      body.pos[0] = x;
      body.pos[1] = y;
    }
  }
  return crowded;
}

/** O ponto `p` cai no espaço de alguém (menos `self`)? */
export function occupied(p, bodies, r = 0, self = null, gap = 0.025, depth = 1) {
  return bodies.some((b) => b !== self && spaceBetween(b.pos[0] - p[0], b.pos[1] - p[1], depth) < b.r + r + gap);
}
