import { expect, test } from 'bun:test';
import type { GameEvents } from '../api.sim.ts';
import { HINTS } from '../content/hints.ts';
import { GROUND, stage, type Stage } from './fakes.ts';
import { LAMP_REACH, RAIN_SECONDS } from './index.sim.ts';

const step = (s: Stage, quest: string): unknown => s.game.flags.get(`quest.${quest}.step`);
const toasts = (s: Stage): string[] => (s.events('toast') as GameEvents['toast'][]).map((t) => t.text);
const hints = (s: Stage): string[] => (s.events('hint') as GameEvents['hint'][]).map((h) => h.id);

/** Plays the first four quests the way a player would and stops with the wheat delivered. */
function playToDelivery(s: Stage, waitForEvening: boolean): void {
  // 1. A plot of your own
  s.run(0.1);
  s.talk('tamsin');
  s.run(0.1);
  s.game.systems.almanac.learn('mossling', 'needs');
  s.game.systems.almanac.learn('mossling', 'gives');
  s.run(0.1);
  s.talk('tamsin');
  s.run(0.1);
  s.people.get('tamsin')!.place = 'lodge';
  Object.assign(s.people.get('tamsin')!.pos, s.game.systems.region.place('lodge').at);

  // 2. A roof before dark
  s.bag.set('oak_log', 12);
  s.run(0.6);
  s.game.systems.placeables.place('workbench', 3, GROUND, 3, 0);
  s.game.systems.placeables.place('bed', 5, GROUND, 5, 0);
  s.game.world.setBlock(5, GROUND + 2, 5, 12);
  s.run(0.6);
  s.game.systems.time.sleep();
  s.run(0.1);

  // 3. Leaf and tail
  s.moveTo('dead.garden');
  s.run(0.6);
  s.bag.set('berry', 3);
  s.run(0.6);
  s.bag.set('berry', 0);
  s.pet.trust = 3;
  s.pet.bonded = true;
  s.game.events.emit('pet.bonded', { pet: s.pet.id });
  s.run(0.1);
  s.moveTo('kennel');
  s.talk('wren');
  s.run(0.1);

  // 4. The queen's bread
  s.moveTo('town.gate');
  s.run(0.6);
  s.moveTo('granary');
  s.talk('maren');
  s.run(0.1);
  s.moveTo('gus.field');
  s.talk('gus');
  s.run(0.1);
  s.moveTo('grant.center');
  s.bag.set('wheat_seeds', 0);
  for (let i = 0; i < 12; i++) s.crops.push({ x: i, y: GROUND - 1, z: 20, state: { crop: 'wheat', stage: 0, wet: 180, ripe: false } });
  s.game.events.emit('crop.planted', { x: 0, y: GROUND - 1, z: 20, crop: 'wheat' });
  s.run(0.6);
  s.crops.length = 0;
  s.bag.set('wheat', 24);
  s.run(0.6);
  s.moveTo('granary');
  s.talk('maren', waitForEvening ? 0 : 1);
  s.run(0.05);
}

