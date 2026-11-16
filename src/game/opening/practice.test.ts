import { expect, test } from 'bun:test';
import { FLAG } from '../content/flags.ts';
import { PEOPLE, SPOTS } from '../content/saltgate.ts';
import type { WeaponKind } from '../content/gear.ts';
import { newPlay, type Play } from '../play/harness.sim.ts';
import { saltgateAt } from './land.sim.ts';

function practice(weapon: WeaponKind): Play {
  const p = newPlay();
  p.advance(0.1);
  for (const flag of [FLAG.opening, FLAG.scene(1), FLAG.scene(2), FLAG.scene(3), FLAG.step('grantday', 'breakfast')]) p.game.flags.set(flag, true);
  p.teleport(saltgateAt(SPOTS.rack.x + 1, SPOTS.rack.z));
  p.advance(0.1);
  expect(p.interact()).toBe('Take a weapon from the rack');
  p.talkThrough(['sword', 'bow', 'staff'].indexOf(weapon));
  p.advance(0.1);
  return p;
}

function aim(p: Play, distance = 1.5, away = false): void {
  const dax = p.game.actors.get(PEOPLE.dax.id)!;
  p.teleport({ x: dax.pos.x, z: dax.pos.z + distance });
  p.advance(0.1);
  const fight = p.sys.opening.practice()!.fight;
  fight.input.aimX = dax.pos.x;
  fight.input.aimZ = dax.pos.z + (away ? distance + 20 : 0);
}

function attack(p: Play): void {
  p.sys.opening.practice()!.fight.press('attack');
  p.advance(0.6);
}

for (const weapon of ['sword', 'bow', 'staff'] as const) {
  test(`${weapon} from the rack uses real aimed weapon moves and survives Continue`, () => {
    const p = practice(weapon);
    expect(p.sys.bench.gear().weapon).toBe(weapon);
    expect(p.sys.opening.practice?.()).toBeDefined();
    aim(p, 22);
    attack(p);
    expect(p.sys.opening.bout().guard).toBe(3);
    aim(p, 1.5, true);
    attack(p);
    expect(p.sys.opening.bout().guard).toBe(3);
    aim(p);
    const fight = p.sys.opening.practice()!.fight;
    fight.press('attack');
    expect(p.sys.opening.bout().guard).toBe(3);
    p.advance(0.6);
    expect(p.sys.opening.bout().guard).toBe(2);
    expect(fight.record.swings).toBeGreaterThan(0);
    const q = p.reload();
    q.advance(0.1);
    expect(q.sys.bench.gear().weapon).toBe(weapon);
    expect(q.sys.opening.bout()).toEqual({ on: true, guard: 2 });
    aim(q);
    attack(q);
    expect(q.sys.opening.bout().guard).toBe(1);
    attack(q);
    expect(q.sys.opening.bout()).toEqual({ on: false, guard: 0 });
    expect(q.game.flags.is(FLAG.scene(4))).toBe(false);
    expect(q.sys.talk.active).toBe(true);
    q.talkThrough();
    expect(q.game.flags.is(FLAG.scene(4))).toBe(true);
    expect(q.sys.inventory.slots.filter(Boolean)).toEqual([]);
    expect(q.game.flags.is(FLAG.fightWon(1))).toBe(false);
    expect(q.heard.filter(e => e.name === 'fight.ended')).toEqual([]);
    const completed = q.reload();
    completed.advance(0.2);
    expect(completed.sys.opening.practice()).toBeNull();
  });
}

test('Continue replays the closing lines after the practice target has broken', () => {
  const p = practice('bow');
  expect(p.sys.opening.practice?.()).toBeDefined();
  aim(p);
  for (let i = 0; i < 3; i++) attack(p);
  p.sys.talk.advance();
  expect(p.game.flags.is(FLAG.scene(4))).toBe(false);
  const q = p.reload();
  q.advance(0.1);
  expect(q.sys.opening.practice()).toBeNull();
  expect(q.sys.talk.current()?.text).toContain('Fine.');
  q.talkThrough();
  expect(q.game.flags.is(FLAG.scene(4))).toBe(true);
});

for (const weapon of ['sword', 'bow', 'staff'] as const) {
  test(`${weapon} hold and release uses its real stronger move`, () => {
    const p = practice(weapon);
    aim(p);
    const run = p.sys.opening.practice()!, fight = run.fight, before = fight.targets[0]!.guard;
    fight.input.attackHeld = true;
    p.advance(1);
    expect(fight.targets[0]!.guard).toBe(before);
    fight.input.attackHeld = false;
    p.advance(0.6);
    expect(fight.targets[0]!.guard).toBeLessThan(before - before / 3);
  });
}

test('the combat view releases practice before closing dialogue can hold the hero', () => {
  const p = practice('bow');
  aim(p);
  const run = p.sys.opening.practice()!;
  p.sys.opening.drivePractice(true);
  for (let hit = 0; hit < 3; hit++) {
    run.fight.press('attack');
    for (let i = 0; i < 36; i++) {
      run.step(1 / 60);
      run.fight.events.length = 0;
    }
  }
  expect(p.sys.opening.practice()).toBeNull();
  p.advance(0.1);
  expect(p.sys.talk.active).toBe(false);
  p.sys.opening.drivePractice(false);
  p.advance(0.1);
  expect(p.sys.talk.current()?.text).toContain('Fine.');
});

test('a legacy partial-practice save resumes without granting a completed scene', () => {
  const p = practice('staff'), save = p.kernel.save();
  save.systems.opening = { bout: 1 };
  p.kernel.load(save);
  p.advance(0.1);
  expect(p.sys.opening.bout()).toEqual({ on: true, guard: 1 });
  expect(p.game.flags.is(FLAG.scene(4))).toBe(false);
});

test('loading an earlier practice state rejects the old combat view callback', () => {
  const p = practice('sword');
  aim(p);
  const earlier = p.kernel.save(), old = p.sys.opening.practice()!;
  attack(p);
  expect(p.sys.opening.bout().guard).toBe(2);
  p.kernel.load(earlier);
  old.fight.press('attack');
  for (let i = 0; i < 36; i++) old.step(1 / 60);
  expect(p.sys.opening.bout()).toEqual({ on: true, guard: 3 });
  aim(p);
  attack(p);
  expect(p.sys.opening.bout().guard).toBe(2);
});

test('Continue during Dax\'s introduction still leads into weapon practice', () => {
  const p = newPlay();
  p.advance(0.1);
  for (const flag of [FLAG.opening, FLAG.scene(1), FLAG.scene(2), FLAG.scene(3), FLAG.step('grantday', 'breakfast')]) p.game.flags.set(flag, true);
  p.teleport(saltgateAt(SPOTS.rack.x + 1, SPOTS.rack.z));
  p.advance(0.1);
  p.interact();
  p.sys.talk.choose(1);
  expect(p.sys.talk.current()?.text).toContain('Hit me');
  const q = p.reload();
  q.advance(0.1);
  q.talkThrough();
  expect(q.sys.opening.practice()?.fight.hero.weapon).toBe('bow');
  expect(q.sys.opening.bout()).toEqual({ on: true, guard: 3 });
  expect(q.game.flags.is(FLAG.scene(4))).toBe(false);
});
