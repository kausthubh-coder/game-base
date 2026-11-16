import { describe, expect, test } from 'bun:test';
import {
  BEASTS, COMPANION, LAB_COMPANIONS as COMPANIONS, GENTLE, HERO, PAIR_GUARD, RAGE, RIG, SLOWED, SWORD, WEAPONS, beastOf, companionOf, weaponOf, type Way, type WeaponKind,
} from '../content/fight.ts';
import { ARENA, arenaStage, pondCells } from './arena.sim.ts';
import { createBot, type BotLevel } from './bot.sim.ts';
import { createFight, type BeastState, type Fight, type FightEvent, type FightOptions, type FightRecord } from './fight.sim.ts';
import { summaryOf } from './record.sim.ts';
import { dirX, dirZ, facingOf, inCircle, inCone, inLine, turnBetween } from './shapes.sim.ts';

const DT = 1 / 60;

interface Lab {
  fight: Fight;
  /** Every event since the lab was made, one after another. */
  heard: FightEvent[];
  ended: FightRecord[];
  /** Steps the fight for this many seconds. `each` runs before every step. */
  run(seconds: number, each?: () => void): void;
  /** Steps until `done` is true. False when `limit` seconds passed first. */
  until(done: () => boolean, limit?: number, each?: () => void): boolean;
  count(type: FightEvent['type']): number;
  /** Guard taken by the hero alone, from the start. */
  heroGuard(): number;
  /** Seconds between the first event of one type and the first of another. */
  at(type: FightEvent['type']): number;
}

function lab(way: Way, options: FightOptions = {}): Lab {
  const heard: FightEvent[] = [], times: number[] = [], ended: FightRecord[] = [];
  const fight = createFight(arenaStage(0, 0), { way, onEnd: (record) => ended.push(record), ...options });
  let now = 0;
  const step = (each?: () => void): void => {
    each?.();
    fight.step(DT);
    now += DT;
    for (const e of fight.events) { heard.push(e); times.push(now); }
    fight.events.length = 0;
  };
  return {
    fight, heard, ended,
    run(seconds, each) { for (let t = 0; t < seconds - 1e-9; t += DT) step(each); },
    until(done, limit = 30, each) {
      for (let t = 0; t < limit; t += DT) { if (done()) return true; step(each); }
      return done();
    },
    count: (type) => heard.filter((e) => e.type === type).length,
    heroGuard: () => heard.filter((e) => e.type === 'guard' && e.text === 'hero').reduce((sum, e) => sum + e.n, 0),
    at: (type) => times[heard.findIndex((e) => e.type === type)] ?? NaN,
  };
}

/** Puts the hero somewhere, facing and aiming at the first beast. */
function stand(l: Lab, x: number, z: number): void {
  l.fight.placeHero(x, z);
  const b = l.fight.beasts[0];
  if (b) { l.fight.input.aimX = b.x; l.fight.input.aimZ = b.z; }
}

/** Cuts until the beast is dizzy, standing just outside its body, ignoring everything it does. */
function cutDown(l: Lab): void {
  const b = l.fight.beasts[0]!;
  l.until(() => b.doing === 'dizzy', 300, () => {
    stand(l, b.x, b.z + b.def.radius + 1.2);
    l.fight.hero.health = HERO.health;
    l.fight.press('attack');
  });
  // The last cut runs out.
  l.run(0.5);
}

