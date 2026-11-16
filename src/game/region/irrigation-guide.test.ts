import { expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { newPlay } from '../play/harness.sim.ts';
import { ARRIVAL_IRRIGATION } from '../content/region.ts';
import { irrigationGuide } from './irrigation-guide.sim.ts';

function ditchPlay() {
  const p = newPlay();
  p.sys.quests.skipTo('ground');
  p.game.flags.set('scene.7', true);
  p.advance(0.1);
  return p;
}

test('the ditch waypoint points into the actual dry tilled field, not the plot centre', () => {
  const p = ditchPlay();
  const ditch = p.sys.quests.all().find(q => q.id === 'ground')!.steps.find(s => s.id === 'ditch')!;
  expect(ditch.at).toEqual({ x: 20, y: 22, z: -227.5 });
  expect(p.world.getBlock(Math.floor(ditch.at!.x), 21, Math.floor(ditch.at!.z))).toBe(blockId('tilled_soil'));
});

test('the temporary guide names real source water and the complete authored dry field', () => {
  const p = ditchPlay(), guide = irrigationGuide(p.game.flags)!;
  expect(guide.fieldTarget).toEqual({ x: 20, y: 22, z: -227.5 });
  expect(p.world.getBlock(Math.floor(guide.source.x), guide.source.y - 1, Math.floor(guide.source.z))).toBe(blockId('water'));
  let tiles = 0;
  for (let x = guide.field.x0; x <= guide.field.x1; x++)
    for (let z = guide.field.z0; z <= guide.field.z1; z++) {
      expect(p.world.getBlock(x, guide.field.soilY, z)).toBe(blockId('tilled_soil'));
      tiles++;
    }
  expect(tiles).toBe(12);
  const ditch = p.sys.quests.all().find(q => q.id === 'ground')!.steps.find(s => s.id === 'ditch')!;
  expect(ditch.text).toContain('one block deep');
  expect(ditch.hint).toContain('Leave the tilled soil in place.');
});

test('water alone keeps guidance; reaching the field ends it and survives Continue', () => {
  const p = ditchPlay();
  if (!p.count('spade')) p.sys.inventory.add('spade', 1);
  p.sys.inventory.selected = p.sys.inventory.slots.findIndex(s => s?.id === 'spade');
  const tools = p.count('spade');
  for (let x = 8; x <= 16; x++) {
    p.teleport({ x: x + .5, z: -227 });
    expect(p.use(x, 21, -229)).toBe(true);
  }
  p.advance(1);
  expect(p.sys.machines.holes().every(h => h.wet)).toBe(true);
  expect(p.game.flags.is('step.ground.ditch')).toBe(false);
  expect(irrigationGuide(p.game.flags)).not.toBeNull();
  const q = p.reload(); q.advance(.1);
  expect(irrigationGuide(q.game.flags)).not.toBeNull();
  q.teleport({ x: 17.5, z: -227 });
  expect(q.use(17, 21, -229)).toBe(true);
  q.advance(.5);
  expect(q.game.flags.is('step.ground.ditch')).toBe(true);
  expect(irrigationGuide(q.game.flags)).toBeNull();
  expect(q.count('spade')).toBe(tools);
  for (let x = ARRIVAL_IRRIGATION.field.x0; x <= ARRIVAL_IRRIGATION.field.x1; x++)
    for (let z = ARRIVAL_IRRIGATION.field.z0; z <= ARRIVAL_IRRIGATION.field.z1; z++)
      expect(q.world.getBlock(x, 21, z)).toBe(blockId('tilled_soil'));
  const finished = q.reload(); finished.advance(.1);
  expect(irrigationGuide(finished.game.flags)).toBeNull();
});

test('no irrigation marks appear before the task or during later ground steps', () => {
  const p = newPlay();
  expect(irrigationGuide(p.game.flags)).toBeNull();
  p.sys.quests.skipTo('ground'); p.game.flags.set('scene.7', true); p.advance(.1);
  expect(irrigationGuide(p.game.flags)).not.toBeNull();
  p.game.flags.set('quest.ground.step', 'camp');
  expect(irrigationGuide(p.game.flags)).toBeNull();
  p.game.flags.set('quest.ground.step', 'ditch'); p.game.flags.set('quest.ground.done', true);
  expect(irrigationGuide(p.game.flags)).toBeNull();
});
