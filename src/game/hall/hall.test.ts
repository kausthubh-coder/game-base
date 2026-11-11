// Ilara's Hall through the real rules. The whole first night is played, step by step, in src/game/play.
// These tests cover what that play does not pin down: the scenes' names, the door's cells, the sleep guard
// outside the night, the Heartstone's sum and a game that skips past the night.

import { expect, test } from 'bun:test';
import { CONVERSATIONS, CUSTODIAN_HEART, SCENE } from '../content/dialogue.ts';
import { HALL } from '../content/region.ts';
import { newPlay, type Play } from '../play/harness.sim.ts';
import { CUSTODIAN_ID, FOX_ID, HEART_WORTH, SCENES, heartWords } from './index.sim.ts';

const AIR = 0;

function doorCells(p: Play): number[] {
  const door = HALL.door, cells: number[] = [];
  for (let x = door.x0; x <= door.x1; x++) for (let y = door.y0; y <= door.y1; y++) cells.push(p.world.getBlock(x, y, door.z));
  return cells;
}

test('every scene the hall starts is a conversation, and every scene conversation is one the hall starts', () => {
  const scenes = CONVERSATIONS.filter((c) => c.npc === SCENE).map((c) => c.id).sort();
  expect(scenes).toEqual([...SCENES].sort());
});

test('a new game has the door shut, the Custodian asleep on its plinth and no fox', () => {
  const p = newPlay();
  p.advance(0.5);
  expect(doorCells(p).every((id) => id !== AIR)).toBe(true);
  // It lies on top of its plinth.
  const top = { x: HALL.plinth.x, y: HALL.plinth.y + HALL.plinthTop, z: HALL.plinth.z };
  expect(p.game.actors.get(CUSTODIAN_ID)).toMatchObject({ sprite: 'custodian', anim: 'sleep', mark: 'sleep', pos: top });
  expect(p.game.actors.has(FOX_ID)).toBe(false);
  expect(p.sys.hall.fox()).toBeNull();
});

test('the Hall cannot be dug into or built in', () => {
  const p = newPlay();
  p.advance(0.5);
  const { court, ground } = HALL;
  for (const [x, z] of [[court.x0, court.z0], [court.x1, court.z1], [HALL.door.x0, HALL.door.z], [-17, -260]] as const) {
    expect(p.sys.region.isProtected(x, ground, z), `${x}, ${z}`).toBe(true);
  }
  // One block outside each wall is the player's to change.
  expect(p.sys.region.isProtected(court.x0 - 1, ground, court.z0 - 1)).toBe(false);
  expect(p.sys.region.isProtected(-17, ground, court.z1 + 1)).toBe(false);
});

test('outside the first night the hall keeps nobody awake', () => {
  const p = newPlay();
  p.advance(0.5);
  const day = p.game.clock.day;
  p.sys.time.sleep();
  expect(p.game.clock.day).toBe(day + 1);
  expect(p.game.flags.is('night.fox')).toBe(false);
});

test('a game that skips past the night finds the door open, the Custodian awake and the fox gone', () => {
  const p = newPlay();
  p.advance(0.5);
  p.sys.quests.skipTo('leaftail');
  p.advance(1);
  expect(doorCells(p).every((id) => id === AIR)).toBe(true);
  expect(p.game.actors.get(CUSTODIAN_ID)).toMatchObject({ anim: 'idle', mark: '' });
  expect(p.sys.hall.fox()).toBeNull();
  // The player can walk in and ask the Custodian something.
  expect(p.walkTo('hall.custodian', { within: 0.6, seconds: 120 })).toBe(true);
  expect(p.prompt()).toBe('Talk to the Custodian');
  p.interact();
  expect(p.talkThrough()).toEqual(['The fox went home to its garden. Feed it. A pact starts with food.']);
});

