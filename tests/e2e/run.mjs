#!/usr/bin/env node
/**
 * Testes ponta a ponta no Chromium (Playwright) com câmera falsa.
 *
 *   python3 tests/make_frames.py      # quadros sintéticos (uma vez)
 *   npm run test:e2e                   # todos
 *   npm run test:e2e -- livro          # só uma parte: telas, livro, cartas, zoo, sinalize, erros, paisagem
 *
 * A câmera falsa (tests/e2e/fakeCamera.js) entrega ao app um MediaStream de
 * verdade com as fotos de teste: o caminho real (câmera → MindAR/MediaPipe →
 * 3D) é exercitado. Capturas de tela em test-results/.
 * CHROMIUM_PATH=/caminho/do/chrome usa um Chromium já instalado.
 * ZOO_TELA=844x390 roda o zoológico em outro tamanho de tela (padrão: 390x844).
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
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  // um arquivo que falta aparece com o endereço (e não só "Failed to load resource")
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) page.errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });
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
  check('início: a cena do livro com todos no zoológico (desenho, não 3D) e o logo por cima', await page.locator('.menu__janela img[src$="abertura-zoologico.webp"]').count() === 1 &&
    await page.locator('.menu__aia').count() === 0);
  const linhas = await page.evaluate(() => {
    const a = document.querySelector('[data-link="store"]');
    return { cabe: a.scrollWidth <= a.clientWidth + 1, alto: a.getBoundingClientRect().height };
  });
  check('início: "NÃO TEM O LIVRO?" numa linha só', linhas.cabe && linhas.alto < 52, JSON.stringify(linhas));
  check('início: botão TELA CHEIA (o Chrome deixa)', await page.isVisible('[data-action="fullscreen"]'));
  await page.waitForSelector('[data-action="music"]', { state: 'visible', timeout: 5000 }).catch(() => {});
  check('início: a trilha está no app e o botão MÚSICA aparece', await page.isVisible('[data-action="music"]'));
  const trilha = await page.evaluate(async () => {
    const { arquivo } = await (await fetch('assets/musica/musica.json')).json();
    const audio = new Audio(`assets/musica/${arquivo}`);
    audio.preload = 'metadata';
    await new Promise((ok, falha) => { audio.onloadedmetadata = ok; audio.onerror = falha; setTimeout(falha, 8000); }).catch(() => {});
    return { arquivo, segundos: Math.round(audio.duration || 0) };
  });
  check('início: a trilha é um MP3 que toca (oogway-morrendo.mp3, 5 min 55 s)', /^[a-z0-9-]+\.mp3$/.test(trilha.arquivo) && trilha.segundos > 300, JSON.stringify(trilha));
  await shot(page, 'menu');
  await page.locator('[data-action="fullscreen"]').click();
  await page.waitForFunction(() => !!document.fullscreenElement && document.querySelector('[data-action="fullscreen"]').getAttribute('aria-label').includes('Sair'), null, { timeout: 5000 }).catch(() => {});
  const tela = await page.evaluate(() => {
    const b = document.querySelector('[data-action="fullscreen"]');
    return { cheia: !!document.fullscreenElement, nome: b.getAttribute('aria-label'), icone: b.querySelector('use').getAttribute('href') };
  });
  check('início: TELA CHEIA liga a tela cheia (o ícone e o nome viram "Sair da tela cheia")', tela.cheia && tela.nome === 'Sair da tela cheia' && tela.icone === '#i-tela-normal', JSON.stringify(tela));
  await page.click('[data-action="fullscreen"]');
  await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5000 }).catch(() => {});

  await go(page, 'livro', 'book-intro');
  check('instruções: o texto de sempre ("Aponte o celular...", "30 cm")', (await page.textContent('.passos')).includes('30 cm de distância'));
  const salto = await page.evaluate(() => ({
    fotos: [...document.querySelectorAll('.salto img')].map((i) => i.getAttribute('src').split('/').pop()).join(','),
    carregadas: [...document.querySelectorAll('.salto img')].every((i) => i.complete && i.naturalWidth > 0),
    medida: document.querySelector('.salto__medida')?.textContent,
    pessoa: !!document.querySelector('.esquema'),
  }));
  check('instruções: fotos do livro aberto e do celular, e o elefante do app saltando (sem pessoa desenhada)', salto.fotos === 'livro-aberto.webp,celular.webp,elefante.webp' &&
    salto.carregadas && salto.medida.includes('30 cm') && !salto.pessoa, JSON.stringify(salto));
  check('instruções: o palco de brincar está explicado', (await page.textContent('.passos')).includes('continua na tela'));
  const pages = await page.locator('[data-pages] .paginas__item').count();
  check('instruções: só as 5 páginas dos animais (a Aia e o Seu Zé foram arquivados)', pages === 5, `${pages}`);
  const numeros = await page.locator('[data-pages] .paginas__selo').allTextContents();
  check('instruções: os números do livro impresso (13 a 21)', numeros.join(',') === '13,15,17,19,21', numeros.join(','));
  check('instruções: nenhuma menção à Aia ou ao Seu Zé', !/aia\b|seu zé/i.test(await page.textContent('[data-screen="book-intro"]')));
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
  check('sinalize: resumo descritivo (VEJA A VOGAL, OLHE O INTÉRPRETE...)', (await page.locator('[data-screen="sign-intro"] .demo__rotulo').allTextContents()).map((t) => t.trim()).join('|') === 'VEJA A VOGAL|OLHE O INTÉRPRETE|FAÇA NA CÂMERA|ISSO!');
  check('sinalize: sem pontos e sem pressa ("com calma", "não tem tempo")', !/pontos|rápido|recorde/i.test(signText) && /com calma/i.test(signText) && /não tem tempo/i.test(signText));
  check('sinalize: sem ERREI/ACERTEI; deixa claro que não gravamos imagens', !/ERREI|ACERTEI/.test(signText) && signText.includes('Não gravamos suas imagens em nenhum momento'));
  await go(page, 'zoo', 'zoo-intro');
  const zooText = await page.textContent('[data-screen="zoo-intro"]');
  check('zoo: como brincar só com as cartas (sem a página 22), em qualquer posição', !/página 22/i.test(zooText) && /qualquer posição/i.test(zooText) && !/lixeira|aia|seu zé/i.test(zooText));
  // nomes da equipe não aparecem no app (só a função: "intérprete")
  const todo = await page.evaluate(() => document.body.innerHTML + document.querySelector('meta[name="description"]').content);
  check('nenhum nome da equipe no app (o intérprete aparece pela função)', !/fauston|igor|luciano|luigi/i.test(todo));
  check('nenhum botão ou imagem da Aia e do Seu Zé', !/aia-rosto|seuze|data-zoo-call|\.vrm/i.test(todo));

  // endereços antigos continuam funcionando
  await page.goto(`${BASE}#/bichinho`);
  await page.waitForSelector('[data-screen="zoo-intro"].is-active');
  check('endereço antigo #/bichinho leva ao zoológico', true);
  await page.goto(`${BASE}#/jogo`);
  await page.waitForSelector('[data-screen="game-intro"].is-active');
  check('endereço antigo #/jogo leva ao jogo de cartas', true);
  noErrors(page, 'telas');
  await page.context().close();

  // a tela inicial cabe inteira, sem rolar, e a marca da InclusiVR fica à vista
  for (const [w, h] of [[360, 640], [375, 667], [390, 844], [412, 915], [768, 1024], [844, 390]]) {
    const p = await newPage({ width: w, height: h });
    await go(p, '', 'menu');
    await p.waitForSelector('[data-action="music"]', { state: 'visible', timeout: 5000 }).catch(() => {});
    const fit = await p.evaluate(() => {
      const scr = document.querySelector('[data-screen="menu"]');
      const marca = document.querySelector('.menu__assinatura img').getBoundingClientRect();
      const links = document.querySelector('.menu__links').getBoundingClientRect();
      const janela = document.querySelector('.menu__janela').getBoundingClientRect();
      // MÚSICA e TELA CHEIA: na linha da marca, dentro da tela e fora da ilustração
      const botoes = ['music', 'fullscreen'].map((a) => {
        const b = document.querySelector(`[data-action="${a}"]`);
        const r = b.getBoundingClientRect();
        const meio = (r.top + r.bottom) / 2;
        return {
          a, visivel: !b.hidden && r.width > 0,
          naTela: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
          foraDaArte: r.bottom <= janela.top || r.top >= janela.bottom || r.right <= janela.left || r.left >= janela.right,
          naLinha: Math.abs(meio - (marca.top + marca.bottom) / 2) <= 6,
          tamanho: Math.round(r.width),
        };
      });
      return { rola: scr.scrollHeight > scr.clientHeight + 1, marca: marca.bottom <= innerHeight && marca.height >= 28, links: links.bottom <= innerHeight, botoes };
    });
    check(`início ${w}×${h}: cabe sem rolar, com a marca da InclusiVR à vista`, !fit.rola && fit.marca && fit.links, JSON.stringify(fit));
    check(`início ${w}×${h}: TELA CHEIA e MÚSICA ao lado da marca, fora da ilustração (botões de ícone de ${fit.botoes[0].tamanho} px)`,
      fit.botoes.every((b) => b.visivel && b.naTela && b.foraDaArte && b.naLinha && b.tamanho >= 44), JSON.stringify(fit.botoes));
    if (w === 360 || w === 412) await shot(p, `menu-${w}x${h}`);
    await p.context().close();
  }

  // a música (com um tom de teste no lugar do arquivo de verdade): entra no primeiro toque, e o botão liga/desliga
  const m = await newPage();
  await m.route('**/assets/musica/musica.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ arquivo: 'teste.mp3' }) }));
  await m.route('**/assets/musica/teste.mp3', (r) => r.fulfill({ contentType: 'audio/mpeg', body: readFileSync(join(ROOT, 'tests/fixtures/musica/teste.mp3')) }));
  await go(m, '', 'menu');
  check('música: com o arquivo, o botão MÚSICA aparece', await m.isVisible('[data-action="music"]'));
  await m.touchscreen.tap(195, 200);
  await m.waitForTimeout(900);
  const tocando = () => m.evaluate(async () => (await import('./src/ui/music.js')).musicPlaying());
  check('música: começa depois do primeiro toque', await tocando());
  await m.click('[data-action="music"]');
  await m.waitForTimeout(700);
  check('música: o botão desliga (a nota cortada, "Ligar a música")', !(await tocando()) && (await m.getAttribute('[data-action="music"]', 'aria-pressed')) === 'false' &&
    (await m.getAttribute('[data-action="music"]', 'aria-label')) === 'Ligar a música' && (await m.getAttribute('[data-action="music"] use', 'href')) === '#i-musica-off');
  await m.click('[data-action="music"]');
  await m.waitForTimeout(500);
  check('música: e liga de novo', await tocando());
  noErrors(m, 'música');
  await m.context().close();

  // sem arquivo de música (musica.json vazio), o botão some e nada quebra
  const s = await newPage();
  await s.route('**/assets/musica/musica.json', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }));
  await go(s, '', 'menu');
  await s.waitForTimeout(600);
  check('música: sem o arquivo, o botão MÚSICA não aparece', await s.isHidden('[data-action="music"]'));
  noErrors(s, 'música (sem arquivo)');
  await s.context().close();
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
  check('livro: o intérprete NÃO aparece sozinho (LIBRAS só pelo botão)', await page.isHidden('[data-libras-panel]') && await page.isHidden('[data-action="libras"]'));

  await page.evaluate((u) => __fakeCam.show(u), frame('paginas', 1));
  await page.waitForFunction(() => {
    const b = window.__app.book;
    return (b.ready.get(1) || [])[0]?.state === 'living';
  }, null, { timeout: 60000 });
  const info = await page.evaluate(() => {
    const a = window.__app.book.ready.get(1)[0];
    return { name: a.model.animal.name, clips: [...a.model.clips.keys()].sort().join(','), chip: document.querySelector('[data-chip-name]').textContent };
  });
  check('livro: a página 15 traz o elefante (modelo novo, com as animações gravadas)', info.name === 'Elefante' && info.clips === 'agua,andar,feliz,parado' && info.chip === 'Elefante', JSON.stringify(info));
  check('livro: um modo só (sem "Modo Página" / "Interagir")', await page.locator('[data-action="mode-page"], [data-action="mode-interact"]').count() === 0);
  await page.waitForTimeout(3500);
  const walk = await page.evaluate(() => {
    const a = window.__app.book.ready.get(1)[0];
    const b = a.wander.bounds;
    return { inside: a.wander.pos[0] >= b.minX && a.wander.pos[0] <= b.maxX && a.wander.pos[1] >= b.minY && a.wander.pos[1] <= b.maxY, pos: a.wander.pos };
  });
  check('livro: o animal passeia dentro da página', walk.inside, JSON.stringify(walk.pos));
  const liso = await page.evaluate(async () => {
    // o animal segue o grupo da página, que vai até a pose do rastreio a cada quadro (sem saltos)
    const f = window.__app.book.frames.get(1);
    return { noGrupo: window.__app.book.ready.get(1)[0].container.parent === f.group, ancora: f.group.parent?.type };
  });
  check('livro: o animal fica no grupo que segue a página (movimento liso), não preso na âncora', liso.noGrupo && liso.ancora === 'Scene', JSON.stringify(liso));
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

  // a página é o validador: sem a página, o animal desliza para o palco de brincar e CONTINUA na tela
  await page.evaluate(() => __fakeCam.clear());
  await page.waitForFunction(() => window.__app.book.frames.get(1).mode === 'stage', null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  const palco = await page.evaluate(() => {
    const b = window.__app.book;
    const a = b.ready.get(1)[0];
    const p = a.screenPoint(b.session.camera, b.session.viewport);
    return {
      state: a.state, op: a.model.opacity, visivel: a.visible, naTela: p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight,
      placa: !document.querySelector('[data-stage-plaque]').hidden, moldura: !document.querySelector('[data-scan]').hidden,
      voltar: /QUERO VOLTAR/.test(document.body.innerText),
    };
  });
  check('livro: sem a página, o animal vai para o palco e continua na tela (sem piscar, sem "QUERO VOLTAR")', palco.state === 'living' && palco.op === 1 && palco.visivel && palco.naTela && !palco.voltar, JSON.stringify(palco));
  check('livro: no palco, só a plaquinha "aponte para outra página" (sem a moldura grande)', palco.placa && !palco.moldura);
  await shot(page, 'livro-palco');
  await page.waitForTimeout(4000);
  check('livro: no palco ele continua lá depois de vários segundos', await page.evaluate(() => {
    const a = window.__app.book.ready.get(1)[0];
    return a.visible && a.state === 'living';
  }));
  // carinho e gestos no palco
  const pp = await page.evaluate(() => {
    const b = window.__app.book;
    const a = b.ready.get(1)[0];
    a.wander.hold(10);
    const p = a.screenPoint(b.session.camera, b.session.viewport);
    return { x: p.x, y: p.y + 60, taps: a.taps };
  });
  await page.touchscreen.tap(pp.x, pp.y);
  await page.waitForTimeout(300);
  check('livro: carinho no palco também', await page.evaluate((t) => window.__app.book.ready.get(1)[0].taps === t + 1, pp.taps));
  await page.mouse.move(120, 600);
  await page.mouse.down();
  await page.mouse.move(260, 600, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  check('livro: no palco, um dedo gira o animal', await page.evaluate(() => Math.abs(window.__app.book.gestures.state.yaw) > 0.5));
  await shot(page, 'livro-palco-girado');
  // a mesma página volta: ele desliza de volta para ela
  await page.evaluate((u) => __fakeCam.show(u), frame('paginas', 1, 'inclinada'));
  await page.waitForFunction(() => window.__app.book.frames.get(1).mode === 'page', null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(900);
  check('livro: a página volta e o animal volta para ela (liso, sem pular)', await page.evaluate(() => {
    const b = window.__app.book;
    const f = b.frames.get(1);
    return f.mode === 'page' && !f.follower.gliding && b.ready.get(1)[0].state === 'living' && document.querySelector('[data-stage-plaque]').hidden;
  }));
  check('livro: na página, girar com o dedo não vale (quem mexe é o celular)', await page.evaluate(() => !window.__app.book.gestures.manipulate));
  await page.waitForTimeout(800);

  // outra página, outro animal
  await page.evaluate((u) => __fakeCam.show(u), frame('paginas', 4));
  await page.waitForFunction(() => (window.__app.book.ready.get(4) || [])[0]?.state === 'living', null, { timeout: 60000 });
  check('livro: a página 21 traz o urso', await page.evaluate(() => window.__app.book.ready.get(4)[0].model.animal.id === 'urso'));
  await page.waitForFunction(() => window.__app.book.ready.get(1)[0].state === 'gone', null, { timeout: 8000 }).catch(() => {});
  check('livro: e o elefante da página anterior se despediu (tchau e um pulinho)', await page.evaluate(() => window.__app.book.ready.get(1)[0].state === 'gone'));
  check('livro: só as 5 páginas dos animais são procuradas (como na primeira versão)', await page.evaluate(() => window.__app.book.session.targetCount === 5));

  await go(page, '', 'menu');
  await page.waitForFunction(() => __fakeCam.liveTracks() === 0, null, { timeout: 8000 }).catch(() => {});
  check('livro: câmera desligada ao sair', await page.evaluate(() => __fakeCam.liveTracks()) === 0);
  noErrors(page, 'livro');
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
  // outro tamanho de tela: ZOO_TELA=844x390 npm run test:e2e -- zoo
  const [zw, zh] = (process.env.ZOO_TELA || '390x844').split('x').map(Number);
  const page = await newPage({ width: zw, height: zh });
  await go(page, 'zoo', 'zoo-intro');
  await page.click('[data-action="start-zoo"]');
  await page.waitForFunction(() => window.__app.zoo.session?.running, null, { timeout: 120000 });
  check('zoo: ajuda visual na primeira vez (sem lixeira: a casinha)', await page.isVisible('[data-zoo-help-box]') &&
    !/lixeira|página 22/i.test(await page.textContent('[data-zoo-help-box]')) && (await page.textContent('[data-zoo-help-box]')).includes('casinha'));
  await page.click('[data-action="zoo-help-close"]');
  check('zoo: pede só uma carta (sem a página 22)', (await page.textContent('[data-screen="zoo"] [data-scan-text]')).includes('MOSTRE UMA CARTA'));
  check('zoo: sem os botões da Aia e do Seu Zé', await page.locator('[data-zoo-call]').count() === 0);

  const zoo = (name) => `/tests/fixtures/frames/zoo/${name}.jpg`;
  const quem = () => page.evaluate(() => [...window.__app.zoo.state.items.values()].map((i) => `${i.kind}:${i.type}`).sort().join(','));
  // espera chegar de verdade (o modelo carregado e em cena), não só entrar na lista
  const espera = (kind, type) => page.waitForFunction(([k, t]) => [...window.__app.zoo.entries.values()].some((e) => e.item.kind === k && e.item.type === t), [kind, type], { timeout: 60000 }).catch(() => {});

  await page.evaluate((u) => __fakeCam.show(u), zoo('carta3'));
  await espera('animal', 'urso');
  const urso = await page.evaluate(() => ({ tem: !!window.__app.zoo.state.find('animal', 'urso'), ignoradas: [...window.__app.zoo.session.entry.ignored].sort((a, b) => a - b).join(',') }));
  check('zoo: a carta do urso (sem a página) traz o urso', urso.tem);
  check('zoo: as duas faces da carta do urso deixam de ser procuradas', urso.ignoradas === '2,9', urso.ignoradas);

  await page.evaluate((u) => __fakeCam.show(u), zoo('carta11_de_cabeca'));
  await espera('letra', 'A');
  check('zoo: a carta do SINAL do A, de cabeça para baixo, traz a LETRA A', await page.evaluate(() => {
    const e = [...window.__app.zoo.entries.values()].find((x) => x.item.kind === 'letra');
    return e?.item.type === 'A' && e.actor.model.letter === 'A' && e.actor.faceCamera;
  }));
  await page.evaluate((u) => __fakeCam.show(u), zoo('carta20_inclinada'));
  await espera('letra', 'U');
  check('zoo: a carta da letra U vista de lado traz a letra U', await page.evaluate(() => !!window.__app.zoo.state.find('letra', 'U')));
  await page.evaluate((u) => __fakeCam.show(u), zoo('carta1_carta12'));
  await espera('letra', 'E');
  await espera('animal', 'abelha');
  check('zoo: duas cartas juntas: as duas chegam (uma de cada vez)', /animal:abelha/.test(await quem()) && /letra:E/.test(await quem()), await quem());
  for (const n of [2, 4, 5, 13, 19]) {
    await page.evaluate((u) => __fakeCam.show(u), zoo(`carta${n}`));
    const before = await page.evaluate(() => window.__app.zoo.entries.size);
    await page.waitForFunction((b) => window.__app.zoo.entries.size > b, before, { timeout: 60000 }).catch(() => {});
  }
  await page.waitForFunction(() => !window.__app.zoo.session.tracking, null, { timeout: 10000 }).catch(() => {});
  const dez = await page.evaluate(() => {
    const z = window.__app.zoo;
    const info = z.session.renderer.info.render;
    return { n: z.state.count, rastreio: z.session.tracking, tri: info.triangles, chamadas: info.calls };
  });
  check('zoo: os 5 animais e as 5 letras juntos (cartas em várias posições)', dez.n === 10, await quem());
  check('zoo: com os 10, o reconhecimento das cartas para (o celular só desenha)', dez.rastreio === false, JSON.stringify(dez));
  check('zoo: os 10 cabem num celular comum (≤ 130 mil triângulos, ≤ 40 chamadas)', dez.tri <= 130000 && dez.chamadas <= 40, JSON.stringify(dez));
  await page.evaluate((u) => __fakeCam.show(u), zoo('mesa'));
  await page.waitForTimeout(8000);
  // cada um com o seu espaço, pela tela inteira (pedido da equipe, 11/11/2026: "todos estão muito amontoados")
  const espaco = await page.evaluate(() => {
    const z = window.__app.zoo;
    const cam = z.session.camera;
    const vp = z.session.viewport;
    const V = cam.position.constructor;
    const tela = (obj) => {
      const v = new V();
      obj.getWorldPosition(v).project(cam);
      return { x: ((v.x + 1) / 2) * vp.width, y: ((1 - v.y) / 2) * vp.height };
    };
    const vivos = [...z.entries.values()].filter((e) => e.actor.state === 'living' && !e.leaving);
    const pts = vivos.map((e) => ({ pe: tela(e.actor.container), cabeca: e.actor.screenPoint(cam, vp), pos: e.actor.wander.pos, r: e.item.r }));
    let juntos = 0;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (Math.hypot(pts[i].pos[0] - pts[j].pos[0], pts[i].pos[1] - pts[j].pos[1]) < (pts[i].r + pts[j].r) * 0.9) juntos += 1;
      }
    }
    const topo = document.querySelector('[data-screen="zoo"] .ar-topo').getBoundingClientRect().bottom;
    const fileira = document.querySelector('[data-zoo-present]').getBoundingClientRect().top;
    const ys = pts.map((p) => p.pe.y);
    const xs = pts.map((p) => p.pe.x);
    return {
      n: pts.length,
      juntos,
      altura: +((Math.max(...ys) - Math.min(...ys)) / (fileira - topo)).toFixed(2),
      largura: +((Math.max(...xs) - Math.min(...xs)) / vp.width).toFixed(2),
      dentro: pts.every((p) => p.cabeca.y >= topo - 2 && p.pe.y <= fileira + 2 && p.pe.x >= 0 && p.pe.x <= vp.width),
    };
  });
  check('zoo: os 10, cada um com o seu espaço (ninguém dentro do outro)', espaco.n === 10 && espaco.juntos === 0, JSON.stringify(espaco));
  check('zoo: espalhados pela tela (mais da metade da altura livre e da largura), sem ficar embaixo das barras',
    espaco.altura >= 0.55 && espaco.largura >= 0.5 && espaco.dentro, JSON.stringify(espaco));
  await shot(page, 'zoo-10');
  // o urso e a letra U: U de Urso acende
  const lit = await page.evaluate(async () => {
    const z = window.__app.zoo;
    const u = z.state.find('letra', 'U');
    const urso = z.state.find('animal', 'urso');
    const e = z.entries.get(urso.id);
    e.actor.wander.pos = [u.x + 0.02, u.y + 0.02];
    urso.busy = 0;
    await new Promise((r) => setTimeout(r, 1500));
    return { acesa: u.state };
  });
  check('zoo: o urso chega perto da letra U e ela acende (U de Urso)', lit.acesa === 'acesa', JSON.stringify(lit));
  await page.click('[aria-label="Levar o Urso para casa"]');
  await page.waitForFunction(() => !window.__app.zoo.state.find('animal', 'urso'), null, { timeout: 10000 }).catch(() => {});
  check('zoo: a casinha leva o urso para casa e o reconhecimento volta', await page.evaluate(() => !window.__app.zoo.state.find('animal', 'urso') && window.__app.zoo.session.tracking));
  await page.waitForFunction(() => !window.__app.zoo.session.entry.ignored.has(2), null, { timeout: 10000 }).catch(() => {});
  check('zoo: e a carta do urso volta a valer (depois de um tempinho)', await page.evaluate(() => !window.__app.zoo.session.entry.ignored.has(2) && !window.__app.zoo.session.entry.ignored.has(9)));
  await go(page, 'sala', 'sala');
  await page.waitForFunction(() => __fakeCam.liveTracks() === 0, null, { timeout: 8000 }).catch(() => {});
  check('zoo: câmera desligada ao sair', await page.evaluate(() => __fakeCam.liveTracks()) === 0);
  noErrors(page, 'zoo');
  await page.context().close();
}

