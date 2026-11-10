/**
 * LIVRO EM AR — a página é o VALIDADOR.
 *
 *   1. a criança abre a câmera e aponta para uma página com AR;
 *   2. o animal salta do desenho, fica feliz e passeia pela página, seguindo
 *      a página com movimento liso (poseFollower.js);
 *   3. tocar no animal = carinho (ele para, olha e fica feliz);
 *   4. a câmera saiu da página? O animal desliza para o PALCO DE BRINCAR, no
 *      meio da tela, e a brincadeira continua: passear, carinho, girar com o
 *      dedo e aproximar com a pinça (gestures.js);
 *   5. a mesma página voltou: ele desliza de volta para ela. Outra página:
 *      ele se despede e o animal da nova página salta.
 *
 * O módulo de LIBRAS do intérprete abre pelo botão LIBRAS (libras/librasPanel.js),
 * na página e no palco.
 *
 * O que aparece em cada página vem de BOOK_PAGES (config.js). A Maga Aia e o
 * Seu Zé em 3D foram arquivados na versão 2.2 (docs/ARQUIVO.md).
 */
import * as THREE from '../lib/three.js';
import { AR, BOOK, BOOK_PAGES, LIBRAS, STAGE, animalById, pageByTarget } from '../config.js';
import { ARSession } from './arSession.js';
import { createAnimal, prefetchModel } from './modelManager.js';
import { PageActor } from './pageActor.js';
import { PoseFollower, makePose, poseFromMatrix, stagePose, stageWalkBounds } from './poseFollower.js';
import { GestureController } from './gestures.js';
import { LibrasVideo } from './videoChroma.js';
import { DebugHud, debugEnabled } from './debugHud.js';
import { LibrasPanel } from '../libras/librasPanel.js';
import { onProgress, progressOf } from '../lib/download.js';
import { showARError, toast, announce } from '../ui/notifications.js';
import { sparkle } from '../ui/effects.js';
import { sfx } from '../ui/sound.js';

const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _pose = makePose();

export class BookExperience {
  constructor(screen) {
    this.screen = screen;
    this.stageEl = screen.querySelector('[data-ar-stage]');
    const q = (s) => screen.querySelector(s);
    this.el = {
      scan: q('[data-scan]'),
      scanText: q('[data-scan-text]'),
      chip: q('[data-page-chip]'),
      chipPage: q('[data-chip-page]'),
      chipImg: q('[data-chip-img]'),
      chipName: q('[data-chip-name]'),
      loading: q('[data-model-loading]'),
      loadingText: q('[data-model-loading-text]'),
      loadingBar: q('[data-model-loading-bar]'),
      status: q('[data-status]'),
      statusText: q('[data-status-text]'),
      statusBar: q('[data-status-bar]'),
      librasBtn: q('[data-action="libras"]'),
      tapHint: q('[data-tap-hint]'),
      tapHintText: q('[data-tap-hint-text]'),
      plaque: q('[data-stage-plaque]'),
    };
    this.panel = null;
    this.el.librasBtn.addEventListener('click', () => this._openLibras());
    this.gestures = new GestureController(this.stageEl, {
      minZoom: STAGE.minZoom,
      maxZoom: STAGE.maxZoom,
      onTap: (e) => this._tap(e),
      onInteract: () => this._handled(),
    });
  }

  /* ------------------------------------------------------------ ciclo de vida */
  async enter() {
    const token = {};
    this.token = token;
    this.active = true;
    this.page = null; // a página validada agora (o animal na tela é dela)
    this.frames = new Map(); // alvo → { page, group, follower, mode, actors, ready }
    this.hintShown = new Set();
    this.stageHintShown = false;
    this._showChip(null);
    this._setScan('searching');
    this.el.loading.hidden = true;
    this.el.librasBtn.hidden = true;
    this.el.tapHint.hidden = true;
    this.el.plaque.hidden = true;

    const session = new ARSession({ container: this.stageEl, targets: BOOK.targets, id: 'book', tuning: AR.book });
    this.session = session;
    session.onStatus = (step, progress) => this._status(step, progress);
    session.onTargetFound = (i) => this._found(i);
    session.onTargetLost = (i) => this._lost(i);
    session.onFrame = (dt) => this._frame(dt);
    session.onResize = () => this._layoutLibras();
    session.onCameraEnded = () => showARError({ code: 'ended' }, { onRetry: () => this.restart(), screen: this.screen });

    this.libras = new LibrasVideo({ chroma: LIBRAS.chroma, crop: LIBRAS.crop });
    this.libras.setEnabled(false);
    this.libras.onLayout = () => this._layoutLibras();
    this.libras.onError = () => {
      if (this.active) toast('O vídeo de LIBRAS não pôde ser carregado agora. A Realidade Aumentada continua funcionando.', { type: 'warning' });
    };
    session.hud.scene.add(this.libras.mesh);
    this.panel = new LibrasPanel(this.screen.querySelector('[data-libras-panel]'), this.libras);
    this.panel.onLayout = () => this._layoutLibras();
    this.panel.onClose = () => this._renderLibrasButton();

    this._showStatus(true);
    try {
      await session.start();
    } catch (err) {
      if (!this._alive(token)) return;
      this._showStatus(false);
      await session.stop();
      showARError(err, { onRetry: () => this.restart(), screen: this.screen });
      return;
    }
    if (!this._alive(token)) return;
    this._showStatus(false);
    for (const page of BOOK_PAGES) session.anchor(page.target);
    this.gestures.reset();
    this.gestures.setManipulate(false);
    this.gestures.attach();
    if (debugEnabled()) this.debug = new DebugHud(this.screen, session, () => this._debugText());
    this._scanStartedAt = performance.now();
    if (!navigator.connection?.saveData) this._prefetch(token);
  }

