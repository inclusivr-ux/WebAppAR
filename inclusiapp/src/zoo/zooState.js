/**
 * Regras do zoológico em AR (sem DOM e sem Three.js — testadas em Node).
 *
 * Guarda quem está no zoológico (os animais e as letras), as
 * necessidades de cada animal e decide quando dois "se encontram". A cena
 * em AR (zooAR.js) move os modelos sobre a página e toca as animações; aqui
 * só se decide O QUE acontece.
 *
 * Coordenadas: as da página do palco (y com + para o fundo), as mesmas do
 * livro (ar/pageWalker.js); o chão pode ser um trapézio (zooSpace.js). Cada
 * um guarda o seu raio (`r`): "perto" é LADO A LADO (a soma dos raios mais
 * ZOO.meetGap), e ninguém precisa entrar no outro para se encontrar.
 * Cada `tick(dt)` devolve os eventos:
 *   need       um animal quer algo (balão)
 *   mood       feliz / satisfeito / calmo / quer (balão)
 *   meet       dois animais se encontraram (a regra diz o que cada um faz)
 *   letter     a letra acendeu: o seu animal chegou perto
 *   letter-off a letra apagou (dá para repetir a brincadeira)
 *   visit      um animal resolveu ir até alguém (a sua letra ou um amigo)
 */
import { ZOO, NEEDS, INTERACTIONS, LETTER_OF } from './zooConfig.js';
import { clampToBounds, randomPoint } from '../ar/pageWalker.js';

let nextId = 1;

const match = (rule, id) => rule === '*' || rule === id;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/** O raio de cada um antes de o modelo chegar (a maior medida do modelo é 1). */
export function defaultRadius(kind, type, config = ZOO) {
  const r = (config.sizes[kind === 'animal' ? type : 'letra'] || 0.2) * 0.45;
  return kind === 'letra' ? r * (config.letterSpace || 1) : r;
}

export class ZooState {
  constructor({ config = ZOO, random = Math.random } = {}) {
    this.config = config;
    this.random = random;
    this.items = new Map();
    this.pairCooldowns = new Map(); // "idA|idB" → segundos restantes
    this.time = 0;
    this.bounds = { minX: -0.42, maxX: 0.42, minY: -0.42, maxY: 0.42 };
  }

  /** A área da página onde todos andam (a cena calcula com a margem). */
  setBounds(bounds) {
    this.bounds = bounds;
    for (const it of this.items.values()) this.move(it.id, it.x, it.y);
  }

  get count() { return this.items.size; }
  get full() { return this.items.size >= this.config.maxItems; }

  /** Quem já está no zoológico ('animal', 'urso') — um de cada. */
  find(kind, type) {
    for (const it of this.items.values()) if (it.kind === kind && it.type === type) return it;
    return null;
  }

  /**
   * Coloca um animal ('urso') ou uma letra ('A').
   * Devolve o elemento, ou null se não couber ou se ele já estiver lá.
   */
  add(kind, type, pos = null, r = null) {
    if (this.full || this.find(kind, type)) return null;
    const p = pos || (([x, y]) => ({ x, y }))(randomPoint(this.bounds, this.random));
    const animal = kind === 'animal';
    const item = {
      id: nextId++, kind, type, x: 0, y: 0,
      r: r ?? defaultRadius(kind, type, this.config),
      // animal: calmo | quer | feliz | satisfeito · letra: apagada | acesa
      state: kind === 'letra' ? 'apagada' : 'calmo',
      need: null,
      needIn: animal ? this._delay(this.config.needEvery, 0.4) : Infinity,
      visitIn: animal ? this._delay(this.config.visitEvery, 0.5) : Infinity,
      moodLeft: 0,
      busy: 0, // segundos ocupado numa interação
      visitTo: null, // quem ele está indo visitar
      visitLeft: 0,
    };
    this.items.set(item.id, item);
    this.move(item.id, p.x, p.y);
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
    [it.x, it.y] = clampToBounds([x, y], this.bounds);
  }

  /** O raio de verdade, quando o modelo chega (meia largura, em larguras da página). */
  setRadius(id, r) {
    const it = this.items.get(id);
    if (it && r > 0) it.r = r;
  }

  /** Lado a lado: a soma dos raios mais a folga do encontro. */
  near(p, q) {
    return dist(p, q) <= p.r + q.r + this.config.meetGap;
  }

