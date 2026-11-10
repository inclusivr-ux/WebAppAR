/**
 * MOVIMENTO LISO: um grupo 3D que SEGUE uma pose (posição, rotação, escala).
 *
 * O rastreio do MindAR atualiza a pose da página de 10 a 20 vezes por
 * segundo, e a tela é desenhada 60 vezes. Preso direto à página, o animal
 * andava "aos saltinhos" e, quando a página sumia, congelava e depois pulava.
 * Aqui o grupo vai até a pose desejada a cada quadro de desenho:
 *
 *   update(dt, alvo)   segue o alvo com amortecimento (exponencial na
 *                      posição e na escala, slerp na rotação);
 *   glide(ms)          a próxima mudança de alvo vira uma viagem suave (com
 *                      aceleração e freada), de onde o grupo está até o alvo
 *                      — mesmo que o alvo continue se mexendo no caminho;
 *   snap(alvo)         aparece já no lugar (sem viagem).
 *
 * O alvo é a página do livro (a âncora do MindAR) ou o PALCO DE BRINCAR,
 * uma página invisível na frente da câmera (stagePose, abaixo).
 *
 * Só matemática do Three.js (sem DOM): testado em tests/unit/poseFollower.test.mjs.
 */
import { MathUtils, Quaternion, Vector3 } from '../../vendor/three/three.module.min.js';

const X_AXIS = new Vector3(1, 0, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const _qa = new Quaternion();
const _qb = new Quaternion();
const _scale = new Vector3();

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Uma pose: { p: Vector3, q: Quaternion, s: número (escala uniforme) }. */
export function makePose() {
  return { p: new Vector3(), q: new Quaternion(), s: 1 };
}

export function copyPose(out, from) {
  out.p.copy(from.p);
  out.q.copy(from.q);
  out.s = from.s;
  return out;
}

/** Pose de uma matriz (a âncora do MindAR: escala uniforme = largura da página). */
export function poseFromMatrix(matrix, out = makePose()) {
  matrix.decompose(out.p, out.q, _scale);
  out.s = (Math.abs(_scale.x) + Math.abs(_scale.y) + Math.abs(_scale.z)) / 3;
  return out;
}

export class PoseFollower {
  /**
   * @param {THREE.Object3D} group  o que se move (os animais ficam dentro dele)
   * @param {object} [opts]
   * @param {number} [opts.smoothMs]  amortecimento ao seguir (constante de tempo)
   */
  constructor(group, { smoothMs = 70 } = {}) {
    this.group = group;
    this.smoothMs = smoothMs;
    this.ready = false;
    this.travel = null; // { from: pose, t, duration }
    this.current = makePose();
  }

  /** Aparece já na pose (sem viagem nem amortecimento). */
  snap(target) {
    copyPose(this.current, target);
    this.travel = null;
    this.ready = true;
    this._apply();
  }

  /** A próxima mudança de alvo será uma viagem de `ms` (com aceleração e freada). */
  glide(ms) {
    if (!this.ready) return;
    this.travel = { from: copyPose(makePose(), this.current), t: 0, duration: Math.max(0.05, ms / 1000) };
  }

  get gliding() {
    return !!this.travel;
  }

  /** A cada quadro de desenho: vai até o alvo. */
  update(dt, target) {
    if (!this.ready) {
      this.snap(target);
      return;
    }
    const c = this.current;
    if (this.travel) {
      const tr = this.travel;
      tr.t += dt;
      const k = easeInOut(Math.min(1, tr.t / tr.duration));
      c.p.lerpVectors(tr.from.p, target.p, k);
      c.q.slerpQuaternions(tr.from.q, target.q, k);
      c.s = MathUtils.lerp(tr.from.s, target.s, k);
      if (tr.t >= tr.duration) this.travel = null;
    } else {
      const a = this.smoothMs > 0 ? 1 - Math.exp(-(dt * 1000) / this.smoothMs) : 1;
      c.p.lerp(target.p, a);
      c.q.slerp(target.q, a);
      c.s += (target.s - c.s) * a;
    }
    this._apply();
  }

  _apply() {
    const g = this.group;
    g.position.copy(this.current.p);
    g.quaternion.copy(this.current.q);
    g.scale.setScalar(this.current.s);
  }
}

/**
 * O PALCO DE BRINCAR, nas coordenadas da câmera do MindAR (a câmera fica na
 * origem e olha para −Z; +Y é o alto da tela). É uma "página" deitada como
 * um chão visto um pouco de cima: o animal fica em pé, de frente, inteiro.
 *
 * @param {{fov: number, aspect: number}} camera  fov vertical em graus
 * @param {object} stage    STAGE (config.js)
 * @param {object} [view]   gestos { yaw, pitch, zoom, panX, panY } (gestures.js)
 * @param {object} [out]
 * @returns {{p, q, s}}  s = largura da página do palco (unidades da cena)
 */
export function stagePose(camera, stage, view = {}, out = makePose()) {
  const distance = 1000; // qualquer distância serve: a perspectiva só depende das proporções
  const viewH = 2 * distance * Math.tan(MathUtils.degToRad(camera.fov) / 2);
  const viewW = viewH * (camera.aspect || 1);
  const width = Math.min(viewW * stage.widthFrac, viewH * stage.maxHeightFrac);
  out.s = width * (view.zoom ?? 1);
  out.p.set((view.panX || 0) * viewH, (stage.centerY + (view.panY || 0)) * viewH, -distance);
  // inclina o chão (elevação, mais o "pitch" do dedo) e gira a página no próprio plano (yaw)
  const elevation = MathUtils.clamp(MathUtils.degToRad(stage.elevation) + (view.pitch || 0), MathUtils.degToRad(4), MathUtils.degToRad(80));
  _qa.setFromAxisAngle(X_AXIS, elevation - Math.PI / 2);
  _qb.setFromAxisAngle(Z_AXIS, view.yaw || 0);
  out.q.copy(_qa).multiply(_qb);
  return out;
}

/**
 * Área do passeio no palco (coordenadas da página do palco), para o animal
 * não sair da tela: metade da largura visível menos o tamanho dele.
 *
 * @param {object} stage   STAGE (config.js)
 * @param {number} radius  meia largura do animal (fração da largura da página)
 * @param {{aspect: number}} [camera]
 */
export function stageWalkBounds(stage, radius, camera = { aspect: 0.5625 }) {
  // quanto da largura da página cabe na tela (em paisagem a página fica menor que a tela)
  const pageInScreen = Math.min(stage.widthFrac, stage.maxHeightFrac / (camera.aspect || 1));
  const halfVisible = 0.5 / pageInScreen; // meia tela, em larguras da página
  const hx = Math.max(0.04, halfVisible * stage.walk.screen - radius);
  const hy = Math.max(0.04, stage.walk.depth);
  return { minX: -hx, maxX: hx, minY: -hy, maxY: hy * 0.8 };
}
