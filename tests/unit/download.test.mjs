/**
 * O baixador com progresso (inclusiapp/src/lib/download.js).
 *
 * O GitHub Pages entrega .glb, .vrm, .mind e .json comprimidos (gzip): o
 * Content-Length é o tamanho COMPRIMIDO, e o corpo chega descomprimido, maior.
 * Na versão 2.1.0 o baixador reservava só o tamanho comprimido e desistia:
 * nenhum animal nem personagem aparecia ("Não foi possível carregar esta
 * página"). Estes testes imitam essa resposta.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { download, progressOf } from '../../inclusiapp/src/lib/download.js';

/** Resposta em pedaços, com os cabeçalhos que o servidor mandaria. */
function respond(bytes, headers, chunk = 1000) {
  const stream = new ReadableStream({
    start(c) {
      for (let i = 0; i < bytes.length; i += chunk) c.enqueue(bytes.slice(i, i + chunk));
      c.close();
    },
  });
  return new Response(stream, { status: 200, headers });
}

test('com gzip (Content-Length menor que o arquivo): baixa o arquivo inteiro', async () => {
  const real = new Uint8Array(97020).map((_, i) => i % 251); // a abelha: 97.020 bytes
  globalThis.fetch = async () => respond(real, { 'content-length': '65786', 'content-encoding': 'gzip' });
  const buf = await download('teste/abelha.glb');
  assert.equal(buf.byteLength, 97020);
  assert.deepEqual(new Uint8Array(buf).slice(0, 5), real.slice(0, 5));
  assert.equal(progressOf('teste/abelha.glb'), 1);
});

test('sem compressão: baixa igual e a barra chega a 100%', async () => {
  const real = new Uint8Array(5000).fill(7);
  globalThis.fetch = async () => respond(real, { 'content-length': '5000' });
  const buf = await download('teste/urso.glb');
  assert.equal(buf.byteLength, 5000);
  assert.equal(progressOf(['teste/urso.glb', 'teste/abelha.glb']), 1);
});

test('enquanto baixa, a barra nunca passa de 97% (a estimativa com gzip pode errar)', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const real = new Uint8Array(30000).fill(1);
  globalThis.fetch = async () => new Response(new ReadableStream({
    async start(c) {
      c.enqueue(real.slice(0, 25000)); // já passou do tamanho "comprimido" informado
      await gate;
      c.enqueue(real.slice(25000));
      c.close();
    },
  }), { headers: { 'content-length': '12000', 'content-encoding': 'gzip' } });
  const p = download('teste/aia.vrm');
  await new Promise((r) => setTimeout(r, 20));
  const meio = progressOf('teste/aia.vrm');
  assert.ok(meio > 0.5 && meio <= 0.97, `${meio}`);
  release();
  assert.equal((await p).byteLength, 30000);
});

test('erro do servidor: falha, e uma nova tentativa baixa de novo', async () => {
  globalThis.fetch = async () => new Response('não achei', { status: 404 });
  await assert.rejects(download('teste/onca.glb'));
  globalThis.fetch = async () => respond(new Uint8Array(10), { 'content-length': '10' });
  assert.equal((await download('teste/onca.glb')).byteLength, 10);
});
