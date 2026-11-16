import { expect, test } from 'bun:test';
import type { Vec3 } from '../../engine/types.ts';
import type { NpcId } from '../api.sim.ts';
import { CROWD_SPRITES, PEOPLE, type PersonDef } from '../content/people.ts';
import type { GameSave, Kernel } from '../kernel.sim.ts';
import { install as installInteract } from '../interact/index.sim.ts';
import { install as installNav } from '../nav/index.sim.ts';
import { FEET, makeStage, wall, type Stage } from '../nav/stage.testkit.ts';
import { createPeople, install } from './index.sim.ts';

// People made up for these tests. Their ids are not the game's, so they are cast.
const ANN = 'ann' as NpcId, BO = 'bo' as NpcId, NOBODY = 'nobody' as NpcId;

const ann: PersonDef = {
  id: ANN, name: 'Ann', sprite: ANN, portrait: ANN, voice: ANN,
  routine: [{ hour: 6, place: 'home' }, { hour: 12, place: 'shop' }],
};
const bo: PersonDef = { id: BO, name: 'Bo', sprite: 'villager-a', portrait: 'villager-a', voice: 'villager-a', routine: [{ hour: 0, place: 'shop' }] };

const HOME: [number, number] = [4, 6], SHOP: [number, number] = [24, 6];

const withPeople = (defs: readonly PersonDef[]) => (kernel: Kernel): void => {
  const people = createPeople(kernel.game, defs);
  kernel.add('people', people.api, people.system);
};

/** A town of two places 20 blocks apart, at 8 in the morning, with the player standing between them. */
function town(defs: readonly PersonDef[] = [ann], save?: GameSave): Stage {
  const stage = makeStage({ places: { home: HOME, shop: SHOP, far: [28, 28] }, install: [installNav, withPeople(defs)] });
  stage.kernel.game.clock.timeOfDay = 8 / 24;
  stage.player(14, 10);
  if (save) stage.kernel.load(save);
  return stage;
}

const hour = (stage: Stage, h: number): void => { stage.kernel.game.clock.timeOfDay = h / 24; };
const at = (pos: Vec3, [x, z]: [number, number]): boolean => pos.x === x + 0.5 && pos.z === z + 0.5 && pos.y === FEET;

test('each person is an actor, and has a prompt that talks to them', () => {
  const stage = town();
  stage.run(0.05);
  const game = stage.kernel.game;
  const actor = game.actors.get('npc:ann')!;
  expect(actor).toMatchObject({ id: 'npc:ann', sprite: ANN, anim: 'idle', visible: true, mark: '' });
  expect(game.systems.people.get(ANN)).toMatchObject({ id: ANN, name: 'Ann', sprite: ANN, portrait: ANN, voice: ANN, place: 'home', friendship: 0 });
  expect(actor.pos).toBe(game.systems.people.get(ANN)!.pos);

  const prompt = stage.prompts.get('npc:ann')!;
  expect(prompt.prompt()).toBe('Talk to Ann');
  expect(prompt.pos()).toBe(actor.pos);
  prompt.act();
  expect(stage.talked).toEqual([ANN]);
});

test('a routine moves a person to the right place at the right hour, walking at 2.2 blocks a second', () => {
  const stage = town();
  const people = stage.kernel.game.systems.people;
  stage.run(0.05);
  const pos = people.get(ANN)!.pos, actor = stage.kernel.game.actors.get('npc:ann')!;
  expect(at(pos, HOME)).toBe(true);
  stage.run(30);
  expect(at(pos, HOME)).toBe(true);

  hour(stage, 12.5);
  stage.run(0.05); // the step that notices the hour and finds the path
  const start = pos.x;
  stage.run(2);
  expect(pos.x - start).toBeCloseTo(4.4, 5);
  expect(actor.anim).toBe('walk');
  expect(actor.facing).toBeCloseTo(Math.PI / 2, 5); // east
  expect(people.get(ANN)!.place).toBe('shop');

  stage.run(8);
  expect(at(pos, SHOP)).toBe(true);
  expect(actor.anim).toBe('idle');

  // Before the first hour of the day, the last stop still holds. Then morning sends her home.
  hour(stage, 2);
  stage.run(3);
  expect(at(pos, SHOP)).toBe(true);
  hour(stage, 6.5);
  stage.run(12);
  expect(at(pos, HOME)).toBe(true);
  expect(people.get(ANN)!.place).toBe('home');
});

