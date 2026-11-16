import { describe, expect, test } from 'bun:test';
import { checkPlaces, type CheckLand, type CheckModels, type CheckOptions, type ModelShape, type PieceFact, type Subject } from './check.sim.ts';

// A small world: flat ground at 20, water to 18, a pond west of x = -10, a hill east of x = 30, and one road everyone
// can walk except a fenced square. The one model is a hut 4 across, 4 deep and 3 high that stands on four corner posts.
const HUT: ModelShape = {
  min: [-2, 0, -2], max: [2, 3, 2],
  feet: [-2, -2, 0, 1, -2, 0, -2, 1, 0, 1, 1, 0],
  cover: [-2, -2, 0, -1, -2, 1, 0, -2, 1, 1, -2, 0, -2, -1, 1, -1, -1, 1, 0, -1, 1, 1, -1, 1, -2, 0, 1, -1, 0, 1, 0, 0, 1, 1, 0, 1, -2, 1, 0, -1, 1, 1, 0, 1, 1, 1, 1, 0],
  triangles: { low: 300, high: 600 },
};
const models: CheckModels = { shape: (model) => (model === 'hut' ? HUT : null) };

interface Fake { ground?: (x: number, z: number) => number; blocks?: Record<string, string>; trees?: { x: number; z: number; kind: string }[]; fenced?: (x: number, z: number) => boolean }
function landOf(fake: Fake = {}): CheckLand {
  return {
    ground: fake.ground ?? ((x) => (x < -10 ? 16 : x >= 30 ? 20 + Math.min(12, x - 29) : 20)),
    water: () => 18,
    oldBlock: (x, y, z) => fake.blocks?.[`${x},${y},${z}`] ?? '',
    trees: (x0, z0, x1, z1) => (fake.trees ?? []).filter((t) => t.x >= x0 && t.x < x1 && t.z >= z0 && t.z < z1),
    walkable: (x, z) => x >= -10 && !(fake.fenced?.(x, z) ?? false),
    inMap: () => true,
  };
}
const options: CheckOptions = { eye: { dx: 19.7, dy: 20.5, dz: 19.7 }, known: new Set(['road', 'cellar']), sheetExists: (path) => path === 'sheets/hut.webp' };

const piece = (over: Partial<PieceFact> = {}): PieceFact => ({
  id: 'hut', model: 'hut', variant: '', x: 0, z: 0, rotation: 0, base: 20, size: { w: 4, d: 4, h: 3 }, sit: 'ground', solid: true, bank: false, joins: false, standIn: '', ...over,
});
const subject = (over: Partial<Subject> = {}): Subject => ({
  id: 'camp', name: 'The camp', declared: false, pieces: [piece()], stands: [{ id: 'camp', x: 0, z: 4 }], links: [], sky: 'open', cleared: [], budget: null, cameras: [], lamps: 0, ...over,
});
const found = (subjects: Subject[], land = landOf()): string[] => checkPlaces(subjects, land, models, options).filter((f) => f.level !== 'note').map((f) => `${f.level} ${f.check} ${f.piece}`);

