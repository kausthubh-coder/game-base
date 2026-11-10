import { expect, test } from 'bun:test';
import { World } from '../../features/world/world.sim.ts';
import { HeroBody } from '../../features/hero/hero.sim.ts';
import { REGION } from '../content/region.ts';
import { search } from './nav.sim.ts';

test('the keyboard-steered hero clears the trunk on the garden-to-grant route', () => {
  const world = new World(1);
  for (let cx = -6; cx <= 1; cx++) for (let cz = -17; cz <= -11; cz++) world.load(cx, cz);
  const body = new HeroBody(world, { x: -80.5, y: 21, z: -226.5 });
  const stone = REGION.places.find(p => p.name === 'grant.stone')!;
  const goal = { x: stone.x + .5, y: stone.y, z: stone.z + .5 };
  let path = search(world, body, goal)!.path;
  expect(path.length).toBeGreaterThan(1);
  let next = 0, checkX = body.x, checkZ = body.z, stuck = 0;
  const input = { moveX: 0, moveZ: 0, jump: false };

  // Match the browser's actual keyboard steering and waypoint tolerance. A point-only
  // walker passed this route while the hero caught the trunk at (-44, -222).
  for (let i = 0; i < 3000 && Math.hypot(body.x - goal.x, body.z - goal.z) > 2; i++) {
    while (next < path.length - 1 && Math.hypot(body.x - path[next].x, body.z - path[next].z) < .45) next++;
    const target = path[next];
    const dx = target.x - body.x, dz = target.z - body.z;
    const yaw = Math.PI / 4, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const length = Math.hypot(dx, dz) || 1;
    const forward = (dx * fx + dz * fz) / length, right = (dx * rx + dz * rz) / length;
    const f = Number(forward > .38) - Number(forward < -.38);
    const r = Number(right > .38) - Number(right < -.38);
    const n = Math.hypot(f, r) || 1;
    input.moveX = (fx * f - fz * r) / n;
    input.moveZ = (fz * f + fx * r) / n;
    for (let j = 0; j < 6; j++) { body.step(input); input.jump = false; }
    if (i % 11 === 10) {
      if (Math.hypot(body.x - checkX, body.z - checkZ) < .5) {
        input.jump = true;
        if (++stuck > 40) break;
        path = search(world, body, goal)!.path;
        next = 0;
      }
      checkX = body.x;
      checkZ = body.z;
    }
  }
  expect(Math.hypot(body.x - goal.x, body.z - goal.z), `hero stuck at ${body.x},${body.y},${body.z}`).toBeLessThanOrEqual(2);
});
