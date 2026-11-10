// Where the wild props go, as rules. Given a seed, the world and a density, it lists trees, plants and
// rocks for an area: trees on grass, reeds beside water, nothing on paths. It draws nothing.
//
// Every choice is a hash of the seed and the column, never of the area asked for. So the same seed gives
// the same land, and scattering two halves of an area gives the same props as scattering it whole, which
// is what lets the world ask chunk by chunk.
//
// What the world can tell it is the surface of each column. A path, bare dirt, a roof and a floor are all
// "not grass" to it, so they all stay bare.
import { PROPS, type PropKind } from '../../content/props.ts';
import type { WorldQuery } from '../../engine/world-query.ts';
import { jitterAt, type Jitter } from './jitter.sim.ts';

export interface ScatterArea {
  /** Whole blocks. `x1` and `z1` are the first columns past the area. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface ScatterOptions {
  area: ScatterArea;
  /** 1 is the usual amount of everything. 0 leaves the land bare. */
  density?: number;
  /** How much forest a place is, from 0 for open meadow to 1 for deep forest. The default is slow noise from the seed. */
  forest?(x: number, z: number): number;
  /** True where nothing may grow: a village green, the ground under a roof. */
  blocked?(x: number, z: number): boolean;
  /** The y of the water's surface in a water column, or undefined on land. The world's `heightAt` gives only the bed, so without this no lily pads are placed. */
  waterLevel?(x: number, z: number): number | undefined;
}

/** One prop to place: the arguments of `Props.place`. */
export interface ScatteredProp {
  kind: PropKind;
  variant: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
}

/** The top of a tree, for the weather to drop leaves from. */
export interface TreeTop {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  /** How far its leaves reach from the trunk, in meters. */
  reach: number;
}

export interface Scatter {
  props: ScatteredProp[];
  treeTops: TreeTop[];
}

type TreeKind = 'oak' | 'birch' | 'pine';

/** Trees stand on a grid this many blocks wide, one at most in each square, so two never share a trunk. */
const TREE_GRID = 3;

