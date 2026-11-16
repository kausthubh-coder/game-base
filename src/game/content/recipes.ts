// Every recipe, as data. Act 1's are handbook chapter 30's: each part needs one farm good, the kit is made from
// farm goods, and travel meals need Hobb. A new recipe is a new row.
import type { Recipe } from '../api.sim.ts';
import { HOME_RECIPES } from './people.ts';

/** `hand` needs no station. Any other station must stand near the player. */
export const recipes: readonly Recipe[] = [
  { id: 'plank', makes: { id: 'plank', count: 4 }, needs: [{ id: 'oak_log', count: 1 }], station: 'hand' },
  { id: 'workbench', makes: { id: 'workbench', count: 1 }, needs: [{ id: 'plank', count: 4 }], station: 'hand' },
  // The ditch is dug with a spade, from the first day.
  { id: 'spade', makes: { id: 'spade', count: 1 }, needs: [{ id: 'plank', count: 2 }], station: 'hand' },
  { id: 'bed', makes: { id: 'bed', count: 1 }, needs: [{ id: 'plank', count: 6 }, { id: 'fiber', count: 3 }], station: 'workbench' },
  { id: 'chest', makes: { id: 'chest', count: 1 }, needs: [{ id: 'plank', count: 8 }], station: 'workbench' },
  // The design asks wax for a lamp. Bees come after the first lamps are needed, so moss light does until then.
  { id: 'lamp', makes: { id: 'lamp', count: 1 }, needs: [{ id: 'plank', count: 1 }, { id: 'moss_fiber', count: 1 }], station: 'workbench' },
  { id: 'fence', makes: { id: 'fence', count: 4 }, needs: [{ id: 'plank', count: 2 }, { id: 'fiber', count: 1 }], station: 'workbench' },
  // simple builds
  { id: 'post', makes: { id: 'post', count: 2 }, needs: [{ id: 'plank', count: 1 }], station: 'workbench' },
  { id: 'bee_box', makes: { id: 'bee_box', count: 1 }, needs: [{ id: 'plank', count: 4 }, { id: 'moss_fiber', count: 1 }], station: 'workbench' },
  { id: 'hatch', makes: { id: 'hatch', count: 1 }, needs: [{ id: 'plank', count: 3 }, { id: 'copper', count: 1 }], station: 'workbench' },
  { id: 'clapper', makes: { id: 'clapper', count: 1 }, needs: [{ id: 'plank', count: 2 }, { id: 'gear_spring', count: 1 }], station: 'workbench' },
  { id: 'rope_ladder', makes: { id: 'rope_ladder', count: 1 }, needs: [{ id: 'vine_rope', count: 2 }, { id: 'plank', count: 2 }], station: 'workbench' },
  // water power, from the Pump House
  { id: 'waterwheel', makes: { id: 'waterwheel', count: 1 }, needs: [{ id: 'plank', count: 6 }, { id: 'old_brass', count: 1 }], station: 'workbench' },
  { id: 'gear_shaft', makes: { id: 'gear_shaft', count: 2 }, needs: [{ id: 'copper', count: 1 }], station: 'workbench' },
  { id: 'lever', makes: { id: 'lever', count: 1 }, needs: [{ id: 'plank', count: 1 }, { id: 'copper', count: 1 }], station: 'workbench' },
  { id: 'sprinkler', makes: { id: 'sprinkler', count: 1 }, needs: [{ id: 'copper', count: 1 }, { id: 'frog_slick', count: 1 }], station: 'workbench' },
  // moving, once there is rope and springs
  { id: 'chute', makes: { id: 'chute', count: 2 }, needs: [{ id: 'plank', count: 2 }, { id: 'vine_rope', count: 1 }], station: 'workbench' },
  { id: 'collector_chest', makes: { id: 'collector_chest', count: 1 }, needs: [{ id: 'chest', count: 1 }, { id: 'moss_fiber', count: 2 }], station: 'workbench' },
  { id: 'pusher', makes: { id: 'pusher', count: 1 }, needs: [{ id: 'copper', count: 1 }, { id: 'gear_spring', count: 1 }], station: 'workbench' },
  // light, from the Lamp Gallery
  { id: 'sensor', makes: { id: 'sensor', count: 1 }, needs: [{ id: 'glow_dust', count: 1 }, { id: 'copper', count: 1 }], station: 'workbench' },
  { id: 'switch_lamp', makes: { id: 'switch_lamp', count: 1 }, needs: [{ id: 'glow_dust', count: 1 }, { id: 'wax', count: 1 }], station: 'workbench' },
  // cutting, from the Seed Vault
  { id: 'harvester_arm', makes: { id: 'harvester_arm', count: 1 }, needs: [{ id: 'gear_spring', count: 1 }, { id: 'copper', count: 2 }], station: 'workbench' },
  { id: 'saw_arm', makes: { id: 'saw_arm', count: 1 }, needs: [{ id: 'gear_spring', count: 1 }, { id: 'old_brass', count: 1 }], station: 'workbench' },
  // the kit: used up when it works
  { id: 'quill_strip', makes: { id: 'quill_strip', count: 1 }, needs: [{ id: 'quill', count: 3 }, { id: 'shed_pelt', count: 1 }], station: 'workbench' },
  { id: 'lamp_post_kit', makes: { id: 'lamp_post_kit', count: 1 }, needs: [{ id: 'plank', count: 2 }, { id: 'wax', count: 1 }], station: 'workbench' },
  { id: 'slick_patch', makes: { id: 'slick_patch', count: 1 }, needs: [{ id: 'frog_slick', count: 2 }], station: 'workbench' },
  { id: 'clapper_kit', makes: { id: 'clapper_kit', count: 1 }, needs: [{ id: 'plank', count: 1 }, { id: 'gear_spring', count: 1 }], station: 'workbench' },
  { id: 'pusher_plate', makes: { id: 'pusher_plate', count: 1 }, needs: [{ id: 'copper', count: 1 }, { id: 'gear_spring', count: 1 }], station: 'workbench' },
  { id: 'salve', makes: { id: 'salve', count: 1 }, needs: [{ id: 'frog_slick', count: 1 }, { id: 'honey', count: 1 }], station: 'workbench' },
  // meals for the road, with Hobb
  { id: 'travel_meal', makes: { id: 'travel_meal', count: 2 }, needs: [{ id: 'sunroot', count: 1 }, { id: 'wheat', count: 2 }, { id: 'honey', count: 1 }], station: 'workbench' },
  // The settlement's buildings, made at the workbench.
  ...HOME_RECIPES,
];

/**
 * A recipe the player has not learned yet, by the flag that teaches it. Each vault teaches a family of parts, and
 * Hobb packs the travel meals. A recipe not listed is known from the start.
 */
export const LEARNED_BY: Readonly<Record<string, string>> = {
  waterwheel: 'quest.pump.done',
  gear_shaft: 'quest.pump.done',
  lever: 'quest.pump.done',
  sprinkler: 'quest.pump.done',
  sensor: 'quest.gallery.done',
  switch_lamp: 'quest.gallery.done',
  harvester_arm: 'quest.seeds.done',
  saw_arm: 'quest.seeds.done',
  travel_meal: 'settler.hobb',
};

/** How far from the player a station may stand, in blocks. */
export const stationReach = 5;
