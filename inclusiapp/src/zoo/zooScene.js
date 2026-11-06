/**
 * Cena 3D do zoológico: o chão (invisível, sobre a ilustração do Igor que
 * fica no fundo da tela), os animais passeando e as runas em pé.
 *
 * Usa o mesmo renderer WebGL do app (getRenderer: o iPhone limita a
 * quantidade de contextos) e os mesmos modelos do livro (createAnimal:
 * cada animal colocado é uma instância nova).
 *
 * Coordenadas: o "chão" do zooState (x, y) vira (x, 0, −y) aqui; y maior =
 * mais longe da câmera. Direção 0 = olhando para a câmera.
 */
import * as THREE from '../lib/three.js';
import { getRenderer } from '../ar/arSession.js';
import { createAnimal } from '../ar/modelManager.js';
import { Wanderer } from '../ar/pageWalker.js';
import { animalById } from '../config.js';
import { ZOO } from './zooConfig.js';

const textureLoader = new THREE.TextureLoader();
const runeTextures = new Map();
function runeTexture(letter, lit) {
  const key = `${letter}${lit ? '+' : ''}`;
  if (!runeTextures.has(key)) {
    const tex = textureLoader.load(`assets/img/runas/${lit ? 'acesa' : 'runa'}-${letter.toLowerCase()}.webp`);
    tex.colorSpace = THREE.SRGBColorSpace;
    runeTextures.set(key, tex);
  }
  return runeTextures.get(key);
}

