// The demo's village, as a layout: where the paths run, where each building is stamped and which way it
// is turned, and the town props between them. Everything stands on the flat land around the square.
import { blockId } from '../../src/content/blocks.ts';
import { BLUEPRINTS, type BlueprintName } from '../../src/content/blueprints.ts';
import type { PropKind } from '../../src/content/props.ts';
import type { Vec3 } from '../../src/engine/types.ts';
import { stamp, turnedSize } from '../../src/features/buildings/index.ts';
import { LAND, type Ground } from './ground.ts';

type Place = (kind: PropKind, variant: number, position: Vec3, rotation?: number, scale?: number) => number;

/** The middle of the square, where the well stands. */
export const SQUARE = { x: 35, z: 60 };

const BUILDINGS: { name: BlueprintName; x: number; z: number; turns: number }[] = [
  { name: 'cottage', x: 22, z: 45, turns: 0 },
  { name: 'shop', x: 35, z: 43, turns: 0 },
  // Turned so its doors open west, onto the square.
  { name: 'barn', x: 50, z: 55, turns: 3 },
  // A second cottage, turned to face east.
  { name: 'cottage', x: 13, z: 60, turns: 1 },
];

/** Paths as lines of points, two blocks wide. */
const PATHS: [number, number][][] = [
  [[26.5, 52.5], [26.5, 56.5], [31.5, 59]],
  [[38.5, 51.5], [38.5, 56.5]],
  [[49.5, 60], [39, 60]],
  [[20.5, 64.5], [26, 64.5], [31.5, 62]],
  [[34, 55.5], [32.6, 44], [32.4, 30], [34, 14], [33, 0]],
  [[30.5, 59], [26, 57.6], [10, 57], [0, 56]],
  [[38, 63.5], [46, 70], [55, 73.5], [60.5, 73.5]],
];

/** The cottage garden: a fenced patch of tilled soil west of the first cottage. */
const GARDEN = { x0: 14, z0: 46, x1: 21, z1: 52 };

/** Town props set down by hand: kind, variant, x, z, turn. */
const TOWN: [PropKind, number, number, number, number][] = [
  ['well', 0, SQUARE.x, SQUARE.z, 0.35],
  ['stall', 0, 30.2, 55.2, 0.12],
  ['stall', 1, 42.3, 56.4, -0.18],
  ['stall', 2, 31.6, 65.2, Math.PI + 0.1],
  ['lampPost', 0, 28.4, 53.4, 0],
  ['lampPost', 0, 36.4, 52.6, Math.PI],
  ['lampPost', 0, 30.4, 62.4, -0.6],
  ['lampPost', 0, 40.6, 63.6, 2.4],
  ['lampPost', 0, 48.6, 57.6, Math.PI / 2],
  ['lampPost', 0, 22.4, 62.8, 0],
  ['bench', 0, 35.2, 65.2, Math.PI],
  ['bench', 0, 29.6, 60.6, Math.PI / 2],
  ['cart', 0, 44.2, 62.6, 0.5],
  ['barrel', 0, 45.7, 52.3, 0],
  ['barrel', 1, 46.5, 51.5, 0],
  ['crate', 1, 48.8, 56.2, 0.3],
  ['sack', 1, 49, 63.2, 1],
  ['crate', 0, 28.4, 56.4, 0.4],
  ['barrel', 0, 33.2, 65.9, 0],
  ['sack', 0, 43.9, 57.1, 2],
  ['crate', 0, 22.6, 59.2, 0.2],
  ['log', 0, 12.5, 54.6, 0.4],
  // Where the north road meets the square: east to the shop and barn, west down the road, south to the well.
  ['signpost', 1, 31.4, 54.6, 0],
];

export interface Village {
  /** True where the scatter rules must leave the ground bare. */
  blocked(x: number, z: number): boolean;
}

/**
 * Lays the paths and the garden, stamps the buildings and places the town props. `hideFrom` leaves out
 * props that stand at that height or above, for the view with the roofs off.
 */