describe('shapes', () => {
  test('facing 0 is north and a quarter turn is east', () => {
    expect(dirZ(0)).toBe(-1);
    expect(dirX(Math.PI / 2)).toBeCloseTo(1);
    expect(facingOf(1, 0)).toBeCloseTo(Math.PI / 2);
    expect(turnBetween(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
  });

  test('a line reaches its length and half its width, and no further', () => {
    // From the origin toward the east, 8 long and 2 wide.
    expect(inLine(7.9, 0.9, 0, 0, Math.PI / 2, 8, 2)).toBe(true);
    expect(inLine(8.1, 0, 0, 0, Math.PI / 2, 8, 2)).toBe(false);
    expect(inLine(4, 1.1, 0, 0, Math.PI / 2, 8, 2)).toBe(false);
    expect(inLine(-0.1, 0, 0, 0, Math.PI / 2, 8, 2)).toBe(false);
    expect(inLine(4, 1.1, 0, 0, Math.PI / 2, 8, 2, 0.15)).toBe(true);
  });

  test('a cone opens to both sides of its facing', () => {
    const half = Math.PI / 3;
    expect(inCone(0, -3, 0, 0, 0, 4, half)).toBe(true);
    expect(inCone(2.5, -2, 0, 0, 0, 4, half)).toBe(true);
    expect(inCone(3, 0.5, 0, 0, 0, 4, half)).toBe(false);
    expect(inCone(0, -4.5, 0, 0, 0, 4, half)).toBe(false);
    expect(inCone(0, 2, 0, 0, 0, 4, half)).toBe(false);
  });

  test('a circle', () => {
    expect(inCircle(3, 0, 0, 0, 3)).toBe(true);
    expect(inCircle(3, 0.2, 0, 0, 3)).toBe(false);
  });
});

describe('the arena', () => {
  const stage = arenaStage(100, -50);

  test('is 30 blocks across with a pond, a wall and three trees in it', () => {
    expect(ARENA.radius * 2).toBe(30);
    expect(pondCells().length).toBeGreaterThan(15);
    expect(ARENA.trees.length).toBe(3);
    for (const cell of [...ARENA.wall, ...ARENA.trees, ...pondCells()]) expect(stage.inside(100 + cell.x + 0.5, -50 + cell.z + 0.5)).toBe(true);
  });

  test('the wall and the trees are solid, the pond is water, the rest is open', () => {
    expect(stage.solid(100 - 2.5, -50 - 9.5)).toBe(true);
    expect(stage.solid(100 - 10.5, -50 - 3.5)).toBe(true);
    expect(stage.water(100 + 7.5, -50 + 5.5)).toBe(true);
    for (const spot of [stage.start, stage.den, stage.wake]) {
      expect(stage.solid(spot.x, spot.z)).toBe(false);
      expect(stage.water(spot.x, spot.z)).toBe(false);
      expect(stage.inside(spot.x, spot.z)).toBe(true);
    }
    expect(stage.inside(100 + 16, -50)).toBe(false);
  });
});

describe('the rules every fight shares', () => {
  test('a beast sleeps until the hero comes near', () => {
    const l = lab('hero');
    const b = l.fight.bring('thistlehog');
    l.run(2);
    expect(b.doing).toBe('asleep');
    expect(l.fight.phase).toBe('setup');
    stand(l, b.x, b.z + 5);
    l.run(0.1);
    expect(b.doing).toBe('alert');
    expect(l.fight.phase).toBe('fight');
  });

  test('an attack shows its shape for its whole lead time before it lands', () => {
    const l = lab('hero');
    const b = l.fight.bring('thistlehog'), needles = b.def.attacks[0]!;
    stand(l, b.x, b.z + 1.5);
    l.until(() => l.count('strike') > 0);
    expect(l.at('strike') - l.at('tell')).toBeCloseTo(needles.lead, 1);
    const shape = l.fight.shapes.find((s) => s.live)!;
    expect(shape.kind).toBe('circle');
    expect(shape.reach).toBe(needles.reach);
  });

  test('a hero who stands in the shape is hit once, and one who walked out is not', () => {
    const stays = lab('hero'), b = stays.fight.bring('thistlehog');
    stand(stays, b.x, b.z + 1.5);
    stays.until(() => stays.count('strike') > 0);
    expect(stays.fight.hero.health).toBe(HERO.health - b.def.attacks[0]!.damage);
    expect(stays.fight.record.hitsTaken).toBe(1);
    expect(stays.fight.record.hitBy).toEqual({ needles: 1 });

    const leaves = lab('hero'), b2 = leaves.fight.bring('thistlehog');
    stand(leaves, b2.x, b2.z + 1.5);
    leaves.until(() => leaves.count('strike') > 0, 30, () => {
      // Walks south once the shape shows.
      leaves.fight.input.moveZ = leaves.count('tell') > 0 ? 1 : 0;
    });
    expect(leaves.fight.hero.health).toBe(HERO.health);
    expect(leaves.fight.record.hitsTaken).toBe(0);
  });

  test('a hit pushes the hero away, and nothing hits again for a moment', () => {
    const l = lab('hero'), b = l.fight.bring('boar');
    stand(l, b.x, b.z + 2);
    l.until(() => l.count('heroHurt') > 0, 40, () => l.fight.placeHero(b.x, b.z + 2));
    expect(l.fight.hero.safe).toBeCloseTo(HERO.hurt.safe, 1);
    expect(l.fight.hero.act).toBe('hurt');
    const z = l.fight.hero.z;
    l.run(0.4);
    // The boar's hits are heavy or plain: either way the hero ends up further from it.
    expect(l.fight.hero.z - z).toBeGreaterThan(HERO.hurt.push * 0.8);
    expect(l.fight.hero.act).toBe('none');
  });

  test('an empty guard makes it dizzy, and holding the Mark calms it and leaves a gift', () => {
    const l = lab('hero'), b = l.fight.bring('thistlehog');
    cutDown(l);
    expect(b.guard).toBe(0);
    l.fight.input.calmHeld = true;
    l.run(HERO.calm.hold - 0.1);
    expect(b.doing).toBe('dizzy');
    l.run(0.2);
    expect(b.doing).toBe('calmed');
    expect(l.fight.phase).toBe('won');
    expect(l.heard.find((e) => e.type === 'calmed')!.text).toBe('Quills');
    expect(l.ended.length).toBe(1);
    expect(l.ended[0]!.result).toBe('calmed');
    expect(l.ended[0]!.length).toBeGreaterThan(0);
  });

  test('letting go of the Mark early loses the hold', () => {
    const l = lab('hero'), b = l.fight.bring('thistlehog');
    cutDown(l);
    l.fight.input.calmHeld = true;
    l.run(0.5);
    expect(b.calm).toBeGreaterThan(0.4);
    l.fight.input.calmHeld = false;
    l.run(0.5);
    expect(b.calm).toBe(0);
    expect(b.doing).toBe('dizzy');
  });

  test('a beast nobody calms gets a third of its guard back and fights on', () => {
    const l = lab('hero'), b = l.fight.bring('thistlehog');
    cutDown(l);
    stand(l, b.x + 10, b.z);
    l.run(b.def.dizzy + 0.2);
    expect(b.doing).not.toBe('dizzy');
    expect(b.guard).toBeCloseTo(b.full / 3);
    expect(l.count('recovered')).toBe(1);
  });

  test('a hero whose health runs out faints, wakes at the edge with full health, and the beast keeps its guard', () => {
    const l = lab('hero'), b = l.fight.bring('boar');
    const stage = arenaStage(0, 0);
    stand(l, b.x, b.z + 2);
    l.fight.press('attack');
    l.run(0.3);
    expect(b.guard).toBeLessThan(b.def.guard);
    let lowest = Infinity;
    l.until(() => l.count('faint') > 0, 120, () => {
      if (l.fight.hero.act !== 'faint') stand(l, b.x, b.z + 2);
      lowest = Math.min(lowest, l.fight.hero.health);
    });
    const guard = b.guard;
    expect(lowest).toBeGreaterThan(0);
    expect(l.count('faint')).toBe(1);
    expect(l.fight.hero.health).toBe(0);
    l.until(() => l.count('woke') > 0, 5);
    expect(l.fight.hero.health).toBe(HERO.health);
    expect(l.fight.hero.x).toBe(stage.wake.x);
    expect(l.fight.hero.z).toBe(stage.wake.z);
    expect(b.guard).toBe(guard);
    expect(b.doing).not.toBe('calmed');
    expect(l.fight.record.faints).toBe(1);
    expect(l.fight.phase).toBe('fight');
  });

  test('gentle makes every lead longer and every hit weaker', () => {
    const l = lab('hero', { gentle: true }), b = l.fight.bring('thistlehog'), needles = b.def.attacks[0]!;
    stand(l, b.x, b.z + 1.5);
    l.until(() => l.count('strike') > 0);
    expect(l.at('strike') - l.at('tell')).toBeCloseTo(needles.lead * GENTLE.lead, 1);
    expect(l.fight.hero.health).toBe(HERO.health - needles.damage * GENTLE.damage);
  });

  test("the Mark's reach: a beast deeper than the Heartstone is emptied and still not calmed", () => {
    const l = lab('hero', { reach: 2 }), b = l.fight.bring('boar');
    cutDown(l);
    l.fight.input.calmHeld = true;
    l.run(HERO.calm.hold + 0.2);
    expect(b.doing).not.toBe('calmed');
    expect(l.heard.some((e) => e.type === 'beyond' && e.text.includes('Mark') && e.n === 5)).toBe(true);
    expect(l.fight.phase).toBe('fight');
  });

  test('bringing in another beast drops the fight in progress and reports it', () => {
    const l = lab('hero'), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 2);
    l.run(1);
    l.fight.bring('gearling');
    expect(l.ended.length).toBe(1);
    expect(l.ended[0]!.result).toBe('left');
    expect(l.ended[0]!.enemy).toBe('thistlehog');
    expect(l.fight.record.enemy).toBe('gearling');
    expect(l.fight.phase).toBe('setup');
  });
});


describe('the sword', () => {
  const cut = SWORD.quick, spin = SWORD.held;

  test('a cut lands a tenth of a second after the press, on a beast in its arc', () => {
    const l = lab('hero'), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 2);
    l.fight.press('attack');
    l.run(cut.startup - 0.03);
    expect(l.heroGuard()).toBe(0);
    l.run(0.06);
    expect(l.heroGuard()).toBe(cut.guard);
    expect(l.fight.record.swings).toBe(1);
    expect(l.fight.record.whiffs).toBe(0);
  });

  test('a cut pushes a thistlehog 0.4 blocks away, and the gearling and the boar not until their guard is empty', () => {
    const small = lab('hero'), hog = small.fight.bring('thistlehog'), from = hog.z;
    stand(small, hog.x, hog.z + 2);
    small.fight.press('attack');
    small.run(cut.startup + cut.pushTime + 0.05);
    // Away from the hero, who stands to the south: north is -z. It is still waking, so it does not walk.
    expect(hog.doing).toBe('alert');
    expect(from - hog.z).toBeCloseTo(cut.push, 2);

    for (const kind of ['gearling', 'boar']) {
      const l = lab('hero'), b = l.fight.bring(kind), at = { x: b.x, z: b.z };
      stand(l, b.x, b.z + b.def.radius + 1.2);
      l.fight.press('attack');
      l.run(cut.startup + cut.pushTime + 0.05);
      expect(b.guard).toBeLessThan(b.def.guard);
      expect(Math.hypot(b.x - at.x, b.z - at.z)).toBe(0);
      cutDown(l);
      expect(b.doing).toBe('dizzy');
      // Back on open ground, so nothing stops the push.
      b.x = at.x;
      b.z = at.z;
      const z = b.z;
      stand(l, b.x, b.z + b.def.radius + 1.2);
      l.fight.press('attack');
      l.run(cut.startup + cut.pushTime + 0.05);
      expect(z - b.z).toBeCloseTo(cut.push, 2);
    }
  });

  test('a cut at nothing is a whiff', () => {
    const l = lab('hero'), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 9);
    l.fight.input.aimZ = b.z + 20;
    l.fight.press('attack');
    l.run(0.5);
    expect(l.fight.record.swings).toBe(1);
    expect(l.fight.record.whiffs).toBe(1);
    expect(b.guard).toBe(b.def.guard);
  });

  test('a cut bends to a beast that stands near the pointer, and not to one far from it', () => {
    const l = lab('hero'), b = l.fight.bring('thistlehog');
    l.fight.placeHero(b.x, b.z + 2);
    // The pointer is 25 degrees off the beast.
    l.fight.input.aimX = b.x + Math.tan(25 * Math.PI / 180) * 2;
    l.fight.input.aimZ = b.z;
    l.fight.press('attack');
    l.run(0.05);
    expect(l.fight.hero.facing).toBeCloseTo(0);
    l.run(0.5);
    // Due east of the hero. The cut pushed the beast, so this is measured from the hero.
    l.fight.input.aimX = l.fight.hero.x + 6;
    l.fight.input.aimZ = l.fight.hero.z;
    l.fight.press('attack');
    l.run(0.05);
    expect(l.fight.hero.facing).toBeCloseTo(Math.PI / 2);
  });

  test('two cuts chain, then the pair has to finish', () => {
    const l = lab('hero'), b = l.fight.bring('boar');
    stand(l, b.x, b.z + b.def.radius + 1.5);
    l.run(0.9, () => { stand(l, b.x, b.z + b.def.radius + 1.5); l.fight.press('attack'); });
    // Cut, cut at 0.2, the pair ends at 0.6, cut at 0.6, cut at 0.8.
    expect(l.fight.record.swings).toBe(4);
  });

  test('holding the button charges a spin that breaks three cuts of guard', () => {
    const l = lab('hero'), b = l.fight.bring('boar');
    stand(l, b.x, b.z + b.def.radius + 1.5);
    l.fight.press('attack');
    l.fight.input.attackHeld = true;
    l.run(spin.hold + 0.1);
    expect(l.count('charged')).toBe(1);
    const before = l.heroGuard();
    l.fight.input.attackHeld = false;
    l.run(0.2);
    expect(l.heroGuard() - before).toBe(spin.guard);
    expect(l.fight.record.swings).toBe(2);
  });

  test('a spin pushes a thistlehog 2 blocks away over a quarter second, and the boar only once its guard is empty', () => {
    /** Charges a spin from the north of the beast, lets it go, and returns how far south it went. */
    const spinAt = (l: Lab, b: BeastState): number => {
      stand(l, b.x, b.z - b.def.radius - 1.2);
      l.fight.press('attack');
      l.fight.input.attackHeld = true;
      l.run(spin.hold + 0.1);
      const from = b.z;
      l.fight.input.attackHeld = false;
      l.run(spin.startup + spin.pushTime + 0.05);
      expect(l.count('hit')).toBeGreaterThanOrEqual(2);
      return b.z - from;
    };
    const small = lab('hero'), hog = small.fight.bring('thistlehog');
    cutDown(small);
    expect(spinAt(small, hog)).toBeCloseTo(spin.push, 2);

    const big = lab('hero'), boar = big.fight.bring('boar');
    expect(Math.abs(spinAt(big, boar))).toBeLessThan(0.05);
    cutDown(big);
    expect(boar.doing).toBe('dizzy');
    expect(spinAt(big, boar)).toBeCloseTo(spin.push, 2);
  });

  test('a cut lands six steps of the body after the step that reads the press, as note 05 times it', () => {
    const l = lab('hero'), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 2);
    l.fight.press('attack');
    l.run(6 / 60);
    expect(l.count('hit')).toBe(0);
    l.run(1 / 60);
    expect(l.count('hit')).toBe(1);
  });

  test('a dodge carries the hero 3.5 blocks and through an attack', () => {
    const l = lab('hero'), b = l.fight.bring('thistlehog'), needles = b.def.attacks[0]!;
    stand(l, b.x, b.z + 1.5);
    l.until(() => l.count('tell') > 0);
    // Stays in the ring and dodges as it lands.
    l.run(needles.lead - 0.15, () => stand(l, b.x, b.z + 1.5));
    const from = l.fight.hero.z;
    l.fight.input.moveZ = -1;
    l.fight.press('dodge');
    l.run(0.02);
    l.fight.input.moveZ = 0;
    l.run(0.6);
    expect(l.count('strike')).toBe(1);
    expect(l.fight.record.hitsTaken).toBe(0);
    expect(l.fight.record.dodged).toBe(1);
    expect(from - l.fight.hero.z).toBeCloseTo(HERO.dodge.speed * HERO.dodge.time, 0);
  });

  test('four dodges in a row, and the fifth has no breath for it', () => {
    const l = lab('hero');
    for (let i = 0; i < 5; i++) { l.fight.press('dodge'); l.run(HERO.dodge.time + 0.05); }
    expect(l.count('dodge')).toBe(4);
    expect(l.heard.some((e) => e.type === 'denied')).toBe(true);
  });
});

