// Ilara's Hall through the real rules. The whole first night is played, step by step, in src/game/play.
// These tests cover what that play does not pin down: the scenes' names, the door's cells, the sleep guard
// outside the night, the Heartstone the settlement gives and a game that skips past the night.

import { expect, test } from 'bun:test';
import { CONVERSATIONS, SCENE } from '../content/dialogue.ts';
import { HEART_LADDER } from '../content/people.ts';
import { HALL } from '../content/region.ts';
import { distance2d } from '../move.sim.ts';
import { newPlay, type Play } from '../play/harness.sim.ts';
import { FIRST_NIGHT, HUT } from '../play/script.ts';
import { CUSTODIAN_ID, FOX_ID, SCENES, heartWords } from './index.sim.ts';

const AIR = 0;

function doorCells(p: Play): number[] {
  const door = HALL.door, cells: number[] = [];
  for (let x = door.x0; x <= door.x1; x++) for (let y = door.y0; y <= door.y1; y++) cells.push(p.world.getBlock(x, y, door.z));
  return cells;
}

test('every scene the hall starts is a conversation spoken by no one in the world', () => {
  // The story director starts the other scenes of act 1 (src/game/story/scenes.sim.ts).
  for (const id of SCENES) expect(CONVERSATIONS.find((c) => c.id === id)?.npc, id).toBe(SCENE);
});

