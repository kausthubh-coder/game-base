// The machines on a small stage: a floor of grass with water let into it, a wheel, shafts and the parts on them.
import { expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { makeStage } from '../actions/stage.ts';
import type { GameEvents, MachineState } from '../api.sim.ts';
import { install as installCrops } from '../crops/index.sim.ts';
import { FLAG } from '../content/flags.ts';
import { install } from './index.sim.ts';

const WATER = blockId('water');
const GRASS = blockId('grass');

function setup() {
  const s = makeStage();
  const floor = s.ground - 1;
  for (let x = 1; x < 15; x++) for (let z = 1; z < 15; z++) s.world.setBlock(x, floor, z, GRASS);
  installCrops(s.kernel);
  install(s.kernel);
  s.kernel.step();
  const { machines, placeables, crops, inventory, actions } = s.kernel.game.systems;
  const place = (kind: string, x: number, z: number, turns = 0, y = s.ground) => {
    const placed = placeables.place(kind, x, y, z, turns);
    if (!placed) throw new Error(`${kind} would not stand at ${x}, ${z}`);
    return placed;
  };
  const stateOf = (id: string): MachineState | undefined => machines.part(id)?.state;
  /** A stream along x = 1, one block deep. */
  const stream = () => { for (let z = 1; z < 15; z++) s.world.setBlock(1, floor, z, WATER); };
  return { ...s, floor, machines, placeables, crops, inventory, actions, place, stateOf, stream };
}

test('a wheel on flat water makes 4, and its shaft runs every part on it at full speed while it asks for no more', () => {
  const t = setup();
  t.stream();
  const wheel = t.place('waterwheel', 1, 5);
  t.place('gear_shaft', 2, 5);
  t.place('gear_shaft', 3, 5);
  const a = t.place('sprinkler', 4, 5);
  const b = t.place('sprinkler', 5, 5);
  t.wait(0.5);
  expect(t.machines.part(wheel.id)).toMatchObject({ power: 4, state: 'working' });
  expect(t.machines.shafts()).toEqual([{ power: 4, wants: 2, speed: 1, on: true }]);
  expect([t.stateOf(a.id), t.stateOf(b.id)]).toEqual(['working', 'working']);
  expect(t.machines.turning()).toBe(true);
});

test('short of power, everything on the shaft runs slower, never stopped: 4 made and 6 asked for is two thirds', () => {
  const t = setup();
  t.stream();
  t.place('waterwheel', 1, 2);
  for (let x = 2; x <= 7; x++) t.place('sprinkler', x, 2);
  t.wait(0.5);
  const [shaft] = t.machines.shafts();
  expect(shaft.wants).toBe(6);
  expect(shaft.speed).toBeCloseTo(2 / 3, 5);
  expect(t.machines.parts().filter((p) => p.kind === 'sprinkler').every((p) => p.state === 'starved' && p.speed > 0.6)).toBe(true);
  // The soil the sprinklers reach is wet at their speed, and the cells under them grow nothing: they are not soil.
  expect(t.machines.sprinkled(3, t.floor, 3)).toBeCloseTo(2 / 3, 5);
  expect(t.machines.sprinkled(3, t.floor, 2)).toBeCloseTo(2 / 3, 5);
  expect(t.machines.sprinkled(3, t.floor, 5)).toBe(0);
});

test('a wheel where the water drops makes 6', () => {
  const t = setup();
  // The stream comes down a step: water a block higher beside the wheel's water.
  t.world.setBlock(1, t.floor, 5, WATER);
  t.world.setBlock(1, t.ground, 4, WATER);
  t.world.setBlock(1, t.floor, 4, blockId('stone'));
  expect(t.machines.wheelPower(1, t.ground, 5)).toBe(6);
  expect(t.machines.wheelPower(5, t.ground, 9)).toBe(0);
});

test('a wheel with no water is starved, and so is every part on its shaft', () => {
  const t = setup();
  const wheel = t.place('waterwheel', 4, 4);
  const sprinkler = t.place('sprinkler', 5, 4);
  t.wait(0.5);
  expect([t.stateOf(wheel.id), t.stateOf(sprinkler.id)]).toEqual(['starved', 'starved']);
  expect(t.machines.turning()).toBe(false);
});

test('a lever switches every part on its shaft, and its use says so', () => {
  const t = setup();
  t.stream();
  t.place('waterwheel', 1, 5);
  const lever = t.place('lever', 2, 5);
  const sprinkler = t.place('sprinkler', 3, 5);
  t.wait(0.5);
  expect(t.stateOf(sprinkler.id)).toBe('working');
  Object.assign(t.kernel.game.player.pos, { x: 3.5, z: 6.5 });
  expect(t.actions.use(t.context('secondary', t.hit(2, t.ground, 5, 0, 0, 1), null))).toBe(true);
  expect(t.machines.lever(lever.id)).toBe(false);
  expect(t.stateOf(sprinkler.id)).toBe('off');
  expect(t.stateOf(lever.id)).toBe('off');
  expect(t.machines.shafts()[0]).toMatchObject({ on: false, speed: 0 });
  expect(t.toasts()).toContain('The lever is down. Everything on its shaft stops.');
  expect(t.machines.sprinkled(4, t.floor, 6)).toBe(0);
});

test('a sensor runs its shaft while it sees what it watches: a ripe crop in front of a harvester arm', () => {
  const t = setup();
  t.stream();
  t.place('waterwheel', 1, 5);
  const sensor = t.place('sensor', 2, 5, 1);
  const arm = t.place('harvester_arm', 3, 5, 1);
  t.wait(0.5);
  expect(t.machines.sensor(sensor.id)).toBe('creature');
  // Set it twice: a creature, a good, then a ripe crop.
  Object.assign(t.kernel.game.player.pos, { x: 2.5, z: 6.5 });
  t.actions.use(t.context('secondary', t.hit(2, t.ground, 5, 0, 0, 1), null));
  t.actions.use(t.context('secondary', t.hit(2, t.ground, 5, 0, 0, 1), null));
  expect(t.machines.sensor(sensor.id)).toBe('ripe');
  expect(t.stateOf(arm.id)).toBe('off');
});

test('the harvester arm cuts the ripe crop in front of it, plants again, and a collector chest takes in what it cut', () => {
  const t = setup();
  t.stream();
  t.place('waterwheel', 1, 5);
  t.place('gear_shaft', 2, 5);
  const arm = t.place('harvester_arm', 3, 5, 1);
  const chest = t.place('collector_chest', 5, 7);
  // Wheat in front of the arm, beside water so it grows: a block of water let in at 4, 6.
  t.crops.till(4, t.floor, 5);
  t.crops.plant(4, t.floor, 5, 'wheat_seeds');
  t.world.setBlock(4, t.floor, 6, WATER);
  // The hero stands well away, or they would pick the wheat up themselves.
  Object.assign(t.kernel.game.player.pos, { x: 12.5, z: 12.5 });
  t.wait(1201);
  expect(t.stateOf(arm.id)).toBe('working');
  t.wait(7);
  // Cut and planted again, and the two wheat went into the chest.
  expect(t.crops.at(4, t.floor, 5)).toMatchObject({ crop: 'wheat', stage: 0 });
  expect(t.machines.chest(chest.id)?.find((s) => s.id === 'wheat')?.count).toBe(2);
  expect(t.inventory.count('wheat')).toBe(0);
  // Its use opens its panel, and emptying it puts the wheat in the bag.
  expect(t.machines.empty(chest.id)).toBeGreaterThanOrEqual(2);
  expect(t.inventory.count('wheat')).toBe(2);
});

test('a good on the ground goes into a collector chest within three blocks, and a full chest is backed up', () => {
  const t = setup();
  const chest = t.place('collector_chest', 8, 8);
  t.wait(0.3);
  t.machines.drop('copper', 5, { x: 10.5, y: t.ground, z: 11.5 });
  t.machines.drop('copper', 1, { x: 12.5, y: t.ground, z: 8.5 });
  t.wait(0.3);
  expect(t.machines.chest(chest.id)).toEqual([{ id: 'copper', count: 5 }]);
  expect(t.machines.loose().map((g) => [g.item, g.count])).toEqual([['copper', 1]]);
  t.machines.drop('quill', 60, { x: 8.5, y: t.ground, z: 9.5 });
  t.wait(0.5);
  expect(t.stateOf(chest.id)).toBe('backed up');
  expect(t.machines.loose().find((g) => g.item === 'quill')?.count).toBe(5);
});

test('the hero picks up a loose good by walking over it', () => {
  const t = setup();
  t.machines.drop('gear_spring', 2, { x: 3.5, y: t.ground, z: 3.5 });
  t.wait(0.1);
  expect(t.inventory.count('gear_spring')).toBe(0);
  Object.assign(t.kernel.game.player.pos, { x: 3.4, z: 3.6 });
  t.wait(0.1);
  expect(t.inventory.count('gear_spring')).toBe(2);
  expect(t.machines.loose()).toEqual([]);
});

test('a chute carries a good along to a collector chest at its end', () => {
  const t = setup();
  // Three chutes facing east, and a chest past the end, more than three blocks from where the good starts.
  t.place('chute', 2, 12, 1);
  t.place('chute', 3, 12, 1);
  t.place('chute', 4, 12, 1);
  const chest = t.place('collector_chest', 5, 12);
  t.machines.drop('honey', 3, { x: 2.5, y: t.ground, z: 12.5 });
  t.wait(0.2);
  expect(t.machines.loose()[0]).toMatchObject({ item: 'honey', x: 2.5 });
  t.wait(2);
  expect(t.machines.chest(chest.id)).toEqual([{ id: 'honey', count: 3 }]);
});

test('the spade digs a hole; beside water it fills, and a ditch that reaches tilled soil finishes the first day\'s step', () => {
  const t = setup();
  // The first day's quest is at its ditch step.
  t.kernel.game.flags.set(FLAG.questStep('ground'), 'ditch');
  t.world.setBlock(3, t.floor, 3, WATER);
  t.inventory.add('spade', 1);
  t.inventory.selected = t.inventory.slots.findIndex((s) => s?.id === 'spade');
  const dig = (x: number, z: number) => t.actions.use(t.context('secondary', t.hit(x, t.floor, z), t.inventory.held()));
  Object.assign(t.kernel.game.player.pos, { x: 5.5, z: 3.5 });
  expect(dig(8, 8)).toBe(true);
  expect(t.machines.hole(8, t.floor, 8)).toEqual({ x: 8, y: t.floor, z: 8, wet: false });
  t.crops.till(6, t.floor, 3);
  expect(dig(4, 3)).toBe(true);
  expect(t.world.getBlock(4, t.floor, 3)).toBe(WATER);
  expect(t.kernel.game.flags.is(FLAG.step('ground', 'ditch'))).toBe(false);
  // The next block on fills from the first, and it lies beside the tilled soil.
  expect(dig(5, 3)).toBe(true);
  t.wait(0.3);
  expect(t.world.getBlock(5, t.floor, 3)).toBe(WATER);
  expect(t.kernel.game.flags.is(FLAG.step('ground', 'ditch'))).toBe(true);
  // The town's ground is not dug.
  expect(dig(12, 3)).toBe(true);
  expect(t.machines.hole(12, t.floor, 3)).toBeUndefined();
  expect(t.toasts()).toContain('This belongs to the town.');
});

test('a part\'s state goes out as machine.state when it changes', () => {
  const t = setup();
  t.stream();
  const heard: GameEvents['machine.state'][] = [];
  t.kernel.game.events.on('machine.state', (e) => heard.push(e));
  const wheel = t.place('waterwheel', 1, 9);
  t.wait(0.5);
  t.machines.jam(wheel.id);
  t.wait(0.3);
  expect(heard).toEqual([{ part: wheel.id, state: 'working' }, { part: wheel.id, state: 'backed up' }]);
  expect(t.machines.jammed(wheel.id)).toBe(true);
  t.kernel.game.events.emit('day.started', { day: 2 });
  t.wait(0.3);
  expect(t.stateOf(wheel.id)).toBe('working');
});

test('save and load keep the levers, the sensors, the chests, the holes and the loose goods', () => {
  const t = setup();
  t.stream();
  t.place('waterwheel', 1, 5);
  const lever = t.place('lever', 2, 5);
  const chest = t.place('collector_chest', 9, 12);
  t.wait(0.3);
  t.machines.drop('wax', 4, { x: 9.5, y: t.ground, z: 10.5 });
  t.machines.drop('quill', 2, { x: 3.5, y: t.ground, z: 12.5 });
  Object.assign(t.kernel.game.player.pos, { x: 3.5, z: 6.5 });
  t.actions.use(t.context('secondary', t.hit(2, t.ground, 5, 0, 0, 1), null));
  t.wait(0.3);
  const save = JSON.parse(JSON.stringify(t.kernel.save()));
  const again = makeStage(1, save);
  installCrops(again.kernel);
  install(again.kernel);
  again.kernel.load(save);
  again.wait(0.3);
  const machines = again.kernel.game.systems.machines;
  expect(machines.lever(lever.id)).toBe(false);
  expect(machines.chest(chest.id)).toEqual([{ id: 'wax', count: 4 }]);
  expect(machines.loose().map((g) => [g.item, g.count])).toEqual([['quill', 2]]);
});


test('held primary spade excavation keeps timing and dirt rewards and carries water to the field', () => {
  const t = setup();
  t.kernel.game.flags.set(FLAG.questStep('ground'), 'ditch');
  t.world.setBlock(3, t.floor, 3, WATER);
  t.crops.till(6, t.floor, 3);
  t.inventory.add('spade', 1);
  t.inventory.selected = t.inventory.slots.findIndex(s => s?.id === 'spade');
  Object.assign(t.kernel.game.player.pos, { x: 5.5, z: 3.5 });
  const dirt = t.inventory.count('dirt');
  for (const x of [4, 5]) {
    const context = t.context('primary', t.hit(x, t.floor, 3));
    t.actions.use(context);
    expect(t.machines.hole(x, t.floor, 3)).toBeUndefined();
    t.actions.hold(context, .1);
    expect(t.world.getBlock(x, t.floor, 3)).toBe(GRASS);
    for (let i = 0; i < 20; i++) t.actions.hold(context, .05);
    expect(t.machines.hole(x, t.floor, 3)?.wet).toBe(true);
  }
  expect(t.inventory.count('dirt')).toBe(dirt + 2);
  expect(t.inventory.count('spade')).toBe(1);
  expect(t.kernel.game.flags.is(FLAG.step('ground', 'ditch'))).toBe(true);
});

test('an old unregistered trench recovers by placing dirt then digging it with the spade', () => {
  const t = setup();
  t.world.setBlock(3, t.floor, 3, WATER);
  t.world.setBlock(4, t.floor - 1, 3, blockId('dirt'));
  t.world.setBlock(4, t.floor, 3, 0); // legacy excavation with no hole record
  t.inventory.add('dirt', 1);
  t.inventory.selected = t.inventory.slots.findIndex(s => s?.id === 'dirt');
  Object.assign(t.kernel.game.player.pos, { x: 5.5, z: 3.5 });
  expect(t.actions.use(t.context('secondary', t.hit(4, t.floor - 1, 3)))).toBe(true);
  t.inventory.add('spade', 1);
  t.inventory.selected = t.inventory.slots.findIndex(s => s?.id === 'spade');
  const context = t.context('primary', t.hit(4, t.floor, 3));
  t.actions.use(context);
  for (let i = 0; i < 20; i++) t.actions.hold(context, .05);
  expect(t.machines.hole(4, t.floor, 3)?.wet).toBe(true);
  expect(t.inventory.count('dirt')).toBe(1);
});


test('primary spade refuses growing crops, protected ground and busy input; hands do not make ditches', () => {
  const t = setup();
  t.inventory.add('spade', 1);
  t.inventory.selected = t.inventory.slots.findIndex(s => s?.id === 'spade');
  Object.assign(t.kernel.game.player.pos, { x: 8.5, z: 3.5 });
  t.crops.till(7, t.floor, 3);
  t.crops.plant(7, t.floor, 3, 'wheat_seeds');
  expect(t.crops.at(7, t.floor, 3)).not.toBeNull();
  const attempt = (x: number) => {
    const c = t.context('primary', t.hit(x, t.floor, 3));
    t.actions.use(c);
    for (let i = 0; i < 20; i++) t.actions.hold(c, .05);
  };
  attempt(7);
  expect(t.crops.at(7, t.floor, 3)).not.toBeNull();
  expect(t.machines.hole(7, t.floor, 3)).toBeUndefined();
  attempt(10);
  expect(t.world.getBlock(10, t.floor, 3)).toBe(GRASS);
  t.kernel.game.player.busy = true;
  attempt(8);
  expect(t.world.getBlock(8, t.floor, 3)).toBe(GRASS);
  t.kernel.game.player.busy = false;
  t.inventory.selected = 8;
  attempt(8);
  expect(t.world.getBlock(8, t.floor, 3)).toBe(0);
  expect(t.machines.hole(8, t.floor, 3)).toBeUndefined();
});
