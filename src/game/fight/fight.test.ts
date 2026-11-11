import { describe, expect, test } from 'bun:test';
import { BEASTS, GENTLE, HERO, RIG, WAYS, beastOf, type Way } from '../content/fight.ts';
import { ARENA, arenaStage, pondCells } from './arena.sim.ts';
import { createBot } from './bot.sim.ts';
import { createFight, type BeastState, type Fight, type FightEvent, type FightOptions, type FightRecord } from './fight.sim.ts';
import { dirX, dirZ, facingOf, inCircle, inCone, inLine, turnBetween } from './shapes.sim.ts';

const DT = 1 / 60;

interface Lab {
  fight: Fight;
  /** Every event since the lab was made, in order. */
  heard: FightEvent[];
  ended: FightRecord[];
  /** Steps the fight for this many seconds. `each` runs before every step. */
  run(seconds: number, each?: () => void): void;
  /** Steps until `done` is true. False when `limit` seconds passed first. */
  until(done: () => boolean, limit?: number, each?: () => void): boolean;
  count(type: FightEvent['type']): number;
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
  l.until(() => b.doing === 'dizzy', 60, () => {
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

describe('the rules every way shares', () => {
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
    expect(b.guard).toBeCloseTo(b.def.guard / 3);
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
    expect(l.heard.some((e) => e.type === 'denied' && e.text.includes('Mark'))).toBe(true);
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

describe('the hero fights', () => {
  test('a cut lands a tenth of a second after the press, on a beast in its arc', () => {
    const l = lab('hero'), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 2);
    l.fight.press('attack');
    l.run(HERO.cut.startup - 0.03);
    expect(b.guard).toBe(b.def.guard);
    l.run(0.06);
    expect(b.guard).toBe(b.def.guard - HERO.cut.guard);
    expect(l.fight.record.swings).toBe(1);
    expect(l.fight.record.whiffs).toBe(0);
  });

  test('a cut pushes a thistlehog 0.4 blocks away, and the gearling and the boar not until their guard is empty', () => {
    const small = lab('hero'), hog = small.fight.bring('thistlehog'), from = hog.z;
    stand(small, hog.x, hog.z + 2);
    small.fight.press('attack');
    small.run(HERO.cut.startup + HERO.cut.pushTime + 0.05);
    // Away from the hero, who stands to the south: north is -z. It is still waking, so it does not walk.
    expect(hog.doing).toBe('alert');
    expect(from - hog.z).toBeCloseTo(HERO.cut.push, 2);
    expect(hog.x).toBeCloseTo(small.fight.beasts[0]!.x);

    for (const kind of ['gearling', 'boar']) {
      const l = lab('hero'), b = l.fight.bring(kind), at = { x: b.x, z: b.z };
      stand(l, b.x, b.z + b.def.radius + 1.2);
      l.fight.press('attack');
      l.run(HERO.cut.startup + HERO.cut.pushTime + 0.05);
      expect(b.guard).toBeLessThan(b.def.guard);
      expect(Math.hypot(b.x - at.x, b.z - at.z)).toBe(0);
      cutDown(l);
      expect(b.doing).toBe('dizzy');
      const z = b.z;
      stand(l, b.x, b.z + b.def.radius + 1.2);
      l.fight.press('attack');
      l.run(HERO.cut.startup + HERO.cut.pushTime + 0.05);
      expect(z - b.z).toBeCloseTo(HERO.cut.push, 2);
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
    l.run(HERO.spin.hold + 0.1);
    expect(l.count('charged')).toBe(1);
    const before = b.guard;
    l.fight.input.attackHeld = false;
    l.run(0.2);
    expect(before - b.guard).toBe(HERO.spin.guard);
    expect(l.fight.record.swings).toBe(2);
  });

  test('a spin pushes a thistlehog 2 blocks away over a quarter second, and the boar only once its guard is empty', () => {
    /** Charges a spin from the north of the beast, lets it go, and returns how far south it went. */
    const spinAt = (l: Lab, b: BeastState): number => {
      stand(l, b.x, b.z - b.def.radius - 1.2);
      l.fight.press('attack');
      l.fight.input.attackHeld = true;
      l.run(HERO.spin.hold + 0.1);
      const from = b.z;
      l.fight.input.attackHeld = false;
      l.run(HERO.spin.startup + HERO.spin.pushTime + 0.05);
      expect(l.count('hit')).toBeGreaterThanOrEqual(2);
      return b.z - from;
    };
    const small = lab('hero'), hog = small.fight.bring('thistlehog');
    cutDown(small);
    expect(spinAt(small, hog)).toBeCloseTo(HERO.spin.push, 2);

    const big = lab('hero'), boar = big.fight.bring('boar');
    expect(Math.abs(spinAt(big, boar))).toBeLessThan(0.05);
    cutDown(big);
    expect(boar.doing).toBe('dizzy');
    expect(spinAt(big, boar)).toBeCloseTo(HERO.spin.push, 2);
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

  test('the pet goes for the beast the hero hit, and takes no hurt from its ring', () => {
    const l = lab('hero'), b = l.fight.bring('boar');
    stand(l, b.x, b.z + b.def.radius + 1.5);
    l.fight.press('attack');
    l.run(4, () => { l.fight.hero.health = HERO.health; });
    expect(l.fight.pet.mode === 'engage' || l.count('petStrike') > 0).toBe(true);
    l.run(20, () => { l.fight.hero.health = HERO.health; });
    expect(l.count('petStrike')).toBeGreaterThan(2);
    expect(l.fight.record.petHits).toBe(0);
  });
});

describe('the pet fights', () => {
  test('a click on a beast sends the pet, and it is there within two seconds', () => {
    const l = lab('pet'), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 9);
    l.fight.press('attack');
    l.until(() => l.count('petStrike') > 0, 5);
    expect(l.fight.record.orders).toBe(1);
    expect(l.fight.record.ordersInTime).toBe(1);
    expect(l.fight.record.slowestOrder).toBeLessThan(2);
    expect(b.guard).toBeLessThan(b.def.guard);
  });

  test('an order the hero whistles back before the pet gets there is not counted, and the next one is', () => {
    const l = lab('pet'), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 9);
    l.fight.press('attack');
    l.run(0.5);
    expect(l.fight.record.orders).toBe(1);
    l.fight.press('whistle');
    l.run(0.1);
    expect(l.fight.record.orders).toBe(0);
    // It goes back in by itself, which is no new order. A new click once it is at heel is one.
    l.until(() => l.fight.pet.mode === 'heel' || l.fight.pet.mode === 'engage', 5);
    l.fight.press('whistle');
    l.until(() => l.fight.pet.mode === 'heel', 5);
    l.run(0.5);
    l.fight.press('attack');
    l.until(() => l.count('petStrike') > 0, 5);
    expect(l.fight.record.orders).toBe(1);
    expect(l.fight.record.ordersInTime).toBe(1);
  });

  test('thrown light chips the guard and marks the beast, and the next strike spends the marks', () => {
    const l = lab('pet'), b = l.fight.bring('boar');
    stand(l, b.x, b.z + 8);
    // Three throws with the pet held back.
    l.fight.press('whistle');
    l.run(0.4);
    l.fight.input.aimX = b.x;
    l.fight.input.aimZ = b.z + b.def.radius + 2;
    // The pointer is short of the beast, so these are throws and not orders.
    for (let i = 0; i < 3; i++) { l.fight.press('attack'); l.run(HERO.bolt.rest + 0.1, () => l.fight.placeHero(b.x, b.z + 8)); }
    l.run(0.3);
    expect(l.fight.record.throws).toBe(3);
    expect(l.fight.record.throwHits).toBe(3);
    expect(b.marks).toBe(3);
    expect(b.guard).toBe(b.def.guard - 3 * HERO.bolt.guard);
    const before = b.guard;
    l.fight.input.aimZ = b.z;
    l.fight.press('attack');
    l.until(() => l.count('petStrike') > 0, 5, () => { l.fight.hero.health = HERO.health; });
    const strike = l.fight.pet.def.strike * (1 + 0.5 * 3);
    // The fourth throw may land before or after the strike: either way the strike spent three marks.
    expect(before - b.guard).toBeGreaterThanOrEqual(strike);
    expect(before - b.guard).toBeLessThanOrEqual(strike + HERO.bolt.guard);
  });

  test('a pet left in the shape is hurt, and one whistled out is not and goes back in by itself', () => {
    const left = lab('pet'), b = left.fight.bring('thistlehog');
    stand(left, b.x, b.z + 9);
    left.fight.press('attack');
    left.until(() => left.count('strike') > 0, 20, () => stand(left, b.x, b.z + 9));
    expect(left.fight.record.petHits).toBe(1);
    expect(left.fight.pet.hearts).toBe(left.fight.pet.def.hearts - 1);

    const called = lab('pet'), b2 = called.fight.bring('thistlehog');
    stand(called, b2.x, b2.z + 9);
    called.fight.press('attack');
    let whistled = false;
    called.until(() => called.count('strike') > 0, 20, () => {
      stand(called, b2.x, b2.z + 9);
      if (!whistled && called.count('tell') > 0) { whistled = true; called.fight.press('whistle'); }
    });
    expect(called.fight.record.petHits).toBe(0);
    expect(called.fight.record.whistles).toBe(1);
    const strikes = called.count('petStrike');
    called.run(2.5, () => stand(called, b2.x, b2.z + 9));
    expect(called.count('petStrike')).toBeGreaterThan(strikes);
    expect(called.fight.record.orders).toBe(1);
  });

  test('a pet that runs out of hearts faints, rests and comes back whole', () => {
    const l = lab('pet'), b = l.fight.bring('boar'), pet = l.fight.pet;
    stand(l, b.x + 12, b.z);
    l.fight.press('attack');
    l.until(() => l.count('petFaint') > 0, 120, () => {
      stand(l, b.x + 12, b.z);
      // The boar never tires here, so the pet is sure to be caught.
      b.guard = b.def.guard;
      if (pet.mode === 'heel') l.fight.press('attack');
    });
    expect(l.fight.record.petFaints).toBe(1);
    expect(l.fight.record.petHits).toBe(pet.def.hearts);
    expect(pet.mode).toBe('down');
    l.run(pet.def.rest + 0.2, () => { b.guard = b.def.guard; });
    expect(pet.mode).not.toBe('down');
    expect(pet.hearts).toBe(pet.def.hearts);
    expect(l.count('petUp')).toBe(1);
  });

  test('the hero carries no weapon: a click cuts nothing', () => {
    const l = lab('pet'), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 1.5);
    l.fight.press('attack');
    l.run(0.3);
    expect(l.fight.record.swings).toBe(0);
    expect(l.fight.record.throws).toBe(1);
  });

  test('pounce is called off its rest and then has to rest', () => {
    const l = lab('pet'), b = l.fight.bring('boar');
    stand(l, b.x + 10, b.z);
    l.fight.press('attack');
    l.run(0.5);
    const before = b.guard;
    l.fight.press('skill1');
    l.until(() => before - b.guard >= l.fight.pet.def.skills[0].guard, 3);
    expect(before - b.guard).toBeGreaterThanOrEqual(l.fight.pet.def.skills[0].guard);
    expect(l.fight.skill(0)!.left).toBeGreaterThan(0);
    l.fight.press('skill1');
    l.run(0.1);
    expect(l.fight.record.skills).toBe(1);
  });

  test('a braced pebblepup takes the attack on its back and the beast staggers', () => {
    const l = lab('pet', { pet: 'pebblepup' }), b = l.fight.bring('thistlehog');
    stand(l, b.x, b.z + 1.8);
    l.until(() => l.count('tell') > 0, 20, () => stand(l, b.x, b.z + 1.8));
    l.fight.press('skill1');
    l.until(() => l.count('strike') > 0, 5, () => stand(l, b.x, b.z + 1.8));
    expect(l.count('blocked')).toBe(1);
    expect(l.fight.record.hitsTaken).toBe(0);
    expect(l.fight.record.petHits).toBe(0);
    expect(b.guard).toBe(b.def.guard - l.fight.pet.def.skills[0].guard);
    expect(b.doing).toBe('stun');
  });
});

describe('the world fights', () => {
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

  test('the pet lures the beast to the spot the hero points at', () => {
    const l = world('thistlehog'), b = l.fight.beasts[0]!;
    l.fight.wake();
    l.run(1);
    l.fight.input.aimX = b.x + 8;
    l.fight.input.aimZ = b.z;
    l.fight.press('skill1');
    const x = b.x;
    l.run(2, () => { l.fight.placeHero(b.x - 9, b.z); });
    expect(b.x).toBeGreaterThan(x + 2);
    expect(l.fight.pet.mode).toBe('lure');
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

describe('a bot wins every fight', () => {
  function play(way: Way, kind: string, layout: 'rigs' | 'wall' = 'rigs'): FightRecord {
    const stage = arenaStage(0, 0);
    const fight = createFight(stage, { way });
    const bot = createBot(fight, stage, { layout });
    fight.bring(kind);
    for (let t = 0; t < 240 && fight.phase !== 'won'; t += DT) {
      bot.step(DT);
      fight.step(DT);
      fight.events.length = 0;
    }
    return fight.record;
  }

  for (const way of WAYS) {
    for (const beast of BEASTS) {
      test(`${way} against the ${beast.kind}`, () => {
        const r = play(way, beast.kind);
        expect(r.result).toBe('calmed');
        expect(r.faints).toBe(0);
        // The boar in under three minutes, a small beast in a few seconds.
        expect(r.length).toBeLessThan(beast.kind === 'boar' ? 180 : 20);
        if (way === 'hero') expect(r.whiffs / r.swings).toBeLessThan(0.25);
        if (way === 'pet') {
          expect(r.inputs / r.length * 10).toBeGreaterThanOrEqual(6);
          expect(r.longestGap).toBeLessThanOrEqual(3);
          expect(r.ordersInTime).toBe(r.orders);
          expect(r.petFaints).toBeLessThanOrEqual(1);
        }
        if (way === 'world') expect(r.rigsTriggered / r.rigsPlaced).toBeGreaterThanOrEqual(0.6);
      });
    }
  }

  test('the hero calms a thistlehog in 4 to 8 seconds', () => {
    const r = play('hero', 'thistlehog');
    expect(r.length).toBeGreaterThanOrEqual(4);
    expect(r.length).toBeLessThanOrEqual(8);
  });

  test('the boar falls to a second layout: no rigs, three charges into trees and the wall', () => {
    const r = play('world', 'boar', 'wall');
    expect(r.result).toBe('calmed');
    expect(r.rigsPlaced).toBe(0);
    expect(r.crashes).toBe(3);
    expect(r.length).toBeLessThan(180);
  });

  test('the whistle is used against the boar', () => {
    expect(play('pet', 'boar').whistles).toBeGreaterThan(0);
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
    }
  }
  expect(() => beastOf('dragon')).toThrow();
});
