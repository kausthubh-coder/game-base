// The world's fights played by the rules with no page: armed by their quest steps, started by walking near their
// places, fought by the rule-made player, and what the story does after.
import { describe, expect, test } from 'bun:test';
import { HERO, HERO_STATS, beastOf } from '../content/fight.ts';
import { FLAG } from '../content/flags.ts';
import type { FightNumber, QuestId } from '../content/ids.ts';
import { QUESTS, satisfy } from '../content/quests.ts';
import { newPlay, type Play } from '../play/harness.sim.ts';
import { apply } from '../quests/rules.sim.ts';
import { armingSteps, fightPlace } from './index.sim.ts';

/** A new game with fight n's quest step open: the quests before it skipped, the steps before it done by their flags. */
function atFight(n: FightNumber, seed = 7): Play {
  const p = newPlay({ seed });
  p.advance(0.5);
  const a = armingSteps(n)!;
  p.sys.quests.skipTo(a.quest);
  p.advance(0.5);
  const quest = QUESTS.find((q) => q.id === a.quest)!;
  for (const step of quest.steps) {
    if (a.steps.includes(step.id)) break;
    for (const effect of satisfy(step.done)) apply(p.game, effect);
    p.advance(0.2);
  }
  // The story director plays the fight's scene as its step opens (scene 19 before fight 2): hear it out.
  p.advance(0.5);
  p.talkThrough();
  expect(p.game.flags.get(FLAG.questStep(a.quest as QuestId))).toBe(a.steps[0]);
  return p;
}

/** Puts the hero a few blocks from fight n's place, so it starts. */
function walkUp(p: Play, n: FightNumber, off = 6): void {
  const at = fightPlace(n);
  p.teleport({ x: at.x, z: at.z + off });
  p.advance(0.2);
}

/** The Heartstone at this level, as the settlement will give it. */
function heartstoneAt(p: Play, level: number): void {
  p.sys.settlement.heartstone = () => ({ level, parts: [] });
}

/** These play whole fights and nights in the sim: on a busy machine they take longer than bun's 5 seconds. */
const SLOW = 60_000;

const fights = (p: Play) => p.sys.fights;

/** On to the next dusk, with the hero standing at home. */
function toDusk(p: Play, home: { x: number; z: number }): void {
  const day = p.game.clock.day;
  p.sys.time.setTimeOfDay(0.99);
  p.until(() => p.game.clock.day > day, 1300);
  p.sys.time.setTimeOfDay(0.74);
  p.teleport({ x: home.x + 2, z: home.z + 2 });
}

