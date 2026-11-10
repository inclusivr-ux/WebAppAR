/**
 * ZOOLÓGICO EM AR — o livro e as cartas.
 *
 *   1. a criança abre o livro na página 22 (o zoológico cheio) e aponta o
 *      celular: a página vira o "chão" do zoológico;
 *   2. coloca uma carta em cima da página: o animal (ou a LETRA, nas cartas
 *      das vogais) salta da carta para o zoológico e fica lá;
 *   3. coloca outra carta, e outra: todos ficam juntos, passeiam e se
 *      encontram (o urso come o mel da abelha, o elefante joga água, a onça
 *      brinca; o animal acende a letra da sua inicial);
 *   4. tocar = carinho; a Maga Aia e o Seu Zé vêm pelos botões; a casinha
 *      leva alguém para descansar (sai do zoológico e a carta volta a valer).
 *
 * O rastreamento acompanha a página e UMA carta ao mesmo tempo. A carta que
 * já trouxe alguém deixa de ser procurada (ARSession.ignoreTarget): assim o
 * celular encontra a próxima carta, mesmo com a anterior ainda na página.
 *
 * Os animais e personagens são os mesmos do livro (PageActor: passear dentro
 * da página, carinho, sumir e voltar); as letras são letterModel.js. As
 * regras (necessidades, encontros, letras acesas) ficam em zooState.js.
 */
import * as THREE from '../lib/three.js';
import { CHARACTERS, animalById } from '../config.js';
import { ARSession } from '../ar/arSession.js';
import { createAnimal } from '../ar/modelManager.js';
import { PageActor } from '../ar/pageActor.js';
import { pageBounds } from '../ar/pageWalker.js';
import { getCharacter } from '../characters/characterModel.js';
import { onProgress, progressOf } from '../lib/download.js';
import { showARError, toast, announce } from '../ui/notifications.js';
import { sparkle } from '../ui/effects.js';
import { sfx, unlockAudio } from '../ui/sound.js';
import { storage } from '../ui/storage.js';
import { ZOO, ZOO_CARDS, NEED_ICONS } from './zooConfig.js';
import { ZooState } from './zooState.js';
import { createLetter } from './letterModel.js';

const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _inv = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _plane = new THREE.Plane();
const PAGE = ZOO.pageTarget;
const MARGIN = 0.06;

