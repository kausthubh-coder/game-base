import { describe, expect, test } from 'bun:test';
import { AIR, BLOCKS, blockId } from '../../content/blocks.ts';
import { BLUEPRINTS, type Blueprint, type BlueprintName } from '../../content/blueprints.ts';
import { propDef, type PropKind } from '../../content/props.ts';
import type { Vec3 } from '../../engine/types.ts';
import { stamp, turnedSize, type StampTarget } from './stamp.sim.ts';

const NAMES = Object.keys(BLUEPRINTS) as BlueprintName[];
const GROUND = 10;

interface PlacedProp {
  kind: PropKind;
  variant: number;
  position: Vec3;
  rotation: number;
  scale: number;
}

/** A hill of solid dirt that reaches three blocks above GROUND, so a stamp has to clear its own inside and doorway. Blocks live in a map. */
function testWorld() {
  const blocks = new Map<string, number>();
  const props: PlacedProp[] = [];
  const dirt = blockId('dirt');
  const get = (x: number, y: number, z: number) => blocks.get(`${x},${y},${z}`) ?? (y <= GROUND + 3 ? dirt : AIR);
  const target: StampTarget = {
    setBlock: (x, y, z, id) => void blocks.set(`${x},${y},${z}`, id),
    place: (kind, variant, position, rotation, scale) => props.push({ kind, variant, position, rotation, scale }),
  };
  const solid = (x: number, y: number, z: number) => BLOCKS[get(x, y, z)].solid;
  return { blocks, props, get, solid, target };
}

/** The corner goes one block under the ground's top, so the floor is level with the ground. */
const CORNER = { x: 100, y: GROUND, z: 200 };

