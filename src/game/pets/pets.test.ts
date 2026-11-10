import { expect, test } from 'bun:test';
import type { GameEvents, PetState } from '../api.sim.ts';
import { PETS } from '../content/pets.ts';
import type { GameSave } from '../kernel.sim.ts';
import { distance2d } from '../move.sim.ts';
import { install as installNav } from '../nav/index.sim.ts';
import { FEET, feet, makeStage, wall, type Stage } from '../nav/stage.testkit.ts';
import { install } from './index.sim.ts';

const GARDEN: [number, number] = [32, 32];
const ID = 'pet:leaftail:1';

/** A meadow 64 blocks wide with the dead garden in the middle, and the player 12 blocks east of it. */
function meadow(options: { ground?: string; save?: GameSave } = {}): Stage {
  const stage = makeStage({ chunks: 4, ground: options.ground, places: { 'dead.garden': GARDEN }, install: [installNav, install] });
  stage.player(GARDEN[0] + 12, GARDEN[1]);
  if (options.save) stage.kernel.load(options.save);
  return stage;
}

const pet = (stage: Stage): PetState => stage.kernel.game.systems.pets.all()[0];
const apart = (stage: Stage): number => distance2d(pet(stage).pos, stage.kernel.game.player.pos);
const fed = (stage: Stage): number[] => stage.heard.filter((e) => e.name === 'pet.fed').map((e) => (e.data as GameEvents['pet.fed']).trust);

/** Puts the player two blocks east of the pet, unless they are by it already, and lets them stand until it would eat. */
function standBy(stage: Stage, seconds = 1.5): void {
  const pos = pet(stage).pos;
  if (apart(stage) > 2.5) Object.assign(stage.kernel.game.player.pos, { x: pos.x + 2, y: FEET, z: pos.z });
  stage.run(seconds);
}

/** Feeds it three times, calmly. */
function bond(stage: Stage): void {
  stage.bag.set('berry', 3);
  stage.hand.id = 'berry';
  for (let i = 0; i < 3; i++) {
    standBy(stage, 3.5);
    stage.click('secondary');
  }
}

test('the leaftail is an actor with its own sprite, wild at the dead garden', () => {
  const stage = meadow();
  stage.run(0.05);
  const game = stage.kernel.game;
  expect(pet(stage)).toMatchObject({ id: ID, kind: 'leaftail', name: 'Leaftail', trust: 0, bonded: false, startled: false });
  expect(game.actors.get(ID)).toMatchObject({ id: ID, sprite: 'leaftail', anim: 'idle', visible: true, mark: '' });
  expect(game.actors.get(ID)!.pos).toBe(pet(stage).pos);
  expect(game.systems.pets.companion()).toBeNull();
  expect(distance2d(pet(stage).pos, feet(...GARDEN))).toBeLessThan(5);
});

test('wild, it walks from bed to bed around the garden', () => {
  const stage = meadow();
  const spots = new Set<string>();
  let walked = false;
  for (let i = 0; i < 60; i++) {
    stage.run(1);
    const actor = stage.kernel.game.actors.get(ID)!;
    if (actor.anim === 'walk') walked = true;
    else spots.add(`${actor.pos.x},${actor.pos.z}`);
    expect(distance2d(actor.pos, feet(...GARDEN))).toBeLessThan(5);
    expect(actor.pos.y).toBe(FEET);
  }
  expect(walked).toBe(true);
  expect(spots.size).toBeGreaterThanOrEqual(4);
  expect(stage.count('pet.startled')).toBe(0);
});

