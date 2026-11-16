// Machines: waterwheels, gear shafts and the parts on them, the power they share, and each part's state
// (working, starved, backed up, off) shown on it. Handbook chapter 30, "The parts".
//
// - A shaft is the parts that touch each other. Its wheels make power (4 on flat water, 6 where it drops) and its
//   parts ask for it. Short of power, every part on it runs slower, never stopped: a wheel that makes 4 and is
//   asked for 6 runs everything at two thirds.
// - A lever or a sensor switches every part on its shaft. No fuel and no wear.
// - The spade digs a hole. A hole with water beside it, level or higher, fills, and is a ditch.
// - Goods lie loose where a creature or an arm left them. The player picks them up by walking over them, a
//   collector chest takes in any within three blocks, a chute carries them along, and a pusher shoves them.
//
// It reads the placed things from the placeables system: a part is a placed thing whose kind has a rule in
// parts.sim.ts. It never draws: src/game/views/world-machines.view.ts does.

import { AIR, blockId } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import type {
  Game, Hole, ItemId, LooseGood, MachinePart, MachineState, MachinesApi, Placed, SensorMode, Shaft, SimSystem, Stack, UseContext,
} from '../api.sim.ts';
import { FLAG } from '../content/flags.ts';
import { DAWN, DUSK } from '../quests/rules.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
import { FRONT, PART_RULES, SENSOR_MODES, SENSOR_WORDS, WHEEL_DROP, WHEEL_FLAT } from './parts.sim.ts';

/** Seconds between two looks at the shafts, the water and the goods. */
const TICK = 0.25;
/** A jammed wheel stands this long before the gearling wanders off. */
const JAM_SECONDS = 60;
/** How far a collector chest reaches for loose goods, in blocks each way. */
const CHEST_REACH = 3;
/** How close the hero walks to a loose good to pick it up. */
const PICK_UP = 1.1;
/** Seconds a good takes to slide one block along a chute, or for a pusher at full speed to shove once. */
const CHUTE_STEP = 0.5;
const PUSH_STEP = 1;
/** Seconds between two cuts of an arm at full speed. */
const ARM_STEP = 6;
const SAW_STEP = 12;
/** How often a working sprinkler tells the effects it ran. */
const SPRAY_EVERY = 5;
/** Loose goods on one cell past this, and an arm that drops there is backed up. */
const PILE = 12;

const WATER = blockId('water');
const BARRIER = blockId('barrier');
const LIGHT = blockId('lantern_light');
const TILLED = blockId('tilled_soil');
/** Parts that stand on water's top. */
const ON_WATER = new Set(['waterwheel', 'gear_shaft', 'chute']);
const DIGGABLE = new Set([blockId('grass'), blockId('dirt'), blockId('tilled_soil'), blockId('sand'), blockId('path'), blockId('clay')]);

export interface MachinesSave {
  version: 1;
  holes: [number, number, number, boolean][];
  levers: [string, boolean][];
  sensors: [string, SensorMode][];
  hatches: [string, boolean][];
  chests: [string, [ItemId, number][]][];
  loose: [ItemId, number, number, number, number][];
  jams: [string, number][];
}

interface Part extends MachinePart {
  placed: Placed;
  /** Seconds toward its next push, cut or spray. */
  work: number;
}

const cellKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export function createMachines(game: Game): { api: MachinesApi; system: SimSystem } {
  const { world, events, flags } = game;
  const sys = game.systems;

  const parts: Part[] = [];
  const byId = new Map<string, Part>();
  const byCell = new Map<string, Part>();
  const shafts: Shaft[] = [];
  /** Per shaft, its parts. */
  const members: Part[][] = [];
  const holes: Hole[] = [];
  const holeAt = new Map<string, Hole>();
  const loose: LooseGood[] = [];
  /** Seconds toward Dax's next round of the yard. */
  let yard = 0;
  let nextLoose = 1;
  const levers = new Map<string, boolean>();
  const sensors = new Map<string, SensorMode>();
  const hatches = new Map<string, boolean>();
  const chests = new Map<string, Stack[]>();
  const jams = new Map<string, number>();
  const marks = new Map<string, MachineState>();
  /** Soil a working sprinkler reaches, by `x,y,z` of the soil, with the best speed. */
  const sprinkled = new Map<string, number>();
  /** The placed things the parts were made from, to see when the list changed. */
  let seenCount = -1;
  let dirty = true;
  let tick = 0;
  let spray = 0;
  let wired = false;

  // ------------------------------------------------------------------------------------ building the shafts

  function rebuild(): void {
    const placed = sys.placeables?.all() ?? [];
    const keep = new Set<string>();
    for (const p of placed) {
      if (!PART_RULES[p.kind]) continue;
      keep.add(p.id);
      let part = byId.get(p.id);
      if (!part) {
        part = { id: p.id, kind: p.kind, state: 'off', power: 0, wants: 0, x: p.x, y: p.y, z: p.z, quarterTurns: p.quarterTurns, speed: 0, shaft: -1, placed: p, work: 0 };
        byId.set(p.id, part);
        parts.push(part);
        if (p.kind === 'collector_chest' && !chests.has(p.id)) chests.set(p.id, []);
        if (p.kind === 'lever' && !levers.has(p.id)) levers.set(p.id, true);
        if (p.kind === 'sensor' && !sensors.has(p.id)) sensors.set(p.id, 'creature');
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (keep.has(part.id)) continue;
      // A lamp that was on keeps a light in its cell, which the placeables system does not know to clear.
      if (part.kind === 'switch_lamp' && world.getBlock(part.x, part.y, part.z) === LIGHT) world.setBlock(part.x, part.y, part.z, AIR);
      const chest = chests.get(part.id);
      // What a chest held spills where it stood, so nothing is lost when it is picked up.
      if (chest) for (const stack of chest) drop(stack.id, stack.count, { x: part.x + 0.5, y: part.y, z: part.z + 0.5 });
      chests.delete(part.id);
      levers.delete(part.id);
      sensors.delete(part.id);
      hatches.delete(part.id);
      jams.delete(part.id);
      marks.delete(part.id);
      byId.delete(part.id);
      parts.splice(i, 1);
    }
    byCell.clear();
    for (const part of parts) byCell.set(cellKey(part.x, part.y, part.z), part);

    // Shafts: every carrying part joined to the ones beside it, above or below it, or a step up or down.
    shafts.length = 0;
    members.length = 0;
    for (const part of parts) part.shaft = -1;
    for (const start of parts) {
      if (start.shaft >= 0 || !PART_RULES[start.kind].carries) continue;
      const index = shafts.length;
      const list: Part[] = [];
      shafts.push({ power: 0, wants: 0, speed: 0, on: true });
      members.push(list);
      start.shaft = index;
      const queue = [start];
      while (queue.length) {
        const at = queue.pop() as Part;
        list.push(at);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              // Straight neighbours, and a step up or down along x or z, never a diagonal on the ground.
              if ((dx !== 0 && dz !== 0) || (dx === 0 && dy === 0 && dz === 0)) continue;
              const next = byCell.get(cellKey(at.x + dx, at.y + dy, at.z + dz));
              if (!next || next.shaft >= 0 || !PART_RULES[next.kind].carries) continue;
              next.shaft = index;
              queue.push(next);
            }
          }
        }
      }
    }
    seenCount = placed.length;
    dirty = false;
  }

  // ------------------------------------------------------------------------------------ water and power

  const isWater = (x: number, y: number, z: number): boolean => world.getBlock(x, y, z) === WATER;

  function wheelPower(x: number, y: number, z: number): number {
    // A wheel stands in the water's top, or on the bank beside it.
    let below = isWater(x, y - 1, z) ? 1 : 0;
    if (!below) for (const [dx, dz] of FRONT) if (isWater(x + dx, y - 1, z + dz) || isWater(x + dx, y, z + dz)) below = 1;
    if (!below) return 0;
    // It drops: water beside the wheel's water falls a block away, or comes down from a block higher.
    for (const [dx, dz] of FRONT) {
      if (isWater(x + dx, y, z + dz) && isWater(x, y - 1, z)) return WHEEL_DROP;
      if (isWater(x + dx, y - 2, z + dz) && !isWater(x + dx, y - 1, z + dz) && isWater(x, y - 1, z)) return WHEEL_DROP;
    }
    return WHEEL_FLAT;
  }

  function frontOf(part: Part): [number, number] {
    const [dx, dz] = FRONT[part.quarterTurns & 3];
    return [part.x + dx, part.z + dz];
  }

  function looseOn(x: number, z: number, y: number): number {
    let count = 0;
    for (const good of loose) if (Math.floor(good.x) === x && Math.floor(good.z) === z && Math.abs(good.y - y) < 1.5) count += good.count;
    return count;
  }

  function chestCount(stacks: readonly Stack[]): number {
    let n = 0;
    for (const stack of stacks) n += stack.count;
    return n;
  }

  /** The collector chest standing at this cell, or a block lower or higher. */
  function chestAt(x: number, y: number, z: number): Part | undefined {
    for (let dy = -1; dy <= 1; dy++) {
      const part = byCell.get(cellKey(x, y + dy, z));
      if (part?.kind === 'collector_chest') return part;
    }
    return undefined;
  }

  function sees(part: Part): boolean {
    const mode = sensors.get(part.id) ?? 'creature';
    const [fx, fz] = frontOf(part);
    const y = part.y;
    switch (mode) {
      case 'creature':
        for (const actor of game.actors.values()) {
          if (actor.id === 'player' || !actor.visible) continue;
          if (Math.floor(actor.pos.x) === fx && Math.floor(actor.pos.z) === fz && Math.abs(actor.pos.y - y) < 2) return true;
        }
        return false;
      case 'good': {
        const chest = chestAt(fx, y, fz);
        return looseOn(fx, fz, y) > 0 || (chest !== undefined && chestCount(chests.get(chest.id) ?? []) > 0);
      }
      case 'ripe':
        return sys.crops?.at(fx, y - 1, fz)?.ripe ?? false;
      case 'dry':
        return world.getBlock(fx, y - 1, fz) === TILLED && (sys.crops?.at(fx, y - 1, fz)?.wet ?? 0) <= 0;
      case 'light':
      case 'dark': {
        const t = game.clock.timeOfDay;
        const day = t > 0.25 && t < 0.75;
        const lit = world.blockLightAt(fx, y, fz) >= 12 || (day && world.skyLightAt(fx, y, fz) >= 12);
        return mode === 'light' ? lit : !lit;
      }
      case 'room': {
        const chest = chestAt(fx, y, fz);
        return chest !== undefined && chestCount(chests.get(chest.id) ?? []) < api.chestSize;
      }
    }
  }

  function setState(part: Part, state: MachineState): void {
    if (part.state === state) return;
    part.state = state;
    events.emit('machine.state', { part: part.id, state });
  }

  /** Holt lives here and keeps the lamps, and no lever or sensor is on this lamp's shaft. */
  function holtLights(part: Part): boolean {
    if (!flags.is(FLAG.settler('holt')) || flags.get(FLAG.job('holt')) !== 'lamps') return false;
    return part.shaft < 0 || !members[part.shaft].some((m) => PART_RULES[m.kind].switch);
  }

  /** Works out every shaft's power and every part's state. */
  function evaluate(): void {
    for (let i = 0; i < shafts.length; i++) {
      const shaft = shafts[i];
      let power = 0, wants = 0, on = true;
      for (const part of members[i]) {
        const rule = PART_RULES[part.kind];
        if (part.kind === 'waterwheel') {
          part.power = jams.has(part.id) ? 0 : wheelPower(part.x, part.y, part.z);
          power += part.power;
        }
        if (rule.switch === 'lever' && !(levers.get(part.id) ?? true)) on = false;
        if (rule.switch === 'sensor' && !sees(part)) on = false;
      }
      if (on) for (const part of members[i]) wants += PART_RULES[part.kind].cost;
      shaft.power = power;
      shaft.wants = wants;
      shaft.on = on;
      shaft.speed = !on ? 0 : wants > 0 ? Math.min(1, power / wants) : power > 0 ? 1 : 0;
    }
    sprinkled.clear();
    for (const part of parts) {
      const rule = PART_RULES[part.kind];
      const shaft = part.shaft >= 0 ? shafts[part.shaft] : null;
      part.speed = shaft?.speed ?? 0;
      part.wants = shaft?.on ? rule.cost : 0;
      if (part.kind !== 'waterwheel') part.power = part.wants * part.speed;
      let state: MachineState;
      if (part.kind === 'waterwheel') {
        state = jams.has(part.id) ? 'backed up' : part.power > 0 ? 'working' : 'starved';
      } else if (rule.switch === 'lever') {
        state = (levers.get(part.id) ?? true) ? 'working' : 'off';
      } else if (rule.switch === 'sensor') {
        state = sees(part) ? 'working' : 'off';
      } else if (part.kind === 'collector_chest') {
        state = chestCount(chests.get(part.id) ?? []) >= api.chestSize ? 'backed up' : 'working';
      } else if (!rule.carries) {
        state = marks.get(part.id) ?? 'off';
      } else if (part.kind === 'switch_lamp' && holtLights(part)) {
        // Holt at the lamps: a lamp nothing switches lights itself at dusk and goes out at dawn.
        const t = game.clock.timeOfDay;
        state = t >= DUSK || t < DAWN ? 'working' : 'off';
      } else if (part.kind === 'switch_lamp' || part.kind === 'hatch') {
        state = !shaft || shaft.on ? 'working' : 'off';
      } else if (part.kind === 'chute') {
        // A chute works with no power, downhill. Its state is whether goods can leave it.
        state = backedChute(part) ? 'backed up' : 'working';
      } else if (!shaft || !shaft.on) {
        state = shaft && !shaft.on ? 'off' : 'starved';
      } else if (part.speed <= 0 || part.speed < 1) {
        state = 'starved';
      } else if (part.kind === 'harvester_arm' && looseOn(...frontOf(part), part.y) >= PILE) {
        state = 'backed up';
      } else {
        state = 'working';
      }
      setState(part, state);
      if (part.kind === 'sprinkler' && part.speed > 0) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dz === 0) continue;
            const k = cellKey(part.x + dx, part.y - 1, part.z + dz);
            sprinkled.set(k, Math.max(sprinkled.get(k) ?? 0, part.speed));
          }
        }
      }
      if (part.kind === 'switch_lamp') light(part, state === 'working');
    }
  }

  function light(part: Part, on: boolean): void {
    const here = world.getBlock(part.x, part.y, part.z);
    if (on && here === BARRIER) world.setBlock(part.x, part.y, part.z, LIGHT);
    else if (!on && here === LIGHT) world.setBlock(part.x, part.y, part.z, BARRIER);
  }

  // ------------------------------------------------------------------------------------ goods on the move

  function drop(item: ItemId, count: number, at: Vec3): void {
    if (count <= 0) return;
    const x = Math.floor(at.x) + 0.5, z = Math.floor(at.z) + 0.5;
    for (const good of loose) {
      if (good.item === item && good.x === x && good.z === z && Math.abs(good.y - at.y) < 0.5) {
        good.count += count;
        return;
      }
    }
    loose.push({ id: nextLoose++, item, count, x, y: at.y, z });
  }

  function intoChest(chestId: string, item: ItemId, count: number): number {
    const stacks = chests.get(chestId);
    if (!stacks) return 0;
    const room = api.chestSize - chestCount(stacks);
    const n = Math.min(room, count);
    if (n <= 0) return 0;
    const stack = stacks.find((s) => s.id === item);
    if (stack) stack.count += n;
    else stacks.push({ id: item, count: n });
    return n;
  }

  /** The ground's top at a column near a height: where a good comes to rest. */
  function restY(x: number, z: number, from: number): number {
    for (let y = Math.floor(from); y > Math.floor(from) - 4; y--) {
      const below = world.getBlock(x, y - 1, z);
      if (below !== AIR && below !== WATER && below !== LIGHT) return y;
    }
    return from;
  }

  /** The chute a good on this cell rides, and where it goes from it. */
  function nextOnChute(part: Part): { x: number; y: number; z: number; chute: Part | undefined; chest: Part | undefined } {
    const [fx, fz] = frontOf(part);
    const powered = part.shaft >= 0 && shafts[part.shaft].speed > 0;
    for (const dy of powered ? [0, -1, 1] : [0, -1]) {
      const next = byCell.get(cellKey(fx, part.y + dy, fz));
      if (next?.kind === 'chute') return { x: fx, y: part.y + dy, z: fz, chute: next, chest: undefined };
    }
    return { x: fx, y: part.y, z: fz, chute: undefined, chest: chestAt(fx, part.y, fz) };
  }

  function backedChute(part: Part): boolean {
    const next = nextOnChute(part);
    if (next.chute || !next.chest) return false;
    return chestCount(chests.get(next.chest.id) ?? []) >= api.chestSize && looseOn(part.x, part.z, part.y) > 0;
  }

  function moveGoods(dt: number): void {
    const bag = sys.inventory;
    const p = game.player.pos;
    for (let i = loose.length - 1; i >= 0; i--) {
      const good = loose[i];
      // The hero picks up what they walk over.
      if (bag && Math.abs(good.x - p.x) < PICK_UP && Math.abs(good.z - p.z) < PICK_UP && Math.abs(good.y - p.y) < 1.6) {
        const left = bag.add(good.item, good.count, { x: good.x, y: good.y + 0.3, z: good.z });
        good.count = left;
      }
      if (good.count <= 0) { loose.splice(i, 1); continue; }
      const gx = Math.floor(good.x), gz = Math.floor(good.z);
      // On a chute: it slides on to the next one, into a chest, or off the end.
      const chute = byCell.get(cellKey(gx, Math.floor(good.y), gz)) ?? byCell.get(cellKey(gx, Math.floor(good.y) - 1, gz));
      if (chute?.kind === 'chute') {
        chute.work += dt;
        if (chute.work >= CHUTE_STEP) {
          chute.work = 0;
          const next = nextOnChute(chute);
          if (next.chute) {
            good.x = next.x + 0.5; good.z = next.z + 0.5; good.y = next.y;
          } else if (next.chest) {
            good.count -= intoChest(next.chest.id, good.item, good.count);
          } else {
            good.x = next.x + 0.5; good.z = next.z + 0.5; good.y = restY(next.x, next.z, chute.y + 1);
          }
        }
      }
      if (good.count <= 0) loose.splice(i, 1);
    }
    // A collector chest takes in loose goods within three blocks.
    for (const part of parts) {
      if (part.kind !== 'collector_chest') continue;
      for (let i = loose.length - 1; i >= 0; i--) {
        const good = loose[i];
        if (Math.abs(Math.floor(good.x) - part.x) > CHEST_REACH || Math.abs(Math.floor(good.z) - part.z) > CHEST_REACH || Math.abs(good.y - part.y) > 2) continue;
        // A good on a chute is the chute's until it reaches the end.
        const on = byCell.get(cellKey(Math.floor(good.x), Math.floor(good.y), Math.floor(good.z)));
        if (on?.kind === 'chute') continue;
        good.count -= intoChest(part.id, good.item, good.count);
        if (good.count <= 0) loose.splice(i, 1);
      }
    }
  }

  /**
   * Dax on the yard: once an hour he carries what lies loose on your land into the nearest collector chest with
   * room, however far it is. Goods on a chute stay the chute's.
   */
  function carryYard(dt: number): void {
    yard += dt;
    if (yard < (sys.time?.dayLength ?? 1200) / 24) return;
    yard = 0;
    if (!flags.is(FLAG.settler('dax')) || flags.get(FLAG.job('dax')) !== 'yard') return;
    const grant = sys.region?.grant();
    const boxes = parts.filter((part) => part.kind === 'collector_chest');
    if (!grant || !boxes.length) return;
    for (let i = loose.length - 1; i >= 0; i--) {
      const good = loose[i];
      if (good.x < grant.x || good.z < grant.z || good.x >= grant.x + grant.width || good.z >= grant.z + grant.depth) continue;
      if (byCell.get(cellKey(Math.floor(good.x), Math.floor(good.y), Math.floor(good.z)))?.kind === 'chute') continue;
      const byDistance = boxes.map((box) => ({ box, d: Math.abs(box.x - good.x) + Math.abs(box.z - good.z) })).sort((a, b) => a.d - b.d);
      for (const { box } of byDistance) {
        good.count -= intoChest(box.id, good.item, good.count);
        if (good.count <= 0) break;
      }
      if (good.count <= 0) loose.splice(i, 1);
    }
  }

  /** A pusher shoves a good in front of it one block on. Arms cut and saw. Both run at their shaft's speed. */
  function work(dt: number): void {
    for (const part of parts) {
      if (part.speed <= 0) continue;
      if (part.kind === 'pusher') {
        part.work += dt * part.speed;
        if (part.work < PUSH_STEP) continue;
        part.work = 0;
        const [fx, fz] = frontOf(part);
        const [dx, dz] = FRONT[part.quarterTurns & 3];
        for (const good of loose) {
          if (Math.floor(good.x) !== fx || Math.floor(good.z) !== fz || Math.abs(good.y - part.y) > 1.5) continue;
          good.x += dx; good.z += dz;
          good.y = restY(Math.floor(good.x), Math.floor(good.z), good.y + 1);
        }
      } else if (part.kind === 'harvester_arm') {
        part.work += dt * part.speed;
        if (part.work < ARM_STEP) continue;
        part.work = 0;
        const [fx, fz] = frontOf(part);
        if (looseOn(fx, fz, part.y) >= PILE) continue;
        const gave = sys.crops?.cut?.(fx, part.y - 1, fz);
        if (gave) for (const stack of gave) drop(stack.id, stack.count, { x: fx + 0.5, y: part.y, z: fz + 0.5 });
      } else if (part.kind === 'saw_arm') {
        part.work += dt * part.speed;
        if (part.work < SAW_STEP) continue;
        part.work = 0;
        const [fx, fz] = frontOf(part);
        for (let dy = 0; dy <= 2; dy++) {
          const tree = sys.trees?.at(fx, part.y + dy, fz);
          if (tree && !tree.protected && sys.trees.fell(tree.x, tree.y, tree.z)) break;
        }
      }
    }
  }

  // ------------------------------------------------------------------------------------ ditches

  function fill(hole: Hole): void {
    hole.wet = true;
    world.setBlock(hole.x, hole.y, hole.z, WATER);

  }

  function flow(): void {
    for (const hole of holes) {
      if (hole.wet) continue;
      for (const [dx, dz] of FRONT) {
        if (isWater(hole.x + dx, hole.y, hole.z + dz) || isWater(hole.x + dx, hole.y + 1, hole.z + dz)) {
          fill(hole);
          break;
        }
      }
    }
    // The quest of the first day: a ditch from the pond that reaches the field. It counts while that step is open.
    if (flags.get(FLAG.questStep('ground')) !== 'ditch') return;
    for (const hole of holes) {
      if (!hole.wet) continue;
      for (const [dx, dz] of FRONT) {
        if (world.getBlock(hole.x + dx, hole.y, hole.z + dz) === TILLED) flags.set(FLAG.step('ground', 'ditch'), true);
      }
    }
  }

  function dig(context: UseContext): boolean {
    const { hit, held } = context;
    if (!hit || held?.id !== 'spade' || game.player.busy) return false;
    const { x, y, z } = hit;
    if (!DIGGABLE.has(world.getBlock(x, y, z)) || world.getBlock(x, y + 1, z) !== AIR) return false;
    if (sys.region?.isProtected(x, y, z)) {
      events.emit('toast', { text: 'This belongs to the town.' });
      return true;
    }
    if (sys.crops?.at(x, y, z)) {
      events.emit('toast', { text: 'Something is growing there.' });
      return true;
    }
    // Primary keeps the actions system's hold duration and drops.
    if (context.button === 'primary') return false;
    world.setBlock(x, y, z, AIR);
    const hole: Hole = { x, y, z, wet: false };
    holes.push(hole);
    holeAt.set(cellKey(x, y, z), hole);
    events.emit('block.broken', { x, y, z, id: blockId('dirt'), by: 'player' });
    flow();
    return true;
  }

  /**
   * A wheel, a shaft or a chute is set on water's top: a click on a ditch, or on the bed under its water, stands
   * it in the air over the water. Everything else on water is left to the usual placing, which wants ground.
   */
  function setOnWater(context: UseContext): boolean {
    const { hit, held } = context;
    if (context.button !== 'secondary' || !hit || !held || game.player.busy) return false;
    if (!ON_WATER.has(held.id)) return false;
    let x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    if (world.getBlock(hit.x, hit.y, hit.z) === WATER) { x = hit.x; y = hit.y + 1; z = hit.z; }
    else if (world.getBlock(x, y, z) === WATER) y += 1;
    if (world.getBlock(x, y - 1, z) !== WATER || world.getBlock(x, y, z) !== AIR) return false;
    if (Math.hypot(x + 0.5 - game.player.pos.x, z + 0.5 - game.player.pos.z) > 6) return false;
    const turns = (Math.round(game.player.facing / (Math.PI / 2)) + 2) & 3;
    if (!sys.placeables?.place(held.id, x, y, z, turns)) return false;
    sys.inventory.remove(held.id, 1);
    return true;
  }

  // The held breaker emits this synchronously, before awarding drops. Secondary dig
  // already registered its hole, so the same event cannot add it twice.
  events.on('block.broken', ({ x, y, z, id, by }) => {
    if (by !== 'player' || sys.inventory.held()?.id !== 'spade' || !DIGGABLE.has(id)
      || holeAt.has(cellKey(x, y, z)) || world.getBlock(x, y, z) !== AIR
      || world.getBlock(x, y + 1, z) !== AIR || sys.region?.isProtected(x, y, z)) return;
    const hole: Hole = { x, y, z, wet: false };
    holes.push(hole);
    holeAt.set(cellKey(x, y, z), hole);
    flow();
  });

  events.on('block.placed', ({ x, y, z, id }) => {
    const hole = holeAt.get(cellKey(x, y, z));
    if (!hole || id === WATER) return;
    holeAt.delete(cellKey(x, y, z));
    holes.splice(holes.indexOf(hole), 1);
  });
  events.on('placeable.placed', () => { dirty = true; });
  // The gearling that jammed a wheel goes home by morning.
  events.on('day.started', () => jams.clear());
  events.on('slept', () => jams.clear());

  function onUse(placed: Placed): void {
    if (placed.kind === 'lever') {
      const on = !(levers.get(placed.id) ?? true);
      levers.set(placed.id, on);
      events.emit('toast', { text: on ? 'The lever is up. Its shaft runs.' : 'The lever is down. Everything on its shaft stops.' });
      evaluate();
    } else if (placed.kind === 'sensor') {
      const now = sensors.get(placed.id) ?? 'creature';
      const next = SENSOR_MODES[(SENSOR_MODES.indexOf(now) + 1) % SENSOR_MODES.length];
      sensors.set(placed.id, next);
      events.emit('toast', { text: `The sensor runs its shaft while it sees ${SENSOR_WORDS[next]}.` });
      evaluate();
    } else if (placed.kind === 'hatch') {
      const part = byId.get(placed.id);
      if (part && part.shaft >= 0 && members[part.shaft].some((m) => PART_RULES[m.kind].switch)) {
        events.emit('toast', { text: 'A lever on its shaft works this hatch.' });
      } else {
        hatches.set(placed.id, !(hatches.get(placed.id) ?? false));
      }
    } else if (placed.kind === 'collector_chest') {
      events.emit('ui.open', { panel: 'collector', detail: placed.id });
    }
  }

  const api: MachinesApi = {
    parts: () => parts,
    turning() {
      for (const part of parts) if (part.kind === 'waterwheel' && part.state === 'working') return true;
      return false;
    },
    part: (id) => byId.get(id),
    shafts: () => shafts,
    sprinkled: (x, y, z) => sprinkled.get(cellKey(x, y, z)) ?? 0,
    holes: () => holes,
    hole: (x, y, z) => holeAt.get(cellKey(x, y, z)),
    loose: () => loose,
    drop,
    chest: (id) => chests.get(id) ?? null,
    empty(id) {
      const stacks = chests.get(id);
      const bag = sys.inventory;
      if (!stacks || !bag) return 0;
      let moved = 0;
      for (let i = stacks.length - 1; i >= 0; i--) {
        const stack = stacks[i];
        const left = bag.add(stack.id, stack.count);
        moved += stack.count - left;
        stack.count = left;
        if (left === 0) stacks.splice(i, 1);
      }
      if (moved === 0 && stacks.length) events.emit('toast', { text: 'Your bag is full.' });
      return moved;
    },
    chestSize: 60,
    jam(wheelId) {
      if (byId.get(wheelId)?.kind !== 'waterwheel') return;
      jams.set(wheelId, JAM_SECONDS);
      evaluate();
    },
    jammed: (wheelId) => jams.has(wheelId),
    lever: (id) => levers.get(id) ?? true,
    sensor: (id) => sensors.get(id) ?? null,
    hatchOpen(id) {
      const part = byId.get(id);
      if (!part) return false;
      if (part.shaft >= 0 && members[part.shaft].some((m) => PART_RULES[m.kind].switch)) return shafts[part.shaft].on;
      return hatches.get(id) ?? false;
    },
    mark(id, state) {
      marks.set(id, state);
      const part = byId.get(id);
      if (part && !PART_RULES[part.kind].carries) setState(part, state);
    },
    wheelPower,
  };

  const system: SimSystem = {
    step(dt) {
      if (!wired && sys.actions && sys.placeables?.onUse) {
        sys.actions.addHandler(dig);
        sys.actions.addHandler(setOnWater);
        sys.placeables.onUse(onUse);
        wired = true;
      }
      if (dirty || (sys.placeables?.all().length ?? 0) !== seenCount) {
        rebuild();
        evaluate();
      }
      for (const [id, left] of jams) {
        if (left - dt <= 0) jams.delete(id);
        else jams.set(id, left - dt);
      }
      tick += dt;
      if (tick >= TICK) {
        tick = 0;
        evaluate();
        flow();
      }
      moveGoods(dt);
      carryYard(dt);
      work(dt);
      spray += dt;
      if (spray >= SPRAY_EVERY) {
        spray = 0;
        for (const part of parts) if (part.kind === 'sprinkler' && part.state !== 'off' && part.speed > 0) events.emit('sprinkler.ran', { x: part.x, y: part.y, z: part.z, reach: 1 });
      }
    },
    save(): MachinesSave {
      return {
        version: 1,
        holes: holes.map((h) => [h.x, h.y, h.z, h.wet]),
        levers: [...levers],
        sensors: [...sensors],
        hatches: [...hatches],
        chests: [...chests].map(([id, stacks]) => [id, stacks.map((s) => [s.id, s.count] as [ItemId, number])]),
        loose: loose.map((g) => [g.item, g.count, g.x, g.y, g.z]),
        jams: [...jams],
      };
    },
    load(data) {
      const save = data as Partial<MachinesSave> | null;
      holes.length = 0;
      holeAt.clear();
      for (const [x, y, z, wet] of save?.holes ?? []) {
        const hole = { x, y, z, wet };
        holes.push(hole);
        holeAt.set(cellKey(x, y, z), hole);
      }
      levers.clear();
      for (const [id, on] of save?.levers ?? []) levers.set(id, on);
      sensors.clear();
      for (const [id, mode] of save?.sensors ?? []) sensors.set(id, mode);
      hatches.clear();
      for (const [id, open] of save?.hatches ?? []) hatches.set(id, open);
      chests.clear();
      for (const [id, stacks] of save?.chests ?? []) chests.set(id, stacks.map(([item, count]) => ({ id: item, count })));
      loose.length = 0;
      for (const [item, count, x, y, z] of save?.loose ?? []) loose.push({ id: nextLoose++, item, count, x, y, z });
      jams.clear();
      for (const [id, left] of save?.jams ?? []) jams.set(id, left);
      parts.length = 0;
      byId.clear();
      dirty = true;
    },
  };

  return { api, system };
}

export function install(kernel: Kernel): void {
  const { api, system } = createMachines(kernel.game);
  kernel.add('machines', api, system);
}
