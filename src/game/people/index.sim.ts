// The townspeople. Each one follows a routine from src/game/content/people.ts: the hour picks a named
// place, they walk there along a path, and they stand facing the player when the player comes close.
// The story can send someone somewhere, or hold them where they are.

import type { Vec3 } from '../../engine/types.ts';
import type { Actor, Game, NpcState, PeopleApi, SimSystem } from '../api.sim.ts';
import { CROWD_SPRITES, FACE_RANGE, PEOPLE, TALK_RANGE, WALK_RANGE, WALK_SPEED, type PersonDef } from '../content/people.ts';
import type { Kernel } from '../kernel.sim.ts';
import { distance2d, facingOf } from '../move.sim.ts';
import { walkAlong } from '../nav/walk.sim.ts';

/** Somewhere to stand: a named place, and how far beside it. */
interface Stop {
  place: string;
  offset?: { x: number; z: number };
}

interface Person {
  def: PersonDef;
  state: NpcState;
  actor: Actor;
  stay: Stop | null;
  wanderStops: Stop[];
  wanderIndex: number;
  /** Seconds left to stand here before walking to the next place. */
  wanderTimer: number;
  /** One brief greeting on entering talk range; null again after the player leaves. */
  greeting: number | null;
  /** The stop they walk to or stand at. Null makes the next step pick one. */
  goal: Stop | null;
  /** The exact spot for the goal: a block center with the height of its floor. */
  target: Vec3;
  /** False when the land at the target was not loaded, so the spot is the place as the region gave it. */
  settled: boolean;
  path: readonly Vec3[] | null;
  /** The index in `path` of the point they walk to now. */
  next: number;
  /** True when `path` only gets closer to the target, so another path is needed at its end. */
  partial: boolean;
  /** True when they need a path before they can move. */
  plan: boolean;
  /** The named place they stand at, so a walk can start on a cached route. Null while on the way. */
  at: string | null;
  held: boolean;
  sent: { stop: Stop; day: number } | null;
  talking: boolean;
  blocked: number;
  fails: number;
  check: number;
}

interface PersonSave {
  id: string;
  sprite?: string;
  x: number; y: number; z: number;
  facing: number;
  place: string;
  friendship: number;
  held: boolean;
  mark: Actor['mark'];
  sent: { place: string; day: number; offset?: { x: number; z: number } } | null;
  wander: [index: number, timer: number];
  at: string | null;
}

export interface PeopleSave {
  version: 1;
  people: PersonSave[];
}

