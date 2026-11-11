import { expect, test } from 'bun:test';
import { AIR, blockId } from '../../content/blocks.ts';
import { TOWN_X } from '../actions/stage.ts';
import type { GameEvents } from '../api.sim.ts';
import { AREA_SPAN, LINE_SPAN, strokeCells } from './plan.sim.ts';
import { makeBuildStage } from './stage.ts';

const GRASS = blockId('grass'), TILLED = blockId('tilled_soil'), STONE = blockId('stone'), PLANK = blockId('oak_plank'), BARRIER = blockId('barrier');

test('a rectangle lists every cell once, nearest the press first, and a line never bends', () => {
  const cells: { x: number; z: number; verdict: string }[] = [], pool: never[] = [];
  strokeCells('area', 5, 5, 7, 4, cells as never, pool);
  expect(cells.map((c) => `${c.x},${c.z}`)).toEqual(['5,5', '5,4', '6,4', '6,5', '7,4', '7,5']);
  strokeCells('area', 0, 0, 40, -40, cells as never, pool);
  expect(cells.length).toBe(AREA_SPAN * AREA_SPAN);
  expect(new Set(cells.map((c) => `${c.x},${c.z}`)).size).toBe(AREA_SPAN * AREA_SPAN);
  strokeCells('line', 5, 5, 8, 3, cells as never, pool);
  expect(cells.map((c) => `${c.x},${c.z}`)).toEqual(['5,5', '6,5', '7,5', '8,5']);
  strokeCells('line', 5, 5, 6, -40, cells as never, pool);
  expect(cells.length).toBe(LINE_SPAN);
  expect(cells.every((c) => c.x === 5)).toBe(true);
  strokeCells('one', 5, 5, 8, 3, cells as never, pool);
  expect(cells.map((c) => `${c.x},${c.z}`)).toEqual(['8,3']);
});

test('the hoe tills a dragged rectangle in one stroke, and leaves what is tilled already', () => {
  const s = makeBuildStage();
  s.hold('hoe');
  s.world.setBlock(4, s.floor, 3, TILLED);
  s.point(3, 3);
  expect(s.build.press()).toBe(true);
  s.point(5, 4);
  expect(s.build.dragging).toBe(true);
  expect(s.verdicts().sort()).toEqual(['3,3:ok', '3,4:ok', '4,3:skip', '4,4:ok', '5,3:ok', '5,4:ok']);
  expect(s.blocks(3, 3, 5, 4)).toEqual([GRASS, TILLED, GRASS, GRASS, GRASS, GRASS]);
  expect(s.build.release()).toBe(5);
  expect(s.build.dragging).toBe(false);
  expect(s.blocks(3, 3, 5, 4)).toEqual([TILLED, TILLED, TILLED, TILLED, TILLED, TILLED]);
  expect(s.heard.filter((e) => e.name === 'soil.tilled').length).toBe(5);
  expect(s.heard.filter((e) => e.name === 'build.applied').map((e) => e.data)).toEqual([{ kind: 'till', count: 5, undone: false }]);
});

test('a stroke stops at the town, at stone, under a block and out of reach, and says which', () => {
  const s = makeBuildStage();
  s.hold('hoe');
  s.world.setBlock(7, s.floor, 5, STONE);
  s.world.setBlock(8, s.floor + 1, 5, STONE);
  s.point(6, 5);
  s.build.press();
  s.point(TOWN_X + 1, 5);
  expect(s.verdicts()).toEqual(['6,5:ok', '7,5:wrong', '8,5:blocked', '9,5:ok', '10,5:town', '11,5:town']);
  expect(s.build.release()).toBe(2);
  // The player stands at 5.5: a cell 13 blocks off is too far, and a release changes only what is in reach.
  s.kernel.game.player.pos.z = -8;
  s.point(3, 5);
  expect(s.verdicts()).toEqual(['3,5:far']);
  expect(s.stroke(3, 5, 3, 5)).toBe(0);
  expect(s.world.getBlock(3, s.floor, 5)).toBe(GRASS);
});

