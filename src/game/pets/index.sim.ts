// Pets. A wild one tends its home, is startled by a player who hurries, and takes a treat from one who
// stands still. Fed enough, it bonds: it follows the player and digs up a seed now and then.

import { BLOCKS } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import type { Actor, Game, ItemId, PetState, PetsApi, SimSystem } from '../api.sim.ts';
import { PETS, type PetDef } from '../content/pets.ts';
import type { Kernel } from '../kernel.sim.ts';
import { distance2d, facingOf, floorNear, walkToward } from '../move.sim.ts';
import { walkAlong } from '../nav/walk.sim.ts';

/** A wild pet only lives its day while the player is this close. Further off, its land may not be loaded. */
const ACTIVE_RANGE = 60;
/** A move of the player faster than this in one step is a teleport, not a run. Blocks a second. The hero walks at 4.4. */
const TELEPORT_SPEED = 12;
/** The player's speed is the mean over this many steps, so one jolt against a wall startles nothing. */
const SPEED_STEPS = 6;
/** Directions tried when backing off, as turns away from straight back, in radians. */
const BACK_OFF_TURNS = [0, 0.6, -0.6, 1.2, -1.2];

type Doing = 'rest' | 'walk' | 'flee' | 'eat' | 'follow';

interface Pet {
  def: PetDef;
  state: PetState;
  actor: Actor;
  doing: Doing;
  /** Seconds left of what it is doing: resting, eating, or backing off. */
  timer: number;
  /** True once the land at its home was loaded and its beds were found. */
  settled: boolean;
  beds: Vec3[];
  bed: number;
  path: readonly Vec3[] | null;
  next: number;
  /** Where it backs off to when no path leads there. */
  away: Vec3;
  /** Seconds until it will eat again after being startled. */
  wary: number;
  /** Seconds the heart stays over it. */
  heart: number;
  /** The treat the player holds out to it, which it takes once they have stood still and it is calm. */
  offered: ItemId | null;
  /** Seconds of the player standing on the right ground until it finds something. */
  find: number;
  /** Seconds it has wanted to move and could not. */
  stuck: number;
  /** Seconds until it looks for a fresh path or checks its land again. */
  again: number;
  /** True while a bonded pet is on the move, so it does not stop and start at the edge of its range. */
  moving: boolean;
}

interface PetSave {
  id: string;
  x: number; y: number; z: number;
  facing: number;
  trust: number;
  bonded: boolean;
  wary: number;
  find: number;
  bed: number;
}

export interface PetsSave {
  version: 1;
  pets: PetSave[];
}

export interface Pets {
  api: PetsApi;
  system: SimSystem;
}

