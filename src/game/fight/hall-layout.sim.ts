// The Verdant Stag's hall, as data: a round stone floor with a low wall of boulders round it, the Stag lying
// across its north end, four pins, four lamps, the cells of the vines that grow into a ramp up its flank in
// the third phase, and its collar. The lab's view stamps these cells into the block world (`fightview/hall.ts`),
// and `hallStage` answers the fight's questions about the same cells, so the rules and the picture agree.
//
// Points are in blocks from the corner of the middle block, as in `arena.sim.ts`: a cell's middle is +0.5.
// North is -z and east is +x. The camera starts in the south-east and looks north-west, so the Stag is seen
// from its front right, and the vines climb its east flank, the side nearer the camera.
import type { Stage } from './arena.sim.ts';

export interface Point { readonly x: number; readonly z: number }
/** One cell of the vines' ramp and its height in blocks above the floor. */
export interface RampCell { readonly x: number; readonly z: number; readonly height: number }

/** The ramp: two cells wide along the Stag's east flank, rising one block every two cells from the floor to its shoulder. */
const rampCells = (): RampCell[] => {
  const cells: RampCell[] = [];
  for (let z = 6; z >= -5; z--) for (const x of [3, 4]) cells.push({ x, z, height: Math.ceil((7 - z) / 2) });
  return cells;
};

export const HALL = {
  /** Blocks from the middle to the edge of the floor. The ring of boulders stands just outside it. */
  radius: 12,
  wall: 13,
  /** Where the hero comes in, and where a fainted hero wakes. */
  door: { x: 0.5, z: 10.5 } as Point,
  /**
   * The Stag's body: the cells it lies on, `x0` to `x1` and `z0` to `z1` with the ends left out. Nothing walks
   * through it. It faces south, toward the door, and its chest is the body's south edge.
   */
  body: { x0: -2, x1: 3, z0: -12, z1: -4 },
  /** Its four legs, at the corners of the body. A stamp comes down on the one nearest the hero. */
  legs: [{ x: -1.5, z: -4.6 }, { x: 2.5, z: -4.6 }, { x: -1.5, z: -11.4 }, { x: 2.5, z: -11.4 }] as readonly Point[],
  /** The middle of its chest, where the antlers come from. */
  chest: { x: 0.5, z: -4 } as Point,
  /** The four pins, two by its front and two toward the door. A chain runs from each to a leg. */
  pins: [{ x: -7.5, z: -2.5 }, { x: 8.5, z: -2.5 }, { x: -6.5, z: 6.5 }, { x: 7.5, z: 6.5 }] as readonly Point[],
  /** The lamps of the second phase. */
  lamps: [{ x: -8.5, z: 3.5 }, { x: 9.5, z: 2.5 }, { x: -4.5, z: -6.5 }, { x: -2.5, z: 7.5 }] as readonly Point[],
  /** The vines' ramp, foot first. The last cells stand beside the shoulder, at its top. */
  ramp: rampCells() as readonly RampCell[],
  /** Heights on the ramp from which the collar can be reached. */
  reachFrom: 5,
  /** The collar, round its neck just in front of the shoulder, beside the top of the ramp. */
  collar: { x: 1.6, z: -3.6 } as Point,
} as const;

/** The ramp's height under a point, or 0 off it. */
export function rampHeight(x: number, z: number): number {
  const cx = Math.floor(x), cz = Math.floor(z);
  for (let i = 0; i < HALL.ramp.length; i++) {
    const c = HALL.ramp[i] as RampCell;
    if (c.x === cx && c.z === cz) return c.height;
  }
  return 0;
}

/** True on a cell of the Stag's body, counted from the middle. */
export function onBody(x: number, z: number): boolean {
  const b = HALL.body;
  return x >= b.x0 && x < b.x1 && z >= b.z0 && z < b.z1;
}

/** True on the cell of a pin or a lamp: a post stands there, and nobody walks through it. */
export function onPost(x: number, z: number): boolean {
  const cx = Math.floor(x), cz = Math.floor(z);
  for (const p of HALL.pins) if (Math.floor(p.x) === cx && Math.floor(p.z) === cz) return true;
  for (const p of HALL.lamps) if (Math.floor(p.x) === cx && Math.floor(p.z) === cz) return true;
  return false;
}

/** The hall's ground, as the fight asks about it, and whether the vines' ramp stands. */
export interface HallStage extends Stage {
  /** True once the vines have grown into a ramp. */
  ramp: boolean;
  /** The ramp's height under a point of the world, or 0 off it or before it stands. */
  rampAt(x: number, z: number): number;
  /** A point of the hall's layout, as a point of the world. */
  at(p: Point): { x: number; z: number };
}

/**
 * The hall around a middle point of the world. `x` and `z` are whole numbers: the corner of the middle block.
 * The body and the posts of the pins and lamps are solid. Past the floor's edge is the wall. The ramp counts as water to the fight once it stands:
 * the hero climbs it, and no pet or beast follows.
 */
export function hallStage(x: number, z: number): HallStage {
  const at = (p: Point) => ({ x: x + p.x, z: z + p.z });
  const out = (px: number, pz: number): number => Math.hypot(px - x - 0.5, pz - z - 0.5);
  const stage: HallStage = {
    ramp: false,
    rampAt: (px, pz) => (stage.ramp ? rampHeight(px - x, pz - z) : 0),
    solid: (px, pz) => onBody(px - x, pz - z) || onPost(px - x, pz - z) || out(px, pz) > HALL.radius + 0.5,
    inside: (px, pz) => out(px, pz) <= HALL.radius,
    water: (px, pz) => stage.ramp && rampHeight(px - x, pz - z) > 0,
    center: { x: x + 0.5, z: z + 0.5 },
    start: at(HALL.door),
    den: at(HALL.chest),
    wake: at(HALL.door),
    at,
  };
  return stage;
}
