import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIBRAS_VIDEOS, VOWEL_CLIPS, letterAt, segmentOf } from '../../inclusiapp/src/libras/librasVideos.js';
import { ANIMALS } from '../../inclusiapp/src/config.js';

const DURATION = { abelha: 10.71, elefante: 14.35, iguana: 17.95, onca: 18.28, urso: 9.94 }; // ffprobe dos .mp4

test('cada animal tem vídeo, soletração com as letras do nome e o sinal depois', () => {
  for (const a of ANIMALS) {
    const v = LIBRAS_VIDEOS[a.id];
    assert.ok(v, a.id);
    assert.equal(v.spell.map((s) => s.letter).join(''), v.word);
    for (let i = 0; i < v.spell.length; i++) {
      const s = v.spell[i];
      assert.ok(s.end > s.start, `${a.id}: letra ${i}`);
      if (i) assert.equal(s.start, v.spell[i - 1].end, `${a.id}: letras seguidas, sem buraco`);
    }
    assert.ok(v.sign.start >= v.spell.at(-1).end, `${a.id}: o sinal vem depois da soletração`);
    assert.ok(v.sign.end <= DURATION[a.id] + 0.01, `${a.id}: dentro do vídeo`);
    assert.ok(v.signTwice.start >= v.sign.start && v.signTwice.end <= v.sign.end);
  }
});

test('karaokê: a letra da vez em cada instante', () => {
  const spell = LIBRAS_VIDEOS.urso.spell; // U R S O
  assert.equal(letterAt(spell, 0.2), -1);
  assert.equal(letterAt(spell, 1.0), 0);
  assert.equal(letterAt(spell, 2.0), 1);
  assert.equal(letterAt(spell, 2.5), 2);
  assert.equal(letterAt(spell, 3.5), 3);
  assert.equal(letterAt(spell, 9), 3);
});

test('as vogais sozinhas são a primeira letra de cada animal (A de ABELHA...)', () => {
  for (const [letter, clip] of Object.entries(VOWEL_CLIPS)) {
    const v = LIBRAS_VIDEOS[clip.video];
    assert.equal(v.word[0], letter);
    assert.equal(clip.start, v.spell[0].start);
  }
  const seg = segmentOf(LIBRAS_VIDEOS.abelha, 'spell');
  assert.deepEqual(seg, { start: 0.4, end: 5.25 });
});
