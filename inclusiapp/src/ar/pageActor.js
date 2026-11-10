/**
 * Um animal (ou personagem) vivendo numa página do livro.
 *
 *   entrar   salta do desenho da página, fica feliz e começa a passear
 *   passear  anda dentro da página, descansa, espia a beirada e volta
 *   tocar    para, vira para quem tocou e fica feliz (carinho); a cada
 *            3 toques faz a animação especial (o jato d'água, a crista...)
 *   perder   a página sumiu da câmera: primeiro ele só espera, parado onde
 *            estava (uma falha curta do rastreamento passa sem ninguém notar);
 *            se a página não volta, ele pisca, fica transparente aos poucos,
 *            se preocupa e pede para voltar. Se a página voltar a tempo, ele
 *            se anima; senão, some.
 *
 * Funciona com AnimalModel (modelManager.js) e CharacterModel
 * (characters/characterModel.js), que têm a mesma interface.
 */
import * as THREE from '../lib/three.js';
import { Wanderer, pageBounds, headingTo, turnToward, angleDelta } from './pageWalker.js';

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
   * @param {AnimalModel|CharacterModel} opts.model
   * @param {THREE.Object3D} opts.anchor    âncora da página (ARSession.anchor)
   * @param {THREE.Scene} opts.scene        cena da sessão (para ficar no lugar quando a página some)
   * @param {number} opts.aspect            altura ÷ largura da página
   * @param {object} opts.place             { home: [x, y], size, lift } (config.js)
   * @param {number} opts.lostGrace         segundos até sumir sem a página
   * @param {number} [opts.holdGrace]       segundos esperando, sem piscar, antes de se preocupar
   * @param {number} [opts.margin]
   * @param {boolean} [opts.faceCamera]     sempre de frente para quem segura o celular (as letras)
   * @param {string} [opts.lostText]        o que ele pede quando a página some
   * @param {number[]} [opts.lean]          [a partir de, no máximo] (graus): visto de cima, inclina
   *                                        para quem olha (as letras, como uma placa, inclinam mais)
   */
  constructor({
    model, anchor, scene, aspect, place, lostGrace = 4.5, holdGrace = 1.2, margin = 0.07, speed,
    character = false, faceCamera = false, lostText = 'QUERO VOLTAR PARA MINHA PÁGINA!', lean = [40, 38],
  }) {
    this.model = model;
    this.anchor = anchor;
    this.scene = scene;
    this.place = place;
    this.lostGrace = lostGrace;
    this.holdGrace = holdGrace;
    this.faceCamera = faceCamera;
    this.lostText = lostText;
    this.leanStart = THREE.MathUtils.degToRad(lean[0]);
    this.leanMax = THREE.MathUtils.degToRad(lean[1]);
    this.character = character;
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

    const radius = (Math.max(sx, sz) * this.size) / 2;
    this.bounds = pageBounds(aspect, { margin, radius: radius * 0.6 });
    this.wander = new Wanderer({
      bounds: this.bounds,
      start: place.home,
      speed: speed ?? (character ? 0.05 : model.flies ? 0.1 : 0.08),
      rest: character ? [2.5, 5.5] : [1.4, 3.8],
    });
    this.heading = 0;
    this.taps = 0;
    this.state = 'idle';
    this.ghost = null;
    this.onSay = null; // (texto | null) => void — balão de fala
    anchor.add(this.container);
    this.container.visible = false;
  }

  get visible() {
    return this.container.visible && this.state !== 'gone';
  }

  /* ------------------------------------------------------------ ciclo */
  /** A página apareceu: salta do desenho (ou volta, se estava perdido). */
  found() {
    if (this.state === 'leaving') return; // indo para casa
    if (this.state === 'holding') {
      // a página voltou rápido: segue a vida, sem festa (ninguém viu a falha)
      this._backToAnchor();
      this.state = 'living';
      return;
    }
    if (this.state === 'lost') {
      this._backToAnchor();
      this.state = 'living';
      this.lostT = 0;
      this.model.setOpacity(1);
      this.model.body.rotation.set(0, 0, 0);
      this.onSay?.(null);
      this.model.playOnce('happy');
      return;
    }
    if (this.state === 'living' || this.state === 'entering') return;
    this._backToAnchor();
    this.wander.pos = [...this.place.home];
    this.wander.hold(0.3);
    this.heading = 0;
    this.enterT = 0;
    this.state = 'entering';
    this.model.setOpacity(1);
    this.model.setLocomotion('idle', 0);
    this.container.visible = true;
    this.model.resetPhysics?.(); // cabelo e roupa em repouso ao saltar da página
  }

  /** A página sumiu da câmera: espera parado no último lugar (ver holdGrace). */
  lost() {
    if (this.state !== 'living' && this.state !== 'entering') return;
    // fica no último lugar em que a página foi vista
    const ghost = new THREE.Group();
    ghost.matrixAutoUpdate = false;
    ghost.matrix.copy(this.anchor.matrix);
    ghost.matrixWorldNeedsUpdate = true;
    this.scene.add(ghost);
    ghost.add(this.container);
    this.ghost = ghost;
    if (this.state === 'entering') this._finishEntering();
    this.state = 'holding';
    this.holdT = 0;
    this.model.setLocomotion('idle');
  }

  /** A página não voltou: pisca, some aos poucos e pede para voltar. */
  _startWorrying() {
    this.state = 'lost';
    this.lostT = 0;
    if (this.model.has('worried')) this.model.playOnce('worried');
    this.onSay?.(this.lostText);
  }

  /** Vai para casa (sai da página): dá tchau, dá um pulinho e some. */
  leave() {
    if (this.state === 'gone' || this.state === 'leaving') return Promise.resolve();
    this._backToAnchor();
    this.onSay?.(null);
    this.state = 'leaving';
    this.leaveT = 0;
    this.model.setLocomotion('idle');
    this.model.playOnce(this.character ? 'ola' : 'happy');
    return new Promise((resolve) => { this._onLeft = resolve; });
  }

  /** Some de vez (ex.: outra página apareceu). */
  hide() {
    this._backToAnchor();
    this.container.visible = false;
    this.state = 'gone';
    this.onSay?.(null);
  }

  _backToAnchor() {
    if (this.ghost) {
      this.anchor.add(this.container);
      this.ghost.removeFromParent();
      this.ghost = null;
    }
  }

  _finishEntering() {
    this.container.scale.setScalar(this.size);
    this.model.body.position.y = 0;
  }

  /* ------------------------------------------------------------ toque */
  /** Carinho: para, olha para quem tocou e fica feliz. */
  tap(cameraInAnchor) {
    if (this.state !== 'living') return null;
    this.taps += 1;
    if (cameraInAnchor) this.faceTarget = headingTo(this.wander.pos, [cameraInAnchor.x, cameraInAnchor.y]);
    this.model.setLocomotion('idle');
    const special = this.taps % 3 === 0 && this.model.has('special');
    const role = special ? 'special' : this.character && this.taps % 2 === 1 ? 'ola' : 'happy';
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
        m.playOnce(this.character ? 'ola' : 'happy');
      }
    } else if (this.state === 'living') {
      const step = m.busy || this.wander.paused ? null : this.wander.update(dt);
      if (step) {
        m.setLocomotion(step.moving ? 'walk' : 'idle');
        this.heading = step.heading;
        if (step.arrived && step.edge && !this.character) {
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
    } else if (this.state === 'holding') {
      this.holdT += dt;
      if (this.holdT >= this.holdGrace) this._startWorrying();
    } else if (this.state === 'leaving') {
      this.leaveT += dt;
      // tchau (0,9 s) e depois encolhe com um pulinho
      const k = Math.min(1, Math.max(0, (this.leaveT - 0.9) / 0.5));
      this.container.scale.setScalar(this.size * Math.max(0.001, 1 - k * k * (3 - 2 * k)));
      m.body.position.y = Math.sin(k * Math.PI) * 0.4;
      if (k >= 1) {
        this.container.visible = false;
        this.state = 'gone';
        m.body.position.y = 0;
        this._onLeft?.();
        this._onLeft = null;
        return;
      }
    } else if (this.state === 'lost') {
      this.lostT += dt;
      const k = Math.min(1, this.lostT / this.lostGrace);
      // pisca cada vez mais rápido enquanto fica transparente
      const blink = 0.62 + 0.38 * Math.cos(this.lostT * (8 + 10 * k));
      m.setOpacity((1 - k) * blink);
      if (!m.has('worried')) {
        // sem a animação "preocupado" no arquivo: balança e dá pulinhos
        m.body.rotation.z = Math.sin(this.lostT * 13) * 0.12 * (1 - k * 0.5);
        m.body.position.y = Math.abs(Math.sin(this.lostT * 6)) * 0.08;
      }
      if (k >= 1) {
        m.body.rotation.set(0, 0, 0);
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
   * das costas. Em ângulos normais de leitura ele fica em pé na página.
   */
  _updateLean(dt) {
    if (this.state === 'lost' || this.state === 'holding') return; // parado onde estava
    const cam = this.cameraInPage();
    const horizontal = Math.hypot(cam.x - this.wander.pos[0], cam.y - this.wander.pos[1]);
    const elevation = Math.atan2(cam.z, horizontal); // 90° = bem de cima
    const target = THREE.MathUtils.clamp((elevation - this.leanStart) * 0.8, 0, this.leanMax);
    this.leanAngle = THREE.MathUtils.damp(this.leanAngle || 0, target, 4, dt);
    // inclina para a borda de baixo da página (o lado de quem lê e segura o celular)
    _lean.setFromAxisAngle(X_AXIS, this.leanAngle);
  }

  /** Posição na tela (px) do alto da cabeça, para o balão de fala. */
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
    const parent = this.ghost || this.anchor;
    _m.copy(parent.matrixWorld).invert();
    return new THREE.Vector3(0, 0, 0).applyMatrix4(_m);
  }

  dispose() {
    this.onSay?.(null);
    this.hit.removeFromParent();
    this.hit.geometry.dispose();
    this.hit.material.dispose();
    this.container.removeFromParent();
    this.ghost?.removeFromParent();
  }
}

export { angleDelta };
