// The game's kernel: the shared state, the event bus, the flags, and the list of systems it steps and saves.
// It knows no system by name. src/game/boot.ts decides which systems exist and in what order.

import { calmNoon } from '../engine/types.ts';
import type { World } from '../features/world/world.sim.ts';
import type { Actor, EventName, Events, FlagValue, Flags, Game, GameEvents, SimSystem, Systems } from './api.sim.ts';

export const STEP = 1 / 20;

type Listener = (data: never) => void;

export function createEvents(): Events {
  const byName = new Map<EventName, Set<Listener>>();
  const any = new Set<(name: EventName, data: GameEvents[EventName]) => void>();
  return {
    emit(name, data) {
      const set = byName.get(name);
      if (set) for (const listener of [...set]) (listener as (d: typeof data) => void)(data);
      for (const listener of [...any]) listener(name, data);
    },
    on(name, listener) {
      let set = byName.get(name);
      if (!set) byName.set(name, (set = new Set()));
      set.add(listener as Listener);
      return () => set.delete(listener as Listener);
    },
    onAny(listener) {
      any.add(listener);
      return () => any.delete(listener);
    },
  };
}

export function createFlags(events: Events, values: Map<string, FlagValue> = new Map()): Flags & { values: Map<string, FlagValue> } {
  return {
    values,
    get: (flag) => values.get(flag),
    is: (flag) => Boolean(values.get(flag)),
    set(flag, value) {
      if (values.get(flag) === value) return;
      values.set(flag, value);
      events.emit('flag.changed', { flag, value });
    },
    add(flag, amount) {
      const next = Number(values.get(flag) ?? 0) + amount;
      this.set(flag, next);
      return next;
    },
  };
}

/** A small repeatable generator (mulberry32). */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GameSave {
  version: 1;
  flags: [string, FlagValue][];
  player: { x: number; y: number; z: number; facing: number };
  clock: { day: number; timeOfDay: number; seconds: number };
  systems: Record<string, unknown>;
}

export interface Kernel {
  readonly game: Game;
  /** Adds a system under its name in `game.systems`. Systems step in the order they were added. */
  add<K extends keyof Systems>(name: K, api: Systems[K], system: SimSystem): void;
  /** Adds something to step and save that other systems do not call by name. */
  addPlain(name: string, system: SimSystem): void;
  /** Advances the game by one fixed step of STEP seconds. */
  step(): void;
  save(): GameSave;
  load(save: GameSave): void;
}

export function createKernel(world: World, seed: number): Kernel {
  const events = createEvents();
  const flags = createFlags(events);
  const systems: [string, SimSystem][] = [];
  const game: Game = {
    world,
    events,
    flags,
    player: { pos: { x: 0, y: 0, z: 0 }, facing: 0, onGround: true, inWater: false, busy: false },
    clock: { day: 1, timeOfDay: 0.27, seconds: 0 },
    ambient: calmNoon(),
    actors: new Map<string, Actor>(),
    systems: {} as Systems,
    random: createRandom(seed),
  };
  return {
    game,
    add(name, api, system) {
      game.systems[name] = api;
      systems.push([name, system]);
    },
    addPlain(name, system) {
      systems.push([name, system]);
    },
    step() {
      for (const [, system] of systems) system.step?.(STEP);
    },
    save() {
      const out: Record<string, unknown> = {};
      for (const [name, system] of systems) if (system.save) out[name] = system.save();
      const p = game.player;
      return {
        version: 1,
        flags: [...flags.values],
        player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, facing: p.facing },
        clock: { ...game.clock },
        systems: out,
      };
    },
    load(save) {
      flags.values.clear();
      for (const [k, v] of save.flags) flags.values.set(k, v);
      Object.assign(game.player.pos, { x: save.player.x, y: save.player.y, z: save.player.z });
      game.player.facing = save.player.facing;
      Object.assign(game.clock, save.clock);
      for (const [name, system] of systems) if (system.load && name in save.systems) system.load(save.systems[name]);
    },
  };
}