export interface People {
  api: PeopleApi;
  system: SimSystem;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function createPeople(game: Game, defs: readonly PersonDef[] = PEOPLE): People {
  const { world, clock, flags, player } = game;
  const people: Person[] = [];
  const states: NpcState[] = [];
  const byId = new Map<string, Person>();
  let started = false;
  let pending: PeopleSave | null = null;
  /** Paths are worked out one a step, so an hour that moves the whole town does not stall a frame. */
  let plans = 0;
  /** True for the step after a night's sleep: nobody walks the night's routine in the morning, they are there. */
  let slept = false;

  // ------------------------------------------------------------------------------------ where to stand

  function placeAt(name: string): Vec3 | null {
    try {
      return game.systems.region.place(name)?.at ?? null;
    } catch {
      return null;
    }
  }

  function routineStop(p: Person): Stop {
    if (p.stay && !flags.is(p.def.stay!.until)) return p.stay;
    if (p.wanderStops.length > 0) return p.wanderStops[p.wanderIndex];
    const routine = p.def.routine, hour = clock.timeOfDay * 24;
    let stop = routine[routine.length - 1];
    for (const s of routine) if (s.hour <= hour) stop = s;
    return stop;
  }

  /** Picks the exact spot for a stop: the nearest free block to stand on by the place. */
  function resolve(p: Person, stop: Stop): void {
    const at = placeAt(stop.place) ?? game.systems.region.spawn();
    const spread = p.def.wander && stop !== p.stay && stop !== p.sent?.stop ? p.def.wander.spread : 0;
    // Someone who wanders stands a few blocks off the place, somewhere new each time.
    const aside = (): number => (spread > 0 ? Math.round((game.random() * 2 - 1) * spread) : 0);
    const base = {
      x: Math.floor(at.x) + 0.5 + (stop.offset?.x ?? 0) + aside(),
      y: at.y,
      z: Math.floor(at.z) + 0.5 + (stop.offset?.z ?? 0) + aside(),
    };
    const taken = (x: number, z: number): boolean => {
      for (const o of people) if (o !== p && Math.floor(o.target.x) === x && Math.floor(o.target.z) === z) return true;
      return false;
    };
    const spot = game.systems.nav.near(base, 4, taken);
    p.target = spot ?? base;
    p.settled = spot !== null;
  }

  function setGoal(p: Person, stop: Stop): void {
    p.goal = stop;
    p.state.place = stop.place;
    resolve(p, stop);
    p.path = null;
    p.plan = true;
    p.fails = 0;
    p.blocked = 0;
  }

  /** Puts them on their spot at once: for people nobody can see, and for when no path is found. */
  function appear(p: Person): void {
    const pos = p.state.pos;
    pos.x = p.target.x; pos.y = p.target.y; pos.z = p.target.z;
    arrive(p);
  }

  function arrive(p: Person): void {
    p.path = null;
    p.plan = false;
    p.partial = false;
    p.fails = 0;
    p.blocked = 0;
    p.at = p.goal ? p.goal.place : null;
    p.actor.anim = 'idle';
  }

  // ------------------------------------------------------------------------------------ walking

  function makePath(p: Person): void {
    const nav = game.systems.nav, pos = p.state.pos, goal = p.goal!;
    p.plan = false;
    p.partial = false;
    const from = p.at;
    p.at = null;
    if (!p.settled) resolve(p, goal);
    if (!p.settled) { appear(p); return; }

    let path: Vec3[] | null = null;
    if (from && from !== goal.place) {
      // From one named place to another: the cached route, with a few steps to reach it and to leave it.
      const route = nav.route(from, goal.place);
      if (route && route.length > 0) {
        const head = nav.path(pos, route[0], 400), tail = nav.path(route[route.length - 1], p.target, 400);
        if (head && tail) path = [...head, ...route.slice(1), ...tail.slice(1)];
      }
    }
    if (!path) {
      const found = nav.toward(pos, p.target);
      if (found && found.length > 0) {
        const last = found[found.length - 1];
        if (Math.floor(last.x) === Math.floor(p.target.x) && Math.floor(last.z) === Math.floor(p.target.z) && Math.abs(last.y - p.target.y) < 1.5) {
          path = found;
        } else if (distance2d(last, p.target) < distance2d(pos, p.target) - 3) {
          // No whole path, for example because the land ahead is not loaded. Walk the part there is.
          path = found;
          p.partial = true;
        }
      }
    }
    if (!path || path.length === 0) { appear(p); return; }
    p.path = path;
    p.next = path.length > 1 ? 1 : 0;
  }

  function walk(p: Person, dt: number): void {
    const facing = walkAlong(world, p.state.pos, p, WALK_SPEED, dt);
    if (facing !== null) {
      p.actor.facing = facing;
      p.actor.anim = 'walk';
      p.blocked = 0;
    } else p.actor.anim = 'idle';

    if (p.next >= p.path!.length) {
      if (p.partial) { p.path = null; p.plan = true; } else arrive(p);
    } else if (facing === null) {
      // Something is in the way that was not there when the path was made. Try another, then give up and appear.
      p.blocked += dt;
      if (p.blocked > 0.4) {
        p.blocked = 0;
        if (++p.fails > 2) appear(p);
        else { p.path = null; p.plan = true; }
      }
    }
  }

  function stand(p: Person): void {
    const pos = p.state.pos;
    p.actor.anim = 'idle';
    const dx = player.pos.x - pos.x, dz = player.pos.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.01 && d <= FACE_RANGE && Math.abs(player.pos.y - pos.y) < 3) p.actor.facing = facingOf(dx, dz);
  }

