// Inputs: what a player does, as data. A scenario is a list of them, the bot makes them from a seed, and a
// replay is the same list played again. `press` plays one on a `Play`.
//
// There are two families. A press is what the keys and the mouse do in one step of the game. It never fails:
// a click on nothing does nothing, as in the game. The bot makes only presses. A verb is one of the harness's
// verbs and may take many steps. It throws when it cannot do what it says, with where the game was, because
// in a scenario every such stop is a finding.

import type { ItemId, NpcId } from '../api.sim.ts';
import type { Vec3 } from '../../engine/types.ts';
import { DAWN } from '../quests/rules.sim.ts';
import { EVENING } from '../time/index.sim.ts';
import type { BodyKeys, Play } from './harness.sim.ts';

/** A point on the ground: a named place, a point, so many blocks east and south of a place, a pet or a person. */
export type Spot =
  | string
  | { x: number; z: number; y?: number }
  | { place: string; dx?: number; dz?: number }
  | { pet: string }
  | { npc: NpcId };

/**
 * A block: its own coordinates, or counted from the block a named place stands in. `dy` is -1 when not given,
 * which is the ground under someone standing there.
 */
export type Cell = { x: number; y: number; z: number } | { place: string; dx?: number; dy?: number; dz?: number };

export type Face = readonly [number, number, number];

export type Press =
  /** One step with the movement keys held. With no key it is a step of standing still. */
  | ({ do: 'keys' } & BodyKeys)
  /** A number key: the quick slot in the hand. */
  | { do: 'slot'; index: number }
  /** A mouse button on what a ray from the hero's eyes hits. Nothing in build mode, where the button draws a stroke. */
  | { do: 'click'; button: 'primary' | 'secondary'; yaw: number; pitch: number }
  /** One step with the primary button held on what the ray hits. */
  | { do: 'hold'; yaw: number; pitch: number }
  /** The E key. With `prompt`, it is a verb: the prompt must read that. */
  | { do: 'interact'; prompt?: string }
  /** One click in a conversation: the next line, or the choice of this index. */
  | { do: 'say'; choice?: number }
  /** A click on a recipe's row. */
  | { do: 'craft'; recipe: string }
  /** The bag panel: a stack dragged from one slot to another, or `count` of it. */
  | { do: 'move'; from: number; to: number; count?: number }
  /** The build key: build mode on or off. */
  | { do: 'build'; on: boolean }
  /** Build mode: the pointer moves to what the ray hits. */
  | { do: 'point'; yaw: number; pitch: number }
  /** Build mode: the button goes down, comes up, the stroke is dropped, the last one is taken back, the held piece turns. */
  | { do: 'press' }
  | { do: 'release' }
  | { do: 'cancel' }
  | { do: 'undo' }
  | { do: 'turn'; direction: 1 | -1 }
  /** The page reloads and the player presses Continue: the game is saved and loaded into a fresh world and kernel. */
  | { do: 'reload' };

export type Verb =
  /** Lets time pass: so many seconds, or until evening or `until` holds, which must come within `seconds` (a day when not given). */
  | { do: 'wait'; seconds?: number; until?: 'evening' | ((p: Play) => boolean) }
  | { do: 'teleport'; to: Spot }
  | { do: 'walk'; to: Spot; soft?: boolean; within?: number }
  | { do: 'take'; item: ItemId }
  /** The secondary button, the primary button, and the primary button held until the block breaks. `fails` says the game must refuse. */
  | { do: 'use'; at: Cell; face?: Face; fails?: boolean }
  | { do: 'hit'; at: Cell; face?: Face; fails?: boolean }
  | { do: 'dig'; at: Cell; face?: Face; fails?: boolean }
  /** Clicks through the open conversation, taking the first choice or this one. */
  | { do: 'talk'; choice?: number }
  | { do: 'make'; recipe: string; fails?: boolean }
  /** Build mode: one press on `from`, a drag to `to` and a release. `changes` is how many cells it must change. */
  | { do: 'stroke'; from: Cell; to: Cell; changes?: number }
  /** Walks to the nearest tree the player may cut and holds the button on it until it falls. */
  | { do: 'fell' }
  /** Walks softly up to the pet and offers a treat, with the secondary button or with E, until it has eaten one. */
  | { do: 'feed'; pet: string; by?: 'click' | 'key' }
  /** Something that must hold at this point. */
  | { do: 'check'; what: string; that: (p: Play) => boolean }
  /** Anything else, as a function of the play. */
  | { do: 'run'; name: string; run: (p: Play) => void };

