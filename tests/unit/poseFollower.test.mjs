/**
 * O movimento liso (inclusiapp/src/ar/poseFollower.js): o animal segue a
 * página sem saltos e viaja até o palco de brincar quando a página some.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Matrix4, Quaternion, Vector3 } from '../../inclusiapp/vendor/three/three.module.min.js';
import {
  PoseFollower, makePose, poseFromMatrix, stagePose, stageWalkBounds,
} from '../../inclusiapp/src/ar/poseFollower.js';
import { STAGE } from '../../inclusiapp/src/config.js';

const pose = (x, y, z, s = 1, q = new Quaternion()) => ({ p: new Vector3(x, y, z), q, s });
const FRAME = 1 / 60;

test('segue o alvo sem pular: a cada quadro anda um pouco, e chega', () => {
  const g = new Group();
  const f = new PoseFollower(g, { smoothMs: 70 });
  f.snap(pose(0, 0, -1000, 500));
  const target = pose(100, 0, -1000, 500);
  f.update(FRAME, target);
  assert.ok(g.position.x > 5 && g.position.x < 30, `1º quadro: ${g.position.x.toFixed(1)} (nem parado nem pulando)`);
  for (let i = 0; i < 30; i++) f.update(FRAME, target); // meio segundo
  assert.ok(Math.abs(g.position.x - 100) < 0.2, `chegou: ${g.position.x}`);
  assert.equal(g.scale.x, 500);
});

test('o rastreio atualiza "aos saltos" (15 por segundo); o desenho fica liso (60 por segundo)', () => {
  const g = new Group();
  const f = new PoseFollower(g, { smoothMs: 70 });
  f.snap(pose(0, 0, -1000));
  let target = pose(0, 0, -1000);
  const steps = [];
  let last = 0;
  for (let i = 0; i < 60; i++) {
    if (i % 4 === 0) target = pose(i * 5, 0, -1000); // a página anda 20 unidades a cada atualização do rastreio
    f.update(FRAME, target);
    steps.push(g.position.x - last);
    last = g.position.x;
  }
  const maxStep = Math.max(...steps.slice(8));
  assert.ok(maxStep < 12, `o maior passo por quadro (${maxStep.toFixed(1)}) é bem menor que o salto do rastreio (20)`);
});

test('viagem até o palco: sai de onde está, acelera e freia, e termina exatamente no alvo (mesmo se ele se mexe)', () => {
  const g = new Group();
  const f = new PoseFollower(g, { smoothMs: 70 });
  f.snap(pose(-300, 200, -800, 400));
  f.glide(600);
  const xs = [];
  let i = 0;
  for (; f.gliding && i < 100; i++) {
    f.update(FRAME, pose(i, -100, -1000, 900)); // o alvo ainda se mexe um pouco
    xs.push(g.position.x);
  }
  assert.ok(i >= 35 && i <= 38, `a viagem dura uns 0,6 s (${i} quadros)`);
  assert.equal(g.position.x, i - 1, 'termina exatamente no alvo do último quadro');
  assert.equal(g.scale.x, 900);
  const d = xs.slice(1).map((x, i) => x - xs[i]);
  assert.ok(d[0] < d[15], 'começa devagar');
  assert.ok(d.every((v) => v >= -0.01), 'sem voltar para trás');
});

test('a pose da âncora do MindAR: posição, rotação e a largura da página', () => {
  const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.6);
  const m = new Matrix4().compose(new Vector3(10, -20, -900), q, new Vector3(1280, 1280, 1280));
  const p = poseFromMatrix(m, makePose());
  assert.ok(p.p.distanceTo(new Vector3(10, -20, -900)) < 1e-6);
  assert.ok(Math.abs(p.s - 1280) < 1e-6);
  assert.ok(p.q.angleTo(q) < 1e-6);
});

test('o palco: no meio da tela, um pouco abaixo, na frente da câmera, com o chão visto um pouco de cima', () => {
  const cam = { fov: 60, aspect: 390 / 844 };
  const p = stagePose(cam, STAGE);
  assert.equal(p.p.x, 0);
  assert.ok(p.p.y < 0 && p.p.z < 0);
  // o "para fora do papel" (onde o animal fica em pé) aponta para cima e um pouco para a câmera
  const up = new Vector3(0, 0, 1).applyQuaternion(p.q);
  assert.ok(up.y > 0.8 && up.z > 0.2, `em pé, visto de leve de cima: ${up.toArray().map((v) => v.toFixed(2))}`);
  const viewH = 2 * 1000 * Math.tan((60 * Math.PI) / 360);
  assert.ok(Math.abs(p.s - viewH * cam.aspect * STAGE.widthFrac) < 1e-6, 'retrato: a largura vem da largura da tela');
  // pinça e giro do dedo
  const z = stagePose(cam, STAGE, { zoom: 2, yaw: Math.PI / 2 });
  assert.ok(Math.abs(z.s - p.s * 2) < 1e-6);
  assert.ok(z.q.angleTo(p.q) > 1.5);
  // paisagem: não fica maior que a altura da tela
  const l = stagePose({ fov: 40, aspect: 844 / 390 }, STAGE);
  const viewHl = 2 * 1000 * Math.tan((40 * Math.PI) / 360);
  assert.ok(l.s <= viewHl * STAGE.maxHeightFrac + 1e-6);
});

test('no palco o animal passeia sem sair da tela (retrato e paisagem)', () => {
  for (const aspect of [390 / 844, 844 / 390]) {
    for (const radius of [0.13, 0.17, 0.2]) {
      const b = stageWalkBounds(STAGE, radius, { aspect });
      const pageInScreen = Math.min(STAGE.widthFrac, STAGE.maxHeightFrac / aspect);
      const halfVisible = 0.5 / pageInScreen;
      assert.ok(b.maxX + radius <= halfVisible + 1e-9, `aspecto ${aspect.toFixed(2)}, raio ${radius}`);
      assert.ok(b.minX < 0 && b.maxX > 0 && b.minY < 0 && b.maxY > 0);
    }
  }
});
