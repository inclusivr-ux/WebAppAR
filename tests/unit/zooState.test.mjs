import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZooState } from '../../inclusiapp/src/zoo/zooState.js';
import { ZOO, ZOO_CARDS, INTERACTIONS, LETTER_OF } from '../../inclusiapp/src/zoo/zooConfig.js';
import { ANIMALS } from '../../inclusiapp/src/config.js';
import { seededRandom } from '../../inclusiapp/src/game/random.js';

const run = (zoo, seconds, step = 0.1) => {
  const events = [];
  for (let t = 0; t < seconds; t += step) events.push(...zoo.tick(step));
  return events;
};

test('as 20 cartas: as duas faces de cada animal trazem o animal; as das vogais trazem a letra', () => {
  assert.equal(Object.keys(ZOO_CARDS).length, 20);
  for (const a of ANIMALS) {
    assert.deepEqual([ZOO_CARDS[a.cards.picture].type, ZOO_CARDS[a.cards.sign].type], [a.id, a.id]);
  }
  for (let n = 11; n <= 20; n++) assert.equal(ZOO_CARDS[n].kind, 'letra');
  assert.equal(ZOO_CARDS[11].type, 'A', 'a carta do sinal do A');
  assert.equal(ZOO_CARDS[16].type, 'A', 'a carta da letra A');
});

test('um de cada no zoológico, até o limite', () => {
  const zoo = new ZooState({ random: seededRandom(1) });
  const urso = zoo.add('animal', 'urso');
  assert.ok(urso);
  assert.equal(zoo.add('animal', 'urso'), null, 'o urso já está lá');
  assert.equal(zoo.find('animal', 'urso'), urso);
  for (const a of ['abelha', 'elefante', 'iguana', 'onca']) assert.ok(zoo.add('animal', a));
  for (const l of 'AEIOU') assert.ok(zoo.add('letra', l));
  assert.ok(zoo.add('personagem', 'aia'));
  assert.ok(zoo.add('personagem', 'seuze'));
  assert.equal(zoo.count, ZOO.maxItems);
  assert.ok(zoo.full);
  assert.ok(zoo.remove(urso.id));
  assert.equal(zoo.find('animal', 'urso'), null);
});

test('ninguém sai da página: mover para fora fica na beirada', () => {
  const zoo = new ZooState({ random: seededRandom(2) });
  const it = zoo.add('animal', 'onca', { x: 99, y: -99 });
  assert.equal(it.x, zoo.bounds.maxX, 'a carta na beirada: entra na beirada');
  zoo.move(it.id, -99, 99);
  assert.equal(it.y, zoo.bounds.maxY);
  zoo.setBounds({ minX: -0.3, maxX: 0.3, minY: -0.2, maxY: 0.2 });
  assert.equal(it.x, -0.3);
});

test('o urso com fome encontra a abelha: ele come mel (a animação especial) e fica satisfeito', () => {
  const zoo = new ZooState({ random: seededRandom(3) });
  const urso = zoo.add('animal', 'urso', { x: 0, y: 0 });
  const abelha = zoo.add('animal', 'abelha', { x: 0.1, y: 0 });
  urso.need = 'fome';
  const ev = run(zoo, 0.3);
  const meet = ev.find((e) => e.type === 'meet');
  assert.ok(meet);
  assert.equal(meet.a, urso.id, 'o urso é quem come');
  assert.equal(meet.rule.aClip, 'special');
  assert.equal(meet.rule.approach, 'b', 'a abelha vai até o urso');
  assert.equal(urso.need, null);
  assert.equal(urso.state, 'satisfeito');
  assert.ok(ev.some((e) => e.type === 'mood' && e.id === abelha.id));
});

