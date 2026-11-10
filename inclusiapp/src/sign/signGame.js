/**
 * SINALIZE! — a tela do jogo.
 *
 *   a vogal na tela (a letra e a carta do sinal) → OLHE: o intérprete faz o
 *   sinal duas vezes → SUA VEZ: "FAÇA O SINAL DO A PARA A CÂMERA", com calma
 *   → a câmera reconheceu: ISSO! → próximo desafio (ordem fixa)
 *   → a câmera viu outro sinal: QUASE! Olhe de novo... (e a criança continua)
 *
 * Sem pontos, sem contagem regressiva e sem tempo limite desde a versão 2.2:
 * o relógio fazia a criança se apressar, e o reconhecimento da mão funciona
 * melhor com calma. Só certo e "quase", com a instrução bem clara.
 *
 * O jogo precisa da câmera, como os outros jogos (não há botões "acertei" e
 * "errei", que dariam para trapacear). Nada de esqueleto da mão nem termos
 * técnicos na tela; a imagem da câmera é analisada no aparelho e nunca é
 * gravada nem enviada.
 *
 * O vídeo do intérprete (sem o fundo verde) é desenhado no painel com o mesmo
 * renderer WebGL do app; a câmera é um <video> comum, espelhado na frontal.
 */
import * as THREE from '../lib/three.js';
import { LIBRAS } from '../config.js';
import { getRenderer } from '../ar/arSession.js';
import { LibrasVideo } from '../ar/videoChroma.js';
import { announce, clearToasts, toast } from '../ui/notifications.js';
import { isSoundOn, setSound, sfx, unlockAudio } from '../ui/sound.js';
import { celebrate, sparkle } from '../ui/effects.js';
import { SIGN_GAME, clipFor } from './signConfig.js';
import { PHASE, SignMatch } from './signState.js';
import { HandTracker } from './handTracker.js';
import { createRecognizer } from './signRecognizers.js';

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
      actions: q('[data-sz-actions]'),
      letter: q('[data-letter]'),
      noCamera: q('[data-no-camera]'),
      noCameraText: q('[data-no-camera-text]'),
      feedback: q('[data-feedback]'),
      summary: q('[data-summary]'),
      status: q('[data-status]'),
      statusText: q('[data-status-text]'),
      statusBar: q('[data-status-bar]'),
    };
    const on = (sel, fn) => screen.querySelectorAll(sel).forEach((b) => b.addEventListener('click', fn));
    on('[data-action="watch-again"]', () => this.watchAgain());
    on('[data-action="skip-round"]', () => this.skipRound());
    on('[data-action="flip-camera"]', () => this.flipCamera());
    on('[data-action="replay"]', () => this.newMatch());
    on('[data-action="retry-camera"]', () => this.restart());
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
    this.el.noCamera.hidden = true;
    this._showButtons('watch');
    this.match = new SignMatch(SIGN_GAME);
    this._startVideoPanel();

    this.el.status.hidden = false;
    this.el.statusText.textContent = 'Preparando o jogo...';
    this.el.statusBar.style.width = '0%';
    // o reconhecimento de mãos baixa enquanto a câmera abre
    const trackerReady = this.tracker.load((p) => {
      this.el.statusBar.style.width = `${Math.round(p * 100)}%`;
    }).catch((err) => {
      console.warn('[sinalize] reconhecimento indisponível', err);
      return 'erro';
    });
    const camera = await this._openCamera();
    if (!this._alive(token)) return;
    if (camera !== 'ok') {
      this.el.status.hidden = true;
      this._noCamera(camera);
      return;
    }
    const loaded = await Promise.race([trackerReady, sleep(30000).then(() => 'demorou')]);
    if (!this._alive(token)) return;
    this.el.status.hidden = true;
    if (loaded === 'erro' || loaded === 'demorou') {
      this._noCamera('tracker');
      return;
    }
    this.newMatch();
  }

  async restart() {
    await this.leave();
    if (!this.screen.hidden) await this.enter();
  }

  /** O jogo não funciona sem a câmera: explica e oferece tentar de novo. */
  _noCamera(reason) {
    this._stopCamera();
    const text = {
      denied: 'A câmera foi bloqueada. Toque no cadeado ao lado do endereço do site, permita a câmera e tente de novo.',
      busy: 'A câmera está sendo usada por outro aplicativo. Feche o outro aplicativo e tente de novo.',
      notfound: 'Não encontramos uma câmera neste aparelho.',
      tracker: 'Não foi possível preparar o jogo agora. Verifique a internet e tente de novo.',
    }[reason] || 'Toque em <strong>Permitir</strong> quando o navegador perguntar.';
    this.el.noCameraText.innerHTML = text;
    this.el.noCamera.hidden = false;
    announce('Este jogo precisa da câmera.');
  }

  async leave() {
    this.active = false;
    this.token = {};
    cancelAnimationFrame(this._raf);
    clearTimeout(this._feedbackTimer);
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
    this._resizeObserver?.disconnect();
    clearToasts();
  }

  _alive(token) {
    return this.active && token === this.token;
  }

  /* ------------------------------------------------------------ câmera */
  /** Abre a câmera. Devolve 'ok', 'denied', 'busy', 'notfound' ou 'erro'. */
  async _openCamera() {
    this._stopCamera();
    const { width, height } = SIGN_GAME.camera;
    if (!navigator.mediaDevices?.getUserMedia) return 'notfound';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: this.facing }, width: { ideal: width }, height: { ideal: height } },
      });
    } catch (err) {
      console.warn('[sinalize] câmera', err);
      this.stream = null;
      this.el.camPanel.classList.add('is-desligada');
      const name = err?.name || '';
      if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name)) return 'denied';
      if (['NotReadableError', 'TrackStartError', 'AbortError'].includes(name)) return 'busy';
      if (['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError'].includes(name)) return 'notfound';
      return 'erro';
    }
    if (!this.active) {
      this._stopCamera();
      return 'erro';
    }
    const video = this.el.cam;
    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;
    video.classList.toggle('is-espelho', this.facing === 'user');
    await video.play().catch(() => {});
    this.el.camPanel.classList.remove('is-desligada');
    return 'ok';
  }

  _stopCamera() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.el.cam.srcObject) this.el.cam.srcObject = null;
  }

  async flipCamera() {
    const before = this.facing;
    this.facing = this.facing === 'user' ? 'environment' : 'user';
    if (await this._openCamera() !== 'ok') {
      // sem a outra câmera: volta para a que funcionava
      this.facing = before;
      if (await this._openCamera() !== 'ok') this._noCamera('erro');
      else toast('Este aparelho só tem uma câmera disponível.', { type: 'info' });
    }
  }

  /* ------------------------------------------------------------ vídeo do intérprete */
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
    // o painel muda de tamanho com a tela (o jogo ocupa a altura do aparelho)
    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(this.el.videoStage);
    }
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
    return this.libras.playSegment(clip.start, clip.end, { repeat: clip.repeat, hold: clip.hold });
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
    this._step('olhe', 'olho', `OLHE O SINAL DO <b>${item.letter}</b>`);
    this.el.videoPanel.classList.add('is-olhe');
    this.el.camPanel.classList.remove('is-vez');
    announce(`Olhe o sinal da letra ${item.letter}.`);
    await this._playClip(item);
    this.el.videoPanel.classList.remove('is-olhe');
    if (!this._alive(token) || this.match.phase !== PHASE.WATCH) return;
    // sem 3, 2, 1 e sem relógio: a vez da criança começa com calma
    this.match.startTry();
    this._step('vez', 'mao', `SUA VEZ! FAÇA O SINAL DO <b>${item.letter}</b> PARA A CÂMERA`);
    this.el.camPanel.classList.add('is-vez');
    announce(`Sua vez! Faça o sinal da letra ${item.letter} para a câmera.`);
    sfx.reveal();
    this._showButtons('watch');
    this.recognizer = createRecognizer(item, SIGN_GAME.recognition);
    this._camMsg('MOSTRE A MÃO');
    this._tryStartedAt = performance.now();
    this._tipShown = false;
    this._loop(token);
  }

  _loop(token) {
    const tick = () => {
      if (!this._alive(token) || this.match.phase !== PHASE.TRY) return;
      const now = performance.now();
      const hands = this.tracker.ready ? this.tracker.detect(this.el.cam, now) : null;
      if (hands) {
        const r = this.recognizer.update(hands, now);
        this.el.hold.style.width = `${Math.round((r.progress || 0) * 100)}%`;
        this.el.camPanel.classList.toggle('sg-cam--confere', r.state === 'match');
        if (r.state === 'nohand') this._camMsg('MOSTRE A MÃO');
        else if (r.state === 'match') this._camMsg('ISSO! CONTINUE...');
        else this._camMsg('OLHE A CARTA E TENTE');
        if (r.event === 'correct') {
          this._success();
          return;
        }
        if (r.event === 'wrong') this._almost();
      }
      // sem tempo limite: depois de um tempo sem acertar, só UMA dica (nada se perde)
      if (!this._tipShown && now - this._tryStartedAt > SIGN_GAME.timing.tipAfter * 1000) {
        this._tipShown = true;
        this._tip();
      }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  async _success() {
    const token = this.token;
    const result = this.match.correct();
    if (!result) return;
    const { letter } = this.match.round.item;
    this.el.camPanel.classList.remove('sg-cam--confere', 'is-vez');
    this.el.camPanel.classList.add('sg-cam--acertou');
    this._camMsg('ISSO!');
    this._step('certo', 'check', `ISSO! VOCÊ FEZ O <b>${letter}</b>!`);
    this._renderHud();
    sfx.correct();
    const r = this.el.camPanel.getBoundingClientRect();
    sparkle(this.screen, r.left + r.width / 2, r.top + r.height / 2, { count: 18 });
    this._feedback('certo', 'check', 'ISSO!', `Você fez o ${letter}!`);
    announce(`Isso! Você fez o ${letter}!`);
    this._showButtons('none');
    await sleep(SIGN_GAME.timing.nextMs);
    if (!this._alive(token)) return;
    this.el.camPanel.classList.remove('sg-cam--acertou');
    this._round();
  }

  /** A câmera viu outro sinal por um tempo: QUASE! A criança continua tentando (nada se perde). */
  _almost() {
    const { letter } = this.match.round.item;
    this.match.almost();
    sfx.wrong();
    this._feedback('quase', 'olho', 'QUASE!', `Olhe de novo o sinal do ${letter} na carta e tente outra vez.`, SIGN_GAME.timing.almostMs);
    announce(`Quase! Olhe de novo o sinal do ${letter}.`);
  }

  /** Muito tempo sem acertar: uma dica de como a câmera vê melhor (sem pressa). */
  _tip() {
    this._feedback('dica', 'ajuda', 'DICA', 'Mostre a mão inteira na câmera, com bastante luz. Se quiser, toque em VER DE NOVO.', 4200);
    announce('Dica: mostre a mão inteira na câmera, com bastante luz.');
  }

  /** Ver o sinal de novo (a criança pode olhar quantas vezes quiser). */
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

  /** Fim: "Você fez X de 5", com cada vogal (certa ou pulada). Sem pontos nem recorde. */
  _finish() {
    const s = this.match.summary();
    const box = this.el.summary;
    box.querySelector('[data-sum-title]').textContent = s.signsCorrect === s.total ? 'PARABÉNS!' : s.signsCorrect ? 'MUITO BEM!' : 'VAMOS TREINAR MAIS?';
    box.querySelector('[data-sum="signs"]').textContent = `${s.signsCorrect} DE ${s.total}`;
    box.querySelector('[data-sum-vowels]').innerHTML = s.results.map((r) => `<li class="${r.ok ? 'is-certo' : 'is-pulou'}" aria-label="${r.id}: ${r.ok ? 'certo' : 'pulou'}"><span class="sg-letra-grande" aria-hidden="true">${r.id}</span>${icon(r.ok ? 'check' : 'pular')}</li>`).join('');
    box.hidden = false;
    this._showButtons('none');
    sfx.fanfare();
    celebrate(this.screen, s.signsCorrect ? 60 : 20);
    announce(`Fim! Você fez ${s.signsCorrect} de ${s.total} sinais.`);
    box.querySelector('[data-action="replay"]').focus();
  }

  /* ------------------------------------------------------------ interface */
  /** A vogal: a letra do português ao lado da carta com o sinal (o par). */
  _showItem(item) {
    const img = this.el.card;
    img.src = `assets/img/cartas-mini/carta${item.card}.webp`;
    img.alt = `Carta: ${item.label} em LIBRAS`;
    this.el.letter.textContent = item.letter;
    this.el.name.textContent = item.label;
  }

  /** O passo da vez, com a letra em destaque (o texto vem do próprio jogo, não da pessoa). */
  _step(kind, iconName, html) {
    const box = this.el.stepBox;
    box.classList.toggle('is-vez', kind === 'vez');
    box.classList.toggle('is-certo', kind === 'certo');
    this.el.stepText.innerHTML = `${icon(iconName)} <span>${html}</span>`;
  }

  _camMsg(text) {
    if (this.el.camMsg.textContent !== text) this.el.camMsg.textContent = text;
    if (!text) this.el.hold.style.width = '0%';
  }

  _showButtons(which) {
    this.el.actions.hidden = which !== 'watch';
  }

  _feedback(kind, iconName, title, text, duration = 0) {
    const box = this.el.feedback;
    box.className = `faixa faixa--${kind}`;
    box.innerHTML = `${icon(iconName, 'ico faixa__ico')}<span><b class="faixa__titulo">${title}</b><span class="faixa__texto"></span></span>`;
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
