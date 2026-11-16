// Source-only diagnostic. Fixture positioning/inventory/quest flags are NOT earned progression.
// No browser, server, build, save-file mutation, or product-code mutation.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { newPlay } from '../src/game/play/harness.sim.ts';
import { blockId } from '../src/content/blocks.ts';
import * as THREE from 'three';
import { createBoulders } from '../src/features/painted/scatter.ts';
import { REGION } from '../src/game/content/region.ts';
import { createLand } from '../src/features/painted/land.ts';
import { groundHeight } from '../src/features/world/terrain.sim.ts';

const mode = process.argv[2] ?? 'primary';
const out = `.artifacts/irrigation-repair/source-${mode}-${Date.now()}`;
await mkdir(out, { recursive: true });
assert(['primary', 'secondary', 'collision'].includes(mode), 'use primary, secondary or collision');
const p = newPlay();
p.teleport({ x: 8.5, z: -227.5 });
if (mode === 'collision') {
  // Real geometry and placement transform, with an unused texture. No renderer or graphics context.
  const texture = new THREE.Texture(), mean = new THREE.Color('#ffffff');
  const textures = { rock: texture, ground: texture, cobble: texture, groundMean: mean, paintings: {}, means: {} };
  const land = createLand({
    getBlock: (x,y,z) => p.world.getBlock(x,y,z), heightAt: (x,z) => p.world.heightAt(x,z),
    groundAt: (x,z) => groundHeight(p.world.seed,x,z), revision: (x,z) => p.world.chunkAt(x,z)?.rev ?? -1,
  }, textures);
  // One chunk contains all three boulders. Build its real painted surface without drawing it.
  land.update(8.5, -227.5, 0);
  const rocks = createBoulders(textures);
  const boulders = REGION.props.filter(prop => prop.kind === 'rock' && [[8.5, -231.5], [4.5, -228.5], [12.5, -231.5]].some(([x,z]) => prop.x === x && prop.z === z));
  assert.equal(boulders.length, 3);
  const lift = b => {
    const g = land.heightAt(b.x,b.z), base = p.world.heightAt(b.x,b.z), d = g - base;
    assert(Number.isFinite(g));
    // Same placement lift as shell/game.ts, before the painted stand-in's scale adjustment.
    return Math.abs(d) <= .75 && Math.abs(b.y - base) < 1.7 ? d : 0;
  };
  for (const b of boulders) rocks.place(b.x, b.y + lift(b), b.z, b.rotation, b.scale * .78, b.variant);
  rocks.update(); rocks.group.updateMatrixWorld(true);
  const rows = boulders.map(b => {
    const hit = new THREE.Raycaster(new THREE.Vector3(b.x, 40, b.z), new THREE.Vector3(0, -1, 0)).intersectObject(rocks.group, true)[0];
    assert(hit, 'authored rock must have geometry at its centre');
    const collisionTop = p.world.heightAt(b.x, b.z);
    return { x: b.x, z: b.z, land: land.heightAt(b.x,b.z), lift: lift(b), drawnTop: hit.point.y, collisionTop, invisibleHeight: collisionTop - hit.point.y, topBlock: p.world.getBlock(Math.floor(b.x), collisionTop - 1, Math.floor(b.z)) };
  });
  
  await writeFile(`${out}/collision.json`, JSON.stringify(rows, null, 2) + '\n');
  console.log(JSON.stringify(rows));
  assert(rows.every(r => r.invisibleHeight <= .5), 'the centre of every top collision cell must lie below the visible rock top');
  process.exit(0);
}
p.game.flags.set('quest.ground.step', 'ditch');
p.sys.inventory.add('spade', 1);
assert(p.take('spade'));
p.advance(.5);
const cells = [];
for (let x = 8; x <= 17; x++) {
  p.teleport({ x: x + .5, z: -227.5 });
  const at = p.game.player.pos;
  const dx = x + .5 - at.x, dy = 22 - at.y - 1.6, dz = -228.5 - at.z;
  const hit = p.aim(Math.atan2(dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)));
  assert(hit && hit.x === x && hit.y === 21 && hit.z === -229, `ray must reach ditch cell ${x}`);
  const before = p.world.getBlock(x, 21, -229);
  if (mode === 'secondary') p.click('secondary', hit);
  else {
    p.click('primary', hit);
    p.until(() => { p.hold(hit); return p.world.getBlock(x, 21, -229) !== before; }, 2);
  }
  cells.push({ x, y: 21, z: -229, before, after: p.world.getBlock(x, 21, -229), hole: p.sys.machines.hole(x, 21, -229) ?? null });
}
p.advance(2);
const result = { diagnosticOnly: true, mode, cells, holes: p.sys.machines.holes(), questComplete: p.game.flags.is('step.ground.ditch'), spades: p.count('spade'), water: blockId('water') };

await writeFile(`${out}/${mode}.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
assert.equal(result.holes.length, 10, 'spade excavation must register flow-capable ditch cells');
assert(result.holes.every(h => h.wet), 'pond water must reach all excavated cells');
assert(result.questComplete, 'water beside the authored dry field must complete the ditch objective');
const q = p.reload(); q.advance(.5);
assert.deepEqual(q.sys.machines.holes(), result.holes, 'Continue must retain the wet ditch');
assert(q.game.flags.is('step.ground.ditch'), 'Continue must retain the objective');
assert.equal(q.count('spade'), 1);
console.log('PASS: wet ditch, objective and Continue (diagnostic only)');