  function move(p: Person, dt: number): void {
    const pos = p.state.pos;
    if (p.talking || (p.held && !p.sent)) { stand(p); return; }
    // Give the player time to use the talk prompt, then carry on with the routine.
    // People resume after the greeting even when the player lingers.
    const nearby = distance2d(pos, player.pos) <= TALK_RANGE && Math.abs(pos.y - player.pos.y) < 2;
    if (!nearby) p.greeting = null;
    else {
      p.greeting ??= 2;
      if (p.greeting > 0) {
        p.greeting = Math.max(0, p.greeting - dt);
        stand(p);
        return;
      }
    }
    if (!p.plan && p.path === null) {
      // Standing on their spot.
      stand(p);
      if (p.settled) {
        if (pos.y !== p.target.y) pos.y += clamp(p.target.y - pos.y, -8 * dt, 8 * dt);
      } else if ((p.check -= dt) <= 0 && distance2d(pos, player.pos) <= WALK_RANGE) {
        // The land here was not loaded when they came. Look again now that the player is near.
        p.check = 1;
        if (p.goal) resolve(p, p.goal);
        if (p.settled) appear(p);
      }
      return;
    }
    if (distance2d(pos, player.pos) > WALK_RANGE) { appear(p); return; }
    if (p.plan) {
      if (plans <= 0) { stand(p); return; }
      plans--;
      makePath(p);
      if (p.path === null) return;
    }
    walk(p, dt);
  }

  // ------------------------------------------------------------------------------------ setting up

  function build(def: PersonDef, n: number): Person {
    const pos = { x: 0, y: 0, z: 0 };
    const state: NpcState = { id: def.id, name: def.name, sprite: def.sprite, portrait: def.portrait, voice: def.voice, pos, place: '', friendship: 0 };
    const actor: Actor = { id: 'npc:' + def.id, sprite: def.sprite, pos, facing: Math.PI, anim: 'idle', visible: true, mark: '' };
    const wander = def.wander;
    return {
      def, state, actor,
      stay: def.stay ? { place: def.stay.place } : null,
      wanderStops: wander ? wander.places.map((place) => ({ place })) : [],
      wanderIndex: wander ? n % wander.places.length : 0,
      wanderTimer: wander ? wander.every * (0.25 + 0.75 * game.random()) : 0,
      greeting: null,
      goal: null, target: { x: 0, y: 0, z: 0 }, settled: false,
      path: null, next: 0, partial: false, plan: false, at: null,
      held: false, sent: null, talking: false, blocked: 0, fails: 0, check: 0,
    };
  }

  /** People need the region for their places, so they are made on the first step or call, not while installing. */
  function ready(): boolean {
    if (started) return true;
    if (!game.systems.region || !game.systems.nav) return false;
    started = true;
    const crowd = [...CROWD_SPRITES];
    for (let i = crowd.length - 1; i > 0; i--) {
      const j = Math.floor(game.random() * (i + 1));
      [crowd[i], crowd[j]] = [crowd[j], crowd[i]];
    }
    let crowdIndex = 0;
    defs.forEach((definition, n) => {
      const def = definition.crowd
        ? { ...definition, sprite: crowd[crowdIndex++ % crowd.length] }
        : definition;
      const p = build(def, n);
      people.push(p);
      states.push(p.state);
      byId.set(def.id, p);
      game.actors.set(p.actor.id, p.actor);
      const prompt = 'Talk to ' + def.name;
      game.systems.interact?.add({
        id: p.actor.id,
        pos: () => p.state.pos,
        radius: TALK_RANGE,
        prompt: () => prompt,
        act: () => game.systems.talk.talkTo(def.id),
      });
    });
    for (const p of people) {
      setGoal(p, routineStop(p));
      appear(p);
    }
    if (pending) {
      restore(pending);
      pending = null;
    }
    return true;
  }

  function restore(save: PeopleSave): void {
    if (!save || !Array.isArray(save.people)) return;
    for (const s of save.people) {
      const p = byId.get(s.id);
      if (!p) continue;
      if (p.def.crowd && s.sprite && (CROWD_SPRITES as readonly string[]).includes(s.sprite)) {
        p.state.sprite = p.actor.sprite = s.sprite;
      }
      const pos = p.state.pos;
      pos.x = s.x; pos.y = s.y; pos.z = s.z;
      p.actor.facing = s.facing;
      p.actor.mark = s.mark ?? '';
      p.actor.anim = 'idle';
      p.state.friendship = clamp(Number(s.friendship) || 0, 0, 5);
      p.state.place = s.place;
      p.held = Boolean(s.held);
      p.sent = s.sent ? { stop: s.sent.offset ? { place: s.sent.place, offset: { x: s.sent.offset.x, z: s.sent.offset.z } } : { place: s.sent.place }, day: s.sent.day } : null;
      if (p.wanderStops.length > 0 && Array.isArray(s.wander)) {
        p.wanderIndex = clamp(Math.floor(s.wander[0]) || 0, 0, p.wanderStops.length - 1);
        p.wanderTimer = Number(s.wander[1]) || 0;
      }
      // They stand where they were saved. The next step picks their goal again and walks them on.
      p.goal = null;
      p.target = { x: s.x, y: s.y, z: s.z };
      p.settled = true;
      p.path = null;
      p.plan = false;
      p.at = s.at ?? null;
      p.talking = false;
      if (p.sent) setGoal(p, p.sent.stop);
    }
  }