test('a full run of all five quests, through talk, events and flags, reaches act.ended', () => {
  const s = stage();
  s.run(0.1);
  expect(s.game.systems.quests.tracked()!.id).toBe('plot');
  expect(s.marks.get('tamsin')).toBe('quest');

  // 1. A plot of your own
  const meeting = s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.meet');
  expect(meeting[0]).toBe('Twelve people have asked me for this plot.');
  expect([s.bag.get('almanac'), s.bag.get('axe')]).toEqual([1, 1]);
  s.run(0.1);
  expect(step(s, 'plot')).toBe('watch');
  s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.watch');
  s.game.systems.almanac.learn('mossling', 'needs');
  s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.watch.half');
  s.game.systems.almanac.learn('mossling', 'gives');
  s.run(0.1);
  expect(step(s, 'plot')).toBe('tell');
  s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.tell');
  s.run(0.1);
  expect(s.game.flags.is('quest.plot.done')).toBe(true);
  expect(s.game.systems.quests.tracked()!.id).toBe('roof');

  // 2. A roof before dark
  s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.roof.wood');
  s.bag.set('oak_log', 12);
  s.run(0.6);
  expect(step(s, 'roof')).toBe('bench');
  s.game.systems.placeables.place('workbench', 3, GROUND, 3, 0);
  s.run(0.1);
  expect(step(s, 'roof')).toBe('shelter');
  s.game.systems.placeables.place('bed', 5, GROUND, 5, 0);
  s.game.world.setBlock(5, GROUND + 2, 5, 12);
  s.run(0.6);
  expect(step(s, 'roof')).toBe('sleep');
  s.game.systems.time.sleep();
  s.run(0.1);
  expect(s.game.flags.is('quest.roof.done')).toBe(true);

  // 3. Leaf and tail
  expect(s.game.systems.quests.tracked()!.id).toBe('leaftail');
  s.talk('wren');
  expect(s.lastConversation()).toBe('wren.first');
  s.talk('wren');
  expect(s.lastConversation()).toBe('wren.leaftail');
  s.moveTo('dead.garden');
  s.run(0.6);
  expect(step(s, 'leaftail')).toBe('berries');
  s.bag.set('berry', 3);
  s.run(0.6);
  expect(step(s, 'leaftail')).toBe('trust');
  s.bag.set('berry', 0);
  s.pet.trust = 3;
  s.pet.bonded = true;
  s.game.events.emit('pet.bonded', { pet: s.pet.id });
  s.run(0.1);
  expect(step(s, 'leaftail')).toBe('show');
  s.moveTo('lodge');
  s.pet.pos.x = s.game.player.pos.x + 80;
  s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.show.alone');
  Object.assign(s.pet.pos, s.game.player.pos);
  s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.show');
  s.run(0.1);
  expect(s.game.flags.is('quest.leaftail.done')).toBe(true);

  // 4. The queen's bread
  expect(s.game.systems.quests.tracked()!.id).toBe('bread');
  s.talk('gus');
  expect(s.lastConversation()).toBe('gus.first');
  s.moveTo('town.gate');
  s.run(0.6);
  expect(step(s, 'bread')).toBe('queen');
  expect(s.marks.get('maren')).toBe('quest');
  const asking = s.talk('maren', 1);
  expect(s.lastConversation()).toBe('maren.ask');
  expect(asking).toContain('Same fields, same hands, thinner sacks. Gus says the soil is tired.');
  s.run(0.1);
  expect(step(s, 'bread')).toBe('seeds');
  s.talk('gus');
  expect(s.lastConversation()).toBe('gus.seeds');
  expect([s.bag.get('hoe'), s.bag.get('watering_can'), s.bag.get('wheat_seeds')]).toEqual([1, 1, 12]);
  s.run(0.1);
  expect(step(s, 'bread')).toBe('grow');
  s.bag.set('wheat_seeds', 0);
  for (let i = 0; i < 12; i++) s.crops.push({ x: i, y: GROUND - 1, z: 20, state: { crop: 'wheat', stage: 0, wet: 180, ripe: false } });
  s.game.events.emit('crop.planted', { x: 0, y: GROUND - 1, z: 20, crop: 'wheat' });
  s.talk('gus');
  expect(s.lastConversation()).toBe('gus.pet');
  s.talk('gus');
  expect(s.lastConversation()).toBe('gus.grow');
  s.talk('maren');
  expect(s.lastConversation()).toBe('maren.pet');
  s.talk('maren');
  expect(s.lastConversation()).toBe('maren.waiting');
  s.crops.length = 0;
  s.bag.set('wheat', 19);
  s.run(0.6);
  expect(step(s, 'bread')).toBe('grow');
  s.bag.set('wheat', 22);
  s.run(0.6);
  expect(step(s, 'bread')).toBe('deliver');
  s.talk('maren', 0);
  expect(s.lastConversation()).toBe('maren.deliver');
  expect(s.bag.get('wheat')).toBe(2);
  s.run(0.6);
  expect(s.game.flags.is('quest.bread.done')).toBe(true);

  // 5. The harvest festival. The player waited with Maren, so it is dusk and the festival has begun.
  expect(s.game.systems.quests.tracked()!.id).toBe('festival');
  expect(s.events('festival.started')).toHaveLength(1);
  expect(step(s, 'festival')).toBe('evening');
  s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.festival');
  s.moveTo('town.square');
  s.run(0.6);
  expect(step(s, 'festival')).toBe('lamp');
  s.talk('odo');
  expect(s.lastConversation()).toBe('odo.lamp');
  expect(s.bag.get('river_lamp')).toBe(1);
  s.talk('odo');
  expect(s.lastConversation()).toBe('odo.lamp.go');
  s.moveTo('river.bank');
  expect(s.use('river_lamp')).toBe(true);
  expect(s.game.flags.is('festival.lamp')).toBe(true);
  expect(s.bag.get('river_lamp')).toBe(0);
  s.run(0.1);
  expect(step(s, 'festival')).toBe('end');
  expect(s.marks.get('tamsin')).toBe('quest');
  expect(s.events('act.ended')).toEqual([]);
  const last = s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.end');
  expect(last).toEqual([
    'Good harvest. Small, and good.',
    '(looking west) Evening came early again. A little sooner every week.',
    'Go on. Float your lamp.',
  ]);
  expect(s.events('act.ended')).toEqual([{ act: 1 }]);
  s.run(0.1);
  expect(s.game.systems.quests.all().map((q) => q.state)).toEqual(['done', 'done', 'done', 'done', 'done']);
  expect(s.game.systems.quests.tracked()).toBeNull();
  expect((s.events('quest.completed') as GameEvents['quest.completed'][]).map((e) => e.quest)).toEqual(['plot', 'roof', 'leaftail', 'bread', 'festival']);
  expect(s.marks.get('tamsin')).toBe('');

  // The act ends once. The lamp Tamsin handed over floats too, and the game goes on.
  expect(s.bag.get('river_lamp')).toBe(1);
  expect(s.use('river_lamp')).toBe(true);
  expect(s.game.flags.get('festival.lamps')).toBe(2);
  // What she had not yet said about the leaftail and the bed comes first, each once, then her steady line.
  const after: (string | undefined)[] = [];
  for (let i = 0; i < 5; i++) {
    s.talk('tamsin');
    after.push(s.lastConversation());
  }
  expect(after).toEqual(['tamsin.pet', 'tamsin.bed', 'tamsin.after', 'tamsin.fallback', 'tamsin.fallback']);
  expect(s.events('act.ended')).toHaveLength(1);
  expect(s.game.player.busy).toBe(false);
});