test('o elefante e a onça brincam com quem chega perto; o par só repete depois de um tempo', () => {
  const zoo = new ZooState({ random: seededRandom(4) });
  const ele = zoo.add('animal', 'elefante', { x: 0, y: 0 });
  const iguana = zoo.add('animal', 'iguana', { x: 0.12, y: 0 });
  iguana.need = 'brincar';
  const first = run(zoo, 0.2).filter((e) => e.type === 'meet');
  assert.equal(first.length, 1);
  assert.equal(first[0].a, ele.id);
  assert.equal(first[0].rule.aClip, 'special', 'o jato d\'água');
  ele.busy = 0;
  iguana.busy = 0;
  iguana.need = 'brincar';
  assert.equal(run(zoo, 2).filter((e) => e.type === 'meet').length, 0, 'ainda no intervalo');
});

test('a letra acende quando o seu animal chega perto (I de Iguana) e apaga depois', () => {
  const zoo = new ZooState({ random: seededRandom(5) });
  const letra = zoo.add('letra', 'I', { x: 0, y: 0 });
  zoo.add('animal', 'urso', { x: 0.1, y: 0 }); // não é a letra dele
  assert.equal(run(zoo, 0.5).filter((e) => e.type === 'letter').length, 0);
  const iguana = zoo.add('animal', 'iguana', { x: 0.08, y: 0.05 });
  const ev = run(zoo, 0.3);
  const lit = ev.find((e) => e.type === 'letter');
  assert.ok(lit);
  assert.equal(lit.animal, iguana.id);
  assert.equal(letra.state, 'acesa');
  assert.ok(run(zoo, ZOO.letterLit + 1).some((e) => e.type === 'letter-off'));
  assert.equal(letra.state, 'apagada');
});

test('de tempos em tempos o animal vai visitar a sua letra (ou um amigo)', () => {
  const zoo = new ZooState({ random: seededRandom(8) });
  const urso = zoo.add('animal', 'urso', { x: -0.35, y: -0.35 });
  const u = zoo.add('letra', 'U', { x: 0.35, y: 0.35 });
  const visits = run(zoo, ZOO.visitEvery[1] + 1, 0.2).filter((e) => e.type === 'visit');
  assert.ok(visits.length >= 1);
  assert.deepEqual([visits[0].id, visits[0].to], [urso.id, u.id], 'U de Urso');
  assert.equal(LETTER_OF.urso, 'U');
});

test('a Aia, o Seu Zé e as letras não sentem fome nem querem brincar', () => {
  const zoo = new ZooState({ random: seededRandom(9) });
  zoo.add('personagem', 'aia', { x: 0, y: 0 });
  zoo.add('letra', 'A', { x: 0.3, y: 0 });
  const ev = run(zoo, ZOO.needEvery[1] + 2, 0.5);
  assert.equal(ev.filter((e) => e.type === 'need' || e.type === 'visit').length, 0);
});

test('necessidades aparecem com o tempo e o carinho resolve o "quer brincar"', () => {
  const zoo = new ZooState({ random: seededRandom(6) });
  const onca = zoo.add('animal', 'onca', { x: -0.4, y: -0.4 });
  const urso = zoo.add('animal', 'urso', { x: 0.4, y: 0.4 });
  // longe um do outro e sem visitas: só o tempo passando
  onca.visitIn = urso.visitIn = Infinity;
  const ev = run(zoo, ZOO.needEvery[1] + 1, 0.5);
  assert.ok(ev.some((e) => e.type === 'need' && e.id === onca.id && e.need === 'brincar'));
  assert.ok(ev.some((e) => e.type === 'need' && e.id === urso.id && e.need === 'fome'));
  const after = zoo.caress(onca.id);
  assert.equal(onca.need, null);
  assert.ok(after.some((e) => e.type === 'mood' && e.state === 'feliz'));
});

test('as interações só usam animais do livro e animações que existem', () => {
  const ids = new Set(['*', 'abelha', 'elefante', 'iguana', 'onca', 'urso']);
  for (const r of INTERACTIONS) {
    assert.ok(ids.has(r.a) && ids.has(r.b));
    assert.ok(['special', 'happy'].includes(r.aClip) && ['special', 'happy'].includes(r.bClip));
    assert.ok(r.story, 'toda interação diz de onde vem na história');
  }
});
