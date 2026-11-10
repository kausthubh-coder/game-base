// Creatures: living things that follow rules written as data in content/creatures.ts.
// `install` adds the system to the kernel as `game.systems.creatures`.

import { CREATURES, type CreatureKind } from '../content/creatures.ts';
import type { Kernel } from '../kernel.sim.ts';
import { createCreatures } from './engine.sim.ts';

export { SLEEP_DISTANCE, createCreatures, type CreaturesSave } from './engine.sim.ts';

/** `kinds` is for tests and for a build that wants its own list. The game passes nothing. */
export function install(kernel: Kernel, kinds: readonly CreatureKind[] = CREATURES): void {
  const { api, system } = createCreatures(kernel.game, kinds);
  kernel.add('creatures', api, system);
}
