import { describe, expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { CameraRig } from './rig.sim.ts';
import { CutawayRule, type BlockProbe } from './cutaway.sim.ts';

const STONE = blockId('stone'), THATCH = blockId('thatch'), LEAVES = blockId('oak_leaves'), PLASTER = blockId('plaster');
const DT = 1 / 60;

function run(rig: CameraRig, seconds: number, x = 0, y = 0, z = 0): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) rig.update(DT, x, y, z);
}

describe('the camera rig', () => {
  test('looks down at 35 degrees from the zoom distance', () => {
    const rig = new CameraRig();
    run(rig, 1, 10, 20, 30);
    const dx = rig.position.x - rig.look.x, dy = rig.position.y - rig.look.y, dz = rig.position.z - rig.look.z;
    expect((Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI).toBeCloseTo(35, 5);
    expect(Math.hypot(dx, dy, dz)).toBeCloseTo(rig.options.distances[1], 3);
    expect([rig.look.x, rig.look.z]).toEqual([10, 30]);
    expect(rig.look.y).toBeCloseTo(21, 5);
  });

  test('a quarter turn takes 0.3 seconds and lands exactly', () => {
    const rig = new CameraRig({ baseYaw: 0 });
    run(rig, 0.1);
    rig.turn(1);
    expect(rig.quarter).toBe(3);
    expect(rig.turning).toBe(true);
    run(rig, 0.15);
    expect(rig.yaw).toBeCloseTo(-Math.PI / 4, 2);
    run(rig, 0.14);
    expect(rig.turning).toBe(true);
    run(rig, 0.02);
    expect(rig.turning).toBe(false);
    expect(rig.yaw).toBeCloseTo(-Math.PI / 2, 10);
    // Yaw -90 degrees: the camera stands west of the target and looks east.
    expect(rig.position.x).toBeLessThan(-30);
    expect(rig.position.z).toBeCloseTo(0, 5);
  });

  test('four turns one way come back to the start, and the two ways undo each other', () => {
    const rig = new CameraRig();
    const start = rig.yaw;
    for (let i = 0; i < 4; i++) { rig.turn(-1); run(rig, 0.4); expect(rig.quarter).toBe((i + 1) % 4); }
    expect(rig.yaw).toBeCloseTo(start, 10);
    rig.turn(1); rig.turn(-1);
    run(rig, 0.4);
    expect(rig.quarter).toBe(0);
    expect(rig.yaw).toBeCloseTo(start, 10);
  });

  test('a turn pressed during a turn carries on from where the camera is', () => {
    const rig = new CameraRig({ baseYaw: 0 });
    rig.turn(-1);
    run(rig, 0.15);
    const mid = rig.yaw;
    rig.turn(-1);
    rig.update(DT, 0, 0, 0);
    expect(Math.abs(rig.yaw - mid)).toBeLessThan(0.05);
    run(rig, 0.3);
    expect(Math.abs(rig.yaw)).toBeCloseTo(Math.PI, 5);
    expect(rig.quarter).toBe(2);
  });

  test('zoom has three steps and stops at the ends', () => {
    const rig = new CameraRig();
    expect(rig.zoom).toBe(1);
    rig.zoomBy(1); rig.zoomBy(5);
    expect(rig.zoom).toBe(2);
    run(rig, 2);
    expect(rig.distance).toBeCloseTo(rig.options.distances[2], 2);
    rig.zoomBy(-1); rig.zoomBy(-1); rig.zoomBy(-1);
    expect(rig.zoom).toBe(0);
    run(rig, 2);
    expect(rig.distance).toBeCloseTo(rig.options.distances[0], 2);
  });

  test('follows a moving target smoothly and catches up when it stops', () => {
    const rig = new CameraRig();
    run(rig, 0.1);
    let last = rig.look.x, biggest = 0;
    for (let i = 0; i < 120; i++) {
      rig.update(DT, (i + 1) * DT * 4.4, 0, 0);
      biggest = Math.max(biggest, rig.look.x - last);
      last = rig.look.x;
    }
    // It never moves faster than the target does in one frame, and it trails by about half a block.
    expect(biggest).toBeLessThanOrEqual(4.4 * DT + 1e-9);
    expect(8.8 - rig.look.x).toBeGreaterThan(0.2);
    expect(8.8 - rig.look.x).toBeLessThan(0.8);
    run(rig, 1.5, 8.8, 0, 0);
    expect(rig.look.x).toBeCloseTo(8.8, 3);
  });
});

/**
 * A test land with the floor's top at y = 10.
 * A thatch roof at y = 13 covers x and z from 0 to 6, on plaster walls.
 * A hill of stone, 8 blocks thick, covers x from 20 to 30 above a tunnel two blocks high.
 * A tree canopy hangs at y = 14 over x from 40 to 44.
 */
const land: BlockProbe = {
  getBlock(x, y, z) {
    if (y < 10) return STONE;
    if (x >= 0 && x <= 6 && z >= 0 && z <= 6) {
      if (y === 13) return THATCH;
      if (y < 13 && (x === 0 || x === 6 || z === 0 || z === 6)) return PLASTER;
    }
    if (x >= 20 && x <= 30 && y >= 12 && y < 20) return STONE;
    if (x >= 40 && x <= 44 && y === 14) return LEAVES;
    return 0;
  },
};

function settle(rule: CutawayRule, x: number, y: number, z: number, seconds = 2): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) rule.update(DT, land, x, y, z, x + 40, y + 40, z + 40);
}

