/**
 * SINALIZE! — a tela do jogo.
 *
 *   carta na tela → OLHE: o Fauston faz o sinal duas vezes
 *   → 3, 2, 1 → SUA VEZ: a criança faz o sinal para a câmera (frontal)
 *   → a câmera reconheceu: ISSO! + pontos → próximo desafio (ordem fixa)
 *   → o tempo acabou: QUASE! → TENTAR DE NOVO (vê o sinal de novo) ou PRÓXIMO
 *
 * A câmera nunca é obrigatória: SEM CÂMERA troca para ERREI · ACERTEI.
 * Nada de esqueleto da mão nem termos técnicos na tela; a imagem da câmera é
 * analisada no aparelho e não é gravada.
 *
 * O vídeo do Fauston (sem o fundo verde) é desenhado no painel com o mesmo
 * renderer WebGL do app; a câmera é um <video> comum, espelhado na frontal.
 */
import * as THREE from '../lib/three.js';
import { LIBRAS } from '../config.js';
import { getRenderer } from '../ar/arSession.js';
import { LibrasVideo } from '../ar/videoChroma.js';
import { announce, clearToasts, toast } from '../ui/notifications.js';
import { storage } from '../ui/storage.js';
import { isSoundOn, setSound, sfx, unlockAudio } from '../ui/sound.js';
import { celebrate, sparkle } from '../ui/effects.js';
import { SIGN_GAME, clipFor } from './signConfig.js';
import { PHASE, SignMatch } from './signState.js';
import { HandTracker } from './handTracker.js';
import { createRecognizer } from './signRecognizers.js';
import { applyMatch, loadRecords, saveRecords } from './signRecords.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const icon = (name, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export class SignGame {
  constructor(screen) {
    this.screen = screen;
    const q = (s) => screen.querySelector(s);
    this.el = {
      sound: q('[data-action="sound"]'),
      progress: q('[data-progress]'),
      round: q('[data-round-label]'),
      score: q('[data-score]'),
      card: q('[data-card-img]'),
      stepBox: q('[data-step-box]'),
      stepText: q('[data-step-text]'),
      name: q('[data-target-name]'),
      videoPanel: q('[data-video-panel]'),
      videoStage: q('[data-video-stage]'),
      camPanel: q('[data-cam-panel]'),
      cam: q('[data-cam-video]'),
      camMsg: q('[data-cam-msg]'),
      hold: q('[data-hold]'),
      countdown: q('[data-countdown]'),
      actions: q('[data-sz-actions]'),
      self: q('[data-sz-self]'),
      retry: q('[data-sz-retry]'),
      feedback: q('[data-feedback]'),
      summary: q('[data-summary]'),
      status: q('[data-status]'),
      statusText: q('[data-status-text]'),
      statusBar: q('[data-status-bar]'),
    };
    const on = (sel, fn) => q(sel).addEventListener('click', fn);
    on('[data-action="watch-again"]', () => this.watchAgain());
    on('[data-action="no-camera"]', () => this.setSelfMode(!this.selfMode));
    on('[data-action="self-right"]', () => this._selfAnswer(true));
    on('[data-action="self-wrong"]', () => this._selfAnswer(false));
    on('[data-action="try-again"]', () => this.watchAgain());
    on('[data-action="skip-round"]', () => this.skipRound());
    on('[data-action="flip-camera"]', () => this.flipCamera());
    on('[data-action="replay"]', () => this.newMatch());
    this.el.sound.addEventListener('click', () => {
      setSound(!isSoundOn());
      this._renderSound();
      if (isSoundOn()) sfx.tick();
    });
    this.tracker = new HandTracker();
    this.facing = SIGN_GAME.camera.facing;
  }

  /* ------------------------------------------------------------ ciclo de vida */
  async enter() {
    this.active = true;
    this.token = {};
    const token = this.token;
    unlockAudio();
    this._renderSound();
    this.el.summary.hidden = true;
    this.el.feedback.hidden = true;
    this._showButtons('watch');
    this.selfMode = false;
    this.el.camPanel.hidden = false;
    this._renderCameraButton();
    this.match = new SignMatch(SIGN_GAME);
    this._startVideoPanel();

    this.el.status.hidden = false;
    this.el.statusText.textContent = 'Preparando o jogo...';
    // o reconhecimento de mãos baixa enquanto a câmera abre
    const trackerReady = this.selfMode ? Promise.resolve(null) : this.tracker.load((p) => {
      this.el.statusBar.style.width = `${Math.round(p * 100)}%`;
    }).catch((err) => {
      console.warn('[sinalize] reconhecimento indisponível', err);
      return 'erro';
    });
    if (!this.selfMode) await this._openCamera();
    if (!this._alive(token)) return;
    const loaded = await Promise.race([trackerReady, sleep(20000).then(() => 'demorou')]);
    if (!this._alive(token)) return;
    this.el.status.hidden = true;
    if (!this.selfMode && (loaded === 'erro' || loaded === 'demorou' || !this.stream)) {
      toast('A câmera não está disponível agora. Jogue com os botões ERREI e ACERTEI.', { type: 'info', duration: 5000 });
      this.setSelfMode(true);
    }
    this.newMatch();
  }

  async leave() {
    this.active = false;
    this.token = {};
    cancelAnimationFrame(this._raf);
    this._stopCamera();
    this.libras?.dispose();
    this.libras = null;
    const renderer = getRenderer();
    renderer.setAnimationLoop(null);
    if (renderer.domElement.parentNode === this.el.videoStage) {
      renderer.clear();
      renderer.domElement.remove();
    }
    window.removeEventListener('resize', this._onResize);
    this.el.status.hidden = true;
    clearToasts();
  }

  _alive(token) {
    return this.active && token === this.token;
  }

  /* ------------------------------------------------------------ câmera */
  async _openCamera() {
    this._stopCamera();
    const { width, height } = SIGN_GAME.camera;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: this.facing }, width: { ideal: width }, height: { ideal: height } },
      });
    } catch (err) {
      console.warn('[sinalize] câmera', err);
      this.stream = null;
      this.el.camPanel.classList.add('is-desligada');
      return;
    }
    if (!this.active) {
      this._stopCamera();
      return;
    }
    const video = this.el.cam;
    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;
    video.classList.toggle('is-espelho', this.facing === 'user');
    await video.play().catch(() => {});
    this.el.camPanel.classList.remove('is-desligada');
  }

  _stopCamera() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.el.cam.srcObject) this.el.cam.srcObject = null;
  }

  async flipCamera() {
    this.facing = this.facing === 'user' ? 'environment' : 'user';
    if (!this.selfMode) await this._openCamera();
  }

  /** Sem câmera: a criança (ou o adulto) confirma com ERREI · ACERTEI. O mesmo botão volta para a câmera. */
  async setSelfMode(on) {
    this.selfMode = on;
    this._renderCameraButton();
    if (on) {
      cancelAnimationFrame(this._raf);
      this._stopCamera();
      this.el.camPanel.hidden = true;
      if (this.match?.phase === PHASE.TRY) this._showButtons('self');
      return;
    }
    this.el.camPanel.hidden = false;
    await this._openCamera();
    this.tracker.load().catch(() => {});
    if (this.match?.phase === PHASE.TRY) this.watchAgain();
  }

  _renderCameraButton() {
    const b = this.screen.querySelector('[data-action="no-camera"]');
    b.innerHTML = `${icon('camera')} ${this.selfMode ? 'COM CÂMERA' : 'SEM CÂMERA'}`;
  }

  /* ------------------------------------------------------------ vídeo do Fauston */
  _startVideoPanel() {
    const renderer = getRenderer();
    this.el.videoStage.appendChild(renderer.domElement);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.hud = { scene: new THREE.Scene(), camera: new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10) };
    this.libras = new LibrasVideo({ chroma: LIBRAS.chroma, crop: LIBRAS.crop });
    this.libras.setEnabled(true);
    this.libras.onLayout = () => this._layoutVideo();
    this.libras.onError = () => toast('O vídeo de LIBRAS não pôde ser carregado agora.', { type: 'warning' });
    this.hud.scene.add(this.libras.mesh);
    this._onResize = () => this._layoutVideo();
    window.addEventListener('resize', this._onResize);
    this._layoutVideo();
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      this.libras?.update(Math.min(clock.getDelta(), 0.1));
      renderer.autoClear = true;
      renderer.render(this.hud.scene, this.hud.camera);
    });
  }

  _layoutVideo() {
    const r = this.el.videoStage.getBoundingClientRect();
    if (!r.width || !this.libras) return;
    const renderer = getRenderer();
    renderer.setSize(r.width, r.height);
    const c = this.hud.camera;
    c.right = r.width;
    c.top = r.height;
    c.updateProjectionMatrix();
    const h = Math.min(r.height, r.width / this.libras.aspect);
    const w = h * this.libras.aspect;
    this.libras.place({ x: (r.width - w) / 2, y: 0, height: h });
  }

  _playClip(item) {
    const clip = clipFor(item);
    this.libras.setSource(clip.src);
    this.libras.setEnabled(true);
    return this.libras.playSegment(clip.start, clip.end, { repeat: clip.repeat });
  }

  /* ------------------------------------------------------------ partida */
  newMatch() {
    this.token = {};
    this.el.summary.hidden = true;
    this.match.start();
    this._renderHud();
    this._round();
  }

  async _round() {
    const token = this.token;
    this.el.feedback.hidden = true;
    const item = this.match.nextRound();
    this._renderHud();
    if (!item) {
      this._finish();
      return;
    }
    this._showItem(item);
    await sleep(500);
    if (!this._alive(token)) return;
    await this._watchAndTry(token);
  }

  async _watchAndTry(token) {
    const item = this.match.round.item;
    cancelAnimationFrame(this._raf);
    this._showButtons('watch');
    this._step('olhe', 'olho', 'OLHE O SINAL');
    this.el.videoPanel.classList.add('is-olhe');
    announce(`Olhe o sinal: ${item.label}.`);
    await this._playClip(item);
    this.el.videoPanel.classList.remove('is-olhe');
    if (!this._alive(token) || this.match.phase !== PHASE.WATCH) return;
    await this._countdown(token);
    if (!this._alive(token) || this.match.phase !== PHASE.WATCH) return;
    this.match.startTry();
    this._step('vez', 'mao', 'SUA VEZ!');
    announce('Sua vez! Faça o sinal.');
    sfx.reveal();
    if (this.selfMode) {
      this._showButtons('self');
      return;
    }
    this._showButtons('watch');
    this.recognizer = createRecognizer(item, SIGN_GAME.recognition);
    this._camMsg(item.kind === 'animal' ? 'FAÇA O SINAL' : 'MOSTRE A MÃO');
    this._loop(token);
  }

  async _countdown(token) {
    const box = this.el.countdown;
    box.hidden = false;
    for (let n = SIGN_GAME.timing.countdown; n > 0; n--) {
      box.textContent = n;
      box.classList.remove('is-pulso');
      void box.offsetWidth;
      box.classList.add('is-pulso');
      sfx.tick();
      await sleep(700);
      if (!this._alive(token)) break;
    }
    box.hidden = true;
  }

  _loop(token) {
    const tick = () => {
      if (!this._alive(token) || this.match.phase !== PHASE.TRY || this.selfMode) return;
      const now = performance.now();
      const hands = this.tracker.ready ? this.tracker.detect(this.el.cam, now) : null;
      if (hands) {
        const r = this.recognizer.update(hands, now);
        this.el.hold.style.width = `${Math.round((r.progress || 0) * 100)}%`;
        this.el.camPanel.classList.toggle('sg-cam--confere', r.state === 'match');
        if (r.state === 'nohand') this._camMsg(this.match.round.item.kind === 'animal' ? 'MOSTRE AS MÃOS' : 'MOSTRE A MÃO');
        else if (r.state === 'match') this._camMsg('ISSO! CONTINUE...');
        else this._camMsg('OLHE A CARTA E TENTE');
        if (r.event === 'correct') {
          this._success();
          return;
        }
      }
      if (this.match.tryElapsed > SIGN_GAME.timing.tryFor) {
        this._timeout();
        return;
      }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  async _success({ self = false } = {}) {
    const token = this.token;
    const result = this.match.correct({ self });
    if (!result) return;
    this.el.camPanel.classList.remove('sg-cam--confere');
    this.el.camPanel.classList.add('sg-cam--acertou');
    this._camMsg('ISSO!');
    this._step('certo', 'check', 'ISSO!');
    this._renderHud();
    sfx.correct();
    const r = this.el.camPanel.getBoundingClientRect();
    sparkle(this.screen, r.left + r.width / 2, r.top + r.height / 2, { count: 18 });
    this._feedback('certo', 'check', 'ISSO!', `Você fez ${this.match.round.item.label}!`, `+${result.total}`);
    announce(`Isso! Mais ${result.total} pontos.`);
    this._showButtons('none');
    await sleep(SIGN_GAME.timing.nextMs);
    if (!this._alive(token)) return;
    this.el.camPanel.classList.remove('sg-cam--acertou');
    this._round();
  }

  _timeout() {
    this.match.miss();
    this.el.camPanel.classList.remove('sg-cam--confere');
    this._camMsg('');
    this._step('quase', 'repetir', 'QUASE!');
    this._feedback('quase', 'olho', 'QUASE!', 'Vamos ver o sinal de novo?', '', 2600);
    sfx.wrong();
    announce('Quase! Vamos ver o sinal de novo?');
    this._showButtons('retry');
  }

  _selfAnswer(right) {
    if (this.match.phase !== PHASE.TRY) return;
    if (right) this._success({ self: true });
    else this._timeout();
  }

  /** Ver o sinal de novo (também é o "TENTAR DE NOVO"). */
  async watchAgain() {
    if (![PHASE.TRY, PHASE.WATCH].includes(this.match?.phase)) return;
    this.token = {};
    const token = this.token;
    this.match.watchAgain();
    this.el.feedback.hidden = true;
    this.libras.stop();
    await this._watchAndTry(token);
  }

  skipRound() {
    if (!this.match.skip()) return;
    this.token = {};
    this.libras.stop();
    sfx.skip();
    this._round();
  }

  _finish() {
    const s = this.match.summary();
    const before = loadRecords(storage);
    const { records, improved } = applyMatch(before, s);
    saveRecords(storage, records);
    const box = this.el.summary;
    box.querySelector('[data-sum="signs"]').textContent = `${s.signsCorrect}/${s.total}`;
    box.querySelector('[data-sum="score"]').textContent = s.score;
    box.querySelector('[data-sum="record"]').textContent = records.bestScore;
    box.querySelector('[data-sum-new-record]').hidden = !improved.score;
    box.querySelector('[data-sum-stars]').innerHTML = [1, 2, 3].map((n) => icon('estrela', `ico${n <= s.stars ? ' is-acesa' : ''}`)).join('');
    box.hidden = false;
    this._showButtons('none');
    sfx.fanfare();
    celebrate(this.screen, 60);
    announce(`Fim! ${s.signsCorrect} sinais de ${s.total}, ${s.score} pontos.`);
    box.querySelector('[data-action="replay"]').focus();
  }

  /* ------------------------------------------------------------ interface */
  _showItem(item) {
    const img = this.el.card;
    img.src = `assets/img/cartas-mini/carta${item.card}.webp`;
    img.alt = `Carta: ${item.label} em LIBRAS`;
    this.el.name.textContent = item.label;
  }

  _step(kind, iconName, text) {
    const box = this.el.stepBox;
    box.classList.toggle('is-vez', kind === 'vez');
    box.classList.toggle('is-certo', kind === 'certo');
    box.classList.toggle('is-quase', kind === 'quase');
    this.el.stepText.innerHTML = `${icon(iconName)} ${text}`;
  }

  _camMsg(text) {
    if (this.el.camMsg.textContent !== text) this.el.camMsg.textContent = text;
    if (!text) this.el.hold.style.width = '0%';
  }

  _showButtons(which) {
    this.el.actions.hidden = which !== 'watch';
    this.el.self.hidden = which !== 'self';
    this.el.retry.hidden = which !== 'retry';
  }

  _feedback(kind, iconName, title, text, points = '', duration = 0) {
    const box = this.el.feedback;
    box.className = `faixa faixa--${kind}`;
    box.innerHTML = `${icon(iconName, 'ico faixa__ico')}<span><b class="faixa__titulo">${title}</b><span class="faixa__texto"></span></span>${points ? `<b class="faixa__pontos">${points}</b>` : ''}`;
    box.querySelector('.faixa__texto').textContent = text;
    box.hidden = false;
    clearTimeout(this._feedbackTimer);
    this._feedbackTimer = setTimeout(() => { box.hidden = true; }, duration || SIGN_GAME.timing.nextMs);
  }

  _renderHud() {
    const m = this.match;
    const total = m.rounds;
    const n = Math.max(1, Math.min(total, (m.index ?? 0) + 1));
    this.el.round.textContent = `${n} DE ${total}`;
    this.el.score.textContent = m.stats?.score ?? 0;
    const done = m.results?.length || 0;
    this.el.progress.style.width = `${(done / total) * 100}%`;
  }

  _renderSound() {
    const on = isSoundOn();
    this.el.sound.querySelector('use').setAttribute('href', on ? '#i-som' : '#i-som-off');
    this.el.sound.setAttribute('aria-pressed', String(on));
    this.el.sound.setAttribute('aria-label', on ? 'Desligar sons' : 'Ligar sons');
  }
}
