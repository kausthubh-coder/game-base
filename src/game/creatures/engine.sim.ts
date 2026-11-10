// One engine for every kind of creature. A kind is an entry in content/creatures.ts: where it appears,
// how it moves, what it fears, what it gives, when it is awake and what watching it teaches. Nothing
// here names a kind, so a new creature needs no change in this file.
//
// It allocates only when a creature appears, gives or is saved, never on an ordinary step.

import { AIR, BLOCKS, blockId } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import { ALMANAC_BOOK } from '../content/almanac.ts';
import { CREATURES, type CreatureCondition, type CreatureKind } from '../content/creatures.ts';
import type { Actor, CreatureState, CreaturesApi, Game, SimSystem, UseContext } from '../api.sim.ts';
import { distance2d, facingOf } from '../move.sim.ts';

/** Farther than this from the player a creature sleeps: it is not stepped at all. */
export const SLEEP_DISTANCE = 48;
/** Seconds between the checks that read blocks around a creature: its give condition and what the player sees. */
const CHECK = 0.25;
/** A search for blocks never looks farther than this up or down. */
const REACH_Y = 4;
/** `ambient.rain` above this counts as rain falling. */
const RAIN = 0.05;
/** Watered ground is forgotten after this long. No condition may ask for a longer memory. */
const WET_MEMORY = 600;
/** How long a creature keeps the block that draws it before it looks again. */
const LURE_FRESH = 4;
/** How long it stands still after it leaves an item, so the moment can be seen. */
const GIVE_POSE = 1.5;
/** How much faster than its walk a creature flees. */
const FLEE_SPEED = 1.8;

export interface CreaturesSave {
  version: 1;
  /** The next number for each kind's ids. */
  next: Record<string, number>;
  creatures: { kind: string; n: number; pos: [number, number, number]; home: [number, number, number]; ready: number }[];
  /** Watered ground, four numbers each: x, y, z and its age in seconds. */
  wet: number[];
  /** Seconds since rain last fell, or null when it has not rained. */
  rain: number | null;
}

interface Creature extends CreatureState {
  def: CreatureKind;
  /** The index of its kind. */
  k: number;
  n: number;
  actor: Actor;
  /** The spot where it appeared. It wanders around it. */
  home: Vec3;
  tx: number;
  tz: number;
  moving: boolean;
  /** Seconds left standing still. */
  rest: number;
  /** Seconds left to reach the target before it gives up. */
  patience: number;
  /** Seconds since it last gave. */
  ready: number;
  /** Seconds until its next slow check. */
  check: number;
  /** For each fact its kind teaches: how long the fact's condition has held in the player's sight, or -1 when it does not hold. */
  seen: number[];
  /** The block that draws it, when `hasLure`. */
  lure: Vec3;
  hasLure: boolean;
  lureAge: number;
}

const solid = (id: number): boolean => BLOCKS[id].solid;
const liquid = (id: number): boolean => BLOCKS[id].liquid;