describe('the place check', () => {
  test('a hut that stands on level ground with a way to it has no finding', () => {
    expect(found([subject()])).toEqual([]);
  });

  test('a model held over the ground is floating, and one sunk in a hill is buried', () => {
    expect(found([subject({ pieces: [piece({ base: 22 })] })])).toEqual(['error floating hut']);
    expect(found([subject({ pieces: [piece({ base: 17 })] })])).toEqual(['error buried hut']);
    // A bank behind a door is land over a model on purpose.
    expect(found([subject({ pieces: [piece({ base: 17, bank: true })] })])).toEqual([]);
  });

  test('a model on a slope hangs on its low side, and the finding says how far the ground falls', () => {
    const all = checkPlaces([subject({ pieces: [piece({ x: 30, base: 23 })], stands: [] })], landOf(), models, options);
    expect(all.map((f) => f.check)).toEqual(['floating']);
    expect(all[0].what).toBe('100% of its feet hang over the ground, up to 3 blocks; the ground under it falls 2 blocks from one side to the other');
  });

  test('a model whose feet are under water is in water unless it is meant to be', () => {
    expect(found([subject({ pieces: [piece({ x: -14, base: 16 })], stands: [] })])).toEqual(['error in-water hut']);
    expect(found([subject({ pieces: [piece({ x: -14, base: 18, sit: 'water' })], stands: [] })])).toEqual([]);
  });

  test('a pier goes down into the ground, so only a gap under it is a fault', () => {
    expect(found([subject({ pieces: [piece({ base: 14, sit: 'rooted' })] })])).toEqual([]);
    expect(found([subject({ pieces: [piece({ base: 23, sit: 'rooted' })] })])).toEqual(['error floating hut']);
  });

  test('old blocks and trees inside a footprint are named', () => {
    const blocks = Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [`${i - 2},20,0`, 'oak_plank']));
    const all = checkPlaces([subject()], landOf({ blocks, trees: [{ x: 1, z: 1, kind: 'oak' }] }), models, options);
    expect(all.map((f) => f.check).sort()).toEqual(['old-blocks', 'tree-inside']);
    expect(all.find((f) => f.check === 'old-blocks')?.what).toContain('5 oak_plank');
  });

  test('the data\'s size is held to the model\'s, and a model that is not made is an error', () => {
    expect(found([subject({ pieces: [piece({ size: { w: 9, d: 4, h: 3 } })] })])).toEqual(['warn size hut']);
    expect(found([subject({ pieces: [piece({ model: 'tower' })] })])).toEqual(['error no-model hut']);
    expect(found([subject({ pieces: [piece({ standIn: 'the delver\'s rack' })] })])).toEqual(['warn stand-in hut']);
  });

  test('two solid footprints in one another overlap, across places too; joined runs do not', () => {
    const a = subject(), b = subject({ id: 'shed', pieces: [piece({ id: 'shed', x: 2 })], stands: [] });
    expect(found([a, b])).toEqual(['error overlap hut']);
    const run = (id: string, x: number): PieceFact => piece({ id, x, joins: true });
    expect(found([subject({ pieces: [run('a', 0), run('b', 3)] })])).toEqual([]);
  });

  test('a place nobody can walk to, and a door that leads nowhere', () => {
    const fenced = (x: number, z: number): boolean => Math.abs(x) <= 6 && Math.abs(z) <= 8;
    expect(found([subject()], landOf({ fenced }))).toEqual(['error unreachable ']);
    expect(found([subject({ links: [{ id: 'hatch', x: 0, z: 3, to: 'cellar' }] })])).toEqual([]);
    expect(found([subject({ links: [{ id: 'hatch', x: 0, z: 3, to: 'attic' }] })])).toEqual(['error dead-end ']);
  });

  test('an underground place is reached only by its link', () => {
    expect(found([subject({ sky: 'under' })])).toEqual(['error under-sky ', 'error no-way-in ']);
  });

  test('the land between the camera and the hero is reported', () => {
    // The camera stands south-east: a cliff 12 blocks high east of x = 30 hides a hero who stands just west of it.
    const cliff = landOf({ ground: (x) => (x >= 30 ? 32 : 20) });
    const all = checkPlaces([subject({ pieces: [], stands: [{ id: 'camp', x: 26, z: 0 }] })], cliff, models, options);
    expect(all.map((f) => f.check)).toEqual(['hidden']);
  });

  test('a place of the place system must have a camera with a painting, and keep to its budget', () => {
    const declared = subject({ declared: true, lamps: 1 });
    expect(found([declared])).toEqual(['error no-camera ']);
    expect(found([{ ...declared, cameras: [{ id: 'vista', sheet: 'sheets/none.webp' }] }])).toEqual(['error no-sheet ']);
    const ok = { ...declared, cameras: [{ id: 'vista', sheet: 'sheets/hut.webp' }] };
    expect(found([{ ...ok, budget: { low: { draws: 1, triangles: 300 }, high: { draws: 1, triangles: 600 } } }])).toEqual([]);
    expect(found([{ ...ok, budget: { low: { draws: 1, triangles: 200 }, high: { draws: 1, triangles: 600 } } }])).toEqual(['error over-budget ']);
  });

  test('a place described twice is an error', () => {
    expect(found([subject({ pieces: [] , stands: [] }), subject({ pieces: [], stands: [] })])).toEqual(['error twice ']);
  });
});
