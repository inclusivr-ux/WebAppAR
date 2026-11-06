/**
 * Reconhecedores do Sinalize! conferidos nos VÍDEOS DO FAUSTON: os pontos da
 * mão de cada quadro (medidos com tools/medir-libras.mjs e guardados em
 * tests/fixtures/libras/medidas.json.gz) passam pelos reconhecedores como se
 * fossem a câmera. Cada sinal de animal precisa ser aceito no próprio vídeo e
 * recusado nos outros quatro sinais e em todas as soletrações; cada vogal
 * precisa ser aceita na primeira letra da soletração do seu animal.
 *
 * Limite: é uma pessoa só (o Fauston). Crianças precisam ser testadas no aparelho.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createRecognizer, describeHand } from '../../inclusiapp/src/sign/signRecognizers.js';
import { classifyHand } from '../../inclusiapp/src/sign/handSigns.js';
import { LIBRAS_VIDEOS, VOWEL_CLIPS } from '../../inclusiapp/src/libras/librasVideos.js';
import { SIGN_GAME } from '../../inclusiapp/src/sign/signConfig.js';

const data = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/libras/medidas.json.gz', import.meta.url))).toString());
const ANIMALS = Object.keys(LIBRAS_VIDEOS);

function segment(video, start, end) {
  return data[video].frames.filter((f) => f.t >= start && f.t <= end);
}

/** Em quantos segundos o reconhecedor aceitou (ou null). */
function run(item, frames) {
  const r = createRecognizer(item, SIGN_GAME.recognition);
  for (const f of frames) {
    // como o HandTracker do app: cada mão leva as notas das vogais
    const hands = f.hands.map((h) => ({ ...h, ...classifyHand(h.world) }));
    if (r.update(hands, f.t * 1000).event === 'correct') return f.t - frames[0].t;
  }
  return null;
}

test('describeHand mede a mão (aberta, em "F", altura do pulso)', () => {
  const frame = data.abelha.frames.find((f) => f.hands.length === 1 && f.t > 6);
  const h = describeHand(frame.hands[0]);
  assert.ok(h);
  assert.equal(typeof h.open, 'boolean');
  assert.ok(h.wristY > 0 && h.wristY < 1);
  assert.equal(describeHand(null), null);
});

for (const target of ANIMALS) {
  test(`sinal de ${target.toUpperCase()}: aceito no vídeo dele, recusado nos outros e nas soletrações`, () => {
    const item = { kind: 'animal', animal: target };
    const own = LIBRAS_VIDEOS[target].sign;
    const at = run(item, segment(target, own.start, own.end));
    assert.ok(at !== null && at < 4, `não reconheceu o próprio sinal (${at})`);
    for (const other of ANIMALS) {
      const v = LIBRAS_VIDEOS[other];
      if (other !== target) assert.equal(run(item, segment(other, v.sign.start, v.sign.end)), null, `aceitou o sinal de ${other}`);
      assert.equal(run(item, segment(other, v.spell[0].start, v.spell.at(-1).end)), null, `aceitou a soletração de ${other}`);
    }
  });
}

test('sem mão na câmera: nada é aceito', () => {
  for (const target of ANIMALS) {
    const r = createRecognizer({ kind: 'animal', animal: target });
    for (let t = 0; t < 5000; t += 80) assert.equal(r.update([], t).event, null);
  }
});

for (const [letter, clip] of Object.entries(VOWEL_CLIPS)) {
  test(`vogal ${letter}: o Fauston fazendo a letra é reconhecido`, () => {
    // a letra fica parada por pouco tempo no vídeo: repete o meio do trecho, onde a mão
    // está parada (como a criança segurando o sinal)
    const d = clip.end - clip.start;
    const a = clip.start + d * 0.2;
    const b = clip.end - d * 0.2;
    const frames = segment(clip.video, a, b);
    const looped = [0, 1, 2, 3].flatMap((k) => frames.map((f) => ({ ...f, t: f.t + k * (b - a + 0.07) })));
    assert.notEqual(run({ kind: 'letra', letter }, looped), null);
  });
}
