import { expect, test } from 'bun:test';
import { AIR, blockId } from '../../content/blocks.ts';
import type { UseContext } from '../api.sim.ts';
import { install as installCrops } from '../crops/index.sim.ts';
import { BAG_FULL_TOAST, HOLD_TO_BREAK, NO_GROUND_TOAST, NO_ROOM_TOAST, TOWN_TOAST } from './index.sim.ts';
import { BLOCKS } from '../../content/blocks.ts';
import { TOWN_X, makeStage, type Stage } from './stage.ts';

const LOG = blockId('oak_log'), STONE = blockId('stone'), GRASS = blockId('grass'), LEAVES = blockId('oak_leaves');
const DIRT = blockId('dirt'), THATCH = blockId('thatch'), OAK_PLANK = blockId('oak_plank');

/** Holds the button in steps of 0.05 seconds. Returns how many steps it took to break, or 0 when it never did. */
function holdsToBreak(s: Stage, context: UseContext, most = 100): number {
  for (let n = 1; n <= most; n++) if (s.kernel.game.systems.actions.hold(context, 0.05)) return n;
  return 0;
}

const named = (s: Stage, name: string) => s.heard.filter((e) => e.name === name).map((e) => e.data);

test('a log takes 1.5 seconds by hand, and a held axe cuts it in 0.5', () => {
  const s = makeStage();
  const g = s.ground, { inventory } = s.kernel.game.systems;
  s.world.setBlock(7, g, 5, LOG);
  expect(holdsToBreak(s, s.context('primary', s.hit(7, g, 5, -1, 0, 0)))).toBe(30);
  expect(s.world.getBlock(7, g, 5)).toBe(AIR);
  expect(inventory.count('oak_log')).toBe(1);
  expect(named(s, 'block.broken')).toEqual([{ x: 7, y: g, z: 5, id: LOG, by: 'player' }]);
  expect(named(s, 'item.gained')).toEqual([{ id: 'oak_log', count: 1, at: { x: 7.5, y: g + 0.5, z: 5.5 } }]);

  s.world.setBlock(7, g, 5, LOG);
  inventory.add('axe', 1);
  inventory.selected = 1;
  expect(inventory.held()?.id).toBe('axe');
  expect(holdsToBreak(s, s.context('primary', s.hit(7, g, 5, -1, 0, 0)))).toBe(10);
  expect(inventory.count('oak_log')).toBe(2);
});

test('stone refuses hands and says what it needs once, and a pickaxe breaks it in 1 second', () => {
  const s = makeStage();
  const g = s.ground, { inventory, actions } = s.kernel.game.systems;
  s.world.setBlock(7, g, 5, STONE);
  expect(holdsToBreak(s, s.context('primary', s.hit(7, g, 5, -1, 0, 0)))).toBe(0);
  expect(s.world.getBlock(7, g, 5)).toBe(STONE);
  expect(actions.breaking()).toBeNull();
  expect(inventory.count('stone')).toBe(0);
  expect(s.toasts()).toEqual(['This needs a pickaxe.']);

  inventory.add('axe', 1);
  expect(holdsToBreak(s, s.context('primary', s.hit(7, g, 5, -1, 0, 0)))).toBe(0);
  inventory.add('pickaxe', 1);
  inventory.selected = 1;
  expect(holdsToBreak(s, s.context('primary', s.hit(7, g, 5, -1, 0, 0)))).toBe(20);
  expect(inventory.count('stone')).toBe(1);
});

test('the other blocks take the time the design gives them', () => {
  const s = makeStage();
  const g = s.ground;
  const seconds = (key: string): number => {
    s.world.setBlock(7, g, 5, blockId(key));
    return holdsToBreak(s, s.context('primary', s.hit(7, g, 5, -1, 0, 0), null)) / 20;
  };
  // Grass and leaves would go in a quarter of a second, but nothing breaks quicker than a held press.
  expect(HOLD_TO_BREAK).toBe(0.4);
  expect(seconds('grass')).toBe(0.4);
  expect(seconds('oak_leaves')).toBe(0.4);
  expect(seconds('dirt')).toBe(0.5);
  expect(seconds('sand')).toBe(0.5);
  expect(seconds('oak_plank')).toBe(0.6);
  expect(seconds('cobble')).toBe(0.6);
  expect(seconds('glass')).toBe(0.6);
  expect(seconds('mossy_stone')).toBe(0);
});

