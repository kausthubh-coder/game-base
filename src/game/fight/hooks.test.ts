// The two boss hooks of `fight.sim.ts`: targets and loose shapes. A beast fight never makes either, so
// `fight.test.ts` holds those rules unchanged and these tests hold the hooks.
import { describe, expect, test } from 'bun:test';
import { HERO } from '../content/fight.ts';
import { arenaStage } from './arena.sim.ts';
import { createFight, type Fight, type FightEvent, type LooseShape } from './fight.sim.ts';

const DT = 1 / 60;
const stage = arenaStage(0, 0);

function run(fight: Fight, seconds: number, heard: FightEvent[] = [], each?: () => void): FightEvent[] {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    each?.();
    fight.step(DT);
    heard.push(...fight.events);
    fight.events.length = 0;
  }
  return heard;
}

/** The hero at a point, aiming at another. */
function aim(fight: Fight, x: number, z: number, ax: number, az: number): void {
  fight.placeHero(x, z);
  fight.input.aimX = ax;
  fight.input.aimZ = az;
}

const ring = (over: Partial<LooseShape> = {}): LooseShape => ({ kind: 'circle', x: 0.5, z: 0.5, facing: 0, reach: 2, width: 0, lead: 1, damage: 10, heavy: false, id: 'ring', ...over });

describe('targets', () => {
  test('a cut takes guard from an open target, and it breaks at 0 and stays broken', () => {
    const fight = createFight(stage, { way: 'hero' });
    const pin = fight.addTarget({ x: 0.5, z: -1, radius: 0.5, guard: 20, name: 'pin' });
    expect(fight.targets).toHaveLength(1);
    const heard: FightEvent[] = [];
    aim(fight, 0.5, 1, pin.x, pin.z);
    fight.press('attack');
    run(fight, 0.5, heard);
    expect(pin.guard).toBe(20 - HERO.cut.guard);
    expect(heard.filter((e) => e.type === 'targetHit' && e.text === 'pin')).toHaveLength(1);
    // A cut that lands on a target is not a whiff.
    expect(fight.record.whiffs).toBe(0);
    fight.press('attack');
    run(fight, 0.5, heard);
    expect(pin.broken).toBe(true);
    expect(pin.open).toBe(false);
    expect(heard.filter((e) => e.type === 'targetBroken')).toHaveLength(1);
    fight.press('attack');
    run(fight, 0.5, heard);
    expect(heard.filter((e) => e.type === 'targetHit')).toHaveLength(2);
    expect(fight.record.whiffs).toBe(1);
  });

  test('a target that is not open cannot be hit, until it is opened', () => {
    const fight = createFight(stage, { way: 'hero' });
    const lamp = fight.addTarget({ x: 0.5, z: -1, radius: 0.5, guard: 20, open: false });
    aim(fight, 0.5, 1, lamp.x, lamp.z);
    fight.press('attack');
    run(fight, 0.5);
    expect(lamp.guard).toBe(20);
    lamp.open = true;
    fight.press('attack');
    run(fight, 0.5);
    expect(lamp.guard).toBe(10);
  });

  test('a cut bends toward an open target near the pointer', () => {
    const fight = createFight(stage, { way: 'hero' });
    const pin = fight.addTarget({ x: 2, z: -1, radius: 0.5, guard: 20 });
    // The pointer is 30 degrees off the pin.
    aim(fight, 0.5, 1, 0.5 + Math.sin(-0.1) * 3, 1 - Math.cos(-0.1) * 3);
    fight.press('attack');
    run(fight, 0.5);
    expect(pin.guard).toBe(10);
  });

  test('a charged spin hits every target round the hero', () => {
    const fight = createFight(stage, { way: 'hero' });
    const a = fight.addTarget({ x: 2.5, z: 0.5, radius: 0.5, guard: 60 }), b = fight.addTarget({ x: -1.5, z: 0.5, radius: 0.5, guard: 60 });
    aim(fight, 0.5, 0.5, 0.5, -3);
    fight.press('attack');
    fight.input.attackHeld = true;
    const heard = run(fight, HERO.spin.hold + 0.1);
    fight.input.attackHeld = false;
    run(fight, 0.6, heard);
    // One spin, two targets: a hit of the spin's whole guard on each.
    const spun = heard.filter((e) => e.type === 'targetHit' && e.n === HERO.spin.guard);
    expect(spun).toHaveLength(2);
    expect(new Set(spun.map((e) => e.x))).toEqual(new Set([a.x, b.x]));
  });

  test('thrown light lands on a target, and not on one up on a boss', () => {
    const fight = createFight(stage, { way: 'pet' });
    const low = fight.addTarget({ x: 0.5, z: -4, radius: 0.5, guard: 20 });
    aim(fight, 0.5, 2, low.x, low.z);
    fight.press('attack');
    run(fight, 0.8);
    expect(low.guard).toBe(20 - HERO.bolt.guard);
    fight.removeTarget(low);
    const high = fight.addTarget({ x: 0.5, z: -4, radius: 0.5, guard: 20, high: true });
    fight.press('attack');
    run(fight, 0.8);
    expect(high.guard).toBe(20);
  });

  test("with the hero fighting, the pet goes for the target the hero cut and strikes it", () => {
    const fight = createFight(stage, { way: 'hero' });
    const pin = fight.addTarget({ x: 0.5, z: -1, radius: 0.5, guard: 200 });
    aim(fight, 0.5, 1, pin.x, pin.z);
    fight.press('attack');
    const heard = run(fight, 4, [], () => aim(fight, 0.5, 1, pin.x, pin.z));
    expect(fight.pet.mode).toBe('engage');
    expect(heard.filter((e) => e.type === 'petStrike').length).toBeGreaterThanOrEqual(1);
    expect(pin.guard).toBeLessThan(200 - HERO.cut.guard);
  });

  test('clear takes every target away', () => {
    const fight = createFight(stage, { way: 'hero' });
    fight.addTarget({ x: 0, z: 0, radius: 0.5, guard: 10 });
    fight.threaten(ring());
    fight.clear();
    expect(fight.targets).toHaveLength(0);
    expect(fight.shapes.filter((s) => s.live)).toHaveLength(0);
  });
});

