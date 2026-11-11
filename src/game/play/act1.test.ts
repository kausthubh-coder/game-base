// The main check of the first part: all five quests of docs/play/act1.md, from a new game to `act.ended`,
// played through the real rules with no skipTo, no give and no flag written by hand. Then the same
// play again with a save and a load into a fresh world and kernel after every step, the other ways
// through that a player may take, and the joins between systems that the play does not cross by itself.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CREATURES } from '../content/creatures.ts';
import { PEOPLE } from '../content/people.ts';
import { PETS } from '../content/pets.ts';
import { QUESTS } from '../content/quests.ts';
import { distance2d } from '../move.sim.ts';
import { RAIN_SECONDS } from '../story/index.sim.ts';
import { INSTALLS, loadPlay, newPlay, type Play } from './harness.sim.ts';
import { QUEST_ORDER, STEPS, must, openStep, talkTo, walkToTown } from './script.ts';

const MINUTES = 60_000;
/** `ambient.rain` above this is rain falling: the level the crops are watered from. */
const RAIN = 0.05;

/** `12:34` of game time since the new game. */
const clockText = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function report(p: Play, quest: string): string {
  const { clock } = p.game;
  return `[play] ${quest.padEnd(8)} done on day ${clock.day} at ${clock.timeOfDay.toFixed(2)} of the day, ${clockText(clock.seconds)} on the game clock (${clock.seconds.toFixed(0)} s), ${p.steps} kernel steps (${clockText(p.steps / 20)} played)`;
}

/** After a quest's last step: its done flag is set and the next one has started. */
function expectQuestDone(p: Play, quest: string): void {
  p.advance(0.6);
  const flags = p.game.flags;
  expect(flags.is(`quest.${quest}.done`), `quest.${quest}.done after its last step (open step: ${openStep(p)})`).toBe(true);
  expect(p.sys.quests.all().find((view) => view.id === quest)?.state).toBe('done');
  const next = QUEST_ORDER[QUEST_ORDER.indexOf(quest) + 1];
  if (next) {
    expect(flags.is(`quest.${next}.started`), `quest.${next}.started once ${quest} is done`).toBe(true);
    expect(flags.is(`quest.${next}.done`)).toBe(false);
    expect(p.sys.quests.tracked()?.id).toBe(next);
  }
}

function expectEnded(p: Play): void {
  expect(p.heard.filter((event) => event.name === 'act.ended').map((event) => event.data)).toEqual([{ act: 1 }]);
  expect(p.game.flags.is('act1.ended')).toBe(true);
  for (const quest of QUEST_ORDER) expect(p.game.flags.is(`quest.${quest}.done`), quest).toBe(true);
  expect(p.sys.quests.tracked()).toBeNull();
  // The game goes on after the end card: the player is free, and Tamsin's last line left a second lamp to float.
  expect(p.game.player.busy).toBe(false);
  expect(p.count('river_lamp')).toBe(1);
  p.advance(5);
}

const lastOf = (quest: string): number => STEPS.findLastIndex((step) => step.quest === quest);
const indexOf = (name: string): number => {
  const index = STEPS.findIndex((step) => step.name === name);
  if (index < 0) throw new Error(`no step is called "${name}"`);
  return index;
};

