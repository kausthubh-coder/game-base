// The region: the land of the first part as the other systems see it. Named places, the spawn point,
// the grant, what is protected, the props of the town for a view to draw, and the berry bushes.
//
// The land itself is made by the terrain from the same plan (src/game/content/region.ts), so this
// system writes no blocks. It only answers questions about them, and runs the bushes.
import type { Vec3 } from '../../engine/types.ts';
import { forestAt, groundHeight } from '../../features/world/terrain.sim.ts';
import type { BerryBush, Game, Interactable, Place, RegionApi, RegionScatter, SimSystem } from '../api.sim.ts';
import { REGION } from '../content/region.ts';
import type { Kernel } from '../kernel.sim.ts';
import { built, clearing, onPath, regionProps, scatterBlocked } from './land.sim.ts';
import { isTreeSpot } from './tree-spots.sim.ts';

/** Seconds of game time a picked bush stays bare. */
export const REGROW_SECONDS = 120;
/** How close the player must stand to a bush to pick it. */
export const BUSH_REACH = 1.8;
const BERRY = 'berry';

export interface Region {
  api: Required<RegionApi>;
  system: SimSystem;
}

interface BushSave {
  /** For each bush in the plan's order: seconds until it has berries again, 0 when it has them. */
  bare: number[];
}

const feetAt = (x: number, y: number, z: number): Vec3 => ({ x: x + 0.5, y, z: z + 0.5 });

export function createRegion(game: Game): Region {
  // ------------------------------------------------------------------------------------ places
  const places: Place[] = REGION.places.map((p) => ({ name: p.name, at: feetAt(p.x, p.y, p.z), label: p.label }));
  for (const b of built()) {
    const want = b.plan.place;
    if (!want) continue;
    const at = want.at === 'door' ? b.door : b.outside;
    places.push({ name: want.name, at: feetAt(at.x, at.y, at.z), label: want.label });
  }
  const byName = new Map(places.map((p) => [p.name, p]));

  const g = REGION.grant, town = REGION.town;
  const inGrant = (x: number, z: number): boolean => x >= g.x && x < g.x + g.width && z >= g.z && z < g.z + g.depth;

  // ------------------------------------------------------------------------------------ berry bushes
  const bushes: BerryBush[] = REGION.bushes.map((b, i) => ({
    id: `bush:${i}`,
    x: b.x + 0.5,
    y: groundHeight(game.world.seed, b.x, b.z),
    z: b.z + 0.5,
    ripe: true,
  }));
  /** Seconds until each bush has berries again. */
  const wait = bushes.map(() => 0);

  function pick(i: number): void {
    const bush = bushes[i];
    if (!bush.ripe) return;
    const count = game.random() < 0.5 ? 1 : 2;
    const left = game.systems.inventory?.add(BERRY, count, { x: bush.x, y: bush.y + 0.6, z: bush.z }) ?? count;
    if (left >= count) {
      game.events.emit('toast', { text: 'Your bag is full.' });
      return;
    }
    bush.ripe = false;
    wait[i] = REGROW_SECONDS;
  }

  const targets: Interactable[] = bushes.map((bush, i) => {
    const at = { x: bush.x, y: bush.y, z: bush.z };
    return {
      id: bush.id,
      pos: () => at,
      radius: BUSH_REACH,
      prompt: () => (bush.ripe ? 'Pick berries' : null),
      act: () => pick(i),
    };
  });

  // The interact system is installed after the region, so the bushes join it on the first step.
  let joined = false;
  function join(): void {
    const interact = game.systems.interact;
    if (!interact) return;
    for (const target of targets) interact.add(target);
    joined = true;
  }

  function regrowAll(): void {
    for (let i = 0; i < bushes.length; i++) { wait[i] = 0; bushes[i].ripe = true; }
  }
  // A night is longer than two minutes, so every bush has berries in the morning.
  game.events.on('slept', regrowAll);

  // Nothing is scattered on the sites themselves. Around them, where the plan keeps the land open, only
  // the scatter's tree columns are blocked, so the meadow keeps its grass and flowers and grows no tree.
  // `forest` says the same in the scatter's own terms, for a view that passes it on: woods stand where
  // the terrain grew its block trees, and thin to nothing around the sites.
  const seed = game.world.seed;
  const scatter: RegionScatter = {
    density: 1,
    blocked(x, z) {
      if (scatterBlocked(x, z)) return true;
      return clearing(x, z) >= 0.5 && isTreeSpot(seed, Math.floor(x), Math.floor(z));
    },
    forest: (x, z) => forestAt(seed, Math.floor(x), Math.floor(z)) * (1 - clearing(x, z)),
  };

  // ------------------------------------------------------------------------------------ the api
  const api: Required<RegionApi> = {
    spawn: () => feetAt(REGION.spawn.x, REGION.spawn.y, REGION.spawn.z),
    spawnFacing: () => REGION.spawn.facing,
    places: () => places,
    place(name) {
      const found = byName.get(name);
      if (!found) throw new Error(`the region has no place called "${name}". It has: ${places.map((p) => p.name).join(', ')}`);
      return found;
    },
    grant: () => ({ x: g.x, z: g.z, width: g.width, depth: g.depth }),
    isProtected(x, _y, z) {
      const fx = Math.floor(x), fz = Math.floor(z);
      // The grant is the player's, even where the path starts at its corner.
      if (inGrant(fx, fz)) return false;
      if (fx >= town.x0 && fx <= town.x1 && fz >= town.z0 && fz <= town.z1) return true;
      return onPath(fx, fz);
    },
    berryBushes: () => bushes,
    props: () => regionProps(),
    scatter: () => scatter,
    townCenter: () => ({ ...REGION.townCenter }),
  };

  const system: SimSystem = {
    step(dt) {
      if (!joined) join();
      for (let i = 0; i < bushes.length; i++) {
        if (wait[i] <= 0) continue;
        wait[i] -= dt;
        if (wait[i] <= 0) { wait[i] = 0; bushes[i].ripe = true; }
      }
    },
    save(): BushSave {
      return { bare: wait.map((seconds) => Math.round(seconds * 100) / 100) };
    },
    load(data) {
      const bare = (data as Partial<BushSave> | null)?.bare;
      for (let i = 0; i < bushes.length; i++) {
        const seconds = Array.isArray(bare) ? Number(bare[i]) : 0;
        wait[i] = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, REGROW_SECONDS) : 0;
        bushes[i].ripe = wait[i] === 0;
      }
    },
  };

  return { api, system };
}

export function install(kernel: Kernel): void {
  const region = createRegion(kernel.game);
  kernel.add('region', region.api, region.system);
}
