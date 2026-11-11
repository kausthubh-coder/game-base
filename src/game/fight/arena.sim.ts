// The fight lab's arena, as data: a round meadow with a pond, a rock wall and three trees, laid out around a
// middle point. The lab's view stamps these cells into the block world, and `arenaStage` answers the fight's
// questions about the same cells, so the rules and the picture cannot disagree.
//
// North is -z and east is +x. The camera starts in the south-east and looks north-west, so the wall and the
// trees stand north and west of the open ground, and the pond lies flat in the south-east.

/** What the fight asks of the ground it is fought on. */
export interface Stage {
  /** True inside something that stands in the way: the rock wall, a tree. A charge that reaches one crashes. */
  solid(x: number, z: number): boolean;
  /** True on the arena's ground. No beast and no pet leaves it. */
  inside(x: number, z: number): boolean;
  /** True over water. No beast and no pet goes in. */
  water(x: number, z: number): boolean;
  /** The middle of the arena. */
  readonly center: { readonly x: number; readonly z: number };
  /** Where the hero stands when the lab opens, where a beast is brought in, and where a fainted hero wakes. */
  readonly start: { readonly x: number; readonly z: number };
  readonly den: { readonly x: number; readonly z: number };
  readonly wake: { readonly x: number; readonly z: number };
}

export interface Cell { readonly x: number; readonly z: number }

export const ARENA = {
  /** Blocks from the middle to the edge. The arena is 30 across. */
  radius: 15,
  /** The rock wall: a row of boulders along the north, two blocks high. */
  wall: [-5, -4, -3, -2, -1, 0, 1].map((x) => ({ x, z: -10 })) as readonly Cell[],
  /** The trees: one block of trunk each. */
  trees: [{ x: -11, z: -4 }, { x: -10, z: 5 }, { x: 7, z: -11 }] as readonly Cell[],
  /** The pond, in the south-east: every cell within its oval. */
  pond: { x: 7, z: 5, rx: 3.4, rz: 2.4 },
  start: { x: 0.5, z: 6.5 },
  den: { x: 0.5, z: -3.5 },
  wake: { x: 0.5, z: 12.5 },
} as const;

/** True for a cell of the pond, counted from the arena's middle. */
export function inPond(x: number, z: number): boolean {
  const p = ARENA.pond, dx = (Math.floor(x) + 0.5 - p.x) / p.rx, dz = (Math.floor(z) + 0.5 - p.z) / p.rz;
  return dx * dx + dz * dz <= 1;
}

/** Every cell of the pond, counted from the arena's middle. */
export function pondCells(): Cell[] {
  const p = ARENA.pond, cells: Cell[] = [];
  for (let x = Math.floor(p.x - p.rx) - 1; x <= p.x + p.rx + 1; x++) {
    for (let z = Math.floor(p.z - p.rz) - 1; z <= p.z + p.rz + 1; z++) if (inPond(x, z)) cells.push({ x, z });
  }
  return cells;
}

const onCell = (cells: readonly Cell[], x: number, z: number): boolean => {
  const cx = Math.floor(x), cz = Math.floor(z);
  for (let i = 0; i < cells.length; i++) if ((cells[i] as Cell).x === cx && (cells[i] as Cell).z === cz) return true;
  return false;
};

/** The arena around a middle point of the world. `x` and `z` are whole numbers: the corner of the middle block. */
export function arenaStage(x: number, z: number): Stage {
  const at = (p: { x: number; z: number }) => ({ x: x + p.x, z: z + p.z });
  return {
    solid: (px, pz) => onCell(ARENA.wall, px - x, pz - z) || onCell(ARENA.trees, px - x, pz - z),
    inside(px, pz) {
      const dx = px - x - 0.5, dz = pz - z - 0.5;
      return dx * dx + dz * dz <= ARENA.radius * ARENA.radius;
    },
    water: (px, pz) => inPond(px - x, pz - z),
    center: { x: x + 0.5, z: z + 0.5 },
    start: at(ARENA.start),
    den: at(ARENA.den),
    wake: at(ARENA.wake),
  };
}
