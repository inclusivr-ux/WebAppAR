/**
 * Um animal vivendo numa página do livro (ou no palco de brincar).
 *
 *   entrar   salta do desenho da página, fica feliz e começa a passear
 *   passear  anda dentro da página, descansa, espia a beirada e volta
 *   tocar    para, vira para quem tocou e fica feliz (carinho); a cada
 *            3 toques faz a animação especial (o jato d'água, a crista...)
 *   palco    a página saiu da câmera: o animal continua brincando no palco
 *            de brincar (o grupo dele viaja até lá: poseFollower.js); aqui
 *            só muda a área do passeio, para ele não sair da tela
 *   sair     dá tchau, um pulinho e some (outra página apareceu)
 *
 * Desde a versão 2.2 o animal não pisca, não fica transparente e não "pede
 * para voltar": a página é só o validador (pedido da equipe, 10/11/2026).
 *
 * Funciona com AnimalModel (modelManager.js) e com as letras do zoológico
 * (zoo/letterModel.js), que têm a mesma interface.
 */
import * as THREE from '../lib/three.js';
import { Wanderer, pageBounds, clampToBounds, headingTo, turnToward, angleDelta } from './pageWalker.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const STAND = new THREE.Quaternion().setFromAxisAngle(X_AXIS, Math.PI / 2);
const _q = new THREE.Quaternion();
const _lean = new THREE.Quaternion();
const _tilt = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();

const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