describe('the bow', () => {
  const arrow = weaponOf('bow').quick, drawn = weaponOf('bow').held;

  test('a click looses an arrow down the aim: it flies at 24 blocks a second and lands on the beast it reaches', () => {
    const l = lab('hero', { weapon: 'bow' }), b = l.fight.bring('gearling');
    stand(l, b.x, b.z + 8);
    l.fight.press('attack');
    l.run(arrow.startup + 0.02);
    expect(l.count('shot')).toBe(1);
    expect(l.heroGuard()).toBe(0);
    // About 7 blocks to the gearling's edge: a third of a second at 24 a second.
    l.run(0.33);
    expect(l.heroGuard()).toBe(arrow.guard);
    expect(l.count('shotHit')).toBe(1);
    expect(l.fight.shots.filter((s) => s.live)).toHaveLength(0);
  });

  test('an arrow bends to a beast within 8 degrees of the aim, and misses one further off', () => {
    const near = lab('hero', { weapon: 'bow' }), b = near.fight.bring('gearling');
    near.fight.placeHero(b.x, b.z + 8);
    near.fight.input.aimX = b.x + Math.tan(6 * Math.PI / 180) * 8;
    near.fight.input.aimZ = b.z;
    near.fight.press('attack');
    near.run(0.7);
    expect(near.count('shotHit')).toBe(1);

    const far = lab('hero', { weapon: 'bow' }), b2 = far.fight.bring('gearling');
    far.fight.placeHero(b2.x, b2.z + 8);
    far.fight.input.aimX = b2.x + Math.tan(14 * Math.PI / 180) * 8;
    far.fight.input.aimZ = b2.z;
    far.fight.press('attack');
    far.run(0.9);
    expect(far.count('shotHit')).toBe(0);
    expect(far.fight.record.whiffs).toBe(1);
  });

  test('an arrow stops at a tree', () => {
    const l = lab('hero', { weapon: 'bow' }), stage = arenaStage(0, 0), tree = ARENA.trees[0]!;
    l.fight.bring('thistlehog');
    // The tree at (-11, -4): shoot west at it from 5 blocks east, with open ground behind it.
    l.fight.placeHero(stage.center.x + tree.x + 5, stage.center.z + tree.z);
    l.fight.input.aimX = stage.center.x + tree.x - 5;
    l.fight.input.aimZ = stage.center.z + tree.z;
    l.fight.press('attack');
    l.run(0.4);
    expect(l.fight.shots.filter((s) => s.live)).toHaveLength(0);
    expect(l.heard.find((e) => e.type === 'whiff')!.x).toBeGreaterThan(stage.center.x + tree.x - 0.5);
  });

  test('hold and let go: a drawn shot passes through two beasts and pushes the small one', () => {
    const l = lab('hero', { weapon: 'bow' }), front = l.fight.bring('thistlehog', 'thistlehog'), back = l.fight.beasts[1]!;
    // Both in a line north of the hero.
    back.x = front.x;
    back.z = front.z - 2;
    stand(l, front.x, front.z + 6);
    l.fight.press('attack');
    l.fight.input.attackHeld = true;
    l.run(drawn.hold + 0.05, () => stand(l, front.x, front.z + 6));
    expect(l.count('charged')).toBe(1);
    const z = front.z, quick = l.heroGuard();
    l.fight.input.attackHeld = false;
    l.run(0.6, () => stand(l, front.x, front.z + 6));
    expect(l.heard.filter((e) => e.type === 'shotHit' && e.text === 'drawn')).toHaveLength(2);
    expect(l.heroGuard() - quick).toBeCloseTo(drawn.guard * 2, 5);
    expect(z - front.z).toBeGreaterThan(drawn.push * 0.8);
  });

  test('drawing the bow slows the walk', () => {
    const l = lab('hero', { weapon: 'bow' });
    l.fight.input.attackHeld = true;
    l.run(0.5);
    expect(l.fight.hero.pace).toBeCloseTo(drawn.holdPace);
  });
});