  /**
   * Baixa os animais em segundo plano, um de cada vez (para não disputar a
   * internet). Só baixa: montar o modelo fica para quando a página aparece.
   */
  async _prefetch(token) {
    for (const page of BOOK_PAGES) {
      const a = animalById(page.animal.id);
      await prefetchModel(a.pageModel || a.model);
      if (!this._alive(token)) return;
    }
  }

  _alive(token) {
    return this.active && token === this.token;
  }

  /** Os animais prontos de cada página: alvo → [PageActor] (usado pelos testes). */
  get ready() {
    const out = new Map();
    for (const [target, f] of this.frames || []) if (f.ready) out.set(target, f.ready);
    return out;
  }

  async restart() {
    await this.leave();
    if (!this.screen.hidden) await this.enter();
  }

  async leave() {
    this.active = false;
    this.token = null;
    clearTimeout(this._stageTimer);
    clearTimeout(this._hintTimer);
    clearTimeout(this._stageHintTimer);
    this.gestures.detach();
    this.debug?.dispose();
    this.debug = null;
    this._hideLoading();
    this.panel?.close();
    if (this.session) {
      this.session.onTargetFound = this.session.onTargetLost = null;
      await this.session.stop();
    }
    for (const f of this.frames?.values() || []) {
      for (const a of f.ready || []) {
        a.dispose();
        a.model.dispose();
      }
      f.group.removeFromParent();
    }
    this.frames?.clear();
    this.libras?.dispose();
    this.libras = null;
    this.session = null;
    this.page = null;
    this.el.plaque.hidden = true;
    this._showStatus(false);
  }

  /* ------------------------------------------------------------ cada página */
  /** O grupo da página: segue a página do livro ou o palco de brincar. */
  _frameOf(page) {
    let f = this.frames.get(page.target);
    if (!f) {
      const group = new THREE.Group();
      group.name = `pagina-${page.bookPage}`;
      this.session.scene.add(group);
      f = { page, group, follower: new PoseFollower(group, { smoothMs: BOOK.smoothMs }), mode: 'page', actors: null, ready: null };
      this.frames.set(page.target, f);
    }
    return f;
  }

  _actorsOf(f) {
    if (!f.actors) {
      const { page } = f;
      const aspect = this.session.aspect(page.target);
      f.actors = (async () => {
        const animal = animalById(page.animal.id);
        const model = await createAnimal(animal, { url: animal.pageModel || animal.model });
        return [new PageActor({ model, parent: f.group, aspect, place: page.animal, margin: BOOK.margin })];
      })();
      f.actors.then((list) => { f.ready = list; }).catch(() => { f.actors = null; });
    }
    return f.actors;
  }

  /** A pose que o grupo da página segue agora. */
  _targetPose(f) {
    if (f.mode === 'stage') return stagePose(this.session.camera, STAGE, this.gestures.state, _pose);
    return poseFromMatrix(this.session.anchor(f.page.target).matrix, _pose);
  }

  _stageBounds(actor) {
    return stageWalkBounds(STAGE, actor.radius, this.session.camera);
  }

  _onScreen(f) {
    return !!f?.ready?.some((a) => a.state === 'entering' || a.state === 'living');
  }

