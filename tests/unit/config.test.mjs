import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ANIMALS, BOOK, BOOK_PAGES, STAGE } from '../../inclusiapp/src/config.js';
import * as config from '../../inclusiapp/src/config.js';

const app = (p) => new URL(`../../inclusiapp/${p}`, import.meta.url);
const manifest = JSON.parse(readFileSync(app('assets/targets/paginas.json'), 'utf8'));

test('cada alvo do paginas.mind tem uma página configurada, e vice-versa', () => {
  assert.equal(manifest.count, BOOK_PAGES.length);
  const targets = BOOK_PAGES.map((p) => p.target).sort((a, b) => a - b);
  assert.deepEqual(targets, Array.from({ length: manifest.count }, (_, i) => i));
});

test('as 5 páginas do livro: uma por animal, com arquivos que existem (a Aia e o Seu Zé foram arquivados)', () => {
  assert.equal(BOOK_PAGES.length, 5);
  assert.deepEqual(BOOK_PAGES.map((p) => p.bookPage), [13, 15, 17, 19, 21]);
  assert.equal(config.CHARACTERS, undefined);
  for (const p of BOOK_PAGES) {
    assert.ok(existsSync(app(p.thumb)), p.thumb);
    assert.ok(ANIMALS.some((a) => a.id === p.animal.id));
    const [x, y] = p.animal.home;
    assert.ok(Math.abs(x) < 0.5 && Math.abs(y) < 0.7, `página ${p.bookPage}: ponto de partida dentro da página`);
  }
});

test('o arquivo das páginas é o da primeira versão (5 alvos, os mesmos bytes)', () => {
  assert.equal(manifest.count, 5);
  assert.equal(manifest.checksum, '000a1d0f');
  assert.equal(manifest.bytes, 2617580);
  for (const f of ['assets/personagens/aia.vrm', 'assets/personagens/seuze.vrm', 'assets/targets/zoologico.mind']) {
    assert.ok(!existsSync(app(f)), `${f} saiu do app`);
  }
});

test('a página é o validador: o animal segue a página liso e vai para o palco sem a página', () => {
  assert.ok(BOOK.smoothMs > 0 && BOOK.smoothMs <= 120, 'amortecimento curto (sem atraso visível)');
  assert.ok(BOOK.stageAfterMs <= 500 && BOOK.glideMs <= 1000);
  assert.equal(BOOK.lostGraceMs, undefined, 'não some mais sem a página');
  assert.ok(STAGE.elevation > 5 && STAGE.elevation < 60);
});

test('modelos e retratos dos animais existem', () => {
  for (const a of ANIMALS) {
    for (const f of [a.model, a.pageModel, a.portrait].filter(Boolean)) assert.ok(existsSync(app(f)), f);
  }
});
