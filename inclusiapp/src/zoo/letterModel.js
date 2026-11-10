/**
 * Uma LETRA do alfabeto em 3D (zoológico em AR).
 *
 * Quando a criança mostra a carta com o sinal de uma vogal em LIBRAS, aparece
 * a letra do português, grande e animada, para ela ver o par: o sinal da mão
 * na carta ↔ a letra. Não é um personagem (sem rosto): é a própria letra,
 * com jeito de desenho (cores chapadas e contorno escuro), que pula, gira e
 * se espreguiça.
 *
 * O contorno vem da fonte do app (assets/zoo/letras.json, gerado por
 * tools/gerar-letras.py) e é extrudado aqui. A interface é a mesma do
 * AnimalModel (root, body, size, setLocomotion, playOnce, setOpacity,
 * update): a página trata a letra como trata um animal (ar/pageActor.js).
 */
import * as THREE from '../lib/three.js';

const COLORS = {
  face: 0xf4b224, // âmbar do Signária
  aceso: 0x63cbc9, // turquesa: a magia de Signária
  contorno: 0x42433a,
};
const _aceso = new THREE.Color(COLORS.aceso);
const DEPTH = 0.3; // grossura da letra (altura da letra = 1)
const OUTLINE = 0.03;

let glyphsPromise = null;
function loadGlyphs() {
  if (!glyphsPromise) {
    glyphsPromise = fetch('assets/zoo/letras.json').then((r) => {
      if (!r.ok) throw new Error(`letras.json: HTTP ${r.status}`);
      return r.json();
    }).catch((err) => {
      glyphsPromise = null;
      throw err;
    });
  }
  return glyphsPromise;
}

let gradient = null;
function toonGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

