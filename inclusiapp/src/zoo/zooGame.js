/**
 * ZOOLÓGICO DO SEU ZÉ — a tela (substitui o antigo Bichinho Virtual).
 *
 *   tocar num animal (ou runa) da bandeja → ele entra no zoológico
 *   arrastar → leva para perto de outro (e eles interagem)
 *   tocar no animal → carinho
 *   arrastar até a lixeira → sai do zoológico
 *
 * Sem textos para ler, sem regras: as necessidades aparecem como balões com
 * ícones (fome de mel, quer brincar, feliz, satisfeito). O que acontece em
 * cada encontro está em zooConfig.js (só o que a história mostra).
 * O zoológico fica salvo no aparelho e volta como estava.
 */
import { ANIMALS } from '../config.js';
import { ZOO, NEED_ICONS, RUNES } from './zooConfig.js';
import { ZooState } from './zooState.js';
import { ZooScene } from './zooScene.js';
import { storage } from '../ui/storage.js';
import { sfx, unlockAudio } from '../ui/sound.js';
import { sparkle } from '../ui/effects.js';
import { announce, toast } from '../ui/notifications.js';

const SAVE_KEY = 'zoo';
const DRAG_START_PX = 10;

export class ZooGame {
  constructor(screen) {
    this.screen = screen;
    const q = (s) => screen.querySelector(s);
    this.stage = q('[data-zoo-stage]');
    this.ui = q('.zoo__ui');
    this.el = {
      animals: q('[data-zoo-animals]'),
      runes: q('[data-zoo-runes]'),
      trash: q('[data-zoo-trash]'),
      empty: q('[data-zoo-empty]'),
      help: q('[data-zoo-help-box]'),
    };
    this.buttons = new Map();
    for (const a of ANIMALS) {
      const b = this._trayButton('animal', a.id, `<img src="${a.portrait}" alt="" width="60" height="60">`, `Colocar ${a.name}`);
      this.el.animals.appendChild(b);
    }
    for (const r of RUNES) {
      const b = this._trayButton('runa', r, `<img src="assets/img/runas/runa-${r.toLowerCase()}.webp" alt="" width="44" height="62">`, `Colocar a runa ${r}`);
      b.classList.add('zoo__item--runa');
      this.el.runes.appendChild(b);
    }
    q('[data-action="zoo-help"]').addEventListener('click', () => this._help(true));
    q('[data-action="zoo-help-close"]').addEventListener('click', () => this._help(false));
    this.stage.addEventListener('pointerdown', (e) => this._down(e));
    this.stage.addEventListener('pointermove', (e) => this._move(e));
    this.stage.addEventListener('pointerup', (e) => this._up(e));
    this.stage.addEventListener('pointercancel', (e) => this._up(e, true));
    this.bubbles = new Map();
  }

