import { describe, expect, test } from 'bun:test';
import { HERO, STAG } from '../content/fight.ts';
import { createFight, type Fight, type FightEvent, type FightRecord } from './fight.sim.ts';
import { HALL, hallStage, onBody, rampHeight } from './hall-layout.sim.ts';
import { createHall, createHallBot, rampWay, type Hall, type HallEvent } from './hall.sim.ts';

const DT = 1 / 60;

interface Room {
  fight: Fight;
  hall: Hall;
  heard: FightEvent[];
  told: HallEvent[];
  ended: FightRecord[];
  /** Steps the fight and the hall for this many seconds. `each` runs before every step. */
  run(seconds: number, each?: () => void): void;
  until(done: () => boolean, limit?: number, each?: () => void): boolean;
}

function room(): Room {
  const stage = hallStage(0, 0);
  const fight = createFight(stage, { way: 'hero' });
  const ended: FightRecord[] = [], heard: FightEvent[] = [], told: HallEvent[] = [];
  const hall = createHall(fight, stage, { onEnd: (r) => ended.push(r) });
  const step = (each?: () => void): void => {
    each?.();
    fight.step(DT);
    hall.step(DT);
    heard.push(...fight.events);
    told.push(...hall.events);
    fight.events.length = 0;
    hall.events.length = 0;
  };
  return {
    fight, hall, heard, told, ended,
    run(seconds, each) { for (let t = 0; t < seconds - 1e-9; t += DT) step(each); },
    until(done, limit = 60, each) {
      for (let t = 0; t < limit; t += DT) { if (done()) return true; step(each); }
      return done();
    },
  };
}

/** Holds the hero still at a point, healed, so nothing the Stag does moves them. */
const hold = (r: Room, x: number, z: number) => () => { r.fight.placeHero(x, z); r.fight.hero.health = HERO.health; };

/** Breaks every pin at once, as if the hero had cut them down. */
function breakPins(r: Room): void {
  for (const pin of r.hall.pins) { pin.guard = 0.0001; }
  // A cut of the smallest guard breaks each.
  for (const pin of r.hall.pins) { r.fight.placeHero(pin.x, pin.z + 1.5); r.fight.input.aimX = pin.x; r.fight.input.aimZ = pin.z; r.fight.press('attack'); r.run(0.45); }
}

function lightLamps(r: Room): void {
  for (const lamp of r.hall.lamps) {
    lamp.guard = 0.0001;
    r.fight.placeHero(lamp.x, lamp.z + 1.5);
    r.fight.input.aimX = lamp.x;
    r.fight.input.aimZ = lamp.z;
    r.fight.press('attack');
    r.run(0.45);
  }
}

describe('the hall', () => {
  test('is a round floor with the Stag lying across its north end, and the body is solid', () => {
    const stage = hallStage(0, 0);
    expect(stage.inside(0.5, 0.5 + HALL.radius - 0.1)).toBe(true);
    expect(stage.inside(0.5, 0.5 + HALL.radius + 0.6)).toBe(false);
    expect(stage.solid(0.5, -8)).toBe(true);
    expect(onBody(0.5, -8)).toBe(true);
    expect(stage.solid(0.5, 0)).toBe(false);
    expect(stage.solid(0.5, 14)).toBe(true);
    expect(stage.den.z).toBeLessThan(stage.start.z);
  });

  test('the vines rise from one block at their foot to six beside the shoulder, two cells wide', () => {
    expect(rampHeight(3.5, 6.5)).toBe(1);
    expect(rampHeight(4.5, -4.5)).toBe(6);
    expect(rampHeight(5.5, 0.5)).toBe(0);
    expect(HALL.ramp).toHaveLength(24);
    // Its inner side stands against the Stag's flank.
    expect(onBody(2.5, -6)).toBe(true);
    expect(onBody(3.5, -6)).toBe(false);
  });

  test('the ramp is nothing until it stands, and then no pet follows the hero up it', () => {
    const stage = hallStage(0, 0);
    expect(stage.rampAt(3.5, 0.5)).toBe(0);
    expect(stage.water(3.5, 0.5)).toBe(false);
    stage.ramp = true;
    expect(stage.rampAt(3.5, 0.5)).toBe(4);
    expect(stage.water(3.5, 0.5)).toBe(true);
  });
});