test('a town block refuses a break and a place, and the toast shows once in 3 seconds', () => {
  const s = makeStage();
  const g = s.ground, { inventory, actions } = s.kernel.game.systems;
  s.kernel.game.player.pos.x = 8.5;
  s.world.setBlock(TOWN_X + 1, g, 5, DIRT);
  const town = s.context('primary', s.hit(TOWN_X + 1, g, 5, -1, 0, 0));
  for (let i = 0; i < 20; i++) {
    expect(actions.hold(town, 0.05)).toBe(false);
    s.kernel.step();
  }
  expect(s.world.getBlock(TOWN_X + 1, g, 5)).toBe(DIRT);
  expect(actions.breaking()).toBeNull();
  expect(s.toasts()).toEqual([TOWN_TOAST]);

  // Placing into the town is refused as well, and it is still inside the same 3 seconds.
  inventory.add('dirt', 5);
  inventory.add('workbench', 1);
  expect(actions.use(s.context('secondary', s.hit(TOWN_X, g - 1, 5)))).toBe(false);
  expect(actions.use(s.context('secondary', s.hit(TOWN_X, g - 1, 5), { id: 'workbench', count: 1 }))).toBe(false);
  expect(s.world.getBlock(TOWN_X, g, 5)).toBe(AIR);
  expect(inventory.count('dirt')).toBe(5);
  expect(s.kernel.game.systems.placeables.all()).toEqual([]);
  expect(s.toasts()).toEqual([TOWN_TOAST]);

  s.wait(2.1);
  expect(actions.hold(town, 0.05)).toBe(false);
  expect(s.toasts()).toEqual([TOWN_TOAST, TOWN_TOAST]);

  // One block short of the town, the same click works.
  expect(actions.use(s.context('secondary', s.hit(TOWN_X - 1, g - 1, 5)))).toBe(true);
  expect(s.world.getBlock(TOWN_X - 1, g, 5)).toBe(DIRT);
});

test('grass gives dirt and fiber one time in five, leaves give fiber one time in two', () => {
  const s = makeStage();
  const g = s.ground, { inventory } = s.kernel.game.systems;
  const context = (): UseContext => s.context('primary', s.hit(7, g, 5, -1, 0, 0), null);
  for (let i = 0; i < 200; i++) {
    s.world.setBlock(7, g, 5, GRASS);
    expect(holdsToBreak(s, context())).toBe(8);
  }
  expect(inventory.count('dirt')).toBe(200);
  const fromGrass = inventory.count('fiber');
  expect(fromGrass).toBeGreaterThan(25);
  expect(fromGrass).toBeLessThan(55);
  for (let i = 0; i < 200; i++) {
    s.world.setBlock(7, g, 5, LEAVES);
    expect(holdsToBreak(s, context())).toBe(8);
  }
  const fromLeaves = inventory.count('fiber') - fromGrass;
  expect(fromLeaves).toBeGreaterThan(80);
  expect(fromLeaves).toBeLessThan(120);
  expect(inventory.count('dirt')).toBe(200);
});

test('a placed block comes from the held stack and gives itself back', () => {
  const s = makeStage();
  const g = s.ground, { inventory, actions } = s.kernel.game.systems;
  inventory.add('thatch', 2);
  expect(actions.use(s.context('secondary', s.hit(7, g - 1, 5)))).toBe(true);
  expect(s.world.getBlock(7, g, 5)).toBe(THATCH);
  expect(inventory.count('thatch')).toBe(1);
  expect(named(s, 'block.placed')).toEqual([{ x: 7, y: g, z: 5, id: THATCH, by: 'player' }]);
  expect(named(s, 'item.lost')).toEqual([{ id: 'thatch', count: 1 }]);
  expect(holdsToBreak(s, s.context('primary', s.hit(7, g, 5)))).toBe(12);
  expect(inventory.count('thatch')).toBe(2);
});

