import { describe, expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { createBus, type GameEvent } from '../../engine/events.ts';
import { HERO_STEP, HeroBody, type BlockSource, type HeroInput } from './hero.sim.ts';

const STONE = blockId('stone'), GRASS = blockId('grass'), PLANK = blockId('oak_plank'), WATER = blockId('water');

/**
 * A small test land. The floor's top is at y = 10: grass, with planks where x < 0.
 * A stone wall three blocks high stands at x = 5. A single stone step is at x = -5.
 * A pool of water two blocks deep fills z >= 20, with a bank at z >= 30.
 */
const land: BlockSource = {
  getBlock(x, y, z) {
    if (z >= 20 && z < 30) return y < 8 ? STONE : y < 10 ? WATER : 0;
    if (y < 9) return STONE;
    if (y === 9) return x < 0 ? PLANK : GRASS;
    if (x === 5 && y < 13) return STONE;
    if (x === -5 && y === 10) return STONE;
    return 0;
  },
};

const still: HeroInput = { moveX: 0, moveZ: 0, jump: false };

function run(body: HeroBody, seconds: number, input: HeroInput = still): void {
  for (let i = 0; i < Math.round(seconds / HERO_STEP); i++) body.step(input);
}

function heroAt(x: number, y: number, z: number): { body: HeroBody; events: GameEvent[] } {
  const bus = createBus<GameEvent>();
  const events: GameEvent[] = [];
  bus.on((e) => events.push(e));
  return { body: new HeroBody(land, { x, y, z }, bus), events };
}

describe('the hero body', () => {
  test('falls and lands on the floor, and says so once', () => {
    const { body, events } = heroAt(2.5, 14, 2.5);
    run(body, 2);
    expect(body.y).toBe(10);
    expect(body.grounded).toBe(true);
    expect(body.vy).toBe(0);
    expect(events).toEqual([{ type: 'land', surface: 'grass', at: { x: 2.5, y: 10, z: 2.5 } }]);
  });

  test('walks at walking speed and stops at a wall', () => {
    const { body } = heroAt(1.5, 10, 2.5);
    run(body, 0.5);
    const from = body.x;
    run(body, 0.5, { moveX: 1, moveZ: 0, jump: false });
    expect(body.x - from).toBeGreaterThan(1.6);
    expect(body.x - from).toBeLessThan(2.2);
    run(body, 3, { moveX: 1, moveZ: 0, jump: false });
    // The wall's near face is at x = 5 and the body is 0.3 wide on each side.
    expect(body.x).toBeCloseTo(4.7, 3);
    expect(body.vx).toBe(0);
    expect(body.y).toBe(10);
  });

  test('slides along a wall when pushed into it at an angle', () => {
    const { body } = heroAt(4.5, 10, 2.5);
    run(body, 2, { moveX: 1, moveZ: 1, jump: false });
    expect(body.x).toBeCloseTo(4.7, 3);
    expect(body.z).toBeGreaterThan(6);
  });

  test('a diagonal is no faster than a straight line', () => {
    const a = heroAt(0.5, 10, 0.5).body, b = heroAt(0.5, 10, 0.5).body;
    run(a, 1, { moveX: 0, moveZ: 1, jump: false });
    run(b, 1, { moveX: -1, moveZ: 1, jump: false });
    expect(Math.hypot(b.x - 0.5, b.z - 0.5)).toBeCloseTo(a.z - 0.5, 3);
  });

  test('jumps onto one block, and not over a wall of three', () => {
    const { body, events } = heroAt(-3.5, 10, 2.5);
    run(body, 0.2);
    run(body, 1.5, { moveX: -1, moveZ: 0, jump: true });
    expect(events.some((e) => e.type === 'jump')).toBe(true);
    expect(body.x).toBeLessThan(-4.5);

    const high = heroAt(3.5, 10, 2.5).body;
    let top = 0;
    for (let i = 0; i < 180; i++) { high.step({ moveX: 1, moveZ: 0, jump: true }); top = Math.max(top, high.y); }
    expect(high.x).toBeLessThan(4.71);
    expect(top - 10).toBeGreaterThan(1.1);
    expect(top - 10).toBeLessThan(1.6);
  });

  test('bumps its head and does not pass through a ceiling', () => {
    const roofed: BlockSource = { getBlock: (_x, y) => (y < 10 || y === 12 ? STONE : 0) };
    const body = new HeroBody(roofed, { x: 0.5, y: 10, z: 0.5 });
    let top = 0;
    for (let i = 0; i < 120; i++) { body.step({ moveX: 0, moveZ: 0, jump: true }); top = Math.max(top, body.y); }
    expect(top + body.tuning.tall).toBeLessThanOrEqual(12);
    expect(top).toBeGreaterThan(10.1);
  });

  test('footsteps carry the surface underfoot and come once per stride', () => {
    const { body, events } = heroAt(2.5, 10, 2.5);
    run(body, 0.3);
    events.length = 0;
    run(body, 2, { moveX: -1, moveZ: 0, jump: false });
    const steps = events.filter((e) => e.type === 'footstep');
    const walked = 2.5 - body.x;
    expect(walked).toBeGreaterThan(6);
    expect(Math.abs(steps.length - walked / body.tuning.stride)).toBeLessThan(1);
    expect(steps[0]).toMatchObject({ type: 'footstep', surface: 'grass' });
    expect(steps.at(-1)).toMatchObject({ type: 'footstep', surface: 'wood' });
    expect(events.every((e) => e.type === 'footstep')).toBe(true);
  });

  test('floats in water, swims, and climbs out onto the bank', () => {
    const { body, events } = heroAt(2.5, 13, 24.5);
    run(body, 3);
    expect(body.swimming).toBe(true);
    expect(events[0]).toMatchObject({ type: 'land', surface: 'water' });
    // It settles with its feet under the surface (y = 10) and well above the bottom (y = 8).
    expect(body.y).toBeGreaterThan(8.6);
    expect(body.y).toBeLessThan(9.7);

    const from = body.z;
    run(body, 1, { moveX: 0, moveZ: 1, jump: false });
    expect(body.z - from).toBeGreaterThan(1.2);
    expect(body.z - from).toBeLessThan(2.6);
    expect(events.some((e) => e.type === 'footstep' && e.surface === 'water')).toBe(true);

    run(body, 5, { moveX: 0, moveZ: 1, jump: false });
    expect(body.swimming).toBe(false);
    expect(body.z).toBeGreaterThan(30.3);
    expect(body.y).toBe(10);
  });

  test('waits where the land has not loaded', () => {
    const body = new HeroBody({ getBlock: () => 0, isLoaded: () => false }, { x: 0.5, y: 30, z: 0.5 });
    run(body, 1, { moveX: 1, moveZ: 0, jump: false });
    expect([body.x, body.y, body.z]).toEqual([0.5, 30, 0.5]);
  });
});
