// The scenarios, the bot and the invariants inside `bun run check`. `bun tools/sim.ts` runs the same code
// for longer: every scenario with the first part, and bots of 100,000 steps.
import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { blockId } from '../../content/blocks.ts';
import { startBot } from '../play/bot.sim.ts';
import type { Play } from '../play/harness.sim.ts';
import { createInvariants, unknownQuestItems } from '../play/invariants.sim.ts';
import { begin, runScenario } from '../play/scenario.sim.ts';
import { stateHash } from '../play/state.sim.ts';
import { SCENARIOS } from './all.sim.ts';

describe('the scenarios', () => {
  test('every scenario file in this folder is in the list of all.sim.ts, under its own name', () => {
    const files = readdirSync(import.meta.dir).filter((file) => file.endsWith('.sim.ts') && file !== 'all.sim.ts').map((file) => file.replace('.sim.ts', ''));
    expect(SCENARIOS.map((scenario) => scenario.name).sort()).toEqual(files.sort());
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(6);
    // src/game/systems.ts installs any folder with an index.sim.ts as a system of the game.
    expect(readdirSync(import.meta.dir)).not.toContain('index.sim.ts');
  });

  test.each(SCENARIOS.map((scenario) => [scenario.name, scenario] as const))('%s', (_, scenario) => {
    const outcome = runScenario(scenario);
    expect(outcome.reason, scenario.about).toBe('');
    expect(outcome.inputs).toBe(scenario.inputs.length);
  });

  test('a scenario played twice ends in the same state', () => {
    for (const name of ['build-stroke', 'workbench-crafting', 'fell-a-tree']) {
      const scenario = SCENARIOS.find((one) => one.name === name)!;
      expect(runScenario(scenario).hash, name).toBe(runScenario(scenario).hash);
    }
  });

  test('a scenario that cannot do what it says fails with the input and the place', () => {
    const outcome = runScenario({ name: 'no-hoe', about: 'Takes a hoe the bag does not hold.', seed: 1, inputs: [{ do: 'take', item: 'hoe' }], expect: () => [] });
    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toStartWith('input 1 of 1, {"do":"take","item":"hoe"}: there is no hoe in the bag to take in hand. [day 1');
    const wrong = runScenario({ name: 'wrong-end', about: 'Expects wheat in an empty bag.', seed: 1, inputs: [], expect: (p) => [['the bag holds wheat', p.count('wheat') > 0]] });
    expect(wrong.reason).toBe('at the end this does not hold: the bag holds wheat');
  });
});

describe('the bot', () => {
  test('the same seed twice gives the same state hash, and another seed another', () => {
    for (const seed of [1, 3]) {
      const first = startBot(seed), second = startBot(seed);
      first.advance(3000);
      second.advance(3000);
      expect(first.failure).toBeNull();
      expect(stateHash(first.play), `seed ${seed}`).toBe(stateHash(second.play));
    }
    const one = startBot(1), six = startBot(6);
    one.advance(500);
    six.advance(500);
    expect(stateHash(one.play)).not.toBe(stateHash(six.play));
  });

  test('a replay reaches the same state however its steps are cut up', () => {
    const whole = startBot(2), parts = startBot(2);
    whole.advance(1500);
    for (const steps of [1, 699, 300, 500]) parts.advance(steps);
    expect(parts.step).toBe(1500);
    expect(stateHash(parts.play)).toBe(stateHash(whole.play));
    expect(parts.last).toEqual(whole.last);
  });

  test('bots from each of the five starts play 2,000 steps and nothing breaks', () => {
    for (const seed of [0, 1, 2, 3, 4]) {
      const bot = startBot(seed);
      bot.advance(2000);
      expect(bot.failure, `seed ${seed}: bun tools/sim.ts --replay ${seed} --until ${bot.failure?.step}`).toBeNull();
      expect(bot.step).toBe(2000);
    }
  });
});

