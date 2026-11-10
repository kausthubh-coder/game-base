import { test, expect } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { newPlay, loadPlay } from '../play/harness.sim.ts';

test('model tree roots collide; a held axe fells the whole tree and saves the cleared root',()=>{
  const p=newPlay();
  const t=p.sys.trees.all().find(t=>t.standing&&!p.sys.region.isProtected(t.x,t.y,t.z))!;
  p.teleport({x:t.x+2.5,z:t.z+.5});
  expect(p.world.getBlock(t.x,t.y,t.z)).toBe(blockId('barrier'));
  expect(p.world.getBlock(t.x,t.y+1,t.z)).toBe(blockId('barrier'));
  p.sys.inventory.add('axe',1);
  const slot=p.sys.inventory.slots.findIndex(s=>s?.id==='axe');
  p.sys.inventory.selected=slot;
  expect(p.dig(t.x,t.y,t.z)).toBe(true);
  expect(p.sys.trees.all().find(q=>q.x===t.x&&q.z===t.z)?.standing).toBe(false);
  expect(p.count('oak_log')).toBeGreaterThanOrEqual(3);
  expect(p.count('fiber')).toBeGreaterThanOrEqual(1);
  expect(p.world.getBlock(t.x,t.y,t.z)).toBe(0);
  const restored=loadPlay(p.save());
  expect(restored.sys.trees.all().find(q=>q.x===t.x&&q.z===t.z)?.standing).toBe(false);
  expect(restored.world.getBlock(t.x,t.y,t.z)).toBe(0);
  expect(newPlay().sys.trees.all().find(q=>q.x===t.x&&q.z===t.z)?.standing).toBe(true);
});

test('the mossy rocks keep their protected canopy',()=>{
  const p=newPlay();const t=p.sys.trees.all().find(t=>t.protected)!;
  expect(t).toBeDefined();expect(p.sys.trees.fell(t.x,t.y,t.z)).toBe(false);expect(t.standing).toBe(true);
});
