// What of the rules' state a browser in an online world is given, and which of the rules' events it hears.
// The server runs the rules. A browser keeps a copy of each system and loads into it the save the server's
// system gives, whenever that save changed in a way the browser can see. The world server and the browser
// both read this file, so they agree on it.
//
// Three kinds of state take other paths, because they change every step:
//   - the land: changed blocks go in the snap, as they have from the start;
//   - bodies and actors: positions in the snap, 20 times a second for players, 5 for the rest;
//   - the clock and the weather: `day`, `time` and `air` in the snap.
// So the systems that hold only those are not copied: time, creatures. Placed things come with the snap's
// `placed` list, which holds only what is in range. Talk saves nothing; a conversation goes in `talk`.
import type { FlagValue, SimSystem } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';

/**
 * How a system is copied. `quiet` keeps only what a browser can see of the save: a change in the rest (a
 * timer counting down, a person's place along a path) is not worth sending, and is sent with the next
 * change that is. Without `quiet` every change of the save counts.
 */
interface Policy {
  copy: boolean;
  quiet?: (save: never) => unknown;
}

type Row = readonly unknown[];

const POLICIES: Readonly<Record<string, Policy>> = {
  // Carried another way, or nothing to carry.
  time: { copy: false },
  creatures: { copy: false },
  placeables: { copy: false },
  talk: { copy: false },
  story: { copy: false },
  // The quick slot in hand is each player's own, so a change of it is not a change of the bag.
  inventory: { copy: true, quiet: (save: { slots?: unknown }) => save.slots },
  // A crop's growth and the soil's water count down every step. What shows is the stage and wet or dry.
  crops: {
    copy: true,
    quiet: (save: { crops?: Row[]; soil?: Row[] }) => [
      (save.crops ?? []).map((c) => [c[0], c[1], c[2], c[3], c[4], (c[6] as number) > 0]),
      (save.soil ?? []).map((s) => [s[0], s[1], s[2], (s[3] as number) > 0]),
    ],
  },
  // A bare bush counts its seconds to fruit again. What shows is whether it has fruit.
  region: { copy: true, quiet: (save: { bare?: number[] }) => (save.bare ?? []).map((seconds) => seconds > 0) },
  // People and pets walk every step. Where they are is in the snap's actors; the rest is what they think of you.
  people: {
    copy: true,
    quiet: (save: { people?: { id: string; sprite?: string; place?: unknown; friendship?: number; held?: boolean; mark?: string; sent?: unknown }[] }) =>
      (save.people ?? []).map((p) => [p.id, p.sprite, p.place, p.friendship, p.held, p.mark, p.sent]),
  },
  pets: {
    copy: true,
    quiet: (save: { pets?: { id: string; trust?: number; bonded?: boolean; bed?: number }[] }) =>
      (save.pets ?? []).map((p) => [p.id, p.trust, p.bonded, p.bed]),
  },
};

/** A system the list does not name is copied whole: a new system is right in an online world before it is cheap. */
export function policyOf(name: string): Policy {
  return POLICIES[name] ?? { copy: true };
}

/**
 * Events only the player they concern should hear: what a panel or a hint says to them, a sound of the
 * interface, a conversation of theirs. The rest are the world's, and everyone in it hears them: a block
 * broken, a crop planted, a quest step, an item gained (the bag is the world's until stage 2).
 */
export const PERSONAL_EVENTS: ReadonlySet<string> = new Set(['toast', 'hint', 'ui.sound', 'ui.open', 'talk.started', 'talk.ended']);

/**
 * Events that never go on the wire. A body's footsteps, jumps and landings are made by each browser's own
 * hero. A stroke's `build.mode` belongs to build mode, which each browser keeps to itself.
 */
export const LOCAL_EVENTS: ReadonlySet<string> = new Set(['footstep', 'jump', 'land', 'build.mode']);

export interface CopyState {
  flags?: [string, FlagValue][];
  systems?: Record<string, unknown>;
}

/** Steps between two looks at the systems when nothing happened: 10 is twice a second. */
const LOOK_EVERY = 10;

export interface Copier {
  /**
   * The state that changed since the last call. With `busy` (an act ran or an event was emitted in this
   * step) every system is looked at now; otherwise only every `LOOK_EVERY` steps. Null when nothing changed.
   */
  changes(busy: boolean): CopyState | null;
  /** Everything, for a player who just came in. */
  all(): CopyState;
}

/**
 * Watches the systems of a kernel. `systems` is the list the kernel steps, in its order, as a recording
 * kernel collects it at install (see `recording`).
 */
export function createCopier(kernel: Kernel, systems: readonly (readonly [string, SimSystem])[]): Copier {
  // The kernel's flags keep their values in a map (`createFlags`). The Flags type reads them only by name.
  const values = (kernel.game.flags as { values?: Map<string, FlagValue> }).values ?? new Map<string, FlagValue>();
  const flags = (): [string, FlagValue][] => [...values];
  const watched = systems.filter(([name, system]) => system.save && policyOf(name).copy);
  const seen = new Map<string, string>();
  const latest = new Map<string, unknown>();
  let flagsSeen = '';
  let latestFlags: [string, FlagValue][] = [];
  let sinceLook = 0;

  function look(name: string, system: SimSystem): unknown {
    const save = system.save?.();
    const quiet = policyOf(name).quiet;
    const key = JSON.stringify(quiet ? quiet(save as never) : save) ?? '';
    if (seen.get(name) === key) return undefined;
    seen.set(name, key);
    // A copy, so a save that holds live objects is not changed under the snap that carries it.
    const copy = save === undefined ? null : (JSON.parse(JSON.stringify(save)) as unknown);
    latest.set(name, copy);
    return copy;
  }

  function lookAtFlags(): boolean {
    const list = flags();
    const key = JSON.stringify(list);
    if (key === flagsSeen) return false;
    flagsSeen = key;
    latestFlags = list;
    return true;
  }

  for (const [name, system] of watched) look(name, system);
  lookAtFlags();

  return {
    changes(busy) {
      if (!busy && ++sinceLook < LOOK_EVERY) return null;
      sinceLook = 0;
      let out: CopyState | null = null;
      for (const [name, system] of watched) {
        const copy = look(name, system);
        if (copy !== undefined) ((out ??= {}).systems ??= {})[name] = copy;
      }
      if (busy && lookAtFlags()) (out ??= {}).flags = latestFlags;
      return out;
    },
    all() {
      const systemsOut: Record<string, unknown> = {};
      for (const [name, copy] of latest) systemsOut[name] = copy;
      return { flags: latestFlags, systems: systemsOut };
    },
  };
}

/**
 * A kernel that hands every system on to `kernel` and keeps a list of them by name, for `createCopier`.
 * Install the systems through it.
 */
export function recording(kernel: Kernel): { kernel: Kernel; systems: [string, SimSystem][] } {
  const systems: [string, SimSystem][] = [];
  return {
    systems,
    kernel: {
      game: kernel.game,
      add(name, api, system) {
        systems.push([name, system]);
        kernel.add(name, api, system);
      },
      addPlain(name, system) {
        systems.push([name, system]);
        kernel.addPlain(name, system);
      },
      step: () => kernel.step(),
      save: () => kernel.save(),
      load: (save) => kernel.load(save),
    },
  };
}