describe('stamp', () => {
  test('a cottage turned four ways lands its door where expected', () => {
    // The cottage is 9 by 8 on the ground, with its door at x = 4 in the south wall, z = 6.
    const expected = [
      { door: { x: 104, y: 11, z: 206 }, outside: { x: 104, y: 11, z: 207 }, out: { x: 0, z: 1 }, size: { x: 9, y: 7, z: 8 } },
      { door: { x: 106, y: 11, z: 204 }, outside: { x: 107, y: 11, z: 204 }, out: { x: 1, z: 0 }, size: { x: 8, y: 7, z: 9 } },
      { door: { x: 104, y: 11, z: 201 }, outside: { x: 104, y: 11, z: 200 }, out: { x: 0, z: -1 }, size: { x: 9, y: 7, z: 8 } },
      { door: { x: 101, y: 11, z: 204 }, outside: { x: 100, y: 11, z: 204 }, out: { x: -1, z: 0 }, size: { x: 8, y: 7, z: 9 } },
    ];
    for (let turns = 0; turns < 4; turns++) {
      const world = testWorld();
      const result = stamp(BLUEPRINTS.cottage, CORNER, turns, world.target);
      expect({ door: result.door, outside: result.outside, out: result.out, size: result.size }).toEqual(expected[turns]);
      expect(result.min).toEqual(CORNER);
    }
  });

  test('the door prop stands in the doorway on the outer face of the wall, facing out, at every turn', () => {
    const expected = [
      { position: { x: 104.5, y: 11, z: 207 }, rotation: 0 },
      { position: { x: 107, y: 11, z: 204.5 }, rotation: Math.PI / 2 },
      { position: { x: 104.5, y: 11, z: 201 }, rotation: Math.PI },
      { position: { x: 101, y: 11, z: 204.5 }, rotation: (3 * Math.PI) / 2 },
    ];
    for (let turns = 0; turns < 4; turns++) {
      const world = testWorld();
      stamp(BLUEPRINTS.cottage, CORNER, turns, world.target);
      const door = world.props.find((p) => p.kind === 'door') as PlacedProp;
      expect(door.position).toEqual(expected[turns].position);
      expect(door.rotation).toBeCloseTo(expected[turns].rotation, 9);
      expect(door.scale).toBe(1);
    }
  });

  for (const name of NAMES) {
    const blueprint: Blueprint = BLUEPRINTS[name];

    test(`the ${name} has a door you can walk through, a real inside and a roof, at every turn`, () => {
      for (let turns = 0; turns < 4; turns++) {
        const world = testWorld();
        const { door, outside, out, min, size } = stamp(blueprint, CORNER, turns, world.target);
        const standable = (x: number, z: number) => world.solid(x, door.y - 1, z) && !world.solid(x, door.y, z) && !world.solid(x, door.y + 1, z);

        // The doorway and the block outside it are clear for a body two blocks tall, though the hill was solid.
        expect(standable(outside.x, outside.z), `${name} turn ${turns}: outside the door`).toBe(true);
        expect(standable(door.x, door.z), `${name} turn ${turns}: the doorway`).toBe(true);
        // The wall closes in over the doorway.
        expect(world.solid(door.x, door.y + blueprint.door.high, door.z)).toBe(true);

        // Walk in from the doorway over every block a body can stand on. The hill is solid, so that is
        // the floor inside, the doorway and the step outside, and nothing else.
        const reached = new Set<string>();
        const queue = [[door.x, door.z]];
        while (queue.length) {
          const [x, z] = queue.pop() as number[];
          const key = `${x},${z}`;
          if (reached.has(key) || !standable(x, z)) continue;
          reached.add(key);
          queue.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
        }
        const along = { x: Math.abs(out.z), z: Math.abs(out.x) };
        const steps = new Set<string>();
        for (let i = 0; i < blueprint.door.wide; i++) steps.add(`${outside.x + along.x * i},${outside.z + along.z * i}`);
        const inside = [...reached].filter((key) => !steps.has(key));
        expect(reached.size - inside.length, `${name} turn ${turns}: the only way out is the door`).toBe(blueprint.door.wide);
        expect(inside.length, `${name} turn ${turns}: floor reached from the door`).toBeGreaterThanOrEqual(20);

        // Every block of that floor is inside the building's box and has a roof over it.
        for (const key of inside) {
          const [x, z] = key.split(',').map(Number);
          expect(x > min.x && z > min.z && x < min.x + size.x - 1 && z < min.z + size.z - 1, `${name} turn ${turns}: ${key} is inside`).toBe(true);
          let covered = false;
          for (let y = door.y + 2; y < min.y + size.y; y++) if (BLOCKS[world.get(x, y, z)].key !== 'air' && BLOCKS[world.get(x, y, z)].key !== 'dirt') covered = true;
          expect(covered, `${name} turn ${turns}: roof over ${key}`).toBe(true);
        }
      }
    });

    test(`the ${name} stays inside its box and writes the same blocks at every turn`, () => {
      const counts: Record<string, number>[] = [];
      for (let turns = 0; turns < 4; turns++) {
        const world = testWorld();
        const { min, size, handles } = stamp(blueprint, CORNER, turns, world.target);
        expect(size).toEqual(turnedSize(blueprint, turns));
        const count: Record<string, number> = {};
        for (const [key, id] of world.blocks) {
          const [x, y, z] = key.split(',').map(Number);
          expect(x >= min.x && x < min.x + size.x && y >= min.y && y < min.y + size.y && z >= min.z && z < min.z + size.z, `${name} turn ${turns}: block at ${key}`).toBe(true);
          count[BLOCKS[id].key] = (count[BLOCKS[id].key] ?? 0) + 1;
        }
        counts.push(count);
        expect(handles.length).toBe(blueprint.props.length);
        // Props stay inside the box too, give or take the poles of an awning.
        for (const p of world.props) {
          expect(p.position.x).toBeGreaterThan(min.x - 0.2);
          expect(p.position.x).toBeLessThan(min.x + size.x + 0.2);
          expect(p.position.z).toBeGreaterThan(min.z - 0.2);
          expect(p.position.z).toBeLessThan(min.z + size.z + 0.2);
        }
      }
      for (const count of counts) expect(count).toEqual(counts[0]);
      expect(counts[0].glass).toBeGreaterThanOrEqual(3);
    });

    test(`the ${name} names only props and variants that exist, and has a door prop and lit windows`, () => {
      for (const p of blueprint.props) expect(p.variant, `${p.kind} variant`).toBeLessThan(propDef(p.kind).variants.length);
      expect(blueprint.props.filter((p) => p.kind === 'door').length).toBe(1);
      expect(blueprint.props.filter((p) => p.kind === 'window').length).toBeGreaterThanOrEqual(3);
    });
  }

  test('four quarter turns are no turn, and a negative turn counts back', () => {
    const run = (turns: number) => {
      const world = testWorld();
      const result = stamp(BLUEPRINTS.shop, CORNER, turns, world.target);
      return { result: { ...result, handles: result.handles.length }, blocks: [...world.blocks].sort(), props: world.props.map((p) => ({ ...p, rotation: Math.round(Math.cos(p.rotation) * 1e6) })) };
    };
    expect(run(4)).toEqual(run(0));
    expect(run(-1)).toEqual(run(3));
  });

  test('without a place function it writes the blocks alone', () => {
    const world = testWorld();
    const result = stamp(BLUEPRINTS.barn, CORNER, 0, { setBlock: world.target.setBlock });
    expect(result.handles).toEqual([]);
    expect(world.blocks.size).toBeGreaterThan(300);
  });

  test('a block name that is not in the table writes nothing', () => {
    const world = testWorld();
    const broken: Blueprint = { ...BLUEPRINTS.cottage, blocks: [...BLUEPRINTS.cottage.blocks, { x: 0, y: 0, z: 0, block: 'marzipan' }] };
    expect(() => stamp(broken, CORNER, 0, world.target)).toThrow('no block called marzipan');
    expect(world.blocks.size).toBe(0);
  });

  test('the wide barn door is two blocks wide and three high at every turn', () => {
    const lows = [{ x: 104, z: 208 }, { x: 108, z: 205 }, { x: 105, z: 201 }, { x: 101, z: 204 }];
    for (let turns = 0; turns < 4; turns++) {
      const world = testWorld();
      const { door, out } = stamp(BLUEPRINTS.barn, CORNER, turns, world.target);
      expect({ x: door.x, z: door.z }).toEqual(lows[turns]);
      // The second block of the doorway is one step along the wall from the first.
      const along = { x: Math.abs(out.z), z: Math.abs(out.x) };
      for (const i of [0, 1]) for (const y of [0, 1, 2]) expect(world.solid(door.x + along.x * i, door.y + y, door.z + along.z * i)).toBe(false);
      expect(world.solid(door.x + along.x * 2, door.y, door.z + along.z * 2)).toBe(true);
      expect(world.solid(door.x - along.x, door.y, door.z - along.z)).toBe(true);
      expect(world.solid(door.x, door.y + 3, door.z)).toBe(true);
    }
  });
});