test('rain falls for 90 seconds on the afternoon after the first planting, once', () => {
  const s = stage();
  s.game.systems.quests.skipTo('bread');
  s.game.clock.timeOfDay = 0.3;
  s.run(1);
  expect(s.weather).toEqual([]);
  s.game.events.emit('crop.planted', { x: 1, y: 1, z: 1, crop: 'wheat' });
  s.run(30);
  // Morning still: no rain yet.
  expect(s.weather).toEqual([]);
  s.game.clock.timeOfDay = 0.55;
  s.run(1);
  expect(s.weather).toEqual(['rain']);
  expect(s.game.flags.is('story.raining')).toBe(true);
  s.run(RAIN_SECONDS - 2);
  expect(s.weather).toEqual(['rain']);
  s.run(2);
  expect(s.weather).toEqual(['rain', null]);
  expect(s.game.flags.is('story.raining')).toBe(false);
  // A second planting brings no second shower.
  s.game.events.emit('crop.planted', { x: 2, y: 1, z: 1, crop: 'wheat' });
  s.game.clock.timeOfDay = 0.55;
  s.run(60);
  expect(s.weather).toEqual(['rain', null]);
});

test('wheat planted in the evening gets its rain the next afternoon, and a save in the shower keeps the time left', () => {
  const s = stage();
  s.game.clock.timeOfDay = 0.8;
  s.run(1);
  s.game.events.emit('crop.planted', { x: 1, y: 1, z: 1, crop: 'wheat' });
  s.run(60);
  expect(s.weather).toEqual([]);
  s.game.clock.timeOfDay = 0.52;
  s.run(40);
  expect(s.weather).toEqual(['rain']);

  const save = JSON.parse(JSON.stringify(s.kernel.save()));
  const again = stage();
  again.kernel.load(save);
  again.run(RAIN_SECONDS - 40 - 2);
  expect(again.weather).toEqual([]);
  again.run(3);
  expect(again.weather).toEqual([null]);
  expect(again.game.flags.is('story.rain.done')).toBe(true);
});

