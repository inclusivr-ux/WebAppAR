/**
 * ZOOLÓGICO EM AR — as cartas e o palco de brincar (sem a página 22).
 *
 *   1. a criança mostra uma carta para a câmera, em qualquer posição: o
 *      animal (ou a LETRA, nas cartas das vogais) salta do lugar da carta para
 *      o zoológico, um "chão" invisível no meio da tela (o palco de brincar,
 *      o mesmo do livro: ar/poseFollower.js);
 *   2. a carta usada deixa de ser procurada (as duas faces), e o celular logo
 *      acha a próxima. Com os 10 no zoológico, o reconhecimento das cartas
 *      para: o celular só desenha (mais leve);
 *   3. todos ficam juntos, passeiam e se encontram (o urso come o mel da
 *      abelha, o elefante joga água, a onça brinca; o animal acende a letra
 *      da sua inicial);
 *   4. tocar = carinho; um dedo gira o zoológico, dois dedos aproximam; a
 *      casinha leva alguém para descansar (e a carta volta a valer).
 *
 * Antes (versão 2.1) a página 22 tinha que ficar à vista o tempo todo, com as
 * cartas em cima: com muitas cartas a página ficava tampada e o rastreio se
 * perdia (teste da equipe, 10/11/2026). Agora a carta só VALIDA.
 *
 * Os animais e as letras usam o PageActor do livro (passear, carinho); as
 * regras (necessidades, encontros, letras acesas) ficam em zooState.js.
 */
import * as THREE from '../lib/three.js';
import { AR, animalById } from '../config.js';
import { ARSession } from '../ar/arSession.js';
import { createAnimal } from '../ar/modelManager.js';
import { PageActor } from '../ar/pageActor.js';
import { PoseFollower, makePose, stagePose } from '../ar/poseFollower.js';
import { GestureController } from '../ar/gestures.js';
import { DebugHud, debugEnabled } from '../ar/debugHud.js';
import { onProgress, progressOf } from '../lib/download.js';
import { showARError, toast, announce } from '../ui/notifications.js';
import { sparkle } from '../ui/effects.js';
import { sfx } from '../ui/sound.js';
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
const _pose = makePose();

