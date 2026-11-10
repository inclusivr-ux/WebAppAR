/**
 * Animais 3D (traço do ilustrador, repositório inclusivr-animais): carregamento sob
 * demanda, cache e animações gravadas no próprio arquivo.
 *
 * O contrato dos .glb (docs/ENTREGA.md do inclusivr-animais):
 *   - olhando para +Z, Y para cima, os pés em y = 0, maior medida = 1;
 *   - material sem luz com a textura pintada (não trocar o material);
 *   - animações com nome: `parado` e `andar`/`voar` em laço, `feliz` e as
 *     especiais (`agua`, `crista`, `brincar`, `mel`) uma vez;
 *   - malha e animações comprimidas (EXT_meshopt_compression): o leitor
 *     precisa do decodificador meshopt;
 *   - os adereços (gotas, borboleta, pote de mel) nascem pequenos dentro do
 *     animal: o corte da câmera (frustumCulled) fica desligado.
 *
 * Cada AnimalModel é uma instância independente (o zoológico pode ter
 * vários ursos): a cena é clonada com o esqueleto e os materiais são
 * próprios, para o "sumir aos poucos" de um não afetar os outros.
 */
import * as THREE from '../lib/three.js';
import { download } from '../lib/download.js';

const loader = new THREE.GLTFLoader();
loader.setMeshoptDecoder(THREE.MeshoptDecoder);
const gltfCache = new Map();

/** Carrega (uma única vez) um .glb; o download tem progresso (lib/download.js). */
export function loadGLTF(url) {
  if (!gltfCache.has(url)) {
    const dir = url.slice(0, url.lastIndexOf('/') + 1);
    gltfCache.set(url, download(url).then((buffer) => loader.parseAsync(buffer, dir)).catch((err) => {
      gltfCache.delete(url);
      throw err;
    }));
  }
  return gltfCache.get(url);
}

/** Baixa o .glb em segundo plano (sem montar o modelo). */
export function prefetchModel(url) {
  return download(url).catch(() => {});
}

let shadowTexture = null;
function getShadowTexture() {
  if (!shadowTexture) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    shadowTexture = new THREE.CanvasTexture(canvas);
  }
  return shadowTexture;
}

/** Nome do clipe de cada papel; `null` = o animal não tem. */
const DEFAULT_CLIPS = { idle: 'parado', walk: 'andar', happy: 'feliz', special: null, worried: 'preocupado' };