describe('the staff', () => {
  const bolt = weaponOf('staff').quick, burst = weaponOf('staff').held;

  test('a bolt breaks a little guard and leaves a mark, at most three', () => {
    const l = lab('hero', { weapon: 'staff', companion: 'mossling' }), b = l.fight.bring('boar');
    stand(l, b.x, b.z + 6);
    for (let i = 0; i < 4; i++) { l.fight.press('attack'); l.run(0.5, () => stand(l, b.x, b.z + 6)); }
    expect(l.count('shotHit')).toBe(4);
    expect(l.heroGuard()).toBeCloseTo(bolt.guard * 4, 5);
    expect(b.marks).toBe(3);
  });

  test("the marks make the companion's next strike half again as strong for each, and the strike spends them", () => {
    const l = lab('hero', { weapon: 'staff', companion: 'leaftail' }), b = l.fight.bring('boar');
    const striker = companionOf('leaftail');
    stand(l, b.x, b.z + 7);
    l.fight.wake();
    l.until(() => b.marks === 3, 10, () => { stand(l, b.x, b.z + 7); l.fight.press('attack'); });
    const marks = b.marks;
    l.until(() => l.heard.some((e) => e.type === 'companionStrike' && e.n > 0), 10, () => stand(l, b.x, b.z + 7));
    const strike = l.heard.find((e) => e.type === 'companionStrike' && e.n > 0)!;
    const guard = l.heard[l.heard.indexOf(strike) + 1]!;
    expect(guard.type).toBe('guard');
    expect(guard.n).toBeCloseTo(striker.strike * (1 + COMPANION.markBoost * strike.n), 5);
    expect(strike.n).toBeLessThanOrEqual(marks);
    expect(b.marks).toBe(0);
  });

  test('hold and let go: a burst at the pointer slows what it catches, and reaches no further than the staff', () => {
    const l = lab('hero', { weapon: 'staff', companion: 'mossling' }), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 6);
    l.fight.input.attackHeld = true;
    l.run(burst.hold + 0.05, () => stand(l, b.x, b.z + 6));
    l.fight.input.attackHeld = false;
    l.run(burst.startup + 0.05, () => stand(l, b.x, b.z + 6));
    expect(l.count('burst')).toBe(1);
    expect(b.slow).toBeGreaterThan(burst.slow - 0.2);
    expect(l.heroGuard()).toBeCloseTo(burst.guard, 5);
    // Slowed, it closes in at half its speed.
    const z = b.z;
    l.until(() => b.doing === 'stalk', 3, () => stand(l, b.x, b.z + 6));
    const from = b.z;
    l.run(0.5, () => stand(l, b.x, from + 6));
    expect(b.z - from).toBeLessThan(b.def.speed * SLOWED * 0.5 + 0.05);
    expect(z).toBeDefined();

    // A pointer far past the staff's reach puts the burst at its reach.
    const far = lab('hero', { weapon: 'staff' });
    far.fight.placeHero(0.5, 6.5);
    far.fight.input.aimX = 0.5;
    far.fight.input.aimZ = 6.5 - 20;
    far.fight.input.attackHeld = true;
    far.run(burst.hold + 0.05);
    far.fight.input.attackHeld = false;
    far.run(burst.startup + 0.05);
    const at = far.heard.find((e) => e.type === 'burst')!;
    expect(6.5 - at.z).toBeCloseTo(burst.range, 1);
  });
});

describe('changing the weapon', () => {
  test('1, 2 and 3 change the weapon in the middle of a fight, with a moment in which the hero cannot attack', () => {
    const l = lab('hero'), b = l.fight.bring('gearling');
    stand(l, b.x, b.z + 2);
    l.fight.press('attack');
    l.run(0.5, () => stand(l, b.x, b.z + 2));
    expect(l.fight.phase).toBe('fight');
    l.fight.setWeapon('bow');
    expect(l.fight.hero.weapon).toBe('bow');
    expect(l.fight.events.filter((e) => e.type === 'swap')).toHaveLength(1);
    l.fight.press('attack');
    l.run(HERO.swap - 0.1, () => stand(l, b.x, b.z + 2));
    expect(l.count('swing')).toBe(1);
    // A press in the last moment is kept, and acts as soon as the moment is over.
    l.fight.press('attack');
    l.run(0.05, () => stand(l, b.x, b.z + 2));
    expect(l.count('swing')).toBe(1);
    l.run(0.4, () => stand(l, b.x, b.z + 2));
    expect(l.count('shot')).toBe(1);
    l.fight.setWeapon('staff');
    expect(l.fight.record.weapon).toBe('sword');
    expect(l.fight.record.weapons).toEqual(['sword', 'bow', 'staff']);
    expect(l.fight.record.swaps).toBe(2);
  });

  test('a swap drops a held move being charged', () => {
    const l = lab('hero');
    l.fight.input.attackHeld = true;
    l.run(SWORD.held.hold + 0.1);
    expect(l.fight.hero.charged).toBe(true);
    l.fight.setWeapon('bow');
    expect(l.fight.hero.charged).toBe(false);
    expect(l.fight.hero.charge).toBe(0);
  });
});

