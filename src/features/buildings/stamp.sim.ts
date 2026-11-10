// Writes a blueprint into the world: its blocks through a `setBlock` it is given, its props through a
// `place` it is given. It knows nothing about chunks or drawing, so the same call works in the game, on a
// server and in a test.
//
// A quarter turn is counter-clockwise seen from above: one turn swings a door that faced south to face
// east, two to north, three to west. The building always lands in the box that starts at `position` and
// runs toward +x and +z, whatever the turn.
import { blockId } from '../../content/blocks.ts';
import type { Blueprint } from '../../content/blueprints.ts';
import type { PropKind } from '../../content/props.ts';
import type { Vec3 } from '../../engine/types.ts';

export interface StampTarget {
  setBlock(x: number, y: number, z: number, blockId: number): void;
  /** Places one prop and returns its handle. `Props.place` fits. Leave it out to write the blocks alone. */
  place?(kind: PropKind, variant: number, position: Vec3, rotation: number, scale: number): number;
}

export interface Stamped {
  /** The block the building's corner landed on, and the blocks it takes up from there along x, y and z. */
  min: Vec3;
  size: Vec3;
  /** The lowest block of the doorway. For a wide door, the one with the lowest x and z. */
  door: Vec3;
  /** The block just outside the doorway, where a path should end. */
  outside: Vec3;
  /** One step from the doorway to the outside, along x and z. */
  out: { x: number; z: number };
  /** The handles `place` returned, in the blueprint's order. */
  handles: number[];
}

/** The footprint of a blueprint after `quarterTurns`: x and z swap on odd turns. */
export function turnedSize(blueprint: Blueprint, quarterTurns: number): Vec3 {
  const odd = (((quarterTurns % 4) + 4) % 4) % 2 === 1;
  return { x: odd ? blueprint.size.z : blueprint.size.x, y: blueprint.size.y, z: odd ? blueprint.size.x : blueprint.size.z };
}

export function stamp(blueprint: Blueprint, position: Vec3, quarterTurns: number, target: StampTarget): Stamped {
  const q = ((quarterTurns % 4) + 4) % 4;
  const sx = blueprint.size.x, sz = blueprint.size.z;

  /** Where a point of the blueprint lands on the ground plan. Blocks pass their middle. */
  const turnX = (x: number, z: number) => (q === 0 ? x : q === 1 ? z : q === 2 ? sx - x : sz - z);
  const turnZ = (x: number, z: number) => (q === 0 ? z : q === 1 ? sx - x : q === 2 ? sz - z : x);
  const blockX = (x: number, z: number) => position.x + Math.floor(turnX(x + 0.5, z + 0.5));
  const blockZ = (x: number, z: number) => position.z + Math.floor(turnZ(x + 0.5, z + 0.5));

  // Look every block name up before writing anything, so a bad name leaves the world untouched.
  const ids = blueprint.blocks.map((b) => blockId(b.block));
  blueprint.blocks.forEach((b, i) => target.setBlock(blockX(b.x, b.z), position.y + b.y, blockZ(b.x, b.z), ids[i]));

  const handles: number[] = [];
  const place = target.place;
  if (place) {
    for (const p of blueprint.props) {
      const at = { x: position.x + turnX(p.x, p.z), y: position.y + p.y, z: position.z + turnZ(p.x, p.z) };
      handles.push(place(p.kind, p.variant, at, p.rotation + (q * Math.PI) / 2, 1));
    }
  }

  // The doorway covers `wide` blocks along the wall. After a turn, the one nearest the corner may be its other end.
  const d = blueprint.door;
  const ax = blockX(d.x, d.z), az = blockZ(d.x, d.z);
  const bx = blockX(d.x + d.wide - 1, d.z), bz = blockZ(d.x + d.wide - 1, d.z);
  const door = { x: Math.min(ax, bx), y: position.y + d.y, z: Math.min(az, bz) };
  const out = { x: blockX(d.x, d.z + 1) - ax, z: blockZ(d.x, d.z + 1) - az };
  return {
    min: { x: position.x, y: position.y, z: position.z },
    size: turnedSize(blueprint, q),
    door,
    outside: { x: door.x + out.x, y: door.y, z: door.z + out.z },
    out,
    handles,
  };
}