test('seeds plant the tilled cells nearest the press, one seed each, and show what the bag is short of', () => {
  const s = makeBuildStage();
  const { inventory, crops } = s.kernel.game.systems;
  s.hold('hoe');
  expect(s.stroke(3, 3, 6, 4)).toBe(8);
  s.hold('wheat_seeds', 5);
  s.point(3, 3);
  s.build.press();
  s.point(6, 5);
  const plan = s.build.plan()!;
  expect([plan.ok, plan.short, plan.refused, plan.have]).toEqual([5, 3, 4, 5]);
  expect(s.verdicts().slice(0, 6)).toEqual(['3,3:ok', '3,4:ok', '4,4:ok', '4,3:ok', '3,5:wrong', '4,5:wrong']);
  expect(s.build.release()).toBe(5);
  expect(inventory.count('wheat_seeds')).toBe(0);
  expect(crops.all().length).toBe(5);
  // The hand is empty now, so there is nothing to stroke with.
  s.point(6, 3);
  expect(s.build.press()).toBe(false);
});

test('a cancelled stroke changes nothing, and so does a release after the hand changed', () => {
  const s = makeBuildStage();
  const { inventory } = s.kernel.game.systems;
  s.hold('hoe');
  s.hold('wheat_seeds', 4);
  inventory.selected = 0;
  s.point(3, 3);
  s.build.press();
  s.point(5, 5);
  expect(s.build.cancel()).toBe(true);
  expect(s.build.release()).toBe(-1);
  expect(s.blocks(3, 3, 5, 5).every((id) => id === GRASS)).toBe(true);

  // Pressed with the hoe, released with the seeds in hand: the stroke is dropped, not planted or tilled.
  s.point(3, 3);
  s.build.press();
  s.point(5, 5);
  inventory.selected = 1;
  expect(s.build.release()).toBe(0);
  expect(s.build.dragging).toBe(false);
  expect(s.blocks(3, 3, 5, 5).every((id) => id === GRASS)).toBe(true);
  expect(inventory.count('wheat_seeds')).toBe(4);
});

test('a panel, a new item in the hand and leaving build mode each end a stroke by the next step', () => {
  const s = makeBuildStage();
  const { inventory } = s.kernel.game.systems;
  const game = s.kernel.game;
  s.hold('hoe');
  s.hold('wheat_seeds', 4);
  inventory.selected = 0;
  const begin = (): void => { s.build.setActive(true); s.point(3, 3); expect(s.build.press()).toBe(true); };

  begin();
  inventory.selected = 1;
  s.kernel.step();
  expect(s.build.dragging).toBe(false);
  inventory.selected = 0;

  begin();
  game.player.busy = true;
  s.kernel.step();
  expect([s.build.dragging, s.build.active]).toEqual([false, false]);
  // Nothing starts while a panel has the player.
  s.build.setActive(true);
  expect(s.build.active).toBe(false);
  game.player.busy = false;

  begin();
  s.build.setActive(false);
  expect(s.build.dragging).toBe(false);
  expect(s.build.release()).toBe(-1);
  expect(s.blocks(3, 3, 3, 3)).toEqual([GRASS]);
});

test('undo puts the last stroke back and returns what it took', () => {
  const s = makeBuildStage();
  const { inventory, crops } = s.kernel.game.systems;
  s.hold('hoe');
  s.stroke(3, 3, 5, 4);
  s.hold('wheat_seeds', 6);
  expect(s.stroke(3, 3, 5, 4)).toBe(6);
  expect(inventory.count('wheat_seeds')).toBe(0);
  expect(s.build.canUndo).toBe(true);
  expect(s.build.undo()).toBe(true);
  expect(inventory.count('wheat_seeds')).toBe(6);
  expect(crops.all().length).toBe(0);
  expect(s.blocks(3, 3, 5, 4).every((id) => id === TILLED)).toBe(true);
  // One stroke back and no further.
  expect(s.build.undo()).toBe(false);

  inventory.selected = 0;
  s.stroke(7, 7, 8, 7);
  expect(s.build.undo()).toBe(true);
  expect(s.blocks(7, 7, 8, 7)).toEqual([GRASS, GRASS]);
});