describe('companions', () => {
  test('there are four, one for each job', () => {
    expect(COMPANIONS.map((c) => c.role)).toEqual(['striker', 'guard', 'healer', 'booster']);
  });

  test('the striker attacks by itself, with nobody sending it, and steps out of the shapes on the ground', () => {
    const l = lab('hero', { companion: 'leaftail' }), b = l.fight.bring('boar');
    // The hero stands back and never attacks.
    stand(l, b.x, b.z + 8);
    l.fight.wake();
    let inShape = 0;
    l.run(20, () => {
      stand(l, b.x, b.z + 8);
      l.fight.hero.health = HERO.health;
      const c = l.fight.companion;
      for (const s of l.fight.shapes) if (s.live && s.t > 0.6 && s.t < s.lead && s.kind === 'circle' && Math.hypot(c.x - s.x, c.z - s.z) < s.reach - 0.5) inShape++;
    });
    expect(l.count('companionStrike')).toBeGreaterThan(5);
    expect(l.heroGuard()).toBe(0);
    expect(b.guard).toBeLessThan(b.def.guard);
    // It is never deep in a ring that is about to land.
    expect(inShape).toBe(0);
  });

  test("the striker's pounce on C, then it rests", () => {
    const l = lab('hero', { companion: 'leaftail' }), b = l.fight.bring('boar');
    stand(l, b.x, b.z + 6);
    l.fight.wake();
    l.run(1);
    l.fight.press('skill');
    l.until(() => l.heard.some((e) => e.type === 'companionStrike' && e.text === 'pounce'), 5, () => stand(l, b.x, b.z + 6));
    const pounce = l.heard.find((e) => e.type === 'companionStrike' && e.text === 'pounce')!;
    expect(l.heard[l.heard.indexOf(pounce) + 1]!.n).toBe(companionOf('leaftail').skill.guard);
    expect(l.fight.skill().left).toBeGreaterThan(0);
    l.fight.press('skill');
    l.run(0.1);
    expect(l.heard.some((e) => e.type === 'denied' && e.text === 'Not yet.')).toBe(true);
  });

  test('the guard stands between the hero and the beast, and takes half of a hit that lands on the hero', () => {
    const l = lab('hero', { companion: 'pebblepup' }), b = l.fight.bring('thistlehog');
    // The guard comes to the hero's heel while the beast sleeps, then the beast wakes.
    l.run(2, () => stand(l, b.x, b.z + 7));
    l.fight.wake();
    l.run(1.4, () => stand(l, b.x, b.z + 2));
    const c = l.fight.companion;
    // Between: nearer the beast than the hero is, and close to the hero.
    expect(Math.hypot(c.x - b.x, c.z - b.z)).toBeLessThan(2);
    expect(Math.hypot(c.x - l.fight.hero.x, c.z - l.fight.hero.z)).toBeLessThan(COMPANION.cover);
    l.until(() => l.count('heroHurt') > 0, 20, () => stand(l, b.x, b.z + 2));
    const hit = l.heard.find((e) => e.type === 'heroHurt')!;
    const damage = b.def.attacks.find((a) => a.id === hit.text)!.damage;
    expect(l.count('guarded')).toBe(1);
    expect(l.fight.hero.health).toBeCloseTo(HERO.health - damage * (1 - COMPANION.guardShare), 5);
  });

  test("the guard's brace on C takes the next attack whole and staggers the beast", () => {
    const l = lab('hero', { companion: 'pebblepup' }), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 1.8);
    l.until(() => l.count('tell') > 0, 20, () => stand(l, b.x, b.z + 1.8));
    l.fight.press('skill');
    l.until(() => l.count('strike') > 0, 5, () => stand(l, b.x, b.z + 1.8));
    expect(l.count('blocked')).toBe(1);
    expect(l.fight.record.hitsTaken).toBe(0);
    expect(l.fight.record.blocks).toBe(1);
    expect(b.doing).toBe('stun');
  });

  test('the healer mends the hero while nothing is about to land on them, and not while something is', () => {
    // The beast sleeps out of reach: nothing is about to land.
    const l = lab('hero', { companion: 'lanternfly' }), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 12);
    l.fight.hero.health = 50;
    l.run(COMPANION.healWait + 1, () => stand(l, b.x, b.z + 12));
    expect(l.fight.hero.health).toBeGreaterThan(50 + COMPANION.heal * 0.8);
    expect(l.fight.companion.healing).toBe(true);
    // A shape over the hero: no mending until it lands.
    const health = l.fight.hero.health;
    l.fight.threaten({ kind: 'circle', x: l.fight.hero.x + 20, z: l.fight.hero.z, facing: 0, reach: 1, width: 0, lead: 2, damage: 1, heavy: false, id: 'far' });
    l.fight.threaten({ kind: 'circle', x: l.fight.hero.x, z: l.fight.hero.z, facing: 0, reach: 2, width: 0, lead: 1, damage: 0, heavy: false, id: 'over' });
    l.run(0.5, () => stand(l, b.x, b.z + 12));
    expect(l.fight.hero.health).toBe(health);
    expect(l.fight.record.healed).toBeGreaterThan(0);
  });

  test("the healer's mend on C gives health back at once", () => {
    const l = lab('hero', { companion: 'lanternfly' });
    l.fight.press('skill');
    l.run(0.05);
    expect(l.heard.some((e) => e.type === 'denied' && e.text === 'You are not hurt.')).toBe(true);
    l.fight.hero.health = 40;
    l.fight.press('skill');
    l.run(0.05);
    expect(l.fight.hero.health).toBeCloseTo(40 + companionOf('lanternfly').skill.heal, 0);
    expect(l.count('mend')).toBe(1);
  });

  test('the booster makes the next hit strong every few seconds of a fight, and a strong hit breaks twice the guard', () => {
    const l = lab('hero', { companion: 'mossling' }), b = l.fight.bring('boar');
    stand(l, b.x, b.z + 9);
    l.fight.wake();
    l.until(() => l.count('strongReady') > 0, COMPANION.boostEvery + 1, () => stand(l, b.x, b.z + 9));
    expect(l.fight.clock).toBeCloseTo(COMPANION.boostEvery, 0);
    expect(l.fight.hero.strong).toBe(true);
    const before = l.heroGuard();
    stand(l, b.x, b.z + b.def.radius + 1.2);
    l.fight.press('attack');
    l.run(0.2, () => stand(l, b.x, b.z + b.def.radius + 1.2));
    expect(l.heroGuard() - before).toBeCloseTo(SWORD.quick.guard * HERO.strong, 5);
    expect(l.count('strongHit')).toBe(1);
    expect(l.fight.hero.strong).toBe(false);
  });

  test("the booster's bloom on C: for a few seconds every hit breaks more guard and a held attack charges twice as fast", () => {
    const l = lab('hero', { companion: 'mossling' }), b = l.fight.bring('boar');
    stand(l, b.x, b.z + b.def.radius + 1.2);
    l.fight.press('skill');
    l.run(0.05);
    expect(l.fight.hero.bloom).toBeGreaterThan(0);
    l.fight.input.attackHeld = true;
    l.run(SWORD.held.hold / COMPANION.bloomCharge + 0.05);
    expect(l.fight.hero.charged).toBe(true);
    l.fight.input.attackHeld = false;
    const before = l.heroGuard();
    l.run(0.2);
    expect(l.heroGuard() - before).toBeCloseTo(SWORD.held.guard * COMPANION.bloomGuard, 5);
  });

  test('nothing hurts a companion, and nobody sends it or calls it back: the only press is C', () => {
    for (const c of COMPANIONS) {
      const l = lab('hero', { companion: c.kind }), b = l.fight.bring('boar');
      l.run(30, () => { stand(l, b.x, b.z + 2); l.fight.hero.health = HERO.health; if (l.fight.companion.rest <= 0) l.fight.press('skill'); });
      expect(Object.keys(l.fight.companion)).not.toContain('hearts');
      expect(l.heard.filter((e) => (e.type as string).startsWith('pet'))).toHaveLength(0);
    }
  });
});

