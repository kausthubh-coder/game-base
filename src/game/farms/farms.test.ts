// The farms on the real rules, on a small stage: the Build tab's three farms built out of blocks, parts and crops,
// read off the ground, scored, and played by their creatures, with what they drop picked up off the ground.
import { expect, test } from 'bun:test';
import { blockId } from '../../content/blocks.ts';
import { makeStage } from '../actions/stage.ts';
import { install as installAlmanac } from '../almanac/index.sim.ts';
import { FLAG } from '../content/flags.ts';
import { install as installCrops } from '../crops/index.sim.ts';
import { install as installMachines } from '../machines/index.sim.ts';
import { install } from './index.sim.ts';

const WATER = blockId('water');
const GRASS = blockId('grass');

function setup() {
  const s = makeStage();
  const floor = s.ground - 1;
  for (let x = 1; x < 15; x++) for (let z = 1; z < 15; z++) s.world.setBlock(x, floor, z, GRASS);
  installCrops(s.kernel);
  installAlmanac(s.kernel);
  installMachines(s.kernel);
  install(s.kernel);
  const game = s.kernel.game;
  game.flags.set('has.almanac', true);
  game.clock.timeOfDay = 0.4;
  s.kernel.step();
  const { machines, placeables, crops, farms } = game.systems;
  const place = (kind: string, x: number, z: number, turns = 0) => {
    const placed = placeables.place(kind, x, s.ground, z, turns);
    if (!placed) throw new Error(`${kind} would not stand at ${x}, ${z}`);
    return placed;
  };
  /** A hole the spade would dig, in the floor. */
  const pit = (x: number, z: number) => {
    const bag = game.systems.inventory;
    if (bag.count('spade') === 0) bag.add('spade', 1);
    bag.selected = bag.slots.findIndex((slot) => slot?.id === 'spade');
    Object.assign(game.player.pos, { x: x + 0.5, z: z + 2.5 });
    s.kernel.game.systems.actions.use(s.context('secondary', s.hit(x, floor, z), bag.held()));
  };
  const loose = (item: string) => machines.loose().filter((g) => g.item === item).reduce((n, g) => n + g.count, 0);
  /** The hero stands out of the way, where they pick nothing up. */
  const away = () => Object.assign(game.player.pos, { x: 40.5, z: 40.5 });
  return { ...s, floor, game, machines, placeables, crops, farms, place, pit, loose, away };
}

/** The Build tab's "With a pusher": a wheel in the stream, fences to x = 5, a pit at 4, 5 and a pusher beside it. */
function gearlingPit(t: ReturnType<typeof setup>) {
  for (let z = 1; z < 15; z++) t.world.setBlock(1, t.floor, z, WATER);
  const wheel = t.place('waterwheel', 1, 5);
  for (const z of [2, 3, 4, 6, 7]) t.place('fence', 5, z);
  // The pusher's shaft runs from the wheel along the bank, in row 4, where no gearling walks.
  t.place('gear_shaft', 1, 6);
  t.place('gear_shaft', 2, 6);
  t.place('gear_shaft', 3, 6);
  t.place('pusher', 4, 6, 0);
  t.pit(4, 5);
  return wheel;
}

test('the gearling pit built as the Build tab draws it gives six springs a day, one at each gearling stopped', () => {
  const t = setup();
  gearlingPit(t);
  t.away();
  t.wait(2.5);
  const pit = t.farms.get('spring');
  expect(pit).toMatchObject({ built: true, mode: 'give', living: true, rate: 6, tag: '6 springs a day', sub: 'Power: 4 made, 1 used' });
  expect(pit?.symptom).toBe('Every gearling goes through the pit, and walks home.');
  expect(t.game.flags.is(FLAG.farmBuilt('spring'))).toBe(true);
  expect(t.game.flags.is(FLAG.farmLiving('spring'))).toBe(true);
  // One wave of six: each drops its spring the moment it stops in the dark pit.
  t.wait(46);
  expect(t.loose('gear_spring')).toBe(6);
  expect(t.game.actors.get('farm:spring:0')?.sprite).toBe('gearling');
  // A second wave the same day makes nothing more: six a day is the rate.
  t.wait(60);
  expect(t.loose('gear_spring')).toBe(6);
});

