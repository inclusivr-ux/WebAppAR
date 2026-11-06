#!/usr/bin/env node
/**
 * Mede os vídeos de LIBRAS (o Fauston soletrando e fazendo o sinal) para
 * achar onde começa e termina cada letra e o sinal.
 *
 *   node tools/medir-libras.mjs [abelha elefante ...] [--fps 15] [--saida pasta]
 *
 * 1. o ffmpeg tira os quadros do .mp4 (15 por segundo);
 * 2. o reconhecimento de mãos do app (MediaPipe) acha a mão em cada quadro;
 * 3. sai um .json por vídeo com os pontos da mão, as notas das vogais e o
 *    quanto a mão se mexeu de um quadro para o outro.
 *
 * Os tempos que o app usa ficam em inclusiapp/src/libras/librasVideos.js e
 * foram escolhidos a partir destas medidas e conferidos quadro a quadro.
 * Vídeo novo? Rode esta ferramenta e use o resultado para preencher a
 * entrada dele (a soletração: uma letra por pausa da mão).
 *
 * Precisa do ffmpeg instalado e do Playwright (npm install).
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
};
const fps = +opt('fps', 15);
const outDir = opt('saida', join(ROOT, 'test-results', 'libras'));
const names = args.length ? args : ['abelha', 'elefante', 'iguana', 'onca', 'urso'];
mkdirSync(outDir, { recursive: true });

const server = await startServer({ port: 0, root: ROOT });
const { port } = server.address();
// CHROMIUM_PATH: usar um Chromium já instalado (ex.: /opt/pw-browsers/chromium/chrome-linux64/chrome)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/tools/medir-libras.html`);
await page.waitForFunction(() => window.__pronto === true, null, { timeout: 120000 });

/** Quanto a mão principal se mexeu entre dois quadros (pontos da imagem, ÷ tamanho da mão). */
function motion(a, b) {
  if (!a?.hands.length || !b?.hands.length) return null;
  const pick = (f) => f.hands.reduce((best, h) => (h.points[0][1] < best.points[0][1] ? h : best));
  const pa = pick(a).points;
  const pb = pick(b).points;
  const size = Math.hypot(pa[0][0] - pa[9][0], pa[0][1] - pa[9][1]) || 1;
  let sum = 0;
  for (const k of [4, 8, 12, 16, 20, 0]) sum += Math.hypot(pa[k][0] - pb[k][0], pa[k][1] - pb[k][1]);
  return +(sum / 6 / size).toFixed(3);
}

for (const name of names) {
  const tmp = join(outDir, `_${name}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-i', join(ROOT, 'inclusiapp/videos', `${name}.mp4`), '-vf', `fps=${fps}`, '-q:v', '3', join(tmp, 'q%04d.jpg')]);
  const files = readdirSync(tmp).filter((f) => f.endsWith('.jpg')).sort();
  const frames = files.map((f, i) => ({ t: +(i / fps).toFixed(3), src: `/${relative(ROOT, tmp).split(sep).join('/')}/${f}` }));
  const result = await page.evaluate((list) => window.__medir(list), frames);
  result.forEach((f, i) => { f.motion = motion(result[i - 1], f); });
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify({ video: `videos/${name}.mp4`, fps, frames: result }));
  const line = result.map((f) => (f.hands.length ? (f.hands[0].vowel || (f.hands.length > 1 ? '2' : '·')) : ' ')).join('');
  console.log(`${name.padEnd(9)} ${line}`);
  rmSync(tmp, { recursive: true, force: true });
}
await browser.close();
server.close();
console.log(`\nMedidas em ${outDir}`);