test('the open door, the woken Custodian and the fox on the doorstep come back from a save', () => {
  const p = newPlay();
  p.advance(0.5);
  p.sys.quests.skipTo('night');
  p.advance(0.5);
  // The scenes up to the Custodian, as the hall would have set them, with the fox still outside.
  for (const flag of ['night.fox', 'door.open', 'mark', 'custodian.awake']) p.game.flags.set(flag, true);
  p.advance(1);
  const fox = p.sys.hall.fox();
  expect(fox).not.toBeNull();

  const again = newPlay();
  again.kernel.load(JSON.parse(JSON.stringify(p.kernel.save())));
  again.advance(0.1);
  // It has walked on for a tenth of a second since: it stands where it was saved, to within its stride.
  const back = again.sys.hall.fox()!;
  expect(Math.hypot(back.x - fox!.x, back.z - fox!.z)).toBeLessThan(0.3);
  expect(again.game.actors.get(FOX_ID)).toMatchObject({ sprite: 'fox-blighted', mark: 'alert' });
  expect(again.game.actors.get(CUSTODIAN_ID)).toMatchObject({ anim: 'idle' });
});

test('the Heartstone adds up roofs, crops and bonded beasts', () => {
  const p = newPlay();
  p.advance(0.5);
  expect(p.sys.hall.heart()).toMatchObject({ level: 0 });
  expect(heartWords(p.sys.hall.heart())).toBe('The Heartstone holds 0. Nothing lives on your land yet.');

  const g = p.sys.region.grant(), y = p.sys.region.place('grant.center').at.y;
  expect(p.sys.placeables.place('bed', g.x + 4, y, g.z + 4, 0)).not.toBeNull();
  expect(p.sys.pets.bond?.(p.sys.pets.all()[0].id)).toBe(true);
  const heart = p.sys.hall.heart();
  expect(heart.level).toBe(HEART_WORTH.roof + HEART_WORTH.beast);
  expect(heartWords(heart)).toBe(`The Heartstone holds ${heart.level}. 1 roof, 1 beast.`);
});

test('once awake, the Custodian says one line as the Heartstone rises past 3, 6 and 10, and each only once', () => {
  const p = newPlay();
  p.advance(0.5);
  p.sys.quests.skipTo('leaftail');
  p.advance(1);
  const lines = (): string[] => p.said.filter((text) => text.startsWith('The Custodian: '));
  const g = p.sys.region.grant(), y = p.sys.region.place('grant.center').at.y;
  const start = p.sys.hall.heart().level;
  // What the stone held before the Custodian could watch it is never remarked on.
  expect(lines()).toEqual([]);
  let beds = 0;
  const bed = (): void => {
    expect(p.sys.placeables.place('bed', g.x + 2 + 2 * beds, y, g.z + 6, 0)).not.toBeNull();
    beds++;
    p.advance(1);
  };
  while (p.sys.hall.heart().level < 10) bed();
  const said = CUSTODIAN_HEART.filter(([at]) => at > start).map(([, text]) => `The Custodian: ${text}`);
  expect(said.length).toBeGreaterThan(0);
  expect(lines()).toEqual(said);
  for (const [at] of CUSTODIAN_HEART.filter(([at]) => at > start)) expect(p.game.flags.is(`heart.said.${at}`)).toBe(true);

  // Torn down and built again, the stone crosses the same levels without a second word.
  for (const placed of p.sys.placeables.all().filter((placed) => placed.kind === 'bed')) p.sys.placeables.remove(placed.id);
  p.advance(1);
  while (p.sys.hall.heart().level < 10) bed();
  expect(lines()).toEqual(said);
});

test('the Custodian says nothing while it sleeps, however high the stone goes', () => {
  const p = newPlay();
  p.advance(0.5);
  const g = p.sys.region.grant(), y = p.sys.region.place('grant.center').at.y;
  for (let i = 0; i < 6; i++) p.sys.placeables.place('bed', g.x + 2 + 2 * i, y, g.z + 6, 0);
  p.advance(1);
  expect(p.sys.hall.heart().level).toBeGreaterThanOrEqual(10);
  expect(p.said.filter((text) => text.startsWith('The Custodian: '))).toEqual([]);
});