test('a plank places oak planks, and breaking them gives the plank back', () => {
  const s = makeStage();
  const g = s.ground, { inventory, actions } = s.kernel.game.systems;
  inventory.add('plank', 1);
  expect(actions.use(s.context('secondary', s.hit(7, g - 1, 5)))).toBe(true);
  expect(s.world.getBlock(7, g, 5)).toBe(OAK_PLANK);
  expect(inventory.count('plank')).toBe(0);
  expect(holdsToBreak(s, s.context('primary', s.hit(7, g, 5), null))).toBe(12);
  expect(inventory.count('plank')).toBe(1);
  expect(inventory.count('oak_plank')).toBe(0);
});

test('a block goes on the face that was hit, never inside the player or another block', () => {
  const s = makeStage();
  const g = s.ground, { inventory, actions } = s.kernel.game.systems;
  inventory.add('dirt', 10);
  s.world.setBlock(7, g, 5, STONE);
  s.world.setBlock(6, g + 1, 5, STONE);

  // The west face of the stone: the block lands beside it.
  expect(actions.use(s.context('secondary', s.hit(7, g, 5, -1, 0, 0)))).toBe(true);
  expect(s.world.getBlock(6, g, 5)).toBe(DIRT);
  // The same face again: that cell is taken now.
  expect(actions.use(s.context('secondary', s.hit(7, g, 5, -1, 0, 0)))).toBe(false);
  // The floor under the player's feet, and the cell at the player's head.
  expect(actions.use(s.context('secondary', s.hit(5, g - 1, 5)))).toBe(false);
  expect(actions.use(s.context('secondary', s.hit(6, g + 1, 5, -1, 0, 0)))).toBe(false);
  expect(s.world.getBlock(5, g, 5)).toBe(AIR);
  expect(s.world.getBlock(5, g + 1, 5)).toBe(AIR);
  // Right above the head is free.
  expect(actions.use(s.context('secondary', s.hit(6, g + 2, 5, -1, 0, 0)))).toBe(false);
  s.world.setBlock(6, g + 2, 5, STONE);
  expect(actions.use(s.context('secondary', s.hit(6, g + 2, 5, -1, 0, 0)))).toBe(true);
  expect(s.world.getBlock(5, g + 2, 5)).toBe(DIRT);
  expect(inventory.count('dirt')).toBe(8);

  // Nothing in the hand, a tool in the hand, or no block under the pointer: nothing is placed.
  expect(actions.use(s.context('secondary', s.hit(8, g - 1, 8), null))).toBe(false);
  expect(actions.use(s.context('secondary', s.hit(8, g - 1, 8), { id: 'axe', count: 1 }))).toBe(false);
  expect(actions.use(s.context('secondary', null))).toBe(false);
  expect(s.world.getBlock(8, g, 8)).toBe(AIR);
});

test('a block is not placed onto a person or a pet', () => {
  const s = makeStage();
  const g = s.ground, { inventory, actions } = s.kernel.game.systems;
  inventory.add('dirt', 2);
  s.kernel.game.actors.set('npc:tamsin', { id: 'npc:tamsin', sprite: 'villager-a', pos: { x: 7.5, y: g, z: 5.5 }, facing: 0, anim: 'idle', visible: true });
  expect(actions.use(s.context('secondary', s.hit(7, g - 1, 5)))).toBe(false);
  expect(actions.use(s.context('secondary', s.hit(8, g - 1, 5)))).toBe(true);
});

test('reach is 5 blocks from the eyes', () => {
  const s = makeStage();
  const g = s.ground, { inventory, actions } = s.kernel.game.systems;
  s.world.setBlock(5, g, 12, DIRT);
  s.world.setBlock(5, g, 10, DIRT);
  inventory.add('thatch', 1);
  expect(actions.reach).toBe(5);
  expect(holdsToBreak(s, s.context('primary', s.hit(5, g, 12, 0, 0, -1)))).toBe(0);
  expect(actions.use(s.context('secondary', s.hit(5, g, 12, 0, 0, -1)))).toBe(false);
  expect(actions.breaking()).toBeNull();
  expect(s.world.getBlock(5, g, 12)).toBe(DIRT);
  expect(holdsToBreak(s, s.context('primary', s.hit(5, g, 10, 0, 0, -1)))).toBe(10);
  expect(inventory.count('dirt')).toBe(1);
});

