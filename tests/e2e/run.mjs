#!/usr/bin/env node
/**
 * Testes ponta a ponta no Chromium (Playwright) com câmera falsa.
 *
 *   python3 tests/make_frames.py      # quadros sintéticos (uma vez)
 *   npm run test:e2e                   # todos
 *   npm run test:e2e -- livro          # só uma parte: telas, livro, personagens, cartas, zoo, sinalize, erros, paisagem
 *
 * A câmera falsa (tests/e2e/fakeCamera.js) entrega ao app um MediaStream de
 * verdade com as fotos de teste: o caminho real (câmera → MindAR/MediaPipe →
 * 3D) é exercitado. Capturas de tela em test-results/.
 * CHROMIUM_PATH=/caminho/do/chrome usa um Chromium já instalado.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../tools/serve.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'test-results');
mkdirSync(OUT, { recursive: true });
const FAKE_CAMERA = readFileSync(join(ROOT, 'tests/e2e/fakeCamera.js'), 'utf8');
const only = process.argv[2];

const results = [];
const t0 = Date.now();
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
}

// sem H.264 no Chromium do Playwright: os .webm de teste entram no lugar dos .mp4
const server = await startServer({ port: 0, root: ROOT, overlays: [{ prefix: '/inclusiapp/videos/', dir: 'tests/fixtures/videos' }] });
const { port } = server.address();
const BASE = `http://127.0.0.1:${port}/inclusiapp/?test=1`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined, // ex.: um Chromium já instalado no sistema
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width < 900, hasTouch: true });
  await ctx.addInitScript({ content: FAKE_CAMERA });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) page.errors.push(m.text()); });
  return page;
}

const frame = (set, index, variant = 'frente') => `/tests/fixtures/frames/${set}/${index}_${variant}.jpg`;
const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const go = async (page, route, screen) => {
  await page.goto(`${BASE}#/${route}`);
  await page.waitForSelector(`[data-screen="${screen}"].is-active`);
  await page.waitForTimeout(400);
};
const noErrors = (page, label) => check(`${label}: sem erros no console`, page.errors.length === 0, page.errors.slice(0, 3).join(' | '));

/* ================================================================ telas */
async function testScreens() {
  const page = await newPage();
  await go(page, '', 'menu');
  check('início: LIVRO e JOGOS', (await page.locator('.porta').allTextContents()).map((t) => t.trim()).join('|') === 'LIVRO|JOGOS');
  check('início: sem emoji na interface', !(await page.evaluate(() => /\p{Extended_Pictographic}/u.test(document.body.innerText))));
  check('início: fonte do Signária (Fraunces Soft)', (await page.evaluate(() => getComputedStyle(document.body).fontFamily)).includes('Fraunces'));
  await shot(page, 'menu');

  await go(page, 'livro', 'book-intro');
  check('instruções: o texto de sempre ("Aponte o celular...", "30 cm")', (await page.textContent('.passos')).includes('30 cm de distância'));
  check('instruções: imagem limpa (sem etiquetas por cima)', await page.locator('.intro__arte img[src$="instrucoes-ar.webp"]').count() === 1 &&
    await page.locator('.intro__arte .art-tag').count() === 0);
  const pages = await page.locator('[data-pages] .paginas__item').count();
  check('instruções: mostra as páginas com AR (5 com animal + 4 da Aia e do Seu Zé)', pages === 9, `${pages}`);
  check('instruções: a runa sozinha não tem AR (imagem + aviso)', (await page.textContent('.dupla figcaption')).includes('RUNA SOZINHA'));
  check('instruções: cartas só nos jogos e "em breve" mais páginas', /cartas recortadas[\s\S]*jogos[\s\S]*mais páginas/i.test(await page.textContent('.avisos')));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'livro-instrucoes');

  await go(page, 'sala', 'sala');
  check('jogos: Jogo de Cartas, Zoológico e Sinalize!', (await page.locator('.jogo__titulo').allTextContents()).join('|') === 'JOGO DE CARTAS|ZOOLÓGICO|SINALIZE!');
  await shot(page, 'jogos');
  await go(page, 'cartas', 'game-intro');
  check('cartas: como jogar com 4 passos visuais e a dica das cartas com o sinal para cima', await page.locator('[data-screen="game-intro"] .demo__passo').count() === 4 &&
    (await page.textContent('.intro__dica')).includes('lado do sinal'));
  await go(page, 'sinalize', 'sign-intro');
  const signText = await page.textContent('[data-screen="sign-intro"]');
  check('sinalize: como jogar sem termos técnicos (sem "MediaPipe")', !/mediapipe/i.test(signText) && signText.includes('duas vezes'));

  // endereços antigos continuam funcionando
  await page.goto(`${BASE}#/bichinho`);
  await page.waitForSelector('[data-screen="zoo"].is-active');
  check('endereço antigo #/bichinho leva ao zoológico', true);
  await page.goto(`${BASE}#/jogo`);
  await page.waitForSelector('[data-screen="game-intro"].is-active');
  check('endereço antigo #/jogo leva ao jogo de cartas', true);
  noErrors(page, 'telas');
  await page.context().close();
}

