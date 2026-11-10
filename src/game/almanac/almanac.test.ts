import { expect, test } from 'bun:test';
import { World } from '../../features/world/world.sim.ts';
import type { CropState, CropsApi, EventName, GameEvents, PetState, PetsApi } from '../api.sim.ts';
import { createKernel } from '../kernel.sim.ts';
import { install } from './index.sim.ts';

function book() {
  const kernel = createKernel(new World(3), 3);
  install(kernel);
  const game = kernel.game;
  const heard: { name: EventName; data: GameEvents[EventName] }[] = [];
  game.events.onAny((name, data) => {
    if (name === 'fact.learned' || name === 'page.completed') heard.push({ name, data });
  });
  return { kernel, game, almanac: game.systems.almanac, heard };
}

const PEOPLE = ['tamsin', 'maren', 'odo', 'gus', 'mira', 'wren', 'juniper', 'brack'];

test('the book has a page for each creature, the pet, the crop and the eight people, all hidden at first', () => {
  const { almanac } = book();
  expect(almanac.pages().map((p) => p.id)).toEqual(['mossling', 'leaftail', 'wheat', 'lanternfly', ...PEOPLE]);
  for (const page of almanac.pages()) {
    expect(page.seen).toBe(false);
    expect(page.complete).toBe(false);
    expect(page.title.length).toBeGreaterThan(0);
    expect(page.picture.length).toBeGreaterThan(0);
    // Both columns have something to find.
    expect(page.facts.some((f) => f.column === 'needs')).toBe(true);
    expect(page.facts.some((f) => f.column === 'gives')).toBe(true);
    for (const fact of page.facts) {
      expect(fact.known).toBe(false);
      expect(fact.text.length).toBeGreaterThan(0);
    }
  }
  expect(almanac.pages().filter((p) => p.kind === 'person').map((p) => p.id)).toEqual(PEOPLE);
  expect(almanac.page('nobody')).toBeUndefined();
});

test('the mossling page has the exact words of the design', () => {
  const { almanac } = book();
  expect(almanac.page('mossling')!.facts).toEqual([
    { id: 'needs', column: 'needs', text: 'Shade and mossy stone', known: false },
    { id: 'gives', column: 'gives', text: 'A moss tuft, when the ground under it is damp', known: false },
  ]);
});

test('learn sends fact.learned, and page.completed on the last fact, each once', () => {
  const { almanac, heard } = book();
  almanac.learn('mossling', 'gives');
  expect(almanac.page('mossling')).toMatchObject({ seen: true, complete: false });
  expect(heard).toEqual([{ name: 'fact.learned', data: { page: 'mossling', column: 'gives', fact: 'gives' } }]);

  almanac.learn('mossling', 'gives');
  expect(heard).toHaveLength(1);

  almanac.learn('mossling', 'needs');
  expect(almanac.page('mossling')!.complete).toBe(true);
  expect(heard.slice(1)).toEqual([
    { name: 'fact.learned', data: { page: 'mossling', column: 'needs', fact: 'needs' } },
    { name: 'page.completed', data: { page: 'mossling' } },
  ]);

  almanac.learn('mossling', 'needs');
  almanac.learn('mossling', 'no-such-fact');
  almanac.learn('no-such-page', 'needs');
  expect(heard).toHaveLength(3);
});

test('meet shows a page with its facts still hidden', () => {
  const { almanac, heard } = book();
  almanac.meet('lanternfly');
  almanac.meet('no-such-page');
  const page = almanac.page('lanternfly')!;
  expect(page.seen).toBe(true);
  expect(page.facts.map((f) => f.known)).toEqual([false, false]);
  expect(heard).toEqual([]);
});

test('a person is met when a talk with them starts, and their facts come from the flags the dialogue sets', () => {
  const { game, almanac, heard } = book();
  game.events.emit('talk.started', { npc: 'gus', conversation: 'gus.seeds' });
  expect(almanac.page('gus')).toMatchObject({ seen: true, complete: false });
  expect(almanac.page('tamsin')!.seen).toBe(false);
  expect(heard).toEqual([]);

  game.flags.set('fact.gus.needs', false);
  game.flags.set('quest.gus.needs', true);
  game.flags.set('fact.gus', true);
  expect(heard).toEqual([]);

  game.flags.set('fact.gus.needs', true);
  expect(heard).toEqual([{ name: 'fact.learned', data: { page: 'gus', column: 'needs', fact: 'needs' } }]);
  game.flags.set('fact.gus.gives', 1);
  expect(almanac.page('gus')!.complete).toBe(true);
  expect(heard.at(-1)).toEqual({ name: 'page.completed', data: { page: 'gus' } });
});

test('a flag teaches a person who was never met, and a flag that says "wants" fills the needs column', () => {
  const { game, almanac } = book();
  game.flags.set('fact.brack.wants', true);
  const page = almanac.page('brack')!;
  expect(page.seen).toBe(true);
  expect(page.facts.find((f) => f.column === 'needs')!.known).toBe(true);
  expect(page.facts.find((f) => f.column === 'gives')!.known).toBe(false);
});

test('every person can be completed with fact.<id>.needs and fact.<id>.gives', () => {
  const { game, almanac } = book();
  for (const id of PEOPLE) {
    game.flags.set(`fact.${id}.needs`, true);
    game.flags.set(`fact.${id}.gives`, true);
    expect(almanac.page(id)!.complete).toBe(true);
  }
});