test('a pit with no pusher fills, and the tag says why; the fix is one line further', () => {
  const t = setup();
  for (let z = 1; z < 15; z++) t.world.setBlock(1, t.floor, z, WATER);
  t.place('waterwheel', 1, 5);
  for (const z of [2, 3, 4, 6, 7]) t.place('fence', 5, z);
  t.pit(4, 5);
  t.away();
  t.wait(2.5);
  expect(t.farms.get('spring')).toMatchObject({ rate: 1, symptom: 'The pit is full. 5 gearlings are waiting behind the one in it.' });
  expect(t.farms.get('spring')?.fix).toBe('A stopped gearling stays in the pit. A pusher right beside the pit, in line with it, shoves it on so the next one can come.');
});

test('a lamp whose light reaches the pit lets a gearling walk on into the wheel, and the wheel jams', () => {
  const t = setup();
  const wheel = gearlingPit(t);
  t.world.setBlock(3, t.ground, 4, blockId('lamp'));
  t.away();
  t.wait(2.5);
  expect(t.farms.get('spring')?.symptom).toBe('A gearling walked straight across the pit and into the wheel. The wheel has stopped.');
  t.wait(40);
  expect(t.machines.jammed(wheel.id)).toBe(true);
  expect(t.machines.part(wheel.id)?.state).toBe('backed up');
});

test('the bait field: burrowers come up at night at dark carrots, and copper drops where they ate', () => {
  const t = setup();
  // Six carrots in the middle of the stage, nothing lit.
  for (const [x, z] of [[6, 6], [7, 6], [8, 6], [6, 7], [7, 7], [8, 7]]) {
    t.crops.till(x, t.floor, z);
    t.crops.plant(x, t.floor, z, 'carrot_seeds');
  }
  t.away();
  t.wait(2.5);
  const bait = t.farms.get('copper');
  expect(bait).toMatchObject({ built: true, rate: 3, tag: '3 copper a day' });
  expect(bait?.symptom).toBe('2 burrowers found nothing of yours.');
  expect(bait?.fix).toBe('Eight come a night and you have 6 dark blocks. Plant 2 more, where they can reach.');
  // By day nothing comes up.
  t.wait(30);
  expect(t.loose('copper')).toBe(0);
  // At night they do. The night's last copper falls when it ends.
  t.game.clock.timeOfDay = 0.8;
  t.wait(62);
  const ate = t.loose('copper');
  expect(ate).toBeGreaterThanOrEqual(2);
  expect(ate).toBeLessThanOrEqual(3);
  t.game.clock.timeOfDay = 0.3;
  t.wait(0.2);
  expect(t.loose('copper')).toBe(3);
  // Watching them filled their page.
  expect(t.game.flags.is(FLAG.step('copper', 'burrower'))).toBe(false);
  t.game.flags.set(FLAG.questStep('copper'), 'burrower');
  Object.assign(t.game.player.pos, { x: 7.5, z: 10.5 });
  t.game.clock.timeOfDay = 0.8;
  t.wait(12);
  expect(t.game.systems.almanac.page('burrower')?.facts.find((f) => f.id === 'comes')?.known).toBe(true);
  expect(t.game.flags.is(FLAG.step('copper', 'burrower'))).toBe(true);
});

test('Take digs the burrows out for 4 copper each, and the field goes quiet for three days', () => {
  const t = setup();
  for (const [x, z] of [[6, 6], [7, 6], [8, 6], [6, 7], [7, 7], [8, 7]]) {
    t.crops.till(x, t.floor, z);
    t.crops.plant(x, t.floor, z, 'carrot_seeds');
  }
  t.away();
  t.wait(2.5);
  expect(t.farms.get('copper')?.take).toBe(24);
  expect(t.farms.setMode?.('copper', 'take')).toBe(true);
  expect(t.loose('copper')).toBe(24);
  expect(t.game.flags.get(FLAG.choice('burrowers'))).toBe('take');
  expect(t.game.flags.get(FLAG.farmMode('copper'))).toBe('take');
  t.wait(2.5);
  expect(t.farms.get('copper')).toMatchObject({ living: false, rate: 0, away: 3, tag: 'Quiet for 3 more days' });
  // Taking again before they are back does nothing; a farm with no Take refuses.
  expect(t.farms.setMode?.('copper', 'take')).toBe(false);
  expect(t.farms.setMode?.('field', 'take')).toBe(false);
  for (const day of [2, 3, 4]) t.game.events.emit('day.started', { day });
  t.game.clock.day = 4;
  t.farms.setMode?.('copper', 'give');
  t.wait(2.5);
  expect(t.farms.get('copper')).toMatchObject({ living: true, rate: 3, away: 0, mode: 'give' });
});