export class PageActor {
  /**
   * @param {object} opts
   * @param {AnimalModel} opts.model
   * @param {THREE.Object3D} opts.parent    o grupo da página (segue a página ou o palco)
   * @param {number} opts.aspect            altura ÷ largura da página
   * @param {object} opts.place             { home: [x, y], size, lift } (config.js)
   * @param {number} [opts.margin]
   * @param {boolean} [opts.faceCamera]     sempre de frente para quem segura o celular (as letras)
   * @param {number[]} [opts.lean]          [a partir de, no máximo] (graus): visto de cima, inclina
   *                                        para quem olha (as letras, como uma placa, inclinam mais)
   */
  constructor({ model, parent, aspect, place, margin = 0.07, speed, faceCamera = false, lean = [40, 38] }) {
    this.model = model;
    this.parent = parent;
    this.place = place;
    this.faceCamera = faceCamera;
    this.leanStart = THREE.MathUtils.degToRad(lean[0]);
    this.leanMax = THREE.MathUtils.degToRad(lean[1]);
    this.size = place.size;
    this.lift = place.lift || 0;

    this.container = new THREE.Group();
    this.container.name = `${model.root.name}-na-pagina`;
    this.container.add(model.root);
    this.container.scale.setScalar(this.size);

    // alvo de toque invisível, maior que o animal (dedos pequenos)
    const [sx, sy, sz] = model.size;
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sx, 0.35) * 1.5, sy * 1.35, Math.max(sz, 0.35) * 1.5),
      new THREE.MeshBasicMaterial());
    this.hit.visible = false;
    this.hit.position.y = sy * 0.55;
    this.hit.userData.actor = this;
    model.body.add(this.hit);

    /** meia largura do animal, em larguras da página (para não sair da tela no palco) */
    this.radius = (Math.max(sx, sz) * this.size) / 2;
    this.pageBounds = pageBounds(aspect, { margin, radius: this.radius * 0.6 });
    this.wander = new Wanderer({
      bounds: this.pageBounds,
      start: place.home,
      speed: speed ?? (model.flies ? 0.1 : 0.08),
      rest: [1.4, 3.8],
    });
    this.heading = 0;
    this.taps = 0;
    this.state = 'idle';
    this.onStage = false;
    parent.add(this.container);
    this.container.visible = false;
  }

  get visible() {
    return this.container.visible && this.state !== 'gone';
  }

  /* ------------------------------------------------------------ ciclo */
  /**
   * Salta do desenho da página (ou, se a página já saiu da câmera, direto no
   * palco). Se já estiver na cena, não faz nada.
   * @param {object} [opts]
   * @param {number[]} [opts.at]           onde aparece (coordenadas da página); padrão: onde está desenhado
   * @param {object} [opts.stageBounds]    aparece já no palco, com esta área de passeio
   */
  found({ at = null, stageBounds = null } = {}) {
    if (this.state === 'leaving' || this.state === 'living' || this.state === 'entering') return;
    this.onStage = !!stageBounds;
    this.wander.bounds = stageBounds || this.pageBounds;
    this.wander.pos = clampToBounds(at || this.place.home, this.wander.bounds);
    this.wander.target = null;
    this.wander.hold(0.3);
    this.heading = 0;
    this.enterT = 0;
    this.state = 'entering';
    this.model.setOpacity(1);
    this.model.setLocomotion('idle', 0);
    this.container.visible = true;
  }

  /**
   * No palco de brincar (true) ou de volta à página (false). Muda só a área
   * do passeio: quem está fora dela volta andando.
   */
  setStage(on, stageBounds = null) {
    this.onStage = on;
    this.wander.setBounds(on && stageBounds ? stageBounds : this.pageBounds);
  }

  /** Vai para casa (sai da página): dá tchau, dá um pulinho e some. */
  leave() {
    if (this.state === 'gone' || this.state === 'leaving' || this.state === 'idle') {
      this.hide();
      return Promise.resolve();
    }
    this.state = 'leaving';
    this.leaveT = 0;
    this.model.setLocomotion('idle');
    this.model.playOnce('happy');
    return new Promise((resolve) => { this._onLeft = resolve; });
  }

  /** Some de vez, sem animação. */
  hide() {
    this.container.visible = false;
    this.state = 'gone';
    this._onLeft?.();
    this._onLeft = null;
  }

  _finishEntering() {
    this.container.scale.setScalar(this.size);
    this.model.body.position.y = 0;
  }

  /* ------------------------------------------------------------ toque */
  /** Carinho: para, olha para quem tocou e fica feliz. Devolve o papel tocado, ou null. */
  tap() {
    if (this.state !== 'living') return null;
    this.taps += 1;
    const cam = this.cameraInPage();
    this.faceTarget = headingTo(this.wander.pos, [cam.x, cam.y]);
    this.model.setLocomotion('idle');
    const special = this.taps % 3 === 0 && this.model.has('special');
    const role = special ? 'special' : 'happy';
    this.wander.hold(special ? 6 : 2.6);
    this.wander.paused = true;
    this.model.playOnce(role).then(() => {
      this.wander.paused = false;
      this.faceTarget = null;
    });
    return role;
  }

  /* ------------------------------------------------------------ quadro a quadro */
  update(dt) {
    const m = this.model;
    if (this.state === 'gone' || !this.container.visible) return;

    if (this.state === 'entering') {
      this.enterT += dt;
      const k = Math.min(1, this.enterT / 0.75);
      // salta do desenho: cresce e faz um arco para fora do papel
      this.container.scale.setScalar(this.size * Math.max(0.02, easeOutBack(k)));
      m.body.position.y = Math.sin(Math.PI * k) * 0.55;
      if (k >= 1) {
        this._finishEntering();
        this.state = 'living';
        m.playOnce('happy');
      }
    } else if (this.state === 'living') {
      const step = m.busy || this.wander.paused ? null : this.wander.update(dt);
      if (step) {
        m.setLocomotion(step.moving ? 'walk' : 'idle');
        this.heading = step.heading;
        if (step.arrived && step.edge && !this.onStage) {
          // espia a beirada da página e volta: ele não sai dela
          this.wander.goTo([this.wander.pos[0] * 0.4, this.wander.pos[1] * 0.4]);
        }
      } else if (this.faceTarget != null) {
        this.heading = turnToward(this.heading, this.faceTarget, 4 * dt);
      }
      if (this.faceCamera) {
        // a letra anda e pula, mas fica sempre virada para quem lê (direção própria,
        // separada da direção do passeio)
        const cam = this.cameraInPage();
        const [x, y] = this.wander.pos;
        // com a câmera bem em cima, a direção fica indefinida: de frente para quem lê (borda de baixo)
        const target = Math.hypot(cam.x - x, cam.y - y) < 0.25 ? 0 : headingTo(this.wander.pos, [cam.x, cam.y]);
        this.faceHeading = turnToward(this.faceHeading ?? target, target, 6 * dt);
      }
    } else if (this.state === 'leaving') {
      this.leaveT += dt;
      // tchau (0,9 s) e depois encolhe com um pulinho
      const k = Math.min(1, Math.max(0, (this.leaveT - 0.9) / 0.5));
      this.container.scale.setScalar(this.size * Math.max(0.001, 1 - k * k * (3 - 2 * k)));
      m.body.position.y = Math.sin(k * Math.PI) * 0.4;
      if (k >= 1) {
        m.body.position.y = 0;
        this.hide();
        return;
      }
    }

    const [x, y] = this.wander.pos;
    let z = 0;
    if (this.lift) z = this.lift * (this.state === 'entering' ? Math.min(1, this.enterT / 0.75) : 1);
    this.container.position.set(x, y, z);
    this._updateLean(dt);
    if (this.faceCamera && this.faceHeading != null) {
      // placa: virada para a câmera e reclinada para trás (a face sobe para quem olha de cima)
      _q.setFromAxisAngle(Y_AXIS, this.faceHeading);
      _tilt.setFromAxisAngle(X_AXIS, -(this.leanAngle || 0));
      this.container.quaternion.copy(STAND).multiply(_q).multiply(_tilt);
    } else {
      _q.setFromAxisAngle(Y_AXIS, this.heading);
      this.container.quaternion.copy(_lean).multiply(STAND).multiply(_q);
    }
    m.update(dt);
  }

  /**
   * Com o celular quase paralelo à página (visto de cima), o animal se inclina
   * um pouco na direção de quem segura o celular, para mostrar o rosto em vez
   * das costas. Em ângulos normais de leitura (e no palco) ele fica em pé.
   * Usa a pose JÁ SUAVIZADA da página (o grupo que segue): o tremor do
   * rastreio não vira tremor do animal.
   */
  _updateLean(dt) {
    const cam = this.cameraInPage();
    const horizontal = Math.hypot(cam.x - this.wander.pos[0], cam.y - this.wander.pos[1]);
    const elevation = Math.atan2(cam.z, horizontal); // 90° = bem de cima
    const target = THREE.MathUtils.clamp((elevation - this.leanStart) * 0.8, 0, this.leanMax);
    this.leanAngle = THREE.MathUtils.damp(this.leanAngle || 0, target, 4, dt);
    // inclina para a borda de baixo da página (o lado de quem lê e segura o celular)
    _lean.setFromAxisAngle(X_AXIS, this.leanAngle);
  }

  /** Posição na tela (px) do alto da cabeça (balões do zoológico, brilhos). */
  screenPoint(camera, viewport, out = { x: 0, y: 0, visible: false }) {
    const m = this.model;
    _v.set(0, m.size[1] * 1.08, 0);
    m.body.localToWorld(_v);
    _v.project(camera);
    out.visible = _v.z < 1 && this.container.visible;
    out.x = ((_v.x + 1) / 2) * viewport.width;
    out.y = ((1 - _v.y) / 2) * viewport.height;
    return out;
  }

  /** Onde está a câmera, nas coordenadas da página (para virar para quem tocou). */
  cameraInPage() {
    this.parent.updateMatrixWorld();
    _m.copy(this.parent.matrixWorld).invert();
    return new THREE.Vector3(0, 0, 0).applyMatrix4(_m);
  }

  dispose() {
    this._onLeft?.();
    this._onLeft = null;
    this.hit.removeFromParent();
    this.hit.geometry.dispose();
    this.hit.material.dispose();
    this.container.removeFromParent();
  }
}

export { angleDelta };