describe('beasts that ask more', () => {
  test('every beast has at least two attacks of milestone 4, each with its own shape and its own tell', () => {
    for (const kind of ['thistlehog', 'gearling', 'boar']) {
      const def = beastOf(kind), added = def.attacks.filter((a) => a.fightOnly && !a.follows);
      expect(added.length).toBeGreaterThanOrEqual(2);
      const tells = new Set(def.attacks.map((a) => a.tell));
      expect(tells.size).toBe(def.attacks.length);
      for (const a of def.attacks) expect(a.lead).toBeGreaterThanOrEqual(0.6);
    }
  });

  test('a hero far off is not safe: each beast has an attack that reaches past 15 blocks', () => {
    for (const b of BEASTS) expect(Math.max(...b.attacks.filter((a) => !a.follows).map((a) => a.to))).toBeGreaterThanOrEqual(15);
  });

  test('far off, the thistlehog rains quills where the hero stands, and again where they went', () => {
    const l = lab('hero'), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 9);
    l.fight.wake();
    l.until(() => l.heard.some((e) => e.type === 'tell' && e.text === 'quills'), 10, () => stand(l, b.x, b.z + 9));
    const shape = l.fight.shapes.find((s) => s.live)!;
    expect(Math.hypot(shape.x - l.fight.hero.x, shape.z - l.fight.hero.z)).toBeLessThan(0.3);
    // The hero walks east out of it, and the second shower comes down where they are.
    l.until(() => l.heard.some((e) => e.type === 'tell' && e.text === 'quills2'), 3, () => stand(l, b.x + 3, b.z + 9));
    const second = l.fight.shapes.find((s) => s.live && s.t < s.lead)!;
    expect(second.x).toBeCloseTo(b.x + 3, 0);
    expect(l.fight.record.hitsTaken).toBe(0);
  });

  test('the gearling throws a gear down a line at a hero far off, and the line stops at the wall', () => {
    const l = lab('hero'), b = l.fight.bring('gearling');
    stand(l, b.x, b.z + 11);
    l.fight.wake();
    l.until(() => l.heard.some((e) => e.type === 'tell' && e.text === 'toss'), 10, () => stand(l, b.x, b.z + 11));
    const line = l.fight.shapes.find((s) => s.live)!;
    expect(line.kind).toBe('line');
    expect(b.doing).toBe('windup');
    // It stays where it is: a thrown line does not move the beast.
    const at = { x: b.x, z: b.z };
    l.until(() => l.heard.some((e) => e.type === 'strike' && e.text === 'toss'), 3, () => stand(l, b.x + 3, b.z + 11));
    expect(Math.hypot(b.x - at.x, b.z - at.z)).toBeLessThan(0.01);
  });

  test("the boar lunges with its tusks a few steps off, and is slow to turn: an attack with a direction waits until it faces the hero", () => {
    const l = lab('hero'), b = l.fight.bring('boar');
    stand(l, b.x, b.z + 5);
    l.fight.wake();
    l.until(() => l.count('tell') > 0, 10, () => stand(l, b.x, b.z + 5));
    // Now the hero steps round to its side: it cannot start a tusk sweep or a lunge before it has turned.
    l.run(4, () => { stand(l, b.x, b.z + 5); l.fight.hero.health = HERO.health; });
    stand(l, b.x + 3, b.z);
    const facing = b.facing;
    l.run(0.2, () => stand(l, b.x + 3, b.z));
    const turned = Math.abs(b.facing - facing);
    expect(turned).toBeLessThanOrEqual(b.def.turn * 0.2 + 0.01);
  });

  test('once half its guard is gone it comes faster, and says so', () => {
    const l = lab('hero'), b = l.fight.bring('thistlehog'), needles = b.def.attacks[0]!;
    stand(l, b.x, b.z + 1.5);
    l.run(1);
    b.guard = b.full * RAGE.at + 1;
    l.fight.press('attack');
    l.run(0.3, () => stand(l, b.x, b.z + 1.5));
    expect(b.enraged).toBe(true);
    expect(l.count('enraged')).toBe(1);
    const from = l.heard.length;
    l.until(() => l.heard.slice(from).some((e) => e.type === 'tell' && e.text === 'needles'), 10, () => { stand(l, b.x, b.z + 1.5); l.fight.hero.health = HERO.health; });
    const tell = l.heard.slice(from).find((e) => e.type === 'tell' && e.text === 'needles')!;
    expect(tell.n).toBeCloseTo(Math.max(RAGE.least, needles.lead * RAGE.lead), 5);
    expect(tell.n).toBeGreaterThanOrEqual(0.6);
  });

  test('the traps fight the beasts as they were: no attack of milestone 4 and no rage', () => {
    const l = lab('world'), b = l.fight.bring('boar');
    stand(l, b.x, b.z + 7);
    l.fight.wake();
    l.run(60, () => { stand(l, b.x + 12 * Math.sin(l.fight.clock), b.z + 7); l.fight.hero.health = HERO.health; });
    const ids = new Set(l.heard.filter((e) => e.type === 'tell').map((e) => e.text));
    for (const a of b.def.attacks) if (a.fightOnly) expect(ids.has(a.id)).toBe(false);
    expect(l.count('enraged')).toBe(0);
  });
});

describe('two beasts at once', () => {
  test('two of a kind, or one each of two kinds, come in side by side with less guard each', () => {
    const l = lab('hero'), a = l.fight.bring('boar', 'gearling'), b = l.fight.beasts[1]!;
    expect(l.fight.beasts).toHaveLength(2);
    expect(b.def.kind).toBe('gearling');
    expect(a.guard).toBe(a.def.guard * PAIR_GUARD);
    expect(b.full).toBe(b.def.guard * PAIR_GUARD);
    expect(l.fight.record.enemy).toBe('boar+gearling');
    const two = lab('hero');
    two.fight.bring('thistlehog', 'thistlehog');
    expect(two.fight.record.enemy).toBe('thistlehog+thistlehog');
  });

  test('they wake together, take turns, and the fight is won only when both are calmed', () => {
    const l = lab('hero'), a = l.fight.bring('thistlehog', 'thistlehog'), b = l.fight.beasts[1]!;
    stand(l, (a.x + b.x) / 2, a.z + 1.5);
    l.run(0.2);
    expect(a.doing).not.toBe('asleep');
    expect(b.doing).not.toBe('asleep');
    let both = 0;
    l.run(15, () => {
      stand(l, (a.x + b.x) / 2, a.z + 1.5);
      l.fight.hero.health = HERO.health;
      if (a.doing === 'windup' && b.doing === 'windup') both++;
    });
    expect(both).toBe(0);
    cutDown(l);
    // The other one may still attack: the hero is kept safe through the hold.
    l.fight.input.calmHeld = true;
    l.run(HERO.calm.hold + 0.2, () => { l.fight.hero.safe = 1; });
    expect(a.doing).toBe('calmed');
    expect(b.doing).not.toBe('calmed');
    expect(l.fight.phase).toBe('fight');
  });
});

