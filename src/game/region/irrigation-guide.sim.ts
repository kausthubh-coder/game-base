import type { Game } from '../api.sim.ts';
import { ARRIVAL_IRRIGATION } from '../content/region.ts';

/** Guidance reads the earned step; it never fills holes or advances the quest. */
export function irrigationGuide(flags: Game['flags']): typeof ARRIVAL_IRRIGATION | null {
  return flags.is('quest.ground.started') && !flags.is('quest.ground.done')
    && flags.get('quest.ground.step') === 'ditch' && !flags.is('step.ground.ditch')
    ? ARRIVAL_IRRIGATION : null;
}