test('hold() stops them where they are, and letting go sends them on', () => {
  const stage = town();
  const people = stage.kernel.game.systems.people;
  stage.run(0.05);
  hour(stage, 12.5);
  stage.run(3);
  const pos = people.get(ANN)!.pos, actor = stage.kernel.game.actors.get('npc:ann')!;
  expect(actor.anim).toBe('walk');

  people.hold(ANN, true);
  const stopped = { ...pos };
  stage.run(5);
  expect(pos).toEqual(stopped);
  expect(actor.anim).toBe('idle');
  // The routine does not move them either.
  hour(stage, 7);
  stage.run(5);
  expect(pos).toEqual(stopped);

  hour(stage, 12.5);
  people.hold(ANN, false);
  stage.run(10);
  expect(at(pos, SHOP)).toBe(true);
});

test('someone more than 60 blocks from the player does not walk: they jump', () => {
  const stage = town();
  const people = stage.kernel.game.systems.people;
  stage.kernel.game.player.pos.x = 4.5 + 61;
  stage.kernel.game.player.pos.z = 6.5;
  stage.run(0.05);
  const pos = people.get(ANN)!.pos;
  expect(at(pos, HOME)).toBe(true);
  hour(stage, 12.5);
  stage.run(0.05);
  expect(at(pos, SHOP)).toBe(true);
  expect(stage.kernel.game.actors.get('npc:ann')!.anim).toBe('idle');
});

test('after a night\'s sleep everybody is where the morning has them, without the walk', () => {
  const stage = town();
  const { clock, events, systems } = stage.kernel.game;
  hour(stage, 13);
  stage.run(0.05);
  const pos = systems.people.get(ANN)!.pos;
  expect(at(pos, SHOP)).toBe(true);
  // What the time system does when the player sleeps.
  clock.day = 2;
  hour(stage, 6.5);
  events.emit('slept', { day: 2, skipped: 600 });
  stage.run(0.05);
  expect(at(pos, HOME)).toBe(true);
  // The next change of hour is walked as usual.
  hour(stage, 12.5);
  stage.run(1);
  expect(stage.kernel.game.actors.get('npc:ann')!.anim).toBe('walk');
});

test('when no path leads to the place, they appear there', () => {
  const stage = town();
  // The shop is shut in on every side.
  wall(stage.world, 22, 4, 26, 4);
  wall(stage.world, 22, 8, 26, 8);
  wall(stage.world, 22, 4, 22, 8);
  wall(stage.world, 26, 4, 26, 8);
  stage.run(0.05);
  hour(stage, 12.5);
  // She walks as far as the wall, since land that is not loaded yet looks the same, and then she is inside.
  stage.run(12);
  expect(at(stage.kernel.game.systems.people.get(ANN)!.pos, SHOP)).toBe(true);
  expect(stage.kernel.game.actors.get('npc:ann')!.anim).toBe('idle');
});

test('when there is nowhere to walk at all, they appear at the place at once', () => {
  const stage = town();
  stage.run(0.05);
  // Home is shut in on every side, with her in it.
  wall(stage.world, 2, 4, 6, 4);
  wall(stage.world, 2, 8, 6, 8);
  wall(stage.world, 2, 4, 2, 8);
  wall(stage.world, 6, 4, 6, 8);
  hour(stage, 12.5);
  stage.run(0.05);
  expect(at(stage.kernel.game.systems.people.get(ANN)!.pos, SHOP)).toBe(true);
});

test('a block put in the way after the path was made sends them around it', () => {
  const stage = town();
  stage.run(0.05);
  hour(stage, 12.5);
  stage.run(1);
  wall(stage.world, 14, 2, 14, 10);
  stage.run(14);
  expect(at(stage.kernel.game.systems.people.get(ANN)!.pos, SHOP)).toBe(true);
});

test('standing, they face the player who comes within 3 blocks', () => {
  const stage = town();
  stage.run(0.05);
  const actor = stage.kernel.game.actors.get('npc:ann')!;
  expect(actor.facing).toBeCloseTo(Math.PI, 5);
  stage.player(HOME[0] + 2, HOME[1]); // two blocks east
  stage.run(0.05);
  expect(actor.facing).toBeCloseTo(Math.PI / 2, 5);
  stage.player(HOME[0], HOME[1] - 2); // two blocks north
  stage.run(0.05);
  expect(actor.facing).toBeCloseTo(0, 5);
  stage.player(HOME[0] - 5, HOME[1]); // too far to turn for
  stage.run(0.05);
  expect(actor.facing).toBeCloseTo(0, 5);
});