export class AnimalModel {
  /**
   * @param {object} gltf    resultado do GLTFLoader (compartilhado; aqui é clonado)
   * @param {object} animal  entrada de ANIMALS (config.js)
   */
  constructor(gltf, animal) {
    this.animal = animal;
    this.clipNames = { ...DEFAULT_CLIPS, ...(animal.clips || {}) };
    const scene = THREE.cloneSkinned(gltf.scene);
    let extras = {};
    scene.traverse((o) => {
      if (o.userData?.inclusivr) extras = o.userData.inclusivr;
    });
    this.extras = extras;
    this.flies = !!(animal.flies ?? extras.voa);

    /** `root` é o que o app move; `body` recebe saltos, giros e o "pop" */
    this.root = new THREE.Group();
    this.root.name = `animal-${animal.id}`;
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.body.add(scene);
    this.scene = scene;

    this.materials = [];
    const seen = new Map();
    scene.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.frustumCulled = false;
      // material próprio desta instância (o original fica intacto no cache)
      let mat = seen.get(obj.material);
      if (!mat) {
        mat = obj.material.clone();
        seen.set(obj.material, mat);
        this.materials.push(mat);
      }
      obj.material = mat;
    });

    // medidas (o arquivo já vem com a maior medida = 1)
    const box = new THREE.Box3();
    scene.updateMatrixWorld(true);
    scene.traverse((obj) => {
      if (obj.isMesh && !/contorno/i.test(obj.name)) box.expandByObject(obj);
    });
    const size = box.getSize(new THREE.Vector3());
    this.size = [size.x || 1, size.y || 1, size.z || 1];

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.scale.set(Math.max(this.size[0], 0.3) * 1.1, Math.max(this.size[2], 0.3) * 1.1, 1);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.004;
    this.shadow.renderOrder = 0;
    this.root.add(this.shadow);

    this.mixer = new THREE.AnimationMixer(scene);
    this.clips = new Map(gltf.animations.map((c) => [c.name, c]));
    this.actions = new Map();
    this.base = null; // ação em laço do momento (parado ou andar)
    this.oneShot = null;
    this.opacity = 1;
    this._finished = (e) => this._onFinished(e);
    this.mixer.addEventListener('finished', this._finished);
    this.setLocomotion('idle', 0);
  }

  /** O arquivo tem a animação deste papel ('idle', 'walk', 'happy', 'special', 'worried')? */
  has(role) {
    const name = this.clipNames[role];
    return !!(name && this.clips.has(name));
  }

  _action(name) {
    if (!this.actions.has(name)) {
      const clip = this.clips.get(name);
      if (!clip) return null;
      this.actions.set(name, this.mixer.clipAction(clip));
    }
    return this.actions.get(name);
  }

  /** Laço de base: 'idle' (parado) ou 'walk' (andar; a abelha voa). */
  setLocomotion(role, fade = 0.3) {
    const action = this._action(this.clipNames[role]) || this._action(this.clipNames.idle);
    if (!action) return;
    this.locomotion = role;
    if (this.oneShot) {
      this.base = action; // assume quando o clipe de uma vez terminar
      return;
    }
    if (action === this.base) return;
    action.reset().setLoop(THREE.LoopRepeat, Infinity);
    action.enabled = true;
    if (this.base && fade > 0) action.crossFadeFrom(this.base, fade, false);
    action.play();
    this.base = action;
  }

  /**
   * Toca um clipe uma vez ('happy', 'special' ou 'worried') e volta ao laço.
   * Devolve uma promessa resolvida no fim (ou na hora, se o clipe não existir).
   */
  playOnce(role, { fade = 0.25 } = {}) {
    const action = this._action(this.clipNames[role]);
    if (!action) return Promise.resolve(false);
    if (this.oneShot && this.oneShot.action === action) return this.oneShot.promise;
    this._endOneShot(false);
    const from = this.base;
    action.reset().setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.enabled = true;
    if (from && fade > 0) action.crossFadeFrom(from, fade, false);
    action.play();
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    this.oneShot = { action, resolve, promise, role };
    return promise;
  }

  get busy() {
    return !!this.oneShot;
  }

  _onFinished(e) {
    if (this.oneShot && e.action === this.oneShot.action) this._endOneShot(true);
  }

  _endOneShot(finished) {
    const shot = this.oneShot;
    if (!shot) return;
    this.oneShot = null;
    const back = this.base || this._action(this.clipNames.idle);
    if (back) {
      back.reset().setLoop(THREE.LoopRepeat, Infinity);
      back.enabled = true;
      back.crossFadeFrom(shot.action, 0.25, false).play();
      this.base = back;
    }
    shot.resolve(finished);
  }

  /** Transparência do animal inteiro (0 … 1), para o "sumir aos poucos". */
  setOpacity(value) {
    const o = THREE.MathUtils.clamp(value, 0, 1);
    if (Math.abs(o - this.opacity) < 1e-3) return;
    this.opacity = o;
    for (const m of this.materials) {
      m.transparent = o < 0.999;
      m.opacity = o;
      m.needsUpdate = true;
    }
    this.shadow.material.opacity = o;
    this.root.visible = o > 0.01;
  }

  update(dt) {
    this.mixer.update(dt);
  }

  dispose() {
    this.mixer.removeEventListener('finished', this._finished);
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    this.materials.forEach((m) => m.dispose());
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}

/** Cria uma instância nova de um animal (cada chamada = um animal a mais na cena). */
export async function createAnimal(animal, { url = animal.model } = {}) {
  const gltf = await loadGLTF(url);
  return new AnimalModel(gltf, animal);
}
