/**
 * Maga Aia e Seu Zé em 3D (VRM 1.0 leves para o navegador).
 *
 * Os VRMs vêm dos repositórios inclusivr-aia e inclusivr-personagens, com o
 * MToon (o traço de desenho, com contorno), o esqueleto humanoide e as
 * expressões. Eles não trazem animações: aqui elas são feitas por código,
 * nos ossos "normalizados" do VRM (os mesmos nomes em qualquer personagem):
 *
 *   idle     parado: braços abaixados, respira, balança de leve, pisca
 *   walk     andar: pernas e braços alternados, o corpo sobe e desce
 *   happy    feliz: sorri, dá um pulinho com os braços para cima
 *   ola      olá: acena com a mão direita, sorrindo
 *   worried  preocupado: olha para os lados e encolhe (quando a página some)
 *
 * A interface é a mesma do AnimalModel (modelManager.js): root, body,
 * setLocomotion(), playOnce(), setOpacity(), update() — o livro trata
 * animais e personagens do mesmo jeito (pageActor.js).
 *
 * Se um dia vierem animações gravadas (.vrma, como os sinais do plugin de
 * LIBRAS), elas podem substituir estas sem mudar quem usa o personagem.
 *
 * FÍSICA (molas do VRM: cabelo, capa, vestido). No AR, o "mundo" é medido em
 * pixels da página (uma página ≈ 1000 unidades), e as molas do VRM esperam
 * metros. Por isso:
 *   - as molas rodam no espaço do próprio personagem (`center` = a cena do
 *     VRM): rigidez e gravidade ficam em metros, e o tremor do rastreamento
 *     não sacode o vestido;
 *   - os raios das colisões (o vestido contra as pernas) acompanham a escala
 *     em que o personagem é desenhado.
 * Sem isso o vestido da Aia "quebrava" (as partes da saia voavam).
 */
import * as THREE from '../lib/three.js';
import { getRenderer } from '../ar/arSession.js';
import { download } from '../lib/download.js';

let vrmLib = null;
/**
 * Carrega o leitor de VRM (three-vrm 2.1, ≈ 150 KB) e o de texturas KTX2
 * (a Aia leve usa texturas Basis, que a placa de vídeo lê comprimidas) só
 * quando um personagem aparece.
 */
function loadVrmLib() {
  if (!vrmLib) {
    vrmLib = Promise.all([
      import('../../vendor/three-vrm/three-vrm.module.min.js'),
      import('../../vendor/three/addons/KTX2Loader.js'),
    ]).then(([vrm, ktx]) => {
      const ktx2 = new ktx.KTX2Loader();
      ktx2.setTranscoderPath(new URL('../../vendor/three/basis/', import.meta.url).href);
      ktx2.detectSupport(getRenderer());
      return { ...vrm, ktx2 };
    }).catch((err) => {
      vrmLib = null;
      throw err;
    });
  }
  return vrmLib;
}

const cache = new Map();
const _scale = new THREE.Vector3();

async function loadVRM(url) {
  const lib = await loadVrmLib();
  const loader = new THREE.GLTFLoader();
  loader.setMeshoptDecoder(THREE.MeshoptDecoder);
  loader.setKTX2Loader(lib.ktx2);
  loader.register((parser) => new lib.VRMLoaderPlugin(parser));
  // o download tem progresso (a barra "chegando..." do livro) e é o mesmo da pré-carga
  const buffer = await download(url);
  const gltf = await loader.parseAsync(buffer, url.slice(0, url.lastIndexOf('/') + 1));
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error(`${url} não é um VRM`);
  lib.VRMUtils.removeUnnecessaryVertices(gltf.scene);
  lib.VRMUtils.removeUnnecessaryJoints?.(gltf.scene);
  vrm.scene.traverse((o) => {
    if (o.isMesh) o.frustumCulled = false;
  });
  return vrm;
}

/** Um personagem por arquivo (o VRM tem molas e expressões: não é clonado). */
export function getCharacter(character) {
  if (!cache.has(character.id)) {
    const promise = loadVRM(character.model).then((vrm) => new CharacterModel(vrm, character));
    cache.set(character.id, promise);
    promise.catch(() => cache.delete(character.id));
  }
  return cache.get(character.id);
}

export function prefetchCharacterLib() {
  loadVrmLib().catch(() => {});
}

