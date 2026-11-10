import { expect, test } from 'bun:test';
import { findTree, type TreeRules } from './tree.sim.ts';

const LOG = 1, LEAF = 2, STONE = 3;
const rules: TreeRules = { isLog: (id) => id === LOG, isLeaf: (id) => id === LEAF, maxLogs: 40, leafReach: 3 };

function world(cells: [number, number, number, number][]) {
  const map = new Map(cells.map(([x, y, z, id]) => [`${x},${y},${z}`, id]));
  return { getBlock: (x: number, y: number, z: number) => map.get(`${x},${y},${z}`) ?? 0 };
}

/** A trunk of four logs on stone, with a crown of leaves around its top two. */
function oak(): [number, number, number, number][] {
  const cells: [number, number, number, number][] = [[0, -1, 0, STONE]];
  for (let y = 0; y < 4; y++) cells.push([0, y, 0, LOG]);
  for (let y = 2; y < 5; y++) for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (x || z || y === 4) cells.push([x, y, z, LEAF]);
  return cells;
}

test('a log finds its whole tree: every log, every leaf, the lowest log and the box', () => {
  const tree = findTree(world(oak()), 0, 2, 0, rules)!;
  expect(tree.logs).toBe(4);
  expect(tree.leaves).toBe(8 + 8 + 9);
  expect(tree.base).toEqual({ x: 0, y: 0, z: 0 });
  expect(tree.box).toEqual({ x0: -1, y0: 0, z0: -1, x1: 2, y1: 5, z1: 2 });
  expect(tree.cells.length).toBe((4 + 25) * 3);
});

test('a leaf finds the same tree through the canopy', () => {
  const fromLeaf = findTree(world(oak()), 1, 4, 1, rules)!;
  expect(fromLeaf.base).toEqual({ x: 0, y: 0, z: 0 });
  expect(fromLeaf.logs).toBe(4);
});

test('logs with no leaves are a build, not a tree, and so is a pile of more logs than a tree has', () => {
  const wall: [number, number, number, number][] = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) wall.push([x, y, 0, LOG]);
  expect(findTree(world(wall), 1, 1, 0, rules)).toBeNull();

  const big = oak();
  for (let x = 1; x < 50; x++) big.push([x, 0, 0, LOG]);
  expect(findTree(world(big), 0, 0, 0, rules)).toBeNull();
});

test('stone, air and a leaf far from any log are not trees', () => {
  const w = world([...oak(), [9, 9, 9, LEAF]]);
  expect(findTree(w, 0, -1, 0, rules)).toBeNull();
  expect(findTree(w, 5, 5, 5, rules)).toBeNull();
  expect(findTree(w, 9, 9, 9, rules)).toBeNull();
});

test('leaves of the crown too far from the trunk go with the tree, and a neighbour tree keeps its own', () => {
  const cells = oak();
  // A branch of leaves five steps out, and a second tree one gap away with a crown of its own.
  cells.push([2, 3, 0, LEAF], [3, 3, 0, LEAF], [4, 3, 0, LEAF], [5, 3, 0, LEAF]);
  for (let y = 0; y < 4; y++) cells.push([9, y, 0, LOG]);
  cells.push([8, 3, 0, LEAF], [7, 3, 0, LEAF]);
  const tree = findTree(world(cells), 0, 0, 0, rules)!;
  const has = (x: number, y: number, z: number) => {
    for (let i = 0; i < tree.cells.length; i += 3) if (tree.cells[i] === x && tree.cells[i + 1] === y && tree.cells[i + 2] === z) return true;
    return false;
  };
  expect(has(4, 3, 0)).toBe(true);
  expect(has(5, 3, 0)).toBe(true);
  expect(has(9, 2, 0)).toBe(false);
  expect(has(8, 3, 0)).toBe(false);
});
