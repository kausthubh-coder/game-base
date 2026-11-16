// The main check of act 1: the 21 quests from a new game to `act.ended`, through the real rules, each step done by
// the flag it asks for (STEPS in script.ts). Then the same play again with a save and a load into a fresh world
// and kernel after every step, every quest started by skipTo, the first night played the way a player plays it,
// and the joins between systems that the play does not cross by itself.
//
// The steps are stubs until each builder gives theirs a real condition (docs/act1-foundation.md). When one does,
// this test still plays it: `satisfy` sets what the new condition asks for, or the test says the step cannot be
// done by a flag, and the builder's own scenario plays it instead.
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
import { FIRST_NIGHT, QUEST_ORDER, STEPS, must, openStep, sowTheField } from './script.ts';

const MINUTES = 60_000;
/** `ambient.rain` above this is rain falling: the level the crops are watered from. */
const RAIN = 0.05;

/** After a quest's last step: its done flag is set and the next one has started. */
function expectQuestDone(p: Play, quest: string): void {
  p.advance(0.6);
  const flags = p.game.flags;
  expect(flags.is(`quest.${quest}.done`), `quest.${quest}.done after its last step (open step: ${openStep(p)})`).toBe(true);
  expect(p.sys.quests.all().find((view) => view.id === quest)?.state).toBe('done');
  const next = QUEST_ORDER[QUEST_ORDER.indexOf(quest as (typeof QUEST_ORDER)[number]) + 1];
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
  // The game goes on after the end card: the player is free.
  expect(p.game.player.busy).toBe(false);
  p.advance(5);
}

const lastOf = (quest: string): number => STEPS.findLastIndex((step) => step.quest === quest);