test('the festival starts at the dusk after the delivery: clear sky, everyone sent to the square or the bank and held', () => {
  const s = stage();
  playToDelivery(s, false);
  expect(s.game.flags.is('bread.delivered')).toBe(true);
  expect(s.game.systems.quests.tracked()!.id).toBe('festival');
  // The player had things to do first, so the clock runs by itself.
  s.game.clock.timeOfDay = 0.6;
  s.run(5);
  expect(s.events('festival.started')).toEqual([]);
  expect(s.holding.size).toBe(0);
  s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.tonight');
  s.game.clock.timeOfDay = 0.729;
  s.run(2);
  expect(s.events('festival.started')).toEqual([{}]);
  expect(s.game.flags.is('festival.started')).toBe(true);
  expect(s.weather.at(-1)).toBe('clear');
  expect(s.holding.size).toBe(s.people.size);
  for (const npc of s.people.values()) {
    expect(npc.place).toBe(npc.id === 'tamsin' || npc.id === 'brack' ? 'river.bank' : 'town.square');
  }
  // Each person is sent once, not every tick.
  s.run(5);
  expect(s.sent.filter((e) => e.npc === 'odo' && e.place === 'town.square')).toHaveLength(1);
  expect(s.events('festival.started')).toHaveLength(1);

  // Morning lets everyone go and hands the weather back.
  s.game.clock.timeOfDay = 0.3;
  s.run(1);
  expect(s.game.flags.is('festival.over')).toBe(true);
  expect(s.holding.size).toBe(0);
  expect(s.weather.at(-1)).toBeNull();
  // The lamp and the last talk still work the day after.
  s.talk('odo');
  expect(s.lastConversation()).toBe('odo.lamp');
  s.moveTo('river.bank');
  expect(s.use('river_lamp')).toBe(true);
  s.run(0.1);
  s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.end');
  expect(s.events('act.ended')).toEqual([{ act: 1 }]);
});

test('waiting with Maren brings the dusk, and a festival under way goes on after a load', () => {
  const s = stage();
  s.game.clock.timeOfDay = 0.4;
  playToDelivery(s, true);
  s.run(0.6);
  expect(s.game.clock.timeOfDay).toBeGreaterThanOrEqual(0.73);
  expect(s.events('festival.started')).toHaveLength(1);
  expect(s.game.flags.is('festival.wait')).toBe(false);

  const save = JSON.parse(JSON.stringify(s.kernel.save()));
  const again = stage();
  again.game.clock.timeOfDay = 0.75;
  again.kernel.load(save);
  again.run(0.6);
  expect(again.holding.size).toBe(again.people.size);
  expect(again.events('festival.started')).toEqual([]);
  expect(again.game.systems.quests.tracked()!.id).toBe('festival');
});