test('undo leaves a cell that changed since the stroke', () => {
  const s = makeBuildStage();
  const { inventory, crops } = s.kernel.game.systems;
  s.hold('hoe');
  s.stroke(3, 3, 4, 3);
  // Something was planted on one of the two cells after the stroke: that soil stays tilled.
  expect(crops.plant(3, s.floor, 3, 'wheat_seeds')).toBe(true);
  expect(s.build.undo()).toBe(true);
  expect(s.blocks(3, 3, 4, 3)).toEqual([TILLED, GRASS]);
  expect(crops.at(3, s.floor, 3)).not.toBeNull();

  s.hold('plank', 3);
  expect(s.stroke(6, 7, 8, 7)).toBe(3);
  s.world.setBlock(7, s.floor + 1, 7, STONE);
  expect(s.build.undo()).toBe(true);
  expect(s.blocks(6, 7, 8, 7, s.floor + 1)).toEqual([AIR, STONE, AIR]);
  expect(inventory.count('plank')).toBe(2);
});

test('blocks and fences go down in a straight line and skip what is there', () => {
  const s = makeBuildStage();
  const { inventory, placeables } = s.kernel.game.systems;
  s.hold('plank', 10);
  expect(s.stroke(2, 8, 6, 9)).toBe(5);
  expect(s.blocks(2, 8, 6, 8, s.floor + 1)).toEqual([PLANK, PLANK, PLANK, PLANK, PLANK]);
  expect(inventory.count('plank')).toBe(5);
  expect(s.heard.filter((e) => e.name === 'block.placed').length).toBe(5);

  s.hold('fence', 8);
  expect(s.stroke(2, 10, 5, 10)).toBe(4);
  expect(placeables.all().map((p) => `${p.kind}@${p.x},${p.z}`)).toEqual(['fence@2,10', 'fence@3,10', 'fence@4,10', 'fence@5,10']);
  // A second line across the first takes one fence fewer: the crossing is there already.
  s.point(4, 9);
  s.build.press();
  s.point(4, 12);
  expect(s.verdicts()).toEqual(['4,9:ok', '4,10:skip', '4,11:ok', '4,12:ok']);
  expect(s.build.release()).toBe(3);
  expect(inventory.count('fence')).toBe(1);
});

test('nothing is built where somebody stands', () => {
  const s = makeBuildStage();
  s.hold('plank', 10);
  // The player stands at 5.5, 5.5.
  s.point(4, 5);
  s.build.press();
  s.point(6, 5);
  expect(s.verdicts()).toEqual(['4,5:ok', '5,5:blocked', '6,5:ok']);
  expect(s.build.release()).toBe(2);
});

test('a chest turns its back to the wall beside it, and to the player with no wall', () => {
  const s = makeBuildStage();
  const game = s.kernel.game;
  s.hold('chest', 4);
  // The player looks north (facing 0), so a thing that faces the player has its front to the south: two turns.
  game.player.facing = 0;
  s.point(3, 8);
  expect(s.build.plan()!.turns).toBe(2);

  // A wall east of the cell: the back goes to it, so the front faces west.
  s.world.setBlock(4, s.floor + 1, 8, PLANK);
  expect(s.build.plan()!.turns).toBe(3);
  // A wall north as well: of the two, the front that faces the player wins.
  s.world.setBlock(3, s.floor + 1, 7, PLANK);
  expect(s.build.plan()!.turns).toBe(2);

  expect(s.stroke(3, 8, 3, 8)).toBe(1);
  expect(game.systems.placeables.all()[0]).toMatchObject({ kind: 'chest', x: 3, y: s.floor + 1, z: 8, quarterTurns: 2 });
});

test('a turn by hand holds until another item is in the hand', () => {
  const s = makeBuildStage();
  const { inventory } = s.kernel.game.systems;
  s.kernel.game.player.facing = 0;
  s.hold('chest', 2);
  s.hold('hoe');
  inventory.selected = 0;
  s.point(3, 8);
  s.build.turn(1);
  expect(s.build.plan()!.turns).toBe(3);
  s.build.turn(-1);
  s.build.turn(-1);
  expect(s.build.plan()!.turns).toBe(1);
  s.point(7, 7);
  expect(s.build.plan()!.turns).toBe(1);
  inventory.selected = 1;
  s.build.plan();
  inventory.selected = 0;
  expect(s.build.plan()!.turns).toBe(2);
});