test('handlers get the click first, in the order they were added, and a click one of them took does not dig', () => {
  const s = makeStage();
  const g = s.ground, { actions } = s.kernel.game.systems;
  s.world.setBlock(7, g, 5, DIRT);
  const calls: string[] = [];
  let take = true;
  actions.addHandler(() => (calls.push('first'), false));
  actions.addHandler((context) => (calls.push('second'), take && context.button === 'primary'));
  const click = s.context('primary', s.hit(7, g, 5, -1, 0, 0), null);

  expect(actions.use(click)).toBe(true);
  expect(calls).toEqual(['first', 'second']);
  expect(holdsToBreak(s, click, 40)).toBe(0);
  expect(actions.breaking()).toBeNull();
  expect(s.world.getBlock(7, g, 5)).toBe(DIRT);

  // No handler wants the next click, so it starts the break and holding finishes it.
  take = false;
  expect(actions.use(click)).toBe(true);
  expect(actions.breaking()).toEqual({ x: 7, y: g, z: 5, progress: 0, tree: null });
  expect(holdsToBreak(s, click)).toBe(10);
  expect(calls).toEqual(['first', 'second', 'first', 'second']);
  // A click on nothing does nothing.
  expect(actions.use(s.context('primary', null))).toBe(false);
});

test('nothing breaks or places while the player is busy', () => {
  const s = makeStage();
  const g = s.ground, { inventory, actions } = s.kernel.game.systems;
  s.world.setBlock(7, g, 5, DIRT);
  inventory.add('thatch', 1);
  s.kernel.game.player.busy = true;
  expect(holdsToBreak(s, s.context('primary', s.hit(7, g, 5, -1, 0, 0)))).toBe(0);
  expect(actions.use(s.context('primary', s.hit(7, g, 5, -1, 0, 0)))).toBe(false);
  expect(actions.use(s.context('secondary', s.hit(8, g - 1, 5)))).toBe(false);
  expect(s.world.getBlock(7, g, 5)).toBe(DIRT);
  expect(s.world.getBlock(8, g, 5)).toBe(AIR);
});

test('the meter fills while the button is held, hides on release, and starts over after half a second or on another block', () => {
  const s = makeStage();
  const g = s.ground, { actions } = s.kernel.game.systems;
  s.world.setBlock(7, g, 5, LOG);
  s.world.setBlock(7, g, 7, LOG);
  const log = s.context('primary', s.hit(7, g, 5, -1, 0, 0), null);
  for (let i = 0; i < 10; i++) actions.hold(log, 0.05);
  expect(actions.breaking()).toMatchObject({ x: 7, y: g, z: 5 });
  expect(actions.breaking()?.progress).toBeCloseTo(1 / 3, 6);

  // Released for a moment: the meter hides, and the work so far is kept.
  s.wait(0.1);
  expect(actions.breaking()).toBeNull();
  actions.hold(log, 0.05);
  expect(actions.breaking()?.progress).toBeCloseTo(11 / 30, 6);

  // Released for longer: it starts over.
  s.wait(0.6);
  actions.hold(log, 0.05);
  expect(actions.breaking()?.progress).toBeCloseTo(1 / 30, 6);

  // Another block starts from nothing.
  actions.hold(s.context('primary', s.hit(7, g, 7, -1, 0, 0), null), 0.05);
  expect(actions.breaking()).toMatchObject({ x: 7, y: g, z: 7 });
  expect(actions.breaking()?.progress).toBeCloseTo(1 / 30, 6);
  expect(s.world.getBlock(7, g, 5)).toBe(LOG);
});

