import { expect, test } from 'bun:test';
import type { GameEvents } from '../api.sim.ts';
import { HINTS } from '../content/hints.ts';
import { QUESTS, satisfy } from '../content/quests.ts';
import { apply } from '../quests/rules.sim.ts';
import { GROUND, stage, type Stage } from './fakes.ts';
import { RAIN_SECONDS } from './index.sim.ts';

const toasts = (s: Stage): string[] => (s.events('toast') as GameEvents['toast'][]).map((t) => t.text);
const hints = (s: Stage): string[] => (s.events('hint') as GameEvents['hint'][]).map((h) => h.id);

test('the act ends once, with act.ended, when the last step of the last quest is done', () => {
  const s = stage();
  s.run(0.1);
  s.game.systems.quests.skipTo('pilgrimage');
  s.run(0.6);
  const last = QUESTS.at(-1)!;
  expect(last.id).toBe('pilgrimage');
  for (const step of last.steps) {
    expect(s.events('act.ended')).toEqual([]);
    for (const effect of satisfy(step.done)) apply(s.game, effect);
    s.run(0.6);
  }
  expect(s.game.flags.is('quest.pilgrimage.done')).toBe(true);
  expect(s.events('act.ended')).toEqual([{ act: 1 }]);
  expect(s.game.flags.is('act1.ended')).toBe(true);
  // A load of the ended game does not end it again.
  const again = stage();
  again.kernel.load(JSON.parse(JSON.stringify(s.kernel.save())));
  again.run(2);
  expect(again.events('act.ended')).toEqual([]);
});