/** Runs the steps from `from` up to but not including `to`, naming the step that failed. */
function run(p: Play, from: number, to: number, steps = STEPS): void {
  for (let i = from; i < to; i++) {
    const step = steps[i];
    try {
      step.run(p);
    } catch (error) {
      throw new Error(`${step.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
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
    expect(p.sys.quests.tracked()?.id).toBe('grantday');
  }, MINUTES);

  test('a day is 20 minutes, and a night slept says how many seconds it skipped', () => {
    const p = newPlay();
    p.advance(0.1);
    expect(p.sys.time.dayLength).toBe(1200);
    const before = p.game.clock.seconds;
    p.sys.time.setTimeOfDay(0.8);
    const set = p.game.clock.seconds;
    // A bed under a roof is not needed to send the event: the time system's own sleep is called.
    p.sys.time.sleep();
    const slept = p.heard.findLast((event) => event.name === 'slept')?.data as { day: number; skipped: number } | undefined;
    expect(slept?.day).toBe(2);
    expect(slept?.skipped).toBeCloseTo(p.game.clock.seconds - set, 6);
    expect(p.game.clock.seconds).toBeGreaterThan(before);
  }, MINUTES);
});

describe('act 1', () => {
  test('plays from a new game to act.ended, quest by quest, a flag at a time', () => {
    const p = newPlay();
    STEPS.forEach((step, i) => {
      run(p, i, i + 1);
      if (i === lastOf(step.quest)) expectQuestDone(p, step.quest);
    });
    expectEnded(p);
    expect(STEPS.length).toBe(QUESTS.reduce((sum, quest) => sum + quest.steps.length, 0));
  }, MINUTES);

  test('a save in the middle of every third quest, and of the night, loads into a fresh world and kernel, and the game finishes from there', () => {
    // A fresh world takes half a second to make, so the game is saved and loaded in eight places, not after every step.
    const middles = new Set(QUESTS.filter((quest, i) => i % 3 === 0 || quest.id === 'night').map((quest) => STEPS.findIndex((step) => step.quest === quest.id) + Math.floor(quest.steps.length / 2)));
    let p = newPlay();
    let loads = 0;
    STEPS.forEach((step, i) => {
      run(p, i, i + 1);
      if (i === lastOf(step.quest)) expectQuestDone(p, step.quest);
      if (!middles.has(i)) return;
      const before = p;
      p = loadPlay(before.save());
      loads++;
      const after = `after loading the save made after "${step.name}"`;
      expect(p.game.clock, after).toEqual(before.game.clock);
      expect(new Map(p.kernel.save().flags), after).toEqual(new Map(before.kernel.save().flags));
      p.advance(0.1);
      before.advance(0.1);
      expect(openStep(p), after).toBe(openStep(before));
      expect(p.sys.quests.all().map((view) => [view.id, view.state]), after).toEqual(before.sys.quests.all().map((view) => [view.id, view.state]));
    });
    expect(loads).toBe(middles.size);
    expectEnded(p);
  }, 10 * MINUTES);

  test('the first night plays by the rules from the start of the night quest: hut, fox, door, Mark, Custodian, Heartstone, sleep, Tamsin', () => {
    const p = newPlay();
    p.advance(0.5);
    p.sys.quests.skipTo('night');
    p.advance(0.5);
    run(p, 0, FIRST_NIGHT.length, FIRST_NIGHT);
    expectQuestDone(p, 'night');
    // From there the act goes on by its flags.
    run(p, STEPS.findIndex((step) => step.quest === 'blessing'), STEPS.length);
    expectEnded(p);
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
  }, MINUTES);

  // One quest in each stretch of the act. src/game/quests tests skipTo for all 21 on a small stage.
  test.each(['ground', 'night', 'blessing', 'count', 'stag'] as const)('skipTo(%s) puts the game at the start of that quest, and it plays to the end from there', (quest) => {
    const p = newPlay();
    p.advance(0.5);
    p.sys.quests.skipTo(quest);
    p.advance(0.5);
    const at = QUEST_ORDER.indexOf(quest);
    expect(p.sys.quests.tracked()?.id).toBe(quest);
    expect(p.sys.quests.all().map((view) => view.state)).toEqual(QUEST_ORDER.map((_, i) => (i < at ? 'done' : i === at ? 'active' : 'hidden')));
    // A quest that was passed over leaves what finishing it would have: the guild's axe from grant day.
    if (at >= 1) expect(p.count('axe')).toBe(1);
    expect(p.sys.inventory.slots.some((slot) => slot?.id === 'almanac')).toBe(false);
    const past = (id: string): boolean => at > QUEST_ORDER.indexOf(id as (typeof QUEST_ORDER)[number]);
    // Past the first night the door stands open, the Mark is on the player's hand and the field book is theirs.
    expect([p.game.flags.is('door.open'), p.game.flags.is('mark'), p.game.flags.is('has.almanac')]).toEqual([past('night'), past('night'), past('night')]);
    // The Heartstone is the settlement's: 1 once the first night's stone has been seen.
    expect(p.sys.hall.heart().level).toBe(past('night') ? 1 : 0);
    if (past('count')) expect([p.count('hoe'), p.count('watering_can')]).toEqual([1, 1]);

    run(p, STEPS.findIndex((step) => step.quest === quest), STEPS.length);
    expectEnded(p);
  }, 10 * MINUTES);

  test('the shower after the first planting: 90 seconds of rain in the afternoon of that day, and it waters the field', () => {
    const p = newPlay();
    p.advance(0.5);
    // The queen's seed, the hoe and the can come with the quest of Hollowmere.
    p.sys.quests.skipTo('echo');
    let all = 0, early = 0, wetInRain = Infinity, first = -1, last = -1;
    p.onStep(() => {
      const { clock, ambient } = p.game;
      if (ambient.rain <= RAIN) return;
      all += 0.05;
      if (first < 0) first = clock.timeOfDay;
      last = clock.timeOfDay;
      if (clock.timeOfDay < 0.5) early += 0.05;
      // Rain keeps open soil as wet as the can leaves it.
      if (ambient.rain > 0.3) for (const crop of p.sys.crops.all()) wetInRain = Math.min(wetInRain, crop.state.wet);
    });

    sowTheField(p);
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

    expect(early).toBe(0);
    // 90 seconds of rain, and the quarter of a minute it takes to leave.
    expect(all).toBeGreaterThanOrEqual(RAIN_SECONDS);
    expect(all).toBeLessThan(RAIN_SECONDS + 20);
    expect(last).toBeLessThan(0.73);
    expect(p.game.ambient.rain).toBe(0);
    // The field was wet through the whole of it.
    expect(wetInRain).toBeGreaterThan(179);
    // Once.
    p.advance(120);
    expect(all).toBeLessThan(RAIN_SECONDS + 20);
    expect(p.game.flags.is('story.rain.due')).toBe(false);
  }, 10 * MINUTES);
});
