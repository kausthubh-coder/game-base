// Sprinklers: a sprinkler is a machine part. It wets the eight blocks round it while its shaft runs, at the shaft's
// speed, and the crops system reads that from `machines.sprinkled` each second. The machines system tells the
// effects each time one runs (`sprinkler.ran`). This system is kept so a save and the order of systems keep their
// place; it has nothing of its own to do.
import type { Kernel } from '../kernel.sim.ts';

/** Seconds of game time between two runs a view may show. */
export const SPRINKLE_EVERY = 5;

export function install(kernel: Kernel): void {
  kernel.addPlain('sprinklers', {});
}
