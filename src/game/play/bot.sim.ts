// The bot: a player that presses random valid inputs under a seed. One bot step is one press and one kernel
// step, with the hero's own body stepping, and after each the invariants are checked. The same seed presses
// the same inputs and plays the same game, so a failure at step n is found again by playing n steps.
//
// A valid input is one the keys and the mouse can make: the movement keys, a number key, a mouse button on
// what a ray from the hero's eyes hits, E, a click in a conversation or on a recipe, a drag in the bag, the
// build key and a stroke in build mode, a reload of the page. The bot never teleports, gives or skips.
//
// Random presses alone spend the day in a hole, so the bot also knows a few errands, each made of the same
// presses: walk to a place and press E, till and plant and water a row, click a crop, hold the button on a
// tree, hold a berry out to the leaftail, set the bed down under a tree, walk to the bed in the evening.

import { EYE_HEIGHT } from '../actions/index.sim.ts';
import type { ItemId, QuestId } from '../api.sim.ts';
import { createRandom } from '../kernel.sim.ts';
import { DAWN } from '../quests/rules.sim.ts';
import { EVENING } from '../time/index.sim.ts';
import type { Play } from './harness.sim.ts';
import { press, where, type Input } from './inputs.sim.ts';
import { createInvariants } from './invariants.sim.ts';
import { begin, listenForErrors } from './scenario.sim.ts';

/**
 * What a bot that starts after the first quest carries, so that it has something to do with every rule:
 * every tool, seeds, things to build with and things to set down. No pickaxe: nothing in the game gives one.
 */
export const BOT_KIT: Readonly<Record<ItemId, number>> = {
  axe: 1, hoe: 1, watering_can: 1, wheat_seeds: 12, plank: 40, fence: 12, bed: 1, berry: 6, sprinkler: 2,
  workbench: 1, chest: 1, lamp: 3, dirt: 10, oak_log: 10, fiber: 8, moss_tuft: 4,
};

/** Where a bot starts, by its seed: a new game with an empty bag, or the start of a later quest with the kit. */
const STARTS: readonly (QuestId | null)[] = [null, 'roof', 'leaftail', 'bread', 'festival'];

/** Places the bot walks toward now and then, so it does not spend its life in the woods. */
const PLACES: readonly string[] = ['grant.center', 'grant.stone', 'grant.rocks', 'dead.garden', 'town.gate', 'town.square', 'river.bank'];
/** Further than this from the grant, the bot turns back. */
const LEASH = 140;
/** Events kept in `heard` and `said`. A bot plays for hours of game time. */
const REMEMBER = 64;

export interface Failure {
  /** The bot step whose input broke something. */
  step: number;
  what: string;
  /** The input pressed at that step. */
  input: Input;
}

export interface BotRun {
  readonly seed: number;
  /** Where it started, in words. */
  readonly start: string;
  /** The game now. A reload makes a new one. */
  readonly play: Play;
  /** Bot steps played. */
  readonly step: number;
  /** The first thing that broke, or null. The bot stops there. */
  readonly failure: Failure | null;
  /** The input of the last step. */
  readonly last: Input | null;
  /** How often each event was sent, by name, so a run can show what the bot got done. Footsteps, flag changes and bag changes are left out. */
  readonly did: Readonly<Record<string, number>>;
  /** Plays up to this many more steps and stops at the first failure. Returns the steps it played. */
  advance(steps: number): number;
}

