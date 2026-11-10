#!/usr/bin/env node
/**
 * Imagens da tela de instruções do livro (assets/img/instrucoes/):
 *
 *   elefante.webp   o elefante DO APP (assets/models/elefante.glb, traço do
 *                   Igor) jogando água com a tromba, fundo transparente,
 *                   fotografado pelo three.js (tools/render-animal.html)
 *
 * As outras duas vêm do site da InclusiVR (versão com o plugin de LIBRAS):
 *   livro-aberto.webp  a foto do livro aberto (pág. 12–13)
 *   celular.webp       o celular com a câmera aberta na lagoa
 *
 *   node tools/render-instrucoes.mjs     (precisa do Playwright; ver README)
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'inclusiapp/assets/img/instrucoes');
mkdirSync(OUT, { recursive: true });
const server = await startServer({ port: 0, root: ROOT });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 780 } });
const png = join(OUT, 'elefante.png');
await page.goto(`http://127.0.0.1:${server.address().port}/tools/render-animal.html?name=elefante&clip=agua&t=1.6&az=-32&el=12&w=900&h=780&zoom=1.25`);
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.locator('canvas').screenshot({ path: png, omitBackground: true });
await browser.close();
server.close();
// recorta a sobra transparente e grava em WebP (com transparência)
execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open(${JSON.stringify(png)}).convert('RGBA')
im = im.crop(im.getbbox())
im.thumbnail((360, 360), Image.LANCZOS)
im.save(${JSON.stringify(join(OUT, 'elefante.webp'))}, quality=82, method=6)
print('elefante.webp', im.size)
`], { stdio: 'inherit' });
execFileSync('rm', ['-f', png]);
