/**
 * Módulo de LIBRAS do Fauston (no livro em AR).
 *
 * Não começa sozinho: só abre pelo botão LIBRAS, que aparece quando a câmera
 * vê uma página com animal. Dentro dele há duas atividades separadas:
 *
 *   SINAL     (ícone da mão)    o Fauston faz o sinal do animal; DE NOVO repete
 *   SOLETRAR  (ícone A B C)     o Fauston soletra o nome, letra por letra, e a
 *                               letra da vez fica em destaque (como karaokê:
 *                               as anteriores ficam ciano, as próximas de pedra)
 *
 * O vídeo é desenhado sobre a câmera, sem o fundo verde (videoChroma.js), no
 * espaço reservado do painel. Os tempos de cada parte estão em librasVideos.js.
 */
import { LIBRAS_VIDEOS, letterAt, segmentOf } from './librasVideos.js';
import { announce } from '../ui/notifications.js';

export class LibrasPanel {
  /**
   * @param {HTMLElement} root    o painel ([data-libras-panel])
   * @param {LibrasVideo} video   vídeo com chroma key (desenhado no HUD)
   */
  constructor(root, video) {
    this.root = root;
    this.video = video;
    const q = (s) => root.querySelector(s);
    this.el = {
      stage: q('[data-libras-stage]'),
      letters: q('[data-libras-letters]'),
      title: q('[data-libras-title]'),
      sign: q('[data-libras-mode="sign"]'),
      spell: q('[data-libras-mode="spell"]'),
      again: q('[data-libras-again]'),
      close: q('[data-libras-close]'),
      choose: q('[data-libras-choose]'),
      status: q('[data-libras-status]'),
    };
    this.mode = null;
    this.animal = null;
    this.onLayout = null;
    this.onClose = null;
    this.el.sign.addEventListener('click', () => this.play('sign'));
    this.el.spell.addEventListener('click', () => this.play('spell'));
    this.el.again.addEventListener('click', () => this.play(this.mode || 'sign'));
    this.el.close.addEventListener('click', () => this.close());
  }

  get isOpen() {
    return !this.root.hidden;
  }

  /** Abre o painel para um animal (sem tocar nada: a criança escolhe). */
  open(animal) {
    const data = LIBRAS_VIDEOS[animal.id];
    if (!data) return;
    this.animal = animal;
    this.data = data;
    this.mode = null;
    this.root.hidden = false;
    this.root.dataset.mode = '';
    this.el.title.textContent = data.word;
    this._renderLetters(data.spell);
    this.el.letters.hidden = true;
    this.el.again.hidden = true;
    this._setStatus('ESCOLHA:');
    this._press(null);
    this.video.setSource(data.src);
    this.video.setEnabled(false);
    requestAnimationFrame(() => this.onLayout?.());
    announce(`LIBRAS: ${animal.name}. Escolha sinal ou soletrar.`);
  }

  close() {
    if (!this.isOpen) return;
    this.video.setEnabled(false);
    this.root.hidden = true;
    this.mode = null;
    this.onClose?.();
  }

  /** Troca de animal com o painel aberto (outra página apareceu). */
  switchTo(animal) {
    if (this.isOpen && this.animal?.id !== animal.id) this.open(animal);
  }

  async play(mode) {
    if (!this.data) return;
    this.mode = mode;
    this.root.dataset.mode = mode;
    this._press(mode);
    this.el.again.hidden = true;
    this.el.letters.hidden = mode !== 'spell';
    this._lastLetter = -2;
    this._renderProgress(-1);
    this._setStatus(mode === 'spell' ? `SOLETRANDO ${this.data.word}` : `SINAL DE ${this.data.word}`);
    this.video.setEnabled(true);
    this.onLayout?.();
    const seg = segmentOf(this.data, mode);
    announce(mode === 'spell' ? `O Fauston soletra ${this.animal.name}.` : `O Fauston faz o sinal de ${this.animal.name}.`);
    const finished = await this.video.playSegment(seg.start, seg.end);
    if (!finished || this.mode !== mode || !this.isOpen) return;
    if (mode === 'spell') this._renderProgress(this.data.spell.length);
    this.el.again.hidden = false;
    this._setStatus('QUER VER DE NOVO?');
  }

  /** Karaokê: destaca a letra que o Fauston está fazendo. */
  update() {
    if (this.mode !== 'spell' || !this.data || this.video.ended) return;
    const i = letterAt(this.data.spell, this.video.currentTime);
    if (i !== this._lastLetter) {
      this._lastLetter = i;
      this._renderProgress(i);
    }
  }

  /** Retângulo (px, origem no canto de baixo à esquerda) onde o vídeo é desenhado. */
  stageBox(viewportHeight) {
    const r = this.el.stage.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { left: r.left, bottom: viewportHeight - r.bottom, width: r.width, height: r.height };
  }

  _press(mode) {
    this.el.sign.setAttribute('aria-pressed', String(mode === 'sign'));
    this.el.spell.setAttribute('aria-pressed', String(mode === 'spell'));
  }

  _setStatus(text) {
    this.el.status.textContent = text;
  }

  _renderLetters(spell) {
    this.el.letters.replaceChildren(...spell.map(({ letter }) => {
      const li = document.createElement('li');
      li.textContent = letter;
      return li;
    }));
  }

  _renderProgress(current) {
    [...this.el.letters.children].forEach((li, i) => {
      li.classList.toggle('is-feita', i < current);
      li.classList.toggle('is-atual', i === current);
    });
    if (current >= 0 && current < this.data.spell.length) announce(this.data.spell[current].letter);
  }
}