const icon = (name, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/** Nome com artigo, para os avisos ("a Abelha", "o Urso", "a letra A"). */
function nameOf(kind, type) {
  if (kind === 'animal') {
    const a = animalById(type);
    return `${a.article} ${a.name}`;
  }
  if (kind === 'letra') return `a letra ${type}`;
  return type === 'aia' ? 'a Maga Aia' : 'o Seu Zé';
}

export class ZooExperience {
  constructor(screen) {
    this.screen = screen;
    this.stageEl = screen.querySelector('[data-ar-stage]');
    const q = (s) => screen.querySelector(s);
    this.ui = q('.ar-ui');
    this.el = {
      scan: q('[data-scan]'),
      scanText: q('[data-scan-text]'),
      hint: q('[data-zoo-hint]'),
      hintText: q('[data-zoo-hint-text]'),
      loading: q('[data-model-loading]'),
      loadingText: q('[data-model-loading-text]'),
      loadingBar: q('[data-model-loading-bar]'),
      bubble: q('[data-bubble]'),
      present: q('[data-zoo-present]'),
      help: q('[data-zoo-help-box]'),
      status: q('[data-status]'),
      statusText: q('[data-status-text]'),
      statusBar: q('[data-status-bar]'),
    };
    this.stageEl.addEventListener('pointerdown', (e) => this._tap(e));
    screen.querySelectorAll('[data-zoo-call]').forEach((b) => b.addEventListener('click', () => {
      unlockAudio();
      this.callCharacter(b.dataset.zooCall);
    }));
    q('[data-action="zoo-help"]').addEventListener('click', () => this._help(true));
    q('[data-action="zoo-help-close"]').addEventListener('click', () => this._help(false));
  }

  /* ------------------------------------------------------------ ciclo de vida */
  async enter() {
    const token = {};
    this.token = token;
    this.active = true;
    this.state = new ZooState();
    this.state.setBounds(pageBounds(1, { margin: MARGIN }));
    this.entries = new Map(); // id do zooState → { item, actor, card }
    this.usedCards = new Map(); // carta → id de quem ela trouxe
    this.cardSeen = new Map(); // carta → último instante em que chamou alguém
    this.queue = []; // cartas vistas sem a página: entram quando a página aparecer
    this.bubbles = new Map();
    this.speaker = null;
    this.el.bubble.hidden = true;
    this._hideLoading();
    this._renderPresent();
    this._setScan('searching');
    this._hint(null);

    const session = new ARSession({ container: this.stageEl, targets: ZOO.targets, id: 'zoo', tuning: ZOO.tuning });
    this.session = session;
    session.onStatus = (step, p) => this._status(step, p);
    session.onTargetFound = (i) => this._found(i);
    session.onTargetLost = (i) => this._lost(i);
    session.onFrame = (dt) => this._frame(dt);
    session.onCameraEnded = () => showARError({ code: 'ended' }, { onRetry: () => this.restart(), screen: this.screen });
    // luz para a Aia, o Seu Zé e as letras (os animais já vêm pintados)
    session.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.3, 1, 0.6);
    session.camera.add(sun);

    this.el.status.hidden = false;
    this.el.statusBar.style.width = '0%';
    try {
      await session.start();
    } catch (err) {
      if (!this._alive(token)) return;
      this.el.status.hidden = true;
      await session.stop();
      showARError(err, { onRetry: () => this.restart(), screen: this.screen });
      return;
    }
    if (!this._alive(token)) return;
    this.el.status.hidden = true;
    this.pageAnchor = session.anchor(PAGE);
    for (const n of Object.keys(ZOO_CARDS)) session.anchor(Number(n));
    this._scanStartedAt = performance.now();
    if (!storage.get('zooArHelpSeen', false)) {
      storage.set('zooArHelpSeen', true);
      this._help(true);
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
    this._help(false);
    this._hideLoading();
    if (this.session) {
      this.session.onTargetFound = this.session.onTargetLost = null;
      await this.session.stop();
    }
    for (const e of this.entries?.values() || []) this._dispose(e);
    this.entries?.clear();
    for (const b of this.bubbles?.values() || []) b.remove();
    this.bubbles?.clear();
    this.session = null;
    this.el.bubble.hidden = true;
    this.el.status.hidden = true;
  }

  get pageVisible() {
    return !!this.session?.isVisible(PAGE);
  }

  /* ------------------------------------------------------------ página e cartas */
  _found(target) {
    if (!this.active) return;
    if (target === PAGE) {
      this._pageFound();
      return;
    }
    const card = ZOO_CARDS[target];
    if (card) this._card(target, card);
  }

  _lost(target) {
    if (!this.active || target !== PAGE) return;
    for (const e of this.entries.values()) e.actor.lost();
    clearTimeout(this._lostTimer);
    this._lostTimer = setTimeout(() => {
      if (this.active && !this.pageVisible) {
        this._scanStartedAt = performance.now();
        this._setScan('searching');
      }
    }, ZOO.lostGraceMs);
  }

  _pageFound() {
    clearTimeout(this._lostTimer);
    this._setScan('found');
    for (const e of this.entries.values()) {
      // quem tinha sumido volta de onde estava
      if (e.actor.state === 'gone') e.actor.place.home = [...e.actor.wander.pos];
      e.actor.found();
    }
    const queued = this.queue.splice(0);
    for (const q of queued) this._bring(q.kind, q.type, null, q.card);
    if (!this.entries.size && !queued.length) this._hint('COLOQUE UMA CARTA EM CIMA DA PÁGINA', 'carta');
    sfx.reveal();
  }

  /** Uma carta apareceu: traz quem ela mostra (ou chama, se já estiver lá). */
  _card(n, { kind, type }) {
    const now = performance.now();
    if (now - (this.cardSeen.get(n) || -Infinity) < ZOO.cardCooldown * 1000) return;
    this.cardSeen.set(n, now);
    if (!this.pageVisible) {
      // a carta foi vista longe da página: entra quando a página aparecer
      if (!this.queue.some((q) => q.kind === kind && q.type === type)) this.queue.push({ kind, type, card: n });
      this.session.ignoreTarget(n);
      this._hint(`AGORA APONTE PARA A PÁGINA ${ZOO.bookPage}`, 'livro');
      announce(`Agora aponte para a página ${ZOO.bookPage}.`);
      return;
    }
    this._bring(kind, type, this._cardOnPage(n), n);
  }

  /**
   * Onde a carta está, nas coordenadas da página (ou null).
   *
   * Cada imagem do MindAR tem a sua escala (a distância vem em "pixels da
   * imagem", e a carta e a página têm tamanhos diferentes), então a posição
   * 3D da carta não serve direto. O que vale para todas é a TELA: o centro da
   * carta na imagem da câmera, e o raio da câmera até o plano da página.
   */
  _cardOnPage(n) {
    const card = this.session.anchor(n);
    const page = this.pageAnchor;
    if (!card.visible || !page?.visible) return null;
    const camera = this.session.camera;
    camera.updateMatrixWorld();
    _v.setFromMatrixPosition(card.matrix).project(camera);
    raycaster.setFromCamera(_ndc.set(_v.x, _v.y), camera);
    _normal.setFromMatrixColumn(page.matrix, 2).normalize();
    _plane.setFromNormalAndCoplanarPoint(_normal, _v.setFromMatrixPosition(page.matrix));
    if (!raycaster.ray.intersectPlane(_plane, _v)) return null;
    _v.applyMatrix4(_inv.copy(page.matrix).invert());
    return [_v.x, _v.y];
  }

  /* ------------------------------------------------------------ quem entra e sai */
  /**
   * Traz um animal, uma letra ou um personagem para o zoológico (em `pos`, ou
   * onde estiver desenhado). Se já estiver lá, ele comemora e vem até a carta.
   */
  async _bring(kind, type, pos, card = null) {
    const token = this.token;
    const existing = this.state.find(kind, type);
    if (existing) {
      const e = this.entries.get(existing.id);
      if (card != null) {
        this.usedCards.set(card, existing.id);
        this.session.ignoreTarget(card);
      }
      if (e?.actor.state === 'living') {
        if (pos) e.actor.wander.goTo(clampPos(pos, this.state.bounds));
        e.actor.model.playOnce(kind === 'personagem' ? 'ola' : 'happy');
        sfx.reveal();
      }
      return;
    }
    if (this.state.full) {
      sfx.wrong();
      this._hint('O ZOOLÓGICO ESTÁ CHEIO! LEVE ALGUÉM PARA A CASINHA', 'casa', 4000);
      return;
    }
    const home = pos || (kind === 'personagem' ? ZOO.homes[type] : null);
    const item = this.state.add(kind, type, home ? { x: home[0], y: home[1] } : null);
    if (!item) return;
    if (card != null) {
      this.usedCards.set(card, item.id);
      this.session.ignoreTarget(card);
    }
    this._hint(null);
    this._renderPresent();

    let model;
    const loadingOf = kind === 'personagem' ? CHARACTERS[type].model : kind === 'animal' ? animalById(type).model : null;
    if (loadingOf) this._showLoading(nameOf(kind, type), [loadingOf]);
    try {
      if (kind === 'animal') model = await createAnimal(animalById(type));
      else if (kind === 'letra') model = await createLetter(type);
      else model = await getCharacter(CHARACTERS[type]);
    } catch (err) {
      console.error(err);
      this.state.remove(item.id);
      this._release(item.id);
      this._renderPresent();
      if (this._alive(token)) toast('Não foi possível trazer agora. Verifique a internet e tente de novo.', { type: 'error' });
      return;
    } finally {
      if (loadingOf) this._hideLoading();
    }
    if (!this._alive(token) || !this.state.items.has(item.id)) {
      if (kind !== 'personagem') model.dispose?.();
      return;
    }
    const size = kind === 'animal' ? ZOO.sizes[type] : kind === 'letra' ? ZOO.sizes.letra : ZOO.sizes.personagem;
    const actor = new PageActor({
      model,
      anchor: this.pageAnchor,
      scene: this.session.scene,
      aspect: this.session.aspect(PAGE),
      place: { home: [item.x, item.y], size, lift: kind === 'animal' && model.flies ? ZOO.beeLift : 0 },
      margin: MARGIN,
      character: kind === 'personagem',
      faceCamera: kind === 'letra',
      // a letra reclina para trás, como uma placa, para quem olha de cima: tem que dar para LER
      lean: kind === 'letra' ? [10, 62] : [40, 38],
      holdGrace: ZOO.holdGraceMs / 1000,
      lostGrace: ZOO.lostGraceMs / 1000,
      lostText: 'QUERO VOLTAR PARA O ZOOLÓGICO!',
    });
    actor.onSay = (text) => this._say(actor, text);
    const entry = { item, actor };
    this.entries.set(item.id, entry);
    if (this.pageVisible) {
      actor.found();
      const p = actor.screenPoint(this.session.camera, this.session.viewport);
      if (p.visible) sparkle(this.ui, p.x, p.y + 30, { count: 14 });
      sfx.reveal();
    }
    announce(`${capitalize(nameOf(kind, type))} chegou no zoológico!`);
    this._renderPresent();
  }

  /** Botões da Aia e do Seu Zé (eles ainda não têm carta). */
  callCharacter(id) {
    if (!this.active || !this.session?.running) return;
    if (!this.pageVisible) {
      this._hint(`PRIMEIRO APONTE PARA A PÁGINA ${ZOO.bookPage}`, 'livro', 3500);
      sfx.wrong();
      return;
    }
    this._bring('personagem', id, null);
  }

  /** A casinha: vai descansar em casa (sai do zoológico; a carta volta a valer). */
  async goHome(id) {
    const e = this.entries.get(id);
    if (!e || e.leaving) return;
    e.leaving = true;
    this._bubble(id, null);
    sfx.skip();
    announce(`${capitalize(nameOf(e.item.kind, e.item.type))} foi descansar em casa.`);
    this.state.remove(id);
    this._release(id);
    this._renderPresent();
    if (e.actor.state !== 'gone') await e.actor.leave();
    this._dispose(e);
    this.entries.delete(id);
  }

  /** As cartas que trouxeram este alguém voltam a ser procuradas. */
  _release(id) {
    for (const [card, who] of this.usedCards) {
      if (who !== id) continue;
      this.usedCards.delete(card);
      this.cardSeen.delete(card);
      this.session?.ignoreTarget(card, false);
    }
  }

  _dispose(e) {
    e.actor.dispose();
    // a Aia e o Seu Zé são um só modelo por app (o VRM não é clonado): ficam guardados
    if (e.item.kind !== 'personagem') e.actor.model.dispose?.();
  }

  /* ------------------------------------------------------------ toque */
  _tap(event) {
    if (!this.session?.running) return;
    const list = [...this.entries.values()].filter((e) => e.actor.visible && e.actor.state === 'living');
    if (!list.length) return;
    const rect = this.stageEl.getBoundingClientRect();
    _ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.session.scene.updateMatrixWorld();
    raycaster.setFromCamera(_ndc, this.session.camera);
    const hit = raycaster.intersectObjects(list.map((e) => e.actor.hit), false)[0];
    if (!hit) return;
    const actor = hit.object.userData.actor;
    const entry = list.find((e) => e.actor === actor);
    const role = actor.tap(actor.cameraInPage());
    if (!role) return;
    if (entry.item.kind === 'animal') this._events(this.state.caress(entry.item.id));
    sparkle(this.ui, event.clientX - rect.left, event.clientY - rect.top, { hearts: entry.item.kind !== 'letra', count: entry.item.kind === 'letra' ? 10 : 14 });
    sfx.correct();
  }

  /* ------------------------------------------------------------ quadro a quadro */
  _frame(dt) {
    for (const e of this.entries.values()) {
      e.actor.update(dt);
      if (e.actor.state === 'living') this.state.move(e.item.id, e.actor.wander.pos[0], e.actor.wander.pos[1]);
    }
    // o zoológico "vive" enquanto a página está à vista
    if (this.pageVisible) this._events(this.state.tick(dt));
    this._placeBubbles();
    if (this.speaker) this._placeSpeech();
    if (this.el.scan.dataset.state === 'searching' && performance.now() - this._scanStartedAt > 8000) this._setScan('hint');
  }

  _events(events) {
    for (const ev of events) {
      if (ev.type === 'need') this._bubble(ev.id, ev.need);
      else if (ev.type === 'mood') this._bubble(ev.id, ev.state === 'calmo' || ev.state === 'quer' ? this.state.items.get(ev.id)?.need : ev.state);
      else if (ev.type === 'meet') this._meet(ev);
      else if (ev.type === 'visit') this._visit(ev.id, ev.to);
      else if (ev.type === 'letter') this._letterLit(ev);
      else if (ev.type === 'letter-off') this.entries.get(ev.id)?.actor.model.setLit?.(false);
    }
  }

  /** Um vai até o outro e os dois fazem a animação da regra. */
  _meet(ev) {
    const a = this.entries.get(ev.a);
    const b = this.entries.get(ev.b);
    if (!a || !b) return;
    const { rule } = ev;
    const mover = rule.approach === 'a' ? a : b;
    const still = mover === a ? b : a;
    this._approach(mover, still);
    still.actor.wander.hold(3);
    setTimeout(() => {
      if (!this.active) return;
      this._play(a, rule.aClip);
      this._play(b, rule.bClip);
    }, 900);
  }

  _visit(id, to) {
    const e = this.entries.get(id);
    const t = this.entries.get(to);
    if (e && t && e.actor.state === 'living' && !e.actor.model.busy) this._approach(e, t);
  }

  _approach(mover, still) {
    const [x0, y0] = mover.actor.wander.pos;
    const [x1, y1] = still.actor.wander.pos;
    const d = Math.hypot(x1 - x0, y1 - y0) || 1;
    const gap = mover.actor.model.flies ? 0.03 : ZOO.meetDistance * 0.6;
    mover.actor.wander.goTo([x1 - ((x1 - x0) / d) * gap, y1 - ((y1 - y0) / d) * gap]);
  }

  _play(e, role) {
    const m = e.actor.model;
    const r = role === 'special' && !m.has('special') ? 'happy' : role;
    e.actor.wander.hold(r === 'special' ? 6 : 3);
    return m.playOnce(r);
  }

  _letterLit(ev) {
    const letter = this.entries.get(ev.id);
    const animal = this.entries.get(ev.animal);
    letter?.actor.model.setLit?.(true);
    if (letter) this._play(letter, 'special');
    if (animal) this._play(animal, 'special');
    const p = letter?.actor.screenPoint(this.session.camera, this.session.viewport);
    if (p?.visible) sparkle(this.ui, p.x, p.y + 40, { count: 22, spread: 120 });
    sfx.fanfare();
    const a = animal && animalById(animal.item.type);
    announce(a ? `${ev.letter} de ${a.name}! A letra acendeu.` : `A letra ${ev.letter} acendeu!`);
  }

  /* ------------------------------------------------------------ balões */
  _bubble(id, state) {
    let el = this.bubbles.get(id);
    if (!state) {
      el?.remove();
      this.bubbles.delete(id);
      return;
    }
    if (!el) {
      el = document.createElement('span');
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = icon('coracao');
      this.ui.appendChild(el);
      this.bubbles.set(id, el);
    }
    el.className = `zoo__balao zoo__balao--${state}`;
    el.querySelector('use').setAttribute('href', `#i-${NEED_ICONS[state] || 'coracao'}`);
  }

  _placeBubbles() {
    const vp = this.session?.viewport;
    if (!vp) return;
    for (const [id, el] of this.bubbles) {
      const e = this.entries.get(id);
      if (!e) continue;
      const p = e.actor.screenPoint(this.session.camera, vp);
      el.hidden = !p.visible || e.actor.state !== 'living';
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
  }

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
    this._placeSpeech();
  }

  _placeSpeech() {
    const vp = this.session?.viewport;
    if (!vp) return;
    const p = this.speaker.screenPoint(this.session.camera, vp);
    const b = this.el.bubble;
    const w = b.offsetWidth || 200;
    const x = Math.min(vp.width - w / 2 - 10, Math.max(w / 2 + 10, p.x));
    const y = Math.max(90, Math.min(vp.height - 220, p.y));
    b.style.transform = `translate(${x - w / 2}px, ${y - b.offsetHeight - 14}px)`;
  }

  /* ------------------------------------------------------------ interface */
  /** Quem está no zoológico, cada um com a casinha (ir descansar). */
  _renderPresent() {
    const box = this.el.present;
    box.textContent = '';
    for (const it of this.state?.items.values() || []) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'zoo-presente';
      b.setAttribute('aria-label', `Levar ${nameOf(it.kind, it.type)} para casa`);
      let face;
      if (it.kind === 'animal') face = `<img class="sg-retrato" src="${animalById(it.type).portrait}" alt="" width="40" height="40">`;
      else if (it.kind === 'letra') face = `<span class="sg-letra-grande zoo-presente__letra">${it.type}</span>`;
      else face = `<img class="sg-retrato" src="${CHARACTERS[it.type].portrait}" alt="" width="40" height="40">`;
      b.innerHTML = `${face}<span class="zoo-presente__casa">${icon('casa')}</span>`;
      b.addEventListener('click', () => this.goHome(it.id));
      box.appendChild(b);
    }
    box.hidden = !box.childElementCount;
    for (const btn of this.screen.querySelectorAll('[data-zoo-call]')) {
      btn.classList.toggle('is-presente', !!this.state?.find('personagem', btn.dataset.zooCall));
    }
  }

  _hint(text, iconName = 'carta', duration = 0) {
    clearTimeout(this._hintTimer);
    if (!text) {
      this.el.hint.hidden = true;
      return;
    }
    this.el.hintText.textContent = text;
    this.el.hint.querySelector('use').setAttribute('href', `#i-${iconName}`);
    this.el.hint.hidden = false;
    if (duration) this._hintTimer = setTimeout(() => { this.el.hint.hidden = true; }, duration);
  }

  _help(show) {
    this.el.help.hidden = !show;
    if (show) this.el.help.querySelector('button')?.focus();
  }

  _showLoading(who, urls) {
    this.el.loadingText.textContent = `${who.toUpperCase()} ESTÁ CHEGANDO...`;
    const render = () => { this.el.loadingBar.style.width = `${Math.round(Math.max(0.04, progressOf(urls)) * 100)}%`; };
    render();
    this._stopProgress?.();
    this._stopProgress = onProgress(render);
    this.el.loading.hidden = false;
  }

  _hideLoading() {
    this._stopProgress?.();
    this._stopProgress = null;
    this.el.loading.hidden = true;
  }

  _setScan(state) {
    const scan = this.el.scan;
    scan.dataset.state = state;
    scan.hidden = state === 'found';
    this.el.scanText.innerHTML = state === 'hint'
      ? `<strong>NÃO ENCONTREI A PÁGINA ${ZOO.bookPage}.</strong><span>Chegue mais perto ou mais longe, com a página bem iluminada.</span>`
      : `<strong>ABRA O LIVRO NA PÁGINA ${ZOO.bookPage}</strong><span>a do zoológico, e aponte o celular</span>`;
  }

  _status(step, progress) {
    const text = {
      loading: 'Preparando o zoológico...',
      camera: 'Abrindo a câmera... Se o navegador perguntar, toque em "Permitir".',
      targets: 'Carregando a página e as cartas...',
      preparing: 'Quase pronto...',
      ready: 'Pronto!',
    }[step];
    if (text) this.el.statusText.textContent = text;
    if (step === 'targets' && typeof progress === 'number') this.el.statusBar.style.width = `${Math.round(progress * 100)}%`;
  }
}

function clampPos([x, y], b) {
  return [Math.min(b.maxX, Math.max(b.minX, x)), Math.min(b.maxY, Math.max(b.minY, y))];
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