test('nobody walks off in the middle of a conversation', () => {
  const stage = town();
  const { events, systems } = stage.kernel.game;
  stage.run(0.05);
  const pos = systems.people.get(ANN)!.pos;
  (systems.talk as { active: boolean }).active = true;
  events.emit('talk.started', { npc: ANN, conversation: 'hello' });
  hour(stage, 12.5);
  stage.run(5);
  expect(at(pos, HOME)).toBe(true);
  (systems.talk as { active: boolean }).active = false;
  events.emit('talk.ended', { npc: ANN, conversation: 'hello' });
  stage.run(10);
  expect(at(pos, SHOP)).toBe(true);
});

test('send() takes someone to a place now, and they stay until the next morning', () => {
  const stage = town();
  const { clock, systems } = stage.kernel.game;
  stage.run(0.05);
  systems.people.send(ANN, 'far');
  expect(systems.people.get(ANN)!.place).toBe('far');
  stage.run(20);
  const pos = systems.people.get(ANN)!.pos;
  expect(at(pos, [28, 28])).toBe(true);
  hour(stage, 12.5); // the routine says shop, and she stays
  stage.run(5);
  expect(at(pos, [28, 28])).toBe(true);
  clock.day = 2;
  hour(stage, 6.5);
  stage.run(25);
  expect(at(pos, HOME)).toBe(true);

  // A place the region does not know changes nothing.
  systems.people.send(ANN, 'nowhere');
  stage.run(1);
  expect(at(pos, HOME)).toBe(true);
});

test('someone sent and held goes there and stays, whatever the day', () => {
  const stage = town();
  const { clock, systems } = stage.kernel.game;
  stage.run(0.05);
  systems.people.send(ANN, 'far');
  systems.people.hold(ANN, true);
  stage.run(20);
  const pos = systems.people.get(ANN)!.pos;
  expect(at(pos, [28, 28])).toBe(true);
  clock.day = 2;
  stage.run(5);
  expect(at(pos, [28, 28])).toBe(true);
});

test('send() with an offset stands them that many blocks east and south of the place, and a load keeps it', () => {
  const stage = town([ann, bo]);
  const people = stage.kernel.game.systems.people;
  stage.run(0.05);
  people.send(ANN, 'far', { x: -3, z: 2 });
  people.send(BO, 'far', { x: 2, z: -4 });
  expect(people.get(ANN)!.place).toBe('far');
  stage.run(30);
  expect(at(people.get(ANN)!.pos, [25, 30])).toBe(true);
  expect(at(people.get(BO)!.pos, [30, 24])).toBe(true);

  // Sent again after a load, as the festival does, they are already there.
  const again = town([ann, bo], JSON.parse(JSON.stringify(stage.kernel.save())) as GameSave);
  again.run(1);
  expect(at(again.kernel.game.systems.people.get(ANN)!.pos, [25, 30])).toBe(true);
  expect(at(again.kernel.game.systems.people.get(BO)!.pos, [30, 24])).toBe(true);
});

test('two people at one place stand on different blocks', () => {
  const stage = town([ann, bo]);
  const people = stage.kernel.game.systems.people;
  stage.run(0.05);
  people.send(ANN, 'shop');
  stage.run(12);
  const a = people.get(ANN)!.pos, b = people.get(BO)!.pos;
  expect(at(b, SHOP)).toBe(true);
  expect(Math.hypot(a.x - b.x, a.z - b.z)).toBe(1);
});

test('befriend() keeps friendship from 0 to 5, and setMark() shows on the actor', () => {
  const stage = town();
  const people = stage.kernel.game.systems.people;
  people.befriend(ANN, 2);
  expect(people.get(ANN)!.friendship).toBe(2);
  people.befriend(ANN, 9);
  expect(people.get(ANN)!.friendship).toBe(5);
  people.befriend(ANN, -9);
  expect(people.get(ANN)!.friendship).toBe(0);
  people.setMark(ANN, 'quest');
  expect(stage.kernel.game.actors.get('npc:ann')!.mark).toBe('quest');
  people.setMark(ANN, '');
  expect(stage.kernel.game.actors.get('npc:ann')!.mark).toBe('');
  // Somebody who is not there is not an error.
  people.befriend(NOBODY, 1);
  people.setMark(NOBODY, 'quest');
  people.hold(NOBODY, true);
  people.send(NOBODY, 'shop');
  expect(people.get(NOBODY)).toBeUndefined();
});

