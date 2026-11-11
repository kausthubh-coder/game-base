// Sprinklers: a placed thing whose definition has `waters` keeps the tilled soil around it wet. It wets the
// soil at the height of the ground it stands on, that many blocks each way, every 20 seconds and each morning.
import type { Systems } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';

/** Seconds of game time between two runs. Soil stays wet for 180, so it never dries between them. */
export const SPRINKLE_EVERY = 20;

export function install(kernel: Kernel): void {
  const game = kernel.game;
  const sys = game.systems as Partial<Systems>;
  /** How far each kind wets, by kind. Empty until the placeables system is there. */
  let reach: Map<string, number> | null = null;
  let wait = 0;

  function run(): void {
    const placeables = sys.placeables, crops = sys.crops;
    if (!placeables || !crops?.wet) return;
    if (!reach) {
      reach = new Map();
      for (const def of placeables.defs()) if (def.waters) reach.set(def.kind, def.waters);
    }
    const all = placeables.all();
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      const r = reach.get(p.kind);
      if (r === undefined) continue;
      let wet = 0;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (crops.wet(p.x + dx, p.y - 1, p.z + dz)) wet++;
      if (wet > 0) game.events.emit('sprinkler.ran', { x: p.x, y: p.y, z: p.z, reach: r });
    }
  }

  game.events.on('placeable.placed', () => { wait = 0; });
  game.events.on('day.started', () => { wait = 0; });
  // The order of the systems puts this one after crops, so soil tilled in a step is wet by the end of it.
  game.events.on('soil.tilled', () => { wait = Math.min(wait, 1); });

  kernel.addPlain('sprinklers', {
    step(dt) {
      wait -= dt;
      if (wait > 0) return;
      wait = SPRINKLE_EVERY;
      run();
    },
  });
}