  game.events.on('slept', () => {
    slept = true;
  });
  game.events.on('talk.started', ({ npc }) => {
    const p = byId.get(npc);
    if (p) p.talking = true;
  });
  game.events.on('talk.ended', ({ npc }) => {
    const p = byId.get(npc);
    if (p) p.talking = false;
  });

  // ------------------------------------------------------------------------------------ the api

  const api: PeopleApi = {
    all() {
      ready();
      return states;
    },
    get(id) {
      ready();
      return byId.get(id)?.state;
    },
    send(id, place, offset) {
      if (!ready()) return;
      const p = byId.get(id);
      if (!p || !placeAt(place)) return;
      p.sent = { stop: offset ? { place, offset: { x: offset.x, z: offset.z } } : { place }, day: clock.day };
      setGoal(p, p.sent.stop);
    },
    hold(id, held) {
      if (!ready()) return;
      const p = byId.get(id);
      if (!p || p.held === held) return;
      p.held = held;
      if (!held) {
        p.goal = null; // the next step picks up the routine again
      } else if (!p.sent) {
        // Stop where they are. Someone who was sent somewhere still finishes that walk, and stays there.
        p.path = null;
        p.plan = false;
        p.at = null;
        p.actor.anim = 'idle';
      }
    },
    befriend(id, amount) {
      if (!ready()) return;
      const p = byId.get(id);
      if (p) p.state.friendship = clamp(p.state.friendship + amount, 0, 5);
    },
    setMark(id, mark) {
      if (!ready()) return;
      const p = byId.get(id);
      if (p) p.actor.mark = mark ?? '';
    },
  };

  const system: SimSystem = {
    step(dt) {
      if (!ready()) return;
      plans = 1;
      const talk = game.systems.talk;
      for (const p of people) {
        // A conversation that ended without saying so must not freeze anyone.
        if (p.talking && talk && !talk.active) p.talking = false;
        if (!p.held) {
          // Someone sent somewhere stays until the next morning, then goes back to their routine.
          if (p.sent && clock.day !== p.sent.day) p.sent = null;
          if (p.wanderStops.length > 1 && !p.talking && !p.plan && p.path === null && (p.wanderTimer -= dt) <= 0) {
            const count = p.wanderStops.length;
            p.wanderIndex = (p.wanderIndex + 1 + Math.floor(game.random() * (count - 1))) % count;
            p.wanderTimer = p.def.wander!.every * (0.75 + 0.5 * game.random());
          }
          const want = p.sent ? p.sent.stop : routineStop(p);
          if (want !== p.goal) setGoal(p, want);
        }
        if (slept && !p.talking && (p.plan || p.path !== null)) appear(p);
        move(p, dt);
      }
      slept = false;
    },
    save(): PeopleSave {
      if (!ready()) return pending ?? { version: 1, people: [] };
      return {
        version: 1,
        people: people.map((p) => ({
          id: p.def.id,
          sprite: p.state.sprite,
          x: p.state.pos.x, y: p.state.pos.y, z: p.state.pos.z,
          facing: p.actor.facing,
          place: p.state.place,
          friendship: p.state.friendship,
          held: p.held,
          mark: p.actor.mark ?? '',
          sent: p.sent ? { place: p.sent.stop.place, day: p.sent.day, ...(p.sent.stop.offset ? { offset: p.sent.stop.offset } : {}) } : null,
          wander: [p.wanderIndex, p.wanderTimer],
          at: p.at,
        })),
      };
    },
    load(data) {
      pending = data as PeopleSave;
      if (ready() && pending) {
        restore(pending);
        pending = null;
      }
    },
  };

  return { api, system };
}

export function install(kernel: Kernel): void {
  const people = createPeople(kernel.game);
  kernel.add('people', people.api, people.system);
}