describe('the record', () => {
  test('a fight that ended is told in a few lines: how long, what hit you and how often, the health left', () => {
    const l = lab('hero', { weapon: 'bow', companion: 'lanternfly' }), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 1.5);
    l.until(() => l.count('heroHurt') > 0, 10, () => stand(l, b.x, b.z + 1.5));
    cutDown(l);
    l.fight.input.calmHeld = true;
    l.run(HERO.calm.hold + 0.2);
    const r = l.ended[0]!;
    expect(r.weapon).toBe('bow');
    expect(r.companion).toBe('lanternfly');
    const lines = summaryOf(r);
    expect(lines[0]).toMatch(/^The thistlehog, calmed in \d+\.\d s with the bow and the lanternfly\.$/);
    expect(lines[1]).toMatch(/^It hit you (once|twice|\d+ times): needles/);
    expect(lines.join(' ')).toMatch(/ended with \d+ of 100|all your health/);
  });
});
describe('the traps', () => {
  /** A fight with the hero standing south of the den, in reach of the ground between. */
  function world(kind: string): Lab {
    const l = lab('world');
    const b = l.fight.bring(kind);
    stand(l, b.x, b.z + 7);
    return l;
  }

  test('the kit holds one of each rig, set down within reach, on open ground, away from the beast', () => {
    const l = world('thistlehog'), b = l.fight.beasts[0]!;
    expect(l.fight.kit()).toEqual(['lamp', 'snare', 'plate', 'channel']);
    expect(l.fight.placeRig('snare', b.x, b.z + 3)).toBeNull();
    expect(l.fight.placeRig('snare', b.x + 3, b.z + 3)).toBe('The kit holds one of each.');
    expect(l.fight.placeRig('plate', b.x, b.z + 3)).toBe('Too close to another rig.');
    expect(l.fight.placeRig('plate', b.x, b.z + 0.5)).toBe('Too close to the beast.');
    expect(l.fight.placeRig('plate', b.x + 9, b.z + 7)).toBe('Too far.');
    expect(l.fight.placeRig('plate', b.x, b.z + 5)).toBeNull();
    expect(l.fight.kit()).toEqual(['lamp', 'channel']);
    expect(l.fight.record.rigsPlaced).toBe(2);
    // Counted from the arena's middle, four blocks south of the den.
    expect(l.fight.record.layout).toEqual(['snare@0,-1', 'plate@0,1']);
    expect(l.fight.takeBack()).toBe(true);
    expect(l.fight.kit()).toEqual(['lamp', 'plate', 'channel']);
    expect(l.fight.record.rigsPlaced).toBe(1);
    expect(lab('hero').fight.placeRig('lamp', 0, 0)).not.toBeNull();
  });

  test('a snare holds the beast that walks onto it and breaks its share of the guard', () => {
    const l = world('thistlehog'), b = l.fight.beasts[0]!;
    l.fight.placeRig('snare', b.x, b.z + 2.5);
    l.fight.wake();
    l.until(() => l.count('rig') > 0, 10);
    expect(b.doing).toBe('held');
    expect(b.guard).toBeCloseTo(b.def.guard * (1 - b.def.rigShare), 1);
    expect(l.fight.record.rigsTriggered).toBe(1);
    const z = b.z;
    l.run(RIG.hold - 0.2);
    expect(b.z).toBe(z);
    l.run(0.4);
    expect(b.doing).not.toBe('held');
  });

  test('a spring plate throws it back', () => {
    const l = world('thistlehog'), b = l.fight.beasts[0]!;
    l.fight.placeRig('plate', b.x, b.z + 2.5);
    l.fight.wake();
    l.until(() => l.count('rig') > 0, 10);
    const z = b.z;
    l.run(RIG.flingTime + 0.1);
    expect(z - b.z).toBeGreaterThan(RIG.fling * 0.8);
    expect(b.doing).toBe('stun');
  });

  test('a lamp draws a charge, and the beast that reaches it is dazzled', () => {
    const l = world('gearling'), b = l.fight.beasts[0]!;
    l.fight.placeRig('lamp', b.x + 2, b.z + 6);
    stand(l, b.x - 8, b.z);
    l.fight.wake();
    l.until(() => l.count('tell') > 0, 5);
    // It aims at the lamp in the south-east, not at the hero in the west.
    expect(b.facing).toBeCloseTo(facingOf(2, 6), 1);
    l.until(() => l.count('rig') > 0, 5);
    expect(l.heard.find((e) => e.type === 'rig')!.text).toBe('lamp');
    expect(b.guard).toBeCloseTo(b.def.guard / 2, 1);
    expect(l.fight.record.hitsTaken).toBe(0);
  });

  test('a thistlehog is not drawn to a lamp', () => {
    const l = world('thistlehog'), b = l.fight.beasts[0]!;
    l.fight.placeRig('lamp', b.x + 4, b.z + 4);
    stand(l, b.x - 4, b.z);
    l.fight.wake();
    l.run(2);
    expect(b.x).toBeLessThan(arenaStage(0, 0).den.x);
  });

  test('a charge that reaches a water channel stalls there, and no beast walks across one', () => {
    const l = world('gearling'), b = l.fight.beasts[0]!;
    expect(l.fight.placeRig('channel', b.x, b.z + 4)).toBeNull();
    // The channel lies east to west, across the way south.
    expect(l.fight.rigs[0]!.alongX).toBe(true);
    l.fight.wake();
    l.until(() => l.count('rig') > 0, 8, () => stand(l, b.x, b.z + 7));
    expect(l.heard.find((e) => e.type === 'rig')!.text).toBe('channel');
    expect(b.z).toBeLessThan(arenaStage(0, 0).den.z + 3.6);
    expect(l.fight.record.hitsTaken).toBe(0);

    const walker = world('thistlehog'), hog = walker.fight.beasts[0]!;
    walker.fight.placeRig('channel', hog.x, hog.z + 3);
    walker.fight.wake();
    let crossed = false;
    walker.run(6, () => {
      stand(walker, hog.x, hog.z + 7);
      walker.fight.hero.health = HERO.health;
      if (Math.abs(hog.x - (arenaStage(0, 0).den.x)) <= 1.5 && Math.abs(hog.z - (arenaStage(0, 0).den.z + 3)) < 0.5) crossed = true;
    });
    expect(crossed).toBe(false);
    expect(walker.fight.record.rigsTriggered).toBe(0);
  });

  test('a charge into the rock wall leaves it helpless and breaks its share of the guard', () => {
    const l = lab('world'), b = l.fight.bring('gearling'), stage = arenaStage(0, 0);
    // The hero stands under the wall, straight north of the den.
    stand(l, b.x, stage.center.z - 8.4);
    l.fight.wake();
    l.until(() => l.count('tell') > 0, 5, () => stand(l, b.x, stage.center.z - 8.4));
    const shape = l.fight.shapes.find((s) => s.live)!;
    expect(shape.end).toBe(1);
    // Steps aside while it winds up.
    l.until(() => l.count('crash') > 0, 5, () => stand(l, b.x + 3, stage.center.z - 8.4));
    expect(l.count('crash')).toBe(1);
    expect(b.doing).toBe('stun');
    expect(b.guard).toBeCloseTo(b.def.guard / 2);
    expect(l.fight.record.crashes).toBe(1);
    expect(l.fight.record.hitsTaken).toBe(0);
  });

  test('a charge stops at the pond and does not crash', () => {
    const l = lab('world'), b = l.fight.bring('gearling'), stage = arenaStage(0, 0);
    // The hero wades in the pond's far side, in reach of a charge from the west bank.
    const far = { x: stage.center.x + 9, z: stage.center.z + 5 };
    b.x = stage.center.x + 0.5;
    b.z = stage.center.z + 5;
    stand(l, far.x, far.z);
    l.fight.wake();
    l.until(() => l.count('stall') > 0, 8, () => stand(l, far.x, far.z));
    expect(l.count('stall')).toBe(1);
    expect(l.count('crash')).toBe(0);
    expect(b.guard).toBe(b.def.guard);
    expect(stage.water(b.x, b.z)).toBe(false);
  });

  test('the companion lures the beast to the spot the hero points at', () => {
    const l = world('thistlehog'), b = l.fight.beasts[0]!;
    l.fight.wake();
    l.run(1);
    l.fight.input.aimX = b.x + 8;
    l.fight.input.aimZ = b.z;
    l.fight.press('skill');
    const x = b.x;
    l.run(2, () => { l.fight.placeHero(b.x - 9, b.z); });
    expect(b.x).toBeGreaterThan(x + 2);
    expect(l.fight.companion.mode).toBe('lure');
    expect(l.fight.record.skills).toBe(1);
  });

  test('F springs the plate by hand when the beast stands beside it', () => {
    const l = world('thistlehog'), b = l.fight.beasts[0]!;
    l.fight.placeRig('plate', b.x + 2, b.z + 2);
    l.fight.wake();
    l.run(1);
    l.fight.press('use');
    l.run(0.1);
    expect(l.count('rig')).toBe(1);
  });
});


