import { expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { CAMP } from '../content/region.ts';
import { clearCampTent } from './ground.sim.ts';
import { newPlay } from '../play/harness.sim.ts';

test('the arrival pond has a dry field within a short diggable connection', () => {
  const p = newPlay();
  p.teleport('grant.rocks');
  let fields = 0;
  for (let x = -6; x <= 24; x++)
    for (let z = -240; z <= -220; z++)
      if (p.world.getBlock(x, 21, z) === blockId('tilled_soil')) fields++;
  expect(fields).toBeGreaterThan(0);
  expect(p.world.getBlock(18,22,-229)).toBe(0);
  expect(p.world.getBlock(17,22,-229)).toBe(0);
});

test('a spade connection waters the field and survives Continue without extra items', () => {
  const p = newPlay();
  p.teleport({ x: 10, z: -227 });
  p.game.flags.set('quest.ground.step', 'ditch');
  p.sys.inventory.add('spade', 1);
  p.sys.inventory.selected = 0;
  p.advance(0.5);
  for(let x=8;x<=17;x++) { p.teleport({x:x+.5,z:-227}); expect(p.use(x,21,-229)).toBe(true); }
  p.advance(2);
  expect(p.game.flags.is('step.ground.ditch')).toBe(true);
  expect(p.sys.machines.holes().every((h) => h.wet)).toBe(true);
  const q = p.reload();
  q.advance(1);
  expect(q.sys.machines.holes()).toEqual(p.sys.machines.holes());
  expect(q.count('spade')).toBe(1);
  expect(q.game.flags.is('step.ground.ditch')).toBe(true);
  expect(q.use(17, 21, -229)).toBe(false);
  expect(q.count('spade')).toBe(1);
});

test('the field has brambles a player can cut and the camp offers setup', () => {
  const p = newPlay();
  p.teleport({ x: 19, z: -223 });
  p.advance(0.5);
  expect(p.world.getBlock(19, 22, -225)).toBe(blockId('oak_leaves'));
  p.teleport({ x: -17, z: -231 });
  p.game.flags.set('quest.ground.step', 'camp');
  p.advance(0.5);
  expect(p.sys.interact.nearest()?.prompt()).toBe('Pitch your tent (2 logs, 1 fiber)');
});

test('cutting all brambles persists, and camp spends materials only once across Continue', () => {
  const p = newPlay();
  p.teleport({ x: 19, z: -223 });
  p.advance(0.5);
  for (const x of [18, 19, 20]) expect(p.dig(x, 22, -225)).toBe(true);
  expect(p.game.flags.is('step.ground.brambles')).toBe(true);
  p.game.flags.set('quest.ground.step', 'camp');
  p.teleport({ x: -17, z: -231 });
  p.sys.interact.act();
  expect(p.game.flags.is('camp.pitched')).toBe(false);
  p.sys.inventory.add('oak_log', 3);
  p.sys.inventory.add('fiber', 1);
  p.sys.interact.act();
  expect(p.game.flags.is('camp.pitched')).toBe(true);
  expect(p.count('oak_log')).toBe(1);
  const q = p.reload();
  q.advance(0.5);
  expect(q.game.flags.is('camp.pitched')).toBe(true);
  expect(q.world.getBlock(19, 22, -225)).toBe(0);
  q.sys.interact.act();
  expect(q.count('oak_log')).toBe(1);
  q.teleport('camp');
  q.sys.interact.act();
  expect(q.count('oak_log')).toBe(0);
  expect(q.game.flags.is('step.ground.camp')).toBe(true);
  q.sys.interact.act();
  expect(q.count('oak_log')).toBe(0);
});


test('camp sleep prompt stays outside the canvas', () => {
  const p = newPlay();
  p.teleport({ x: -17, z: -231 });
  p.game.flags.set('camp.pitched', true);
  p.advance(.5);
  const tent = p.sys.interact.nearest();
  expect(tent?.id).toBe('ground:tent');
  const at = tent!.pos();
  // The old prompt was at the tent centre, inside the canvas.
  expect(Math.hypot(at.x - CAMP.tent.x, at.z - CAMP.tent.z)).toBeGreaterThan(2.3);
});


test('canvas clearance resolves every side and corner, and permits the entrance approach', () => {
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
    const at = { x: CAMP.tent.x + Math.cos(angle), y: CAMP.tent.y, z: CAMP.tent.z + Math.sin(angle) };
    expect(clearCampTent(at)).toBe(true);
    expect(clearCampTent(at)).toBe(false);
  }
  expect(clearCampTent({ ...CAMP.tentApproach })).toBe(false);
});

test('sleep at the entrance wakes safely and preserves the camp across Continue', () => {
  const p = newPlay();
  p.game.flags.set('camp.pitched', true);
  p.game.flags.set('night.over', true);
  p.teleport(CAMP.tentApproach);
  p.sys.time.setTimeOfDay(.8);
  p.advance(.5);
  expect(p.sys.time.canSleep()).toBe(true);
  const day = p.game.clock.day;
  p.sys.interact.act();
  expect(p.game.clock.day).toBe(day + 1);
  const q = p.reload(); q.advance(.5);
  expect(q.game.flags.is('camp.pitched')).toBe(true);
  expect(clearCampTent({ ...q.game.player.pos })).toBe(false);
});
