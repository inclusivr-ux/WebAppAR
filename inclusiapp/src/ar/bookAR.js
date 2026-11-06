/**
 * LIVRO EM AR — um modo só (sem "Modo Página" × "Interação").
 *
 *   1. a criança abre a câmera e aponta para uma página com AR;
 *   2. o animal salta do desenho, fica feliz e começa a passear pela página;
 *   3. tocar no animal = carinho (ele para, olha e fica feliz);
 *   4. ele nunca sai da página. Se a página some da câmera, ele pisca, fica
 *      transparente aos poucos e pede: "QUERO VOLTAR PARA MINHA PÁGINA!".
 *
 * Nas páginas sem animal em AR, a Maga Aia e o Seu Zé fazem o mesmo (olá,
 * feliz, andar, reação ao toque). O módulo de LIBRAS do Fauston só abre pelo
 * botão LIBRAS, nas páginas com animal (libras/librasPanel.js).
 *
 * O que aparece em cada página vem de BOOK_PAGES (config.js).
 */
import * as THREE from '../lib/three.js';
import { AR, BOOK, BOOK_PAGES, CHARACTERS, LIBRAS, animalById, pageByTarget } from '../config.js';
import { ARSession } from './arSession.js';
import { createAnimal, prefetchModel } from './modelManager.js';
import { PageActor } from './pageActor.js';
import { LibrasVideo } from './videoChroma.js';
import { LibrasPanel } from '../libras/librasPanel.js';
import { getCharacter, prefetchCharacterLib } from '../characters/characterModel.js';
import { showARError, toast, announce } from '../ui/notifications.js';
import { sparkle } from '../ui/effects.js';
import { sfx } from '../ui/sound.js';