// The rule-made players, by the seed of their slips. The perfect one proves every hit can be avoided; the
// middle and clumsy ones measure how hard a fight is (`bun tools/fight-sim.ts` prints the whole table).
function play(foes: string, weapon: WeaponKind, companion: string, level: BotLevel, seed = 1): FightRecord {
  const stage = arenaStage(0, 0);
  const seeded = (n: number) => { let s = n >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const fight = createFight(stage, { way: 'hero', weapon, companion, random: seeded(seed * 7919) });
  const bot = createBot(fight, stage, { level, random: seeded(seed) });
  const [first, second] = foes.split('+') as [string, string | undefined];
  fight.bring(first, second);
  for (let t = 0; t < 300 && fight.phase !== 'won'; t += DT) {
    bot.step(DT);
    fight.step(DT);
    fight.events.length = 0;
  }
  return fight.record;
}

function playTraps(kind: string, layout: 'rigs' | 'wall' = 'rigs'): FightRecord {
  const stage = arenaStage(0, 0);
  const fight = createFight(stage, { way: 'world' });
  const bot = createBot(fight, stage, { layout });
  fight.bring(kind);
  for (let t = 0; t < 240 && fight.phase !== 'won'; t += DT) {
    bot.step(DT);
    fight.step(DT);
    fight.events.length = 0;
  }
  return fight.record;
}

const mean = (list: number[]): number => list.reduce((a, b) => a + b, 0) / list.length;

describe('the perfect player wins every fight with no hit and no faint: every hit can be avoided', () => {
  const foes = [...BEASTS.map((b) => b.kind), 'thistlehog+gearling', 'boar+boar', 'gearling+boar'];
  for (const f of foes) {
    for (const w of WEAPONS) {
      test(`the ${w.kind} and the leaftail against ${f}`, () => {
        const r = play(f, w.kind, 'leaftail', 'perfect');
        expect(r.result).toBe('calmed');
        expect(r.faints).toBe(0);
        expect(r.hitsTaken).toBe(0);
      });
    }
  }
  for (const c of COMPANIONS.slice(1)) {
    test(`the sword and the ${c.kind} against the boar`, () => {
      const r = play('boar', 'sword', c.kind, 'perfect');
      expect(r.result).toBe('calmed');
      expect(r.hitsTaken).toBe(0);
    });
  }
});

describe('the middle player, over eight seeds, with the sword and the leaftail', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const runs = (foes: string) => seeds.map((s) => play(foes, 'sword', 'leaftail', 'middle', s));
  test('the thistlehog in 10 to 20 seconds', () => {
    const t = mean(runs('thistlehog').map((r) => r.length));
    expect(t).toBeGreaterThanOrEqual(10);
    expect(t).toBeLessThanOrEqual(20);
  });
  test('the gearling in 15 to 30 seconds', () => {
    const t = mean(runs('gearling').map((r) => r.length));
    expect(t).toBeGreaterThanOrEqual(15);
    expect(t).toBeLessThanOrEqual(30);
  });
  test('the boar in 60 to 120 seconds, losing between a quarter and two thirds of the health', () => {
    const r = runs('boar');
    for (const one of r) expect(one.result).toBe('calmed');
    const t = mean(r.map((one) => one.length)), lost = mean(r.map((one) => one.healthLost));
    expect(t).toBeGreaterThanOrEqual(60);
    expect(t).toBeLessThanOrEqual(120);
    expect(lost).toBeGreaterThanOrEqual(20);
    expect(lost).toBeLessThanOrEqual(66);
  });
  test('against the boar no weapon and no companion is more than a third faster or slower than the others', () => {
    const times = [
      ...WEAPONS.map((w) => mean(seeds.map((s) => play('boar', w.kind, 'leaftail', 'middle', s).length))),
      ...COMPANIONS.slice(1).map((c) => mean(seeds.map((s) => play('boar', 'sword', c.kind, 'middle', s).length))),
    ];
    expect(Math.max(...times) / Math.min(...times)).toBeLessThan(4 / 3 + 0.05);
  });
});

test('the clumsy player faints against the boar in some fights and not in others, and still wins in under four minutes', () => {
  const r = Array.from({ length: 20 }, (_, i) => play('boar', 'sword', 'leaftail', 'clumsy', i + 1));
  const fainted = r.filter((one) => one.faints > 0).length;
  expect(fainted).toBeGreaterThanOrEqual(2);
  expect(fainted).toBeLessThanOrEqual(10);
  for (const one of r) { expect(one.result).toBe('calmed'); expect(one.length).toBeLessThan(240); }
});

describe('the traps play as they did', () => {
  // A rooted beast cannot be baited into a rig: the traps are for the lab's three.
  for (const beast of BEASTS.filter((b) => !b.rooted)) {
    test(`with rigs against the ${beast.kind}`, () => {
      const r = playTraps(beast.kind);
      expect(r.result).toBe('calmed');
      expect(r.faints).toBe(0);
      expect(r.length).toBeLessThan(beast.kind === 'boar' ? 180 : 20);
      expect(r.rigsTriggered / r.rigsPlaced).toBeGreaterThanOrEqual(0.6);
    });
  }

  test('the boar falls to a second layout: no rigs, three charges into trees and the wall', () => {
    const r = playTraps('boar', 'wall');
    expect(r.result).toBe('calmed');
    expect(r.rigsPlaced).toBe(0);
    expect(r.crashes).toBe(3);
    expect(r.length).toBeLessThan(180);
  });
});

test('every beast has a guard its parts divide, and attacks that reach', () => {
  for (const b of BEASTS) {
    expect(beastOf(b.kind)).toBe(b);
    expect(b.guard % b.segments).toBe(0);
    for (const a of b.attacks) {
      expect(a.lead).toBeGreaterThanOrEqual(0.6);
      expect(a.to).toBeGreaterThan(a.from);
      if (a.then) expect(b.attacks.some((other) => other.id === a.then)).toBe(true);
      if (a.rageThen) expect(b.attacks.some((other) => other.id === a.rageThen && other.follows)).toBe(true);
    }
  }
  expect(() => beastOf('dragon')).toThrow();
});

test('every weapon has a quick move and a held move, and only the held one is held', () => {
  for (const w of WEAPONS) {
    expect(w.quick.hold).toBe(0);
    expect(w.held.hold).toBeGreaterThan(0);
    expect(w.quick.startup).toBeLessThan(w.quick.total);
    expect(w.held.startup).toBeLessThan(w.held.total);
  }
  expect(WEAPONS.map((w) => w.kind)).toEqual(['sword', 'bow', 'staff']);
});