describe('a fight in the world', () => {
  test('fight 2 is armed by its step, starts when the hero comes near at night, and the middle player calms the thistlehog', () => {
    const p = atFight(2);
    expect(fights(p).states!().find((s) => s.n === 2)!.armed).toBe(true);
    // Not in daylight: it roots up the seedlings at night.
    walkUp(p, 2);
    expect(fights(p).active()).toBeNull();
    p.sys.time.setTimeOfDay(0.85);
    p.advance(0.2);
    expect(fights(p).active()).toBe(2);
    const run = fights(p).running!()!;
    expect(run.fight.companion.def.kind).toBe('dax');
    expect(run.fight.beasts.map((b) => b.def.kind)).toEqual(['thistlehog']);
    // The calmed beast walks home and is taken out when it gets there, which can be soon: note that it set out.
    let walkedHome = false;
    const set = p.game.actors.set.bind(p.game.actors);
    p.game.actors.set = (id, actor) => { if (id.startsWith('fight:home:thistlehog')) walkedHome = true; return set(id, actor); };
    fights(p).autoplay!('middle');
    expect(p.until(() => p.game.flags.is(FLAG.fightWon(2)), 240)).toBe(true);
    expect(p.game.flags.is(FLAG.beastHome('thistlehog'))).toBe(true);
    expect(p.count('quill')).toBeGreaterThanOrEqual(4);
    expect(p.heard.some((h) => h.name === 'fight.ended')).toBe(true);
    // Scene 19 plays once the fight is won; heard out, the quest moves on, and the calmed thistlehog walks home.
    p.advance(1);
    p.talkThrough();
    p.advance(0.5);
    expect(p.game.flags.is(FLAG.questDone('kitchen'))).toBe(true);
    expect(walkedHome).toBe(true);
    p.advance(4);
    expect(fights(p).running!()).toBeNull();
  }, SLOW);

  test('fight 4: the boar does not fight, and the Mark held out to it is out of reach', () => {
    const p = atFight(4);
    walkUp(p, 4, 8);
    expect(fights(p).active()).toBe(4);
    const run = fights(p).running!()!, boar = run.fight.beasts[0]!;
    expect(boar.passive).toBe(true);
    fights(p).autoplay!('middle');
    expect(p.until(() => p.game.flags.is(FLAG.fightDenied(4)), 30)).toBe(true);
    const denied = p.heard.find((h) => h.name === 'fight.denied');
    expect(denied?.data).toEqual({ fight: 4, depth: 5, heartstone: 1 });
    // Scene 21 plays once the boar is out of reach.
    p.until(() => p.sys.talk.active, 10);
    p.talkThrough();
    p.advance(0.5);
    expect(p.game.flags.is(FLAG.questDone('greywood'))).toBe(true);
    expect(run.fight.record.hitsTaken).toBe(0);
  }, SLOW);

  test('fight 3: three foxes with Wren, and the fox comes to the hero as its pact', () => {
    const p = atFight(3);
    // Heartstone 2 and a first meal, as chapter 23 asks.
    heartstoneAt(p, 2);
    walkUp(p, 3, 8);
    const run = fights(p).running!()!;
    expect(run.fight.beasts).toHaveLength(3);
    expect(run.fight.beasts.every((b) => b.depth === 2)).toBe(true);
    expect(run.fight.companion.def.kind).toBe('wren');
    fights(p).autoplay!('middle');
    expect(p.until(() => p.game.flags.is(FLAG.fightWon(3)), 240)).toBe(true);
    expect(p.count('shed_pelt')).toBeGreaterThanOrEqual(3);
    expect(p.sys.pets.all().find((pet) => pet.kind === 'leaftail')?.bonded).toBe(true);
  }, SLOW);

  test('fight 11: at Heartstone 5 the boar calms, and Bramble goes home', () => {
    const p = atFight(11);
    heartstoneAt(p, 5);
    walkUp(p, 11, 8);
    expect(fights(p).active()).toBe(11);
    fights(p).autoplay!('perfect');
    expect(p.until(() => p.game.flags.is(FLAG.fightWon(11)), 300)).toBe(true);
    expect(p.game.flags.is(FLAG.beastHome('boar'))).toBe(true);
  }, SLOW);

  test('below the boar\'s depth it is emptied and still not calmed', () => {
    const p = atFight(11);
    heartstoneAt(p, 2);
    walkUp(p, 11, 8);
    fights(p).autoplay!('perfect');
    p.until(() => p.heard.some((h) => h.name === 'fight.denied'), 200);
    expect(p.heard.find((h) => h.name === 'fight.denied')?.data).toEqual({ fight: 11, depth: 5, heartstone: 2 });
    expect(p.game.flags.is(FLAG.fightWon(11))).toBe(false);
  }, SLOW);

  test('walking out of the circle leaves the fight, and it starts again once the hero has been away', () => {
    const p = atFight(5);
    heartstoneAt(p, 3);
    walkUp(p, 5, 8);
    expect(fights(p).active()).toBe(5);
    const at = fightPlace(5);
    p.teleport({ x: at.x, z: at.z + 40 });
    p.advance(2);
    expect(fights(p).active()).toBeNull();
    expect(p.heard.find((h) => h.name === 'fight.ended')?.data).toEqual({ fight: 5, result: 'left' });
    p.advance(4);
    walkUp(p, 5, 8);
    expect(fights(p).active()).toBe(5);
  }, SLOW);

  test('the lynx with the fox beside the hero, its kit and a quill strip', () => {
    const p = atFight(5);
    heartstoneAt(p, 3);
    // A quill strip made at the bench goes into the kit, and one set down comes out of the bag.
    p.sys.inventory.add('quill_strip', 1);
    walkUp(p, 5, 8);
    const run = fights(p).running!()!;
    expect(run.fight.companion.def.kind).toBe('fox');
    expect(run.fight.kitSlots()).toEqual(['quill_strip', null, null]);
    const h = run.fight.hero;
    expect(run.fight.placeRig('quill_strip', h.x, h.z - 2)).toBeNull();
    p.advance(0.1);
    expect(p.count('quill_strip')).toBe(0);
    fights(p).autoplay!('middle');
    expect(p.until(() => p.game.flags.is(FLAG.fightWon(5)), 240)).toBe(true);
    expect(p.count('quill_strip')).toBe(1);
  }, SLOW);

  for (const n of [7, 9, 10] as const) {
    test(`keeper fight ${n} waits for its room, and is shut down in its test room`, () => {
      const p = atFight(n);
      walkUp(p, n, 4);
      // The building on the map is not its room: it does not start there by itself.
      expect(fights(p).active()).toBeNull();
      expect(fights(p).begin!(n)).toBe(true);
      const run = fights(p).running!()!;
      expect(run.keeper).not.toBeNull();
      fights(p).autoplay!('middle');
      expect(p.until(() => p.game.flags.is(FLAG.fightWon(n)), 300)).toBe(true);
    }, SLOW);
  }

  test('the ruins can start a keeper in their own room', () => {
    const p = atFight(7);
    p.teleport({ x: 0, z: 0 });
    p.advance(0.2);
    expect(fights(p).active()).toBeNull();
    const room = { ...(require('../fight/keepers.sim.ts') as typeof import('../fight/keepers.sim.ts')).keeperRoom('sluice', 0, 0) };
    expect(fights(p).startKeeper!(9, room)).toBe(false);
    expect(fights(p).startKeeper!(7, room)).toBe(true);
    expect(fights(p).running!()!.keeper!.room).toBe(room);
  }, SLOW);

  test('the Stag: its phases are counted, and freeing it is fight 12 won', () => {
    const p = atFight(12);
    walkUp(p, 12, 4);
    expect(fights(p).active()).toBeNull();
    expect(fights(p).startStag!(p.game.player.pos.x, p.game.player.pos.z - 4)).toBe(true);
    const run = fights(p).running!()!;
    expect(run.hall).not.toBeNull();
    fights(p).autoplay!('perfect');
    expect(p.until(() => Number(p.game.flags.get(FLAG.fightPhase(12))) >= 1, 300)).toBe(true);
    expect(p.until(() => p.game.flags.is(FLAG.fightWon(12)), 600)).toBe(true);
    expect(p.game.flags.get(FLAG.fightPhase(12))).toBe(3);
    expect(fights(p).companions!()).toContain('stagling');
  }, SLOW);

  test('fight 1 is the Hall\'s: the fox calmed on the first night marks it won', () => {
    const p = newPlay({ seed: 3 });
    p.advance(0.5);
    p.game.flags.set('fox.calmed', true);
    expect(p.game.flags.is(FLAG.fightWon(1))).toBe(true);
  }, SLOW);

  test('a flag set some other way ends the running fight quietly', () => {
    const p = atFight(3);
    walkUp(p, 3, 8);
    expect(fights(p).active()).toBe(3);
    p.game.flags.set(FLAG.fightWon(3), true);
    p.advance(4);
    expect(fights(p).running!()).toBeNull();
    // With nobody playing it, the hero went where the player's body went.
    p.teleport({ x: 0, z: 0 });
    expect(Math.hypot(p.game.player.pos.x, p.game.player.pos.z)).toBeLessThan(2);
  }, SLOW);
});