export type Input = Press | Verb;

const TOP: Face = [0, 1, 0];

/** Where the game is, for the message of an input that failed. */
export function where(p: Play): string {
  const { clock, player } = p.game;
  const quest = p.sys.quests.tracked();
  const held = p.sys.inventory.held();
  return [
    `day ${clock.day} at ${clock.timeOfDay.toFixed(3)}, step ${p.steps}`,
    `player at ${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)}, ${player.pos.z.toFixed(1)}${player.busy ? ' (busy)' : ''}`,
    `holding ${held ? `${held.count} ${held.id}` : 'nothing'}`,
    `quest ${quest ? `${quest.id}.${String(p.game.flags.get(`quest.${quest.id}.step`))}` : 'none'}`,
    `last said: ${p.said.slice(-3).join(' | ') || 'nothing'}`,
  ].join('; ');
}

function must(p: Play, ok: unknown, what: string): asserts ok {
  if (!ok) throw new Error(`${what}. [${where(p)}]`);
}

export function spotOf(p: Play, spot: Spot): Vec3 {
  if (typeof spot === 'string') return spot === 'spawn' ? p.sys.region.spawn() : p.sys.region.place(spot).at;
  if ('place' in spot) {
    const at = p.sys.region.place(spot.place).at;
    return { x: at.x + (spot.dx ?? 0), y: at.y, z: at.z + (spot.dz ?? 0) };
  }
  if ('pet' in spot) {
    const pet = p.sys.pets.all().find((one) => one.kind === spot.pet);
    must(p, pet, `there is no ${spot.pet}`);
    return pet.pos;
  }
  if ('npc' in spot) {
    const npc = p.sys.people.get(spot.npc);
    must(p, npc, `nobody is called ${spot.npc}`);
    return npc.pos;
  }
  return { x: spot.x, y: spot.y ?? p.world.heightAt(spot.x, spot.z), z: spot.z };
}

export function cellOf(p: Play, cell: Cell): { x: number; y: number; z: number } {
  if (!('place' in cell)) return cell;
  const at = p.sys.region.place(cell.place).at;
  return { x: Math.floor(at.x) + (cell.dx ?? 0), y: Math.floor(at.y) + (cell.dy ?? -1), z: Math.floor(at.z) + (cell.dz ?? 0) };
}

/** An input in a few words, for a message. */
export function describe(input: Input): string {
  if (input.do === 'check') return `check: ${input.what}`;
  if (input.do === 'run') return `run: ${input.name}`;
  return JSON.stringify(input, (_, value: unknown) => (typeof value === 'function' ? 'a condition' : value));
}

/** What Continue must bring back, as act1.test.ts asks of it: the clock, the player, the bag, the flags, what was built, what grows and the pets. */
function mustMatch(before: Play, after: Play): void {
  const same = (what: string, a: unknown, b: unknown): void => {
    const was = JSON.stringify(a), is = JSON.stringify(b);
    must(after, was === is, `after a save and a load ${what} is ${is} and was ${was}`);
  };
  same('the clock', before.game.clock, after.game.clock);
  same('the player\'s place', before.game.player.pos, after.game.player.pos);
  same('the bag', before.sys.inventory.slots, after.sys.inventory.slots);
  same('the flags', [...before.kernel.save().flags].sort(), [...after.kernel.save().flags].sort());
  // A load may list these in another order.
  const placed = (p: Play): string[] => p.sys.placeables.all().map((one) => JSON.stringify(one)).sort();
  const crops = (p: Play): string[] => p.sys.crops.all().map((crop) => `${crop.x},${crop.y},${crop.z} ${crop.state.crop} stage ${crop.state.stage}`).sort();
  same('what stands', placed(before), placed(after));
  same('what grows', crops(before), crops(after));
  same('the pets', before.sys.pets.all().map((pet) => [pet.id, pet.trust, pet.bonded]), after.sys.pets.all().map((pet) => [pet.id, pet.trust, pet.bonded]));
}

