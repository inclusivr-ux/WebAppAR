/**
 * Efeitos sonoros do app.
 *
 * O som é um complemento: todo retorno também é visual (e vibra no Android),
 * pensando em crianças surdas.
 *
 * DE ONDE VEM O SOM
 *   1. Os arquivos do sound design da InclusiVR (Luigi), quando existirem:
 *      ponha o arquivo em assets/sons/ e escreva o nome em ARQUIVOS, abaixo.
 *      Cada efeito que tiver arquivo passa a tocar o arquivo.
 *   2. Enquanto isso, sons provisórios gerados na hora (sem arquivos para
 *      baixar), com o jeito de Signária: o "plim" de uma kalimba, o "toc"
 *      de madeira e um brilho mágico. Eles substituíram, em 10/11/2026, os
 *      bipes genéricos da primeira versão (um arpejo comum, fácil de
 *      reconhecer como som pronto).
 *
 * Efeitos: correct (acerto), wrong (quase/erro), tick (contagem),
 * reveal (algo aparece), skip (pular / ir para casa), fanfare (festa no fim).
 */
import { storage } from './storage.js';

/** Arquivos do sound design (assets/sons/…). Vazio = usa os sons provisórios. */
const ARQUIVOS = {
  // correct: 'assets/sons/acerto.mp3',
  // wrong: 'assets/sons/quase.mp3',
  // tick: 'assets/sons/tique.mp3',
  // reveal: 'assets/sons/aparece.mp3',
  // skip: 'assets/sons/pular.mp3',
  // fanfare: 'assets/sons/festa.mp3',
};

let ctx = null;
let enabled = storage.get('sound', true);

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Chamar dentro de um toque/clique para liberar o áudio (iOS). */
export function unlockAudio() {
  audio();
  for (const name of Object.keys(ARQUIVOS)) loadFile(name);
}

export function isSoundOn() {
  return enabled;
}

export function setSound(on) {
  enabled = on;
  storage.set('sound', on);
}

/* ------------------------------------------------------------ arquivos */
const buffers = new Map(); // nome → AudioBuffer | Promise | null (falhou)
function loadFile(name) {
  const url = ARQUIVOS[name];
  const ac = audio();
  if (!url || !ac || buffers.has(name)) return;
  buffers.set(name, fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${url}: HTTP ${r.status}`))))
    .then((data) => new Promise((resolve, reject) => ac.decodeAudioData(data, resolve, reject)))
    .then((buf) => { buffers.set(name, buf); return buf; })
    .catch((err) => { console.warn('[som]', err); buffers.set(name, null); return null; }));
}

/** Toca o arquivo do efeito, se houver e já estiver carregado. */
function playFile(name, gain = 0.9) {
  const buf = buffers.get(name);
  const ac = audio();
  if (!buf || typeof buf.then === 'function' || !ac) return false;
  const src = ac.createBufferSource();
  const amp = ac.createGain();
  amp.gain.value = gain;
  src.buffer = buf;
  src.connect(amp).connect(ac.destination);
  src.start();
  return true;
}

/* ------------------------------------------------------------ sons provisórios */
let noiseBuffer = null;
function noise(ac) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = (seed / 2147483647) * 2 - 1;
    }
  }
  return noiseBuffer;
}

/**
 * "Plim" de kalimba / marimba: a nota e alguns harmônicos (não inteiros, como
 * numa lâmina de metal ou de madeira), cada um sumindo no seu tempo.
 */
function pluck(freq, start, { gain = 0.16, decay = 0.6, partials = [[1, 1, 1], [3.9, 0.28, 0.22], [9.2, 0.1, 0.08]] } = {}) {
  const ac = audio();
  if (!ac || !enabled) return;
  const t0 = ac.currentTime + start;
  for (const [ratio, amp, dec] of partials) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * ratio, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * amp, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * dec);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + decay * dec + 0.05);
  }
}

/** Sopro de ruído filtrado (o "toc" da madeira, o "fiu" do brilho). */
function puff(start, { freq = 2500, q = 6, dur = 0.04, gain = 0.12, to = null } = {}) {
  const ac = audio();
  if (!ac || !enabled) return;
  const t0 = ac.currentTime + start;
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t0);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.01, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0, Math.random() * 0.3);
  src.stop(t0 + dur + 0.02);
}

const WOOD = [[1, 1, 1], [4, 0.35, 0.3], [10.1, 0.08, 0.1]]; // marimba (madeira)
// escala pentatônica de Sol (G A B D E): nada soa "errado" junto
const N = { G4: 392, A4: 440, B4: 493.9, D5: 587.3, E5: 659.3, G5: 784, A5: 880, B5: 987.8, D6: 1174.7, E6: 1318.5, G3: 196, D4: 293.7 };

/** Também usado por outros módulos para um som curto e simples. */
export function tone(freq, start, duration, { gain = 0.14 } = {}) {
  pluck(freq, start, { gain, decay: Math.max(0.15, duration * 2) });
}

function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch { /* ignora */ }
}

const synth = {
  // acerto: dois "plins" de kalimba subindo (Ré → Sol) e um brilho
  correct() {
    pluck(N.D5, 0, { gain: 0.17, decay: 0.7 });
    pluck(N.G5, 0.11, { gain: 0.17, decay: 0.9 });
    pluck(N.D6, 0.2, { gain: 0.05, decay: 0.6 });
    puff(0.12, { freq: 7000, to: 11000, q: 2, dur: 0.25, gain: 0.025 });
  },
  // quase: dois "tocs" de madeira, graves e macios (sem buzina)
  wrong() {
    pluck(N.D4, 0, { gain: 0.16, decay: 0.45, partials: WOOD });
    pluck(N.G3, 0.17, { gain: 0.16, decay: 0.55, partials: WOOD });
  },
  // contagem: um toc curtinho de madeira
  tick() {
    puff(0, { freq: 2200, q: 8, dur: 0.035, gain: 0.09 });
    pluck(N.B5, 0, { gain: 0.035, decay: 0.12, partials: WOOD });
  },
  // algo aparece: o "fiu" da magia subindo e três brilhos
  reveal() {
    puff(0, { freq: 900, to: 6000, q: 3, dur: 0.32, gain: 0.05 });
    [N.B5, N.D6, N.E6].forEach((f, i) => pluck(f, 0.08 + i * 0.06, { gain: 0.06, decay: 0.5 }));
  },
  // pular / ir para casa: um "fiu" descendo e um toc
  skip() {
    puff(0, { freq: 4000, to: 700, q: 3, dur: 0.22, gain: 0.05 });
    pluck(N.D5, 0.16, { gain: 0.08, decay: 0.3, partials: WOOD });
  },
  // festa: a escala pentatônica na kalimba, terminando num acorde com brilho
  fanfare() {
    [N.G4, N.A4, N.B4, N.D5, N.E5, N.G5].forEach((f, i) => pluck(f, i * 0.09, { gain: 0.14, decay: 0.6 }));
    [N.G5, N.B5, N.D6].forEach((f) => pluck(f, 0.62, { gain: 0.1, decay: 1.4 }));
    puff(0.6, { freq: 8000, to: 12000, q: 1.5, dur: 0.5, gain: 0.03 });
  },
};

const VIBRA = { correct: 60, wrong: [40, 60, 40], fanfare: [80, 60, 80, 60, 160] };

export const sfx = Object.fromEntries(Object.keys(synth).map((name) => [name, () => {
  if (enabled) {
    loadFile(name);
    if (!playFile(name)) synth[name]();
  }
  if (VIBRA[name]) vibrate(VIBRA[name]);
}]));
