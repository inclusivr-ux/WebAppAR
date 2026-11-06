/**
 * JOGO DE CARTAS — ache o sinal!
 *
 *   o jogo mostra o animal (ilustração do Igor) ou a letra
 *   → a criança procura, entre as cartas com a face de LIBRAS para cima,
 *     o sinal que combina e mostra para a câmera
 *   → acertou: "ISSO!" + pontos → próximo desafio (sem embaralhar de novo)
 *   … os 10 pares da partida → resumo → JOGAR DE NOVO (nova semente)
 *
 * As regras ficam em gameState.js (testadas em Node). Esta tela cuida da
 * câmera (MindAR, mesmas cartas de sempre), da interface e dos efeitos.
 */
import * as THREE from '../lib/three.js';
import { AR, CARD_PAIRS, GAME } from '../config.js';
import { ARSession } from '../ar/arSession.js';
import { loadTargets } from '../ar/targets.js';
import { CardGameEngine, PHASE } from './gameState.js';
import { showARError, toast, announce, clearToasts } from '../ui/notifications.js';
import { storage } from '../ui/storage.js';
import { isSoundOn, setSound, sfx, unlockAudio } from '../ui/sound.js';
import { celebrate } from '../ui/effects.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SAVE_KEY = 'cartas';
const RECORD_KEY = 'gameRecord';
const icon = (name, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/** Lista de cartas a partir do manifesto (cartas.json) ou da contagem do .mind. */
export function buildCardList(manifest, count) {
  const list = (manifest?.targets?.length ? manifest.targets : Array.from({ length: count }, (_, i) => ({
    index: i, file: `cartas/carta${i + 1}.png`,
  }))).slice(0, count || undefined);
  return list.map((t, index) => {
    const id = Number(/(\d+)\.\w+$/.exec(t.file)?.[1]) || index + 1;
    return { index, id, file: t.file, label: GAME.labels?.[id] || `Carta ${id}` };
  });
}

/** Há uma partida salva para continuar? */
export function savedGameInfo() {
  const state = storage.get(SAVE_KEY, null);
  if (!state?.deck || state.phase === PHASE.MATCH_COMPLETE) return null;
  const used = state.deck.position || 0;
  if (!used) return null;
  return { used, total: state.deck.order?.length || 0, score: state.stats?.score || 0 };
}

export function clearSavedGame() {
  storage.remove(SAVE_KEY);
}

/* ------------------------------------------------ moldura na carta reconhecida (AR) */
const FRAME_FRAGMENT = /* glsl */`
uniform vec3 color;
uniform float aspect;
uniform float opacity;
uniform float time;
varying vec2 vUv;
float roundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 p = (vUv - 0.5) * vec2(1.0, aspect);
  float d = roundRect(p, vec2(0.5, aspect * 0.5) - 0.035, 0.07);
  float line = 1.0 - smoothstep(0.015, 0.032, abs(d));
  float glow = (1.0 - smoothstep(0.0, 0.1, abs(d))) * (0.45 + 0.25 * sin(time * 6.0));
  float a = max(line, glow) * opacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(color, a);
}`;

class CardFrame {
  constructor(anchor, aspect) {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.14, aspect + 0.14), new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: FRAME_FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: { color: { value: new THREE.Color() }, aspect: { value: (aspect + 0.14) / 1.14 }, opacity: { value: 1 }, time: { value: 0 } },
    }));
    this.mesh.position.z = 0.01;
    this.mesh.visible = false;
    anchor.add(this.mesh);
  }

  show(kind) {
    this.mesh.material.uniforms.color.value.set(kind === 'hit' ? 0x63cbc9 : kind === 'flip' ? 0xf4b224 : 0xf799d1);
    this.mesh.visible = true;
    this.t = 0;
  }

  hide() { this.mesh.visible = false; }

  update(dt) {
    if (!this.mesh.visible) return;
    this.t += dt;
    this.mesh.material.uniforms.time.value = this.t;
  }
}

/* ------------------------------------------------ experiência */
export class GameExperience {
  constructor(screen) {
    this.screen = screen;
    this.stageEl = screen.querySelector('[data-ar-stage]');
    const q = (s) => screen.querySelector(s);
    this.el = {
      targetSlot: q('[data-target-slot]'),
      targetImg: q('[data-target-img]'),
      targetName: q('[data-target-name]'),
      progress: q('[data-progress]'),
      round: q('[data-round-label]'),
      score: q('[data-stat="score"]'),
      skip: q('[data-action="skip"]'),
      sound: q('[data-action="sound"]'),
      scan: q('[data-scan]'),
      reveal: q('[data-reveal]'),
      feedback: q('[data-feedback]'),
      summary: q('[data-summary]'),
      status: q('[data-status]'),
      statusText: q('[data-status-text]'),
      statusBar: q('[data-status-bar]'),
    };
    this.el.skip.addEventListener('click', () => this.skip());
    this.el.sound.addEventListener('click', () => {
      setSound(!isSoundOn());
      this._renderSound();
      if (isSoundOn()) sfx.tick();
    });
    q('[data-action="new-deck"]').addEventListener('click', () => this.newMatch());
  }