let glowTexture = null;
function getGlow() {
  if (!glowTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(116,208,216,0.95)');
    g.addColorStop(0.45, 'rgba(88,196,200,0.45)');
    g.addColorStop(1, 'rgba(88,196,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    glowTexture = new THREE.CanvasTexture(c);
  }
  return glowTexture;
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _v = new THREE.Vector3();

export class ZooScene {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    this.camera.position.set(0, 2.5, 4.6);
    this.camera.lookAt(0, 0.2, 0);
    this.entities = new Map(); // id → { item, kind, root, model?, walker?, lift }
    this.clock = new THREE.Clock(false);
    this.onFrame = null;
    this._onResize = () => this.resize();
  }

  start() {
    const renderer = getRenderer();
    this.container.appendChild(renderer.domElement);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.resize();
    window.addEventListener('resize', this._onResize);
    this.clock.start();
    renderer.setAnimationLoop(() => this._render());
    this.running = true;
  }

  stop() {
    const renderer = getRenderer();
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this._onResize);
    if (renderer.domElement.parentNode === this.container) {
      renderer.clear();
      renderer.domElement.remove();
    }
    for (const id of [...this.entities.keys()]) this.remove(id);
    this.clock.stop();
    this.running = false;
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    // em pé (celular), afasta a câmera para caber o chão inteiro
    const portrait = h > w;
    this.camera.position.set(0, portrait ? 4.2 : 2.5, portrait ? 6.8 : 4.6);
    this.camera.fov = portrait ? 34 : 38;
    this.camera.lookAt(0, portrait ? -0.2 : 0.2, 0);
    this.camera.updateProjectionMatrix();
    getRenderer().setSize(w, h);
    this.viewport = { width: w, height: h };
    this._fitGround();
  }

  /**
   * A parte do chão que aparece na tela (sem a barra de cima e a bandeja de
   * baixo): os animais andam só ali, em qualquer formato de tela.
   */
  _fitGround() {
    const hit = (x, y) => {
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, this.camera);
      return raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
    };
    const top = (1 - (90 / this.viewport.height) * 2) * 0.92; // abaixo da barra de cima
    const bottom = -1 + (175 / this.viewport.height) * 2; // acima da bandeja
    const far = hit(0, top);
    const near = hit(0, bottom);
    const nearEdge = hit(0.86, bottom);
    if (!far || !near || !nearEdge) return;
    const halfWidth = Math.min(ZOO.ground.halfWidth, Math.abs(nearEdge.x) - 0.15);
    const minY = -near.z + 0.1; // y do zooState = −z
    const maxY = Math.min(-far.z - 0.15, minY + ZOO.ground.halfDepth * 2);
    this.bounds = { minX: -halfWidth, maxX: halfWidth, minY, maxY: Math.max(minY + 0.4, maxY) };
    for (const ent of this.entities.values()) if (ent.walker) ent.walker.bounds = this.bounds;
    this.onBounds?.(this.bounds);
  }

  /* ------------------------------------------------------------ elementos */
  async addAnimal(item) {
    const animal = animalById(item.type);
    const model = await createAnimal(animal);
    if (!this.running) {
      model.dispose();
      return null;
    }
    const size = ZOO.sizes[item.type] || 0.7;
    model.root.scale.setScalar(size);
    const walker = new Wanderer({
      bounds: this.bounds,
      start: [item.x, item.y],
      heading: 0,
      speed: model.flies ? 0.42 : 0.28 * (size + 0.3),
      rest: [1.5, 5],
    });
    // alvo de toque invisível (maior que o animal)
    const [sx, sy, sz] = model.size;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sx, 0.45) * 1.4, sy * 1.4, Math.max(sz, 0.45) * 1.4), new THREE.MeshBasicMaterial());
    hit.visible = false;
    hit.position.y = sy * 0.55;
    model.body.add(hit);
    const ent = { item, kind: 'animal', root: model.root, model, walker, hit, lift: model.flies ? ZOO.beeLift : 0, pop: 0 };
    hit.userData.entityId = item.id;
    this.scene.add(model.root);
    this.entities.set(item.id, ent);
    this._place(ent);
    return ent;
  }

  addRune(item) {
    const h = ZOO.runeHeight;
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ map: runeTexture(item.type, false), transparent: true, alphaTest: 0.05 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.69, h), mat);
    plane.position.y = h / 2;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlow(), transparent: true, depthWrite: false, opacity: 0 }));
    glow.scale.set(h * 1.5, h * 1.5, 1);
    glow.position.y = h / 2;
    glow.renderOrder = -1;
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(h * 0.32, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.003;
    shadow.scale.set(1, 0.5, 1);
    group.add(glow, plane, shadow);
    plane.userData.entityId = item.id;
    const ent = { item, kind: 'runa', root: group, plane, glow, hit: plane, lit: false, pop: 0 };
    this.scene.add(group);
    this.entities.set(item.id, ent);
    this._place(ent);
    return ent;
  }

  remove(id) {
    const ent = this.entities.get(id);
    if (!ent) return;
    if (ent.model) ent.model.dispose();
    else {
      ent.root.removeFromParent();
      ent.plane.geometry.dispose();
      ent.plane.material.dispose();
    }
    this.entities.delete(id);
  }

  lightRune(id, on) {
    const ent = this.entities.get(id);
    if (!ent || ent.kind !== 'runa') return;
    ent.lit = on;
    ent.plane.material.map = runeTexture(ent.item.type, on);
    ent.plane.material.needsUpdate = true;
  }

  /** Toca 'happy' ou 'special' (se o animal tiver; senão, 'happy'). */
  play(id, role) {
    const ent = this.entities.get(id);
    if (!ent?.model) return Promise.resolve(false);
    ent.walker.hold(role === 'special' ? 6 : 3);
    const r = role === 'special' && !ent.model.has('special') ? 'happy' : role;
    return ent.model.playOnce(r);
  }

  /** Vira um para o outro (e quem vem chega perto). */
  meet(aId, bId, approach) {
    const a = this.entities.get(aId);
    const b = this.entities.get(bId);
    if (!a || !b) return;
    const mover = approach === 'a' ? a : b;
    const still = mover === a ? b : a;
    const dx = still.item.x - mover.item.x;
    const dy = still.item.y - mover.item.y;
    const d = Math.hypot(dx, dy) || 1;
    const gap = mover.model?.flies ? 0.12 : 0.45;
    mover.walker?.goTo([still.item.x - (dx / d) * gap, still.item.y - (dy / d) * gap]);
    if (still.walker) {
      still.walker.hold(3);
      still.walker.heading = Math.atan2(-dx, dy);
    }
  }

  setDragging(id, on) {
    const ent = this.entities.get(id);
    if (!ent) return;
    ent.dragging = on;
    if (ent.walker) {
      ent.walker.paused = on;
      if (!on) ent.walker.pos = [ent.item.x, ent.item.y];
    }
  }

  /* ------------------------------------------------------------ toque */
  _ray(clientX, clientY) {
    const r = this.container.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, this.camera);
  }

  /** O elemento sob o dedo (id) ou null. */
  pick(clientX, clientY) {
    this._ray(clientX, clientY);
    this.scene.updateMatrixWorld();
    const targets = [...this.entities.values()].map((e) => e.hit);
    const hit = raycaster.intersectObjects(targets, false)[0];
    return hit ? hit.object.userData.entityId : null;
  }

  /** O ponto do chão sob o dedo, nas coordenadas do zooState. */
  groundPoint(clientX, clientY) {
    this._ray(clientX, clientY);
    if (!raycaster.ray.intersectPlane(groundPlane, _v)) return null;
    return { x: _v.x, y: -_v.z };
  }

  /** Onde fica (px) o alto de um elemento, para o balão. */
  screenPoint(id, out = { x: 0, y: 0, visible: false }) {
    const ent = this.entities.get(id);
    if (!ent || !this.viewport) return out;
    const top = ent.model ? ent.model.size[1] * ent.root.scale.y + ent.lift + 0.05 : ZOO.runeHeight;
    _v.set(ent.root.position.x, top + (ent.model ? 0 : 0.05), ent.root.position.z).project(this.camera);
    out.visible = _v.z < 1;
    out.x = ((_v.x + 1) / 2) * this.viewport.width;
    out.y = ((1 - _v.y) / 2) * this.viewport.height;
    return out;
  }

  /* ------------------------------------------------------------ quadro a quadro */
  _place(ent) {
    const lift = ent.dragging ? 0.18 : 0;
    ent.root.position.set(ent.item.x, lift + (ent.lift || 0), -ent.item.y);
  }

  _render() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time = (this.time || 0) + dt;
    try {
      this.onFrame?.(dt);
      for (const ent of this.entities.values()) {
        ent.pop = Math.min(1, ent.pop + dt / 0.45);
        const s = 1 + 2.70158 * (ent.pop - 1) ** 3 + 1.70158 * (ent.pop - 1) ** 2;
        if (ent.model) {
          const m = ent.model;
          if (!ent.dragging && !m.busy) {
            const step = ent.walker.update(dt);
            ent.item.x = step.pos[0];
            ent.item.y = step.pos[1];
            m.setLocomotion(step.moving ? 'walk' : 'idle');
          } else if (ent.dragging) {
            m.setLocomotion(m.flies ? 'walk' : 'idle');
          }
          ent.root.rotation.y = ent.walker.heading;
          m.body.scale.setScalar(Math.max(0.01, s));
          if (ent.dragging) m.body.rotation.z = Math.sin(this.time * 9) * 0.12;
          else m.body.rotation.z = 0;
          m.update(dt);
        } else {
          ent.plane.scale.setScalar(Math.max(0.01, s));
          // a runa sempre de frente para a câmera
          ent.root.rotation.y = Math.atan2(this.camera.position.x - ent.root.position.x, this.camera.position.z - ent.root.position.z);
          const target = ent.lit ? 0.75 + 0.25 * Math.sin(this.time * 3) : 0;
          ent.glow.material.opacity += (target - ent.glow.material.opacity) * Math.min(1, dt * 4);
          ent.plane.position.y = ZOO.runeHeight / 2 + (ent.lit ? 0.04 + 0.03 * Math.sin(this.time * 2) : 0);
        }
        this._place(ent);
      }
    } catch (err) {
      if (!this._errLogged) console.error('[zoo] erro no quadro', err);
      this._errLogged = true;
    }
    const renderer = getRenderer();
    renderer.autoClear = true;
    renderer.render(this.scene, this.camera);
  }
}