/* ================================================================ livro */
async function openBook(page) {
  await go(page, 'livro', 'book-intro');
  await page.click('[data-action="start-book"]');
  await page.waitForFunction(() => window.__app.book.session?.running, null, { timeout: 120000 });
}

async function testBook() {
  const page = await newPage();
  await openBook(page);
  check('livro: câmera aberta e procurando a página', await page.isVisible('[data-scan]') && await page.evaluate(() => __fakeCam.liveTracks()) > 0);
  check('livro: o Fauston NÃO aparece sozinho (LIBRAS só pelo botão)', await page.isHidden('[data-libras-panel]') && await page.isHidden('[data-action="libras"]'));

  await page.evaluate((u) => __fakeCam.show(u), frame('paginas', 1));
  await page.waitForFunction(() => {
    const b = window.__app.book;
    return (b.ready.get(1) || [])[0]?.state === 'living';
  }, null, { timeout: 60000 });
  const info = await page.evaluate(() => {
    const a = window.__app.book.ready.get(1)[0];
    return { name: a.model.animal.name, clips: [...a.model.clips.keys()].sort().join(','), chip: document.querySelector('[data-chip-name]').textContent };
  });
  check('livro: a página 17 traz o elefante (modelo novo, com as animações gravadas)', info.name === 'Elefante' && info.clips === 'agua,andar,feliz,parado' && info.chip === 'Elefante', JSON.stringify(info));
  check('livro: um modo só (sem "Modo Página" / "Interagir")', await page.locator('[data-action="mode-page"], [data-action="mode-interact"]').count() === 0);
  await page.waitForTimeout(3500);
  const walk = await page.evaluate(() => {
    const a = window.__app.book.ready.get(1)[0];
    const b = a.bounds;
    return { inside: a.wander.pos[0] >= b.minX && a.wander.pos[0] <= b.maxX && a.wander.pos[1] >= b.minY && a.wander.pos[1] <= b.maxY, pos: a.wander.pos };
  });
  check('livro: o animal passeia dentro da página', walk.inside, JSON.stringify(walk.pos));
  check('livro: dica "TOQUE NO ELEFANTE"', (await page.textContent('[data-tap-hint-text]')) === 'TOQUE NO ELEFANTE');
  await shot(page, 'livro-ar-elefante');

  // carinho
  const pt = await page.evaluate(() => {
    const b = window.__app.book;
    const a = b.ready.get(1)[0];
    const p = a.screenPoint(b.session.camera, b.session.viewport);
    a.model.body.updateWorldMatrix(true, true);
    return { x: p.x, y: p.y + 60 };
  });
  await page.touchscreen.tap(pt.x, pt.y);
  await page.waitForTimeout(300);
  const tap = await page.evaluate(() => window.__app.book.ready.get(1)[0].taps);
  check('livro: tocar no animal = carinho (ele para e fica feliz)', tap === 1, `toques: ${tap}`);

  // LIBRAS
  check('livro: botão LIBRAS na página do animal', await page.isVisible('[data-action="libras"]'));
  await page.click('[data-action="libras"]');
  check('livro: LIBRAS abre com duas escolhas e sem tocar nada', await page.isVisible('[data-libras-mode="sign"]') && await page.isVisible('[data-libras-mode="spell"]') &&
    await page.evaluate(() => window.__app.book.libras.video.paused));
  await page.click('[data-libras-mode="spell"]');
  await page.waitForTimeout(2600);
  const karaoke = await page.evaluate(() => [...document.querySelectorAll('[data-libras-letters] li')].map((l) => (l.classList.contains('is-atual') ? '*' : l.classList.contains('is-feita') ? '+' : '.')).join(''));
  check('livro: SOLETRAR mostra E-L-E-F-A-N-T-E com a letra da vez em destaque', /^\+*\*\.*$/.test(karaoke) && karaoke.length === 8 && karaoke.includes('+'), karaoke);
  await shot(page, 'livro-libras-soletrar');
  await page.click('[data-libras-mode="sign"]');
  await page.waitForTimeout(1200);
  const t = await page.evaluate(() => window.__app.book.libras.currentTime);
  check('livro: SINAL DO ANIMAL toca o trecho do sinal (depois da soletração)', t >= 7.2, `t=${t.toFixed(2)}`);
  await page.click('[data-libras-close]');
  check('livro: fechar o LIBRAS para o vídeo', await page.isHidden('[data-libras-panel]') && await page.evaluate(() => window.__app.book.libras.video.paused));

  // a página some
  await page.evaluate(() => __fakeCam.clear());
  await page.waitForFunction(() => window.__app.book.ready.get(1)[0].state === 'lost', null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  const lost = await page.evaluate(() => {
    const a = window.__app.book.ready.get(1)[0];
    return { op: a.model.opacity, bubble: document.querySelector('[data-bubble-text]').textContent, visible: !document.querySelector('[data-bubble]').hidden };
  });
  check('livro: sem a página, pisca, fica transparente e pede "QUERO VOLTAR PARA MINHA PÁGINA!"', lost.op < 0.95 && lost.visible && lost.bubble === 'QUERO VOLTAR PARA MINHA PÁGINA!', JSON.stringify(lost));
  await shot(page, 'livro-quero-voltar');
  await page.evaluate((u) => __fakeCam.show(u), frame('paginas', 1, 'inclinada'));
  await page.waitForFunction(() => window.__app.book.ready.get(1)[0].state === 'living', null, { timeout: 20000 }).catch(() => {});
  check('livro: a página volta a tempo e o animal se anima de novo', await page.evaluate(() => window.__app.book.ready.get(1)[0].state === 'living' && window.__app.book.ready.get(1)[0].model.opacity === 1));

  // outra página, outro animal
  await page.evaluate((u) => __fakeCam.show(u), frame('paginas', 4));
  await page.waitForFunction(() => (window.__app.book.ready.get(4) || [])[0]?.state === 'living', null, { timeout: 60000 });
  check('livro: a página 23 traz o urso', await page.evaluate(() => window.__app.book.ready.get(4)[0].model.animal.id === 'urso'));

  await go(page, '', 'menu');
  await page.waitForFunction(() => __fakeCam.liveTracks() === 0, null, { timeout: 8000 }).catch(() => {});
  check('livro: câmera desligada ao sair', await page.evaluate(() => __fakeCam.liveTracks()) === 0);
  noErrors(page, 'livro');
  await page.context().close();
}

async function testCharacters() {
  const page = await newPage();
  await openBook(page);
  await page.evaluate((u) => __fakeCam.show(u), frame('paginas', 6));
  await page.waitForFunction(() => (window.__app.book.ready.get(6) || []).every((a) => a.state === 'living') && (window.__app.book.ready.get(6) || []).length === 2, null, { timeout: 120000 });
  const who = await page.evaluate(() => window.__app.book.ready.get(6).map((a) => a.model.character?.id).join(','));
  check('personagens: a página 13 traz o Seu Zé e a Maga Aia (VRM)', who === 'seuze,aia', who);
  check('personagens: sem botão LIBRAS (só nas páginas com animal)', await page.isHidden('[data-action="libras"]'));
  const tapped = await page.evaluate(() => {
    const a = window.__app.book.ready.get(6)[0];
    return a.tap(a.cameraInPage());
  });
  check('personagens: tocar = olá (aceno)', tapped === 'ola', tapped);
  await page.waitForTimeout(800);
  await shot(page, 'livro-aia-seu-ze');
  noErrors(page, 'personagens');
  await page.context().close();
}

/* ================================================================ jogo de cartas */
async function testCards() {
  const page = await newPage();
  await go(page, 'cartas', 'game-intro');
  await page.click('[data-action="start-game"]');
  await page.waitForFunction(() => window.__app.game.engine?.phase === 'searching', null, { timeout: 120000 });
  const pair = await page.evaluate(() => window.__app.game.engine.pair);
  check('cartas: mostra o animal ou a letra e pede o SINAL', (await page.textContent('.alvo__pedido')).includes('ACHE O SINAL') &&
    (await page.getAttribute('[data-target-img]', 'src')) === pair.image, pair.label);
  await page.evaluate((i) => __fakeCam.show(i), frame('cartas', pair.show - 1));
  await page.waitForFunction(() => window.__app.game.engine.stats.flips === 1, null, { timeout: 15000 }).catch(() => {});
  check('cartas: a mesma imagem da tela NÃO vale; pede para virar a carta', await page.evaluate(() => window.__app.game.engine.stats.hits === 0 && window.__app.game.engine.stats.flips === 1));
  const other = await page.evaluate((id) => window.__app.game.engine.pairs.get([...window.__app.game.engine.pairs.keys()].find((k) => k !== id)).answer, pair.id);
  await page.evaluate((i) => __fakeCam.show(i), frame('cartas', other - 1));
  await page.waitForFunction(() => window.__app.game.engine.stats.errors === 1, null, { timeout: 15000 }).catch(() => {});
  check('cartas: sinal de outro par = "QUASE!", sem perder pontos', await page.evaluate(() => window.__app.game.engine.stats.errors === 1 && window.__app.game.engine.stats.score === 0));
  await page.evaluate((i) => __fakeCam.show(i), frame('cartas', pair.answer - 1));
  await page.waitForFunction(() => window.__app.game.engine.stats.hits === 1, null, { timeout: 15000 });
  check('cartas: o sinal em LIBRAS do par = "ISSO!" + pontos', (await page.textContent('[data-feedback]')).includes('ISSO!') && await page.evaluate(() => window.__app.game.engine.stats.score > 100));
  await shot(page, 'cartas-acerto');
  await page.waitForFunction(() => window.__app.game.engine.round === 2 && window.__app.game.engine.phase === 'searching', null, { timeout: 10000 });
  check('cartas: próximo desafio sem embaralhar de novo', await page.isHidden('[data-reveal]'));
  const seed = await page.evaluate(() => window.__app.game.engine.seed);
  // termina a partida pulando
  for (let i = 0; i < 9; i++) {
    await page.click('[data-action="skip"]');
    await page.waitForTimeout(350);
  }
  await page.waitForSelector('[data-summary]:not([hidden])', { timeout: 20000 });
  check('cartas: fim da partida com estrelas, acertos e pontos', (await page.textContent('[data-sum="hits"]')) === '1/10' && await page.locator('[data-sum-stars] .ico').count() === 3);
  await shot(page, 'cartas-fim');
  await page.click('[data-action="new-deck"]');
  await page.waitForFunction(() => window.__app.game.engine.phase === 'searching', null, { timeout: 15000 });
  check('cartas: jogar de novo = nova semente (nova ordem)', await page.evaluate((s) => window.__app.game.engine.seed !== s, seed));
  await go(page, 'sala', 'sala');
  await page.waitForFunction(() => __fakeCam.liveTracks() === 0, null, { timeout: 8000 }).catch(() => {});
  check('cartas: câmera desligada ao sair', await page.evaluate(() => __fakeCam.liveTracks()) === 0);
  noErrors(page, 'cartas');
  await page.context().close();
}

/* ================================================================ zoológico */
async function testZoo() {
  const page = await newPage();
  await go(page, 'zoo', 'zoo');
  check('zoo: ajuda visual na primeira vez', await page.isVisible('[data-zoo-help-box]'));
  await page.click('[data-action="zoo-help-close"]');
  check('zoo: só animais do livro e runas das vogais na bandeja', await page.locator('[data-zoo-animals] .zoo__item').count() === 5 && await page.locator('[data-zoo-runes] .zoo__item').count() === 5);
  await page.click('[aria-label="Colocar Urso"]');
  await page.click('[aria-label="Colocar Abelha"]');
  await page.waitForFunction(() => window.__app.zoo.scene.entities.size === 2, null, { timeout: 30000 });
  const events = await page.evaluate(async () => {
    const z = window.__app.zoo;
    const items = [...z.state.items.values()];
    const urso = items.find((i) => i.type === 'urso');
    const abelha = items.find((i) => i.type === 'abelha');
    urso.need = 'fome';
    // os dois podem ter nascido perto e já brincado: zera o intervalo do par
    z.state.pairCooldowns.clear();
    urso.busy = 0;
    abelha.busy = 0;
    const b = z.state.bounds;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    for (const [it, dx] of [[urso, -0.2], [abelha, 0.2]]) {
      z.state.move(it.id, cx + dx, cy);
      z.scene.entities.get(it.id).walker.pos = [cx + dx, cy];
      z.scene.entities.get(it.id).walker.hold(5);
    }
    const seen = [];
    const orig = z._events.bind(z);
    z._events = (evs) => { evs.forEach((e) => seen.push(e.type === 'meet' ? `meet:${e.rule.a}+${e.rule.b}` : e.type)); orig(evs); };
    await new Promise((r) => setTimeout(r, 2500));
    return seen;
  });
  check('zoo: o urso com fome encontra a abelha e come mel', events.includes('meet:urso+abelha'), events.join(','));
  await shot(page, 'zoo');
  // tirar: arrastar até a lixeira
  const ids = await page.evaluate(() => [...window.__app.zoo.state.items.keys()]);
  await page.evaluate((id) => window.__app.zoo.remove(id), ids[0]);
  check('zoo: tirar um animal', await page.evaluate(() => window.__app.zoo.state.count) === 1);
  await page.reload();
  await page.waitForSelector('[data-screen="zoo"].is-active');
  await page.waitForFunction(() => window.__app.zoo.state?.count === 1, null, { timeout: 30000 }).catch(() => {});
  check('zoo: o zoológico fica salvo no aparelho', await page.evaluate(() => window.__app.zoo.state.count) === 1);
  noErrors(page, 'zoo');
  await page.context().close();
}

/* ================================================================ Sinalize */
async function testSign() {
  const page = await newPage();
  await go(page, 'sinalize', 'sign-intro');
  await page.click('[data-action="start-sign"]');
  await page.waitForFunction(() => window.__app.sign.match?.phase === 'watch', null, { timeout: 180000 });
  const facing = await page.evaluate(() => window.__app.sign.facing);
  check('sinalize: câmera frontal por padrão (espelhada)', facing === 'user' && await page.evaluate(() => document.querySelector('[data-cam-video]').classList.contains('is-espelho')));
  check('sinalize: sem esqueleto da mão na tela', await page.locator('[data-screen="sign-game"] canvas.sg-hands, [data-hands]').count() === 0);
  // a primeira rodada vira a letra A (a mão 3D de teste faz as vogais)
  await page.evaluate(() => {
    const s = window.__app.sign;
    const m = s.match;
    const i = m.order.indexOf('A');
    [m.order[m.index], m.order[i]] = [m.order[i], m.order[m.index]];
    m.round.item = m.items.get('A');
    s._showItem(m.round.item);
  });
  await page.waitForFunction(() => document.querySelector('[data-step-text]').textContent.includes('OLHE'), null, { timeout: 10000 }).catch(() => {});
  check('sinalize: o Fauston mostra o sinal (OLHE)', (await page.textContent('[data-step-text]')).includes('OLHE'));
  await page.waitForFunction(() => window.__app.sign.match.phase === 'try', null, { timeout: 60000 });
  check('sinalize: depois de olhar, "SUA VEZ!"', (await page.textContent('[data-step-text]')).includes('SUA VEZ'));
  await page.evaluate(() => __fakeCam.show('/tests/fixtures/hands/A.jpg'));
  await page.waitForFunction(() => window.__app.sign.match.stats.signsCorrect === 1, null, { timeout: 30000 }).catch(() => {});
  check('sinalize: a câmera reconhece o sinal e dá pontos', await page.evaluate(() => window.__app.sign.match.stats.score) > 100);
  await shot(page, 'sinalize-acerto');
  // sem câmera: ERREI · ACERTEI
  await page.waitForFunction(() => window.__app.sign.match.phase === 'watch', null, { timeout: 15000 });
  await page.click('[data-action="no-camera"]');
  await page.waitForFunction(() => window.__app.sign.match.phase === 'try', null, { timeout: 90000 });
  check('sinalize: SEM CÂMERA mostra ERREI e ACERTEI e desliga a câmera', await page.isVisible('[data-action="self-right"]') && await page.evaluate(() => __fakeCam.liveTracks()) === 0);
  await page.click('[data-action="self-right"]');
  await page.waitForFunction(() => window.__app.sign.match.stats.signsCorrect === 2, null, { timeout: 10000 });
  check('sinalize: ACERTEI conta o sinal', true);
  await go(page, 'sala', 'sala');
  check('sinalize: sair desliga a câmera', await page.evaluate(() => __fakeCam.liveTracks()) === 0);
  noErrors(page, 'sinalize');
  await page.context().close();
}

/* ================================================================ erros e paisagem */
async function testErrors() {
  const page = await newPage();
  await go(page, 'livro', 'book-intro');
  for (const [mode, text] of [['denied', 'Precisamos acessar sua câmera'], ['notfound', 'Não encontramos uma câmera'], ['busy', 'A câmera está ocupada']]) {
    await page.evaluate((m) => { __fakeCam.mode = m; }, mode);
    if (await page.isVisible('[data-retry]')) await page.click('[data-retry]');
    else await page.click('[data-action="start-book"]');
    await page.waitForSelector('.ar-error', { timeout: 30000 });
    const msg = await page.textContent('.ar-error h2');
    check(`erro de câmera "${mode}": mensagem amigável`, msg.includes(text), msg);
  }
  await page.evaluate(() => { __fakeCam.mode = 'ok'; });
  await page.click('[data-retry]');
  await page.waitForFunction(() => window.__app.book.session?.running, null, { timeout: 120000 }).catch(() => {});
  check('erro de câmera: "Tentar de novo" recupera', await page.evaluate(() => !!window.__app.book.session?.running));
  await page.context().close();
}

async function testLandscape() {
  for (const [name, vp] of [['paisagem', { width: 844, height: 390 }], ['tablet', { width: 1024, height: 768 }], ['desktop', { width: 1440, height: 900 }]]) {
    const page = await newPage(vp);
    await go(page, '', 'menu');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(`${name}: sem rolagem horizontal no início`, !overflow);
    await shot(page, `menu-${name}`);
    await page.context().close();
  }
}

try {
  if (!only || only === 'telas') await testScreens();
  if (!only || only === 'livro') await testBook();
  if (!only || only === 'personagens') await testCharacters();
  if (!only || only === 'cartas') await testCards();
  if (!only || only === 'zoo') await testZoo();
  if (!only || only === 'sinalize') await testSign();
  if (!only || only === 'erros') await testErrors();
  if (!only || only === 'paisagem') await testLandscape();
} catch (err) {
  check('execução sem exceções', false, err.stack);
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações ok em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
process.exit(failed.length ? 1 : 0);