export function startBot(seed: number): BotRun {
  const quest = STARTS[Math.abs(Math.floor(seed)) % STARTS.length];
  let play = begin(seed, quest ? { quest, give: BOT_KIT } : undefined, REMEMBER);
  // Its own stream of numbers, apart from the game's.
  const random = createRandom((seed ^ 0x9e3779b9) >>> 0);
  const invariants = createInvariants({ body: true });
  const queue: Input[] = [];
  /** A long walk to one place: where, the steps left for it, how near is there, and what to do there. */
  const errand = { on: false, to: { x: 0, z: 0 } as { x: number; z: number }, left: 0, within: 2, soft: false, there: (): void => undefined };
  let step = 0;
  let failure: Failure | null = null;
  let last: Input | null = null;
  const did: Record<string, number> = {};
  const count = (p: Play): void => {
    p.game.events.onAny((name) => {
      if (name !== 'footstep' && name !== 'flag.changed' && name !== 'inventory.changed') did[name] = (did[name] ?? 0) + 1;
    });
  };
  count(play);

  const int = (below: number): number => Math.floor(random() * below);
  const turn = (): number => random() * Math.PI * 2;
  const still = (steps: number): void => { for (let i = 0; i < steps; i++) queue.push({ do: 'keys' }); };

  /** The keys held to walk at an angle, as a facing: 0 north, clockwise seen from above. */
  function walk(angle: number, steps: number, soft: boolean, jump: boolean): void {
    const keys: Input = { do: 'keys', x: Math.sin(angle), z: -Math.cos(angle), ...(soft ? { soft } : {}), ...(jump ? { jump } : {}) };
    for (let i = 0; i < steps; i++) queue.push(keys);
  }

  const toward = (x: number, z: number): number => Math.atan2(x - play.game.player.pos.x, -(z - play.game.player.pos.z));

  /** The look from the hero's eyes at a point. */
  function lookAt(x: number, y: number, z: number): { yaw: number; pitch: number } {
    const pos = play.game.player.pos;
    const dx = x - pos.x, dz = z - pos.z;
    return { yaw: Math.atan2(dx, -dz), pitch: Math.atan2(y - (pos.y + EYE_HEIGHT), Math.hypot(dx, dz)) };
  }

  /** A look at the ground and the things within reach, mostly down and ahead, now and then level or up. */
  function near(): { yaw: number; pitch: number } {
    const yaw = play.game.player.facing + (random() - 0.5) * 2.6;
    return { yaw, pitch: random() < 0.2 ? -0.2 + random() * 0.8 : -0.15 - random() * 1.25 };
  }

  /** A look at ground up to twenty blocks off, for the pointer in build mode. */
  function far(): { yaw: number; pitch: number } {
    return { yaw: play.game.player.facing + (random() - 0.5) * 3, pitch: -0.08 - random() * 1.1 };
  }

  /** Puts an item of the bag in the hand: its number key, after a drag to a quick slot when it lies deeper. False when the bag has none. */
  function hand(item: ItemId): boolean {
    const at = play.sys.inventory.slots.findIndex((slot) => slot?.id === item);
    if (at < 0) return false;
    if (at < 9) queue.push({ do: 'slot', index: at });
    else {
      const to = int(9);
      queue.push({ do: 'move', from: at, to }, { do: 'slot', index: to });
    }
    return true;
  }

  /** Somewhere worth walking to: a person, a pet, something placed, a crop, a berry bush, a named place. */
  function somewhere(): { x: number; z: number } {
    const { sys } = play;
    const spots: { x: number; z: number }[] = [];
    for (const npc of sys.people.all()) spots.push(npc.pos);
    for (const pet of sys.pets.all()) spots.push(pet.pos);
    for (const placed of sys.placeables.all()) spots.push({ x: placed.x + 0.5, z: placed.z + 0.5 });
    const crops = sys.crops.all();
    if (crops.length > 0) spots.push({ x: crops[0].x + 0.5, z: crops[0].z + 0.5 });
    for (const name of PLACES) spots.push(sys.region.place(name).at);
    for (const bush of sys.region.berryBushes?.() ?? []) spots.push(bush);
    return spots[int(spots.length)];
  }

  /** The nearest standing tree, with the middle of its trunk as a point to walk to. */
  function tree(): { x: number; y: number; z: number } | null {
    const pos = play.game.player.pos;
    let best: { x: number; y: number; z: number } | null = null, bestDistance = Infinity;
    for (const one of play.sys.trees.all()) {
      if (!one.standing) continue;
      const d = Math.hypot(one.x + 0.5 - pos.x, one.z + 0.5 - pos.z);
      if (d < bestDistance) { best = { x: one.x + 0.5, y: one.y, z: one.z + 0.5 }; bestDistance = d; }
    }
    return best;
  }

  /**
   * Starts a long walk. `to` is kept, not copied, so a walk to a pet or a person follows them. `there` fills
   * the queue with what to do on arrival.
   */
  function startErrand(to: { x: number; z: number }, steps: number, within: number, soft: boolean, there: () => void): void {
    errand.on = true;
    errand.to = to;
    errand.left = steps;
    errand.within = within;
    errand.soft = soft;
    errand.there = there;
  }

  /** One leg of the errand: up to forty steps toward it, hopping over what is in the way. */
  function errandLeg(): void {
    const pos = play.game.player.pos;
    const away = Math.hypot(errand.to.x - pos.x, errand.to.z - pos.z);
    if (away <= errand.within) {
      errand.on = false;
      errand.there();
      if (queue.length === 0) still(1);
      return;
    }
    if (errand.left <= 0) {
      errand.on = false;
      still(1);
      return;
    }
    const pace = errand.soft ? 0.1 : 0.22;
    const steps = Math.max(1, Math.min(40, errand.left, Math.ceil((away - errand.within) / pace)));
    errand.left -= steps;
    walk(toward(errand.to.x, errand.to.z) + (random() - 0.5) * 0.3, steps, errand.soft, !errand.soft && random() < 0.5);
  }

  /** Tills, plants and waters a few cells of the ground ahead, or only the first part of that. */
  function farm(): void {
    const pos = play.game.player.pos;
    const ground = Math.floor(pos.y + 0.01) - 1;
    const cells: { yaw: number; pitch: number }[] = [];
    const angle = play.game.player.facing + (random() - 0.5);
    const count = 1 + int(6);
    for (let i = 0; i < count; i++) {
      // A row ahead, a block and a half from the feet, with a second row beside it now and then.
      const along = 1.5 + (i % 3), side = i >= 3 ? 1 : 0;
      const x = Math.floor(pos.x + Math.sin(angle) * along + Math.cos(angle) * side), z = Math.floor(pos.z - Math.cos(angle) * along + Math.sin(angle) * side);
      cells.push(lookAt(x + 0.5, ground + 1, z + 0.5));
    }
    const parts = 1 + int(3);
    const tools: ItemId[] = ['hoe', 'wheat_seeds', 'watering_can'];
    for (let part = 0; part < parts; part++) {
      if (!hand(tools[part])) return;
      for (const cell of cells) queue.push({ do: 'click', button: 'secondary', ...cell });
    }
  }

  /** Walks to a crop and clicks it with the primary button, ripe or not. */
  function harvest(): boolean {
    const crops = play.sys.crops.all();
    if (crops.length === 0) return false;
    const crop = crops[int(crops.length)];
    startErrand({ x: crop.x + 0.5, z: crop.z + 0.5 }, 600, 2.5, false, () => {
      for (const one of play.sys.crops.all()) {
        if (Math.hypot(one.x + 0.5 - play.game.player.pos.x, one.z + 0.5 - play.game.player.pos.z) < 4) queue.push({ do: 'click', button: 'primary', ...lookAt(one.x + 0.5, one.y + 1, one.z + 0.5) });
      }
    });
    return true;
  }

  /** Walks to the nearest tree and holds the button on its trunk, with the axe when the bag has one. */
  function fell(): boolean {
    const trunk = tree();
    if (!trunk) return false;
    startErrand(trunk, 600, 2.5, false, () => {
      if (random() < 0.7) hand('axe');
      const at = lookAt(trunk.x, trunk.y + 1.2, trunk.z);
      queue.push({ do: 'click', button: 'primary', ...at });
      const holds = 20 + int(70);
      for (let i = 0; i < holds; i++) queue.push({ do: 'hold', ...at });
    });
    return true;
  }

  /** Walks softly up to a wild pet, holds a treat out at its own feet and stands still. */
  function feed(): boolean {
    const pet = play.sys.pets.all().find((one) => !one.bonded);
    if (!pet || play.sys.inventory.count('berry') === 0) return false;
    startErrand(pet.pos, 1500, 2.4, true, () => {
      if (!hand('berry')) return;
      queue.push(random() < 0.5 ? { do: 'click', button: 'secondary', yaw: play.game.player.facing, pitch: -1.45 } : { do: 'interact' });
      still(30 + int(60));
    });
    return true;
  }

  /** Walks under the nearest tree and sets the bed down there: a tree's leaves are roof enough to sleep under. */
  function camp(): boolean {
    const trunk = tree();
    if (!trunk || play.sys.inventory.count('bed') === 0) return false;
    startErrand(trunk, 600, 3, false, () => {
      if (!hand('bed')) return;
      for (let i = 0; i < 3; i++) queue.push({ do: 'click', button: 'secondary', ...near() });
    });
    return true;
  }

  /**
   * Out of a hole the hero cannot walk out of: a block set under the feet at the top of a jump, as a player
   * does. Under a roof of earth, the roof is dug away first. False when the hero is in no hole.
   */
  function climbOut(): boolean {
    const { world, sys, game } = play;
    const pos = game.player.pos;
    const x = Math.floor(pos.x), z = Math.floor(pos.z), feet = Math.floor(pos.y + 0.01);
    let walled = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      // A side is a wall when the hero can neither walk nor step up into it.
      if (!sys.nav.standable(x + dx, feet, z + dz) && !sys.nav.standable(x + dx, feet + 1, z + dz)) walled++;
    }
    if (walled < 4 || game.player.inWater) return false;
    if (world.heightAt(x, z) > feet) {
      const up = { yaw: game.player.facing, pitch: 1.5 };
      queue.push({ do: 'click', button: 'primary', ...up });
      for (let i = 0; i < 24; i++) queue.push({ do: 'hold', ...up });
      return true;
    }
    if (!hand('dirt') && !hand('plank')) return false;
    queue.push({ do: 'keys', jump: true });
    still(4);
    queue.push({ do: 'click', button: 'secondary', yaw: game.player.facing, pitch: -1.57 });
    still(6);
    return true;
  }

  function planBuild(): void {
    const roll = random() * 100;
    if (roll < 18) queue.push({ do: 'build', on: false });
    else if (roll < 33) queue.push({ do: 'slot', index: int(9) });
    else if (roll < 48) walk(turn(), 5 + int(40), false, false);
    else if (roll < 56) queue.push({ do: 'undo' });
    else if (roll < 62) queue.push({ do: 'point', ...far() }, { do: 'turn', direction: random() < 0.5 ? 1 : -1 });
    else {
      // A stroke: the button down on one cell, a drag, and up. Now and then it is dropped, or the hand changes under it.
      const from = far();
      queue.push({ do: 'point', ...from }, { do: 'press' });
      const drags = 1 + int(3);
      for (let i = 0; i < drags; i++) queue.push({ do: 'point', yaw: from.yaw + (random() - 0.5) * 0.9, pitch: Math.min(-0.05, from.pitch + (random() - 0.5) * 0.4) });
      const end = random();
      if (end < 0.08) queue.push({ do: 'slot', index: int(9) });
      if (end < 0.16) walk(turn(), 3 + int(10), false, false);
      queue.push(end > 0.85 ? { do: 'cancel' } : { do: 'release' });
    }
  }

  /** Chooses what to do next and fills the queue with its presses. */
  function plan(): void {
    const { sys, game } = play;
    const pos = game.player.pos;
    if (sys.build.active) return planBuild();
    if (random() < 0.6 && climbOut()) return;
    if (errand.on && random() < 0.85) return errandLeg();
    if (random() < 0.003) {
      queue.push({ do: 'reload' });
      return;
    }

    const home = sys.region.place('grant.center').at;
    if (!errand.on && Math.hypot(pos.x - home.x, pos.z - home.z) > LEASH) return startErrand(home, 800, 3, false, () => undefined);
    // In the evening, a walk to a bed and E beside it: a night's sleep moves the clock, the crops and the weather.
    const time = game.clock.timeOfDay;
    if (!errand.on && (time >= EVENING || time < DAWN) && random() < 0.25) {
      const bed = sys.placeables.all().find((placed) => placed.kind === 'bed');
      if (bed) return startErrand({ x: bed.x + 0.5, z: bed.z + 0.5 }, 600, 2.2, false, () => { queue.push({ do: 'interact' }); });
      if (camp()) return;
    }

    const roll = random() * 100;
    if (roll < 22) {
      const to = random() < 0.45 ? somewhere() : null;
      walk(to ? toward(to.x, to.z) + (random() - 0.5) * 0.4 : turn(), 10 + int(110), random() < 0.2, random() < 0.2);
    } else if (roll < 26) {
      // Now and then all the way: to town, to the garden, to a person. E on arrival, more often than not.
      const act = random() < 0.6;
      startErrand(somewhere(), 900, 2, false, () => { if (act) queue.push({ do: 'interact' }); });
    } else if (roll < 38) {
      // The secondary button: place, till, plant, water, offer, use.
      if (random() < 0.6) queue.push({ do: 'slot', index: int(9) });
      const clicks = 1 + int(5);
      for (let i = 0; i < clicks; i++) queue.push({ do: 'click', button: 'secondary', ...near() });
    } else if (roll < 45) {
      // The primary button held on one spot: a break, a thing taken back up.
      if (random() < 0.4) queue.push({ do: 'slot', index: int(9) });
      const at = near();
      const hit = play.aim(at.yaw, at.pitch);
      // Ground below the feet is mostly left alone: a hero who digs straight down spends the day in a hole.
      const down = hit !== null && hit.y < Math.floor(pos.y + 0.01) && !sys.placeables.at(hit.x, hit.y, hit.z) && !sys.crops.at(hit.x, hit.y, hit.z);
      queue.push({ do: 'click', button: 'primary', ...at });
      const holds = down && random() < 0.85 ? 2 : 8 + int(72);
      for (let i = 0; i < holds; i++) queue.push({ do: 'hold', ...at });
    } else if (roll < 54) {
      farm();
    } else if (roll < 59) {
      if (!harvest()) farm();
    } else if (roll < 64) {
      if (!fell()) still(5);
    } else if (roll < 69) {
      if (!feed()) queue.push({ do: 'interact' });
    } else if (roll < 71) {
      if (!camp()) still(5);
    } else if (roll < 75) {
      queue.push({ do: 'slot', index: int(9) });
    } else if (roll < 78) {
      const from = int(36), to = int(36);
      queue.push(random() < 0.3 ? { do: 'move', from, to, count: 1 + int(6) } : { do: 'move', from, to });
    } else if (roll < 86) {
      queue.push({ do: 'interact' });
    } else if (roll < 91) {
      const open = sys.crafting.available();
      queue.push(open.length > 0 ? { do: 'craft', recipe: open[int(open.length)].id } : { do: 'keys' });
    } else if (roll < 96) {
      queue.push({ do: 'build', on: true });
    } else {
      still(1 + int(40));
    }
  }

  function next(): Input {
    const talk = play.sys.talk;
    if (talk.active) {
      // A conversation holds the player: the only keys that do anything click it on.
      queue.length = 0;
      const line = talk.current();
      if (random() < 0.3) return { do: 'keys' };
      return line && line.choices.length > 0 ? { do: 'say', choice: int(line.choices.length) } : { do: 'say' };
    }
    if (queue.length === 0) plan();
    return queue.shift() ?? { do: 'keys' };
  }

  /** The first place in the rules that a thrown error passed through, for the message. */
  function thrownAt(error: unknown): string {
    const stack = error instanceof Error ? error.stack ?? '' : '';
    const frame = /src\/(?:game|features|content|engine)\/[^\s):]+:\d+/.exec(stack);
    return frame ? ` at ${frame[0]}` : '';
  }

  return {
    seed,
    start: quest ? `the start of the quest ${quest}, with the kit` : 'a new game with an empty bag',
    get play() { return play; },
    get step() { return step; },
    get failure() { return failure; },
    get last() { return last; },
    did,

    advance(steps) {
      const ears = listenForErrors();
      let played = 0;
      try {
        while (played < steps && !failure) {
          const input = next();
          last = input;
          step++;
          played++;
          let what: string | null = null;
          try {
            const before = play.steps;
            const after = press(play, input);
            if (after !== play) {
              did.reload = (did.reload ?? 0) + 1;
              count(after);
            }
            play = after;
            if (play.steps === before) play.tick();
            what = ears.heard.length > 0 ? `a system logged an error: ${ears.heard[0]}` : invariants.check(play);
          } catch (error) {
            what = `it threw${thrownAt(error)}: ${error instanceof Error ? error.message : String(error)}`;
          }
          if (what) failure = { step, what: `${what} [${where(play)}]`, input };
        }
      } finally {
        ears.stop();
      }
      return played;
    },
  };
}
