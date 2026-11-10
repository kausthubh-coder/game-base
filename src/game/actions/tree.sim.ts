// Finds the whole tree a log or a leaf belongs to, so a tree is felled in one go and never leaves a
// trunk stump or leaves floating in the air. A tree is logs joined to each other with leaves around them.
// Logs with no leaves near them are something a player built, and break one block at a time.

/** The blocks of the world this needs. */
export interface TreeWorld {
  getBlock(x: number, y: number, z: number): number;
}

export interface Tree {
  /** The lowest log, where the axe goes in. */
  base: { x: number; y: number; z: number };
  logs: number;
  leaves: number;
  /** Every cell of the tree, as x, y, z triples: the logs first, then the leaves. */
  cells: number[];
  /** The box around the whole tree, in blocks, max exclusive. */
  box: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
}

export interface TreeRules {
  isLog(id: number): boolean;
  isLeaf(id: number): boolean;
  /** A tree has at most this many logs. More is a build, not a tree. */
  maxLogs: number;
  /** Leaves this far from a log, through other leaves, belong to its tree. */
  leafReach: number;
}

const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;

/** The tree whose log or leaf is at x, y, z, or null when that block is not part of a tree. */
export function findTree(world: TreeWorld, x: number, y: number, z: number, rules: TreeRules): Tree | null {
  const start = world.getBlock(x, y, z);
  let sx = x, sy = y, sz = z;
  if (rules.isLeaf(start)) {
    // From a leaf, find the nearest log through the canopy.
    const found = nearestLog(world, x, y, z, rules);
    if (!found) return null;
    [sx, sy, sz] = found;
  } else if (!rules.isLog(start)) {
    return null;
  }

  // The logs: joined face to face, or corner to corner for a branch.
  const logs: number[] = [];
  const seen = new Set<string>([key(sx, sy, sz)]);
  const queue: [number, number, number][] = [[sx, sy, sz]];
  while (queue.length > 0) {
    const [cx, cy, cz] = queue.shift()!;
    logs.push(cx, cy, cz);
    if (logs.length / 3 > rules.maxLogs) return null;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const nx = cx + dx, ny = cy + dy, nz = cz + dz, k = key(nx, ny, nz);
      if (seen.has(k) || !rules.isLog(world.getBlock(nx, ny, nz))) continue;
      seen.add(k);
      queue.push([nx, ny, nz]);
    }
  }

  // The leaves: reached from a log through other leaves, within leafReach steps.
  const leaves: number[] = [];
  const front: [number, number, number, number][] = [];
  for (let i = 0; i < logs.length; i += 3) front.push([logs[i], logs[i + 1], logs[i + 2], 0]);
  while (front.length > 0) {
    const [cx, cy, cz, d] = front.shift()!;
    if (d >= rules.leafReach) continue;
    for (const [dx, dy, dz] of SIDES) {
      const nx = cx + dx, ny = cy + dy, nz = cz + dz, k = key(nx, ny, nz);
      if (seen.has(k) || !rules.isLeaf(world.getBlock(nx, ny, nz))) continue;
      seen.add(k);
      leaves.push(nx, ny, nz);
      front.push([nx, ny, nz, d + 1]);
    }
  }
  if (leaves.length === 0) return null;

  // Leaves in and around the crown that no other log holds up go with it, so nothing is left floating.
  // The sweep repeats while it finds more, so a loose chain of leaves goes all the way out.
  for (let more = true, rounds = 0; more && rounds < 8; rounds++) {
    more = false;
    const crown = boxOf(logs.concat(leaves));
    for (let cx = crown.x0 - 1; cx <= crown.x1; cx++) for (let cy = crown.y0; cy <= crown.y1; cy++) for (let cz = crown.z0 - 1; cz <= crown.z1; cz++) {
      const k = key(cx, cy, cz);
      if (seen.has(k) || !rules.isLeaf(world.getBlock(cx, cy, cz))) continue;
      if (heldUp(world, cx, cy, cz, rules, seen)) continue;
      seen.add(k);
      leaves.push(cx, cy, cz);
      more = true;
    }
  }

  let base = 0;
  for (let i = 3; i < logs.length; i += 3) if (logs[i + 1] < logs[base + 1]) base = i;
  const cells = logs.concat(leaves);
  const box = boxOf(cells);
  return { base: { x: logs[base], y: logs[base + 1], z: logs[base + 2] }, logs: logs.length / 3, leaves: leaves.length / 3, cells, box };
}

function boxOf(cells: number[]): Tree['box'] {
  const box = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (let i = 0; i < cells.length; i += 3) {
    box.x0 = Math.min(box.x0, cells[i]); box.x1 = Math.max(box.x1, cells[i] + 1);
    box.y0 = Math.min(box.y0, cells[i + 1]); box.y1 = Math.max(box.y1, cells[i + 1] + 1);
    box.z0 = Math.min(box.z0, cells[i + 2]); box.z1 = Math.max(box.z1, cells[i + 2] + 1);
  }
  return box;
}

/** True when a log outside this tree can be reached from the leaf through other leaves. */
function heldUp(world: TreeWorld, x: number, y: number, z: number, rules: TreeRules, tree: Set<string>): boolean {
  const seen = new Set<string>([key(x, y, z)]);
  const front: [number, number, number, number][] = [[x, y, z, 0]];
  while (front.length > 0) {
    const [cx, cy, cz, d] = front.shift()!;
    for (const [dx, dy, dz] of SIDES) {
      const nx = cx + dx, ny = cy + dy, nz = cz + dz, k = key(nx, ny, nz);
      if (seen.has(k) || tree.has(k)) continue;
      seen.add(k);
      const id = world.getBlock(nx, ny, nz);
      if (rules.isLog(id)) return true;
      if (rules.isLeaf(id) && d < 6) front.push([nx, ny, nz, d + 1]);
    }
  }
  return false;
}

const SIDES: readonly [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** The closest log to a leaf, walking through leaves only, at most leafReach + 1 steps away. */
function nearestLog(world: TreeWorld, x: number, y: number, z: number, rules: TreeRules): [number, number, number] | null {
  const seen = new Set<string>([key(x, y, z)]);
  const front: [number, number, number, number][] = [[x, y, z, 0]];
  while (front.length > 0) {
    const [cx, cy, cz, d] = front.shift()!;
    for (const [dx, dy, dz] of SIDES) {
      const nx = cx + dx, ny = cy + dy, nz = cz + dz, k = key(nx, ny, nz);
      if (seen.has(k)) continue;
      seen.add(k);
      const id = world.getBlock(nx, ny, nz);
      if (rules.isLog(id)) return [nx, ny, nz];
      if (rules.isLeaf(id) && d + 1 <= rules.leafReach) front.push([nx, ny, nz, d + 1]);
    }
  }
  return null;
}
