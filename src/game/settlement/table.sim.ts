// The dinner table on the green, as assets-src/concept/settlement/dinner.webp lays it out: three 2 by 2 table
// modules end to end (6 by 2 blocks), a bench along each long side, a chair at each end, a lantern pole at each
// corner of a 10 by 7 green, and the spread down the middle. Seven seats, one for each settler.
//
// Pure numbers from the table's footprint, so the settlement seats people by them and the dinner view
// (src/game/views/world-dinner.view.ts) draws the furniture in the same places.
import type { Vec3 } from '../../engine/types.ts';

/** How far the benches stand out from the table's middle line, and the chairs past its ends, in blocks. */
export const BENCH_OUT = 1.45, CHAIR_OUT = 0.6;
/** The green round the table: the lantern poles stand at its corners. */
export const GREEN = { long: 10, wide: 7 } as const;

export interface Seat {
  x: number;
  z: number;
  /** The way a person sitting there faces, toward the table: 0 north, clockwise seen from above. */
  facing: number;
}

export interface TableLayout {
  /** The table's long axis as a unit step: [1, 0] along x, [0, 1] along z. */
  along: readonly [number, number];
  /** The middle of each 2 by 2 module. */
  modules: Vec3[];
  /** The middle of each bench, and the turn that lays it along the table. */
  benches: { at: Vec3; turn: number }[];
  /** The two chairs, each turned to face the table. */
  chairs: { at: Vec3; turn: number }[];
  /** The lantern poles, at the green's corners. */
  poles: Vec3[];
  /** Seats in the order they are filled: the row facing the camera first, then the ends, then the other row. */
  seats: Seat[];
}

/** The way something at (x, z) faces to look at (tx, tz): 0 north, clockwise seen from above. */
const toward = (x: number, z: number, tx: number, tz: number): number => Math.atan2(tx - x, -(tz - z));

/**
 * The layout round a table whose footprint is `sx` by `sz` blocks with its middle at `center`. `front` is the
 * side its door is on, as a unit step (the table's prompt stands there), so nobody sits where the hero stands.
 */
export function tableLayout(center: Vec3, sx: number, sz: number, front: readonly [number, number]): TableLayout {
  const along: [number, number] = sx >= sz ? [1, 0] : [0, 1];
  const across: [number, number] = [along[1], along[0]];
  const long = Math.max(sx, sz);
  const at = (u: number, v: number): Vec3 => ({ x: center.x + along[0] * u + across[0] * v, y: center.y, z: center.z + along[1] * u + across[1] * v });
  // Benches and props turn about y; at 0 a prop's front faces south and its length runs along x.
  const benchTurn = along[0] === 1 ? 0 : Math.PI / 2;
  const modules: Vec3[] = [];
  for (let u = -long / 2 + 1; u < long / 2; u += 2) modules.push(at(u, 0));
  const benches = [-1, 1].flatMap((side) => modules.map((m) => ({ at: at(along[0] * (m.x - center.x) + along[1] * (m.z - center.z), side * BENCH_OUT), turn: benchTurn })));
  const ends = [-1, 1].map((side) => at(side * (long / 2 + CHAIR_OUT), 0));
  // A prop turned by t faces (sin t, cos t); a person facing f looks along (sin f, -cos f): t = PI - f.
  const chairs = ends.map((c) => ({ at: c, turn: Math.PI - toward(c.x, c.z, center.x, center.z) }));
  const poles = [-1, 1].flatMap((su) => [-1, 1].map((sv) => at(su * (GREEN.long / 2 - 0.5), sv * (GREEN.wide / 2 - 0.5))));
  // The door's side across the table: -1 or 1, or 0 when the door is at an end. Its middle stays free for the hero.
  const doorSide = Math.sign(front[0] * across[0] + front[1] * across[1]);
  const seat = (u: number, v: number): Seat => {
    const p = at(u, v);
    return { x: p.x, z: p.z, facing: toward(p.x, p.z, center.x + along[0] * u, center.z + along[1] * u) };
  };
  const row = (side: number): Seat[] => (side === doorSide ? [-2, 2] : [-2, 0, 2]).map((u) => seat(u, side * (BENCH_OUT + 0.05)));
  // The game's camera looks from the south-east, so the row north-west of the table faces it: fill that one first.
  const northWest = across[0] + across[1] > 0 ? -1 : 1;
  const seats: Seat[] = [...row(northWest), ...ends.map((e) => ({ x: e.x, z: e.z, facing: toward(e.x, e.z, center.x, center.z) })), ...row(-northWest)];
  return { along, modules, benches, chairs, poles, seats };
}