test('a held workbench is placed on the ground, near() is then true, and holding the primary button takes it back', () => {
  const s = makeStage();
  const g = s.ground, game = s.kernel.game, { inventory, actions, placeables } = game.systems;
  inventory.add('workbench', 1);
  expect(placeables.near('workbench', game.player.pos, 5)).toBe(false);

  // On the side of a block in the air there is no ground under it.
  s.world.setBlock(7, g + 2, 5, STONE);
  expect(actions.use(s.context('secondary', s.hit(7, g + 2, 5, -1, 0, 0)))).toBe(false);
  expect(s.toasts()).toEqual([NO_GROUND_TOAST]);
  // The player's own cell is refused too.
  expect(actions.use(s.context('secondary', s.hit(5, g - 1, 5)))).toBe(false);
  expect(placeables.all()).toEqual([]);

  expect(actions.use(s.context('secondary', s.hit(7, g - 1, 5)))).toBe(true);
  expect(placeables.all()).toMatchObject([{ kind: 'workbench', x: 7, y: g, z: 5 }]);
  expect(placeables.near('workbench', game.player.pos, 5)).toBe(true);
  expect(inventory.count('workbench')).toBe(0);
  expect(named(s, 'placeable.placed')).toEqual([{ kind: 'workbench', x: 7, y: g, z: 5 }]);

  // A block is not placed into it, and the floor under it cannot be dug out.
  inventory.add('pickaxe', 1);
  inventory.add('dirt', 1);
  expect(actions.use(s.context('secondary', s.hit(7, g - 1, 5), { id: 'dirt', count: 1 }))).toBe(false);
  expect(holdsToBreak(s, s.context('primary', s.hit(7, g - 1, 5, 0, -1, 0), { id: 'pickaxe', count: 1 }))).toBe(0);
  expect(s.world.getBlock(7, g - 1, 5)).toBe(STONE);

  // Holding the primary button on it for 0.6 seconds brings it back into the bag.
  expect(holdsToBreak(s, s.context('primary', s.hit(7, g - 1, 5), null))).toBe(12);
  expect(placeables.all()).toEqual([]);
  expect(placeables.near('workbench', game.player.pos, 5)).toBe(false);
  expect(inventory.count('workbench')).toBe(1);
});

test('a bed is two blocks long: its foot goes on the clicked cell and it goes on the way the player faces', () => {
  const s = makeStage();
  const g = s.ground, game = s.kernel.game, { inventory, actions, placeables } = game.systems;
  inventory.add('bed', 2);
  // The player stands at 5.5, 5.5. Facing north the bed runs from 5, 3 to 5, 2, away from them.
  game.player.facing = 0;
  expect(actions.use(s.context('secondary', s.hit(5, g - 1, 3)))).toBe(true);
  expect(placeables.all()).toMatchObject([{ kind: 'bed', x: 5, y: g, z: 2, quarterTurns: 2 }]);
  expect([placeables.at(5, g, 2)?.kind, placeables.at(5, g, 3)?.kind, placeables.at(5, g, 4)]).toEqual(['bed', 'bed', null]);
  // Facing east it runs from 7, 5 to 8, 5. With the second cell blocked it does not go down.
  game.player.facing = Math.PI / 2;
  s.world.setBlock(8, g, 5, STONE);
  expect(actions.use(s.context('secondary', s.hit(7, g - 1, 5)))).toBe(false);
  expect(s.toasts().at(-1)).toBe(NO_ROOM_TOAST);
  s.world.setBlock(8, g, 5, AIR);
  expect(actions.use(s.context('secondary', s.hit(7, g - 1, 5)))).toBe(true);
  expect([placeables.at(7, g, 5)?.kind, placeables.at(8, g, 5)?.kind]).toEqual(['bed', 'bed']);
  expect(inventory.count('bed')).toBe(0);
});

test('a drop that does not fit is lost with a toast, and a station stays down when the bag is full', () => {
  const s = makeStage();
  const g = s.ground, { inventory, placeables } = s.kernel.game.systems;
  placeables.place('chest', 7, g, 7, 0);
  s.world.setBlock(7, g, 5, DIRT);
  inventory.add('axe', 36);
  expect(holdsToBreak(s, s.context('primary', s.hit(7, g, 5, -1, 0, 0)))).toBe(10);
  expect(s.world.getBlock(7, g, 5)).toBe(AIR);
  expect(s.toasts()).toEqual([BAG_FULL_TOAST]);
  expect(holdsToBreak(s, s.context('primary', s.hit(7, g - 1, 7)), 30)).toBe(0);
  expect(placeables.all().length).toBe(1);
});