test('a new game has the door shut, the Custodian asleep on its plinth and no fox', () => {
  const p = newPlay();
  p.advance(0.5);
  expect(doorCells(p).every((id) => id !== AIR)).toBe(true);
  // It lies on top of its plinth.
  const top = { x: HALL.plinth.x, y: HALL.plinth.y + HALL.plinthTop, z: HALL.plinth.z };
  expect(p.game.actors.get(CUSTODIAN_ID)).toMatchObject({ sprite: 'custodian-wake', anim: 'sleep', mark: 'sleep', pos: top });
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
  p.sys.quests.skipTo('blessing');
  p.advance(1);
  expect(doorCells(p).every((id) => id === AIR)).toBe(true);
  expect(p.game.actors.get(CUSTODIAN_ID)).toMatchObject({ anim: 'idle', mark: '' });
  expect(p.sys.hall.fox()).toBeNull();
  // The player can walk in and ask the Custodian something, once the blessing the director starts is over.
  let walked = false;
  for (let tries = 0; tries < 6 && !walked; tries++) {
    p.talkThrough();
    walked = p.walkTo('hall.custodian', { within: 0.6, seconds: 120 });
  }
  expect(walked).toBe(true);
  p.talkThrough();
  expect(p.prompt()).toBe('Talk to the Custodian');
  p.interact();
  expect(p.talkThrough()).toHaveLength(1);
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

test('at the camp the fox stands at the edge of the firelight, waits there until the player walks, and the night plays to its end', () => {
  const p = newPlay();
  p.advance(0.5);
  p.sys.quests.skipTo('night');
  p.advance(0.5);
  // The hut the night ends in: a game that skipped here has none, as in src/game/play/script.ts.
  for (const step of HUT) step.run(p);
  expect(p.walkTo('camp.seat', { within: 0.4, seconds: 120 })).toBe(true);
  // Dusk at the fire: the rules hear the fox, which is the moment scene 9 starts.
  p.sys.time.setTimeOfDay(0.76);
  expect(p.until(() => p.game.flags.is('night.fox'), 2)).toBe(true);
  expect(p.said.at(-1)).toBe('Something grey is moving at the edge of your camp.');
  p.advance(1);
  const edge = p.sys.region.place('camp.edge').at, seat = p.game.player.pos;
  expect(p.sys.hall.fox()).toEqual(edge);
  expect(p.game.actors.get(FOX_ID)).toMatchObject({ anim: 'shake', mark: 'alert' });
  // It faces the player.
  const facing = p.game.actors.get(FOX_ID)!.facing;
  expect(Math.abs(facing - Math.atan2(seat.x - edge.x, -(seat.z - edge.z)))).toBeLessThan(1e-6);

  // A while later it is still there, and still after a save and a load.
  p.advance(8);
  expect(p.sys.hall.fox()).toEqual(edge);
  const again = p.reload();
  again.advance(1);
  expect(again.sys.hall.fox()).toEqual(edge);

  // The player walks toward the door, and it follows, slower than they walk.
  expect(again.walkTo('grant.center', { within: 1, seconds: 30 })).toBe(true);
  again.advance(1);
  const fox = again.sys.hall.fox()!;
  expect(distance2d(fox, edge)).toBeGreaterThan(2);
  expect(again.game.actors.get(FOX_ID)?.anim).not.toBe('shake');

  // From there the night goes on as it does from the bed.
  for (const step of FIRST_NIGHT.slice(1)) step.run(again);
  expect(again.game.flags.is('quest.night.done')).toBe(true);
}, 120_000);

test('away from the camp the fox comes near the player as before', () => {
  const p = newPlay();
  p.advance(0.5);
  p.sys.quests.skipTo('night');
  p.advance(0.5);
  // The north-east of the plot, well out of the firelight.
  const g = p.sys.region.grant();
  expect(p.walkTo({ x: g.x + g.width - 5.5, y: p.sys.region.place('grant.center').at.y, z: g.z + 5.5 }, { within: 0.6, seconds: 120 })).toBe(true);
  const camp = p.sys.region.place('camp').at;
  expect(distance2d(p.game.player.pos, camp)).toBeGreaterThan(10);
  p.sys.time.setTimeOfDay(0.76);
  expect(p.until(() => p.sys.hall.fox() !== null, 3)).toBe(true);
  expect(distance2d(p.sys.hall.fox()!, p.game.player.pos)).toBeLessThan(10);
  expect(distance2d(p.sys.hall.fox()!, p.sys.region.place('camp.edge').at)).toBeGreaterThan(1);
});

test('the Heartstone is the settlement\'s number: 0 on a new game, the first step once the night\'s stone is seen on land with water and a fire', () => {
  const p = newPlay();
  p.advance(0.5);
  expect(p.sys.hall.heart()).toEqual(p.sys.settlement.heartstone());
  expect(p.sys.hall.heart().level).toBe(0);
  expect(heartWords(p.sys.hall.heart())).toBe('The Heartstone holds 0. Nothing lives on your land yet.');
  // Beds do not count by themselves: chapter 30's ladder does.
  const g = p.sys.region.grant(), y = p.sys.region.place('grant.center').at.y;
  expect(p.sys.placeables.place('bed', g.x + 4, y, g.z + 4, 0)).not.toBeNull();
  p.advance(1);
  expect(p.sys.hall.heart().level).toBe(0);
  // Seen, but no water in a field yet: still dormant.
  p.game.flags.set('heart.seen', true);
  expect(p.sys.hall.heart().level).toBe(0);
  // The first day's ditch and camp: step 1, read at once.
  p.game.flags.set('step.ground.ditch', true);
  p.game.flags.set('step.ground.camp', true);
  expect(p.sys.hall.heart().level).toBe(1);
  expect(heartWords(p.sys.hall.heart())).toBe('The Heartstone holds 1.');
  // The settlement writes the level to the flag quests read.
  expect(p.game.flags.get('heartstone')).toBe(1);
});

test('the Custodian\'s lines wait for levels the stone has not reached, so it says nothing at the first step', () => {
  const p = newPlay();
  p.advance(0.5);
  p.sys.quests.skipTo('blessing');
  p.advance(2);
  expect(p.sys.hall.heart().level).toBe(1);
  expect(HEART_LADDER[0].says).toBe('');
  expect(p.said.filter((text) => text.startsWith('The Custodian: '))).toEqual([]);
});

test('dawn ends the night for a player still up after the Heartstone, as a sleep would', () => {
  const p = newPlay();
  p.advance(0.5);
  p.sys.quests.skipTo('night');
  for (const flag of ['night.fox', 'door.open', 'mark', 'hall.lit', 'custodian.awake', 'fox.calmed', 'fox.gone', 'heart.seen']) p.game.flags.set(flag, true);
  p.advance(1);
  expect(p.game.flags.get('quest.night.step')).toBe('sleep');
  const day = p.game.clock.day;
  p.advance(p.sys.time.dayLength);
  expect(p.game.clock.day).toBe(day + 1);
  p.advance(1);
  expect(p.game.flags.is('night.over')).toBe(true);
  expect(p.game.flags.get('quest.night.step')).toBe('tamsin');
}, 60_000);


test('scene 12 holds one eye open for its first line, then wakes before the awake flag', () => {
  const p = newPlay();
  p.advance(0.5);
  p.sys.talk.start('custodian.wake');
  p.sys.talk.advance();
  p.sys.talk.advance();
  p.advance(0.1);
  expect(p.game.actors.get(CUSTODIAN_ID)).toMatchObject({ anim: 'eye', mark: '' });
  expect(p.game.flags.is('custodian.awake')).toBe(false);
  p.sys.talk.advance();
  p.advance(0.1);
  expect(p.game.actors.get(CUSTODIAN_ID)?.anim).toBe('waking');
  p.sys.talk.advance();
  p.advance(0.1);
  expect(p.game.actors.get(CUSTODIAN_ID)?.anim).toBe('idle');
});
