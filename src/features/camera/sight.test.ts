import { describe, expect, test } from 'bun:test';
import { SightRule, under, type Roof } from './sight.sim.ts';

/** A rule with the hero's feet at the origin and the lens 30 blocks up and back to the south-east, as the game's camera stands. */
function rule(roofs: Roof[] = [], seconds = 2): SightRule {
  const r = new SightRule();
  r.clear();
  r.keep(0, 0, 0);
  for (let t = 0; t < seconds; t += 0.05) r.update(0.05, 12, 20, 12, 0, 0, 0, roofs);
  return r;
}

describe('the sight rule', () => {
  test('cuts what stands on the line from the lens to the hero, and nothing beside it or behind the hero', () => {
    const r = rule();
    // Halfway to the lens, on the line to the chest: a wall or a wheel there is cut.
    expect(r.cuts(6, 10.55, 6)).toBe(1);
    // Well off the line, and behind the hero: kept.
    expect(r.cuts(6, 10.55, -2)).toBe(0);
    expect(r.cuts(-3, 1.5, -3)).toBe(0);
  });

  test('never cuts the floor the hero stands on, nor what the hero holds', () => {
    const r = rule();
    expect(r.cuts(0.6, 0.2, 0.6)).toBe(0);
    expect(r.cuts(0.3, 1.3, 0.3)).toBe(0);
  });

  test('a crown by the lens fades out, and the hole through leaves is wider', () => {
    const r = rule();
    expect(r.cuts(11, 18.5, 8, true)).toBe(1);
    expect(r.cuts(11, 18.5, 8, false)).toBeLessThan(0.5);
    // Off the line by two and a half blocks: a solid thing stays, a leaf goes.
    expect(r.cuts(6.56, 8.54, 2.88, false)).toBe(0);
    expect(r.cuts(6.56, 8.54, 2.88, true)).toBeGreaterThan(0.5);
  });

  test('keeps as many points as the level allows, the hero first, and one body once', () => {
    const r = new SightRule();
    r.setMost(2);
    r.clear();
    expect(r.keep(0, 0, 0)).toBe(true);
    expect(r.keep(0.1, 0, 0.1)).toBe(true);
    expect(r.keep(5, 0, 5)).toBe(true);
    expect(r.keep(9, 0, 9)).toBe(false);
    expect(Array.from(r.state.points.slice(0, 8))).toEqual([0, 1.1, 0, 1.8, 5, 1.1, 5, 1.8].map(Math.fround));
  });

  test('under a roof everything above the walls opens like an iris round the hero, and closes outside', () => {
    const roof: Roof = { x0: -4, z0: -4, x1: 4, z1: 4, floor: 0, eaves: 5 };
    expect(under([roof], 0, 0, 0)).toBe(roof);
    expect(under([roof], 0, 6, 0)).toBe(null);
    const inside = rule([roof]);
    expect(inside.state.room.radius).toBeGreaterThan(8.9);
    // The roof straight over the hero, and a beam over the far wall: both lifted. The floor is not.
    expect(inside.cuts(0, 5.5, 0)).toBe(1);
    expect(inside.cuts(-3, 4, -3)).toBe(1);
    expect(inside.cuts(-3, 0.5, -3)).toBe(0);
    const outside = rule([{ ...roof, x0: 10, x1: 20 }]);
    expect(outside.state.room.radius).toBe(0);
    expect(outside.cuts(-3, 4, -3)).toBe(0);
  });
});

// The game's camera: 34 blocks from the hero, looking down at 35 degrees, from the south.
const EYE = { x: 0, y: 19.5, z: 27.85 };
/** A point `along` blocks from the hero's chest toward the lens, then `aside` blocks to the east. */
function between(rule: SightRule, along: number, aside: number): [number, number, number] {
  const chest = rule.options.chest, len = Math.hypot(EYE.y - chest, EYE.z);
  return [aside, chest + ((EYE.y - chest) / len) * along, (EYE.z / len) * along];
}
function frame(rule: SightRule, grove: number, seconds: number): void {
  for (let t = 0; t < seconds; t += 0.1) {
    rule.clear();
    rule.keep(0, 0, 0);
    rule.underGrove(grove);
    rule.update(0.1, EYE.x, EYE.y, EYE.z, 0, 0, 0, []);
  }
}