test('a placed thing follows the pointer and lands where the button comes up', () => {
  const s = makeBuildStage();
  s.hold('chest', 1);
  s.point(3, 8);
  s.build.press();
  s.point(7, 9);
  expect(s.verdicts()).toEqual(['7,9:ok']);
  expect(s.build.release()).toBe(1);
  expect(s.kernel.game.systems.placeables.at(7, s.floor + 1, 9)?.kind).toBe('chest');
  expect(s.kernel.game.systems.placeables.at(3, s.floor + 1, 8)).toBeNull();
});

test('a press on a placed thing takes it back into the hand', () => {
  const s = makeBuildStage();
  const { inventory, placeables } = s.kernel.game.systems;
  s.hold('chest', 1);
  s.stroke(3, 8, 3, 8);
  s.hold('hoe');
  expect(inventory.held()?.id).toBe('hoe');
  // The pointer is on the chest itself: its unseen block, one above the floor.
  s.build.point({ x: 3, y: s.floor + 1, z: 8, nx: 0, ny: 1, nz: 0 });
  expect(s.build.plan()!.lift?.kind).toBe('chest');
  expect(s.build.press()).toBe(true);
  expect(s.build.dragging).toBe(false);
  expect(placeables.all().length).toBe(0);
  expect(s.world.getBlock(3, s.floor + 1, 8)).not.toBe(BARRIER);
  expect(inventory.held()).toEqual({ id: 'chest', count: 1 });
  // And it goes down again one cell on.
  expect(s.stroke(4, 8, 4, 8)).toBe(1);
  expect(placeables.all().length).toBe(1);
});

test('a pointer on the side of a wall means the ground in front of it', () => {
  const s = makeBuildStage();
  s.hold('hoe');
  s.world.setBlock(6, s.floor + 1, 8, PLANK);
  s.world.setBlock(6, s.floor + 2, 8, PLANK);
  // The west face of the upper wall block: the open cell west of it, and the ground two below.
  s.build.point({ x: 6, y: s.floor + 2, z: 8, nx: -1, ny: 0, nz: 0 });
  expect(s.verdicts()).toEqual(['5,8:ok']);
  expect(s.build.plan()!.y).toBe(s.floor);
  s.build.point({ x: 6, y: s.floor + 2, z: 8, nx: 0, ny: -1, nz: 0 });
  expect(s.build.plan()).toBeNull();
});

test('the can wets the soil it is dragged over and sends one event', () => {
  const s = makeBuildStage();
  const { crops } = s.kernel.game.systems;
  s.hold('hoe');
  s.stroke(3, 3, 5, 3);
  crops.plant(5, s.floor, 3, 'wheat_seeds');
  s.hold('watering_can');
  s.heard.length = 0;
  expect(s.stroke(2, 3, 5, 3)).toBe(3);
  expect(crops.at(5, s.floor, 3)!.wet).toBeGreaterThan(0);
  const watered = s.heard.filter((e) => e.name === 'crop.watered').map((e) => e.data as GameEvents['crop.watered']);
  expect(watered).toEqual([{ x: 5, y: s.floor, z: 3 }]);
});

test('a sprinkler keeps the soil two blocks around it wet', () => {
  const s = makeBuildStage();
  const { crops } = s.kernel.game.systems;
  s.hold('hoe');
  s.stroke(2, 8, 8, 8);
  s.hold('wheat_seeds', 7);
  expect(s.stroke(2, 8, 8, 8)).toBe(7);
  s.hold('sprinkler', 1);
  expect(s.stroke(5, 9, 5, 9)).toBe(1);
  s.wait(0.1);
  const wet = [2, 3, 4, 5, 6, 7, 8].map((x) => crops.at(x, s.floor, 8)!.wet > 0);
  expect(wet).toEqual([false, true, true, true, true, true, false]);
  expect(s.heard.filter((e) => e.name === 'sprinkler.ran').map((e) => e.data)).toEqual([{ x: 5, y: s.floor + 1, z: 9, reach: 2 }]);
  // Soil dries in 180 seconds. It is still wet after 400.
  s.wait(400);
  expect(crops.at(4, s.floor, 8)!.wet).toBeGreaterThan(0);
});
