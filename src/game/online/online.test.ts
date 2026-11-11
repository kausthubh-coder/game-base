// The browser's copy of an online world, without a page: the hero put right by the server's answer, the
// others drawn between two updates, the address, and the bus the systems no longer hear.
import { describe, expect, test } from 'bun:test';
import type { BodyState } from '../../engine/net/messages.ts';
import { HeroBody } from '../../features/hero/index.ts';
import { World } from '../../features/world/index.ts';
import { createEvents } from '../kernel.sim.ts';
import { createOthers, createServerClock } from './interp.ts';
import { devToken, readJoin, soloAddress } from './join.ts';
import { createPredictor, wireSteer, type Steer } from './predict.ts';
import { splitEvents } from './relay.ts';

/** A patch of land with the spawn's chunks made, and a body standing on it. */
function land(): { world: World; at: { x: number; y: number; z: number } } {
  const world = new World(1);
  for (let cx = -2; cx <= 1; cx++) for (let cz = -16; cz <= -12; cz++) world.load(cx, cz);
  const x = -2.5, z = -222.5;
  return { world, at: { x, y: world.heightAt(x, z), z } };
}

const stateOf = (b: HeroBody): BodyState => ({ x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, facing: b.facing, ground: b.grounded, water: b.swimming });

describe('the hero in an online world', () => {
  test('with the server a few inputs behind, the replayed hero is exactly where the browser has it', () => {
    const { world, at } = land();
    const mine = new HeroBody(world, at, undefined, { stepUp: 1 });
    const server = new HeroBody(world, at, undefined, { stepUp: 1 });
    const predictor = createPredictor(new HeroBody(world, at, undefined, { stepUp: 1 }));
    const sent: number[][] = [];
    // Twenty steps of walking with a turn and a jump; the server is five inputs behind.
    for (let n = 1; n <= 20; n++) {
      for (let b = 0; b < 3; b++) {
        const steer: Steer = { moveX: n < 10 ? 1 : Math.SQRT1_2, moveZ: n < 10 ? 0 : Math.SQRT1_2, jump: n === 12 && b === 0 };
        wireSteer(steer);
        mine.step(steer);
        predictor.stepped(steer);
      }
      const moves = predictor.moves();
      predictor.sent(n, moves, mine);
      sent.push(moves);
    }
    for (let n = 1; n <= 15; n++) {
      const moves = sent[n - 1];
      for (let i = 0; i < moves.length; i += 3) server.step({ moveX: moves[i], moveZ: moves[i + 1], jump: moves[i + 2] === 1 });
    }
    const now = predictor.answer(15, stateOf(server));
    expect(now).not.toBeNull();
    expect(now!.x).toBe(mine.x);
    expect(now!.y).toBe(mine.y);
    expect(now!.z).toBe(mine.z);
    expect(predictor.stats.maxGap).toBe(0);
    expect(predictor.waiting).toBe(5);
  });

  test('when the server had the hero elsewhere, the answer moves them by that much and says how far', () => {
    const { world, at } = land();
    const mine = new HeroBody(world, at, undefined, { stepUp: 1 });
    const predictor = createPredictor(new HeroBody(world, at, undefined, { stepUp: 1 }));
    const steer: Steer = { moveX: 1, moveZ: 0, jump: false };
    for (let b = 0; b < 3; b++) { mine.step(steer); predictor.stepped(steer); }
    predictor.sent(1, predictor.moves(), mine);
    // The server's body is half a block further north after the same input.
    const server = { ...stateOf(mine), z: mine.z - 0.5 };
    const now = predictor.answer(1, server);
    expect(now!.z).toBeCloseTo(mine.z - 0.5, 6);
    expect(predictor.stats.lastGap).toBeCloseTo(0.5, 6);
    // An answer older than one already taken is not used.
    expect(predictor.answer(0, server)).toBeNull();
  });

  test('steering goes on the wire to a thousandth, and the hero takes the same numbers', () => {
    const steer: Steer = { moveX: Math.SQRT1_2, moveZ: -0.00001, jump: false };
    wireSteer(steer);
    expect(steer).toEqual({ moveX: Math.round(Math.SQRT1_2 * 1000) / 1000, moveZ: 0, jump: false });
    expect(Object.is(steer.moveZ, -0)).toBe(false);
  });
});