/** The nearest standing tree the player may cut. */
function nearestTree(p: Play): { x: number; y: number; z: number } | null {
  const at = p.game.player.pos;
  let best: { x: number; y: number; z: number } | null = null, bestDistance = Infinity;
  for (const tree of p.sys.trees.all()) {
    if (!tree.standing || tree.protected || p.sys.region.isProtected(tree.x, tree.y, tree.z)) continue;
    const d = Math.hypot(tree.x + 0.5 - at.x, tree.z + 0.5 - at.z);
    if (d < bestDistance) { best = tree; bestDistance = d; }
  }
  return best;
}

function fell(p: Play): void {
  const tree = nearestTree(p);
  must(p, tree, 'there is no tree to cut near the player');
  const spot = p.sys.nav.near({ x: tree.x + 0.5, y: tree.y, z: tree.z + 0.5 }, 1.5, (x, z) => x === tree.x && z === tree.z);
  must(p, spot, `there is nowhere to stand beside the tree at ${tree.x}, ${tree.z}`);
  must(p, p.walkTo(spot, { within: 0.3, seconds: 240 }), `could not walk to the tree at ${tree.x}, ${tree.z}`);
  const dx = p.game.player.pos.x - (tree.x + 0.5), dz = p.game.player.pos.z - (tree.z + 0.5);
  const face: Face = Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0, 0] : [0, 0, Math.sign(dz)];
  must(p, p.dig(tree.x, tree.y, tree.z, face), `the tree at ${tree.x}, ${tree.y}, ${tree.z} did not come down`);
}

function feed(p: Play, kind: string, byKey: boolean): void {
  const pet = p.sys.pets.all().find((one) => one.kind === kind);
  must(p, pet, `there is no ${kind}`);
  const player = p.game.player, before = pet.trust;
  for (let tries = 0; tries < 8; tries++) {
    must(p, p.walkTo(pet.pos, { soft: true, within: 2.2, seconds: 120 }), `could not walk softly up to the ${kind}`);
    if (byKey) {
      must(p, p.interact() !== null, `E beside the ${kind} did nothing`);
    } else {
      const treat = p.sys.inventory.slots.find((slot) => slot && p.sys.items.get(slot.id).treat);
      must(p, treat && p.take(treat.id), `there is no treat for the ${kind} in the bag`);
      // The treat is held out with the secondary button on the ground at the player's feet.
      p.use(Math.floor(player.pos.x), Math.floor(player.pos.y) - 1, Math.floor(player.pos.z));
    }
    if (p.until(() => pet.trust > before, 6)) {
      // It eats for a few seconds and takes nothing more until it is done.
      p.advance(3.2);
      return;
    }
  }
  must(p, false, `the ${kind} did not take a treat in eight tries (trust ${pet.trust}, startled ${String(pet.startled)})`);
}

/**
 * Plays one input. Returns the play to go on with: the same one, or after `reload` the loaded one.
 * A press that did not step the game leaves the stepping to the caller.
 */