test('a river lamp floats only within 6 blocks of the river bank', () => {
  const s = stage();
  s.run(0.1);
  s.bag.set('river_lamp', 1);
  const bank = s.game.systems.region.place('river.bank').at;
  Object.assign(s.game.player.pos, { x: bank.x + LAMP_REACH + 1, y: bank.y, z: bank.z });
  expect(s.use('river_lamp')).toBe(true);
  expect(s.game.flags.is('festival.lamp')).toBe(false);
  expect(s.bag.get('river_lamp')).toBe(1);
  expect(toasts(s)).toEqual(['Float the lamp from the river bank.']);

  s.game.player.pos.x = bank.x + LAMP_REACH - 0.5;
  expect(s.use('river_lamp')).toBe(true);
  expect(s.game.flags.is('festival.lamp')).toBe(true);
  expect(s.bag.get('river_lamp')).toBe(0);
  expect(toasts(s).at(-1)).toBe('Your lamp joins the others on the Mere.');

  // Other items and the other button are left to the systems that own them.
  expect(s.use('axe')).toBe(false);
  expect(s.game.systems.actions.use({ hit: null, held: { id: 'river_lamp', count: 1 }, button: 'primary' })).toBe(false);
});

test('never stuck: Tamsin replaces a lost axe', () => {
  const s = stage();
  s.run(0.1);
  s.talk('tamsin');
  s.run(1);
  expect(s.marks.get('tamsin')).toBe('');
  s.bag.set('axe', 0);
  s.run(20);
  expect(s.marks.get('tamsin')).toBe('quest');
  expect(hints(s)).toContain('axe.lost');
  s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.axe');
  expect(s.bag.get('axe')).toBe(1);
  s.run(1);
  expect(s.marks.get('tamsin')).toBe('');
  s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.watch');
});

test('never stuck: Gus gives 4 more seeds when seed, wheat and crops together cannot make twenty', () => {
  const s = stage();
  s.run(0.1);
  s.game.systems.quests.skipTo('bread');
  s.moveTo('town.gate');
  s.run(0.6);
  s.talk('maren');
  s.run(0.1);
  s.talk('gus');
  s.run(1);
  expect(s.bag.get('wheat_seeds')).toBe(12);
  expect(s.marks.get('gus')).toBe('');
  s.talk('gus');
  expect(s.lastConversation()).toBe('gus.grow');

  // Eight seeds planted and four lost: 8 crops make 16 wheat, which is short.
  s.bag.set('wheat_seeds', 0);
  for (let i = 0; i < 8; i++) s.crops.push({ x: i, y: 1, z: 1, state: { crop: 'wheat', stage: 1, wet: 0, ripe: false } });
  s.run(1);
  expect(s.marks.get('gus')).toBe('quest');
  s.run(60);
  expect(hints(s)).toContain('seeds.short');
  s.talk('gus');
  expect(s.lastConversation()).toBe('gus.more');
  expect(s.bag.get('wheat_seeds')).toBe(4);
  // 8 crops and 4 seeds make 24: enough, so he gives no more.
  s.run(1);
  expect(s.marks.get('gus')).toBe('');
  s.talk('gus');
  expect(s.lastConversation()).toBe('gus.grow');
  expect(s.bag.get('wheat_seeds')).toBe(4);

  // Harvested wheat counts as well.
  s.crops.length = 0;
  s.bag.set('wheat_seeds', 0);
  s.bag.set('wheat', 18);
  s.talk('gus');
  expect(s.lastConversation()).toBe('gus.more');
  s.bag.set('wheat', 12);
  s.talk('gus');
  expect(s.lastConversation()).toBe('gus.grow');
});

test('never stuck: a bonded leaftail left behind returns when the player reaches the grant', () => {
  const s = stage();
  s.run(0.1);
  s.pet.bonded = true;
  s.moveTo('town.square');
  Object.assign(s.pet.pos, s.game.player.pos);
  s.pet.pos.x += 100;
  s.run(2);
  // Away from the grant nothing moves it.
  expect(s.pet.pos.x).toBe(s.game.player.pos.x + 100);
  s.moveTo('grant.center');
  s.pet.pos.x += 100;
  s.run(1);
  expect(s.pet.pos).toEqual(s.game.player.pos);
  expect(toasts(s)).toContain('Your leaftail found its way home.');

  // A wild leaftail is left where it lives.
  const wild = stage();
  wild.moveTo('grant.center');
  wild.run(2);
  expect(wild.pet.pos.x).toBe(70.5);
});

