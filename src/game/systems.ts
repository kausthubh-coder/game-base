// The one list of the game's systems, in the order they are installed and stepped.
//
// Each name is a folder in src/game/ whose `index.sim.ts` exports `install(kernel)`. The files are
// found with a glob, so a system whose folder has no `index.sim.ts` yet is left out without breaking
// the build, and it joins by itself the moment the file lands: no edit here. A folder that is not in
// the list is installed last, so a new system still runs before anyone remembers to give it a place.
//
// The order matters where a system reads another at install, and for what a step sees:
//   - items and inventory first: everything hands out or counts items.
//   - region before anyone who asks for a named place.
//   - time before crops, so crops read this step's rain.
//   - actions before the systems that add click handlers to it (placeables, crops, creatures, pets).
//   - quests and story last: they judge what the step did.
import type { SimSystem } from './api.sim.ts';
import type { Kernel } from './kernel.sim.ts';

export const SYSTEM_ORDER: readonly string[] = [
  'items',
  'inventory',
  'region', // not written yet on 2026-11-10 00:15: until it lands the player starts at the world's spawnPoint()
  'time',
  'interact',
  'actions',
  'placeables',
  'crafting',
  'crops',
  'nav',
  'almanac',
  'creatures',
  'pets',
  'people',
  'talk',
  'quests',
  'story',
];

/**
 * Systems that cannot run without another one, by their own README. While a name on the right has no
 * `index.sim.ts`, the one on the left is left out, so a missing region does not throw 20 times a second.
 * The rest read a missing system as empty and need no entry.
 */
export const NEEDS: Readonly<Record<string, readonly string[]>> = {
  people: ['region', 'nav', 'interact', 'talk'],
  pets: ['region', 'nav', 'inventory', 'interact', 'actions'],
};

interface SystemModule {
  install?: (kernel: Kernel) => void;
}

const modules = import.meta.glob<SystemModule>('./*/index.sim.ts', { eager: true });

export interface Installed {
  /** The systems that are running, in order. */
  installed: string[];
  /** The ones left out, each with the reason. */
  leftOut: { name: string; why: string }[];
  /** Systems whose step threw. The first throw of each is logged, and the system is skipped from then on. */
  failed: Map<string, string>;
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Installs every system that is there, in order. One that throws is logged and left out. */
export function installSystems(kernel: Kernel): Installed {
  const found = new Map<string, SystemModule>();
  for (const [path, module] of Object.entries(modules)) found.set(path.split('/')[1] as string, module);
  const names = [...SYSTEM_ORDER, ...[...found.keys()].filter((name) => !SYSTEM_ORDER.includes(name)).sort()];
  const result: Installed = { installed: [], leftOut: [], failed: new Map() };

  // A system that throws in a step is taken out of the stepping, so the others keep the game alive.
  const guarded = (name: string, system: SimSystem): SimSystem => {
    const step = system.step?.bind(system);
    if (!step) return system;
    system.step = (dt) => {
      if (result.failed.has(name)) return;
      try {
        step(dt);
      } catch (error) {
        result.failed.set(name, messageOf(error));
        console.error(`[game] the ${name} system threw in a step and is switched off:`, error);
      }
    };
    return system;
  };
  const careful: Kernel = {
    game: kernel.game,
    add: (name, api, system) => kernel.add(name, api, guarded(name, system)),
    addPlain: (name, system) => kernel.addPlain(name, guarded(name, system)),
    step: () => kernel.step(),
    save: () => kernel.save(),
    load: (save) => kernel.load(save),
  };

  for (const name of names) {
    const install = found.get(name)?.install;
    if (!install) {
      result.leftOut.push({ name, why: found.has(name) ? 'its index.sim.ts exports no install' : 'no index.sim.ts yet' });
      continue;
    }
    // A need counts as met when its file is there, even if it comes later in the order: systems read each other in steps, not at install.
    const missing = (NEEDS[name] ?? []).filter((need) => !found.get(need)?.install);
    if (missing.length > 0) {
      result.leftOut.push({ name, why: `it needs ${missing.join(' and ')}` });
      continue;
    }
    try {
      install(careful);
      result.installed.push(name);
    } catch (error) {
      result.leftOut.push({ name, why: `install threw: ${messageOf(error)}` });
      console.error(`[game] the ${name} system did not install:`, error);
    }
  }
  return result;
}