describe("the hero's numbers", () => {
  test('armour, a meal today and a shrine picked for a heart add health; one for stamina adds stamina', () => {
    const p = newPlay({ seed: 3 });
    p.advance(0.5);
    expect(fights(p).hero()).toEqual({ health: HERO.health, maxHealth: HERO.health, stamina: HERO.stamina, maxStamina: HERO.stamina });
    p.sys.bench.gear().armor = 2;
    p.game.flags.set(FLAG.mealDay, p.game.clock.day);
    p.game.flags.set('shrine.shrine-oak', 'heart');
    p.game.flags.set('shrine.shrine-bend', 'stamina');
    const h = fights(p).hero();
    expect(h.maxHealth).toBe(HERO.health + (HERO_STATS.armor[1] as number) + 2 * HERO_STATS.heart);
    expect(h.maxStamina).toBe(HERO.stamina + HERO_STATS.staminaPiece);
    // Yesterday's meal does not count.
    p.game.flags.set(FLAG.mealDay, p.game.clock.day - 1);
    expect(fights(p).hero().maxHealth).toBe(HERO.health + (HERO_STATS.armor[1] as number) + HERO_STATS.heart);
  }, SLOW);

  test('a fight starts the hero at those numbers', () => {
    const p = atFight(5);
    heartstoneAt(p, 3);
    p.sys.bench.gear().armor = 3;
    walkUp(p, 5, 8);
    const f = fights(p).running!()!.fight;
    expect(f.maxHealth).toBe(HERO.health + (HERO_STATS.armor[2] as number));
    expect(fights(p).hero().health).toBe(f.hero.health);
  }, SLOW);
});

