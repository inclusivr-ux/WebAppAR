/**
 * MÚSICA do app: a trilha do sound design da InclusiVR ("oogway morrendo",
 * em assets/musica/), pedido da equipe em 10/11/2026.
 *
 *   - toca em laço, baixinho, e entra suave depois do primeiro toque na tela
 *     (os navegadores não deixam tocar som antes disso);
 *   - para quando o app vai para segundo plano e volta junto com ele;
 *   - o botão MÚSICA (na tela inicial) liga e desliga, separado dos efeitos,
 *     e o aparelho lembra a escolha;
 *   - qual música toca está em assets/musica/musica.json ("arquivo"); sem
 *     arquivo, o botão fica escondido e nada quebra.
 *
 * O volume passa por um GainNode (no iPhone, o volume do <audio> não muda).
 */
import { MUSIC } from '../config.js';
import { storage } from './storage.js';
import { audioContext } from './sound.js';

let el = null; // <audio>
let gain = null;
let available = null; // null = ainda não sei; true/false = o arquivo existe?
let enabled = storage.get('music', true);
let unlocked = false;
const listeners = new Set();

/** Qual é a música (assets/musica/musica.json)? Uma vez só; sem arquivo, o botão nem aparece. */
let file = null;
export function checkMusic() {
  if (available !== null) return Promise.resolve(available);
  return fetch(MUSIC.list, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((data) => {
      const name = String(data?.arquivo || '').trim();
      file = name ? new URL(name, new URL(MUSIC.list, document.baseURI)).href : null;
      available = !!file;
      notify();
      return available;
    });
}

export const musicAvailable = () => available === true;
/** A música está tocando agora? (testes) */
export const musicPlaying = () => !!el && !el.paused;
export const isMusicOn = () => enabled;

export function onMusicChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn();
}

function build() {
  if (el) return true;
  const ac = audioContext();
  if (!ac) return false;
  el = new Audio();
  el.src = file;
  el.loop = true;
  el.preload = 'auto';
  el.setAttribute('playsinline', '');
  el.addEventListener('error', () => {
    available = false;
    notify();
  });
  try {
    const src = ac.createMediaElementSource(el);
    gain = ac.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(ac.destination);
  } catch (err) {
    // sem WebAudio: o volume do próprio <audio> (onde ele funciona)
    console.warn('[música]', err);
    gain = null;
    el.volume = MUSIC.volume;
  }
  return true;
}

function fadeTo(value, seconds) {
  const ac = audioContext();
  if (!gain || !ac) return;
  const now = ac.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(value, now + seconds);
}

function start() {
  if (!enabled || !unlocked || !available || document.hidden) return;
  if (!build()) return;
  el.play().then(() => fadeTo(MUSIC.volume, MUSIC.fadeIn)).catch((err) => console.warn('[música]', err));
}

function stop(seconds = 0.4) {
  if (!el) return;
  fadeTo(0, seconds);
  clearTimeout(stop.timer);
  stop.timer = setTimeout(() => { if (!enabled || document.hidden) el.pause(); }, seconds * 1000 + 50);
}

export function setMusic(on) {
  enabled = on;
  storage.set('music', on);
  if (on) start();
  else stop();
  notify();
}

/**
 * Liga a música ao app: ela começa no primeiro toque (se estiver ligada e o
 * arquivo existir) e acompanha o app em segundo plano.
 */
export function setupMusic() {
  const unlock = () => {
    unlocked = true;
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
    checkMusic().then(start);
  };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(0.2);
    else start();
  });
  checkMusic();
}

/**
 * O botão MÚSICA: aparece só com o arquivo no app; mostra ligado/desligado
 * pelo ícone (a nota cortada e o fundo cinza quando está desligada) e pelo
 * nome, para os leitores de tela e na dica do mouse.
 */
export function setupMusicButton(button) {
  if (!button) return;
  const label = button.querySelector('[data-music-label]');
  const use = button.querySelector('use');
  const render = () => {
    button.hidden = !musicAvailable();
    const on = isMusicOn();
    const name = on ? 'Desligar a música' : 'Ligar a música';
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', name);
    button.title = name;
    if (label) label.textContent = on ? 'MÚSICA' : 'SEM MÚSICA';
    use?.setAttribute('href', on ? '#i-musica' : '#i-musica-off');
  };
  button.addEventListener('click', () => {
    unlocked = true;
    setMusic(!isMusicOn());
  });
  onMusicChange(render);
  render();
}