test('a real ray from the eyes places on the face it hits and then breaks what it placed', () => {
  const s = makeStage();
  const g = s.ground, game = s.kernel.game, { inventory, actions } = game.systems;
  inventory.add('cobble', 2);
  s.world.setBlock(8, g, 5, STONE);
  const eye = { x: game.player.pos.x, y: game.player.pos.y + 1.6, z: game.player.pos.z };
  const look = (dx: number, dy: number, dz: number) => {
    const hit = s.hit(0, 0, 0);
    return s.world.raycast(eye.x, eye.y, eye.z, dx, dy, dz, actions.reach, hit) ? hit : null;
  };

  // Looking east and a little down: the ray meets the west face of the stone.
  const wall = look(1, -0.4, 0);
  expect(wall).toMatchObject({ x: 8, y: g, z: 5, nx: -1, ny: 0, nz: 0 });
  expect(actions.use(s.context('secondary', wall))).toBe(true);
  expect(s.world.getBlock(7, g, 5)).toBe(blockId('cobble'));

  // Looking steeply down ahead: the ray meets the top of the floor.
  const floor = look(0.2, -1, 0.6);
  expect(floor).toMatchObject({ y: g - 1, nx: 0, ny: 1, nz: 0 });
  expect(actions.use(s.context('secondary', floor))).toBe(true);
  expect(s.world.getBlock(floor!.x, g, floor!.z)).toBe(blockId('cobble'));

  // The same look east now meets the cobble, and holding breaks it in 0.6 seconds.
  const cobble = look(1, -0.4, 0);
  expect(cobble).toMatchObject({ x: 7, y: g, z: 5 });
  expect(holdsToBreak(s, s.context('primary', cobble))).toBe(12);
  expect(inventory.count('cobble')).toBe(1);
});

test('a short click breaks nothing, soft blocks and growing crops included, and quick clicks do not add up', () => {
  const s = makeStage();
  installCrops(s.kernel);
  // The crops system adds its click handler on its first step.
  s.wait(0.05);
  const g = s.ground, game = s.kernel.game, { actions, inventory, crops } = game.systems;
  /** One press of the left button as the shell makes it: use(), then hold() on every step the button is down. */
  const click = (hit: ReturnType<Stage['hit']>, held: UseContext['held'], seconds: number): void => {
    const context = s.context('primary', hit, held);
    actions.use(context);
    for (let t = 0; t < seconds - 1e-9; t += 0.05) {
      actions.hold(context, 0.05);
      s.wait(0.05);
    }
    s.wait(0.1);
  };
  inventory.add('axe', 1);
  inventory.add('pickaxe', 1);
  const tools = [null, { id: 'axe', count: 1 }, { id: 'pickaxe', count: 1 }];
  let tried = 0;
  for (const block of BLOCKS) {
    if (!block.solid) continue;
    for (const held of tools) {
      s.world.setBlock(7, g, 5, block.id);
      // Three quick clicks of a third of a second each, as a player who taps at a block.
      for (let k = 0; k < 3; k++) click(s.hit(7, g, 5, -1, 0, 0), held, 0.35);
      expect(s.world.getBlock(7, g, 5)).toBe(block.id);
      tried++;
    }
  }
  expect(tried).toBeGreaterThan(30);
  expect(named(s, 'block.broken')).toEqual([]);

  // A growing crop: a click on its soil leaves both.
  s.world.setBlock(7, g, 5, AIR);
  s.world.setBlock(7, g - 1, 5, DIRT);
  expect(crops.till(7, g - 1, 5)).toBe(true);
  expect(crops.plant(7, g - 1, 5, 'wheat_seeds')).toBe(true);
  for (let k = 0; k < 3; k++) click(s.hit(7, g - 1, 5), null, 0.35);
  expect(crops.at(7, g - 1, 5)).not.toBeNull();
  expect(named(s, 'block.broken')).toEqual([]);

  // Held on, the same block does break, once the hold passes the floor.
  s.world.setBlock(7, g, 5, GRASS);
  click(s.hit(7, g, 5, -1, 0, 0), null, HOLD_TO_BREAK + 0.05);
  expect(s.world.getBlock(7, g, 5)).toBe(AIR);
});
