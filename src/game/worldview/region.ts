// What the world views ask the region, in one place. The region may be missing (a small test, a game
// before the region is installed) and each of its newer methods is optional, so every answer here has a
// fallback: a view gets an empty list, null, or settings that block nothing, and draws nothing for it.
// A region method that throws is treated as missing. Nothing here throws.
import type { Vec3 } from '../../engine/types.ts';
import type { BerryBush, Game, RegionApi, RegionProp, RegionScatter, Systems } from '../api.sim.ts';
import type { ScatterSettings } from './props.ts';

const NO_BUSHES: readonly BerryBush[] = [];
const NO_PROPS: readonly RegionProp[] = [];

/** The region when it is installed. Read on every use, so a region installed late is found. */
const regionOf = (game: Game): RegionApi | undefined => (game.systems as Partial<Systems>).region;

/** Where a named place is, or null when there is no region or it does not know the name. */
export function placeAt(game: Game, name: string): Vec3 | null {
  try {
    return regionOf(game)?.place(name)?.at ?? null;
  } catch {
    return null;
  }
}

/** Every berry bush. The region hands out the same objects on every call and changes `ripe` in place. */
export function berryBushes(game: Game): readonly BerryBush[] {
  try {
    return regionOf(game)?.berryBushes?.() ?? NO_BUSHES;
  } catch {
    return NO_BUSHES;
  }
}

/** The props of the stamped buildings and of the town. */
export function buildingProps(game: Game): readonly RegionProp[] {
  try {
    return regionOf(game)?.props?.() ?? NO_PROPS;
  } catch {
    return NO_PROPS;
  }
}

/**
 * How the land is scattered: the region's settings, or the usual amount everywhere when it has none.
 * A rule of the region that throws for a column leaves that column bare.
 */
export function scatterSettings(game: Game): ScatterSettings {
  let theirs: Partial<RegionScatter> | undefined;
  try {
    theirs = regionOf(game)?.scatter?.();
  } catch {
    theirs = undefined;
  }
  if (!theirs) return { density: 1 };
  const { blocked, forest } = theirs;
  const settings: ScatterSettings = { density: typeof theirs.density === 'number' && Number.isFinite(theirs.density) ? theirs.density : 1 };
  if (typeof blocked === 'function') {
    settings.blocked = (x, z) => {
      try {
        return blocked(x, z);
      } catch {
        return true;
      }
    };
  }
  if (typeof forest === 'function') {
    settings.forest = (x, z) => {
      try {
        return forest(x, z);
      } catch {
        // No answer is open meadow: a tuft at most, never a wood nobody planned.
        return 0;
      }
    };
  }
  return settings;
}
