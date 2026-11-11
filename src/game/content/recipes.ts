// Every recipe, as data. The numbers come from docs/play/act1.md. A new recipe is a new row.
import type { Recipe } from '../api.sim.ts';

/** `hand` needs no station. Any other station must stand near the player. */
export const recipes: readonly Recipe[] = [
  { id: 'plank', makes: { id: 'plank', count: 4 }, needs: [{ id: 'oak_log', count: 1 }], station: 'hand' },
  { id: 'workbench', makes: { id: 'workbench', count: 1 }, needs: [{ id: 'plank', count: 4 }], station: 'hand' },
  { id: 'bed', makes: { id: 'bed', count: 1 }, needs: [{ id: 'plank', count: 6 }, { id: 'fiber', count: 3 }], station: 'workbench' },
  { id: 'chest', makes: { id: 'chest', count: 1 }, needs: [{ id: 'plank', count: 8 }], station: 'workbench' },
  { id: 'lamp', makes: { id: 'lamp', count: 1 }, needs: [{ id: 'plank', count: 1 }, { id: 'moss_tuft', count: 1 }], station: 'workbench' },
  // The pieces of build mode. A fence is cheap, so a pen costs a few logs. A sprinkler asks for the mosslings' tufts.
  { id: 'fence', makes: { id: 'fence', count: 4 }, needs: [{ id: 'plank', count: 2 }, { id: 'fiber', count: 1 }], station: 'workbench' },
  { id: 'sprinkler', makes: { id: 'sprinkler', count: 1 }, needs: [{ id: 'plank', count: 4 }, { id: 'moss_tuft', count: 2 }], station: 'workbench' },
];

/** How far from the player a station may stand, in blocks. */
export const stationReach = 5;