const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

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
      status: q('[data-status]'),
      statusText: q('[data-status-text]'),
      statusBar: q('[data-status-bar]'),
      librasBtn: q('[data-action="libras"]'),
      tapHint: q('[data-tap-hint]'),
      tapHintText: q('[data-tap-hint-text]'),
      bubble: q('[data-bubble]'),
    };
    this.panel = null;
    this.el.librasBtn.addEventListener('click', () => this._openLibras());
    this.stageEl.addEventListener('pointerdown', (e) => this._tap(e));
  }

  /* ------------------------------------------------------------ ciclo de vida */
  async enter() {
    const token = {};
    this.token = token;
    this.active = true;
    this.page = null;
    this.actors = new Map(); // target → Promise<PageActor[]>
    this.ready = new Map(); // target → PageActor[]
    this.hintShown = new Set();
    this.speaker = null;
    this._showChip(null);
    this._setScan('searching');
    this.el.loading.hidden = true;
    this.el.librasBtn.hidden = true;
    this.el.tapHint.hidden = true;
    this.el.bubble.hidden = true;

    const session = new ARSession({ container: this.stageEl, targets: BOOK.targets, id: 'book', tuning: AR.book });
    this.session = session;
    session.onStatus = (step, progress) => this._status(step, progress);
    session.onTargetFound = (i) => this._found(i);
    session.onTargetLost = (i) => this._lost(i);
    session.onFrame = (dt) => this._frame(dt);
    session.onResize = () => this._layoutLibras();
    session.onCameraEnded = () => showARError({ code: 'ended' }, { onRetry: () => this.restart(), screen: this.screen });

    // luz para a Aia e o Seu Zé (o MToon pede luz; os animais já vêm pintados)
    session.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.3, 1, 0.6);
    session.camera.add(sun);

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
    this._scanStartedAt = performance.now();
    // os animais em segundo plano, na ordem das páginas
    if (!navigator.connection?.saveData) {
      for (const page of BOOK_PAGES) {
        if (page.animal) {
          const a = animalById(page.animal.id);
          prefetchModel(a.pageModel || a.model);
        }
      }
      prefetchCharacterLib();
    }
  }

  _alive(token) {
    return this.active && token === this.token;
  }

  async restart() {
    await this.leave();
    if (!this.screen.hidden) await this.enter();
  }

  async leave() {
    this.active = false;
    this.token = null;
    clearTimeout(this._lostTimer);
    clearTimeout(this._hintTimer);
    this.panel?.close();
    if (this.session) {
      this.session.onTargetFound = this.session.onTargetLost = null;
      await this.session.stop();
    }
    for (const list of this.ready?.values() || []) list.forEach((a) => a.dispose());
    this.ready?.clear();
    this.libras?.dispose();
    this.libras = null;
    this.session = null;
    this.page = null;
    this.el.bubble.hidden = true;
    this._showStatus(false);
  }

  /* ------------------------------------------------------------ atores de cada página */
  _actorsOf(page) {
    if (!this.actors.has(page.target)) {
      const session = this.session;
      const anchor = session.anchor(page.target);
      const aspect = session.aspect(page.target);
      const common = { anchor, scene: session.scene, aspect, lostGrace: BOOK.lostGraceMs / 1000, margin: BOOK.margin };
      const build = async () => {
        const list = [];
        if (page.animal) {
          const animal = animalById(page.animal.id);
          const model = await createAnimal(animal, { url: animal.pageModel || animal.model });
          list.push(new PageActor({ ...common, model, place: page.animal }));
        }
        for (const c of page.characters || []) {
          const model = await getCharacter(CHARACTERS[c.id]);
          list.push(new PageActor({ ...common, model, character: true, place: { home: c.home, size: BOOK.characterHeight } }));
        }
        list.forEach((actor) => { actor.onSay = (text) => this._say(actor, text); });
        return list;
      };
      const promise = build();
      this.actors.set(page.target, promise);
      promise.then((list) => this.ready.set(page.target, list)).catch(() => this.actors.delete(page.target));
    }
    return this.actors.get(page.target);
  }

  /* ------------------------------------------------------------ detecção */
  async _found(target) {
    const page = pageByTarget(target);
    if (!page) return;
    const token = this.token;
    clearTimeout(this._lostTimer);
    this._setScan('found');
    // outra página: os atores da anterior saem de cena
    if (this.page && this.page.target !== target) {
      (this.ready.get(this.page.target) || []).forEach((a) => a.hide());
      this.speaker = null;
      this.el.bubble.hidden = true;
    }
    const changed = this.page?.target !== target;
    this.page = page;
    this._showChip(page);
    this._renderLibrasButton();
    if (page.animal && this.panel.isOpen) this.panel.switchTo(animalById(page.animal.id));
    if (changed) announce(`Página ${page.bookPage} encontrada!`);

    let list = this.ready.get(target);
    if (!list) {
      this.el.loading.hidden = false;
      try {
        list = await this._actorsOf(page);
      } catch (err) {
        console.error(err);
        toast('Não foi possível carregar esta página agora. Verifique a internet e aponte de novo.', { type: 'error' });
        return;
      } finally {
        this.el.loading.hidden = true;
      }
      if (!this._alive(token)) return;
    }
    if (!this.session.isVisible(target) || this.page?.target !== target) return;
    list.forEach((a) => a.found());
    sfx.reveal();
    this._showTapHint(page);
  }

  _lost(target) {
    if (!this.active) return;
    (this.ready.get(target) || []).forEach((a) => a.lost());
    clearTimeout(this._lostTimer);
    this._lostTimer = setTimeout(() => {
      if (this.session?.visibleTargets.length === 0) {
        this._scanStartedAt = performance.now();
        this._setScan('searching');
      }
    }, BOOK.lostGraceMs);
  }

  /* ------------------------------------------------------------ toque */
  _tap(event) {
    if (!this.session?.running || !this.page) return;
    const list = this.ready.get(this.page.target) || [];
    const hits = list.filter((a) => a.visible).map((a) => a.hit);
    if (!hits.length) return;
    const rect = this.stageEl.getBoundingClientRect();
    _ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.session.scene.updateMatrixWorld();
    raycaster.setFromCamera(_ndc, this.session.camera);
    const hit = raycaster.intersectObjects(hits, false)[0];
    if (!hit) return;
    const actor = hit.object.userData.actor;
    const role = actor.tap(actor.cameraInPage());
    if (!role) return;
    this.el.tapHint.hidden = true;
    sparkle(this.screen, event.clientX - rect.left, event.clientY - rect.top, { hearts: role === 'happy' || role === 'ola' });
    sfx.correct();
  }

  /* ------------------------------------------------------------ quadro a quadro */
  _frame(dt) {
    for (const list of this.ready.values()) for (const actor of list) actor.update(dt);
    this.libras?.update(dt);
    this.panel?.update();
    if (this.speaker) this._placeBubble();
    if (this.el.scan.dataset.state === 'searching' &&
        performance.now() - this._scanStartedAt > BOOK.notFoundHintAfter * 1000) {
      this._setScan('hint');
    }
  }

  /* ------------------------------------------------------------ balão de fala */
  _say(actor, text) {
    if (!text) {
      if (this.speaker === actor) {
        this.speaker = null;
        this.el.bubble.hidden = true;
      }
      return;
    }
    if (this.speaker && this.speaker !== actor) return;
    this.speaker = actor;
    this.el.bubble.querySelector('[data-bubble-text]').textContent = text;
    this.el.bubble.hidden = false;
    announce(text);
    this._placeBubble();
  }

  _placeBubble() {
    const vp = this.session?.viewport;
    if (!vp) return;
    const p = this.speaker.screenPoint(this.session.camera, vp);
    const b = this.el.bubble;
    const w = b.offsetWidth || 200;
    const x = Math.min(vp.width - w / 2 - 10, Math.max(w / 2 + 10, p.x));
    const y = Math.max(90, Math.min(vp.height - 160, p.y));
    b.style.transform = `translate(${x - w / 2}px, ${y - b.offsetHeight - 14}px)`;
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

  /* ------------------------------------------------------------ interface */
  _showChip(page) {
    const chip = this.el.chip;
    if (!page) {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    this.el.chipPage.textContent = page.bookPage;
    if (page.animal) {
      const animal = animalById(page.animal.id);
      this.el.chipImg.src = animal.portrait;
      this.el.chipName.textContent = animal.name;
    } else {
      this.el.chipImg.src = CHARACTERS.aia.portrait;
      this.el.chipName.textContent = page.characters.map((c) => CHARACTERS[c.id].name).join(' e ');
    }
  }

  _showTapHint(page) {
    if (this.hintShown.has(page.target)) return;
    this.hintShown.add(page.target);
    const animal = page.animal && animalById(page.animal.id);
    this.el.tapHintText.textContent = animal
      ? `TOQUE ${animal.article === 'o' ? 'NO' : 'NA'} ${animal.name.toUpperCase()}`
      : 'TOQUE NA AIA OU NO SEU ZÉ';
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => {
      if (!this.active) return;
      this.el.tapHint.hidden = false;
      this._hintTimer = setTimeout(() => { this.el.tapHint.hidden = true; }, 5000);
    }, 1600);
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