describe('the chains', () => {
  test('the Stag sleeps until the hero steps in, then sweeps its antlers across the floor where the hero stands', () => {
    const r = room();
    r.run(2);
    expect(r.hall.stag.doing).toBe('asleep');
    expect(r.hall.clock).toBe(0);
    r.until(() => r.hall.stag.attack === 'sweep', 4, hold(r, 0.5, 8));
    const s = r.hall.stag.shape!;
    expect(r.told.some((e) => e.type === 'woke')).toBe(true);
    expect(s.kind).toBe('line');
    expect(s.lead).toBe(STAG.sweep.lead);
    expect(s.z).toBeCloseTo(8);
    // From the edge of the floor, across all of it.
    expect(s.reach).toBeGreaterThan(HALL.radius * 2);
    r.run(STAG.sweep.lead + 0.1, hold(r, 0.5, 8));
    expect(r.fight.record.hitBy.sweep).toBe(1);
  });

  test('it sweeps from one side and then the other', () => {
    const r = room();
    const from: number[] = [];
    r.run(14, () => { hold(r, -3, 5)(); if (r.hall.stag.doing === 'windup' && r.hall.stag.t < DT * 0.5) from.push(r.hall.stag.from); });
    expect(from.length).toBeGreaterThanOrEqual(3);
    expect(from[0]).not.toBe(from[1]);
    expect(from[1]).not.toBe(from[2]);
  });

  test('a hero close to its legs gets a stamp of the nearest leg', () => {
    const r = room();
    r.until(() => r.hall.stag.attack !== null, 5, hold(r, 5, -5));
    expect(r.hall.stag.attack).toBe('stamp');
    const s = r.hall.stag.shape!;
    expect(s.kind).toBe('circle');
    expect(s.x).toBeCloseTo(2.5);
    expect(s.reach).toBe(STAG.stamp.radius);
  });

  test('a broken pin drops its chain and the Stag staggers, dropping the attack it wound up', () => {
    const r = room();
    const pin = r.hall.pins[0]!;
    r.until(() => r.hall.stag.doing === 'windup', 5, hold(r, pin.x, pin.z + 1.5));
    const shape = r.hall.stag.shape!;
    pin.guard = HERO.cut.guard;
    r.fight.input.aimX = pin.x;
    r.fight.input.aimZ = pin.z;
    r.fight.press('attack');
    r.run(0.3, hold(r, pin.x, pin.z + 1.5));
    expect(pin.broken).toBe(true);
    expect(r.told.filter((e) => e.type === 'pin' && e.n === 0)).toHaveLength(1);
    expect(r.hall.stag.doing).toBe('stagger');
    expect(shape.live).toBe(false);
    expect(r.hall.phase).toBe(0);
  });

  test('the fourth pin ends the chains: the lamps open and the overgrowth begins', () => {
    const r = room();
    r.until(() => r.hall.stag.doing !== 'asleep', 5, hold(r, 0.5, 8));
    expect(r.hall.lamps.every((l) => !l.open)).toBe(true);
    breakPins(r);
    expect(r.hall.phase).toBe(1);
    expect(r.told.filter((e) => e.type === 'phase' && e.n === 1)).toHaveLength(1);
    expect(r.hall.lamps.every((l) => l.open)).toBe(true);
    expect(r.hall.phaseSeconds[0]).toBeGreaterThan(0);
  });
});