/** Runs the steps from `from` up to but not including `to`, naming the step that failed. */
function run(p: Play, from: number, to: number): void {
  for (let i = from; i < to; i++) {
    const step = STEPS[i];
    try {
      step.run(p);
    } catch (error) {
      throw new Error(`${step.quest}: ${step.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/** Counts, from now on, the seconds of rain falling in all and during the festival. */
function watchRain(p: Play): { all: number; festival: number } {
  const seconds = { all: 0, festival: 0 };
  p.onStep(() => {
    if (p.game.ambient.rain <= RAIN) return;
    seconds.all += 0.05;
    if (p.game.flags.is('festival.started') && !p.game.flags.is('festival.over')) seconds.festival += 0.05;
  });
  return seconds;
}

describe('the harness', () => {
  test('installs the systems in the order src/game/systems.ts gives', () => {
    const text = readFileSync(resolve(import.meta.dir, '../systems.ts'), 'utf8');
    const list = /SYSTEM_ORDER[^=]*=\s*\[([\s\S]*?)\];/.exec(text)?.[1] ?? '';
    const order = [...list.matchAll(/^\s*'([a-z]+)'/gm)].map((match) => match[1]);
    expect(order.length).toBeGreaterThan(10);
    expect(INSTALLS.map(([name]) => name)).toEqual(order);
  });

  test('a new game stands at the spawn point at dawn of day 1 with every system there', () => {
    const p = newPlay();
    p.advance(0.1);
    const spawn = p.sys.region.spawn();
    expect(p.game.player.pos).toEqual(spawn);
    expect(p.game.clock.day).toBe(1);
    expect(p.game.clock.timeOfDay).toBeCloseTo(0.27, 2);
    for (const [name] of INSTALLS) if (name !== 'story' && name !== 'sprinklers') expect(p.sys[name as keyof typeof p.sys], name).toBeDefined();
    expect(p.sys.quests.tracked()?.id).toBe('plot');
  });
});

describe('the first part', () => {
  test('plays from a new game to act.ended, quest by quest', () => {
    const p = newPlay();
    const rain = watchRain(p);
    const lines: string[] = [];
    STEPS.forEach((step, i) => {
      run(p, i, i + 1);
      if (i !== lastOf(step.quest)) return;
      expectQuestDone(p, step.quest);
      lines.push(report(p, step.quest));
    });
    expectEnded(p);
    console.log(lines.join('\n'));
    const hints = p.heard.filter((event) => event.name === 'hint').map((event) => (event.data as { id: string }).id);
    console.log(`[play] hints, in order: ${hints.join(', ')}`);
    console.log(`[play] toasts: ${[...new Set(p.heard.filter((event) => event.name === 'toast').map((event) => (event.data as { text: string }).text))].join(' | ')}`);
    const startled = p.heard.filter((event) => event.name === 'pet.startled').length;
    console.log(`[play] the leaftail was startled ${startled} times; wheat grown ${String(p.game.flags.get('harvested.wheat'))}; Almanac pages complete ${p.sys.almanac.pages().filter((page) => page.complete).length}; rain fell for ${rain.all.toFixed(0)} s`);
    // Walking softly near it never startles it.
    expect(startled).toBe(0);
    // Twelve seeds are enough: one harvest of them is 24 wheat.
    expect(p.game.flags.get('harvested.wheat')).toBe(24);
    // The player saw rain on the field, and the festival evening is clear.
    expect(rain.all).toBeGreaterThan(30);
    expect(rain.festival).toBe(0);
    expect(p.game.ambient.rain).toBe(0);

    // The festival: everyone was sent to a place that exists, and stands there, on ground, apart from the others.
    p.advance(60);
    const crowd = p.sys.people.all();
    for (const npc of crowd) {
      const want = npc.id === 'tamsin' || npc.id === 'brack' ? 'river.bank' : 'town.square';
      expect(npc.place, npc.id).toBe(want);
      expect(distance2d(npc.pos, p.sys.region.place(want).at), `${npc.id} at the festival`).toBeLessThan(13);
      expect(p.sys.nav.standable(npc.pos.x, npc.pos.y, npc.pos.z), `${npc.id} stands on ground at the festival`).toBe(true);
      for (const other of crowd) if (other !== npc) expect(distance2d(npc.pos, other.pos), `${npc.id} and ${other.id} at the festival`).toBeGreaterThanOrEqual(2);
    }
    // So "E" a step away from anyone names that one.
    for (const npc of crowd) {
      must(p, p.walkTo(npc.pos, { within: 1.5, seconds: 120 }), `could not walk up to ${npc.id} at the festival`);
      expect(p.prompt(), `the prompt beside ${npc.id} at the festival`).toBe(`Talk to ${npc.name}`);
    }

    // The next morning it is over: everyone is back at their own place, and the game goes on.
    p.until(() => p.game.flags.is('festival.over'), p.sys.time.dayLength);
    expect(p.game.flags.is('festival.over')).toBe(true);
    expect(p.game.clock.day).toBe(3);
    p.advance(90);
    for (const [id, place] of [['tamsin', 'lodge'], ['maren', 'granary'], ['odo', 'bakery'], ['gus', 'gus.field'], ['mira', 'carpenter'], ['wren', 'kennel'], ['brack', 'ferry']] as const) {
      const npc = p.sys.people.get(id)!;
      expect(npc.place, id).toBe(place);
      expect(distance2d(npc.pos, p.sys.region.place(place).at), `${id} the morning after`).toBeLessThan(4);
    }
    // Tamsin has a line for the morning after, and the second lamp still floats.
    talkTo(p, 'tamsin');
    expect(p.heard.findLast((event) => event.name === 'talk.started')?.data).toMatchObject({ npc: 'tamsin' });
    must(p, p.walkTo('river.bank', { within: 2, seconds: 240 }), 'could not walk to the river bank the morning after');
    expect(p.take('river_lamp')).toBe(true);
    p.use(Math.floor(p.game.player.pos.x), Math.floor(p.game.player.pos.y) - 1, Math.floor(p.game.player.pos.z) + 1);
    expect(p.game.flags.get('festival.lamps')).toBe(2);
  }, 10 * MINUTES);

  test('a save after every step loads into a fresh world and kernel, and the game finishes from there', () => {
    // Every quest has steps before its last one, so each is saved and loaded in its middle, more than once.
    for (const quest of QUEST_ORDER) expect(STEPS.filter((step) => step.quest === quest).length, quest).toBeGreaterThanOrEqual(3);

    let p = newPlay();
    let loads = 0;
    const lines: string[] = [];
    STEPS.forEach((step, i) => {
      try {
        step.run(p);
      } catch (error) {
        throw new Error(`${step.quest}: ${step.name} (after ${loads} loads): ${error instanceof Error ? error.message : String(error)}`);
      }
      if (i === lastOf(step.quest)) {
        expectQuestDone(p, step.quest);
        lines.push(report(p, step.quest));
      }
      if (i === STEPS.length - 1) return;

      const before = p;
      p = loadPlay(before.save());
      loads++;
      const after = `after loading the save made after "${step.name}"`;
      // What Continue must bring back: the clock, the player, the bag, the quests, the flags, the pet, what was built and what grows.
      expect(p.game.clock, after).toEqual(before.game.clock);
      expect(p.game.player.pos, after).toEqual(before.game.player.pos);
      expect(p.sys.inventory.slots, after).toEqual(before.sys.inventory.slots);
      expect(new Map(p.kernel.save().flags), after).toEqual(new Map(before.kernel.save().flags));
      // Before either world moves on: a fact is learned by watching for three seconds, and a watch that is under way is not saved.
      expect(p.sys.almanac.pages().filter((page) => page.complete).map((page) => page.id), after).toEqual(before.sys.almanac.pages().filter((page) => page.complete).map((page) => page.id));
      p.advance(0.1);
      before.advance(0.1);
      expect(openStep(p), after).toBe(openStep(before));
      expect(p.sys.quests.all().map((view) => [view.id, view.state]), after).toEqual(before.sys.quests.all().map((view) => [view.id, view.state]));
      expect(p.sys.pets.all().map((pet) => [pet.trust, pet.bonded]), after).toEqual(before.sys.pets.all().map((pet) => [pet.trust, pet.bonded]));
      expect(p.sys.placeables.all(), after).toEqual(before.sys.placeables.all());
      expect(p.sys.crops.all().map((crop) => [crop.x, crop.z, crop.state.stage]), after).toEqual(before.sys.crops.all().map((crop) => [crop.x, crop.z, crop.state.stage]));
      expect(p.sys.people.all().map((npc) => [npc.id, npc.place]), after).toEqual(before.sys.people.all().map((npc) => [npc.id, npc.place]));
      // The blocks the player set and broke are in the world again.
      const at = p.game.player.pos;
      for (let x = Math.floor(at.x) - 12; x <= Math.floor(at.x) + 12; x++) {
        for (let z = Math.floor(at.z) - 12; z <= Math.floor(at.z) + 12; z++) {
          for (let y = Math.floor(at.y) - 2; y <= Math.floor(at.y) + 8; y++) {
            if (p.world.getBlock(x, y, z) !== before.world.getBlock(x, y, z)) throw new Error(`the block at ${x}, ${y}, ${z} is ${p.world.getBlock(x, y, z)} ${after}, and was ${before.world.getBlock(x, y, z)}`);
          }
        }
      }
    });
    expect(loads).toBe(STEPS.length - 1);
    expectEnded(p);
    console.log(lines.join('\n'));
    console.log(`[play] saved and loaded ${loads} times, after every step but the last`);
  }, 10 * MINUTES);

  test('the other ways through: the leaftail shown to Wren, fed with the E key, and the wheat delivered without waiting for evening', () => {
    const p = newPlay();
    const rain = watchRain(p);
    run(p, 0, indexOf('feed the leaftail twice'));

    // E beside the leaftail, three times: "Offer a berry".
    const pet = p.sys.pets.all()[0];
    for (let fed = 0; fed < 3; fed++) {
      for (const bush of p.sys.region.berryBushes?.() ?? []) {
        if (p.count('berry') > 0) break;
        if (!bush.ripe || distance2d(bush, p.game.player.pos) > 40) continue;
        must(p, p.walkTo({ x: bush.x, y: bush.y, z: bush.z }, { soft: true, within: 1.2, seconds: 120 }), 'could not walk to a berry bush');
        p.interact();
      }
      const trust = pet.trust;
      // The leaftail keeps walking between its beds. If it has walked out of reach before the hero has stood
      // still for a second, the berry is not taken and the hero walks up and offers it again, as a player would.
      for (let tries = 0; tries < 4 && pet.trust === trust; tries++) {
        must(p, p.walkTo(pet.pos, { soft: true, within: 2.2, seconds: 120 }), 'could not walk softly up to the leaftail');
        expect(p.prompt()).toBe('Offer a berry');
        p.interact();
        p.until(() => pet.trust > trust, 8);
      }
      must(p, pet.trust > trust, `the leaftail did not take berry ${fed + 1} offered with E`);
      p.advance(3.2);
    }
    expect(pet.bonded).toBe(true);
    expect(p.heard.filter((event) => event.name === 'pet.startled').length).toBe(0);

    // Wren at the kennel, not Tamsin.
    walkToTown(p);
    const wren = talkTo(p, 'wren');
    expect(wren[0]).toBe('(to the leaftail) Hello, small one. You\'ve been eating. Berries?');
    expect(p.game.flags.is('leaftail.shown')).toBe(true);
    expectQuestDone(p, 'leaftail');

    run(p, indexOf('meet Queen Maren in the granary'), indexOf('bring 20 wheat to Maren'));

    // The second choice: "I have things to do first." Dusk comes by itself.
    walkToTown(p);
    const maren = talkTo(p, 'maren', 1);
    expect(maren.at(-1)).toBe('Then do them fast. Dusk does not wait. I have checked.');
    expect(p.game.flags.is('bread.delivered')).toBe(true);
    expectQuestDone(p, 'bread');
    expect(p.game.flags.is('festival.started')).toBe(false);
    // Before dusk Odo has no lamp yet and carries no mark.
    talkTo(p, 'odo');
    expect(p.count('river_lamp')).toBe(0);
    expect(p.game.actors.get('npc:odo')?.mark).toBe('');
    const delivered = p.game.clock.seconds;

    run(p, indexOf('come to the square at dusk'), STEPS.length);
    expectQuestDone(p, 'festival');
    expectEnded(p);
    console.log(`[play] by Wren and without waiting: the act ended on day ${p.game.clock.day} at ${p.game.clock.timeOfDay.toFixed(2)}, ${clockText(p.steps / 20)} played, ${(p.game.clock.seconds - delivered).toFixed(0)} s after the delivery; rain fell for ${rain.all.toFixed(0)} s, ${rain.festival.toFixed(0)} s of it in the festival`);
    // The shower may still be leaving when dusk comes by itself. It is gone within its front, a quarter of a minute.
    expect(rain.festival).toBeLessThan(20);
  }, 10 * MINUTES);
});

describe('the joins', () => {
  test('every place a person, a pet, a creature or a quest step names is a place of the region', () => {
    const p = newPlay();
    const names = new Set<string>(['river.bank', 'town.square', 'grant.stone', 'lodge']);
    for (const person of PEOPLE) {
      for (const stop of person.routine) names.add(stop.place);
      if (person.stay) names.add(person.stay.place);
      for (const place of person.wander?.places ?? []) names.add(place);
    }
    for (const pet of PETS) names.add(pet.home);
    for (const kind of CREATURES) if (kind.appears.around !== 'player') names.add(kind.appears.around.place);
    for (const quest of QUESTS) for (const step of quest.steps) if (step.place) names.add(step.place);
    const known = new Set(p.sys.region.places().map((place) => place.name));
    expect([...names].filter((name) => !known.has(name))).toEqual([]);

    // And each person stands at theirs, on ground, when the player comes to town.
    p.advance(0.5);
    p.teleport('town.square');
    p.advance(2);
    for (const npc of p.sys.people.all()) {
      const at = p.sys.region.place(npc.place).at;
      expect(distance2d(npc.pos, at), `${npc.id} at ${npc.place}`).toBeLessThan(7);
      if (distance2d(npc.pos, p.game.player.pos) < 40) expect(p.sys.nav.standable(npc.pos.x, npc.pos.y, npc.pos.z), `${npc.id} stands on ground`).toBe(true);
    }
  });

  test.each(QUEST_ORDER)('skipTo(%s) puts the game at the start of that quest, and it plays to the end from there', (quest) => {
    const p = newPlay();
    p.advance(0.5);
    p.sys.quests.skipTo(quest);
    p.advance(0.5);
    const at = QUEST_ORDER.indexOf(quest);
    expect(p.sys.quests.tracked()?.id).toBe(quest);
    expect(p.sys.quests.all().map((view) => view.state)).toEqual(QUEST_ORDER.map((_, i) => (i < at ? 'done' : i === at ? 'active' : 'hidden')));
    // A quest that was passed over leaves what finishing it would have: the tools, and the leaftail at the player's side.
    if (at >= 1) expect([p.game.flags.is('has.almanac'), p.count('axe')]).toEqual([true, 1]);
    expect(p.sys.inventory.slots.some((slot) => slot?.id === 'almanac')).toBe(false);
    const pet = p.sys.pets.all()[0];
    expect(pet.bonded).toBe(at >= 3);
    if (at >= 3) {
      expect(p.sys.pets.companion()?.id).toBe(pet.id);
      expect(distance2d(pet.pos, p.game.player.pos)).toBeLessThanOrEqual(3);
      expect(p.sys.almanac.page('leaftail')?.complete).toBe(true);
    }
    if (at >= 4) expect([p.count('hoe'), p.count('watering_can')]).toEqual([1, 1]);

    run(p, STEPS.findIndex((step) => step.quest === quest), STEPS.length);
    expectEnded(p);
  }, 10 * MINUTES);

  test('the shower after the first planting: 90 seconds of rain in the afternoon of that day, and it waters the field', () => {
    const p = newPlay();
    p.advance(0.5);
    p.sys.quests.skipTo('bread');
    const rain = watchRain(p);
    let early = 0, wetInRain = Infinity, first = -1, last = -1;
    p.onStep(() => {
      const { clock, ambient } = p.game;
      if (ambient.rain <= RAIN) return;
      if (first < 0) first = clock.timeOfDay;
      last = clock.timeOfDay;
      if (clock.timeOfDay < 0.5) early += 0.05;
      // Rain keeps open soil as wet as the can leaves it.
      if (ambient.rain > 0.3) for (const crop of p.sys.crops.all()) wetInRain = Math.min(wetInRain, crop.state.wet);
    });

    run(p, indexOf('meet Queen Maren in the granary'), indexOf('harvest and replant until there are 20 wheat'));
    const planted = p.game.clock;
    expect(planted.day).toBe(1);
    expect(planted.timeOfDay).toBeLessThan(0.5);
    expect(p.game.flags.is('story.rain.due')).toBe(true);

    // The morning stays dry. The shower is called for in the afternoon and ends by itself.
    must(p, p.until(() => p.game.flags.is('story.raining'), p.sys.time.dayLength), 'the shower was never called for');
    expect(p.game.clock.day).toBe(1);
    expect(p.game.clock.timeOfDay).toBeGreaterThanOrEqual(0.5);
    expect(p.game.clock.timeOfDay).toBeLessThan(0.52);
    must(p, p.until(() => p.game.flags.is('story.rain.done'), 300), 'the shower did not end in five minutes');
    p.advance(30);

    console.log(`[play] the shower: rain fell for ${rain.all.toFixed(1)} s, from ${first.toFixed(3)} to ${last.toFixed(3)} of day ${p.game.clock.day}`);
    expect(early).toBe(0);
    // 90 seconds of rain, and the quarter of a minute it takes to leave.
    expect(rain.all).toBeGreaterThanOrEqual(RAIN_SECONDS);
    expect(rain.all).toBeLessThan(RAIN_SECONDS + 20);
    expect(last).toBeLessThan(0.73);
    expect(p.game.ambient.rain).toBe(0);
    // The field was wet through the whole of it.
    expect(wetInRain).toBeGreaterThan(179);
    // Once.
    p.advance(120);
    expect(rain.all).toBeLessThan(RAIN_SECONDS + 20);
    expect(p.game.flags.is('story.rain.due')).toBe(false);
  }, 10 * MINUTES);
});
