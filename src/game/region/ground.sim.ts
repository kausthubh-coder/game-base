// Arrival work uses the ordinary block, inventory and interaction systems. Flags and world edits save it.
import type { Vec3 } from '../../engine/types.ts';
import type { Game } from '../api.sim.ts';
import { BRAMBLES, CAMP } from '../content/region.ts';

export function joinGround(game: Game): void {
  const { flags, systems, events } = game;
  const work = () => flags.get('quest.ground.step') === 'camp';
  const have = (id: 'oak_log' | 'fiber', n: number) => systems.inventory.count(id) >= n;
  systems.interact.add({
    id: 'ground:tent',
    pos: () => CAMP.tentApproach,
    radius: 3,
    prompt: () =>
      work() && !flags.is('camp.pitched')
        ? 'Pitch your tent (2 logs, 1 fiber)'
        : flags.is('camp.pitched')
          ? 'Sleep in your tent'
          : null,
    act: () => {
      if (flags.is('camp.pitched')) {
        if (systems.time.canSleep()) systems.time.sleep();
        else events.emit('toast', { text: 'You can sleep here after dusk.' });
        return;
      }
      if (!work()) return;
      if (!have('oak_log', 2) || !have('fiber', 1)) {
        events.emit('toast', { text: 'Gather 2 logs and 1 fiber for the tent.' });
        return;
      }
      systems.inventory.remove('oak_log', 2);
      systems.inventory.remove('fiber', 1);
      flags.set('camp.pitched', true);
    },
  });
  systems.interact.add({
    id: 'ground:fire',
    pos: () => CAMP.fire,
    radius: 2.5,
    prompt: () =>
      work() && flags.is('camp.pitched') && !flags.is('camp.fire')
        ? 'Light your fire (1 log)'
        : null,
    act: () => {
      if (!work() || !flags.is('camp.pitched') || flags.is('camp.fire')) return;
      if (!have('oak_log', 1)) {
        events.emit('toast', { text: 'Gather a log for the fire.' });
        return;
      }
      systems.inventory.remove('oak_log', 1);
      flags.set('camp.fire', true);
      flags.set('step.ground.camp', true);
    },
  });
  events.on('block.broken', ({ x, y, z, by }) => {
    if (by !== 'player' || !BRAMBLES.some((b) => b.x === x && b.y === y && b.z === z)) return;
    if (BRAMBLES.every((b) => game.world.getBlock(b.x, b.y, b.z) === 0))
      flags.set('step.ground.brambles', true);
  });
}

/** Resolve a standing hero out of canvas in tent-local space. No world edits or save migration. */
export function clearCampTent(at: Vec3): boolean {
  const tent = CAMP.tent, bounds = CAMP.tentClearance;
  if (at.y >= tent.y + bounds.height || at.y + 2 <= tent.y) return false;
  const c = Math.cos(tent.rotation), s = Math.sin(tent.rotation);
  const dx = at.x - tent.x, dz = at.z - tent.z;
  let x = c * dx - s * dz, z = s * dx + c * dz;
  if (Math.abs(x) >= bounds.halfWidth || Math.abs(z) >= bounds.halfDepth) return false;
  // Old saves inside the tent come out through the nearest side; the exact centre uses the entrance.
  if (Math.abs(x) < .001 && Math.abs(z) < .001) z = bounds.halfDepth + .001;
  else if (bounds.halfWidth - Math.abs(x) < bounds.halfDepth - Math.abs(z))
    x = (x < 0 ? -1 : 1) * (bounds.halfWidth + .001);
  else z = (z < 0 ? -1 : 1) * (bounds.halfDepth + .001);
  at.x = tent.x + c * x + s * z;
  at.z = tent.z - s * x + c * z;
  return true;
}