export function press(p: Play, input: Input): Play {
  const { sys, game } = p;
  const build = sys.build;
  switch (input.do) {
    // ---------------------------------------------------------------- presses
    case 'keys':
      p.tick(input);
      return p;
    case 'slot':
      sys.inventory.selected = input.index;
      return p;
    case 'click':
      // In build mode the button belongs to the stroke: `press` and `release`.
      if (!build.active) p.click(input.button, p.aim(input.yaw, input.pitch));
      return p;
    case 'hold':
      if (!build.active && !game.player.busy) p.hold(p.aim(input.yaw, input.pitch));
      p.tick();
      return p;
    case 'interact':
      if (input.prompt !== undefined) must(p, p.prompt() === input.prompt, `the prompt should be "${input.prompt}" and is "${String(p.prompt())}"`);
      if (!game.player.busy) sys.interact.act();
      return p;
    case 'say': {
      const line = sys.talk.current();
      if (!line) return p;
      if (line.choices.length > 0) sys.talk.choose(Math.min(input.choice ?? 0, line.choices.length - 1));
      else sys.talk.advance();
      return p;
    }
    case 'craft':
      if (!game.player.busy) sys.crafting.make(input.recipe);
      return p;
    case 'move':
      sys.inventory.move(input.from, input.to, input.count);
      return p;
    case 'build':
      if (!game.player.busy) build.setActive(input.on);
      return p;
    case 'point':
      if (build.active) build.point(p.aim(input.yaw, input.pitch, true));
      return p;
    case 'press':
      if (build.active) build.press();
      return p;
    case 'release':
      if (build.active) build.release();
      else build.cancel();
      return p;
    case 'cancel':
      build.cancel();
      return p;
    case 'undo':
      if (build.active) build.undo();
      return p;
    case 'turn':
      if (build.active) build.turn(input.direction);
      return p;
    case 'reload': {
      const next = p.reload();
      mustMatch(p, next);
      return next;
    }

    // ---------------------------------------------------------------- verbs
    case 'wait': {
      const until = input.until;
      if (until === undefined) {
        p.advance(input.seconds ?? 0);
        return p;
      }
      const done = until === 'evening' ? (): boolean => game.clock.timeOfDay >= EVENING || game.clock.timeOfDay < DAWN : (): boolean => until(p);
      must(p, p.until(done, input.seconds ?? sys.time.dayLength), `waited ${input.seconds ?? sys.time.dayLength} seconds and ${until === 'evening' ? 'evening' : 'what was waited for'} did not come`);
      return p;
    }
    case 'teleport': {
      const at = spotOf(p, input.to);
      p.teleport({ x: at.x, z: at.z });
      return p;
    }
    case 'walk':
      must(p, p.walkTo(spotOf(p, input.to), { soft: input.soft, within: input.within }), `could not walk to ${JSON.stringify(input.to)}`);
      return p;
    case 'take':
      must(p, p.take(input.item), `there is no ${input.item} in the bag to take in hand`);
      return p;
    case 'use':
    case 'hit':
    case 'dig': {
      const at = cellOf(p, input.at);
      const did = p[input.do](at.x, at.y, at.z, input.face ?? TOP);
      must(p, did === !input.fails, `${input.do} on the block at ${at.x}, ${at.y}, ${at.z} ${did ? 'worked and should have been refused' : 'did nothing'}`);
      return p;
    }
    case 'talk':
      must(p, sys.talk.active, 'there is no conversation to click through');
      p.talkThrough(input.choice);
      must(p, !sys.talk.active && !game.player.busy, 'the conversation did not end');
      return p;
    case 'make': {
      const made = p.make(input.recipe);
      must(p, made === !input.fails, `${input.recipe} ${made ? 'was made and should have been refused' : 'could not be made'}`);
      return p;
    }
    case 'stroke': {
      must(p, build.active, 'a stroke needs build mode on');
      const from = cellOf(p, input.from), to = cellOf(p, input.to);
      build.point({ ...from, nx: 0, ny: 1, nz: 0 });
      must(p, build.press(), `the press at ${from.x}, ${from.y}, ${from.z} started no stroke`);
      build.point({ ...to, nx: 0, ny: 1, nz: 0 });
      const changed = build.release();
      if (input.changes !== undefined) must(p, changed === input.changes, `the stroke changed ${changed} cells and should have changed ${input.changes}`);
      return p;
    }
    case 'fell':
      fell(p);
      return p;
    case 'feed':
      feed(p, input.pet, input.by === 'key');
      return p;
    case 'check':
      must(p, input.that(p), `this does not hold: ${input.what}`);
      return p;
    case 'run':
      input.run(p);
      return p;
  }
}
