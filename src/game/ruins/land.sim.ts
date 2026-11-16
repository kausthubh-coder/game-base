// The rooms' ground: the shape of the land the rooms are sunk in, and their blocks. The terrain asks these while it
// makes a chunk (src/features/world/terrain.sim.ts), as it asks Saltgate's, so the page, the worker and the rules all
// make the same rooms, and nothing of them goes in a save. What a room opens as it is played (the bars of the Lamp
// Gallery, a root lock, the flooded stair) the ruins system changes on top, from its own state.
//
// Every floor is at `ROOMS.ground`. Round the rooms the land is rock nine blocks higher, so each room is a court sunk
// in it, except to the south and east of each room, where it falls to the floor's height so the camera sees in.
import { blockId } from '../../content/blocks.ts';
import { ROOMS, ROOM_DEFS, cellOf, roomOrigin, type RoomDef } from './rooms.sim.ts';

const G = ROOMS.ground;
/** The rock round the rooms, over the floor. */
const ROCK = 9;
/** How far round the rooms the land is theirs, then eases into the land round about. */
const REACH = 24, BLEND = 40;

interface Box { x0: number; z0: number; x1: number; z1: number; room: RoomDef }
const BOXES: readonly Box[] = ROOM_DEFS.map((room) => {
  const o = roomOrigin(room);
  return { x0: o.x, z0: o.z, x1: o.x + room.plan[0].length, z1: o.z + room.plan.length, room };
});
const X0 = Math.min(...BOXES.map((b) => b.x0)) - REACH, X1 = Math.max(...BOXES.map((b) => b.x1)) + REACH;
const Z0 = Math.min(...BOXES.map((b) => b.z0)) - REACH, Z1 = Math.max(...BOXES.map((b) => b.z1)) + REACH;

const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** How much a column is the rooms' ground: 1 inside it, falling to 0 over the band round it. */
export function roomsWeight(x: number, z: number): number {
  if (x < X0 - BLEND || x >= X1 + BLEND || z < Z0 - BLEND || z >= Z1 + BLEND) return 0;
  const d = Math.hypot(Math.max(X0 - x, 0, x - X1), Math.max(Z0 - z, 0, z - Z1));
  return d >= BLEND ? 0 : 1 - smooth(d / BLEND);
}

/** The height the rooms' ground wants at a column: the floor inside a room, rock round it, low ground south-east of it. */
export function roomsShape(x: number, z: number): number {
  let h = G + ROCK;
  for (const b of BOXES) {
    if (x >= b.x0 && x < b.x1 && z >= b.z0 && z < b.z1) {
      if (cellOf(b.room, x - b.x0, z - b.z0) !== ' ') return G;
      // A round room's corners: rock to the north and west, low ground to the south-east.
      return x - b.x0 < (b.x1 - b.x0) / 2 || z - b.z0 < (b.z1 - b.z0) / 2 ? G + ROCK : G + 1;
    }
    // South and east of a room, and the corner between: the land falls away to the floor, then rises to rock again.
    if (x >= b.x0 - 1 && z >= b.z0 - 1) {
      const far = Math.max(x - (b.x1 - 1), z - (b.z1 - 1), 0);
      h = Math.min(h, G + 1 + (ROCK - 1) * smooth((far - 3) / 16));
    }
  }
  return h;
}

/** The land's height with the rooms laid in it: `natural` where they are not. */
export function roomsHeight(x: number, z: number, natural: number): number {
  const w = roomsWeight(x, z);
  if (w <= 0) return natural;
  return natural + (roomsShape(x, z) - natural) * w;
}

/** True where nothing grows by itself: the rooms' ground and the band round it. */
export function inRooms(x: number, z: number): boolean {
  return roomsWeight(x, z) > 0.05;
}

// ------------------------------------------------------------------------------------------ the blocks

const ID = {
  brick: blockId('stone_brick'), mossy: blockId('mossy_stone'), cobble: blockId('cobble'), plaster: blockId('plaster'),
  plank: blockId('oak_plank'), stone: blockId('stone'), water: blockId('water'), barrier: blockId('barrier'), light: blockId('lantern_light'),
};

/** How high each kind of cell stands over the floor, and in what. */
const RISE: Readonly<Record<string, readonly [high: number, block: number]>> = {
  '#': [5, ID.brick], '+': [2, ID.brick], o: [4, ID.brick], x: [2, ID.barrier], X: [8, ID.barrier], k: [2, ID.barrier], r: [3, ID.barrier], b: [2, ID.barrier],
};
const FLOOR: Readonly<Record<string, number>> = { ',': ID.cobble, ':': ID.plaster, '=': ID.plank, '~': ID.stone };

/** The blocks of one cell of a room, from its floor up: `put(y, id)` for each. */
export function cellBlocks(c: string, put: (y: number, id: number) => void): void {
  if (c === ' ') return;
  for (let y = G - 4; y < G - 1; y++) put(y, ID.stone);
  if (c === 'w') {
    put(G - 1, ID.water);
    put(G - 2, ID.water);
    return;
  }
  put(G - 1, FLOOR[c] ?? ID.brick);
  const rise = RISE[c];
  if (!rise) return;
  for (let y = 0; y < rise[0]; y++) put(G + y, c === '#' && y === rise[0] - 1 ? ID.mossy : rise[1]);
}

/** The rooms' cells that are lit: the light inside each lantern, a block over the floor. */
const LIGHTS: readonly { x: number; z: number }[] = BOXES.flatMap((b) => b.room.props.filter((p) => p.light).map((p) => ({ x: b.x0 + Math.floor(p.x), z: b.z0 + Math.floor(p.z) })));

/** Lays the rooms' blocks into the part of a chunk from (ox, oz), `size` wide. `put` writes one cell. */
export function stampRooms(ox: number, oz: number, size: number, put: (x: number, y: number, z: number, id: number) => void): void {
  if (ox >= X1 || oz >= Z1 || ox + size <= X0 || oz + size <= Z0) return;
  for (const b of BOXES) {
    const x0 = Math.max(b.x0, ox), x1 = Math.min(b.x1, ox + size), z0 = Math.max(b.z0, oz), z1 = Math.min(b.z1, oz + size);
    if (x0 >= x1 || z0 >= z1) continue;
    for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) cellBlocks(cellOf(b.room, x - b.x0, z - b.z0), (y, id) => {
      // The vault kits draw masonry; retain the exact collision cells invisibly.
      const kit = ['pump-upper', 'pump-lower', 'gallery', 'seedvault'].includes(b.room.id);
      put(x, y, z, kit && y >= G && (id === ID.brick || id === ID.mossy) ? ID.barrier : id);
    });
  }
  for (const l of LIGHTS) if (l.x >= ox && l.x < ox + size && l.z >= oz && l.z < oz + size) put(l.x, G + 1, l.z, ID.light);
}

/** The block a room's cell has above its floor at height `dy`, as the land laid it: for the system that opens a lock. */
export function blockOf(c: string, dy: number): number {
  const rise = RISE[c];
  return rise && dy < rise[0] ? rise[1] : 0;
}