/** Baixa o VRM em segundo plano (sem montar: montar trava o celular por um instante). */
export function prefetchCharacter(character) {
  return download(character.model).catch(() => {});
}

const ONE_SHOTS = { happy: 1.6, ola: 2.4, worried: 2.2, special: 2.4 };
const smooth = (t) => t * t * (3 - 2 * t);
/** Envelope de um gesto: entra em 0,25 s e sai em 0,3 s. */
function envelope(t, duration) {
  return Math.min(smooth(Math.min(1, t / 0.25)), smooth(Math.min(1, Math.max(0, (duration - t) / 0.3))));
}

export class CharacterModel {
  constructor(vrm, character) {
    this.character = character;
    this.vrm = vrm;
    this.root = new THREE.Group();
    this.root.name = `personagem-${character.id}`;
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.body.add(vrm.scene);

    vrm.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const size = box.getSize(new THREE.Vector3());
    this.height = size.y || 1.4;
    // como os animais: maior medida = 1 (a altura), os pés em y = 0
    this.normalize = 1 / this.height;
    vrm.scene.scale.setScalar(this.normalize);
    vrm.scene.position.y = -box.min.y * this.normalize;
    this.size = [size.x * this.normalize, 1, size.z * this.normalize];

    // o estado original de cada material: a íris e o brilho dos olhos, por
    // exemplo, já são transparentes e têm que continuar assim depois do "sumir"
    this.materials = [];
    vrm.scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || this.materials.some((x) => x.material === m)) continue;
        this.materials.push({ material: m, transparent: m.transparent, depthWrite: m.depthWrite, opacity: m.opacity ?? 1 });
      }
    });

    // molas no espaço do personagem, com colisões na escala certa (ver o topo do arquivo)
    const springs = vrm.springBoneManager;
    this.springs = springs ? {
      manager: springs,
      joints: [...springs.joints].map((j) => ({ joint: j, hitRadius: j.settings.hitRadius })),
      shapes: [...springs.colliders].map((c) => ({ shape: c.shape, radius: c.shape.radius })),
      scale: 1,
    } : null;
    if (springs) for (const j of springs.joints) j.center = vrm.scene;

    const bone = (name) => vrm.humanoid?.getNormalizedBoneNode(name) || null;
    this.bones = Object.fromEntries([
      'hips', 'spine', 'chest', 'neck', 'head',
      'leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand',
      'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg',
    ].map((n) => [n, bone(n)]));

    this.time = Math.random() * 10;
    this.locomotion = 'idle';
    this.walkBlend = 0;
    this.oneShot = null;
    this.opacity = 1;
    this.nextBlink = 2 + Math.random() * 3;
    this.blinkT = -1;
  }

  has(role) {
    return role in ONE_SHOTS || role === 'idle' || role === 'walk';
  }

  setLocomotion(role) {
    this.locomotion = role === 'walk' ? 'walk' : 'idle';
  }

  playOnce(role) {
    const name = role === 'special' ? 'ola' : role;
    const duration = ONE_SHOTS[name];
    if (!duration) return Promise.resolve(false);
    if (this.oneShot) this.oneShot.resolve(false);
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    this.oneShot = { name, t: 0, duration, resolve, promise };
    return promise;
  }

  get busy() {
    return !!this.oneShot;
  }

  setOpacity(value) {
    const o = THREE.MathUtils.clamp(value, 0, 1);
    if (Math.abs(o - this.opacity) < 1e-3) return;
    const wasFading = this.opacity < 0.999;
    const fading = o < 0.999;
    this.opacity = o;
    for (const base of this.materials) {
      const m = base.material;
      m.opacity = base.opacity * o;
      if (fading !== wasFading) {
        // ao sumir, tudo fica transparente; ao voltar, cada material volta ao que era
        m.transparent = fading || base.transparent;
        m.depthWrite = base.depthWrite;
        m.needsUpdate = true;
      }
    }
    this.root.visible = o > 0.01;
  }

  /** Molas na posição de descanso (ao aparecer na página). */
  resetPhysics() {
    if (!this.springs) return;
    this.root.updateWorldMatrix(true, true);
    this._scaleSprings();
    this.springs.manager.reset();
  }

  /** Os raios das colisões acompanham a escala em que o personagem é desenhado. */
  _scaleSprings() {
    const sp = this.springs;
    if (!sp) return;
    const k = this.vrm.scene.getWorldScale(_scale).x;
    if (!(k > 0) || Math.abs(k - sp.scale) <= k * 1e-4) return;
    sp.scale = k;
    for (const j of sp.joints) j.joint.settings.hitRadius = j.hitRadius * k;
    for (const c of sp.shapes) c.shape.radius = c.radius * k;
  }

  _expression(name, value) {
    try {
      this.vrm.expressionManager?.setValue(name, value);
    } catch { /* o personagem não tem essa expressão */ }
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const B = this.bones;
    this.walkBlend = THREE.MathUtils.damp(this.walkBlend, this.locomotion === 'walk' ? 1 : 0, 6, dt);
    const w = this.walkBlend;
    const phase = t * 7.5;

    // --- base: parado + andar
    const breathe = Math.sin(t * 1.8) * 0.02;
    const pose = {
      leftUpperArm: [Math.sin(phase) * 0.45 * w, 0, -1.2 + breathe],
      rightUpperArm: [-Math.sin(phase) * 0.45 * w, 0, 1.2 - breathe],
      leftLowerArm: [0, 0, -0.12],
      rightLowerArm: [0, 0, 0.12],
      leftUpperLeg: [-Math.sin(phase) * 0.5 * w, 0, 0],
      rightUpperLeg: [Math.sin(phase) * 0.5 * w, 0, 0],
      leftLowerLeg: [Math.max(0, Math.sin(phase)) * 0.7 * w, 0, 0],
      rightLowerLeg: [Math.max(0, -Math.sin(phase)) * 0.7 * w, 0, 0],
      spine: [breathe + 0.04 * w, Math.sin(t * 0.6) * 0.04 * (1 - w), 0],
      head: [0, Math.sin(t * 0.45) * 0.12 * (1 - w), Math.sin(t * 0.7) * 0.03],
    };
    let lift = Math.abs(Math.sin(phase)) * 0.018 * w;
    let happy = 0;

    // --- gesto de uma vez por cima da base
    const shot = this.oneShot;
    if (shot) {
      shot.t += dt;
      const k = envelope(shot.t, shot.duration);
      const s = shot.t;
      if (shot.name === 'happy') {
        happy = k;
        lift += Math.max(0, Math.sin(s * Math.PI * 2.5)) * 0.06 * k;
        pose.leftUpperArm[2] += 1.7 * k;
        pose.rightUpperArm[2] -= 1.7 * k;
        pose.leftLowerArm[2] -= 0.5 * k;
        pose.rightLowerArm[2] += 0.5 * k;
      } else if (shot.name === 'ola') {
        happy = 0.7 * k;
        pose.rightUpperArm[2] -= 2.25 * k; // braço direito para cima, ao lado do rosto
        pose.rightUpperArm[0] -= 0.25 * k;
        pose.rightLowerArm[2] = THREE.MathUtils.lerp(pose.rightLowerArm[2], -0.5 + Math.sin(s * 11) * 0.45, k);
        pose.head[2] += 0.08 * k;
      } else if (shot.name === 'worried') {
        pose.head[1] += Math.sin(s * 5) * 0.45 * k; // olha para um lado e para o outro
        pose.spine[0] += 0.12 * k;
        pose.leftUpperArm[2] += 0.5 * k;
        pose.rightUpperArm[2] -= 0.5 * k;
        pose.leftLowerArm[1] = -1.4 * k;
        pose.rightLowerArm[1] = 1.4 * k;
      }
      if (shot.t >= shot.duration) {
        this.oneShot = null;
        shot.resolve(true);
      }
    }

    for (const [name, [x, y, z]] of Object.entries(pose)) B[name]?.rotation.set(x, y, z);
    this.body.position.y = lift;

    // piscar de vez em quando
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkT = 0;
      this.nextBlink = 2.5 + Math.random() * 3.5;
    }
    let blink = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      blink = Math.max(0, 1 - Math.abs(this.blinkT - 0.08) / 0.08);
      if (this.blinkT > 0.16) this.blinkT = -1;
    }
    this._expression('happy', happy);
    this._expression('blink', happy > 0.5 ? 0 : blink);
    this._scaleSprings();
    this.vrm.update(dt);
  }

  dispose() {
    this.root.removeFromParent();
  }
}