/* ================================================================ Sinalize */
async function testSign() {
  const page = await newPage();
  await go(page, 'sinalize', 'sign-intro');
  check('sinalize: "Como jogar" avisa que, na primeira vez, as vogais vêm em ordem (depois, sorteadas)',
    /primeira vez, as vogais vêm em ordem: A, E, I, O, U\. Depois, elas são sorteadas/.test(await page.textContent('[data-sign-order]')));
  await page.click('[data-action="start-sign"]');
  await page.waitForFunction(() => window.__app.sign.match?.phase === 'watch', null, { timeout: 180000 });
  const primeira = await page.evaluate(() => ({ ordem: window.__app.sign.match.order.join(''), emOrdem: window.__app.sign.match.inOrder, aviso: !document.querySelector('[data-draw]').hidden }));
  check('sinalize: a primeira partida vem em ordem (A, E, I, O, U), sem sorteio', primeira.ordem === 'AEIOU' && primeira.emOrdem && !primeira.aviso, JSON.stringify(primeira));
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
  check('sinalize: o intérprete mostra o sinal (OLHE)', (await page.textContent('[data-step-text]')).includes('OLHE'));
  await page.waitForFunction(() => window.__app.sign.match.phase === 'try', null, { timeout: 60000 });
  const vez = await page.textContent('[data-step-text]');
  check('sinalize: depois de olhar, a instrução clara "SUA VEZ! FAÇA O SINAL DO A PARA A CÂMERA"', /SUA VEZ/.test(vez) && /FAÇA O SINAL DO\s*A\s*PARA A CÂMERA/.test(vez), vez);
  check('sinalize: sem placar, sem contagem e sem tempo', await page.locator('[data-score], [data-countdown], [data-sz-retry]').count() === 0 &&
    await page.evaluate(() => window.__app.sign.match.stats.score === undefined));
  await shot(page, 'sinalize-vez');
  // outra vogal na câmera: QUASE! (e a vez continua, sem perder nada)
  await page.evaluate(() => __fakeCam.show('/tests/fixtures/hands/E.jpg'));
  await page.waitForFunction(() => window.__app.sign.match.stats.almost >= 1, null, { timeout: 30000 }).catch(() => {});
  check('sinalize: o sinal de outra vogal = "QUASE!" (sem tapar os botões), e a criança continua tentando', await page.evaluate(() => window.__app.sign.match.stats.almost >= 1 && window.__app.sign.match.phase === 'try') &&
    (await page.textContent('[data-step-text]')).includes('QUASE') && await page.isVisible('[data-sz-actions] [data-action="skip-round"]'));
  await shot(page, 'sinalize-quase');
  await page.evaluate(() => __fakeCam.show('/tests/fixtures/hands/A.jpg'));
  await page.waitForFunction(() => window.__app.sign.match.stats.signsCorrect === 1, null, { timeout: 30000 }).catch(() => {});
  check('sinalize: a câmera reconhece o sinal certo: "ISSO! Você fez o A!"', await page.evaluate(() => window.__app.sign.match.stats.signsCorrect === 1) &&
    /ISSO/.test(await page.textContent('[data-step-text]')));
  await shot(page, 'sinalize-acerto');
  check('sinalize: só vogais, sem botões ACERTEI/ERREI', await page.evaluate(() => window.__app.sign.match.order.every((id) => 'AEIOU'.includes(id))) &&
    await page.locator('[data-action="self-right"], [data-action="no-camera"]').count() === 0);
  // o fim: "você fez X de 5" (pulando o resto)
  for (let i = 0; i < 6 && await page.isHidden('[data-screen="sign-game"] [data-summary]'); i++) {
    await page.waitForFunction(() => ['watch', 'try'].includes(window.__app.sign.match.phase) || window.__app.sign.match.phase === 'finished', null, { timeout: 15000 }).catch(() => {});
    if (await page.isVisible('[data-sz-actions] [data-action="skip-round"]')) await page.click('[data-sz-actions] [data-action="skip-round"]');
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('[data-screen="sign-game"] [data-summary]:not([hidden])', { timeout: 20000 }).catch(() => {});
  const fim = await page.textContent('[data-screen="sign-game"] [data-summary]');
  check('sinalize: no fim, "VOCÊ FEZ 1 DE 5 SINAIS", com cada vogal (sem pontos nem recorde)', /VOCÊ FEZ\s*1 DE 5\s*SINAIS/.test(fim) && !/PONTOS|RECORDE/.test(fim) &&
    await page.locator('[data-sum-vowels] li').count() === 5, fim.replace(/\s+/g, ' ').trim());
  await shot(page, 'sinalize-fim');
  // JOGAR DE NOVO: agora sorteada, com o aviso (para não pegar ninguém de surpresa)
  await page.click('[data-screen="sign-game"] [data-action="replay"]');
  await page.waitForSelector('[data-draw]:not([hidden])', { timeout: 5000 }).catch(() => {});
  const sorteando = await page.textContent('[data-draw-title]').catch(() => '');
  await shot(page, 'sinalize-sorteando');
  await page.waitForFunction(() => document.querySelector('[data-draw-title]').textContent.includes('SORTEADAS'), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800); // as vogais acabam de aparecer, uma a uma
  const sorteio = await page.evaluate(() => ({
    titulo: document.querySelector('[data-draw-title]').textContent,
    mostra: [...document.querySelectorAll('[data-draw-vowels] li')].map((li) => li.textContent.trim()).join(''),
    ordem: window.__app.sign.match.order.join(''),
    emOrdem: window.__app.sign.match.inOrder,
  }));
  await shot(page, 'sinalize-sorteadas');
  check('sinalize: JOGAR DE NOVO mostra "SORTEANDO AS VOGAIS..." e depois a ordem sorteada (diferente de A, E, I, O, U)',
    /SORTEANDO AS VOGAIS/.test(sorteando) && sorteio.titulo === 'VOGAIS SORTEADAS!' && sorteio.mostra === sorteio.ordem && sorteio.ordem !== 'AEIOU' && !sorteio.emOrdem,
    JSON.stringify({ sorteando, ...sorteio }));
  await page.waitForFunction(() => document.querySelector('[data-draw]').hidden && window.__app.sign.match.phase === 'watch', null, { timeout: 15000 }).catch(() => {});
  check('sinalize: depois do aviso, o jogo começa pela primeira vogal sorteada', await page.evaluate(() => {
    const m = window.__app.sign.match;
    return document.querySelector('[data-draw]').hidden && m.phase === 'watch' && m.round.item.id === m.order[0];
  }));
  await go(page, 'sala', 'sala');
  check('sinalize: sair desliga a câmera', await page.evaluate(() => __fakeCam.liveTracks()) === 0);
  await go(page, 'sinalize', 'sign-intro');
  check('sinalize: depois da primeira partida, "Como jogar" diz que as vogais vêm sorteadas',
    /vêm sorteadas: cada partida tem uma ordem diferente/.test(await page.textContent('[data-sign-order]')));
  noErrors(page, 'sinalize');
  await page.context().close();

  // celular pequeno: câmera, vídeo e botões juntos, sem rolar
  const small = await newPage({ width: 360, height: 640 });
  await go(small, 'sinalize', 'sign-intro');
  await small.click('[data-action="start-sign"]');
  await small.waitForFunction(() => window.__app.sign.match?.phase === 'watch', null, { timeout: 180000 });
  const fit = await small.evaluate(() => {
    const scr = document.querySelector('[data-screen="sign-game"]');
    const b = document.querySelector('[data-sz-actions]').getBoundingClientRect();
    return { rola: scr.scrollHeight > scr.clientHeight + 1, botoes: b.bottom <= innerHeight };
  });
  check('sinalize: a tela cabe no celular (360×640) sem rolar, com os botões à vista', !fit.rola && fit.botoes, JSON.stringify(fit));
  await shot(small, 'sinalize-360');
  await small.context().close();

  // sem câmera, o jogo não começa: explica (e diz que não gravamos imagens)
  const denied = await newPage();
  await go(denied, 'sinalize', 'sign-intro');
  await denied.evaluate(() => { __fakeCam.mode = 'denied'; });
  await denied.click('[data-action="start-sign"]');
  await denied.waitForSelector('[data-no-camera]:not([hidden])', { timeout: 60000 });
  check('sinalize: sem câmera, "ESTE JOGO PRECISA DA CÂMERA" (e não grava imagens)', (await denied.textContent('[data-no-camera]')).includes('PRECISA DA CÂMERA') &&
    (await denied.textContent('[data-no-camera]')).includes('Não gravamos'));
  await denied.context().close();
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
    const rola = await page.evaluate(() => { const s = document.querySelector('[data-screen="menu"]'); return s.scrollHeight > s.clientHeight + 1; });
    check(`${name}: o início cabe sem rolar`, !rola);
    await shot(page, `menu-${name}`);
    await page.context().close();
  }
}

try {
  if (!only || only === 'telas') await testScreens();
  if (!only || only === 'livro') await testBook();
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
