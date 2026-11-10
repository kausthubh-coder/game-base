import { expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { emptyHit } from '../../features/world/world.sim.ts';
import type { ActionsApi, CreatureState, ItemsApi, UseContext } from '../api.sim.ts';
import { CREATURES, type CreatureKind } from '../content/creatures.ts';
import { facingOf } from '../move.sim.ts';
import { FEET, FLOOR, makeStage, roof, type Stage } from './stage.testkit.ts';

const creatures = (stage: Stage): readonly CreatureState[] => stage.kernel.game.systems.creatures.all();
const mossling = (stage: Stage) => stage.kernel.game.systems.almanac.page('mossling')!;
const known = (stage: Stage, fact: string): boolean => mossling(stage).facts.find((f) => f.id === fact)!.known;

/** One shaded mossy block in the air with nothing around it, so the mossling stays on it. */
function island(water: boolean): Stage {
  const stage = makeStage({ ground: 'island' });
  stage.set(8, FLOOR, 8, 'mossy_stone');
  if (water) stage.set(10, FLOOR, 8, 'water');
  roof(stage, 6, 6, 10, 10);
  return stage;
}

// ------------------------------------------------------------------------------------------ appearing

test('a mossling appears on mossy stone in shade, and nowhere else', () => {
  const stage = makeStage({ ground: 'floor' });
  roof(stage, 5, 5, 11, 11);
  stage.set(8, FLOOR, 8, 'mossy_stone'); // in shade
  stage.set(2, FLOOR, 2, 'mossy_stone'); // in the sun
  expect(stage.world.lightAt(8, FEET, 8)).toBeLessThanOrEqual(14);
  expect(stage.world.lightAt(2, FEET, 2)).toBe(15);

  const born = new Map<string, { x: number; y: number; z: number }>();
  stage.run(60, () => {
    for (const c of creatures(stage)) if (!born.has(c.id)) born.set(c.id, { ...c.pos });
  });

  expect([...born.keys()].sort()).toEqual(['creature:mossling:1', 'creature:mossling:2', 'creature:mossling:3']);
  for (const pos of born.values()) expect(pos).toEqual({ x: 8.5, y: FEET, z: 8.5 });
});

test('no mossling appears on mossy stone in full sun, or in shade without mossy stone', () => {
  const sunny = makeStage({ ground: 'floor' });
  sunny.set(8, FLOOR, 8, 'mossy_stone');
  sunny.run(30);
  expect(creatures(sunny)).toHaveLength(0);

  const bare = makeStage({ ground: 'floor' });
  roof(bare, 5, 5, 11, 11);
  bare.run(30);
  expect(creatures(bare)).toHaveLength(0);
});

test('there are never more than 3 mosslings, however many mossy stones there are', () => {
  const stage = makeStage({ ground: 'floor' });
  roof(stage, 3, 3, 13, 13);
  for (const [x, z] of [[6, 6], [8, 6], [10, 6], [6, 9], [8, 9], [10, 9], [7, 11]]) stage.set(x, FLOOR, z, 'mossy_stone');
  let most = 0;
  stage.run(120, () => (most = Math.max(most, creatures(stage).length)));
  expect(most).toBe(3);
  expect(creatures(stage)).toHaveLength(3);
});

test('each mossling is an actor that uses the critter sprite, faces where it moves and walks or idles', () => {
  const stage = makeStage({ ground: 'floor' });
  roof(stage, 3, 3, 13, 13);
  for (const [x, z] of [[6, 6], [9, 7], [7, 10]]) stage.set(x, FLOOR, z, 'mossy_stone');
  const actors = stage.kernel.game.actors;
  const before = new Map<string, { x: number; z: number }>();
  let walked = 0, idled = 0;
  stage.run(60, () => {
    for (const c of creatures(stage)) {
      const actor = actors.get(c.id)!;
      expect(actor.sprite).toBe('critter');
      expect(actor.pos).toBe(c.pos);
      const was = before.get(c.id);
      if (was) {
        const dx = c.pos.x - was.x, dz = c.pos.z - was.z;
        if (Math.hypot(dx, dz) > 1e-6) {
          expect(actor.anim).toBe('walk');
          expect(actor.facing).toBeCloseTo(facingOf(dx, dz), 5);
          walked++;
        } else {
          expect(actor.anim).toBe('idle');
          idled++;
        }
      }
      before.set(c.id, { x: c.pos.x, z: c.pos.z });
    }
  });
  expect([...actors.keys()].sort()).toEqual(['creature:mossling:1', 'creature:mossling:2', 'creature:mossling:3']);
  expect(walked).toBeGreaterThan(100);
  expect(idled).toBeGreaterThan(100);
});

test('a mossling wanders no farther than 6 blocks from where it appeared, and stays out of water', () => {
  const stage = makeStage({ ground: 'floor' });
  roof(stage, 1, 1, 14, 14);
  stage.set(8, FLOOR, 8, 'mossy_stone');
  stage.set(11, FLOOR, 8, 'water');
  stage.set(11, FLOOR, 9, 'water');
  let farthest = 0;
  stage.run(180, () => {
    for (const c of creatures(stage)) {
      farthest = Math.max(farthest, Math.hypot(c.pos.x - 8.5, c.pos.z - 8.5));
      expect(Math.floor(c.pos.x) === 11 && (Math.floor(c.pos.z) === 8 || Math.floor(c.pos.z) === 9)).toBe(false);
    }
  });
  expect(farthest).toBeGreaterThan(2);
  expect(farthest).toBeLessThanOrEqual(6.01);
});

test('a mossling steps down one block and back up, and never drops off a taller rock', () => {
  const low = makeStage({ ground: 'floor' });
  roof(low, 3, 3, 13, 13);
  low.set(8, FLOOR + 1, 8, 'mossy_stone');
  const heights = new Set<number>();
  let returned = false;
  low.run(180, () => {
    for (const c of creatures(low)) {
      heights.add(c.pos.y);
      if (heights.has(FEET) && c.pos.y === FEET + 1) returned = true;
    }
  });
  expect(heights.has(FEET + 1)).toBe(true);
  expect(heights.has(FEET)).toBe(true);
  expect(returned).toBe(true);

  const tall = makeStage({ ground: 'floor' });
  roof(tall, 3, 3, 13, 13);
  tall.set(8, FLOOR + 1, 8, 'stone');
  tall.set(8, FLOOR + 2, 8, 'mossy_stone');
  tall.run(180, () => {
    for (const c of creatures(tall)) expect([Math.floor(c.pos.x), c.pos.y, Math.floor(c.pos.z)]).toEqual([8, FEET + 2, 8]);
  });
  expect(creatures(tall)).toHaveLength(1);
});

// ------------------------------------------------------------------------------------------ giving

test('a mossling on damp ground leaves a moss tuft every 20 seconds', () => {
  const stage = island(true);
  stage.run(19.5);
  expect(stage.bag.get('moss_tuft')).toBeUndefined();
  stage.run(1);
  expect(stage.bag.get('moss_tuft')).toBe(1);
  const gave = stage.heard.find((e) => e.name === 'creature.gave')!.data as { kind: string; item: string; at: { x: number; y: number; z: number } };
  expect({ kind: gave.kind, item: gave.item }).toEqual({ kind: 'mossling', item: 'moss_tuft' });
  expect([Math.floor(gave.at.x), gave.at.y, Math.floor(gave.at.z)]).toEqual([8, FEET, 8]);
  stage.run(20.5);
  expect(stage.bag.get('moss_tuft')).toBe(2);
  expect(stage.count('creature.gave')).toBe(2);
});

test('a mossling on dry ground leaves nothing', () => {
  const stage = island(false);
  stage.run(120);
  expect(creatures(stage)).toHaveLength(1);
  expect(stage.bag.size).toBe(0);
  expect(stage.count('creature.gave')).toBe(0);
});

test('water three blocks away is too far to make the ground damp', () => {
  const stage = makeStage({ ground: 'island' });
  stage.set(8, FLOOR, 8, 'mossy_stone');
  stage.set(11, FLOOR, 8, 'water');
  roof(stage, 6, 6, 10, 10);
  stage.run(60);
  expect(stage.bag.size).toBe(0);
});

test('watered ground is damp for 3 minutes, then dry again', () => {
  const stage = island(false);
  stage.run(30);
  expect(stage.bag.size).toBe(0);
  stage.kernel.game.events.emit('crop.watered', { x: 7, y: FLOOR, z: 8 });
  stage.run(1);
  expect(stage.bag.get('moss_tuft')).toBe(1);
  stage.run(178); // 179 seconds after the water: tufts at 0, 20, 40 ... 160
  expect(stage.bag.get('moss_tuft')).toBe(9);
  stage.run(120);
  expect(stage.bag.get('moss_tuft')).toBe(9);
});

test('rain makes the ground damp', () => {
  const stage = island(false);
  stage.run(30);
  stage.kernel.game.ambient.rain = 0.6;
  stage.run(1);
  expect(stage.bag.get('moss_tuft')).toBe(1);
});

test('the watering can on plain ground makes it damp, and leaves tilled soil to the crops system', () => {
  const stage = island(false);
  const handlers: ((context: UseContext) => boolean)[] = [];
  stage.kernel.add('actions', { addHandler: (handler: (context: UseContext) => boolean) => void handlers.push(handler) } as unknown as ActionsApi, {});
  const items = { get: (id: string) => ({ id, tool: id === 'watering_can' ? { kind: 'can', tier: 1 } : undefined }) } as unknown as ItemsApi;
  stage.kernel.add('items', items, {});
  stage.run(30);
  expect(handlers).toHaveLength(1);
  const use = (held: string | null, block: string, button: UseContext['button'] = 'secondary'): boolean =>
    handlers[0]({ hit: { ...emptyHit(), x: 8, y: FLOOR, z: 8, id: blockId(block) }, held: held ? { id: held, count: 1 } : null, button });

  expect(use('axe', 'mossy_stone')).toBe(false);
  expect(use(null, 'mossy_stone')).toBe(false);
  expect(use('watering_can', 'mossy_stone', 'primary')).toBe(false);
  expect(use('watering_can', 'tilled_soil')).toBe(false);
  expect(handlers[0]({ hit: null, held: { id: 'watering_can', count: 1 }, button: 'secondary' })).toBe(false);
  expect(stage.count('crop.watered')).toBe(0);
  expect(stage.bag.size).toBe(0);

  expect(use('watering_can', 'mossy_stone')).toBe(true);
  expect(stage.heard.at(-1)).toEqual({ name: 'crop.watered', data: { x: 8, y: FLOOR, z: 8 } });
  stage.run(1);
  expect(stage.bag.get('moss_tuft')).toBe(1);
});

test('the tuft reaches the bag only when the player is within 10 blocks', () => {
  const stage = island(true);
  stage.player(8, 8 + 12);
  stage.run(45);
  expect(stage.bag.size).toBe(0);
  expect(stage.count('creature.gave')).toBe(0);
  expect(known(stage, 'gives')).toBe(false);
  // It did leave tufts at 20 and 40 seconds: its timer started again. They were lost.
  const saved = stage.kernel.save().systems.creatures as { creatures: { ready: number }[] };
  expect(saved.creatures[0].ready).toBeLessThan(6);

  stage.player(8, 8 + 9);
  stage.run(20);
  expect(stage.bag.get('moss_tuft')).toBe(1);
  expect(stage.count('creature.gave')).toBe(1);
});

// ------------------------------------------------------------------------------------------ watching

test('both mossling facts are learned by watching, and the page completes', () => {
  const stage = island(true);
  stage.player(8, 8 + 9);
  stage.run(2.5);
  expect(mossling(stage).seen).toBe(true);
  expect(known(stage, 'needs')).toBe(false);
  stage.run(1);
  expect(known(stage, 'needs')).toBe(true);
  expect(known(stage, 'gives')).toBe(false);
  expect(mossling(stage).complete).toBe(false);

  stage.run(17);
  expect(known(stage, 'gives')).toBe(true);
  expect(mossling(stage).complete).toBe(true);
  const story = stage.heard.filter((e) => e.name === 'fact.learned' || e.name === 'page.completed');
  expect(story).toEqual([
    { name: 'fact.learned', data: { page: 'mossling', column: 'needs', fact: 'needs' } },
    { name: 'fact.learned', data: { page: 'mossling', column: 'gives', fact: 'gives' } },
    { name: 'page.completed', data: { page: 'mossling' } },
  ]);

  stage.run(60);
  expect(stage.count('fact.learned')).toBe(2);
  expect(stage.count('page.completed')).toBe(1);
});

test('watching teaches nothing until the player has the Almanac, by its flag or by the book in the bag', () => {
  for (const how of ['flag', 'item']) {
    const stage = makeStage({ ground: 'island', book: false });
    stage.set(8, FLOOR, 8, 'mossy_stone');
    stage.set(10, FLOOR, 8, 'water');
    roof(stage, 6, 6, 10, 10);
    stage.run(50);
    // The mossling gave tufts all the same.
    expect(stage.bag.get('moss_tuft')).toBe(2);
    expect(mossling(stage).seen).toBe(false);
    expect(stage.count('fact.learned')).toBe(0);

    if (how === 'flag') stage.kernel.game.flags.set('has.almanac', true);
    else stage.bag.set('almanac', 1);
    stage.run(4);
    expect(known(stage, 'needs')).toBe(true);
    expect(known(stage, 'gives')).toBe(false);
    stage.run(20);
    expect(mossling(stage).complete).toBe(true);
  }
});

test('nothing is learned from more than 10 blocks away', () => {
  const stage = island(true);
  stage.player(8, 8 + 12);
  stage.run(60);
  expect(mossling(stage).seen).toBe(false);
  expect(stage.count('fact.learned')).toBe(0);
});

test('a mossling that is not on mossy stone does not teach what it needs', () => {
  const stage = island(false);
  stage.player(8, 8 + 5);
  stage.run(1);
  expect(creatures(stage)).toHaveLength(1);
  stage.set(8, FLOOR, 8, 'stone');
  stage.run(20);
  expect(known(stage, 'needs')).toBe(false);
  stage.set(8, FLOOR, 8, 'mossy_stone');
  stage.run(3.5);
  expect(known(stage, 'needs')).toBe(true);
});

// ------------------------------------------------------------------------------------------ far away

test('creatures more than 48 blocks from the player sleep: they do not move, give or age', () => {
  const stage = makeStage({ ground: 'floor' });
  roof(stage, 3, 3, 13, 13);
  for (const [x, z] of [[6, 6], [9, 7], [7, 10]]) stage.set(x, FLOOR, z, 'mossy_stone');
  stage.set(8, FLOOR, 8, 'water');
  stage.run(30);
  expect(creatures(stage)).toHaveLength(3);

  stage.player(8 + 60, 8);
  stage.run(0.05);
  const asleep = JSON.stringify(stage.kernel.save().systems.creatures);
  const events = stage.heard.length;
  stage.run(120);
  expect(creatures(stage).map((c) => c.doing)).toEqual(['sleep', 'sleep', 'sleep']);
  expect(JSON.stringify(stage.kernel.save().systems.creatures)).toBe(asleep);
  expect(stage.heard.length).toBe(events);
  expect(stage.kernel.game.systems.creatures.countNear('mossling', { x: 8, y: FEET, z: 8 }, 10)).toBe(3);

  stage.player(8, 12);
  stage.run(30);
  expect(creatures(stage).every((c) => c.doing !== 'sleep')).toBe(true);
  expect(JSON.stringify(stage.kernel.save().systems.creatures)).not.toBe(asleep);
});

test('no mossling appears while the player is far from the rocks', () => {
  const stage = makeStage({ ground: 'floor' });
  roof(stage, 5, 5, 11, 11);
  stage.set(8, FLOOR, 8, 'mossy_stone');
  stage.player(8 + 60, 8);
  stage.run(30);
  expect(creatures(stage)).toHaveLength(0);
  stage.player(8, 12);
  stage.run(2.5);
  expect(creatures(stage)).toHaveLength(1);
});

// ------------------------------------------------------------------------------------------ a kind is only data

const pebblehog: CreatureKind = {
  id: 'pebblehog',
  name: 'Pebblehog',
  sprite: 'pet',
  appears: { block: 'sand', within: 2, light: [15, 15], max: 2, around: 'player', radius: 6, every: 1 },
  moves: { mode: 'walk', radius: 3, speed: 2, pause: [0.5, 1], home: 0.2 },
  fears: [{ of: 'player', within: 3 }],
  gives: { item: 'pebble', every: 5, when: { kind: 'on', block: 'stone' }, reach: 20 },
  awake: { from: 0.3, to: 0.7 },
  watch: null,
};

test('a second kind written only as data runs in the same engine', () => {
  const stage = makeStage({ ground: 'floor', kinds: [...CREATURES, pebblehog] });
  const game = stage.kernel.game;
  stage.set(4, FLOOR, 4, 'sand');
  stage.player(8, 8);

  game.clock.timeOfDay = 0.9; // it is not out at night
  stage.run(10);
  expect(creatures(stage)).toHaveLength(0);

  game.clock.timeOfDay = 0.5;
  stage.run(20);
  const hogs = creatures(stage);
  expect(hogs.map((c) => c.id).sort()).toEqual(['creature:pebblehog:1', 'creature:pebblehog:2']);
  expect(game.actors.get('creature:pebblehog:1')!.sprite).toBe('pet');
  expect(stage.bag.get('pebble')).toBeGreaterThanOrEqual(4);
  expect(stage.bag.has('moss_tuft')).toBe(false);

  // It fears the player: stand beside one and it runs.
  // The player stands on its far side from the middle of the floor, so it has room to run.
  const hog = hogs[0];
  const out = Math.hypot(hog.pos.x - 8, hog.pos.z - 8) || 1;
  stage.player(hog.pos.x + (hog.pos.x - 8) / out, hog.pos.z + (hog.pos.z - 8) / out);
  const from = { x: game.player.pos.x, z: game.player.pos.z };
  stage.run(0.05);
  expect(hog.doing).toBe('flee');
  expect(game.actors.get(hog.id)!.anim).toBe('walk');
  stage.run(1);
  expect(Math.hypot(hog.pos.x - from.x, hog.pos.z - from.z)).toBeGreaterThan(2.5);

  game.clock.timeOfDay = 0.9;
  stage.run(0.05);
  expect(creatures(stage)).toHaveLength(0);
  expect([...game.actors.keys()]).toEqual([]);
});

// ------------------------------------------------------------------------------------------ lanternflies

function pond(): Stage {
  const stage = makeStage({ ground: 'floor' });
  for (let x = 6; x <= 9; x++) for (let z = 3; z <= 5; z++) stage.set(x, FLOOR, z, 'water');
  stage.player(8, 9);
  return stage;
}

test('lanternflies come out at night near water, up to 6, and are gone by day', () => {
  const stage = pond();
  const game = stage.kernel.game;
  game.clock.timeOfDay = 0.5;
  stage.run(30);
  expect(creatures(stage)).toHaveLength(0);

  game.clock.timeOfDay = 0.9;
  let most = 0;
  stage.run(90, () => (most = Math.max(most, creatures(stage).length)));
  expect(most).toBe(6);
  for (const c of creatures(stage)) {
    expect(c.id.startsWith('creature:lanternfly:')).toBe(true);
    expect(game.actors.get(c.id)!.sprite).toBe('lanternfly');
    expect(c.pos.y).toBeGreaterThan(FEET);
  }
  expect(stage.bag.size).toBe(0);

  game.clock.timeOfDay = 0.3;
  stage.run(0.05);
  expect(creatures(stage)).toHaveLength(0);
});

test('no lanternfly appears at night with no water near the player', () => {
  const stage = makeStage({ ground: 'floor' });
  stage.kernel.game.clock.timeOfDay = 0.9;
  stage.run(30);
  expect(creatures(stage)).toHaveLength(0);
});

test('lanternflies drift to a lamp, and watching them there fills their page', () => {
  const stage = pond();
  const game = stage.kernel.game;
  game.clock.timeOfDay = 0.9;
  stage.set(12, FEET, 12, 'lamp');
  stage.player(10, 11);
  stage.run(120);
  const flies = creatures(stage);
  expect(flies).toHaveLength(6);
  const near = flies.filter((c) => Math.hypot(c.pos.x - 12.5, c.pos.z - 12.5) < 3).length;
  expect(near).toBeGreaterThanOrEqual(4);
  const page = game.systems.almanac.page('lanternfly')!;
  expect(page.facts.map((f) => f.known)).toEqual([true, true]);
  expect(page.complete).toBe(true);
});

test('lanternflies left more than 48 blocks behind are let go', () => {
  const stage = pond();
  stage.kernel.game.clock.timeOfDay = 0.9;
  stage.run(30);
  expect(creatures(stage).length).toBeGreaterThan(0);
  stage.player(8 + 80, 9);
  stage.run(0.05);
  expect(creatures(stage)).toHaveLength(0);
});

// ------------------------------------------------------------------------------------------ saving

test('save then load keeps the creatures, their timers, the damp ground and the known facts', () => {
  const stage = island(false);
  stage.player(8, 8 + 5);
  stage.kernel.game.events.emit('crop.watered', { x: 8, y: FLOOR, z: 8 });
  stage.run(27);
  expect(stage.bag.get('moss_tuft')).toBe(1);
  const save = JSON.parse(JSON.stringify(stage.kernel.save()));

  const again = island(false);
  again.kernel.load(save);
  expect(again.heard).toEqual([]);
  expect(creatures(again).map((c) => ({ id: c.id, kind: c.kind, pos: c.pos }))).toEqual([
    { id: 'creature:mossling:1', kind: 'mossling', pos: { ...creatures(stage)[0].pos } },
  ]);
  expect(again.kernel.game.actors.get('creature:mossling:1')!.pos).toBe(creatures(again)[0].pos);
  expect([...again.kernel.game.actors.keys()]).toEqual(['creature:mossling:1']);
  expect(mossling(again).facts.map((f) => f.known)).toEqual([true, true]);
  expect(mossling(again).complete).toBe(true);

  // The timer and the damp ground carry on: the next tuft comes 40 seconds after the water, not 20 after loading.
  again.run(12);
  expect(again.bag.size).toBe(0);
  again.run(2);
  expect(again.bag.get('moss_tuft')).toBe(1);
  // Nothing already known is announced a second time.
  expect(again.count('fact.learned')).toBe(0);
  // A mossling that appears later gets a new number.
  expect(save.systems.creatures.next.mossling).toBe(2);
});

test('loading replaces whatever was there', () => {
  const stage = island(true);
  stage.run(5);
  const empty = makeStage({ ground: 'island' });
  const save = JSON.parse(JSON.stringify(empty.kernel.save()));
  stage.kernel.load(save);
  expect(creatures(stage)).toHaveLength(0);
  expect(stage.kernel.game.actors.size).toBe(0);
});