test('save then load keeps where people are, their friendship, their mark and who is held', () => {
  const stage = town();
  const people = stage.kernel.game.systems.people;
  stage.run(0.05);
  hour(stage, 12.5);
  stage.run(3);
  people.hold(ANN, true);
  people.befriend(ANN, 3);
  people.setMark(ANN, 'talk');
  const before = { ...people.get(ANN)!.pos };
  const save = JSON.parse(JSON.stringify(stage.kernel.save())) as GameSave;

  const again = town([ann], save);
  const loaded = again.kernel.game.systems.people;
  again.run(2);
  expect(loaded.get(ANN)!.pos).toEqual(before);
  expect(loaded.get(ANN)!.friendship).toBe(3);
  expect(loaded.get(ANN)!.place).toBe('shop');
  expect(again.kernel.game.actors.get('npc:ann')!.mark).toBe('talk');
  loaded.hold(ANN, false);
  again.run(10);
  expect(at(loaded.get(ANN)!.pos, SHOP)).toBe(true);
});

test('save then load keeps someone who was sent somewhere on their way', () => {
  const stage = town();
  stage.run(0.05);
  stage.kernel.game.systems.people.send(ANN, 'far');
  stage.run(2);
  const save = JSON.parse(JSON.stringify(stage.kernel.save())) as GameSave;
  const again = town([ann], save);
  again.run(20);
  expect(at(again.kernel.game.systems.people.get(ANN)!.pos, [28, 28])).toBe(true);
});

// ---------------------------------------------------------------------------------------- the real town

const PLACES: Record<string, [number, number]> = {
  'grant.stone': [4, 4], 'town.gate': [20, 4], 'town.square': [30, 20], lodge: [40, 10], granary: [44, 20], 'town.hall': [44, 12], bakery: [36, 26],
  'gus.field': [24, 40], carpenter: [40, 34], kennel: [30, 42], 'river.bank': [30, 30], ferry: [44, 44],
};

function hollowmere(): Stage {
  const stage = makeStage({ chunks: 3, places: PLACES, install: [installNav, install] });
  stage.kernel.game.clock.timeOfDay = 8 / 24;
  stage.player(30, 24);
  return stage;
}

test('the four townspeople and ten villagers stand where act 1 puts them', () => {
  const stage = hollowmere();
  const { actors, systems } = stage.kernel.game;
  stage.run(0.05);
  const people = systems.people;
  expect(people.all().map((p) => p.id)).toEqual([
    'tamsin', 'maren', 'gus', 'wren',
    'villager-1', 'villager-2', 'villager-3', 'villager-4', 'villager-5', 'villager-6', 'villager-7', 'villager-8', 'villager-9', 'villager-10',
  ]);
  const posts = { tamsin: 'grant.stone', maren: 'granary', gus: 'gus.field', wren: 'kennel' };
  for (const [id, place] of Object.entries(posts) as [NpcId, string][]) {
    const person = people.get(id)!;
    expect(person.place).toBe(place);
    expect(at(person.pos, PLACES[place])).toBe(true);
    expect(person).toMatchObject({ sprite: id, portrait: id, voice: id });
    expect(actors.get('npc:' + id)!.sprite).toBe(id);
    expect(stage.prompts.get('npc:' + id)!.prompt()).toBe('Talk to ' + person.name);
  }
  const sprites = people.all().slice(4).map((p) => p.sprite);
  // Ten residents, ten different faces, each one of the crowd's: two villagers, eight townsfolk and two acolytes.
  expect(new Set(sprites).size).toBe(10);
  for (const s of sprites) expect(CROWD_SPRITES as readonly string[]).toContain(s);
  // And five who come to live on the player's land later: Hobb, Dax, Mina, Tansy and Holt, not in the world yet.
  expect(actors.size).toBe(19);
  expect(PEOPLE.length).toBe(19);
  expect(people.all().length).toBe(14);
  for (const id of ['hobb', 'dax', 'mina', 'tansy', 'holt'] as NpcId[]) {
    expect(people.get(id)).toBeUndefined();
    expect(actors.get('npc:' + id)!.visible).toBe(false);
    expect(stage.prompts.get('npc:' + id)!.prompt()).toBeNull();
  }

  // Nobody shares a block.
  const blocks = new Set(people.all().map((p) => `${Math.floor(p.pos.x)},${Math.floor(p.pos.z)}`));
  expect(blocks.size).toBe(people.all().length);
});