/** A number from 0 to 1 from the seed, a column and a salt. */
function chance(seed: number, x: number, z: number, salt: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 1442695041) + Math.imul(salt, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 15), 362437);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth noise from 0 to 1 that changes over about `size` blocks. */
function noise(seed: number, x: number, z: number, size: number, salt: number): number {
  const fx = x / size, fz = z / size;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz;
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const a = chance(seed, ix, iz, salt), b = chance(seed, ix + 1, iz, salt);
  const c = chance(seed, ix, iz + 1, salt), d = chance(seed, ix + 1, iz + 1, salt);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const ROCK_VARIANTS = [0, 0, 0, 0, 1, 1, 1, 2, 3, 3];
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function scatter(seed: number, world: WorldQuery, options: ScatterOptions): Scatter {
  const { area } = options;
  const density = options.density ?? 1;
  const forestAt = options.forest ?? ((x: number, z: number) => smoothstep(0.42, 0.62, noise(seed, x, z, 28, 101) * 0.75 + noise(seed, x, z, 11, 102) * 0.25));
  const blocked = options.blocked ?? (() => false);
  const props: ScatteredProp[] = [];
  const treeTops: TreeTop[] = [];
  const jitter: Jitter = { turn: 0, size: 1, r: 1, g: 1, b: 1 };
  if (density <= 0) return { props, treeTops };

  const surface = (x: number, z: number) => world.surfaceAt(x + 0.5, z + 0.5);
  const height = (x: number, z: number) => world.heightAt(x + 0.5, z + 0.5);
  const add = (kind: PropKind, variant: number, x: number, y: number, z: number, rotation: number, scale: number) => props.push({ kind, variant, x, y, z, rotation, scale });

  /** The column of the one tree that may stand in this square of the tree grid, or null. */
  const treeIn = (gx: number, gz: number): { x: number; z: number; kind: TreeKind } | null => {
    // The column is one of the four nearest the square's corner, so trees in neighboring squares stay two blocks apart.
    const x = gx * TREE_GRID + Math.floor(chance(seed, gx, gz, 1) * 2);
    const z = gz * TREE_GRID + Math.floor(chance(seed, gx, gz, 2) * 2);
    if (surface(x, z) !== 'grass' || blocked(x + 0.5, z + 0.5)) return null;
    const y = height(x, z);
    if (!world.openSky(x + 0.5, y, z + 0.5)) return null;
    for (const [dx, dz] of NEIGHBORS) {
      if (surface(x + dx, z + dz) === 'water' || Math.abs(height(x + dx, z + dz) - y) > 1) return null;
    }
    const forest = forestAt(x + 0.5, z + 0.5);
    // A lone tree now and then in a meadow, and one square in two in deep forest.
    const share = Math.min(0.9, (0.012 + 0.5 * smoothstep(0.25, 0.75, forest)) * density);
    if (chance(seed, gx, gz, 3) >= share) return null;
    // Pines keep to their own stands. Birches mix in among the oaks.
    const pines = smoothstep(0.5, 0.7, noise(seed, x, z, 34, 103));
    const pick = chance(seed, gx, gz, 4);
    const kind: TreeKind = pick < pines * 0.85 ? 'pine' : chance(seed, gx, gz, 5) < 0.3 ? 'birch' : 'oak';
    return { x, z, kind };
  };

  // ---- trees
  const hasTree = new Set<number>();
  const columnKey = (x: number, z: number) => (x + 32768) * 65536 + (z + 32768);
  for (let gz = Math.floor(area.z0 / TREE_GRID); gz * TREE_GRID < area.z1; gz++) {
    for (let gx = Math.floor(area.x0 / TREE_GRID); gx * TREE_GRID < area.x1; gx++) {
      const tree = treeIn(gx, gz);
      if (!tree || tree.x < area.x0 || tree.x >= area.x1 || tree.z < area.z0 || tree.z >= area.z1) continue;
      const { x, z, kind } = tree;
      hasTree.add(columnKey(x, z));
      const def = PROPS[kind];
      const variant = Math.floor(chance(seed, x, z, 6) * def.variants.length);
      const px = x + 0.5 + (chance(seed, x, z, 7) - 0.5) * 0.5;
      const pz = z + 0.5 + (chance(seed, x, z, 8) - 0.5) * 0.5;
      const py = height(x, z);
      const scale = 0.85 + chance(seed, x, z, 9) * 0.3;
      add(kind, variant, px, py, pz, chance(seed, x, z, 10) * Math.PI * 2, scale);
      // The size the tree is really drawn at includes the small change every placed prop gets.
      const size = scale * jitterAt(def.vary, px, py, pz, jitter).size;
      const crown = def.crown[variant];
      treeTops.push({ kind, x: px, y: py + crown.top * size, z: pz, reach: crown.reach * size });
    }
  }

  // ---- everything smaller, column by column
  for (let z = area.z0; z < area.z1; z++) {
    for (let x = area.x0; x < area.x1; x++) {
      if (hasTree.has(columnKey(x, z)) || blocked(x + 0.5, z + 0.5)) continue;
      const ground = surface(x, z);
      const y = height(x, z);
      const px = x + 0.2 + chance(seed, x, z, 11) * 0.6;
      const pz = z + 0.2 + chance(seed, x, z, 12) * 0.6;
      const turn = chance(seed, x, z, 13) * Math.PI * 2;
      const size = 0.85 + chance(seed, x, z, 14) * 0.3;

      if (ground === 'water') {
        const level = options.waterLevel?.(x + 0.5, z + 0.5);
        if (level === undefined) continue;
        let shore = false;
        for (const [dx, dz] of NEIGHBORS) if (surface(x + dx, z + dz) !== 'water') shore = true;
        // Reeds stand in the shallows by the bank. Lily pads float anywhere, and more of them near the bank.
        if (shore && level - y <= 1 && chance(seed, x, z, 15) < 0.4 * density) add('reeds', Math.floor(chance(seed, x, z, 16) * 2), px, y, pz, turn, size);
        else if (chance(seed, x, z, 17) < (shore ? 0.12 : 0.05) * density) add('lilyPad', Math.floor(chance(seed, x, z, 18) * 2), px, level, pz, turn, size);
        continue;
      }

      let waterSide: readonly [number, number] | null = null;
      for (const side of NEIGHBORS) if (surface(x + side[0], z + side[1]) === 'water') waterSide = side;
      if (waterSide && (ground === 'grass' || ground === 'sand')) {
        // On the bank, pushed toward the water's edge.
        if (chance(seed, x, z, 19) < 0.6 * density) {
          add('reeds', Math.floor(chance(seed, x, z, 16) * 2), x + 0.5 + waterSide[0] * 0.3 + (chance(seed, x, z, 11) - 0.5) * 0.3, y, z + 0.5 + waterSide[1] * 0.3 + (chance(seed, x, z, 12) - 0.5) * 0.3, turn, size);
          continue;
        }
      }
      if (ground === 'sand') {
        if (chance(seed, x, z, 20) < 0.03 * density) add('rock', 0, px, y, pz, turn, size);
        continue;
      }
      if (ground !== 'grass') continue;

      const forest = forestAt(x + 0.5, z + 0.5);
      const open = 1 - forest;
      const edge = 1 - Math.min(1, Math.abs(forest - 0.45) / 0.3);

      // One larger thing at most in a column.
      const large = chance(seed, x, z, 21);
      const bushes = (0.012 + 0.05 * edge) * density;
      const rocks = (0.01 + 0.012 * forest) * density;
      const stumps = 0.012 * forest * density;
      const logs = 0.008 * forest * density;
      const mushrooms = 0.045 * forest * density;
      let isLarge = true;
      if (large < bushes) {
        if (chance(seed, x, z, 22) < 0.22) add('berryBush', 0, px, y, pz, turn, size);
        else add('bush', Math.floor(chance(seed, x, z, 23) * 3), px, y, pz, turn, size);
      } else if (large < bushes + rocks) add('rock', ROCK_VARIANTS[Math.floor(chance(seed, x, z, 24) * ROCK_VARIANTS.length)], px, y, pz, turn, size);
      else if (large < bushes + rocks + stumps) add('stump', 0, px, y, pz, turn, size);
      else if (large < bushes + rocks + stumps + logs) add('log', 0, x + 0.5, y, z + 0.5, turn, size);
      else if (large < bushes + rocks + stumps + logs + mushrooms) add('mushroom', Math.floor(chance(seed, x, z, 25) * 3), px, y, pz, turn, size);
      else isLarge = false;
      if (isLarge) continue;

      // Flowers grow in patches of mostly one color. Tall grass grows in patches of its own. Tufts grow everywhere.
      const small = chance(seed, x, z, 26);
      const inFlowers = noise(seed, x, z, 9, 104) > 0.6;
      const inTallGrass = noise(seed, x, z, 8, 105) > 0.62;
      const flowers = (inFlowers ? 0.4 : 0.015) * (0.3 + 0.7 * open) * density;
      const tall = (inTallGrass ? 0.4 : 0.01) * (0.25 + 0.75 * open) * density;
      const tufts = (0.12 + 0.14 * open) * density;
      if (small < flowers) {
        const patch = Math.floor(noise(seed, x, z, 21, 106) * 5.999);
        const color = chance(seed, x, z, 27) < 0.75 ? patch : Math.floor(chance(seed, x, z, 28) * 6);
        add('flower', color, px, y, pz, turn, size);
      } else if (small < flowers + tall) add('tallGrass', 0, px, y, pz, turn, size);
      else if (small < flowers + tall + tufts) add('grassTuft', Math.floor(chance(seed, x, z, 29) * 3), px, y, pz, turn, size);
    }
  }
  return { props, treeTops };
}