export function createCreatures(game: Game, kinds: readonly CreatureKind[] = CREATURES): { api: CreaturesApi; system: SimSystem } {
  const world = game.world;
  const list: Creature[] = [];
  const water = blockId('water');

  // Block ids for every key the data names, looked up once. A typo in the data throws here.
  const ids = new Map<string, number>();
  const know = (key: string): void => void ids.set(key, blockId(key));
  const knowIn = (cond: CreatureCondition | 'gives'): void => {
    if (cond !== 'gives' && (cond.kind === 'on' || cond.kind === 'near')) know(cond.block);
  };
  for (const def of kinds) {
    know(def.appears.block);
    if (def.moves.toward) know(def.moves.toward.block);
    if (def.gives) knowIn(def.gives.when);
    for (const fact of def.watch?.facts ?? []) knowIn(fact.seeing);
  }
  const idOf = (key: string): number => ids.get(key) as number;

  const next = kinds.map(() => 1);
  const spawnIn = kinds.map(() => 0);
  /** Per kind: the anchor place once the region has given it. */
  const anchors: (Vec3 | null)[] = kinds.map(() => null);
  /** Per kind: true once the page was met in this session. */
  const met = kinds.map(() => false);
  /** Per kind and fact: true once this engine taught it, so it stops checking. */
  const taught = kinds.map((def) => (def.watch?.facts ?? []).map(() => false));

  const wet: number[] = [];
  let sinceRain = Infinity;

  game.events.on('crop.watered', ({ x, y, z }) => {
    for (let i = 0; i < wet.length; i += 4) {
      if (wet[i] === x && wet[i + 1] === y && wet[i + 2] === z) {
        wet[i + 3] = 0;
        return;
      }
    }
    wet.push(x, y, z, 0);
  });

  // The watering can on ground that is not tilled soil wets that ground too, so a creature that wants damp
  // ground can be helped anywhere. Tilled soil is left to the crops system, which sends the event itself.
  const tilled = blockId('tilled_soil');
  const useCan = (context: UseContext): boolean => {
    const { hit, held } = context;
    if (context.button !== 'secondary' || !hit || !held || hit.id === tilled) return false;
    if (game.systems.items?.get(held.id)?.tool?.kind !== 'can') return false;
    game.events.emit('crop.watered', { x: hit.x, y: hit.y, z: hit.z });
    return true;
  };
  let wired = false;

  // A night passes: watered ground dries, and every creature has had time to make its next gift.
  game.events.on('slept', () => {
    wet.length = 0;
    sinceRain = Infinity;
    for (const c of list) if (c.def.gives) c.ready = c.def.gives.every;
  });

  // ------------------------------------------------------------------------------------ blocks

  /** True when a block of this id is within `reach` blocks of the cell. */
  const anyNear = (id: number, cx: number, cy: number, cz: number, reach: number): boolean => {
    const up = Math.min(reach, REACH_Y);
    for (let x = cx - reach; x <= cx + reach; x++) {
      for (let z = cz - reach; z <= cz + reach; z++) {
        for (let y = cy - up; y <= cy + up; y++) if (world.getBlock(x, y, z) === id) return true;
      }
    }
    return false;
  };

  /** Finds the nearest block of this id within `reach` blocks of the cell and writes it to `out`. */
  const nearest = (id: number, cx: number, cy: number, cz: number, reach: number, out: Vec3): boolean => {
    const up = Math.min(reach, REACH_Y);
    let best = Infinity;
    for (let x = cx - reach; x <= cx + reach; x++) {
      for (let z = cz - reach; z <= cz + reach; z++) {
        for (let y = cy - up; y <= cy + up; y++) {
          if (world.getBlock(x, y, z) !== id) continue;
          const d = (x - cx) * (x - cx) + (y - cy) * (y - cy) + (z - cz) * (z - cz);
          if (d < best) {
            best = d;
            out.x = x; out.y = y; out.z = z;
          }
        }
      }
    }
    return best < Infinity;
  };

  const wetNear = (gx: number, gy: number, gz: number, reach: number, lasts: number): boolean => {
    for (let i = 0; i < wet.length; i += 4) {
      if (wet[i + 3] <= lasts && Math.abs(wet[i] - gx) <= reach && Math.abs(wet[i + 1] - gy) <= reach && Math.abs(wet[i + 2] - gz) <= reach) return true;
    }
    return false;
  };

  /** True when the condition holds for something whose ground block is (gx, gy, gz). */
  const holds = (cond: CreatureCondition, gx: number, gy: number, gz: number): boolean => {
    switch (cond.kind) {
      case 'always': return true;
      case 'on': return world.getBlock(gx, gy, gz) === idOf(cond.block);
      case 'near': return anyNear(idOf(cond.block), gx, gy + 1, gz, cond.within);
      case 'damp': return sinceRain <= cond.lasts || wetNear(gx, gy, gz, cond.water, cond.lasts) || anyNear(water, gx, gy, gz, cond.water);
    }
  };

  /** The y of the first block that is not air at or under the cell, looking 8 blocks down. -1 when there is none. */
  const surfaceUnder = (x: number, y: number, z: number): number => {
    for (let yy = y; yy >= y - 8 && yy >= 0; yy--) if (world.getBlock(x, yy, z) !== AIR) return yy;
    return -1;
  };

  /** True when a small body can stand with its feet at this height: a solid block under it and one open cell. */
  const stands = (x: number, y: number, z: number): boolean => solid(world.getBlock(x, y - 1, z)) && !solid(world.getBlock(x, y, z));

  /**
   * The height a walker at height `y` can step to in this column: the same level, one up or one down.
   * -1 at a wall or a longer drop. It never drops more than one block, so it can always climb back.
   */
  const floorAt = (x: number, y: number, z: number): number => {
    const bx = Math.floor(x), base = Math.floor(y + 0.01), bz = Math.floor(z);
    if (stands(bx, base, bz)) return base;
    if (stands(bx, base + 1, bz)) return base + 1;
    if (stands(bx, base - 1, bz)) return base - 1;
    return -1;
  };

  /** The y of the block a creature stands on or floats over. */
  const groundY = (c: Creature): number => {
    const p = c.pos;
    if (c.def.moves.mode === 'fly') {
      const top = surfaceUnder(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
      return top < 0 ? Math.floor(p.y) - 1 : top;
    }
    const floor = floorAt(p.x, p.y, p.z);
    return (floor < 0 ? Math.floor(p.y + 0.01) : floor) - 1;
  };

  // ------------------------------------------------------------------------------------ appearing

  const isAwake = (def: CreatureKind): boolean => {
    const a = def.awake;
    if (!a) return true;
    const t = game.clock.timeOfDay;
    return a.from <= a.to ? t >= a.from && t < a.to : t >= a.from || t < a.to;
  };

  const anchorOf = (k: number): Vec3 | null => {
    const around = kinds[k].appears.around;
    if (around === 'player') return game.player.pos;
    if (anchors[k]) return anchors[k];
    try {
      const place = game.systems.region?.place(around.place);
      if (place) anchors[k] = { x: place.at.x, y: place.at.y, z: place.at.z };
    } catch {
      // The region has no such place. The kind stays away until it does.
    }
    return anchors[k];
  };

  const crowded = (x: number, z: number): boolean => {
    for (let i = 0; i < list.length; i++) {
      const p = list[i].pos;
      if (Math.abs(p.x - x) < 1 && Math.abs(p.z - z) < 1) return true;
    }
    return false;
  };

  const spot: Vec3 = { x: 0, y: 0, z: 0 };

  /**
   * Looks for a place to be in the column (x, z) beside the block at height `by`, and writes it to `spot`.
   * `exact` asks for the place right on top of that block.
   */
  const spotAt = (def: CreatureKind, x: number, by: number, z: number, exact: boolean): boolean => {
    let y: number;
    if (def.moves.mode === 'fly') {
      const top = exact ? by : surfaceUnder(x, by + REACH_Y, z);
      if (top < 0) return false;
      y = top + 1 + (def.moves.hover ?? 1);
      if (world.getBlock(x, Math.floor(y), z) !== AIR) return false;
    } else {
      if (exact) {
        if (!stands(x, by + 1, z)) return false;
        y = by + 1;
      } else {
        y = floorAt(x, by + 1, z);
        if (y < 0) return false;
      }
      if (liquid(world.getBlock(x, y, z))) return false;
    }
    const light = world.lightAt(x,y,z);
    if (light < def.appears.light[0] || light > def.appears.light[1]) return false;
    if (crowded(x + 0.5, z + 0.5)) return false;
    spot.x = x + 0.5; spot.y = y; spot.z = z + 0.5;
    return true;
  };

  const add = (k: number, n: number, x: number, y: number, z: number): Creature => {
    const def = kinds[k];
    const pos = { x, y, z };
    const id = `creature:${def.id}:${n}`;
    const actor: Actor = { id, sprite: def.sprite, pos, facing: 0, anim: 'idle', visible: true, mark: '' };
    const c: Creature = {
      id, kind: def.id, pos, doing: 'idle',
      def, k, n, actor,
      home: { x, y, z },
      tx: x, tz: z, moving: false,
      rest: 0, patience: 0, ready: 0,
      check: game.random() * CHECK,
      seen: (def.watch?.facts ?? []).map(() => -1),
      lure: { x: 0, y: 0, z: 0 }, hasLure: false, lureAge: 0,
    };
    list.push(c);
    game.actors.set(id, actor);
    return c;
  };

  const remove = (i: number): void => {
    game.actors.delete(list[i].id);
    list.splice(i, 1);
  };

  const trySpawn = (k: number): void => {
    const def = kinds[k], a = def.appears;
    if (!isAwake(def)) return;
    let alive = 0;
    for (let i = 0; i < list.length; i++) if (list[i].k === k) alive++;
    if (alive >= a.max) return;
    const anchor = anchorOf(k);
    if (!anchor || distance2d(anchor, game.player.pos) > SLEEP_DISTANCE) return;
    const ax = Math.floor(anchor.x), ay = Math.floor(anchor.y), az = Math.floor(anchor.z);
    if (!world.isLoaded(ax, az)) return;

    // One pass over the area. It keeps one find picked evenly from all of them, and one picked evenly from
    // those where the kind's give condition already holds.
    const id = idOf(a.block), exact = a.within === 0, gives = def.gives;
    let count = 0, fx = 0, fy = 0, fz = 0;
    let good = 0, gx = 0, gy = 0, gz = 0;
    for (let x = ax - a.radius; x <= ax + a.radius; x++) {
      for (let z = az - a.radius; z <= az + a.radius; z++) {
        for (let y = ay - REACH_Y; y <= ay + REACH_Y; y++) {
          if (world.getBlock(x, y, z) !== id) continue;
          if (exact && !spotAt(def, x, y, z, true)) continue;
          if (game.random() * ++count < 1) { fx = x; fy = y; fz = z; }
          if (exact && gives && alive === 0 && holds(gives.when, x, y, z) && game.random() * ++good < 1) { gx = x; gy = y; gz = z; }
        }
      }
    }
    if (count === 0) return;

    if (exact) {
      // The first of a kind that gives appears where it can give, when there is such a spot.
      if (good > 0) { fx = gx; fy = gy; fz = gz; }
      if (!spotAt(def, fx, fy, fz, true)) return;
    } else {
      let found = false;
      for (let tries = 0; tries < 8 && !found; tries++) {
        const x = fx + Math.floor(game.random() * (2 * a.within + 1)) - a.within;
        const z = fz + Math.floor(game.random() * (2 * a.within + 1)) - a.within;
        found = spotAt(def, x, fy, z, false);
      }
      if (!found) return;
    }
    const c = add(k, next[k]++, spot.x, spot.y, spot.z);
    c.rest = restOf(def);
  };

  // ------------------------------------------------------------------------------------ moving

  const restOf = (def: CreatureKind): number => {
    const [least, most] = def.moves.pause;
    return least + game.random() * (most - least);
  };

  /** One step on the ground toward a point. Returns the facing, or null at a wall, a ledge or water. */
  const walk = (c: Creature, tx: number, tz: number, speed: number, dt: number): number | null => {
    const pos = c.pos;
    const dx = tx - pos.x, dz = tz - pos.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.05) return null;
    const step = Math.min(distance, speed * dt);
    const nx = pos.x + (dx / distance) * step, nz = pos.z + (dz / distance) * step;
    const floor = floorAt(nx, pos.y, nz);
    if (floor < 0 || liquid(world.getBlock(Math.floor(nx), floor, Math.floor(nz)))) return null;
    pos.x = nx;
    pos.z = nz;
    pos.y += Math.max(-8 * dt, Math.min(8 * dt, floor - pos.y));
    if (Math.abs(floor - pos.y) < 0.02) pos.y = floor;
    return facingOf(dx, dz);
  };

  /** One step through the air toward a point, keeping its height above the ground or the water. */
  const fly = (c: Creature, tx: number, tz: number, speed: number, dt: number): number | null => {
    const pos = c.pos;
    const dx = tx - pos.x, dz = tz - pos.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.05) return null;
    const step = Math.min(distance, speed * dt);
    const nx = pos.x + (dx / distance) * step, nz = pos.z + (dz / distance) * step;
    const bx = Math.floor(nx), by = Math.floor(pos.y), bz = Math.floor(nz);
    if (solid(world.getBlock(bx, by, bz))) return null;
    const top = surfaceUnder(bx, by, bz);
    if (top < 0) return null;
    const want = top + 1 + (c.def.moves.hover ?? 1);
    pos.x = nx;
    pos.z = nz;
    pos.y += Math.max(-2 * dt, Math.min(2 * dt, want - pos.y));
    return facingOf(dx, dz);
  };

  const go = (c: Creature, tx: number, tz: number): void => {
    c.tx = tx;
    c.tz = tz;
    c.moving = true;
    c.doing = 'wander';
    c.patience = (Math.hypot(tx - c.pos.x, tz - c.pos.z) / c.def.moves.speed) * 1.5 + 2;
  };

  const pickTarget = (c: Creature): void => {
    const m = c.def.moves, home = c.home;
    if (m.toward) {
      if (c.lureAge <= 0) {
        c.hasLure = nearest(idOf(m.toward.block), Math.floor(home.x), Math.floor(home.y), Math.floor(home.z), m.toward.within, c.lure);
        c.lureAge = LURE_FRESH;
      }
      if (c.hasLure && game.random() < m.toward.chance) {
        go(c, c.lure.x + 0.5 + (game.random() - 0.5) * 2, c.lure.z + 0.5 + (game.random() - 0.5) * 2);
        return;
      }
    }
    if (game.random() < m.home) {
      go(c, home.x, home.z);
      return;
    }
    const angle = game.random() * Math.PI * 2, reach = Math.sqrt(game.random()) * m.radius;
    go(c, home.x + Math.cos(angle) * reach, home.z + Math.sin(angle) * reach);
  };

  // ------------------------------------------------------------------------------------ giving and being watched

  /** True once the player has the Almanac. Before that, watching teaches nothing. */
  let book = false;
  const hasBook = (): boolean => {
    if (!book) book = game.flags.is(ALMANAC_BOOK.flag) || (game.systems.inventory?.count(ALMANAC_BOOK.item) ?? 0) > 0;
    return book;
  };

  const teach = (k: number, i: number): void => {
    const watch = kinds[k].watch;
    if (!watch || taught[k][i]) return;
    taught[k][i] = true;
    game.systems.almanac?.learn(watch.page, watch.facts[i].fact);
  };

  const give = (c: Creature, toPlayer: number): void => {
    const def = c.def, gives = def.gives;
    if (!gives) return;
    c.ready = 0;
    c.moving = false;
    c.rest = Math.max(c.rest, GIVE_POSE);
    c.doing = 'give';
    // Nobody close enough to pick it up: it is lost.
    if (toPlayer > gives.reach) return;
    game.systems.inventory?.add(gives.item, 1, c.pos);
    game.events.emit('creature.gave', { kind: def.id, item: gives.item, at: { x: c.pos.x, y: c.pos.y, z: c.pos.z } });
    const watch = def.watch;
    if (watch && toPlayer <= watch.within && hasBook()) {
      for (let i = 0; i < watch.facts.length; i++) if (watch.facts[i].seeing === 'gives') teach(c.k, i);
    }
  };

  /** The checks that read blocks: is it time and place to give, and does the player see something to learn. */
  const slowCheck = (c: Creature, toPlayer: number): void => {
    const def = c.def, gives = def.gives, watch = def.watch;
    const due = gives !== null && c.ready >= gives.every;
    const inSight = watch !== null && toPlayer <= watch.within && hasBook();
    if (!inSight) for (let i = 0; i < c.seen.length; i++) c.seen[i] = -1;
    if (!due && !inSight) return;

    const gx = Math.floor(c.pos.x), gy = groundY(c), gz = Math.floor(c.pos.z);
    if (due && holds(gives.when, gx, gy, gz)) give(c, toPlayer);
    if (!inSight) return;
    if (!met[c.k]) {
      met[c.k] = true;
      game.systems.almanac?.meet(watch.page);
    }
    for (let i = 0; i < watch.facts.length; i++) {
      const fact = watch.facts[i];
      if (fact.seeing === 'gives' || taught[c.k][i]) continue;
      if (!holds(fact.seeing, gx, gy, gz)) {
        c.seen[i] = -1;
        continue;
      }
      c.seen[i] = c.seen[i] < 0 ? 0 : c.seen[i] + CHECK;
      if (c.seen[i] >= (fact.seconds ?? 0)) teach(c.k, i);
    }
  };

  // ------------------------------------------------------------------------------------ one creature, one step

  const stepCreature = (c: Creature, dt: number, toPlayer: number): void => {
    const def = c.def, m = def.moves;
    const travel = m.mode === 'fly' ? fly : walk;
    let facing: number | null = null;

    let afraid = false;
    for (let i = 0; i < def.fears.length; i++) if (toPlayer < def.fears[i].within) afraid = true;

    if (afraid) {
      const p = game.player.pos;
      let dx = c.pos.x - p.x, dz = c.pos.z - p.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.001) { dx = 1; dz = 0; } else { dx /= length; dz /= length; }
      facing = travel(c, c.pos.x + dx * 3, c.pos.z + dz * 3, m.speed * FLEE_SPEED, dt);
      c.doing = 'flee';
      c.moving = false;
      c.rest = 0;
    } else if (c.rest > 0) {
      c.rest -= dt;
      if (c.doing !== 'give' || c.rest <= 0) c.doing = 'idle';
    } else if (!c.moving) {
      pickTarget(c);
    } else {
      facing = travel(c, c.tx, c.tz, m.speed, dt);
      c.patience -= dt;
      c.doing = 'wander';
      if (facing === null || c.patience <= 0 || Math.hypot(c.tx - c.pos.x, c.tz - c.pos.z) < 0.15) {
        c.moving = false;
        c.rest = restOf(def);
        c.doing = 'idle';
      }
    }

    if (facing !== null) c.actor.facing = facing;
    c.actor.anim = facing !== null ? 'walk' : 'idle';

    if (def.gives && c.ready < def.gives.every) c.ready = Math.min(def.gives.every, c.ready + dt);
    if (m.toward) c.lureAge -= dt;
    c.check -= dt;
    if (c.check <= 0) {
      c.check += CHECK;
      slowCheck(c, toPlayer);
    }
  };

  // ------------------------------------------------------------------------------------ the system

  const api: CreaturesApi = {
    all: () => list,
    countNear(kind, at, radius) {
      let count = 0;
      for (let i = 0; i < list.length; i++) if (list[i].kind === kind && distance2d(list[i].pos, at) <= radius) count++;
      return count;
    },
  };

  const system: SimSystem = {
    step(dt) {
      if (!wired && game.systems.actions) {
        game.systems.actions.addHandler(useCan);
        wired = true;
      }
      if (game.ambient.rain > RAIN) sinceRain = 0;
      else sinceRain += dt;
      for (let i = wet.length - 4; i >= 0; i -= 4) {
        wet[i + 3] += dt;
        if (wet[i + 3] > WET_MEMORY) wet.splice(i, 4);
      }

      for (let k = 0; k < kinds.length; k++) {
        spawnIn[k] -= dt;
        if (spawnIn[k] > 0) continue;
        spawnIn[k] = kinds[k].appears.every;
        trySpawn(k);
      }

      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        if (!isAwake(c.def)) {
          remove(i);
          continue;
        }
        const toPlayer = distance2d(c.pos, game.player.pos);
        if (toPlayer > SLEEP_DISTANCE) {
          // One that follows the player around is let go, so new ones can appear where the player is now.
          if (c.def.appears.around === 'player') remove(i);
          else if (c.doing !== 'sleep') {
            c.doing = 'sleep';
            c.actor.anim = 'idle';
          }
          continue;
        }
        stepCreature(c, dt, toPlayer);
      }
    },

    save(): CreaturesSave {
      const numbers: Record<string, number> = {};
      kinds.forEach((def, k) => (numbers[def.id] = next[k]));
      return {
        version: 1,
        next: numbers,
        creatures: list.map((c) => ({
          kind: c.kind, n: c.n,
          pos: [c.pos.x, c.pos.y, c.pos.z],
          home: [c.home.x, c.home.y, c.home.z],
          ready: c.ready,
        })),
        wet: [...wet],
        rain: Number.isFinite(sinceRain) ? sinceRain : null,
      };
    },

    load(data) {
      while (list.length) remove(list.length - 1);
      wet.length = 0;
      sinceRain = Infinity;
      next.fill(1);
      spawnIn.fill(0);
      met.fill(false);
      book = false;
      for (const row of taught) row.fill(false);
      const save = data as Partial<CreaturesSave> | null;
      if (!save || save.version !== 1) return;
      if (Array.isArray(save.wet)) {
        const whole = save.wet.length - (save.wet.length % 4);
        for (let i = 0; i < whole; i++) wet.push(save.wet[i]);
      }
      if (typeof save.rain === 'number') sinceRain = save.rain;
      kinds.forEach((def, k) => (next[k] = save.next?.[def.id] ?? 1));
      for (const row of save.creatures ?? []) {
        const k = kinds.findIndex((def) => def.id === row.kind);
        if (k < 0) continue;
        const c = add(k, row.n, row.pos[0], row.pos[1], row.pos[2]);
        c.home.x = row.home[0]; c.home.y = row.home[1]; c.home.z = row.home[2];
        c.ready = row.ready;
        if (row.n >= next[k]) next[k] = row.n + 1;
      }
    },
  };

  return { api, system };
}