test('rain falls for 90 seconds on the afternoon after the first planting, once', () => {
  const s = stage();
  s.game.systems.quests.skipTo('count');
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

test('the 90 seconds are seconds of rain: the cloud and wind that come first do not count', () => {
  const s = stage();
  s.game.clock.timeOfDay = 0.55;
  s.run(1);
  s.game.events.emit('crop.planted', { x: 1, y: 1, z: 1, crop: 'wheat' });
  for (let i = 0; i < 600 && s.weather.length === 0; i++) s.run(0.05);
  expect(s.weather).toEqual(['rain']);
  // The real weather brings rain in as a front: none falls for the first 45 seconds or so.
  s.game.ambient.rain = 0;
  s.run(45);
  expect(s.game.flags.is('story.raining')).toBe(true);
  s.game.ambient.rain = 0.6;
  s.run(RAIN_SECONDS - 2);
  expect(s.weather).toEqual(['rain']);
  s.run(2.5);
  expect(s.weather).toEqual(['rain', null]);
  expect(s.game.flags.is('story.rain.done')).toBe(true);
});

test('a shower whose rain never comes still ends', () => {
  const s = stage();
  s.game.clock.timeOfDay = 0.55;
  s.run(1);
  s.game.events.emit('crop.planted', { x: 1, y: 1, z: 1, crop: 'wheat' });
  for (let i = 0; i < 600 && s.weather.length === 0; i++) s.run(0.05);
  expect(s.weather).toEqual(['rain']);
  s.game.ambient.rain = 0;
  s.run(RAIN_SECONDS + 60);
  expect(s.weather).toEqual(['rain']);
  s.run(30);
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
  expect(toasts(s)).toContain('Your fox found its way home.');

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
  // Grant day leaves the guild's axe, and the director knows it as a gift.
  apply(s.game, { give: 'axe' });
  expect(s.bag.get('axe')).toBeUndefined();
  expect(s.game.flags.get('owed.axe')).toBe(1);
  s.run(1);
  expect(toasts(s)).toContain('Your bag is full. Make room for what you were given.');
  s.bagFull = false;
  s.run(1);
  expect(s.bag.get('axe')).toBe(1);
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
  s.game.flags.set('has.almanac', true);
  s.run(20);
  expect(hints(s)).toEqual(['move', 'talk']);
  s.through();
  s.run(5);
  expect(hints(s)).toEqual(['move', 'talk', 'almanac']);

  // Each of the rest arrives when its moment does. A scene the director starts on the way is clicked through.
  const expectNext = (id: string): void => {
    for (let i = 0; i < 4; i++) {
      s.run(2);
      while (s.game.systems.talk.active) s.through();
    }
    expect(hints(s).at(-1)).toBe(id);
  };
  s.bag.set('axe', 1);
  expectNext('slots');
  s.game.systems.quests.skipTo('ground');
  s.game.flags.set('scene.7', true);
  s.game.flags.set('step.ground.ditch', true);
  expectNext('gather');
  s.bag.set('workbench', 1);
  expectNext('use');
  s.game.systems.placeables.place('bed', 5, GROUND, 5, 0);
  expectNext('sleep');
  s.game.systems.quests.skipTo('night');
  s.game.flags.set('night.fox', true);
  expectNext('back');
  s.game.systems.quests.skipTo('blessing');
  expectNext('map');
  s.game.systems.quests.skipTo('greywood');
  expectNext('soft');
  s.bag.set('watering_can', 1);
  expectNext('water');
  s.game.systems.quests.skipTo('pump');
  expectNext('quests');
  s.run(60);
  expect(hints(s)).toEqual(['move', 'talk', 'almanac', 'slots', 'gather', 'use', 'sleep', 'back', 'map', 'soft', 'water', 'quests']);
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
  for (const key of ['W, A, S and D', 'camera', 'E to talk', 'left button', '1 to 9', 'Tab', 'Shift', 'right button', 'M to open the map', 'Sleep in a bed', 'quest log']) {
    expect(text).toContain(key);
  }
  for (const hint of HINTS) expect(hint.text.includes('\n')).toBe(false);
  expect(new Set(HINTS.map((hint) => hint.id)).size).toBe(HINTS.length);
});

test('morning scene restores both scheduled speakers after using the level-ground marks', () => {
  const s = stage();
  const tamsin = s.game.actors.get('npc:tamsin')!;
  s.game.actors.set('npc:aldric', { ...tamsin, id: 'npc:aldric', pos: { ...tamsin.pos, x: tamsin.pos.x + 1 } });
  const before = ['tamsin', 'aldric'].map(who => {
    const actor = s.game.actors.get(`npc:${who}`)!;
    return { who, actor, pos: { ...actor.pos } };
  });
  s.game.systems.talk.start('scene.15');
  for (const { who, actor, pos } of before) {
    expect(actor.visible).toBe(false);
    expect(s.game.actors.get(`stage:${who}`)?.visible).toBe(true);
    expect(actor.pos).toEqual(pos);
  }
  s.through();
  for (const { who, actor, pos } of before) {
    expect(actor.visible).toBe(true);
    expect(actor.pos).toEqual(pos);
    expect(s.game.actors.has(`stage:${who}`)).toBe(false);
  }
});

test('revisiting the Pump memory stages Auren and restores the hero without another keystone', () => {
  const s = stage();
  const hero = { ...s.game.actors.get('npc:tamsin')!, id: 'player', visible: true };
  s.game.actors.set('player', hero);
  s.game.flags.set('scene.26', true);
  s.game.flags.set('memory.pumphouse', true);
  s.game.flags.set('keystone.1', true);
  const hearts = s.game.flags.get('hearts');
  s.game.systems.talk.start('memory.pumphouse.again');
  expect(s.game.systems.talk.current()?.scene).toBe(26);
  expect(hero.visible).toBe(false);
  expect(s.game.actors.get('stage:auren')?.visible).toBe(true);
  s.through();
  expect(hero.visible).toBe(true);
  expect(s.game.actors.has('stage:auren')).toBe(false);
  expect(s.game.flags.get('hearts')).toBe(hearts);
  expect(s.game.flags.get('keystone.1')).toBe(true);
  expect(s.game.flags.is('keystone.2')).toBe(false);
});

test('an arrival cannot reveal a second actor while a scene stand-in is speaking', () => {
  const s = stage();
  const template = s.game.actors.get('npc:tamsin')!;
  const hobb = { ...template, id: 'npc:hobb', pos: { ...template.pos, x: 100 }, visible: false };
  const dax = { ...template, id: 'npc:dax', pos: { ...template.pos, x: 102 }, visible: false };
  s.game.actors.set(hobb.id, hobb);
  s.game.actors.set(dax.id, dax);
  s.game.systems.talk.start('scene.18');
  expect(s.game.actors.get('stage:hobb')?.visible).toBe(true);
  expect(s.game.actors.get('stage:dax')?.visible).toBe(true);
  // The people system publishes a newly arrived person on its next rules tick.
  hobb.visible = true;
  s.run(0.05);
  expect(hobb.visible).toBe(false);
  expect(dax.visible).toBe(false);
  s.through();
  expect(hobb.visible).toBe(true);
  expect(dax.visible).toBe(false);
  expect(s.game.actors.has('stage:hobb')).toBe(false);
});