export function createPets(game: Game, defs: readonly PetDef[] = PETS): Pets {
  const { world, events, flags, player } = game;
  const pets: Pet[] = [];
  const states: PetState[] = [];
  const byId = new Map<string, Pet>();
  let started = false;
  let pending: PetsSave | null = null;

  // How the player moves: the pets watch it.
  const last = { x: 0, z: 0 };
  const speeds = new Float64Array(SPEED_STEPS);
  let speedAt = 0;
  /** The player's speed over the ground, in blocks a second. */
  let speed = 0;
  /** Seconds the player has stood still. */
  let still = 0;

  const toast = (text: string): void => events.emit('toast', { text });
  const near = (pet: Pet, within: number): boolean =>
    distance2d(pet.state.pos, player.pos) <= within && Math.abs(pet.state.pos.y - player.pos.y) < 3;

  // ------------------------------------------------------------------------------------ moving

  /** Walks straight toward a point, but not into water and not off the land. */
  function walkStraight(pet: Pet, tx: number, tz: number, blocksPerSecond: number, dt: number): number | null {
    const pos = pet.state.pos;
    const dx = tx - pos.x, dz = tz - pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return null;
    const stride = Math.min(d, blocksPerSecond * dt);
    const nx = pos.x + (dx / d) * stride, nz = pos.z + (dz / d) * stride;
    const floor = floorNear(world, nx, pos.y, nz);
    if (floor === null || !game.systems.nav.standable(nx, floor, nz)) return null;
    return walkToward(world, pos, tx, tz, blocksPerSecond, dt);
  }

  function setPath(pet: Pet, path: readonly Vec3[] | null): void {
    pet.path = path;
    pet.next = path && path.length > 1 ? 1 : 0;
  }

  function rest(pet: Pet, seconds: number): void {
    pet.doing = 'rest';
    pet.timer = seconds;
    pet.path = null;
    pet.actor.anim = 'idle';
  }

  function turned(pet: Pet, facing: number | null): boolean {
    if (facing === null) {
      pet.actor.anim = 'idle';
      return false;
    }
    pet.actor.facing = facing;
    pet.actor.anim = 'walk';
    return true;
  }

  // ------------------------------------------------------------------------------------ wild

  /** Finds the beds around its home once the land there is loaded. */
  function settle(pet: Pet): void {
    const nav = game.systems.nav, pos = pet.state.pos;
    const home = homeOf(pet.def);
    const beds: Vec3[] = [];
    for (const o of pet.def.beds) {
      const spot = nav.near({ x: home.x + o.x, y: home.y, z: home.z + o.z }, 2);
      if (spot && !beds.some((b) => b.x === spot.x && b.z === spot.z)) beds.push(spot);
    }
    if (beds.length === 0) return;
    pet.beds = beds;
    pet.bed %= beds.length;
    pet.settled = true;
    // It was put on the place as the region gave it. Now it can stand on real ground.
    if (!nav.standable(pos.x, pos.y, pos.z)) {
      const spot = nav.near(pos, 3) ?? beds[pet.bed];
      pos.x = spot.x; pos.y = spot.y; pos.z = spot.z;
    }
  }

  function startle(pet: Pet): void {
    const nav = game.systems.nav, pos = pet.state.pos, rule = pet.def.startle;
    pet.state.startled = true;
    pet.wary = rule.wary;
    pet.heart = 0;
    pet.offered = null;
    pet.actor.mark = 'alert';
    events.emit('pet.startled', { pet: pet.state.id });

    let dx = pos.x - player.pos.x, dz = pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.01) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
    pet.away = { x: pos.x + dx * rule.backOff, y: pos.y, z: pos.z + dz * rule.backOff };
    let path: Vec3[] | null = null;
    for (const turn of BACK_OFF_TURNS) {
      const cos = Math.cos(turn), sin = Math.sin(turn);
      const point = { x: pos.x + (dx * cos - dz * sin) * rule.backOff, y: pos.y, z: pos.z + (dx * sin + dz * cos) * rule.backOff };
      const spot = nav.near(point, 1.5);
      path = spot && nav.path(pos, spot, 300);
      if (path) break;
    }
    setPath(pet, path);
    pet.doing = 'flee';
    pet.timer = 3;
  }

  function wild(pet: Pet, dt: number): void {
    const def = pet.def, pos = pet.state.pos;
    if (distance2d(pos, player.pos) > ACTIVE_RANGE) { pet.actor.anim = 'idle'; return; }
    if (!pet.settled) {
      if ((pet.again -= dt) > 0) return;
      pet.again = 1;
      settle(pet);
      if (!pet.settled) return;
    }
    if (pet.doing !== 'flee' && speed > def.startle.speed && near(pet, def.startle.within)) startle(pet);
    if (pet.offered !== null) {
      // The player holds a treat out. It is taken once they have stood still and the pet is calm.
      if (!near(pet, def.feed.within)) pet.offered = null;
      else if (willEat(pet)) eat(pet, pet.offered);
    }

    switch (pet.doing) {
      case 'flee': {
        pet.timer -= dt;
        const facing = pet.path ? walkAlong(world, pos, pet, def.speed.run, dt) : walkStraight(pet, pet.away.x, pet.away.z, def.speed.run, dt);
        turned(pet, facing);
        if (facing === null || pet.timer <= 0 || (pet.path !== null && pet.next >= pet.path.length)) {
          pet.state.startled = false;
          pet.actor.mark = '';
          rest(pet, 2);
        }
        break;
      }
      case 'eat': {
        // It comes up to the player to eat.
        pet.timer -= dt;
        const facing = distance2d(pos, player.pos) > 1.3 ? walkStraight(pet, player.pos.x, player.pos.z, def.speed.walk * 1.5, dt) : null;
        if (!turned(pet, facing)) pet.actor.facing = facingOf(player.pos.x - pos.x, player.pos.z - pos.z);
        if (pet.timer <= 0) rest(pet, 1);
        break;
      }
      case 'walk': {
        const facing = walkAlong(world, pos, pet, def.speed.walk, dt);
        turned(pet, facing);
        if (pet.path === null || pet.next >= pet.path.length) rest(pet, def.rest[0] + (def.rest[1] - def.rest[0]) * game.random());
        else if (facing === null) rest(pet, 1);
        break;
      }
      default: {
        pet.actor.anim = 'idle';
        if ((pet.timer -= dt) > 0) break;
        // On to the next bed.
        pet.bed = (pet.bed + 1) % pet.beds.length;
        const path = game.systems.nav.path(pos, pet.beds[pet.bed], 300);
        if (path) {
          setPath(pet, path);
          pet.doing = 'walk';
        } else pet.timer = 2;
      }
    }
  }

  // ------------------------------------------------------------------------------------ feeding

  const isTreat = (def: PetDef, id: ItemId): boolean => id === def.treat || game.systems.items?.get(id)?.treat === true;

  /** The treat the player would give: the one in their hand, or else one from the bag. */
  function treatFor(def: PetDef): ItemId | null {
    const bag = game.systems.inventory;
    const held = bag.held();
    if (held && isTreat(def, held.id)) return held.id;
    return bag.count(def.treat) > 0 ? def.treat : null;
  }

  function wildInReach(): Pet | null {
    let best: Pet | null = null, bestD = Infinity;
    for (const pet of pets) {
      if (pet.state.bonded || !near(pet, pet.def.feed.within)) continue;
      const d = distance2d(pet.state.pos, player.pos);
      if (d < bestD) { bestD = d; best = pet; }
    }
    return best;
  }

  const willEat = (pet: Pet): boolean => pet.doing !== 'eat' && !pet.state.startled && pet.wary <= 0 && still >= pet.def.feed.still;

  /**
   * Offers one of `item` to the pet. True when it ate at once. When it is not ready, the treat stays held
   * out, a toast says what it waits for, and it eats as soon as the player has stood still and it is calm.
   */
  function offer(pet: Pet, item: ItemId): boolean {
    const def = pet.def;
    if (pet.state.bonded || !near(pet, def.feed.within)) return false;
    if (willEat(pet)) return eat(pet, item);
    if (pet.doing === 'eat') { toast('It is still eating.'); return false; }
    pet.offered = item;
    toast(pet.state.startled || pet.wary > 0 ? `The ${def.name.toLowerCase()} is wary of you. Hold still and give it a moment.` : 'Hold still and let it come to you.');
    return false;
  }

  function eat(pet: Pet, item: ItemId): boolean {
    const def = pet.def, state = pet.state;
    pet.offered = null;
    if (!game.systems.inventory.remove(item, 1)) return false;

    state.trust = Math.min(def.trustToBond, state.trust + 1);
    pet.heart = def.feed.eats;
    pet.actor.mark = 'heart';
    pet.doing = 'eat';
    pet.timer = def.feed.eats;
    pet.path = null;
    events.emit('pet.fed', { pet: state.id, trust: state.trust });
    if (state.trust >= def.trustToBond) becomeCompanion(pet);
    return true;
  }

  /** The moment a pet bonds: it follows from here on, the event goes out and the flag is set. */
  function becomeCompanion(pet: Pet): void {
    const def = pet.def, state = pet.state;
    state.trust = def.trustToBond;
    state.bonded = true;
    state.startled = false;
    pet.wary = 0;
    pet.offered = null;
    pet.path = null;
    pet.doing = 'follow';
    pet.find = nextFind(def);
    events.emit('pet.bonded', { pet: state.id });
    flags.set(def.bondedFlag, true);
  }

  // ------------------------------------------------------------------------------------ bonded

  const nextFind = (def: PetDef): number => def.finds.every[0] + (def.finds.every[1] - def.finds.every[0]) * game.random();

  /** Puts it on a free block right by the player. False when there is none, as when the player swims. */
  function beside(pet: Pet): boolean {
    const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
    const spot = game.systems.nav.near(player.pos, 2, (x, z) => x === px && z === pz);
    if (!spot) return false;
    const pos = pet.state.pos;
    pos.x = spot.x; pos.y = spot.y; pos.z = spot.z;
    pet.path = null;
    pet.stuck = 0;
    pet.moving = false;
    pet.actor.anim = 'idle';
    return true;
  }

  function follow(pet: Pet, dt: number): void {
    const def = pet.def, pos = pet.state.pos, rule = def.follow;
    const d = distance2d(pos, player.pos);
    if (d > rule.appearBeyond || (pet.stuck > 4 && d > rule.within)) {
      if (beside(pet)) return;
      pet.stuck = 3; // look again in a second
    }

    // It starts after the player well inside its range and stops a little closer, so it does not dither.
    if (d > (pet.moving ? rule.within * 0.5 : rule.within * 0.65)) {
      const pace = d > rule.runBeyond ? def.speed.run : def.speed.trot;
      let facing: number | null = null;
      if (pet.path) {
        pet.again -= dt;
        facing = walkAlong(world, pos, pet, pace, dt);
        if (facing === null || pet.again <= 0 || pet.next >= pet.path.length) pet.path = null;
      } else {
        facing = walkStraight(pet, player.pos.x, player.pos.z, pace, dt);
        if (facing === null && (pet.again -= dt) <= 0) {
          // Something is in the way. Go around it, and look for the player again in a moment.
          pet.again = 0.75;
          setPath(pet, game.systems.nav.path(pos, player.pos, 600));
          if (pet.path) facing = walkAlong(world, pos, pet, pace, dt);
        }
      }
      pet.moving = turned(pet, facing);
      pet.stuck = pet.moving ? 0 : pet.stuck + dt;
    } else {
      pet.moving = false;
      pet.stuck = 0;
      pet.path = null;
      pet.actor.anim = 'idle';
    }

    // Giving before it is asked: now and then, while the player stands on grass, it digs up a seed.
    const finds = def.finds;
    const under = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.2), Math.floor(player.pos.z));
    if (under !== 0 && BLOCKS[under]?.surface === finds.surface && (pet.find -= dt) <= 0) {
      pet.find = nextFind(def);
      if (game.systems.inventory.add(finds.item, 1, pos) === 0) toast(finds.toast);
    }
  }

  // ------------------------------------------------------------------------------------ setting up

  function homeOf(def: PetDef): Vec3 {
    let at: Vec3 | undefined;
    try {
      at = game.systems.region.place(def.home)?.at;
    } catch {
      at = undefined;
    }
    at ??= game.systems.region.spawn();
    return { x: Math.floor(at.x) + 0.5, y: at.y, z: Math.floor(at.z) + 0.5 };
  }

  function build(def: PetDef): Pet {
    const id = `pet:${def.kind}:1`;
    const pos = homeOf(def);
    const state: PetState = { id, kind: def.kind, name: def.name, pos, trust: 0, bonded: false, startled: false };
    const actor: Actor = { id, sprite: def.sprite, pos, facing: Math.PI, anim: 'idle', visible: true, mark: '' };
    return {
      def, state, actor,
      doing: 'rest', timer: def.rest[0], settled: false, beds: [], bed: 0, path: null, next: 0,
      away: { x: pos.x, y: pos.y, z: pos.z }, wary: 0, heart: 0, offered: null, find: nextFind(def), stuck: 0, again: 0, moving: false,
    };
  }

  /** Pets need the region for their homes, so they are made on the first step or call, not while installing. */
  function ready(): boolean {
    if (started) return true;
    if (!game.systems.region || !game.systems.nav) return false;
    started = true;
    last.x = player.pos.x;
    last.z = player.pos.z;
    for (const def of defs) {
      const pet = build(def);
      pets.push(pet);
      states.push(pet.state);
      byId.set(pet.state.id, pet);
      game.actors.set(pet.actor.id, pet.actor);
      game.systems.interact?.add({
        id: pet.state.id,
        pos: () => pet.state.pos,
        radius: def.feed.within,
        prompt: () => (!pet.state.bonded && treatFor(def) !== null ? def.feed.prompt : null),
        act: () => void api.feed(pet.state.id),
      });
    }
    // Using a treat by a wild pet holds it out. The click is taken either way, so the treat is not used on something else.
    game.systems.actions?.addHandler((context) => {
      if (context.button !== 'secondary' || !context.held) return false;
      const pet = wildInReach();
      if (!pet || !isTreat(pet.def, context.held.id)) return false;
      offer(pet, context.held.id);
      return true;
    });
    if (pending) {
      restore(pending);
      pending = null;
    }
    return true;
  }

  function restore(save: PetsSave): void {
    if (!save || !Array.isArray(save.pets)) return;
    for (const s of save.pets) {
      const pet = byId.get(s.id);
      if (!pet) continue;
      const pos = pet.state.pos, def = pet.def;
      pos.x = s.x; pos.y = s.y; pos.z = s.z;
      pet.actor.facing = s.facing;
      pet.actor.anim = 'idle';
      pet.actor.mark = '';
      pet.state.trust = Math.max(0, Math.min(def.trustToBond, Math.floor(Number(s.trust) || 0)));
      pet.state.bonded = Boolean(s.bonded);
      pet.state.startled = false;
      pet.wary = Number(s.wary) || 0;
      pet.find = Number(s.find) > 0 ? Number(s.find) : nextFind(def);
      pet.bed = Math.max(0, Math.floor(Number(s.bed) || 0));
      pet.heart = 0;
      pet.offered = null;
      pet.path = null;
      pet.stuck = 0;
      pet.moving = false;
      pet.doing = pet.state.bonded ? 'follow' : 'rest';
      pet.timer = 1;
    }
  }

  // ------------------------------------------------------------------------------------ the api

  const api: PetsApi = {
    all() {
      ready();
      return states;
    },
    companion() {
      ready();
      for (const state of states) if (state.bonded) return state;
      return null;
    },
    feed(petId) {
      if (!ready()) return false;
      const pet = byId.get(petId);
      if (!pet) return false;
      const treat = treatFor(pet.def);
      return treat !== null && offer(pet, treat);
    },
    bond(petId) {
      if (!ready()) return false;
      const pet = byId.get(petId);
      if (!pet || pet.state.bonded) return false;
      becomeCompanion(pet);
      pet.heart = pet.def.feed.eats;
      pet.actor.mark = 'heart';
      // It may be at its home, a long way off. It comes to the player's side at once when there is room.
      if (distance2d(pet.state.pos, player.pos) > pet.def.follow.within) beside(pet);
      return true;
    },
  };

  const system: SimSystem = {
    step(dt) {
      if (!ready()) return;
      const moved = Math.hypot(player.pos.x - last.x, player.pos.z - last.z);
      last.x = player.pos.x;
      last.z = player.pos.z;
      const now = moved / dt > TELEPORT_SPEED ? 0 : moved / dt;
      speeds[speedAt] = now;
      speedAt = (speedAt + 1) % SPEED_STEPS;
      let sum = 0;
      for (let i = 0; i < SPEED_STEPS; i++) sum += speeds[i];
      speed = sum / SPEED_STEPS;
      still = now < 0.2 ? still + dt : 0;

      for (const pet of pets) {
        if (pet.wary > 0) pet.wary -= dt;
        if (pet.heart > 0 && (pet.heart -= dt) <= 0) pet.actor.mark = '';
        if (pet.state.bonded) follow(pet, dt);
        else wild(pet, dt);
      }
    },
    save(): PetsSave {
      if (!ready()) return pending ?? { version: 1, pets: [] };
      return {
        version: 1,
        pets: pets.map((pet) => ({
          id: pet.state.id,
          x: pet.state.pos.x, y: pet.state.pos.y, z: pet.state.pos.z,
          facing: pet.actor.facing,
          trust: pet.state.trust,
          bonded: pet.state.bonded,
          wary: Math.max(0, pet.wary),
          find: pet.find,
          bed: pet.bed,
        })),
      };
    },
    load(data) {
      pending = data as PetsSave;
      if (ready() && pending) {
        restore(pending);
        pending = null;
      }
    },
  };

  return { api, system };
}

export function install(kernel: Kernel): void {
  const pets = createPets(kernel.game);
  kernel.add('pets', pets.api, pets.system);
}