describe('loose shapes', () => {
  test('a loose shape shows for its lead, then lands on a hero inside it, and is in the record by its name', () => {
    const fight = createFight(stage, { way: 'hero' });
    aim(fight, 1, 0.5, 0, 0);
    const shape = fight.threaten(ring({ lead: 1.5, damage: 12 }));
    expect(shape?.live).toBe(true);
    expect(shape?.owner).toBe(0);
    const heard = run(fight, 1.4);
    expect(heard.filter((e) => e.type === 'strike')).toHaveLength(0);
    expect(fight.hero.health).toBe(HERO.health);
    run(fight, 0.2, heard);
    expect(heard.filter((e) => e.type === 'strike' && e.text === 'ring')).toHaveLength(1);
    expect(fight.hero.health).toBe(HERO.health - 12);
    expect(fight.record.hitBy.ring).toBe(1);
    expect(fight.record.hitsTaken).toBe(1);
  });

  test('it sends a tell when it appears', () => {
    const fight = createFight(stage, { way: 'hero' });
    fight.threaten(ring({ id: 'sweep' }));
    expect(fight.events.filter((e) => e.type === 'tell' && e.text === 'sweep')).toHaveLength(1);
  });

  test('a hero outside it, or dodging through it, is not hit', () => {
    const fight = createFight(stage, { way: 'hero' });
    aim(fight, 5, 0.5, 0, 0);
    fight.threaten(ring());
    run(fight, 1.3);
    expect(fight.hero.health).toBe(HERO.health);
    aim(fight, 1, 0.5, 0, 0);
    fight.threaten(ring());
    run(fight, 0.9);
    fight.press('dodge');
    run(fight, 0.3);
    expect(fight.hero.health).toBe(HERO.health);
    expect(fight.record.dodged).toBe(1);
  });

  test('cancel takes it off the ground before it lands', () => {
    const fight = createFight(stage, { way: 'hero' });
    aim(fight, 1, 0.5, 0, 0);
    const shape = fight.threaten(ring());
    run(fight, 0.5);
    fight.cancel(shape!);
    const heard = run(fight, 1);
    expect(heard.filter((e) => e.type === 'strike')).toHaveLength(0);
    expect(fight.hero.health).toBe(HERO.health);
  });

  test('a line pushes straight out from its middle line, as far as its own push says', () => {
    const fight = createFight(stage, { way: 'hero' });
    // A line running north from (0, 4), 6 long and 4 wide: the hero stands a block east of its middle line.
    fight.placeHero(1, 2);
    fight.threaten({ kind: 'line', x: 0, z: 4, facing: 0, reach: 6, width: 4, lead: 0.5, damage: 5, heavy: true, id: 'shake', push: 3.5 });
    run(fight, 1.2);
    expect(fight.hero.x).toBeCloseTo(4.5, 0);
    expect(fight.hero.z).toBeCloseTo(2, 1);
  });

  test('in the pet way it lands on the pet too', () => {
    const fight = createFight(stage, { way: 'pet' });
    aim(fight, fight.pet.x, fight.pet.z + 1, 0, 0);
    fight.threaten(ring({ x: fight.pet.x, z: fight.pet.z, reach: 5 }));
    const heard = run(fight, 1.2);
    expect(heard.filter((e) => e.type === 'petHurt')).toHaveLength(1);
    expect(fight.pet.hearts).toBe(fight.pet.def.hearts - 1);
  });
});