describe('the overgrowth', () => {
  function overgrown(): Room {
    const r = room();
    r.until(() => r.hall.stag.doing !== 'asleep', 5, hold(r, 0.5, 8));
    breakPins(r);
    return r;
  }

  test('a pod comes up in the dark near the hero, grows with a ring on the ground, and bursts', () => {
    const r = overgrown();
    r.until(() => r.hall.pods.length > 0, 8, hold(r, -3, 6));
    const pod = r.hall.pods[0]!;
    const d = Math.hypot(pod.target.x + 3, pod.target.z - 6);
    expect(d).toBeGreaterThanOrEqual(STAG.pod.near - 0.01);
    expect(d).toBeLessThanOrEqual(STAG.pod.far + 0.01);
    expect(r.hall.lit(pod.target.x, pod.target.z)).toBe(false);
    expect(pod.shape?.kind).toBe('circle');
    expect(pod.shape?.lead).toBe(STAG.pod.grow);
    r.run(STAG.pod.grow + 0.1, hold(r, -3, 6));
    expect(r.told.some((e) => e.type === 'burst')).toBe(true);
    expect(r.hall.pods.includes(pod)).toBe(false);
  });

  test('a cut takes a pod before it bursts', () => {
    const r = overgrown();
    r.until(() => r.hall.pods.length > 0, 8, hold(r, -3, 6));
    const pod = r.hall.pods[0]!;
    const dx = pod.target.x + 3, dz = pod.target.z - 6, d = Math.hypot(dx, dz);
    // Stand at the edge of its ring and cut.
    const at = { x: pod.target.x - (dx / d) * 2.1, z: pod.target.z - (dz / d) * 2.1 };
    r.fight.input.aimX = pod.target.x;
    r.fight.input.aimZ = pod.target.z;
    r.fight.press('attack');
    r.run(0.3, hold(r, at.x, at.z));
    expect(r.told.some((e) => e.type === 'cut')).toBe(true);
    expect(pod.shape?.live).toBe(false);
    expect(r.fight.record.hitBy.pod ?? 0).toBe(0);
  });

  test('a lamp that is lit withers the pods in its light, and no pod comes up in it', () => {
    const r = overgrown();
    const lamp = r.hall.lamps[3]!;
    r.until(() => r.hall.pods.length > 0, 8, hold(r, lamp.x, lamp.z + 1));
    const near = r.hall.pods.filter((p) => Math.hypot(p.target.x - lamp.x, p.target.z - lamp.z) <= STAG.lamp.light);
    lamp.guard = 0.0001;
    r.fight.input.aimX = lamp.x;
    r.fight.input.aimZ = lamp.z;
    r.fight.press('attack');
    r.run(0.3, hold(r, lamp.x, lamp.z + 1));
    expect(lamp.broken).toBe(true);
    expect(r.hall.lit(lamp.x, lamp.z + 2)).toBe(true);
    expect(r.told.filter((e) => e.type === 'wither')).toHaveLength(near.length);
    r.run(10, hold(r, lamp.x, lamp.z + 1));
    for (const p of r.hall.pods) expect(r.hall.lit(p.target.x, p.target.z)).toBe(false);
  });

  test('it ends when every lamp is lit and no pod is left, and the vines make a ramp', () => {
    const r = overgrown();
    r.run(STAG.rise + 3, hold(r, -3, 6));
    lightLamps(r);
    r.until(() => r.hall.phase === 2, 6, () => {
      hold(r, -3, 6)();
      for (const p of r.hall.pods) p.target.guard = 0.0001;
      const p = r.hall.pods[0];
      if (p) { r.fight.placeHero(p.target.x, p.target.z + 1.5); r.fight.input.aimX = p.target.x; r.fight.input.aimZ = p.target.z; r.fight.press('attack'); }
    });
    expect(r.hall.phase).toBe(2);
    expect(r.hall.pods).toHaveLength(0);
    expect(r.hall.stage.ramp).toBe(true);
  });
});

describe('the collar', () => {
  function climbing(): Room {
    const r = room();
    r.until(() => r.hall.stag.doing !== 'asleep', 5, hold(r, 0.5, 8));
    breakPins(r);
    r.run(STAG.rise + 0.5, hold(r, -3, 6));
    lightLamps(r);
    r.until(() => r.hall.phase === 2, 10, () => {
      hold(r, -3, 6)();
      for (const p of r.hall.pods) p.target.guard = 0.0001;
      const p = r.hall.pods[0];
      if (p) { r.fight.placeHero(p.target.x, p.target.z + 1.5); r.fight.input.aimX = p.target.x; r.fight.input.aimZ = p.target.z; r.fight.press('attack'); }
    });
    return r;
  }

  test('the Stag shakes a hero on the vines, and a hit throws them off to the floor', () => {
    const r = climbing();
    const { top } = rampWay(r.hall.stage);
    r.run(STAG.rise, hold(r, top.x, top.z + 3));
    r.until(() => r.hall.stag.attack === 'shake', 6, hold(r, top.x, top.z + 3));
    expect(r.hall.stag.shape?.kind).toBe('line');
    // The hero stands still in it, and lets it land.
    r.fight.placeHero(top.x, top.z + 3);
    r.run(STAG.shake.lead + 0.6);
    expect(r.fight.record.hitBy.shake).toBe(1);
    expect(r.told.some((e) => e.type === 'fall')).toBe(true);
    expect(r.hall.onRamp()).toBe(false);
    expect(r.fight.hero.x).toBeGreaterThan(5);
  });

  test('the collar opens only to a hero high on the vines, and only the hero can break it', () => {
    const r = climbing();
    const { top, foot } = rampWay(r.hall.stage);
    r.run(0.1, hold(r, foot.x, foot.z - 1));
    expect(r.hall.collar.open).toBe(false);
    r.run(0.1, hold(r, top.x, top.z));
    expect(r.hall.collar.open).toBe(true);
    expect(r.hall.collar.high).toBe(true);
  });

  test('breaking the collar frees the Stag, and the record says how the hall went', () => {
    const r = climbing();
    const { top } = rampWay(r.hall.stage);
    r.until(() => r.hall.freed, 60, () => {
      hold(r, top.x, top.z)();
      r.fight.input.aimX = r.hall.collar.x;
      r.fight.input.aimZ = r.hall.collar.z;
      r.fight.press('attack');
    });
    expect(r.hall.freed).toBe(true);
    expect(r.hall.stag.doing).toBe('freed');
    expect(r.told.filter((e) => e.type === 'freed')).toHaveLength(1);
    expect(r.ended).toHaveLength(1);
    const rec = r.ended[0]!;
    expect(rec.way).toBe('stag');
    expect(rec.result).toBe('calmed');
    expect(rec.boss?.phases.every((s) => s > 0)).toBe(true);
    expect(rec.length).toBeCloseTo(rec.boss!.phases.reduce((a, b) => a + b, 0), 5);
    expect(rec.boss?.counts.pins).toBe(4);
    expect(rec.boss?.counts.lamps).toBe(4);
    // It attacks no more once freed.
    const shapes = r.fight.shapes.filter((s) => s.live).length;
    r.run(5);
    expect(r.fight.shapes.filter((s) => s.live).length).toBeLessThanOrEqual(shapes);
    expect(r.heard.filter((e) => e.type === 'tell').length).toBeGreaterThan(0);
  });
});