let glowTexture = null;
function glow() {
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

const geometries = new Map(); // letra → { body, outline, size }

/** Geometria da letra: altura 1, pé em y = 0, centrada em x e z. */
function buildGeometry(glyph, units) {
  const [x0, y0, x1, y1] = glyph.caixa;
  const capHeight = y1 - Math.max(0, y0) || units * 0.7;
  const k = 1 / capHeight;
  const cx = (x0 + x1) / 2;
  const path = new THREE.ShapePath();
  for (const c of glyph.caminho) {
    const p = c.slice(1).map((v, i) => (i % 2 === 0 ? (v - cx) * k : v * k));
    if (c[0] === 'M') path.moveTo(p[0], p[1]);
    else if (c[0] === 'L') path.lineTo(p[0], p[1]);
    else if (c[0] === 'Q') path.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else if (c[0] === 'C') path.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
  }
  // contornos TrueType: o de fora em sentido horário (como no FontLoader do three.js)
  const shapes = path.toShapes(false);
  // o chanfro começa por dentro do contorno (bevelOffset = −bevelSize): assim a
  // letra fica do tamanho certo e os vãos estreitos (do E, o buraco do A) não fecham
  const BEVEL = 0.025;
  const bevel = { bevelEnabled: true, bevelThickness: 0.035, bevelSize: BEVEL, bevelSegments: 2, curveSegments: 6 };
  const body = new THREE.ExtrudeGeometry(shapes, { ...bevel, depth: DEPTH, bevelOffset: -BEVEL });
  // contorno: a mesma letra um pouco mais gorda, desenhada só por trás
  // (BackSide). Fica como um traço escuro em volta, sem vazar para a frente.
  const outline = new THREE.ExtrudeGeometry(shapes, { ...bevel, depth: DEPTH + OUTLINE * 2, bevelOffset: OUTLINE - BEVEL });
  body.computeBoundingBox();
  const b = body.boundingBox;
  const dy = -b.min.y;
  body.translate(0, dy, -(b.min.z + b.max.z) / 2);
  outline.computeBoundingBox();
  const o = outline.boundingBox;
  outline.translate(0, dy, -(o.min.z + o.max.z) / 2);
  body.computeBoundingBox();
  const size = body.boundingBox.getSize(new THREE.Vector3());
  return { body, outline, size: [size.x, size.y, size.z] };
}

/** Carrega o contorno e monta uma letra nova (cada letra é uma instância). */
export async function createLetter(letter) {
  const data = await loadGlyphs();
  const glyph = data.letras[letter];
  if (!glyph) throw new Error(`Letra sem contorno: ${letter}`);
  if (!geometries.has(letter)) geometries.set(letter, buildGeometry(glyph, data.unidades));
  return new LetterModel(letter, geometries.get(letter));
}

const ONE_SHOTS = { happy: 1.1, special: 2.2, worried: 2.0, ola: 1.1 };
const easeOut = (t) => 1 - (1 - t) ** 3;

export class LetterModel {
  constructor(letter, geo) {
    this.letter = letter;
    this.flies = false;
    this.size = geo.size;
    this.root = new THREE.Group();
    this.root.name = `letra-${letter}`;
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.pivot = new THREE.Group(); // gira e estica em volta do pé
    this.body.add(this.pivot);

    this.material = new THREE.MeshToonMaterial({ color: COLORS.face, gradientMap: toonGradient() });
    this.outlineMaterial = new THREE.MeshBasicMaterial({ color: COLORS.contorno, side: THREE.BackSide });
    const mesh = new THREE.Mesh(geo.body, this.material);
    const outline = new THREE.Mesh(geo.outline, this.outlineMaterial);
    mesh.frustumCulled = outline.frustumCulled = false;
    this.pivot.add(outline, mesh);

    // brilho turquesa atrás da letra (quando ela encontra o seu animal)
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), transparent: true, opacity: 0, depthWrite: false }));
    this.halo.scale.set(this.size[0] * 2.2, 1.9, 1);
    this.halo.position.set(0, 0.5, -this.size[2]);
    this.body.add(this.halo);

    this.time = Math.random() * 10;
    this.locomotion = 'idle';
    this.walkBlend = 0;
    this.oneShot = null;
    this.lit = false;
    this.opacity = 1;
  }

  has(role) {
    return role in ONE_SHOTS || role === 'idle' || role === 'walk';
  }

  setLocomotion(role) {
    this.locomotion = role === 'walk' ? 'walk' : 'idle';
  }

  playOnce(role) {
    const name = role === 'ola' ? 'happy' : role;
    const duration = ONE_SHOTS[name];
    if (!duration) return Promise.resolve(false);
    this.oneShot?.resolve(false);
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    this.oneShot = { name, t: 0, duration, resolve };
    return promise;
  }

  get busy() {
    return !!this.oneShot;
  }

  /** A letra acende (turquesa) quando o animal dela chega perto. */
  setLit(on) {
    this.lit = on;
  }

  setOpacity(value) {
    const o = THREE.MathUtils.clamp(value, 0, 1);
    if (Math.abs(o - this.opacity) < 1e-3) return;
    const fading = o < 0.999;
    for (const m of [this.material, this.outlineMaterial]) {
      if (m.transparent !== fading) {
        m.transparent = fading;
        m.needsUpdate = true;
      }
      m.opacity = o;
    }
    this.opacity = o;
    this.root.visible = o > 0.01;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    this.walkBlend = THREE.MathUtils.damp(this.walkBlend, this.locomotion === 'walk' ? 1 : 0, 6, dt);
    const w = this.walkBlend;

    // parado: respira (estica e encolhe) e balança de leve; andando: pulinhos
    const hopPhase = (t * 2.6) % 1;
    const hop = Math.sin(hopPhase * Math.PI);
    let y = hop * 0.22 * w;
    let sy = 1 + Math.sin(t * 2.2) * 0.03 * (1 - w);
    // no chão (fim e começo do pulo): achata; no ar: estica
    if (w > 0.05) sy *= hop < 0.25 ? 1 - (0.25 - hop) * 0.6 * w : 1 + hop * 0.06 * w;
    let rz = Math.sin(t * 1.3) * 0.05 * (1 - w) + Math.sin(t * 2.6 * Math.PI) * 0.06 * w;
    let ry = 0;

    const shot = this.oneShot;
    if (shot) {
      shot.t += dt;
      const k = Math.min(1, shot.t / shot.duration);
      if (shot.name === 'happy') {
        // pulo alto com uma volta inteira
        y += Math.sin(k * Math.PI) * 0.55;
        ry = easeOut(k) * Math.PI * 2;
        sy *= k < 0.12 ? 1 - k * 2 : 1 + Math.sin(k * Math.PI) * 0.1;
      } else if (shot.name === 'special') {
        // flutua girando, brilhando
        y += Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.35;
        ry = easeOut(k) * Math.PI * 4;
      } else if (shot.name === 'worried') {
        rz = Math.sin(shot.t * 14) * 0.18 * (1 - k * 0.5);
      }
      if (k >= 1) {
        this.oneShot = null;
        shot.resolve(true);
      }
    }
    this.pivot.position.y = y;
    this.pivot.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    this.pivot.rotation.set(0, ry, rz);

    // cor e brilho: âmbar ↔ turquesa
    const target = this.lit ? 1 : 0;
    this.litBlend = THREE.MathUtils.damp(this.litBlend || 0, target, 4, dt);
    this.material.color.setHex(COLORS.face).lerp(_aceso, this.litBlend);
    this.halo.material.opacity = this.litBlend * (0.75 + 0.25 * Math.sin(t * 3)) * this.opacity;
  }

  dispose() {
    this.root.removeFromParent();
    this.material.dispose();
    this.outlineMaterial.dispose();
    this.halo.material.dispose();
  }
}
