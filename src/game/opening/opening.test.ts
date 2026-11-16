// Grant day played through the rules, as a player does it: walk up, press E, click through, pick, sign, board.
import { describe, expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { FLAG } from '../content/flags.ts';
import { CONVERSATIONS } from '../content/dialogue.ts';
import { OPENING_TALKS, TALK } from '../content/opening.ts';
import { BOXES, PEOPLE, SALTGATE, SPOTS } from '../content/saltgate.ts';
import { newPlay, type Play } from '../play/harness.sim.ts';
import { GUARD, LANDING_TIME, MORNING_HOLD } from './index.sim.ts';
import { inSaltgate, saltgateAt, saltgateHeight } from './land.sim.ts';

const at = (x: number, z: number) => saltgateAt(x, z);

/** Stands the hero a step from a spot of the quarter, and steps the rules once so the prompt is fresh. */
function goTo(p: Play, x: number, z: number): void {
  const w = at(x, z);
  p.teleport({ x: w.x, z: w.z });
  p.advance(0.1);
}
const goToPerson = (p: Play, who: keyof typeof PEOPLE): void => {
  const actor = p.game.actors.get(PEOPLE[who].id);
  if (!actor?.visible) throw new Error(`${who} is not in Saltgate now`);
  p.teleport({ x: actor.pos.x - 1, z: actor.pos.z });
  p.advance(0.1);
};

/** The same aimed quick move the combat controls request, through its startup and travel. */
function hitLid(p: Play): void {
  const run = p.sys.opening.practice()!, target = run.fight.targets[0]!;
  run.fight.input.aimX = target.x;
  run.fight.input.aimZ = target.z;
  expect(p.sys.opening.swing()).toBe(true);
  p.advance(0.6);
}

/** A new game with the film over and the hero in the bunk room, as the opening's view leaves it. */
function wake(): Play {
  const p = newPlay();
  p.advance(0.1);
  p.sys.opening.filmDone();
  goTo(p, SPOTS.bunk.x, SPOTS.bunk.z);
  return p;
}

/** Walks up to a place a scene of the story names, and lets the director start it. Returns the lines it played. */
function sceneAt(p: Play, x: number, z: number): string[] {
  goTo(p, x, z);
  p.until(() => p.sys.talk.active, 3);
  return p.talkThrough();
}

/** Plays grant day up to the step before `stop`, the way a player does. */
function play(p: Play, stop?: string): void {
  const gd = () => p.game.flags.get(FLAG.questStep('grantday'));
  const done = () => stop !== undefined && gd() === stop;
  // 1. Hobb wakes you, and the mirror by the bunk.
  p.until(() => p.sys.talk.active, 3);
  p.talkThrough();
  goTo(p, SPOTS.mirror.x - 1, SPOTS.mirror.z);
  expect(p.interact()).toBe('Look in the mirror');
  expect(p.sys.opening.asking()).toBe('mirror');
  p.sys.opening.setLook('c');
  p.advance(0.2);
  if (done()) return;
  // Breakfast.
  goTo(p, SPOTS.porridge.x, SPOTS.porridge.z + 1);
  expect(p.interact()).toBe('Eat Hobb\'s porridge');
  p.talkThrough();
  p.advance(0.2);
  if (done()) return;
  // 2. The last lock, and 3. the map wall: each starts as the hero comes near.
  expect(sceneAt(p, SPOTS.locks.x - 1, SPOTS.locks.z).length).toBeGreaterThan(3);
  p.advance(0.2);
  if (done()) return;
  expect(sceneAt(p, SPOTS.maps.x - 1, SPOTS.maps.z + 1.5).length).toBeGreaterThan(2);
  p.advance(0.2);
  if (done()) return;
  // 4. The rack: the bow. Dax is waiting with his lid.
  goTo(p, SPOTS.rack.x + 1, SPOTS.rack.z);
  expect(p.interact()).toBe('Take a weapon from the rack');
  // The choice, then Dax at once: "Go on. Hit me."
  expect(p.talkThrough(1).join(' ')).toContain('Hit me');
  expect(p.sys.opening.bout().on).toBe(true);
  p.advance(0.1);
  if (done()) return;
  goToPerson(p, 'dax');
  for (let i = 0; i < GUARD; i++) {
    hitLid(p);
  }
  p.advance(0.1);
  p.talkThrough();
  p.advance(0.2);
  if (done()) return;
  // 5. The grant, and the deed signed as it ends.
  sceneAt(p, SPOTS.deed.x - 1, SPOTS.deed.z);
  expect(p.sys.opening.asking()).toBe('deed');
  expect(p.sys.opening.sign('  Ash   Merrow ')).toBe(true);
  p.advance(0.2);
  if (done()) return;
  // 6. The quay.
  sceneAt(p, SPOTS.berth.x, SPOTS.berth.z - 3);
  p.advance(0.2);
}

describe('Saltgate', () => {
  test('lies far from Greenhollow, and its land is the street north of the quay and the harbour south of it', () => {
    expect(inSaltgate(0, -240)).toBe(false);
    expect(saltgateHeight(SALTGATE.x + 30, SALTGATE.z + 40, 31)).toBe(SALTGATE.ground);
    expect(saltgateHeight(SALTGATE.x + 30, SALTGATE.z + 90, 31)).toBe(SALTGATE.sea);
    // Far off, the land is its own.
    expect(saltgateHeight(SALTGATE.x - 400, SALTGATE.z, 31)).toBe(31);
  });

  test('the terrain lays the guild hall: its floor, its walls and the gate onto Guild Street', () => {
    const p = wake();
    const block = (x: number, y: number, z: number) => p.world.getBlock(SALTGATE.x + x, y, SALTGATE.z + z);
    const g = SALTGATE.ground;
    expect(block(28, g - 1, 8)).toBe(blockId('oak_plank'));
    expect(block(28, g + 1, 4)).toBe(blockId('plaster'));
    // The gate is open, and the street beyond it is cobbled.
    expect(block(28, g, 29)).toBe(0);
    expect(block(28, g - 1, 34)).toBe(blockId('cobble'));
    // The harbour is water at the quay's foot.
    goTo(p, 30, 60);
    expect(block(30, g - 5, 70)).toBe(blockId('water'));
    expect(BOXES.length).toBeGreaterThan(20);
    // The land is made chunk by chunk here, which takes a while on a busy machine.
  }, 20_000);

  test('nothing in Saltgate can be dug or built on', () => {
    const p = wake();
    const w = at(28, 24);
    expect(p.sys.region.isProtected(w.x, SALTGATE.ground - 1, w.z)).toBe(true);
    expect(p.sys.region.isProtected(0, 20, -240)).toBe(false);
  });
});

describe('grant day', () => {
  test('every conversation the opening starts, and every scene of grant day, is one the talk system knows', () => {
    const ids = new Set(CONVERSATIONS.map((c) => c.id));
    for (const id of [...Object.values(TALK), 'scene.1', 'scene.2', 'scene.3', 'scene.5', 'scene.6', 'scene.7']) expect(ids.has(id), id).toBe(true);
    // A line fits the box: two lines of about 60 letters.
    for (const c of OPENING_TALKS) for (const line of c.lines) expect((typeof line === 'string' ? line : line.text).length, c.id).toBeLessThanOrEqual(120);
  });

  test('before the film ends nobody speaks, and the stage is the film', () => {
    const p = newPlay();
    p.advance(3);
    expect(p.sys.opening.stage()).toBe('film');
    expect(p.sys.talk.active).toBe(false);
    expect(p.sys.quests.tracked()?.steps.find((s) => !s.done)?.id).toBe('film');
  });

  test('played from waking to the ferry, every step of quest grantday is done by playing', () => {
    const p = wake();
    play(p);
    const f = p.game.flags;
    for (const n of [1, 2, 3, 4, 5, 6] as const) expect(f.is(FLAG.scene(n)), `scene ${n}`).toBe(true);
    expect(f.get(FLAG.heroLook)).toBe('c');
    expect(f.get(FLAG.heroName)).toBe('Ash Merrow');
    expect(f.get(FLAG.choice('weapon'))).toBe('bow');
    expect(f.get(FLAG.mealDay)).toBe(p.game.clock.day);
    expect(p.sys.opening.hero()).toEqual({ name: 'Ash Merrow', look: 'c' });
    expect(f.get(FLAG.questStep('grantday'))).toBe('river');
    expect(p.sys.opening.stage()).toBe('ferry');
    // The river is behind: the landing, scene 7, and quest ground begins.
    p.teleport('landing');
    p.sys.opening.ferryDone();
    p.until(() => p.sys.talk.active, 3);
    p.talkThrough();
    p.advance(0.2);
    expect(f.is(FLAG.questDone('grantday'))).toBe(true);
    expect(f.is(FLAG.scene(7))).toBe(true);
    expect(p.sys.opening.stage()).toBe('landed');
    expect(p.sys.quests.tracked()?.id).toBe('ground');
    // The guild's people stay in Saltgate.
    expect(p.game.actors.get(PEOPLE.hobb.id)?.visible).toBe(false);
  });

  test('walking up to someone plays their walk-up line, and gives no scene', () => {
    const p = wake();
    play(p, 'breakfast');
    goToPerson(p, 'mina');
    expect(p.interact()).toBe('Talk to Mina');
    expect(p.sys.talk.active).toBe(true);
    p.talkThrough();
    expect(p.game.flags.is(FLAG.scene(3))).toBe(false);
  });

  test('repeated presses cannot bypass weapon startup, and a shot outside range reaches nothing', () => {
    const p = wake();
    play(p, 'spar');
    goToPerson(p, 'dax');
    expect(p.sys.opening.bout()).toEqual({ on: true, guard: GUARD });
    const fight = p.sys.opening.practice()!.fight, target = fight.targets[0]!;
    fight.input.aimX = target.x;
    fight.input.aimZ = target.z;
    expect(p.sys.opening.swing()).toBe(true);
    expect(p.sys.opening.swing()).toBe(true);
    expect(p.sys.opening.bout().guard).toBe(GUARD);
    p.advance(0.6);
    expect(p.sys.opening.bout().guard).toBe(GUARD - 1);
    p.teleport({ x: target.x, z: target.z + 22 });
    p.advance(0.1);
    expect(p.sys.opening.swing()).toBe(true);
    p.advance(1);
    expect(p.sys.opening.bout().guard).toBe(GUARD - 1);
    expect(p.game.flags.is(FLAG.scene(4))).toBe(false);
  });

  test('a blank name is refused, and the deed stays open', () => {
    const p = wake();
    play(p, 'deed');
    sceneAt(p, SPOTS.deed.x - 1, SPOTS.deed.z);
    expect(p.sys.opening.sign('   ')).toBe(false);
    expect(p.sys.opening.asking()).toBe('deed');
    expect(p.sys.opening.sign('A name far longer than any deed has room for')).toBe(true);
    expect(p.sys.opening.hero().name.length).toBe(20);
  });

  test('a save in the middle of grant day loads at the same step, the bout included', () => {
    const p = wake();
    play(p, 'spar');
    goToPerson(p, 'dax');
    hitLid(p);
    const q = p.reload();
    q.advance(0.1);
    expect(q.game.flags.get(FLAG.questStep('grantday'))).toBe('spar');
    expect(q.sys.opening.bout()).toEqual({ on: true, guard: GUARD - 1 });
    expect(q.sys.opening.stage()).toBe('saltgate');
  });

  test('the clock holds Saltgate in the morning, and the landing is later the same day', () => {
    const p = wake();
    p.until(() => p.sys.talk.active, 3);
    p.talkThrough();
    p.advance(400);
    expect(p.game.clock.timeOfDay).toBeLessThanOrEqual(MORNING_HOLD + 0.001);
    play(p);
    const before = p.game.clock.seconds;
    p.teleport('landing');
    p.sys.opening.ferryDone();
    expect(p.game.clock.timeOfDay).toBeCloseTo(LANDING_TIME, 3);
    expect(p.game.clock.seconds).toBeGreaterThan(before);
  });
});