describe('fainting, and starting again', () => {
  test('a hero who faints wakes at the door, and the Stag keeps its phase and what is broken', () => {
    const r = room();
    r.until(() => r.hall.stag.doing !== 'asleep', 5, hold(r, 0.5, 8));
    const pin = r.hall.pins[0]!;
    pin.guard = 0.0001;
    r.fight.placeHero(pin.x, pin.z + 1.5);
    r.fight.input.aimX = pin.x;
    r.fight.input.aimZ = pin.z;
    r.fight.press('attack');
    r.run(0.4);
    expect(pin.broken).toBe(true);
    // Stand in every sweep until the health runs out.
    r.until(() => r.fight.hero.act === 'faint', 60, () => r.fight.placeHero(-3, 6));
    r.until(() => r.fight.hero.act !== 'faint', 5);
    expect(r.fight.record.faints).toBe(1);
    expect(r.fight.hero.x).toBeCloseTo(r.hall.stage.wake.x);
    expect(r.fight.hero.z).toBeCloseTo(r.hall.stage.wake.z);
    expect(r.fight.hero.health).toBe(HERO.health);
    expect(pin.broken).toBe(true);
    expect(r.hall.phase).toBe(0);
    expect(r.hall.stag.doing).not.toBe('asleep');
  });

  test('starting again puts every pin back, reports the hall in progress as left, and the Stag sleeps', () => {
    const r = room();
    r.until(() => r.hall.stag.doing !== 'asleep', 5, hold(r, 0.5, 8));
    breakPins(r);
    r.hall.restart();
    expect(r.ended.map((e) => e.result)).toEqual(['left']);
    expect(r.hall.phase).toBe(0);
    expect(r.hall.round).toBe(1);
    expect(r.hall.pins.every((p) => !p.broken && p.open)).toBe(true);
    expect(r.hall.stag.doing).toBe('asleep');
    expect(r.fight.targets).toHaveLength(HALL.pins.length + HALL.lamps.length + 1);
  });
});

describe('the Stag keeps attacking', () => {
  test('a hero who stands still anywhere on the floor is attacked every few seconds, in every phase', () => {
    const r = room();
    r.until(() => r.hall.stag.doing !== 'asleep', 5, hold(r, 0.5, 8));
    for (const at of [[0.5, 10], [-9, 0], [9, 7], [-4, -3]] as const) {
      const tells = r.heard.filter((e) => e.type === 'tell').length;
      r.run(10, hold(r, at[0], at[1]));
      expect(r.heard.filter((e) => e.type === 'tell').length - tells).toBeGreaterThanOrEqual(3);
    }
    expect(r.hall.record().boss!.quiet).toBeLessThanOrEqual(4);
  });

  test('the bot frees it, with the Stag never quiet for more than four seconds in any phase', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const stage = hallStage(0, 0), fight = createFight(stage, { way: 'hero' });
      let s = seed;
      const hall = createHall(fight, stage, { random: () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) });
      const bot = createHallBot(fight, hall);
      for (let t = 0; t < 400 && !hall.freed; t += DT) { bot.step(DT); fight.step(DT); hall.step(DT); fight.events.length = 0; hall.events.length = 0; }
      expect(hall.freed).toBe(true);
      const boss = hall.record().boss!;
      for (const q of boss.quietByPhase) expect(q).toBeLessThanOrEqual(4);
      expect(hall.clock).toBeLessThan(180);
    }
  });
});
