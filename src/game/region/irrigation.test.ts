import { expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { newPlay } from '../play/harness.sim.ts';
import { REGION } from '../content/region.ts';

test('pond boulder keeps its mesh and solid base with open sky above', () => {
  const p = newPlay();
  p.teleport({ x: 4.5, z: -228.5 });
  expect(p.world.getBlock(4, 22, -229)).toBe(blockId('barrier'));
  expect(p.world.getBlock(4, 23, -229)).toBe(0);
  const mesh = REGION.props.find(b => b.kind === 'rock' && b.x === 4.5 && b.z === -228.5);
  expect(mesh).toMatchObject({ y: 22, scale: 1.8, variant: 1, rotation: 2.1 });
  for (const x of [8, 12]) expect(p.world.getBlock(x, 22, -232)).toBe(blockId('barrier'));
});