describe('the invariants', () => {
  /** A game with a little of everything in it: a field, a workbench, the tools. */
  function game(): Play {
    const p = begin(5, { quest: 'bread', give: { hoe: 1, wheat_seeds: 2, workbench: 1, plank: 5 } });
    const c = p.sys.region.place('grant.center').at;
    const x = Math.floor(c.x), z = Math.floor(c.z);
    p.teleport({ x: c.x, z: c.z + 3 });
    p.take('hoe');
    p.use(x, c.y - 1, z);
    p.take('wheat_seeds');
    p.use(x, c.y - 1, z);
    p.take('workbench');
    p.use(x + 2, c.y - 1, z);
    p.advance(0.2);
    expect(p.sys.crops.all().length).toBe(1);
    expect(p.sys.placeables.all().length).toBe(1);
    return p;
  }

  /** Breaks one thing in a sound game and returns what the invariants say. */
  function broken(spoil: (p: Play) => void, options = {}): string | null {
    const p = game();
    const invariants = createInvariants(options);
    expect(invariants.check(p)).toBeNull();
    spoil(p);
    return invariants.check(p);
  }

  test('a sound game breaks none', () => {
    expect(broken(() => undefined)).toBeNull();
  });

  test('each rule catches the thing it is for', () => {
    const slot = (p: Play, id: string): number => p.sys.inventory.slots.findIndex((one) => one?.id === id);
    expect(broken((p) => { p.game.player.pos.x = NaN; })).toStartWith('the hero\'s position is not finite numbers');
    expect(broken((p) => { p.game.player.pos.y = -3; })).toBe('the hero is below the world\'s floor, at height -3');
    expect(broken((p) => { p.game.player.pos.y -= 1; }, { body: true })).toStartWith('the hero is inside the solid block');
    expect(broken((p) => { p.sys.inventory.slots[slot(p, 'plank')]!.count = -1; })).toBe(`slot ${slot(game(), 'plank')} of the bag holds -1 plank, and a slot holds 1 to 99`);
    expect(broken((p) => { p.sys.inventory.slots[slot(p, 'plank')]!.count = 100; })).toContain('holds 100 plank');
    expect(broken((p) => { (p.sys.inventory.slots as unknown[])[slot(p, 'hoe')] = null; })).toBe('the bag held 1 hoe and holds 0: a tool was taken away');
    expect(broken((p) => { p.game.clock.seconds -= 1; })).toStartWith('the clock went back');
    expect(broken((p) => { p.game.player.busy = true; })).toBe('the player is held and a conversation is not open');
    expect(broken((p) => { p.game.flags.set('quest.plot.done', false); })).toBe('the quest plot went back to active');
    expect(broken((p) => { const crop = p.sys.crops.all()[0]; p.world.setBlock(crop.x, crop.y + 1, crop.z, blockId('oak_plank')); })).toContain('over it');
    expect(broken((p) => { const crop = p.sys.crops.all()[0]; p.world.setBlock(crop.x, crop.y, crop.z, blockId('dirt')); })).toContain('which is not tilled soil');
    expect(broken((p) => { p.sys.crops.all()[0].state.stage = 9; })).toContain('is at stage 9 of 4');
    expect(broken((p) => { const bench = p.sys.placeables.all()[0]; p.world.setBlock(bench.x, bench.y - 1, bench.z, 0); })).toContain('has no solid ground under');
    expect(broken((p) => { p.sys.pets.all()[0].trust = 1; })).toContain('trust went down from 3 to 1');
    expect(broken((p) => { p.sys.people.all()[0].pos.z = Infinity; })).toContain('which are not finite numbers');
  });

  test('a quest that has lost what it needs is caught', () => {
    // The roof quest asks for a bed. A bed is made at a workbench, a workbench of planks, planks of logs, and logs come from trees.
    const p = begin(5, { quest: 'roof' });
    const invariants = createInvariants();
    expect(invariants.check(p)).toBeNull();
    // Gus hands out the wheat seeds. With him gone the bread quest could not finish.
    const later = begin(5, { quest: 'bread' });
    expect(createInvariants().check(later)).toBeNull();
    const people = later.sys.people;
    const get = people.get;
    people.get = (id) => (id === 'maren' ? undefined : get(id));
    expect(createInvariants().check(later)).toBe('the quest bread can no longer finish: its step queen asks for maren, and none of them is in the world');
    people.get = get;
  });

  test('every item a quest asks to be in the bag has a known source or a recipe', () => {
    expect(unknownQuestItems()).toEqual([]);
  });
});
