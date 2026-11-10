/**
 * Reconhecedor do Sinalize! conferido nos VÍDEOS DO INTÉRPRETE: os pontos da
 * mão de cada quadro (medidos com tools/medir-libras.mjs e guardados em
 * tests/fixtures/libras/medidas.json.gz) passam pelo reconhecedor como se
 * fossem a câmera. Cada vogal precisa ser aceita na primeira letra da
 * soletração do seu animal, e o trecho que o jogo mostra precisa acabar antes
 * da letra seguinte.
 *
 * Limite: é uma pessoa só. Crianças precisam ser testadas no aparelho.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createRecognizer } from '../../inclusiapp/src/sign/signRecognizers.js';
import { classifyHand } from '../../inclusiapp/src/sign/handSigns.js';
import { LIBRAS_VIDEOS, VOWEL_CLIPS } from '../../inclusiapp/src/libras/librasVideos.js';
import { SIGN_GAME } from '../../inclusiapp/src/sign/signConfig.js';

const data = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/libras/medidas.json.gz', import.meta.url))).toString());

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

test('sem mão na câmera: nada é aceito', () => {
  for (const letter of Object.keys(VOWEL_CLIPS)) {
    const r = createRecognizer({ kind: 'letra', letter }, SIGN_GAME.recognition);
    for (let t = 0; t < 5000; t += 80) assert.equal(r.update([], t).event, null);
  }
});

test('o jogo só sorteia vogais (os sinais com movimento saíram)', () => {
  assert.deepEqual(SIGN_GAME.items.map((i) => i.letter), ['A', 'E', 'I', 'O', 'U']);
  assert.throws(() => createRecognizer({ kind: 'animal', id: 'urso' }));
});

for (const [letter, clip] of Object.entries(VOWEL_CLIPS)) {
  const spell = LIBRAS_VIDEOS[clip.video].spell;

  test(`vogal ${letter}: o trecho mostrado acaba antes da letra seguinte`, () => {
    assert.equal(spell[0].letter, letter);
    assert.ok(clip.start < spell[0].start + 0.2, 'começa com a mão chegando na vogal');
    // spell[0].end é o meio da passagem para a próxima letra
    assert.ok(clip.end < spell[0].end, `${clip.end} passa da vogal (${spell[0].end})`);
    assert.ok(clip.end - clip.start > 0.5, 'trecho curto demais');
  });

  test(`vogal ${letter}: o intérprete fazendo a letra é reconhecido`, () => {
    // a letra fica parada por pouco tempo no vídeo: repete o meio do trecho, onde a mão
    // está parada (como a criança segurando o sinal)
    const d = spell[0].end - spell[0].start;
    const a = spell[0].start + d * 0.2;
    const b = spell[0].end - d * 0.2;
    const frames = segment(clip.video, a, b);
    const looped = [0, 1, 2, 3].flatMap((k) => frames.map((f) => ({ ...f, t: f.t + k * (b - a + 0.07) })));
    assert.notEqual(run({ kind: 'letra', letter }, looped), null);
  });
}
