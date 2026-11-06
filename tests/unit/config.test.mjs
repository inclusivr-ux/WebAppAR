import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ANIMALS, BOOK_PAGES, CHARACTERS } from '../../inclusiapp/src/config.js';

const app = (p) => new URL(`../../inclusiapp/${p}`, import.meta.url);
const manifest = JSON.parse(readFileSync(app('assets/targets/paginas.json'), 'utf8'));

test('cada alvo do paginas.mind tem uma página configurada, e vice-versa', () => {
  assert.equal(manifest.count, BOOK_PAGES.length);
  const targets = BOOK_PAGES.map((p) => p.target).sort((a, b) => a - b);
  assert.deepEqual(targets, Array.from({ length: manifest.count }, (_, i) => i));
});

test('as 5 páginas com animal e as páginas da Aia e do Seu Zé apontam para arquivos que existem', () => {
  assert.equal(BOOK_PAGES.filter((p) => p.animal).length, 5);
  for (const p of BOOK_PAGES) {
    assert.ok(existsSync(app(p.thumb)), p.thumb);
    if (p.animal) assert.ok(ANIMALS.some((a) => a.id === p.animal.id));
    for (const c of p.characters || []) assert.ok(CHARACTERS[c.id]);
    for (const [x, y] of [p.animal?.home, ...(p.characters || []).map((c) => c.home)].filter(Boolean)) {
      assert.ok(Math.abs(x) < 0.5 && Math.abs(y) < 0.7, `página ${p.bookPage}: ponto de partida dentro da página`);
    }
  }
});

test('modelos, retratos e personagens existem', () => {
  for (const a of ANIMALS) {
    for (const f of [a.model, a.pageModel, a.portrait].filter(Boolean)) assert.ok(existsSync(app(f)), f);
  }
  for (const c of Object.values(CHARACTERS)) assert.ok(existsSync(app(c.model)), c.model);
});