test('never stuck: a gift that does not fit in the bag is handed over when there is room', () => {
  const s = stage();
  s.run(0.1);
  s.bagFull = true;
  s.talk('tamsin');
  expect(s.bag.get('axe')).toBeUndefined();
  expect(s.game.flags.get('owed.axe')).toBe(1);
  expect(s.game.flags.get('owed.almanac')).toBe(1);
  s.run(1);
  expect(toasts(s)).toContain('Your bag is full. Make room for what you were given.');
  // She does not hand out a second axe while the first is still owed.
  s.talk('tamsin');
  expect(s.lastConversation()).toBe('tamsin.watch');
  s.bagFull = false;
  s.run(1);
  expect([s.bag.get('axe'), s.bag.get('almanac')]).toEqual([1, 1]);
  expect(s.game.flags.get('owed.axe')).toBe(0);
});

test('each hint is sent once, the first time it matters, and never during a conversation', () => {
  const s = stage();
  s.run(1);
  expect(hints(s)).toEqual(['move']);
  // Tamsin stands at the grant stone with the player, so the talk hint follows.
  s.run(5);
  expect(hints(s)).toEqual(['move', 'talk']);
  s.game.systems.talk.talkTo('tamsin');
  s.run(20);
  expect(hints(s)).toEqual(['move', 'talk']);
  s.through();
  s.run(10);
  expect(hints(s)).toEqual(['move', 'talk', 'almanac', 'slots']);
  expect(s.game.flags.is('hint.almanac')).toBe(true);

  // Each of the rest arrives when its moment does.
  const expectNext = (id: string): void => {
    s.run(5);
    expect(hints(s).at(-1)).toBe(id);
  };
  s.game.systems.almanac.learn('mossling', 'needs');
  s.game.systems.almanac.learn('mossling', 'gives');
  s.run(0.1);
  s.talk('tamsin');
  expectNext('gather');
  s.bag.set('workbench', 1);
  expectNext('use');
  s.game.systems.placeables.place('bed', 5, GROUND, 5, 0);
  expectNext('sleep');
  s.game.systems.time.sleep();
  expectNext('map');
  s.moveTo('dead.garden');
  expectNext('soft');
  s.bag.set('berry', 1);
  expectNext('berry');
  s.bag.set('watering_can', 1);
  expectNext('water');
  s.bag.set('river_lamp', 1);
  expectNext('lamp');
  s.run(60);
  const sent = hints(s);
  expect(sent).toEqual(['move', 'talk', 'almanac', 'slots', 'gather', 'use', 'sleep', 'map', 'soft', 'berry', 'water', 'lamp']);
  const texts = new Map(HINTS.map((hint) => [hint.id, hint.text]));
  for (const hint of s.events('hint') as GameEvents['hint'][]) expect(hint.text).toBe(texts.get(hint.id)!);

  // Hints already sent stay sent after a load.
  const again = stage();
  again.kernel.load(JSON.parse(JSON.stringify(s.kernel.save())));
  for (const [item, count] of s.bag) again.bag.set(item, count);
  again.run(30);
  expect(hints(again)).toEqual([]);
});

test('the hints cover what the design asks for, one line each', () => {
  const text = HINTS.map((hint) => hint.text).join(' ');
  for (const key of ['W, A, S and D', 'camera', 'E to talk', 'left button', '1 to 9', 'Tab', 'Shift', 'right button', 'M to open the map', 'Sleep in a bed']) {
    expect(text).toContain(key);
  }
  for (const hint of HINTS) expect(hint.text.includes('\n')).toBe(false);
  expect(new Set(HINTS.map((hint) => hint.id)).size).toBe(HINTS.length);
});