test('running near the leaftail startles it: it backs off 6 blocks and will not eat for 15 seconds', () => {
  const stage = meadow();
  stage.run(0.05);
  const game = stage.kernel.game;
  // The hero's walk is 4.4 blocks a second. Run west at the garden: nothing happens until 6 blocks from it.
  while (apart(stage) > 6.3) stage.walkPlayer(-1, 0, 4.4, 0.05);
  expect(stage.count('pet.startled')).toBe(0);
  const before = { x: pet(stage).pos.x, z: pet(stage).pos.z };
  stage.walkPlayer(-1, 0, 4.4, 0.3);
  expect(stage.heard.filter((e) => e.name === 'pet.startled').map((e) => e.data)).toEqual([{ pet: ID }]);
  expect(pet(stage).startled).toBe(true);
  expect(game.actors.get(ID)!.mark).toBe('alert');

  stage.run(3);
  expect(pet(stage).startled).toBe(false);
  expect(game.actors.get(ID)!.mark).toBe('');
  const backedOff = Math.hypot(pet(stage).pos.x - before.x, pet(stage).pos.z - before.z);
  expect(backedOff).toBeGreaterThan(5);
  expect(backedOff).toBeLessThan(7.5);
  expect(pet(stage).pos.x).toBeLessThan(before.x); // away from the player, who came from the east

  // Standing right by it with a berry, calm as can be: it is still wary.
  stage.bag.set('berry', 2);
  stage.hand.id = 'berry';
  standBy(stage, 2);
  expect(stage.click('secondary')).toBe(true);
  expect(stage.bag.get('berry')).toBe(2);
  expect(fed(stage)).toEqual([]);
  expect(stage.toasts().at(-1)).toBe('The leaftail is wary of you. Hold still and give it a moment.');

  // Walking off takes the berry back. 15 seconds after the fright it eats.
  stage.player(GARDEN[0] + 20, GARDEN[1]);
  stage.run(10);
  expect(fed(stage)).toEqual([]);
  standBy(stage);
  expect(stage.click('secondary')).toBe(true);
  expect(stage.bag.get('berry')).toBe(1);
  expect(fed(stage)).toEqual([1]);
  expect(stage.count('pet.startled')).toBe(1);
});

test('walking slowly up to it does not startle it', () => {
  const stage = meadow();
  stage.run(0.05);
  // Shift walks slower than 2.4 blocks a second. Walk until two blocks from it.
  for (let i = 0; i < 400 && apart(stage) > 2; i++) {
    const pos = pet(stage).pos, player = stage.kernel.game.player.pos;
    stage.walkPlayer(pos.x - player.x, pos.z - player.z, 2.3, 0.05);
  }
  expect(apart(stage)).toBeLessThanOrEqual(2);
  stage.run(2);
  expect(stage.count('pet.startled')).toBe(0);
  expect(pet(stage).startled).toBe(false);
  // Running far from it does not startle it either.
  stage.player(GARDEN[0] + 20, GARDEN[1]);
  stage.walkPlayer(0, 1, 4.4, 2);
  expect(stage.count('pet.startled')).toBe(0);
});

test('three calm feedings bond it', () => {
  const stage = meadow();
  const game = stage.kernel.game;
  stage.run(0.05);
  stage.bag.set('berry', 5);
  stage.hand.id = 'berry';

  // The player has only just stopped: the berry is held out, and it is taken once they have stood for a second.
  standBy(stage, 0.5);
  expect(stage.click('secondary')).toBe(true);
  expect(stage.toasts().at(-1)).toBe('Hold still and let it come to you.');
  expect(stage.bag.get('berry')).toBe(5);
  expect(fed(stage)).toEqual([]);
  stage.run(0.4);
  expect(fed(stage)).toEqual([]);
  stage.run(0.2);
  expect(fed(stage)).toEqual([1]);
  expect(stage.bag.get('berry')).toBe(4);
  expect(pet(stage).trust).toBe(1);
  expect(game.actors.get(ID)!.mark).toBe('heart');

  // It eats for 3 seconds, with a heart over it, and takes nothing more meanwhile. It comes up to the player.
  stage.run(1);
  expect(stage.click('secondary')).toBe(true);
  expect(stage.toasts().at(-1)).toBe('It is still eating.');
  expect(fed(stage)).toEqual([1]);
  stage.run(1.7);
  expect(game.actors.get(ID)!.mark).toBe('heart');
  stage.run(0.4);
  expect(game.actors.get(ID)!.mark).toBe('');
  expect(apart(stage)).toBeLessThan(1.5);

  standBy(stage);
  stage.click('secondary');
  expect(fed(stage)).toEqual([1, 2]);
  expect(stage.count('pet.bonded')).toBe(0);
  expect(game.flags.is('pet.leaftail.bonded')).toBe(false);

  standBy(stage, 3.5);
  stage.click('secondary');
  expect(fed(stage)).toEqual([1, 2, 3]);
  expect(stage.heard.filter((e) => e.name === 'pet.bonded').map((e) => e.data)).toEqual([{ pet: ID }]);
  expect(game.flags.is('pet.leaftail.bonded')).toBe(true);
  expect(pet(stage)).toMatchObject({ trust: 3, bonded: true });
  expect(game.systems.pets.companion()).toBe(pet(stage));
  expect(stage.bag.get('berry')).toBe(2);

  // A bonded pet takes no more berries, and the click goes on to whatever else uses it.
  standBy(stage, 3.5);
  expect(stage.click('secondary')).toBe(false);
  expect(stage.bag.get('berry')).toBe(2);
});