  _trayButton(kind, type, html, label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zoo__item';
    b.innerHTML = `${html}<span class="zoo__conta" hidden></span>`;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => {
      unlockAudio();
      this.add(kind, type);
    });
    this.buttons.set(`${kind}:${type}`, b);
    return b;
  }

  /* ------------------------------------------------------------ ciclo de vida */
  async enter() {
    this.active = true;
    this.state = new ZooState();
    this.scene = new ZooScene(this.stage);
    this.scene.onFrame = (dt) => this._frame(dt);
    this.scene.onBounds = (b) => this.state.setBounds(b);
    try {
      this.scene.start();
    } catch (err) {
      console.error(err);
      toast('Este aparelho não consegue mostrar os animais em 3D.', { type: 'error' });
      return;
    }
    const saved = storage.get(SAVE_KEY, null);
    if (Array.isArray(saved)) {
      for (const s of saved.slice(0, ZOO.maxItems)) await this.add(s.kind, s.type, { x: s.x, y: s.y }, { quiet: true });
    }
    this._renderTray();
    if (!storage.get('zooHelpSeen', false)) {
      storage.set('zooHelpSeen', true);
      this._help(true);
    }
  }

  async leave() {
    this.active = false;
    this._save();
    this._help(false);
    this.scene?.stop();
    this.scene = null;
    for (const b of this.bubbles.values()) b.remove();
    this.bubbles.clear();
  }

  _save() {
    if (this.state) storage.set(SAVE_KEY, this.state.toJSON());
  }

  _help(show) {
    this.el.help.hidden = !show;
    if (show) this.el.help.querySelector('button').focus();
  }

  /* ------------------------------------------------------------ colocar e tirar */
  async add(kind, type, pos = null, { quiet = false } = {}) {
    if (!this.active) return;
    const item = this.state.add(kind, type, pos);
    if (!item) {
      if (!quiet) {
        sfx.wrong();
        toast('O zoológico está cheio! Leve alguém para a lixeira.', { type: 'info', duration: 2600 });
      }
      return;
    }
    this._renderTray();
    try {
      if (kind === 'animal') await this.scene.addAnimal(item);
      else this.scene.addRune(item);
    } catch (err) {
      console.error(err);
      this.state.remove(item.id);
      this._renderTray();
      toast('Não foi possível trazer este animal agora. Verifique a internet.', { type: 'error' });
      return;
    }
    if (!this.active) return;
    if (!quiet) {
      sfx.reveal();
      const p = this.scene.screenPoint(item.id);
      sparkle(this.ui, p.x, p.y + 30, { count: 10 });
      announce(kind === 'animal' ? `${ANIMALS.find((a) => a.id === type).name} entrou no zoológico.` : `Runa ${type} no zoológico.`);
    }
    this._save();
  }

  remove(id) {
    const p = this.scene.screenPoint(id);
    this.state.remove(id);
    this.scene.remove(id);
    this.bubbles.get(id)?.remove();
    this.bubbles.delete(id);
    sparkle(this.ui, p.x, p.y + 30, { count: 12 });
    sfx.skip();
    this._renderTray();
    this._save();
  }

  _renderTray() {
    const counts = new Map();
    for (const it of this.state?.items.values() || []) counts.set(`${it.kind}:${it.type}`, (counts.get(`${it.kind}:${it.type}`) || 0) + 1);
    const full = this.state?.full;
    for (const [key, b] of this.buttons) {
      const n = counts.get(key) || 0;
      const badge = b.querySelector('.zoo__conta');
      badge.hidden = !n;
      badge.textContent = n;
      b.disabled = !!full;
    }
    this.el.empty.hidden = !!this.state?.count;
  }

  /* ------------------------------------------------------------ arrastar e tocar */
  _down(e) {
    if (!this.scene || !this.active) return;
    const id = this.scene.pick(e.clientX, e.clientY);
    if (id === null) return;
    this.stage.setPointerCapture?.(e.pointerId);
    this.drag = { id, x0: e.clientX, y0: e.clientY, moved: false, pointer: e.pointerId };
  }

  _move(e) {
    const d = this.drag;
    if (!d || d.pointer !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < DRAG_START_PX) return;
    if (!d.moved) {
      d.moved = true;
      this.scene.setDragging(d.id, true);
      this.el.trash.classList.add('is-visivel');
    }
    const p = this.scene.groundPoint(e.clientX, e.clientY);
    if (p) this.state.move(d.id, p.x, p.y);
    this.el.trash.classList.toggle('is-ativa', this._overTrash(e));
  }

  _up(e, cancelled = false) {
    const d = this.drag;
    if (!d || d.pointer !== e.pointerId) return;
    this.drag = null;
    this.el.trash.classList.remove('is-visivel', 'is-ativa');
    if (d.moved) {
      this.scene.setDragging(d.id, false);
      if (!cancelled && this._overTrash(e)) this.remove(d.id);
      else this._save();
      return;
    }
    // toque: carinho (ou a runa brilha um pouquinho)
    const item = this.state.items.get(d.id);
    if (!item) return;
    const r = this.stage.getBoundingClientRect();
    if (item.kind === 'animal') {
      this._events(this.state.caress(d.id) || []);
      this.scene.play(d.id, 'happy');
      sparkle(this.ui, e.clientX - r.left, e.clientY - r.top, { hearts: true });
      sfx.correct();
    } else {
      sparkle(this.ui, e.clientX - r.left, e.clientY - r.top, { count: 8 });
    }
  }

  _overTrash(e) {
    const r = this.el.trash.getBoundingClientRect();
    const pad = 24;
    return e.clientX > r.left - pad && e.clientX < r.right + pad && e.clientY > r.top - pad && e.clientY < r.bottom + pad;
  }

  /* ------------------------------------------------------------ o que acontece */
  _frame(dt) {
    if (!this.state) return;
    this._events(this.state.tick(dt));
    for (const [id, el] of this.bubbles) {
      const p = this.scene.screenPoint(id);
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      el.hidden = !p.visible;
    }
  }

  _events(events) {
    for (const ev of events) {
      if (ev.type === 'need') this._bubble(ev.id, ev.need);
      else if (ev.type === 'mood') this._bubble(ev.id, ev.state === 'calmo' || ev.state === 'quer' ? this.state.items.get(ev.id)?.need : ev.state);
      else if (ev.type === 'meet') {
        const { rule } = ev;
        this.scene.meet(ev.a, ev.b, rule.approach);
        setTimeout(() => {
          if (!this.active) return;
          this.scene.play(ev.a, rule.aClip);
          this.scene.play(ev.b, rule.bClip);
        }, rule.approach ? 900 : 0);
      } else if (ev.type === 'rune') {
        this.scene.lightRune(ev.id, true);
        this.scene.play(ev.animal, 'special');
        const p = this.scene.screenPoint(ev.id);
        sparkle(this.ui, p.x, p.y + 40, { count: 22, spread: 120 });
        sfx.fanfare();
        announce(`A runa ${ev.letter} acendeu!`);
      } else if (ev.type === 'rune-off') {
        this.scene.lightRune(ev.id, false);
      }
    }
  }

  _bubble(id, state) {
    let el = this.bubbles.get(id);
    if (!state) {
      el?.remove();
      this.bubbles.delete(id);
      return;
    }
    if (!el) {
      el = document.createElement('span');
      el.className = 'zoo__balao';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<svg class="ico"><use href=""/></svg>';
      this.ui.appendChild(el);
      this.bubbles.set(id, el);
    }
    el.className = `zoo__balao zoo__balao--${state}`;
    el.querySelector('use').setAttribute('href', `#i-${NEED_ICONS[state] || 'coracao'}`);
  }
}