  /* ------------------------------------------------------------ detecção */
  async _found(target) {
    const page = pageByTarget(target);
    if (!page || !this.active) return;
    const token = this.token;
    clearTimeout(this._stageTimer);
    this.session.focusTarget(-1);
    this._setScan('found');
    const f = this._frameOf(page);
    const before = this.page;
    // outra página: o animal de agora se despede (da página antiga ou do palco)
    if (before && before.target !== target) this._dismiss(before.target);
    this.page = page;
    this._showChip(page);
    this._renderLibrasButton();
    if (this.panel.isOpen) this.panel.switchTo(animalById(page.animal.id));
    if (before?.target !== target) announce(`Página ${page.bookPage} encontrada!`);

    if (this._onScreen(f)) {
      // o animal desta página já está na tela: se estava no palco, volta para a página
      if (f.mode === 'stage') this._toPage(f);
      return;
    }
    let list = f.ready;
    if (!list) {
      this._showLoading(page);
      try {
        list = await this._actorsOf(f);
      } catch (err) {
        console.error(err);
        if (this._alive(token)) toast('Não foi possível carregar esta página agora. Verifique a internet e aponte de novo.', { type: 'error' });
        return;
      } finally {
        if (this.page === page || !this.page) this._hideLoading();
      }
      if (!this._alive(token)) return;
    }
    if (this.page !== page || this._onScreen(f)) return; // outra página chegou enquanto carregava
    list.forEach((a) => { if (a.state === 'leaving') a.hide(); });
    // a página já validou: se ela saiu da câmera enquanto o animal carregava, ele aparece no palco
    if (this.session.isVisible(target)) {
      f.mode = 'page';
      f.follower.snap(this._targetPose(f));
      this._setManipulate(false);
      list.forEach((a) => a.found());
    } else {
      f.mode = 'stage';
      f.follower.snap(this._targetPose(f));
      this._setManipulate(true);
      list.forEach((a) => a.found({ at: [0, 0], stageBounds: this._stageBounds(a) }));
    }
    this._renderPlaque();
    sfx.reveal();
    this._showTapHint(page);
  }

  _lost(target) {
    if (!this.active || this.page?.target !== target) return;
    // nos próximos instantes, procura primeiro esta mesma página (reencontra mais rápido)
    this.session.focusTarget(target, BOOK.refocusMs);
    clearTimeout(this._stageTimer);
    this._stageTimer = setTimeout(() => {
      if (!this.active || this.page?.target !== target || this.session?.isVisible(target)) return;
      const f = this.frames.get(target);
      if (this._onScreen(f) && f.mode === 'page') this._toStage(f);
    }, BOOK.stageAfterMs);
  }

  /** A página saiu da câmera: o animal desliza para o palco e continua brincando. */
  _toStage(f) {
    f.mode = 'stage';
    this.gestures.reset();
    f.follower.glide(BOOK.glideMs);
    for (const a of f.ready) a.setStage(true, this._stageBounds(a));
    this._setManipulate(true);
    this._renderPlaque();
    if (!this.stageHintShown) {
      this.stageHintShown = true;
      clearTimeout(this._stageHintTimer);
      this._stageHintTimer = setTimeout(() => {
        if (!this.active || f.mode !== 'stage') return;
        this._hint('GIRE COM O DEDO E APROXIME COM DOIS DEDOS', 'mao', 4500);
      }, BOOK.glideMs + 300);
    }
    announce('A página saiu da câmera. O animal continua aqui para brincar.');
  }

  /** A mesma página voltou: o animal desliza de volta para ela. */
  _toPage(f) {
    f.mode = 'page';
    f.follower.glide(BOOK.glideMs);
    for (const a of f.ready) a.setStage(false);
    this._setManipulate(false);
    this._renderPlaque();
  }

  /** O animal desta página se despede (outra página apareceu). */
  _dismiss(target) {
    const f = this.frames.get(target);
    for (const a of f?.ready || []) a.leave();
  }

  _setManipulate(on) {
    this.gestures.setManipulate(on);
    this.screen.dataset.mode = on ? 'palco' : 'pagina';
  }

  /* ------------------------------------------------------------ toque */
  /** Toque curto (gestures.js): carinho. Devolve true se acertou o animal. */
  _tap(event) {
    if (!this.session?.running || !this.page) return false;
    const f = this.frames.get(this.page.target);
    const list = (f?.ready || []).filter((a) => a.visible);
    if (!list.length) return false;
    const rect = this.stageEl.getBoundingClientRect();
    _ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.session.scene.updateMatrixWorld();
    raycaster.setFromCamera(_ndc, this.session.camera);
    const hit = raycaster.intersectObjects(list.map((a) => a.hit), false)[0];
    if (!hit) return false;
    const actor = hit.object.userData.actor;
    const role = actor.tap();
    if (!role) return true;
    this.el.tapHint.hidden = true;
    sparkle(this.screen, event.clientX - rect.left, event.clientY - rect.top, { hearts: role === 'happy' });
    sfx.correct();
    return true;
  }

  /** Girou ou aproximou no palco: o animal para de passear por um tempo (para ser visto de perto). */
  _handled() {
    if (!this.page) return;
    const f = this.frames.get(this.page.target);
    if (f?.mode !== 'stage') return;
    for (const a of f.ready || []) if (a.state === 'living') a.wander.hold(5);
    this.el.tapHint.hidden = true;
  }