export function buildVillage(ground: Ground, place: Place, hideFrom: number): Village {
  const path = blockId('path'), cobble = blockId('cobble'), soil = blockId('tilled_soil');
  const top = LAND - 1;
  const boxes: { x0: number; z0: number; x1: number; z1: number }[] = [];
  const spots: { x: number; z: number; r: number }[] = [{ x: SQUARE.x, z: SQUARE.z, r: 5.2 }];

  // ---- paths and the square
  for (let z = 0; z < 96; z++) {
    for (let x = 0; x < 96; x++) {
      const cx = x + 0.5, cz = z + 0.5;
      let near = Infinity;
      for (const line of PATHS) {
        for (let i = 0; i < line.length - 1; i++) {
          const [ax, az] = line[i], [bx, bz] = line[i + 1];
          const t = Math.max(0, Math.min(1, ((cx - ax) * (bx - ax) + (cz - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
          near = Math.min(near, Math.hypot(cx - ax - (bx - ax) * t, cz - az - (bz - az) * t));
        }
      }
      const y = ground.world.heightAt(cx, cz) - 1;
      if (ground.world.surfaceAt(cx, cz) === 'water') continue;
      if (Math.hypot(cx - SQUARE.x, cz - SQUARE.z) < 4.6) ground.setBlock(x, y, z, cobble);
      else if (near < 1.15) ground.setBlock(x, y, z, path);
    }
  }
  for (let z = GARDEN.z0 + 1; z < GARDEN.z1; z++) for (let x = GARDEN.x0 + 1; x < GARDEN.x1; x++) if (x % 2 === 0) ground.setBlock(x, top, z, soil);
  boxes.push({ x0: GARDEN.x0 - 1, z0: GARDEN.z0 - 1, x1: GARDEN.x1 + 1, z1: GARDEN.z1 + 2 });

  // ---- buildings: the corner goes one block under the ground's top, so each floor is level with the ground
  const target = {
    setBlock: ground.setBlock,
    place: (kind: PropKind, variant: number, position: Vec3, rotation: number, scale: number) => (position.y >= hideFrom ? 0 : place(kind, variant, position, rotation, scale)),
  };
  for (const b of BUILDINGS) {
    const blueprint = BLUEPRINTS[b.name];
    const size = turnedSize(blueprint, b.turns);
    stamp(blueprint, { x: b.x, y: top, z: b.z }, b.turns, target);
    boxes.push({ x0: b.x - 1, z0: b.z - 1, x1: b.x + size.x + 1, z1: b.z + size.z + 1 });
  }

  // ---- the garden fence, with a gate in its south side
  const y = LAND;
  for (let x = GARDEN.x0; x < GARDEN.x1; x++) {
    place('fence', 0, { x: x + 0.5, y, z: GARDEN.z0 });
    if (x === 17) place('gate', 1, { x: x + 0.5, y, z: GARDEN.z1 + 1 });
    else place('fence', 0, { x: x + 0.5, y, z: GARDEN.z1 + 1 });
  }
  for (let z = GARDEN.z0; z <= GARDEN.z1; z++) {
    place('fence', 0, { x: GARDEN.x0, y, z: z + 0.5 }, -Math.PI / 2);
    place('fence', 0, { x: GARDEN.x1, y, z: z + 0.5 }, -Math.PI / 2);
  }
  place('fence', 1, { x: GARDEN.x1, y, z: GARDEN.z0 });
  place('fence', 1, { x: GARDEN.x1, y, z: GARDEN.z1 + 1 });
  // What grows in it: berry bushes along the soil rows, flowers between.
  for (let x = GARDEN.x0 + 1; x < GARDEN.x1; x++) {
    for (let z = GARDEN.z0 + 1; z < GARDEN.z1; z += 2) {
      if (x % 2 === 0) place('berryBush', 0, { x: x + 0.5, y, z: z + 0.6 }, x + z, 0.62);
      else place('flower', (x + z) % 6, { x: x + 0.5, y, z: z + 0.9 });
    }
  }

  // ---- the town props
  for (const [kind, variant, x, z, turn] of TOWN) {
    place(kind, variant, { x, y: ground.world.heightAt(x, z), z }, turn);
    spots.push({ x, z, r: kind === 'stall' || kind === 'cart' ? 2 : 1.2 });
  }

  return {
    blocked(x, z) {
      for (const b of boxes) if (x >= b.x0 && x < b.x1 && z >= b.z0 && z < b.z1) return true;
      for (const s of spots) if (Math.hypot(x - s.x, z - s.z) < s.r) return true;
      return false;
    },
  };
}
