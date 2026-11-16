// Saltgate's land: the shape of the quarter grant day is played in, and its blocks. The terrain asks these while
// it makes a chunk, so the page, the worker and the rules all make the same Saltgate, and nothing of it goes in a
// save. The layout is data in content/saltgate.ts.
//
// The quarter's land is flat at the street's height north of the quay and sea floor south of it and east of the
// estuary, out to `reach` blocks round it; then it eases into the land round about over `blend` blocks.
import { blockId } from '../../content/blocks.ts';
import { BOXES, PROPS, SALTGATE, type Box, type SaltBlock } from '../content/saltgate.ts';

const { x: OX, z: OZ, reach: REACH, blend: BLEND } = SALTGATE;
const W = 144, D = 112;
/** The quarter's land, then the band where it eases out, in world blocks. */
const X0 = OX - REACH, X1 = OX + W + REACH, Z0 = OZ - REACH, Z1 = OZ + D + REACH;

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** How much a column is Saltgate's: 1 inside its land, falling to 0 over the band round it. */
export function saltgateWeight(x: number, z: number): number {
  if (x < X0 - BLEND || x >= X1 + BLEND || z < Z0 - BLEND || z >= Z1 + BLEND) return 0;
  const dx = Math.max(X0 - x, 0, x - X1), dz = Math.max(Z0 - z, 0, z - Z1);
  const d = Math.hypot(dx, dz);
  return d >= BLEND ? 0 : 1 - smooth(d / BLEND);
}

/** The height Saltgate wants at a column: the street north of the quay, the harbour's floor south and east of it. */
export function saltgateShape(x: number, z: number): number {
  const lx = x - OX, lz = z - OZ;
  return lz >= SALTGATE.quayEdge || lx >= SALTGATE.estuary ? SALTGATE.sea : SALTGATE.ground;
}

/** The land's height with Saltgate laid on it: `natural` where Saltgate is not, its own shape where it is. */
export function saltgateHeight(x: number, z: number, natural: number): number {
  const w = saltgateWeight(x, z);
  if (w <= 0) return natural;
  return natural + (saltgateShape(x, z) - natural) * w;
}

/** True where nothing grows by itself: Saltgate's land and the band round it. */
export function inSaltgate(x: number, z: number): boolean {
  return saltgateWeight(x, z) > 0.05;
}

// ------------------------------------------------------------------------------------------ the blocks

interface Cells {
  x0: number; z0: number; x1: number; z1: number;
  y0: number; y1: number;
  id: number;
}

const ID: Record<SaltBlock, number> = {
  air: 0, cobble: blockId('cobble'), stone_brick: blockId('stone_brick'), plaster: blockId('plaster'),
  oak_plank: blockId('oak_plank'), oak_log: blockId('oak_log'), glass: blockId('glass'), shingle: blockId('shingle'),
  barrier: blockId('barrier'), lantern_light: blockId('lantern_light'), path: blockId('path'),
};

const toCells = ([x0, z0, x1, z1, y0, y1, block]: Box): Cells => ({ x0: OX + x0, z0: OZ + z0, x1: OX + x1, z1: OZ + z1, y0, y1, id: ID[block] });

/** A footprint fenced with barrier, two blocks tall, turned with its model to the nearest quarter. */
function fence(p: (typeof PROPS)[number]): Cells | null {
  if (!p.solid) return null;
  const quarter = Math.round((p.turn ?? 0) / (Math.PI / 2)) & 1;
  const [w, d] = quarter ? [p.solid[1], p.solid[0]] : p.solid;
  const y = Math.floor(p.y ?? SALTGATE.ground);
  const x0 = Math.round(p.x - w / 2), z0 = Math.round(p.z - d / 2);
  return { x0: OX + x0, z0: OZ + z0, x1: OX + x0 + w, z1: OZ + z0 + d, y0: y, y1: y + 2, id: ID.barrier };
}

/** Every box, in the order it is laid: the plan's boxes, then the fences under the models. */
export const CELLS: readonly Cells[] = [...BOXES.map(toCells), ...PROPS.map(fence).filter((c): c is Cells => c !== null)];

/** The world rectangle the boxes cover, so a chunk far from Saltgate asks nothing more. */
const BOUNDS = CELLS.reduce((b, c) => ({ x0: Math.min(b.x0, c.x0), z0: Math.min(b.z0, c.z0), x1: Math.max(b.x1, c.x1), z1: Math.max(b.z1, c.z1) }), { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity });

/** Lays Saltgate's blocks into the part of a chunk from (ox, oz), `size` wide. `put` writes one cell. */
export function stampSaltgate(ox: number, oz: number, size: number, put: (x: number, y: number, z: number, id: number) => void): void {
  if (ox >= BOUNDS.x1 || oz >= BOUNDS.z1 || ox + size <= BOUNDS.x0 || oz + size <= BOUNDS.z0) return;
  for (const c of CELLS) {
    const x0 = Math.max(c.x0, ox), x1 = Math.min(c.x1, ox + size), z0 = Math.max(c.z0, oz), z1 = Math.min(c.z1, oz + size);
    if (x0 >= x1 || z0 >= z1) continue;
    for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) for (let y = c.y0; y < c.y1; y++) put(x, y, z, c.id);
  }
}

/** A point of the quarter's grid in the world, feet on the street unless `y` is given. */
export function saltgateAt(x: number, z: number, y: number = SALTGATE.ground): { x: number; y: number; z: number } {
  return { x: OX + x, y, z: OZ + z };
}
