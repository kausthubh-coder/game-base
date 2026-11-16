import { expect, test } from 'bun:test';
import { CAMP } from '../content/region.ts';
import { newPlay } from '../play/harness.sim.ts';
import type { Keys } from '../shell/keys.ts';
import { createPlayer } from '../shell/player.ts';
import { correctCampTent } from './tent-clearance.ts';

function setup() {
  const p = newPlay();
  p.game.flags.set('camp.pitched', true);
  const hero = createPlayer(p.game, p.world, {} as Keys, CAMP.tent);
  return { p, hero, at: { x: 0, y: 0, z: 0 } };
}

test('saved camp flags do not create an obstacle in a region without camp', () => {
  const { p, hero, at } = setup();
  p.game.systems.region = { ...p.game.systems.region, place: () => { throw new Error('Unknown place: camp'); } };
  correctCampTent(p.game, hero, at);
  expect(hero.body.x).toBe(CAMP.tent.x);
  expect(hero.body.z).toBe(CAMP.tent.z);
});

test('canvas correction preserves sideways and vertical motion and synchronizes the player', () => {
  const { p, hero, at } = setup();
  const c = Math.cos(CAMP.tent.rotation), s = Math.sin(CAMP.tent.rotation);
  hero.body.vx = 2 * c - 3 * s;
  hero.body.vz = -2 * s - 3 * c;
  hero.body.vy = 5;
  hero.body.grounded = true;
  correctCampTent(p.game, hero, at);
  expect(hero.body.vx).toBeCloseTo(2 * c);
  expect(hero.body.vz).toBeCloseTo(-2 * s);
  expect(hero.body.vy).toBe(5);
  expect(hero.body.grounded).toBe(true);
  expect(p.game.player.onGround).toBe(true);
  expect(hero.actor.anim).toBe('walk');
  hero.blend(0);
  expect(hero.position.x).toBeCloseTo(hero.body.x);
  expect(hero.position.z).toBeCloseTo(hero.body.z);
});