test('the terrace: wheat beside a ditch gives 2 a block, and sprinklers on a short shaft give less', () => {
  const t = setup();
  for (let z = 1; z < 15; z++) t.world.setBlock(1, t.floor, z, WATER);
  // Five fields beside the stream, five more round a sprinkler joined to the wheel.
  for (let z = 2; z <= 6; z++) {
    t.crops.till(2, t.floor, z);
    t.crops.plant(2, t.floor, z, 'wheat_seeds');
  }
  t.place('waterwheel', 1, 9);
  t.place('gear_shaft', 2, 9);
  t.place('gear_shaft', 3, 9);
  t.place('sprinkler', 4, 9);
  for (const [x, z] of [[4, 8], [5, 8], [5, 9], [5, 10], [4, 10]]) {
    t.crops.till(x, t.floor, z);
    t.crops.plant(x, t.floor, z, 'wheat_seeds');
  }
  t.away();
  t.wait(2.5);
  expect(t.farms.get('field')).toMatchObject({ rate: 20, tag: '20 wheat a day', living: true });
  expect(t.farms.get('field')?.symptom).toBe('Every field is wet and every sprinkler turns.');
  // Five more sprinklers on the same wheel: 4 made, 6 asked for.
  for (const z of [11, 12, 13]) t.place('sprinkler', 3, z);
  t.place('gear_shaft', 3, 10);
  t.place('sprinkler', 4, 12);
  t.place('sprinkler', 4, 13);
  t.wait(2.5);
  expect(t.farms.get('field')?.symptom).toBe('Short of power: 4 made, 6 asked for. Everything runs at 67%.');
  expect(t.farms.get('field')?.rate).toBe(Math.round(10 + 10 * (4 / 6)));
});

// ---------------------------------------------------------------------------------------- the jobs on the farms

/** Someone who lives on the land at a job, as src/game/settlement sets it. */
const atWork = (t: ReturnType<typeof setup>, who: string, job: string) => {
  t.game.flags.set(`settler.${who}`, true);
  t.game.flags.set(`job.${who}`, job);
};
const read = (t: ReturnType<typeof setup>) => t.wait(2.5);

test('Tansy at the hives: bees give half again', () => {
  const t = setup();
  for (const x of [6, 7, 8]) t.place('bee_box', x, 7);
  read(t);
  expect(t.farms.get('bee')).toMatchObject({ living: true, rate: 12 });
  atWork(t, 'tansy', 'bees');
  read(t);
  expect(t.farms.get('bee')).toMatchObject({ living: true, rate: 18 });
  expect(t.farms.get('bee')!.sub).toContain('Tansy keeps them');
});

/** Production events include goods already picked up or still on the ground. */
function beeGoods(t: ReturnType<typeof setup>) {
  const totals = { honey: 0, wax: 0 };
  for (const event of t.heard) {
    if (event.name !== 'good.made') continue;
    const good = event.data as { farm: string; item: string; count: number };
    if (good.farm === 'bee' && (good.item === 'honey' || good.item === 'wax')) totals[good.item] += good.count;
  }
  return totals;
}

function waitForBeeGoods(t: ReturnType<typeof setup>, count: number) {
  for (let seconds = 0; seconds < 730; seconds++) {
    const made = beeGoods(t);
    if (made.honey + made.wax >= count) return;
    t.wait(1);
  }
  throw new Error(`bees did not produce ${count} goods`);
}

function oneBeeBox() {
  const t = setup();
  t.place('bee_box', 7, 7);
  t.away();
  read(t);
  expect(t.farms.get('bee')).toMatchObject({ living: true, rate: 4 });
  return t;
}

test('steady bees give both honey and wax without changing the daily total', () => {
  const t = oneBeeBox();
  waitForBeeGoods(t, 4);
  expect(beeGoods(t)).toEqual({ honey: 2, wax: 2 });
  t.game.clock.timeOfDay = 0.731;
  read(t);
  expect(beeGoods(t)).toEqual({ honey: 2, wax: 2 });
});

test('bee dusk remainder has the same split as an unattended whole-day payout', () => {
  const steady = oneBeeBox();
  waitForBeeGoods(steady, 1);
  expect(beeGoods(steady)).toEqual({ honey: 1, wax: 0 });
  steady.game.clock.timeOfDay = 0.731;
  read(steady);
  const unattended = oneBeeBox();
  unattended.game.clock.timeOfDay = 0.731;
  read(unattended);
  expect(beeGoods(steady)).toEqual({ honey: 2, wax: 2 });
  expect(beeGoods(steady)).toEqual(beeGoods(unattended));
});