  /** Alguém já está indo visitar `it`? */
  _beingVisited(it, except) {
    for (const o of this.items.values()) if (o !== except && o.visitTo === it.id && o.visitLeft > 0) return true;
    return false;
  }

  _delay([a, b], scale = 1) {
    return (a + this.random() * (b - a)) * scale;
  }

  /** A criança fez carinho: o animal fica feliz (e o "quer brincar" passa). */
  caress(id) {
    const it = this.items.get(id);
    if (!it || it.kind !== 'animal') return [];
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
    it.needIn = this._delay(this.config.needEvery);
    this._mood(it, it.type === 'urso' ? 'satisfeito' : 'feliz', 4, events);
  }

  tick(dt) {
    this.time += dt;
    const events = [];
    for (const [k, v] of this.pairCooldowns) {
      if (v - dt <= 0) this.pairCooldowns.delete(k);
      else this.pairCooldowns.set(k, v - dt);
    }
    const all = [...this.items.values()];
    const animals = all.filter((i) => i.kind === 'animal');
    const letters = all.filter((i) => i.kind === 'letra');

    for (const it of animals) {
      if (it.busy > 0) it.busy = Math.max(0, it.busy - dt);
      if (it.visitLeft > 0) {
        it.visitLeft -= dt;
        if (it.visitLeft <= 0) it.visitTo = null;
      }
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
      // de vez em quando vai visitar alguém (a sua letra primeiro, se estiver apagada);
      // ninguém visita quem está ocupado ou já recebendo visita (para não juntar todos)
      it.visitIn -= dt;
      if (it.visitIn <= 0 && !it.busy) {
        it.visitIn = this._delay(this.config.visitEvery);
        const letter = letters.find((l) => l.type === LETTER_OF[it.type] && l.state === 'apagada' && !l.waitAway);
        const friends = animals.filter((a) => a !== it && !a.busy && !a.visitTo && !this._beingVisited(a, it));
        const to = letter && (this.random() < 0.6 || !friends.length) ? letter
          : friends.length ? friends[Math.floor(this.random() * friends.length)] : null;
        if (to && !this.near(it, to)) {
          it.visitTo = to.id;
          it.visitLeft = this.config.visitTime;
          events.push({ type: 'visit', id: it.id, to: to.id });
        }
      }
    }

    // a letra + o seu animal: a letra acende (como as runas do livro)
    for (const l of letters) {
      if (l.state === 'acesa') {
        l.litLeft -= dt;
        if (l.litLeft <= 0) {
          l.state = 'apagada';
          l.waitAway = true; // só acende de novo quando o animal sair e voltar
          events.push({ type: 'letter-off', id: l.id });
        }
        continue;
      }
      const near = animals.filter((a) => LETTER_OF[a.type] === l.type && this.near(a, l));
      if (l.waitAway) {
        if (!near.length) l.waitAway = false;
        continue;
      }
      const friend = near.find((a) => !a.busy);
      if (friend) {
        l.state = 'acesa';
        l.litLeft = this.config.letterLit;
        friend.busy = 4;
        friend.visitTo = null;
        friend.visitLeft = 0;
        events.push({ type: 'letter', id: l.id, animal: friend.id, letter: l.type });
        this._satisfy(friend, events);
      }
    }

    // encontros entre animais
    for (let i = 0; i < animals.length; i++) {
      for (let j = i + 1; j < animals.length; j++) {
        const p = animals[i];
        const q = animals[j];
        if (p.busy || q.busy || !this.near(p, q)) continue;
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
        a.visitTo = b.visitTo = null;
        a.visitLeft = b.visitLeft = 0;
        events.push({ type: 'meet', a: a.id, b: b.id, rule });
        for (const it of [a, b]) {
          if (it.need && rule.satisfies?.includes(it.need)) this._satisfy(it, events);
          else this._mood(it, 'feliz', 3, events);
        }
      }
    }
    return events;
  }

  /** A primeira regra que combina, nos dois sentidos (a regra decide quem é "a"). */
  _rule(p, q) {
    for (const rule of INTERACTIONS) {
      if (match(rule.a, p.type) && match(rule.b, q.type)) return { rule, a: p, b: q };
      if (match(rule.a, q.type) && match(rule.b, p.type)) return { rule, a: q, b: p };
    }
    return null;
  }
}
