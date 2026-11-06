/**
 * Regras do zoológico (sem DOM e sem Three.js — testadas em Node).
 *
 * Guarda os elementos (animais e runas), as necessidades de cada animal e
 * decide quando dois elementos "se encontram". A cena 3D (zooScene.js) move
 * os modelos e toca as animações; aqui só se decide O QUE acontece.
 *
 * Coordenadas no chão: x (esquerda/direita) e y (perto/longe), em unidades
 * da cena. Cada `tick(dt)` devolve a lista de eventos do quadro.
 */
import { ZOO, NEEDS, INTERACTIONS } from './zooConfig.js';

let nextId = 1;

const match = (rule, id) => rule === '*' || rule === id;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

export class ZooState {
  constructor({ config = ZOO, random = Math.random } = {}) {
    this.config = config;
    this.random = random;
    this.items = new Map();
    this.pairCooldowns = new Map(); // "idA|idB" → segundos restantes
    this.time = 0;
    const { halfWidth: w, halfDepth: d } = config.ground;
    this.bounds = { minX: -w, maxX: w, minY: -d, maxY: d };
  }

  /** A área do chão que aparece na tela (a cena calcula conforme o formato da tela). */
  setBounds(bounds) {
    this.bounds = bounds;
    for (const it of this.items.values()) this.move(it.id, it.x, it.y);
  }

  get count() { return this.items.size; }
  get full() { return this.items.size >= this.config.maxItems; }

  /** Coloca um animal ('urso') ou uma runa ('A'). Devolve o elemento, ou null se não couber. */
  add(kind, type, pos = null) {
    if (this.full) return null;
    const b = this.bounds;
    const p = pos || { x: b.minX + (0.1 + this.random() * 0.8) * (b.maxX - b.minX), y: b.minY + (0.15 + this.random() * 0.7) * (b.maxY - b.minY) };
    const item = {
      id: nextId++, kind, type, x: p.x, y: p.y,
      state: kind === 'animal' ? 'calmo' : 'apagada', // animal: calmo | quer | feliz | satisfeito · runa: apagada | acesa
      need: null,
      needIn: kind === 'animal' ? this._needDelay(0.4) : Infinity,
      moodLeft: 0,
      busy: 0, // segundos ocupado numa interação
    };
    this.items.set(item.id, item);
    return item;
  }

  remove(id) {
    const ok = this.items.delete(id);
    for (const key of [...this.pairCooldowns.keys()]) {
      if (key.split('|').includes(String(id))) this.pairCooldowns.delete(key);
    }
    return ok;
  }

  move(id, x, y) {
    const it = this.items.get(id);
    if (!it) return;
    const b = this.bounds;
    it.x = Math.max(b.minX, Math.min(b.maxX, x));
    it.y = Math.max(b.minY, Math.min(b.maxY, y));
  }

  _needDelay(scale = 1) {
    const [a, b] = this.config.needEvery;
    return (a + this.random() * (b - a)) * scale;
  }

  /** A criança fez carinho: o animal fica feliz (e o "quer brincar" passa). */
  caress(id) {
    const it = this.items.get(id);
    if (!it || it.kind !== 'animal') return null;
    const events = [];
    if (it.need === 'brincar') this._satisfy(it, events);
    else this._mood(it, 'feliz', 3, events);
    return events;
  }

  _mood(it, state, seconds, events) {
    it.state = state;
    it.moodLeft = seconds;
    events.push({ type: 'mood', id: it.id, state });
  }

  _satisfy(it, events) {
    it.need = null;
    it.needIn = this._needDelay();
    this._mood(it, it.type === 'urso' ? 'satisfeito' : 'feliz', 4, events);
  }