const icon = (name, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/** Nome com artigo, para os avisos ("a Abelha", "o Urso", "a letra A"). */
function nameOf(kind, type) {
  if (kind === 'animal') {
    const a = animalById(type);
    return `${a.article} ${a.name}`;
  }
  return `a letra ${type}`;
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
      present: q('[data-zoo-present]'),
      help: q('[data-zoo-help-box]'),
      status: q('[data-status]'),
      statusText: q('[data-status-text]'),
      statusBar: q('[data-status-bar]'),
    };
    this.gestures = new GestureController(this.stageEl, {
      minZoom: ZOO.stage.minZoom,
      maxZoom: ZOO.stage.maxZoom,
      onTap: (e) => this._tap(e),
    });
    q('[data-action="zoo-help"]').addEventListener('click', () => this._help(true));
    q('[data-action="zoo-help-close"]').addEventListener('click', () => this._help(false));
  }

  /* ------------------------------------------------------------ ciclo de vida */
  async enter() {
    const token = {};
    this.token = token;
    this.active = true;
    this.state = new ZooState();
    this.state.setBounds(ZOO.bounds);
    this.entries = new Map(); // id do zooState → { item, actor, cards }
    this.bubbles = new Map();
    this.timers = new Set();
    this._hideLoading();
    this._renderPresent();
    this._setScan('searching');
    this._hint(null);

    // o mesmo reconhecimento (e as mesmas cartas) do jogo de cartas: o celular prepara uma vez só
    const session = new ARSession({ container: this.stageEl, targets: ZOO.targets, id: 'game', tuning: AR.game });
    this.session = session;
    session.onStatus = (step, p) => this._status(step, p);
    session.onTargetFound = (i) => this._card(i);
    session.onFrame = (dt) => this._frame(dt);
    session.onCameraEnded = () => showARError({ code: 'ended' }, { onRetry: () => this.restart(), screen: this.screen });
    // luz para as letras (os animais já vêm pintados)
    session.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.3, 1, 0.6);
    session.camera.add(sun);
    // o palco: um "chão" invisível na frente da câmera
    this.stage = new THREE.Group();
    this.stage.name = 'palco-do-zoologico';
    session.scene.add(this.stage);
    this.follower = new PoseFollower(this.stage, { smoothMs: 60 });

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
    for (const t of Object.keys(ZOO_CARDS)) session.anchor(Number(t));
    this.gestures.reset();
    this.gestures.setManipulate(true);
    this.gestures.attach();
    if (debugEnabled()) this.debug = new DebugHud(this.screen, session, () => `no zoo ${this.state.count}`);
    this._scanStartedAt = performance.now();
    if (!storage.get('zooCardsHelpSeen', false)) {
      storage.set('zooCardsHelpSeen', true);
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
    for (const t of this.timers || []) clearTimeout(t);
    this.timers?.clear();
    this.gestures.detach();
    this.debug?.dispose();
    this.debug = null;
    this._help(false);
    this._hideLoading();
    if (this.session) {
      this.session.onTargetFound = null;
      await this.session.stop();
    }
    for (const e of this.entries?.values() || []) this._dispose(e);
    this.entries?.clear();
    for (const b of this.bubbles?.values() || []) b.remove();
    this.bubbles?.clear();
    this.stage?.removeFromParent();
    this.session = null;
    this.el.status.hidden = true;
  }

  _later(fn, ms) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (this.active) fn();
    }, ms);
    this.timers.add(t);
  }

  /* ------------------------------------------------------------ cartas */
  /** Uma carta apareceu: traz quem ela mostra (e a carta para de ser procurada). */
  _card(target) {
    if (!this.active) return;
    const card = ZOO_CARDS[target];
    if (!card) return;
    const from = this._cardOnStage(target);
    this._setScan('found');
    // as duas faces da carta deixam de ser procuradas: o celular procura logo a próxima
    this.session.ignoreTarget(target);
    this.session.ignoreTarget(card.twin);
    this._bring(card, from);
  }

  /**
   * Onde a carta está: na tela (para os brilhos) e no chão do palco (de onde
   * o animal salta). Cada imagem do MindAR tem a sua escala, então vale a
   * TELA: o raio da câmera pelo centro da carta até o chão do palco.
   */
  _cardOnStage(target) {
    const card = this.session.anchor(target);
    const camera = this.session.camera;
    const vp = this.session.viewport || { width: 1, height: 1 };
    camera.updateMatrixWorld();
    _v.setFromMatrixPosition(card.matrix).project(camera);
    const screen = { x: ((_v.x + 1) / 2) * vp.width, y: ((1 - _v.y) / 2) * vp.height };
    raycaster.setFromCamera(_ndc.set(_v.x, _v.y), camera);
    this.stage.updateMatrixWorld();
    _normal.set(0, 0, 1).transformDirection(this.stage.matrixWorld);
    _plane.setFromNormalAndCoplanarPoint(_normal, _v.setFromMatrixPosition(this.stage.matrixWorld));
    let at = null;
    if (raycaster.ray.intersectPlane(_plane, _v)) {
      _v.applyMatrix4(_inv.copy(this.stage.matrixWorld).invert());
      const b = this.state.bounds;
      at = [THREE.MathUtils.clamp(_v.x, b.minX, b.maxX), THREE.MathUtils.clamp(_v.y, b.minY, b.maxY)];
    }
    return { screen, at };
  }

  /* ------------------------------------------------------------ quem entra e sai */
  /** Traz um animal ou uma letra para o zoológico (saltando de onde a carta estava). */
  async _bring(card, from) {
    const token = this.token;
    const { kind, type } = card;
    if (this.state.find(kind, type)) return; // já está (as duas faces da carta já saíram da procura)
    // salta de onde a carta está e anda até um lugar livre (as cartas costumam aparecer no meio da tela)
    const spot = this._freeSpot(from.at);
    const item = this.state.add(kind, type, { x: spot[0], y: spot[1] });
    if (!item) return;
    this._hint(null);
    this._renderPresent();
    if (from.screen) sparkle(this.ui, from.screen.x, from.screen.y, { count: 16 });
    sfx.reveal();

    let model;
    const url = kind === 'animal' ? animalById(type).model : null;
    if (url) this._showLoading(nameOf(kind, type), [url]);
    try {
      model = kind === 'animal' ? await createAnimal(animalById(type)) : await createLetter(type);
    } catch (err) {
      console.error(err);
      this.state.remove(item.id);
      this._releaseCard(card, 0);
      this._renderPresent();
      if (this._alive(token)) toast('Não foi possível trazer agora. Verifique a internet e mostre a carta de novo.', { type: 'error' });
      return;
    } finally {
      if (url) this._hideLoading();
    }
    if (!this._alive(token) || !this.state.items.has(item.id)) {
      model.dispose?.();
      return;
    }
    const size = kind === 'animal' ? ZOO.sizes[type] : ZOO.sizes.letra;
    const actor = new PageActor({
      model,
      parent: this.stage,
      aspect: 1,
      place: { home: [item.x, item.y], size, lift: kind === 'animal' && model.flies ? ZOO.beeLift : 0 },
      faceCamera: kind === 'letra',
      // a letra reclina para trás, como uma placa, para quem olha de cima: tem que dar para LER
      lean: kind === 'letra' ? [10, 62] : [40, 38],
    });
    this.entries.set(item.id, { item, actor, card });
    actor.found({ at: from.at || spot, stageBounds: this.state.bounds });
    if (from.at) actor.wander.goTo(spot);
    announce(`${capitalize(nameOf(kind, type))} chegou no zoológico!`);
    this._renderPresent();
    this._checkFull();
  }

  /** Um lugar do palco longe dos outros (e, se der, do lado em que a carta apareceu). */
  _freeSpot(hint) {
    const b = this.state.bounds;
    const others = [...this.state.items.values()];
    let best = null;
    for (let i = 0; i < 18; i++) {
      const p = [b.minX + Math.random() * (b.maxX - b.minX), b.minY + Math.random() * (b.maxY - b.minY)];
      const near = others.reduce((m, o) => Math.min(m, Math.hypot(o.x - p[0], o.y - p[1])), Infinity);
      const score = Math.min(near, 0.35) - (hint ? 0.12 * Math.abs(hint[0] - p[0]) : 0);
      if (!best || score > best.score) best = { p, score };
    }
    return best.p;
  }

  /** Com todos os 10 no zoológico, o reconhecimento das cartas para (o celular só desenha). */
  _checkFull() {
    if (this.state.count >= ZOO.maxItems && this.session?.tracking) {
      this.session.pauseTracking();
      this._hint('TODOS ESTÃO NO ZOOLÓGICO!', 'coracao', 4500);
      sfx.fanfare();
    }
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
    this._renderPresent();
    this._releaseCard(e.card, ZOO.cardCooldown * 1000);
    if (this.session?.running && !this.session.tracking) this.session.resumeTracking();
    await e.actor.leave();
    this._dispose(e);
    this.entries.delete(id);
  }

  /** As duas faces da carta voltam a ser procuradas (depois de um tempinho). */
  _releaseCard(card, ms) {
    const free = () => {
      this.session?.ignoreTarget(card.target, false);
      this.session?.ignoreTarget(card.twin, false);
    };
    if (ms > 0) this._later(free, ms);
    else free();
  }

  _dispose(e) {
    e.actor.dispose();
    e.actor.model.dispose?.();
  }

  /* ------------------------------------------------------------ toque */
  /** Toque curto (gestures.js): carinho. Devolve true se acertou alguém. */
  _tap(event) {
    if (!this.session?.running) return false;
    const list = [...this.entries.values()].filter((e) => e.actor.visible && e.actor.state === 'living');
    if (!list.length) return false;
    const rect = this.stageEl.getBoundingClientRect();
    _ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.session.scene.updateMatrixWorld();
    raycaster.setFromCamera(_ndc, this.session.camera);
    const hit = raycaster.intersectObjects(list.map((e) => e.actor.hit), false)[0];
    if (!hit) return false;
    const actor = hit.object.userData.actor;
    const entry = list.find((e) => e.actor === actor);
    const role = actor.tap();
    if (!role) return true;
    if (entry.item.kind === 'animal') this._events(this.state.caress(entry.item.id));
    sparkle(this.ui, event.clientX - rect.left, event.clientY - rect.top, { hearts: entry.item.kind !== 'letra', count: entry.item.kind === 'letra' ? 10 : 14 });
    sfx.correct();
    return true;
  }

  /* ------------------------------------------------------------ quadro a quadro */
  _frame(dt) {
    this.gestures.update(dt);
    this.follower.update(dt, stagePose(this.session.camera, ZOO.stage, this.gestures.state, _pose));
    for (const e of this.entries.values()) {
      e.actor.update(dt);
      if (e.actor.state === 'living') this.state.move(e.item.id, e.actor.wander.pos[0], e.actor.wander.pos[1]);
    }
    this._events(this.state.tick(dt));
    this._placeBubbles();
    if (this.el.scan.dataset.state === 'searching' && performance.now() - this._scanStartedAt > 9000) this._setScan('hint');
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
    this._later(() => {
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
      const face = it.kind === 'animal'
        ? `<img class="sg-retrato" src="${animalById(it.type).portrait}" alt="" width="40" height="40">`
        : `<span class="sg-letra-grande zoo-presente__letra">${it.type}</span>`;
      b.innerHTML = `${face}<span class="zoo-presente__casa">${icon('casa')}</span>`;
      b.addEventListener('click', () => this.goHome(it.id));
      box.appendChild(b);
    }
    box.hidden = !box.childElementCount;
    if (this.state && !this.state.count && this.el.scan.dataset.state === 'found') this._setScan('searching');
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

  /** A moldura grande só aparece com o zoológico vazio. */
  _setScan(state) {
    const scan = this.el.scan;
    if (state === 'searching') this._scanStartedAt = performance.now();
    scan.dataset.state = state;
    scan.hidden = state === 'found';
    this.el.scanText.innerHTML = state === 'hint'
      ? '<strong>NÃO ENCONTREI A CARTA.</strong><span>Mostre uma carta de cada vez, bem iluminada, a uns 20 cm.</span>'
      : '<strong>MOSTRE UMA CARTA PARA A CÂMERA</strong><span>Em qualquer posição. O animal vem para o zoológico!</span>';
  }

  _status(step, progress) {
    const text = {
      loading: 'Preparando o zoológico...',
      camera: 'Abrindo a câmera... Se o navegador perguntar, toque em "Permitir".',
      targets: 'Carregando as cartas...',
      preparing: 'Quase pronto...',
      ready: 'Pronto!',
    }[step];
    if (text) this.el.statusText.textContent = text;
    if (step === 'targets' && typeof progress === 'number') this.el.statusBar.style.width = `${Math.round(progress * 100)}%`;
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