  /* ------------------------------------------------ ciclo de vida */
  async enter({ resume = false } = {}) {
    this.active = true;
    this.token = {};
    unlockAudio();
    this._renderSound();
    this.el.summary.hidden = true;
    this.el.feedback.hidden = true;
    this.el.reveal.hidden = true;
    this.el.skip.disabled = true;
    this._clearTarget();

    const session = new ARSession({ container: this.stageEl, targets: GAME.targets, id: 'game', tuning: AR.game });
    this.session = session;
    session.onStatus = (step, p) => this._status(step, p);
    session.onTargetFound = (i) => this._found(i);
    session.onTargetLost = (i) => this.frames?.[i]?.hide();
    session.onFrame = (dt) => this.frames?.forEach((f) => f.update(dt));
    session.onSuspend = () => this.engine?.pause();
    session.onResume = () => this.engine?.resume();
    session.onCameraEnded = () => showARError({ code: 'ended' }, { onRetry: () => this.restart(), screen: this.screen });

    const token = this.token;
    this.el.status.hidden = false;
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

    const { manifest } = await loadTargets(GAME.targets);
    if (!this._alive(token)) return;
    this.cards = buildCardList(manifest, session.targetCount);
    this.byIndex = new Map(this.cards.map((c) => [c.index, c]));
    this.frames = this.cards.map((c) => new CardFrame(session.anchor(c.index), session.aspect(c.index)));

    const saved = resume ? storage.get(SAVE_KEY, null) : null;
    this.engine = new CardGameEngine({ pairs: CARD_PAIRS, scoring: GAME.scoring, hintCooldown: GAME.wrongHintCooldown, state: saved });
    this.recordAtStart = storage.get(RECORD_KEY, 0);
    this._renderStats();

    if (this.engine.phase === PHASE.SEARCHING) {
      this._showTarget(this.engine.pair);
      this._startSearching();
      toast('Partida retomada de onde parou!', { type: 'success' });
    } else if (this.engine.phase === PHASE.MATCH_COMPLETE) {
      this._showSummary();
    } else {
      if (!saved) await this._shuffle();
      if (this._alive(token)) this.nextMission();
    }
  }

  async restart() {
    await this.leave();
    if (!this.screen.hidden) await this.enter({ resume: true });
  }

  async leave() {
    this.active = false;
    this.token = {};
    clearTimeout(this._feedbackTimer);
    this._save();
    if (this.session) {
      this.session.onTargetFound = this.session.onTargetLost = null;
      await this.session.stop();
    }
    this.session = null;
    this.frames = null;
    this.el.status.hidden = true;
  }

  _alive(token) {
    return this.active && token === this.token;
  }

  _save() {
    if (this.engine) storage.set(SAVE_KEY, this.engine.toJSON());
  }

  /* ------------------------------------------------ partida */
  /** Embaralhar: só no começo da partida. */
  async _shuffle() {
    const token = this.token;
    this.el.reveal.hidden = false;
    sfx.reveal();
    announce('Embaralhando as cartas.');
    await sleep(GAME.shuffleTime * 1000);
    if (this._alive(token)) this.el.reveal.hidden = true;
  }

  nextMission() {
    const engine = this.engine;
    this.frames?.forEach((f) => f.hide());
    this.el.feedback.hidden = true;
    const pair = engine.startMission();
    if (!pair) {
      this._showSummary();
      return;
    }
    this._showTarget(pair);
    this._renderStats();
    this._save();
    sfx.reveal();
    announce(`Ache o sinal: ${pair.label}.`);
    this._startSearching();
    // a carta certa pode já estar na frente da câmera
    const answer = this.cards.find((c) => c.id === pair.answer);
    if (answer && this.session.isVisible(answer.index)) this._found(answer.index);
  }

  _startSearching() {
    this.el.skip.disabled = false;
    this.el.scan.hidden = false;
  }

  async skip() {
    const r = this.engine?.skip();
    if (!r || r.type !== 'skipped') return;
    sfx.skip();
    this._renderStats();
    this._save();
    this.el.skip.disabled = true;
    await sleep(250);
    if (this.active) this._next();
  }

  _next() {
    if (this.engine.matchComplete) this._showSummary();
    else this.nextMission();
  }

  async newMatch() {
    this.engine.newMatch();
    this.recordAtStart = storage.get(RECORD_KEY, 0);
    this.el.summary.hidden = true;
    this._renderStats();
    this._save();
    await this._shuffle();
    if (this.active) this.nextMission();
  }

  /* ------------------------------------------------ detecção */
  _found(index) {
    const card = this.byIndex?.get(index);
    if (!card || !this.engine) return;
    const result = this.engine.detect(card.id);
    const frame = this.frames?.[index];
    if (result.type === 'hit') this._hit(result, frame);
    else if (result.type === 'flip') this._flip(result, frame);
    else if (result.type === 'wrong') this._wrong(result, frame);
  }