  /** Avança o tempo. Eventos: need (quer algo), mood (feliz/satisfeito/calmo), meet (encontro), rune (runa acendeu). */
  tick(dt) {
    this.time += dt;
    const events = [];
    for (const [k, v] of this.pairCooldowns) {
      if (v - dt <= 0) this.pairCooldowns.delete(k);
      else this.pairCooldowns.set(k, v - dt);
    }
    const animals = [...this.items.values()].filter((i) => i.kind === 'animal');
    const runes = [...this.items.values()].filter((i) => i.kind === 'runa');

    for (const it of animals) {
      if (it.busy > 0) it.busy = Math.max(0, it.busy - dt);
      if (it.moodLeft > 0) {
        it.moodLeft -= dt;
        if (it.moodLeft <= 0) {
          it.state = it.need ? 'quer' : 'calmo';
          events.push({ type: 'mood', id: it.id, state: it.state });
        }
      }
      if (!it.need) {
        it.needIn -= dt;
        if (it.needIn <= 0 && it.moodLeft <= 0) {
          it.need = NEEDS[it.type] || 'brincar';
          it.state = 'quer';
          events.push({ type: 'need', id: it.id, need: it.need });
        }
      }
    }

    // runa + o seu animal: a runa acende
    for (const r of runes) {
      if (r.state === 'acesa') {
        // a runa brilha um tempo e depois "dorme" de novo (dá para repetir a brincadeira)
        r.litLeft -= dt;
        if (r.litLeft <= 0) {
          r.state = 'apagada';
          r.waitAway = true; // só acende de novo quando o animal sair e voltar
          events.push({ type: 'rune-off', id: r.id });
        }
        continue;
      }
      const near = animals.filter((a) => this._letterOf(a.type) === r.type && dist(a, r) < this.config.meetDistance);
      if (r.waitAway) {
        if (!near.length) r.waitAway = false;
        continue;
      }
      const friend = near.find((a) => !a.busy);
      if (friend) {
        r.state = 'acesa';
        r.litLeft = this.config.runeLit ?? 25;
        friend.busy = 4;
        events.push({ type: 'rune', id: r.id, animal: friend.id, letter: r.type });
        this._satisfy(friend, events);
      }
    }

    // encontros entre animais
    for (let i = 0; i < animals.length; i++) {
      for (let j = i + 1; j < animals.length; j++) {
        const p = animals[i];
        const q = animals[j];
        if (p.busy || q.busy || dist(p, q) > this.config.meetDistance) continue;
        const key = p.id < q.id ? `${p.id}|${q.id}` : `${q.id}|${p.id}`;
        if (this.pairCooldowns.has(key)) continue;
        const found = this._rule(p, q);
        if (!found) continue;
        const { rule, a, b } = found;
        // só acontece se alguém precisa, ou de vez em quando (para não virar festa sem fim)
        const wants = (rule.satisfies || []).some((n) => a.need === n || b.need === n);
        if (!wants && this.random() > 0.35) {
          this.pairCooldowns.set(key, this.config.pairCooldown * 0.5);
          continue;
        }
        this.pairCooldowns.set(key, this.config.pairCooldown);
        a.busy = 5;
        b.busy = 5;
        events.push({ type: 'meet', a: a.id, b: b.id, rule });
        for (const it of [a, b]) {
          if (it.need && rule.satisfies?.includes(it.need)) this._satisfy(it, events);
          else this._mood(it, 'feliz', 3, events);
        }
      }
    }
    return events;
  }

  _letterOf(type) {
    return { abelha: 'A', elefante: 'E', iguana: 'I', onca: 'O', urso: 'U' }[type] || null;
  }

  /** A primeira regra que combina, nos dois sentidos (a regra decide quem é "a"). */
  _rule(p, q) {
    for (const rule of INTERACTIONS) {
      if (match(rule.a, p.type) && match(rule.b, q.type)) return { rule, a: p, b: q };
      if (match(rule.a, q.type) && match(rule.b, p.type)) return { rule, a: q, b: p };
    }
    return null;
  }

  /** Para salvar no aparelho (só o que está no chão). */
  toJSON() {
    return [...this.items.values()].map(({ kind, type, x, y, state }) => ({ kind, type, x: +x.toFixed(3), y: +y.toFixed(3), state }));
  }
}