test('only a treat in the hand, by the secondary button, within 3 blocks, feeds it', () => {
  const stage = meadow();
  stage.run(0.05);
  stage.bag.set('berry', 2);
  stage.bag.set('oak_log', 2);
  standBy(stage);

  stage.hand.id = 'oak_log';
  expect(stage.click('secondary')).toBe(false);
  stage.hand.id = 'berry';
  expect(stage.click('primary')).toBe(false);
  const pos = pet(stage).pos;
  Object.assign(stage.kernel.game.player.pos, { x: pos.x + 4, z: pos.z });
  stage.run(1.5);
  expect(stage.click('secondary')).toBe(false);
  expect(fed(stage)).toEqual([]);
  expect(stage.bag.get('berry')).toBe(2);
});

test('"Offer a berry" shows while the player has one, and feeds it too', () => {
  const stage = meadow();
  stage.run(0.05);
  const prompt = stage.prompts.get(ID)!;
  expect(prompt.radius).toBe(3);
  expect(prompt.pos()).toBe(pet(stage).pos);
  expect(prompt.prompt()).toBeNull();

  stage.bag.set('berry', 3); // in the bag, not in the hand
  expect(prompt.prompt()).toBe('Offer a berry');
  standBy(stage);
  prompt.act();
  expect(fed(stage)).toEqual([1]);
  expect(stage.bag.get('berry')).toBe(2);

  standBy(stage, 3.5);
  expect(stage.kernel.game.systems.pets.feed(ID)).toBe(true);
  standBy(stage, 3.5);
  prompt.act();
  expect(pet(stage).bonded).toBe(true);
  expect(stage.bag.get('berry')).toBe(0);
  stage.bag.set('berry', 1);
  expect(prompt.prompt()).toBeNull();
  expect(stage.kernel.game.systems.pets.feed(ID)).toBe(false);
  expect(stage.kernel.game.systems.pets.feed('pet:nobody:1')).toBe(false);
});

test('a bonded pet stays within 3 blocks of a walking player', () => {
  const stage = meadow();
  stage.run(0.05);
  bond(stage);
  stage.run(4);
  let furthest = 0;
  const watch = (): void => { furthest = Math.max(furthest, apart(stage)); };
  // The hero's walk, around three sides of a square, then a stop.
  stage.walkPlayer(1, 0, 4.4, 4, watch);
  stage.walkPlayer(0, -1, 4.4, 4, watch);
  stage.walkPlayer(-1, 0.3, 4.4, 4, watch);
  stage.run(2, watch);
  expect(furthest).toBeLessThanOrEqual(3);
  expect(furthest).toBeGreaterThan(1);
  expect(apart(stage)).toBeLessThan(2);
  expect(stage.kernel.game.actors.get(ID)!.anim).toBe('idle');
  expect(stage.count('pet.startled')).toBe(0);
});