describe('the cutaway', () => {
  test('is closed under the open sky, and the sight tunnel is always on', () => {
    const rule = new CutawayRule();
    settle(rule, 12.5, 10, 3.5);
    expect(rule.state.mode).toBe('open');
    expect(rule.state.radius).toBe(0);
    expect(rule.state.sightRadius).toBeGreaterThan(1);
    expect([rule.state.sightX, rule.state.sightY, rule.state.sightZ]).toEqual([12.5, 11.1, 3.5]);
  });

  test('indoors it cuts everything above the head in a wide circle', () => {
    const rule = new CutawayRule();
    settle(rule, 3.5, 10, 3.5);
    expect(rule.state.mode).toBe('indoors');
    expect(rule.state.y).toBe(12);
    expect(rule.state.radius).toBeCloseTo(rule.options.indoorsRadius, 2);
    expect([rule.state.x, rule.state.z]).toEqual([3.5, 3.5]);
    // The roof and the top of the far wall are hidden. The lower wall and the floor are not.
    expect(rule.state.column).toBe(true);
    expect(rule.hides(3, 13, 3)).toBe(true);
    expect(rule.hides(0, 12, 3)).toBe(true);
    expect(rule.hides(0, 11, 0)).toBe(false);
    expect(rule.hides(3, 9, 3)).toBe(false);
    expect(rule.hides(60, 13, 3)).toBe(false);
  });

  test('under ground it uses a smaller circle with a softer edge', () => {
    const rule = new CutawayRule();
    settle(rule, 25.5, 10, 3.5);
    expect(rule.state.mode).toBe('underground');
    expect(rule.state.y).toBe(12);
    expect(rule.state.radius).toBeCloseTo(rule.options.undergroundRadius, 2);
    expect(rule.state.radius).toBeLessThan(rule.options.indoorsRadius);
    expect(rule.state.soft).toBeGreaterThan(2);
    expect(rule.state.column).toBe(false);
    expect(rule.hides(25, 15, 3)).toBe(true);
    // Rock straight above the far side of the circle does not hide it from the camera, so it stays.
    expect(rule.hides(20, 19, -1)).toBe(false);
  });

  test('a jump does not move the cut, and leaves overhead do not open it', () => {
    const rule = new CutawayRule();
    settle(rule, 3.5, 10, 3.5);
    settle(rule, 3.5, 11.2, 3.5, 0.2);
    expect(rule.state.y).toBe(12);
    settle(rule, 42.5, 10, 3.5);
    expect(rule.state.mode).toBe('open');
  });

  test('it opens and closes like an iris, not at once', () => {
    const rule = new CutawayRule();
    settle(rule, 12.5, 10, 3.5);
    rule.update(DT, land, 3.5, 10, 3.5, 43.5, 50, 43.5);
    expect(rule.state.radius).toBeGreaterThan(0);
    expect(rule.state.radius).toBeLessThan(3);
    settle(rule, 3.5, 10, 3.5);
    rule.update(DT, land, 12.5, 10, 3.5, 52.5, 50, 43.5);
    expect(rule.state.radius).toBeGreaterThan(8);
    settle(rule, 12.5, 10, 3.5);
    expect(rule.state.radius).toBe(0);
  });

  test('a block between the camera and the hero is hidden, one behind the hero is not', () => {
    const rule = new CutawayRule();
    settle(rule, 12.5, 10, 12.5);
    // The camera is at +40 on every axis, so the line of sight rises along the diagonal.
    expect(rule.hides(15, 13, 15)).toBe(true);
    expect(rule.hides(9, 8, 9)).toBe(false);
    expect(rule.hides(12, 9, 12)).toBe(false);
    expect(rule.hides(16, 10, 9)).toBe(false);
  });
});
