import { treesInArea } from '../../features/world/terrain.sim.ts';
import { pathReach, BOUNDS } from '../region/land.sim.ts';
import { STEPS } from '../play/script.ts';
import { test, expect } from 'bun:test';
import { emptyHit } from '../../features/world/world.sim.ts';
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
  const hit=emptyHit();
  expect(p.sys.trees.raycast({x:t.x+.5,y:t.box.y1+2,z:t.z+.5},{x:0,y:-1,z:0},20,hit)).toBe(true);
  expect({x:hit.x,y:hit.y,z:hit.z}).toEqual({x:t.x,y:t.y,z:t.z});
  expect(p.dig(t.x,t.y+4,t.z)).toBe(true);
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

// Trees and their collision must agree regardless of streaming order or wall-clock time.
test('the same seed gives the same tree placements in every chunk order', () => {
  const a = newPlay(), b = newPlay();
  const first = a.sys.trees.all().map(t => ({...t,box:{...t.box}}));
  for (const chunk of [...b.world.chunks.values()].reverse()) {
    b.world.unload(chunk.cx, chunk.cz);
    b.world.load(chunk.cx, chunk.cz);
  }
  expect(b.sys.trees.all()).toEqual(first);
  for (const t of first) for (let dy=0;dy<2;dy++) {
    expect(a.world.getBlock(t.x,t.y+dy,t.z)).toBe(b.world.getBlock(t.x,t.y+dy,t.z));
  }
});

test('region paths and one block of verge have no tree trunks', () => {
  for (const seed of [1,7,42]) {
    const trees=treesInArea(seed,BOUNDS.x0,BOUNDS.z0,BOUNDS.x1+1,BOUNDS.z1+1);
    expect(trees.length).toBeGreaterThan(0);
    for (const t of trees) expect(pathReach(t.x,t.z),`seed ${seed}: ${t.x},${t.z}`).toBeGreaterThan(1);
  }
});

test('Continue restores felled and standing trees together with quests and the bonded pet', () => {
  const p=newPlay();
  for (const step of STEPS) {
    if (step.name==='harvest and replant until there are 20 wheat') break;
    step.run(p);
  }
  const snapshot=p.save();
  const trees=JSON.parse(JSON.stringify(p.sys.trees.all()));
  expect(trees.some((t:{standing:boolean})=>!t.standing)).toBe(true);
  expect(trees.some((t:{standing:boolean})=>t.standing)).toBe(true);
  expect(p.sys.pets.all().some(t=>t.bonded)).toBe(true);
  expect(p.sys.quests.tracked()?.id).toBe('bread');
  const restored=loadPlay(snapshot);
  expect(restored.sys.trees.all()).toEqual(trees);
  expect(restored.sys.pets.all()).toEqual(p.sys.pets.all());
  expect(restored.sys.quests.all()).toEqual(p.sys.quests.all());
  expect(restored.kernel.save().flags).toEqual(snapshot.game.flags);
  for(const t of trees) for(let dy=0;dy<2;dy++) {
    restored.world.load(Math.floor(t.x/16),Math.floor(t.z/16));
    expect(restored.world.getBlock(t.x,t.y+dy,t.z)).toBe(t.standing?blockId('barrier'):0);
  }
});