test('a bonded pet goes around a wall to keep up, and appears beside a player who gets more than 30 blocks away', () => {
  const stage = meadow();
  stage.run(0.05);
  bond(stage);
  stage.run(4);
  const player = stage.kernel.game.player.pos;

  // A wall between them, with the way around five blocks off.
  const px = Math.floor(player.x), pz = Math.floor(player.z);
  wall(stage.world, px - 5, pz - 2, px + 5, pz - 2);
  Object.assign(player, { x: px + 0.5, z: pz - 4.5 });
  stage.run(4);
  expect(apart(stage)).toBeLessThan(3);
  expect(pet(stage).pos.z).toBeLessThan(pz - 2);

  stage.player(4, 4);
  expect(apart(stage)).toBeGreaterThan(30);
  stage.run(0.05);
  expect(apart(stage)).toBeLessThan(3);
  expect(apart(stage)).toBeGreaterThan(0.5);
  expect(pet(stage).pos.y).toBe(FEET);
});

test('a bonded pet finds a seed within two minutes while the player stands on grass', () => {
  const stage = meadow();
  stage.run(0.05);
  bond(stage);
  stage.heard.length = 0;
  stage.run(120);
  const gained = stage.heard.filter((e) => e.name === 'item.gained').map((e) => e.data as GameEvents['item.gained']);
  expect(gained.length).toBeGreaterThanOrEqual(1);
  expect(gained.length).toBeLessThanOrEqual(2);
  expect(stage.bag.get('wheat_seeds')).toBe(gained.length);
  expect(gained[0]).toMatchObject({ id: 'wheat_seeds', count: 1 });
  expect(gained[0].at).toEqual({ ...pet(stage).pos }); // the pet has not moved: the player stood still
  expect(stage.toasts()).toEqual(gained.map(() => 'Your leaftail found a seed.'));

  // About once a minute after that.
  stage.run(600);
  const seeds = stage.bag.get('wheat_seeds')!;
  expect(seeds).toBeGreaterThanOrEqual(10);
  expect(seeds).toBeLessThanOrEqual(14);
});

test('it finds nothing while the player stands on stone, and a wild one finds nothing at all', () => {
  const stone = meadow({ ground: 'stone' });
  stone.run(0.05);
  bond(stone);
  stone.run(300);
  expect(stone.bag.get('wheat_seeds')).toBeUndefined();

  const wild = meadow();
  wild.run(300);
  expect(wild.bag.get('wheat_seeds')).toBeUndefined();
});

test('save then load keeps trust', () => {
  const stage = meadow();
  stage.run(0.05);
  stage.bag.set('berry', 3);
  stage.hand.id = 'berry';
  standBy(stage);
  stage.click('secondary');
  standBy(stage, 3.5);
  stage.click('secondary');
  stage.run(4);
  expect(pet(stage).trust).toBe(2);
  const where = { ...pet(stage).pos };
  const save = JSON.parse(JSON.stringify(stage.kernel.save())) as GameSave;

  const again = meadow({ save });
  expect(pet(again)).toMatchObject({ id: ID, trust: 2, bonded: false, startled: false });
  expect(pet(again).pos).toEqual(where);
  expect(again.kernel.game.systems.pets.companion()).toBeNull();

  // One more berry and it bonds, as it would have.
  again.bag.set('berry', 1);
  again.hand.id = 'berry';
  standBy(again);
  again.click('secondary');
  expect(pet(again).bonded).toBe(true);

  // A bonded pet is still the companion after a load, and still follows.
  const bonded = meadow({ save: JSON.parse(JSON.stringify(again.kernel.save())) as GameSave });
  expect(bonded.kernel.game.systems.pets.companion()).toMatchObject({ id: ID, trust: 3, bonded: true });
  expect(bonded.kernel.game.flags.is('pet.leaftail.bonded')).toBe(true);
  bonded.walkPlayer(1, 0, 4.4, 3);
  expect(apart(bonded)).toBeLessThanOrEqual(3);
});

test('the leaftail is as act 1 says', () => {
  expect(PETS.length).toBe(1);
  expect(PETS[0]).toMatchObject({
    kind: 'leaftail', sprite: 'leaftail', home: 'dead.garden', treat: 'berry', trustToBond: 3, bondedFlag: 'pet.leaftail.bonded',
    startle: { speed: 2.4, within: 6, backOff: 6, wary: 15 },
    feed: { within: 3, still: 1, prompt: 'Offer a berry' },
    follow: { within: 3, appearBeyond: 30 },
    finds: { item: 'wheat_seeds', surface: 'grass', toast: 'Your leaftail found a seed.' },
  });
});
