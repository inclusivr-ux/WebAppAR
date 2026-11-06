import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZooState } from '../../inclusiapp/src/zoo/zooState.js';
import { ZOO, INTERACTIONS } from '../../inclusiapp/src/zoo/zooConfig.js';
import { seededRandom } from '../../inclusiapp/src/game/random.js';

const run = (zoo, seconds, step = 0.1) => {
  const events = [];
  for (let t = 0; t < seconds; t += step) events.push(...zoo.tick(step));
  return events;
};

test('coloca e tira animais e runas, até o limite', () => {
  const zoo = new ZooState({ random: seededRandom(1) });
  const urso = zoo.add('animal', 'urso');
  assert.equal(zoo.count, 1);
  for (let i = 1; i < ZOO.maxItems; i++) assert.ok(zoo.add('runa', 'A'));
  assert.equal(zoo.add('animal', 'abelha'), null, 'cheio');
  assert.ok(zoo.remove(urso.id));
  assert.equal(zoo.count, ZOO.maxItems - 1);
});

test('nada sai do chão: mover para fora fica na beirada', () => {
  const zoo = new ZooState({ random: seededRandom(2) });
  const it = zoo.add('animal', 'onca');
  zoo.move(it.id, 99, -99);
  assert.equal(it.x, zoo.bounds.maxX);
  assert.equal(it.y, zoo.bounds.minY);
  zoo.setBounds({ minX: -1, maxX: 1, minY: -0.5, maxY: 0.5 });
  assert.equal(it.x, 1);
});

test('o urso com fome encontra a abelha: ele come mel (a animação especial) e fica satisfeito', () => {
  const zoo = new ZooState({ random: seededRandom(3) });
  const urso = zoo.add('animal', 'urso', { x: 0, y: 0 });
  const abelha = zoo.add('animal', 'abelha', { x: 0.3, y: 0 });
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
  const iguana = zoo.add('animal', 'iguana', { x: 0.4, y: 0 });
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

test('a runa acende quando o seu animal chega perto (I de Iguana) e apaga depois', () => {
  const zoo = new ZooState({ random: seededRandom(5) });
  const runa = zoo.add('runa', 'I', { x: 0, y: 0 });
  zoo.add('animal', 'urso', { x: 0.2, y: 0 }); // não é a letra dele
  assert.equal(run(zoo, 0.5).filter((e) => e.type === 'rune').length, 0);
  const iguana = zoo.add('animal', 'iguana', { x: 0.3, y: 0.1 });
  const ev = run(zoo, 0.3);
  const rune = ev.find((e) => e.type === 'rune');
  assert.ok(rune);
  assert.equal(rune.animal, iguana.id);
  assert.equal(runa.state, 'acesa');
  assert.ok(run(zoo, ZOO.runeLit + 1).some((e) => e.type === 'rune-off'));
  assert.equal(runa.state, 'apagada');
});

test('necessidades aparecem com o tempo e o carinho resolve o "quer brincar"', () => {
  const zoo = new ZooState({ random: seededRandom(6) });
  const onca = zoo.add('animal', 'onca', { x: 0, y: 0 });
  const urso = zoo.add('animal', 'urso', { x: 1.5, y: 0.8 });
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

test('salvar: só tipo, posição e estado', () => {
  const zoo = new ZooState({ random: seededRandom(7) });
  zoo.add('animal', 'urso', { x: 0.1234, y: -0.5 });
  zoo.add('runa', 'U', { x: 0, y: 0 });
  const saved = zoo.toJSON();
  assert.equal(saved.length, 2);
  assert.deepEqual(Object.keys(saved[0]).sort(), ['kind', 'state', 'type', 'x', 'y']);
  assert.equal(saved[0].x, 0.123);
});