describe('night visitors', () => {
  test('about one night in three a beast no deeper than the Heartstone comes to the fence while the hero is home', () => {
    const p = atFight(5);
    p.game.flags.set(FLAG.questDone('count'), true);
    const plot = fightPlace(2);
    let came = 0;
    const kinds = new Set<string>();
    for (let night = 0; night < 9; night++) {
      toDusk(p, plot);
      p.until(() => fights(p).visitor!() !== null, 120);
      const v = fights(p).visitor!();
      if (v) { came++; kinds.add(v.kind); expect(beastOf(v.kind).depth).toBeLessThanOrEqual(1); }
    }
    expect(came).toBeGreaterThanOrEqual(1);
    expect(came).toBeLessThanOrEqual(7);
    expect(kinds.has('lynx')).toBe(false);
  }, SLOW);

  test('Dax on the watch turns it back', () => {
    const p = atFight(5);
    p.game.flags.set(FLAG.job('dax'), 'watch');
    const plot = fightPlace(2);
    for (let night = 0; night < 6; night++) {
      toDusk(p, plot);
      p.advance(60);
      expect(fights(p).visitor!()).toBeNull();
    }
  }, SLOW);

  test('walking up to it at the fence is a fight, and calming it leaves a shed pelt', () => {
    const p = atFight(5);
    const plot = fightPlace(2);
    let v = null;
    for (let night = 0; night < 12 && !v; night++) {
      toDusk(p, plot);
      p.until(() => fights(p).visitor!() !== null, 120);
      v = fights(p).visitor!();
    }
    expect(v).not.toBeNull();
    const pelts = p.count('shed_pelt');
    p.teleport({ x: v!.x, z: v!.z + 6 });
    p.advance(0.2);
    const run = fights(p).running!();
    expect(run?.n).toBe(0);
    fights(p).autoplay!('middle');
    expect(p.until(() => p.count('shed_pelt') > pelts, 200)).toBe(true);
  }, SLOW);
});

describe('the save', () => {
  test('the picked companion is kept, and a fight in progress is not', () => {
    const p = atFight(5);
    p.game.flags.set(FLAG.questDone('greywood'), true);
    expect(fights(p).pick!('wren')).toBe(true);
    expect(fights(p).pick!('stagling')).toBe(false);
    heartstoneAt(p, 3);
    walkUp(p, 5, 8);
    expect(fights(p).active()).toBe(5);
    const q = p.reload();
    expect(q.sys.fights.companion!()).toBe('wren');
    expect(q.sys.fights.running!()).toBeNull();
  }, SLOW);
});

test('an explicitly equipped quill strip is consumed when set down, just like an automatically filled slot', () => {
 const p=atFight(5);heartstoneAt(p,3);p.sys.inventory.add('quill_strip',1);
 expect(p.sys.bench.equip(0,'quill_strip')).toBe(true);walkUp(p,5,8);
 const run=fights(p).running!()!,h=run.fight.hero;
 expect(run.fight.placeRig('quill_strip',h.x,h.z-2)).toBeNull();p.advance(.1);
 expect(p.count('quill_strip')).toBe(0);expect(p.sys.bench.gear().kit[0]).toBeNull();
});