  async _hit(result, frame) {
    const token = this.token;
    frame?.show('hit');
    sfx.correct();
    celebrate(this.screen, 34);
    this.el.skip.disabled = true;
    this.el.scan.hidden = true;
    this._feedback('certo', 'check', 'ISSO!', `Este é o sinal: ${result.pair.label.toUpperCase()}`, `+${result.total}`);
    announce(`Isso! Mais ${result.total} pontos.`);
    this._renderStats();
    this._updateRecord();
    this._save();
    await sleep(GAME.delayNextMission * 1000);
    if (!this._alive(token)) return;
    this._next();
  }

  _flip(result, frame) {
    frame?.show('flip');
    sfx.tick();
    this._feedback('info', 'repetir', 'VIRE A CARTA!', 'Mostre o lado do sinal (a mão).', '', 2400);
    announce('Vire a carta e mostre o lado do sinal.');
  }

  _wrong(result, frame) {
    frame?.show('wrong');
    sfx.wrong();
    this._feedback('quase', 'olho', 'QUASE!', `Procure outro sinal para: ${result.pair.label.toUpperCase()}`, '', 2200);
    announce('Quase! Procure outra carta.');
  }

  /* ------------------------------------------------ interface */
  _renderStats() {
    const e = this.engine;
    this.el.score.textContent = e.stats.score;
    const round = Math.max(1, Math.min(e.total, e.round));
    this.el.round.textContent = `${round} DE ${e.total}`;
    this.el.progress.style.width = `${(Math.max(0, e.round - (e.phase === PHASE.SEARCHING ? 1 : 0)) / e.total) * 100}%`;
  }

  _showTarget(pair) {
    const img = this.el.targetImg;
    img.src = pair.image;
    img.alt = pair.label;
    img.className = `alvo__img ${pair.kind === 'animal' ? 'is-retrato' : 'is-carta'}`;
    this.el.targetName.textContent = pair.kind === 'animal' ? pair.label : `LETRA ${pair.id}`;
    this.el.targetSlot.classList.add('has-card');
  }

  _clearTarget() {
    this.el.targetSlot.classList.remove('has-card');
    this.el.targetName.textContent = '';
    this.el.scan.hidden = true;
  }

  _feedback(kind, iconName, title, text, points = '', duration = 0) {
    const box = this.el.feedback;
    box.className = `faixa faixa--${kind}`;
    box.innerHTML = `${icon(iconName, 'ico faixa__ico')}<span><b class="faixa__titulo">${title}</b><span class="faixa__texto"></span></span>${points ? `<b class="faixa__pontos">${points}</b>` : ''}`;
    box.querySelector('.faixa__texto').textContent = text;
    box.hidden = false;
    clearTimeout(this._feedbackTimer);
    if (duration) this._feedbackTimer = setTimeout(() => { box.hidden = true; }, duration);
  }

  _showSummary() {
    clearToasts();
    this.el.feedback.hidden = true;
    const s = this.engine.summary();
    const record = Math.max(storage.get(RECORD_KEY, 0), this.recordAtStart || 0);
    const box = this.el.summary;
    box.querySelector('[data-sum="hits"]').textContent = `${s.hits}/${s.total}`;
    box.querySelector('[data-sum="score"]').textContent = s.score;
    box.querySelector('[data-sum="record"]').textContent = Math.max(record, s.score);
    box.querySelector('[data-sum-new-record]').hidden = !(s.score > 0 && s.score > (this.recordAtStart || 0));
    box.querySelector('[data-sum-stars]').innerHTML = [1, 2, 3].map((n) => icon('estrela', `ico${n <= s.stars ? ' is-acesa' : ''}`)).join('');
    box.hidden = false;
    this.el.skip.disabled = true;
    this.el.scan.hidden = true;
    this._updateRecord();
    this._save();
    sfx.fanfare();
    celebrate(this.screen, 60);
    announce(`Fim da partida! ${s.hits} acertos de ${s.total}, ${s.score} pontos.`);
    box.querySelector('[data-action="new-deck"]').focus();
  }

  _updateRecord() {
    const record = storage.get(RECORD_KEY, 0);
    if (this.engine.stats.score > record) storage.set(RECORD_KEY, this.engine.stats.score);
  }

  _renderSound() {
    const on = isSoundOn();
    this.el.sound.querySelector('use').setAttribute('href', on ? '#i-som' : '#i-som-off');
    this.el.sound.setAttribute('aria-pressed', String(on));
    this.el.sound.setAttribute('aria-label', on ? 'Desligar sons' : 'Ligar sons');
  }

  _status(step, progress) {
    const text = {
      loading: 'Preparando o jogo...',
      camera: 'Abrindo a câmera... Se o navegador perguntar, toque em "Permitir".',
      targets: 'Carregando as cartas...',
      preparing: 'Quase pronto...',
    }[step];
    if (text) this.el.statusText.textContent = text;
    if (step === 'targets' && typeof progress === 'number') this.el.statusBar.style.width = `${Math.round(progress * 100)}%`;
  }
}
