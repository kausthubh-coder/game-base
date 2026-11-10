// Which columns the props feature's scatter rules may stand a tree on.
//
// The scatter takes one rule from the region, `blocked`, and it holds for trees and small plants alike.
// The region wants more than that around its sites: no tree at all, so nothing tall stands between the
// camera and the hero, but the grass and flowers left alone. The scatter stands a tree only on one
// column of each 3 by 3 square (`treeIn` in src/features/props/scatter.sim.ts). So the region blocks
// just that column: no tree can grow, and eight columns in nine keep their plants.
//
// `chance` and `TREE_GRID` are copies of the scatter's own. If the scatter changes how it picks the
// column, the copy stops matching and trees come back: the region test runs the real scatter over the
// sites and fails when it finds one.

const TREE_GRID = 3;

/** The scatter's hash: a number from 0 to 1 from the seed, a column and a salt. */
function chance(seed: number, x: number, z: number, salt: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 1442695041) + Math.imul(salt, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 15), 362437);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** True when this column is the one in its square where the scatter would stand a tree, if it stands one. */
export function isTreeSpot(seed: number, x: number, z: number): boolean {
  const gx = Math.floor(x / TREE_GRID), gz = Math.floor(z / TREE_GRID);
  return x === gx * TREE_GRID + Math.floor(chance(seed, gx, gz, 1) * 2) && z === gz * TREE_GRID + Math.floor(chance(seed, gx, gz, 2) * 2);
}