describe('the sight rule under a grove', () => {
  test('cuts the crowns across most of the picture and the wood above the trunks\' feet, keeps the edges', () => {
    const rule = new SightRule();
    rule.setGroveWidth(0.24);
    frame(rule, 0, 1);
    // In the open, a crown five blocks beside the hero's line stands.
    expect(rule.cuts(...between(rule, 10, 5), true)).toBe(0);
    frame(rule, 1, 3);
    expect(rule.state.grove).toBeGreaterThan(7.5);
    // Under the grove it is gone, and so is a bough there; a crown at the picture's edge frames it.
    expect(rule.cuts(...between(rule, 10, 5), true)).toBeGreaterThan(0.95);
    expect(rule.cuts(...between(rule, 10, 5), false, true)).toBeGreaterThan(0.95);
    // A giant's foot beside the hero stays: two blocks up its trunk, five blocks aside.
    expect(rule.cuts(5, 2, 1, false, true)).toBe(0);
    expect(rule.cuts(...between(rule, 10, 11), true)).toBe(0);
    // Behind the hero nothing is cut: those crowns are the top of the picture.
    expect(rule.cuts(...between(rule, -6, 0), true)).toBe(0);
  });

  test('closes again over a moment when the hero walks out', () => {
    const rule = new SightRule();
    rule.setGroveWidth(0.24);
    frame(rule, 1, 3);
    frame(rule, 0, 3);
    expect(rule.state.grove).toBe(0);
    expect(rule.cuts(...between(rule, 10, 5), true)).toBe(0);
  });
});

test('grove wood keeps its narrow near-lens transition and stops cutting after leaving', () => {
  const rule = new SightRule();
  rule.setGroveWidth(0.24);
  frame(rule, 1, 3);
  const d = rule.state.near.end - 0.5;
  // Off the actor's ray: only the near-lens rule cuts this surface.
  expect(rule.cuts(EYE.x + d, EYE.y, EYE.z, false, true)).toBeCloseTo(0.5, 5);
  expect(rule.cuts(EYE.x + d, EYE.y, EYE.z, true)).toBeLessThan(0.2);
  frame(rule, 0, 3);
  expect(rule.cuts(EYE.x + d, EYE.y, EYE.z, false, true)).toBe(0);
});


test('clears the measured grove root beside the lower body while keeping its floor and nearby masonry', () => {
  const r = new SightRule();
  r.keep(-310.1003574139978, 20, -205.05127663405602);
  r.update(1, -290.4066065924525, 40.50159883593557, -185.35752581251066, -310.1003574139978, 20, -205.05127663405602, []);
  // Actual ray intersections from the normal-HUD grove-entry reproduction.
  for (const p of [[-310.227285, 20.486042, -204.755756], [-310.000708, 20.501713, -204.951627], [-309.799615, 20.49143, -205.172869]]) {
    expect(r.cuts(p[0]!, p[1]!, p[2]!, false, true)).toBe(1);
    expect(r.cuts(p[0]!, p[1]!, p[2]!)).toBe(0);
  }
  expect(r.cuts(-310.1, 20.2, -205.05, false, true)).toBe(0);
});

test('masonry preserves scenery outside its narrower actor clearance', () => {
  const r = new SightRule();
  r.keep(0, 0, 0); r.update(1, 0, 1.1, 10, 0, 0, 0, []);
  expect(r.cuts(0, 1.1, 3)).toBe(1);
  expect(r.cuts(1.4, 1.1, 3)).toBe(0);
  expect(r.cuts(1.4, 1.1, 3, false, true)).toBeGreaterThan(0.5);
});