  /* ------------------------------------------------------------ quadro a quadro */
  _frame(dt) {
    this.gestures.update(dt);
    for (const f of this.frames.values()) {
      if (!f.ready?.some((a) => a.visible)) continue;
      f.follower.update(dt, this._targetPose(f));
      for (const a of f.ready) a.update(dt);
    }
    this.libras?.update(dt);
    this.panel?.update();
    if (this.el.scan.dataset.state === 'searching' &&
        performance.now() - this._scanStartedAt > BOOK.notFoundHintAfter * 1000) {
      this._setScan('hint');
    }
  }

  _debugText() {
    const f = this.page && this.frames.get(this.page.target);
    if (!f) return 'procurando';
    return f.mode === 'stage' ? 'palco' : 'página';
  }

  /* ------------------------------------------------------------ LIBRAS */
  _renderLibrasButton() {
    const show = !!this.page?.animal && !this.panel?.isOpen;
    this.el.librasBtn.hidden = !show;
  }

  _openLibras() {
    if (!this.page?.animal) return;
    this.panel.open(animalById(this.page.animal.id));
    this._renderLibrasButton();
  }

  _layoutLibras() {
    const vp = this.session?.viewport;
    if (!vp || !this.libras || !this.panel?.isOpen) return;
    const box = this.panel.stageBox(vp.height);
    if (!box) return;
    const h = Math.min(box.height, box.width / this.libras.aspect);
    const w = h * this.libras.aspect;
    this.libras.place({ x: box.left + (box.width - w) / 2, y: box.bottom, height: h });
  }

  /* ------------------------------------------------------------ "CHEGANDO..." */
  _showLoading(page) {
    const el = this.el;
    const a = animalById(page.animal.id);
    el.loadingText.textContent = `${a.article === 'o' ? 'O' : 'A'} ${a.name.toUpperCase()} ESTÁ CHEGANDO...`;
    const urls = [a.pageModel || a.model];
    const render = () => {
      el.loadingBar.style.width = `${Math.round(Math.max(0.04, progressOf(urls)) * 100)}%`;
    };
    render();
    this._stopLoadingProgress?.();
    this._stopLoadingProgress = onProgress(render);
    el.loading.hidden = false;
  }

  _hideLoading() {
    this._stopLoadingProgress?.();
    this._stopLoadingProgress = null;
    this.el.loading.hidden = true;
  }

  /* ------------------------------------------------------------ interface */
  _showChip(page) {
    const chip = this.el.chip;
    if (!page) {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    const animal = animalById(page.animal.id);
    this.el.chipPage.textContent = page.bookPage;
    this.el.chipImg.src = animal.portrait;
    this.el.chipName.textContent = animal.name;
  }

  /** No palco, uma plaquinha lembra como trocar de animal (a moldura grande some). */
  _renderPlaque() {
    const f = this.page && this.frames.get(this.page.target);
    this.el.plaque.hidden = f?.mode !== 'stage';
  }

  _showTapHint(page) {
    if (this.hintShown.has(page.target)) return;
    this.hintShown.add(page.target);
    const animal = animalById(page.animal.id);
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => {
      if (!this.active) return;
      this._hint(`TOQUE ${animal.article === 'o' ? 'NO' : 'NA'} ${animal.name.toUpperCase()}`, 'toque', 5000);
    }, 1600);
  }

  _hint(text, iconName, duration) {
    const el = this.el.tapHint;
    this.el.tapHintText.textContent = text;
    el.querySelector('use')?.setAttribute('href', `#i-${iconName}`);
    el.hidden = false;
    clearTimeout(this._hintHide);
    this._hintHide = setTimeout(() => { el.hidden = true; }, duration);
  }

  _setScan(state) {
    const scan = this.el.scan;
    scan.dataset.state = state;
    scan.hidden = state === 'found';
    this.el.scanText.innerHTML = state === 'hint'
      ? '<strong>NÃO ENCONTREI A PÁGINA.</strong><span>Chegue mais perto ou mais longe, com a página bem iluminada.</span>'
      : '<strong>APONTE PARA UMA PÁGINA COM AR</strong><span>Mais ou menos 30 cm de distância</span>';
  }

  _status(step, progress) {
    const text = {
      loading: 'Preparando a Realidade Aumentada...',
      camera: 'Abrindo a câmera... Se o navegador perguntar, toque em "Permitir".',
      targets: 'Carregando as páginas do livro...',
      preparing: 'Quase pronto...',
      ready: 'Pronto!',
    }[step];
    if (text) this.el.statusText.textContent = text;
    if (step === 'targets' && typeof progress === 'number') {
      this.el.statusBar.style.width = `${Math.round(progress * 100)}%`;
    }
  }

  _showStatus(show) {
    this.el.status.hidden = !show;
    if (show) this.el.statusBar.style.width = '0%';
  }
}