describe('the others in an online world', () => {
  test('a player is drawn a tenth of a second behind, between the two updates around that moment', () => {
    const others = createOthers();
    const at = (step: number, x: number) => others.take(step, [{ id: 'player:bo', sprite: 'hero', x, y: 20, z: 0, facing: 0, anim: 'walk', name: 'Bo' }], undefined);
    at(10, 0);
    at(11, 0.2);
    at(12, 0.4);
    const track = others.tracks.get('player:bo')!;
    const out = { x: 0, y: 0, z: 0, facing: 0 };
    expect(others.sample(track, 13, out).x).toBeCloseTo(0.2, 6);
    expect(others.sample(track, 13.5, out).x).toBeCloseTo(0.3, 6);
    // Past the newest update, they stand at it.
    expect(others.sample(track, 20, out).x).toBeCloseTo(0.4, 6);
  });

  test('after standing still, an actor starts from where it stood, not sliding over the whole wait', () => {
    const others = createOthers();
    const take = (step: number, x: number) => others.take(step, [{ id: 'creature:mossling:1', sprite: 'mossling', x, y: 20, z: 0, facing: 0, anim: 'walk' }], undefined);
    take(4, 0);
    take(40, 1);
    const track = others.tracks.get('creature:mossling:1')!;
    const out = { x: 0, y: 0, z: 0, facing: 0 };
    // Drawn five steps behind: at 41 it is at step 36, still standing.
    expect(others.sample(track, 41, out).x).toBe(0);
    expect(others.sample(track, 43, out).x).toBeCloseTo(0.5, 6);
  });

  test('one that goes is forgotten', () => {
    const others = createOthers();
    others.take(1, [{ id: 'player:ann', sprite: 'hero', x: 0, y: 0, z: 0, facing: 0, anim: 'idle' }], undefined);
    others.take(2, undefined, ['player:ann']);
    expect(others.tracks.size).toBe(0);
  });

  test('the server clock follows the quickest snap and lets a held-up one pass', () => {
    const clock = createServerClock(20);
    clock.heard(100, 10);
    // Step 101 should have come at 10.05. It was held up, so the clock keeps the first snap's timing, less a little.
    clock.heard(101, 10.08);
    expect(clock.at(10.1)).toBeGreaterThan(101.95);
    expect(clock.at(10.1)).toBeLessThan(102);
    clock.heard(103, 10.1);
    expect(clock.at(10.1)).toBeCloseTo(103, 6);
  });
});

describe('the address of an online world', () => {
  const page = { protocol: 'https:', host: 'game.example' };
  test('reads the world, a dev name and another server', () => {
    expect(readJoin('?world=w1', page)).toEqual({ world: 'w1', dev: null, url: 'wss://game.example/world/w1' });
    expect(readJoin('?world=w1&dev=ann', { protocol: 'http:', host: '127.0.0.1:5547' })).toEqual({ world: 'w1', dev: 'ann', url: 'ws://127.0.0.1:5547/world/w1' });
    expect(readJoin('?world=w1&server=127.0.0.1:5540', page)?.url).toBe('ws://127.0.0.1:5540/world/w1');
    expect(readJoin('', page)).toBeNull();
    expect(readJoin('?world=../x', page)).toBeNull();
  });

  test('a dev token carries the name, and solo play is the address without the world', () => {
    expect(devToken('ann')).toBe('dev:ann:Ann');
    expect(soloAddress('https://game.example/?world=w1&dev=ann&quality=low')).toBe('https://game.example/?quality=low');
  });
});

describe('the bus in an online world', () => {
  test('a system installed before the split hears nothing after it; a view hears the server and itself', () => {
    const events = createEvents();
    const system: string[] = [], view: string[] = [];
    events.onAny((name) => system.push(name));
    const relay = splitEvents(events);
    events.onAny((name) => view.push(name));
    relay.fromServer('block.placed', { x: 0, y: 0, z: 0, id: 1, by: 'player' });
    events.emit('ui.sound', { sound: 'click' });
    relay.quietly(() => events.emit('inventory.changed', {}));
    expect(system).toEqual([]);
    expect(view).toEqual(['block.placed', 'ui.sound']);
  });
});