test('bee payout split survives Continue after an odd number of goods', () => {
  const before = oneBeeBox();
  waitForBeeGoods(before, 1);
  const saved = before.kernel.save();
  const continued = setup();
  continued.kernel.load(saved);
  waitForBeeGoods(continued, 1);
  expect(beeGoods(continued)).toEqual({ honey: 0, wax: 1 });
  continued.game.clock.timeOfDay = 0.731;
  read(continued);
  expect(beeGoods(continued)).toEqual({ honey: 1, wax: 2 });
  expect(beeGoods(before)).toEqual({ honey: 1, wax: 0 });
});

test('taking bee comb keeps its own half honey and half wax payout', () => {
  const t = oneBeeBox();
  waitForBeeGoods(t, 1);
  t.heard.length = 0;
  expect(t.farms.setMode?.('bee', 'take')).toBe(true);
  expect(beeGoods(t)).toEqual({ honey: 4, wax: 4 });
  expect(t.farms.setMode?.('bee', 'take')).toBe(false);
  expect(beeGoods(t)).toEqual({ honey: 4, wax: 4 });
});

test('Gus on his own field rests one row in four, so the bees stay by a field planted wall to wall', () => {
  const t = setup();
  t.place('bee_box', 7, 7);
  for (let x = 1; x < 15; x++) for (let z = 1; z < 15; z++) if (x !== 7 || z !== 7) t.crops.till(x, t.floor, z);
  read(t);
  expect(t.farms.get('bee')).toMatchObject({ living: false, symptom: 'The field is planted wall to wall. There are no flowers for them.' });
  atWork(t, 'gus', 'field');
  // Grass between his rows is flowers to a bee: twenty of them in reach.
  for (let x = 1; x < 15; x += 4) for (let z = 1; z < 15; z++) t.world.setBlock(x, t.floor, z, GRASS);
  read(t);
  expect(t.farms.get('bee')!.living).toBe(true);
});

test('Wren at the beast yard: a second thistlehog shares the strip, for twice the quills', () => {
  const t = setup();
  t.game.flags.set('fight.2.won', true);
  for (const x of [3, 5, 7, 9, 11, 13]) t.place('post', x, 4);
  read(t);
  expect(t.farms.get('quill')!.rate).toBe(6);
  atWork(t, 'wren', 'beasts');
  read(t);
  expect(t.farms.get('quill')).toMatchObject({ rate: 12, sub: 'At a walk, two of them' });
  // Both walk it.
  expect([...t.game.actors.values()].filter((a) => a.id.startsWith('farm:quill:') && a.visible)).toHaveLength(2);
});

test('Holt at the lamps: a switchable lamp nothing switches lights itself at dusk and goes out at dawn', () => {
  const t = setup();
  t.place('switch_lamp', 7, 7);
  read(t);
  const lamp = () => t.machines.parts().find((p) => p.kind === 'switch_lamp')!.state;
  expect(lamp()).toBe('working');
  atWork(t, 'holt', 'lamps');
  read(t);
  expect(lamp()).toBe('off');
  t.game.clock.timeOfDay = 0.8;
  read(t);
  expect(lamp()).toBe('working');
});

test('the burrower dialogue choice applies the real Take once, including its quiet period', () => {
  const t=setup();
  for(const [x,z] of [[6,6],[7,6],[8,6],[6,7],[7,7],[8,7]]) {t.crops.till(x,t.floor,z);t.crops.plant(x,t.floor,z,'carrot_seeds');}
  t.away();t.wait(2.5);
  // This is the effect emitted by the authored dialogue, rather than the farm panel API.
  t.game.flags.set(FLAG.choice('burrowers'),'take');
  expect(t.farms.get('copper')).toMatchObject({mode:'take',living:false,away:3,rate:0});
  expect(t.loose('copper')).toBe(24);
  t.game.flags.set(FLAG.choice('burrowers'),'take');t.wait(2.5);
  expect(t.loose('copper')).toBe(24);
  t.game.flags.set(FLAG.choice('burrowers'),'give');
  expect(t.farms.get('copper')).toMatchObject({mode:'give',living:false,away:3});
});

test('a player on the ground can open the gearling pit panel below its floating rate label', () => {
  const t = setup();
  gearlingPit(t);
  t.wait(2.5);
  const farm = t.farms.get('spring')!;
  Object.assign(t.game.player.pos, { x: farm.at!.x, y: t.ground, z: farm.at!.z });
  expect(t.game.systems.interact.nearest()?.id).toBe('farm:spring');
  const opened: unknown[] = [];
  t.game.events.on('ui.open', (data) => opened.push(data));
  expect(t.game.systems.interact.act()).toBe(true);
  expect(opened).toEqual([{ panel: 'farm', detail: 'spring' }]);
});