test('the leaftail page fills from feeding and bonding, whether the event names the kind or the pet id', () => {
  const { kernel, game, almanac } = book();
  const pets = { all: () => [{ id: 'pet:1', kind: 'leaftail', name: 'Fern' } as PetState], companion: () => null, feed: () => false } as PetsApi;
  kernel.add('pets', pets, {});

  game.events.emit('pet.startled', { pet: 'leaftail' });
  expect(almanac.page('leaftail')).toMatchObject({ seen: true, complete: false });
  expect(almanac.page('leaftail')!.facts.map((f) => f.known)).toEqual([false, false]);

  game.events.emit('pet.fed', { pet: 'pet:cat:2', trust: 1 });
  expect(almanac.page('leaftail')!.facts.map((f) => f.known)).toEqual([false, false]);

  game.events.emit('pet.fed', { pet: 'pet:leaftail:1', trust: 1 });
  expect(almanac.page('leaftail')!.facts.map((f) => f.known)).toEqual([true, false]);

  game.events.emit('pet.bonded', { pet: 'pet:1' });
  expect(almanac.page('leaftail')!.complete).toBe(true);
});

test('the wheat page fills from planting, watering, growing and harvesting wheat, and not another crop', () => {
  const { kernel, game, almanac } = book();
  const field = new Map<string, string>([['1,10,1', 'wheat'], ['2,10,1', 'turnip']]);
  const crops = {
    at: (x: number, y: number, z: number) => {
      const crop = field.get(`${x},${y},${z}`);
      return crop ? ({ crop, stage: 0, wet: 0, ripe: false } as CropState) : null;
    },
  } as unknown as CropsApi;
  kernel.add('crops', crops, {});
  const facts = () => almanac.page('wheat')!.facts.map((f) => `${f.id}:${f.known}`);

  game.events.emit('crop.planted', { x: 2, y: 10, z: 1, crop: 'turnip' });
  expect(almanac.page('wheat')!.seen).toBe(false);
  game.events.emit('crop.planted', { x: 1, y: 10, z: 1, crop: 'wheat' });
  expect(almanac.page('wheat')!.seen).toBe(true);

  game.events.emit('crop.watered', { x: 2, y: 10, z: 1 }); // the turnip
  game.events.emit('crop.watered', { x: 5, y: 10, z: 5 }); // bare ground
  game.events.emit('crop.grew', { x: 2, y: 10, z: 1, crop: 'turnip', stage: 1 });
  game.events.emit('crop.harvested', { x: 2, y: 10, z: 1, crop: 'turnip' });
  expect(facts()).toEqual(['needs:false', 'time:false', 'gives:false']);

  game.events.emit('crop.watered', { x: 1, y: 10, z: 1 });
  expect(facts()).toEqual(['needs:true', 'time:false', 'gives:false']);
  game.events.emit('crop.grew', { x: 1, y: 10, z: 1, crop: 'wheat', stage: 1 });
  expect(facts()).toEqual(['needs:true', 'time:true', 'gives:false']);
  game.events.emit('crop.harvested', { x: 1, y: 10, z: 1, crop: 'wheat' });
  expect(almanac.page('wheat')!.complete).toBe(true);
});

test('watering teaches the wheat fact when the event names the plant block above the soil', () => {
  const { kernel, game, almanac } = book();
  const crops = { at: (x: number, y: number, z: number) => (x === 1 && y === 10 && z === 1 ? { crop: 'wheat', stage: 0, wet: 0, ripe: false } : null) } as unknown as CropsApi;
  kernel.add('crops', crops, {});
  game.events.emit('crop.watered', { x: 1, y: 11, z: 1 });
  expect(almanac.page('wheat')!.facts[0].known).toBe(true);
});

test('save then load keeps met pages and known facts, and says nothing', () => {
  const first = book();
  first.almanac.learn('mossling', 'needs');
  first.almanac.learn('wheat', 'gives');
  first.almanac.learn('wheat', 'needs');
  first.almanac.learn('wheat', 'time');
  first.almanac.meet('maren');
  const save = JSON.parse(JSON.stringify(first.kernel.save()));

  const second = book();
  second.almanac.learn('gus', 'needs'); // known before the load, and not in the save
  second.heard.length = 0;
  second.kernel.load(save);
  expect(second.heard).toEqual([]);
  const summary = (id: string) => {
    const page = second.almanac.page(id)!;
    return { seen: page.seen, complete: page.complete, known: page.facts.filter((f) => f.known).map((f) => f.id) };
  };
  expect(summary('mossling')).toEqual({ seen: true, complete: false, known: ['needs'] });
  expect(summary('wheat')).toEqual({ seen: true, complete: true, known: ['needs', 'time', 'gives'] });
  expect(summary('maren')).toEqual({ seen: true, complete: false, known: [] });
  expect(summary('gus')).toEqual({ seen: false, complete: false, known: [] });
  expect(summary('tamsin')).toEqual({ seen: false, complete: false, known: [] });

  // The loaded book carries on: the last mossling fact completes the page once.
  second.almanac.learn('mossling', 'gives');
  expect(second.heard).toEqual([
    { name: 'fact.learned', data: { page: 'mossling', column: 'gives', fact: 'gives' } },
    { name: 'page.completed', data: { page: 'mossling' } },
  ]);
});