test('Queen Maren sleeps in the granary until the hero meets her there, then keeps the Queen\'s Hall', () => {
  const stage = hollowmere();
  const { flags, systems } = stage.kernel.game;
  const maren = () => systems.people.get('maren')!;
  stage.run(0.05);
  expect(maren().place).toBe('granary');
  flags.set('scene.22', true);
  stage.run(40);
  expect(maren().place).toBe('town.hall');
  expect(at(maren().pos, PLACES['town.hall'])).toBe(true);
});

test('Tamsin waits at the grant stone until the first night is over, then keeps the lodge by day and stands near it at night', () => {
  const stage = hollowmere();
  const { flags, systems } = stage.kernel.game;
  const tamsin = (): Vec3 => systems.people.get('tamsin')!.pos;
  stage.run(0.05);
  hour(stage, 23);
  stage.run(1);
  expect(at(tamsin(), PLACES['grant.stone'])).toBe(true);

  hour(stage, 10);
  flags.set('quest.night.done', true);
  stage.run(40);
  expect(systems.people.get('tamsin')!.place).toBe('lodge');
  expect(at(tamsin(), PLACES.lodge)).toBe(true);

  hour(stage, 21);
  stage.run(5);
  expect(systems.people.get('tamsin')!.place).toBe('lodge');
  expect(at(tamsin(), [PLACES.lodge[0] + 3, PLACES.lodge[1] + 2])).toBe(true);
});

test('the villagers move between their places every few minutes', () => {
  const stage = hollowmere();
  const people = stage.kernel.game.systems.people;
  stage.run(0.05);
  const seen = new Map<string, Set<string>>();
  for (let i = 0; i < 60; i++) {
    stage.run(10);
    for (const p of people.all()) {
      if (!seen.has(p.id)) seen.set(p.id, new Set());
      seen.get(p.id)!.add(p.place);
    }
  }
  for (let n = 1; n <= 6; n++) expect([...seen.get('villager-' + n)!].sort()).toEqual(['river.bank', 'town.gate', 'town.square']);
  // The ones with a post never left it.
  expect([...seen.get('maren')!]).toEqual(['granary']);
  // And everybody is on the ground, on a block of their own or walking.
  for (const p of people.all()) expect(p.pos.y).toBe(FEET);
});

test.each([false,true])('a person briefly waits in talking range, then resumes even if the player stays', (leave) => {
  const stage = town();
  stage.run(0.05);
  const pos=stage.kernel.game.systems.people.get(ANN)!.pos;
  stage.player(HOME[0]+1,HOME[1]);
  hour(stage,12.5);
  stage.run(1.5);
  expect(at(pos,HOME)).toBe(true);
  expect(stage.kernel.game.actors.get('npc:ann')!.anim).toBe('idle');
  if(leave) stage.player(14,10);
  stage.run(12);
  expect(at(pos,SHOP)).toBe(true);
});

test('the background crowd has distinct faces that survive a reload', () => {
  const residents = PEOPLE.filter(p => p.crowd);
  const defs = residents.map(p => ({ ...p, routine: [{hour: 0, place: 'home'}], wander: undefined }));
  const first = town(defs);
  first.run(.05);
  const faces = first.kernel.game.systems.people.all().map(p => p.sprite);
  expect(new Set(faces).size).toBe(10);
  for (const s of faces) expect(CROWD_SPRITES as readonly string[]).toContain(s);
  const reload = town(defs, first.kernel.save());
  reload.run(.05);
  expect(reload.kernel.game.systems.people.all().map(p => p.sprite)).toEqual(faces);
  for (const p of reload.kernel.game.systems.people.all()) {
    expect(reload.kernel.game.actors.get('npc:' + p.id)!.sprite).toBe(p.sprite);
  }
});


test('a festival passer yields to a quest guest within one step of the player', () => {
  const stage = makeStage({places:{home:HOME,shop:SHOP},install:[installNav,installInteract,withPeople([ann,bo])]});
  stage.kernel.game.clock.timeOfDay = 8 / 24;
  stage.player(24,6);
  stage.run(.05);
  const {people,interact} = stage.kernel.game.systems;
  people.send(ANN,'shop',{x:4,z:0});
  people.hold(ANN,true);
  const passing = people.get(ANN)!.pos;
  Object.assign(passing, stage.kernel.game.player.pos);
  // Bo is beside the player. Ann is crossing directly through the player.
  people.get(BO)!.pos.x += .3;
  people.setMark(BO,'quest');
  expect(interact.nearest()?.id).toBe('npc:bo');
  // Travelling does not stop a person offering Talk when no quest guest is close.
  people.setMark(BO,'');
  expect(interact.nearest()?.id).toBe('npc:ann');
});
