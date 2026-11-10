// The first part, played the way a player would play it, as a list of small steps over the play harness.
// Each step reads everything it needs from the game it is handed, so a test can save after any step,
// load the save into a fresh world and kernel, and go on with the next step there.
//
// No step gives an item, writes a flag or skips a quest. A step that cannot go on throws, with the
// clock and the last toasts in the message, because every such stop is a finding about the game.

import { blockId } from '../../content/blocks.ts';
import type { Vec3 } from '../../engine/types.ts';
import { SOLID } from '../../features/world/chunk.sim.ts';
import { reachDistance } from '../actions/index.sim.ts';
import type { NpcId, PetState } from '../api.sim.ts';
import { REGION } from '../content/region.ts';
import { distance2d } from '../move.sim.ts';
import { TOO_EARLY_TOAST } from '../placeables/index.sim.ts';
import { EVENING } from '../time/index.sim.ts';
import type { Play } from './harness.sim.ts';

export interface Step {
  /** The quest this step belongs to: `plot`, `roof`, `leaftail`, `bread` or `festival`. */
  quest: string;
  name: string;
  run(p: Play): void;
}

const LOGS = new Set([blockId('oak_log'), blockId('birch_log'), blockId('pine_log')]);
const LEAVES = new Set([blockId('oak_leaves'), blockId('pine_needles')]);
const GRASS = blockId('grass');
const TILLED = blockId('tilled_soil');
const PLANK = blockId('oak_plank');

type Face = readonly [number, number, number];
const TOP: Face = [0, 1, 0];

/** The dirt path from the grant stone to the town gate, as the points a player would walk through. */
export const PATH_TO_TOWN = REGION.paths[0].points.map(([x, z]) => ({ x, z }));
const PATH_TO_GRANT = [...PATH_TO_TOWN].reverse();

/** Walks into town from wherever the player is: to the grant stone first when the town is far, then along the path to the gate. */
export function walkToTown(p: Play): void {
  const gate = p.sys.region.place('town.gate').at, stone = p.sys.region.place('grant.stone').at;
  const at = p.game.player.pos;
  // Already inside the town.
  if (at.x >= gate.x) return;
  if (distance2d(at, gate) < 60) {
    must(p, p.walkTo('town.gate', { within: 2, seconds: 300 }), 'could not walk to the town gate');
    return;
  }
  // Join the path where the player is nearest to it: at the stone, or further along.
  if (at.x < stone.x + 6) must(p, p.walkTo('grant.stone', { within: 3, seconds: 300 }), 'could not walk to the grant stone');
  const ahead = PATH_TO_TOWN.filter((point) => point.x > p.game.player.pos.x + 4);
  must(p, p.walkTo('town.gate', { via: ahead, within: 2, seconds: 400 }), 'could not walk the path to the town gate');
}

/** Where the game is, for the message of a step that failed. */
function where(p: Play): string {
  const { clock, player, flags } = p.game;
  const quest = p.sys.quests.tracked();
  const open = quest?.steps.find((step) => !step.done);
  return [
    `day ${clock.day} at ${clock.timeOfDay.toFixed(3)}, ${clock.seconds.toFixed(1)} s, step ${p.steps}`,
    `player at ${player.pos.x.toFixed(1)}, ${player.pos.y.toFixed(1)}, ${player.pos.z.toFixed(1)}${player.busy ? ' (busy)' : ''}`,
    `quest ${quest ? `${quest.id}.${open?.id ?? '?'}` : 'none'} (flag step ${String(flags.get(`quest.${quest?.id ?? ''}.step`))})`,
    `last said: ${p.said.slice(-4).join(' | ') || 'nothing'}`,
  ].join('; ');
}

export function must(p: Play, ok: unknown, what: string): asserts ok {
  if (!ok) throw new Error(`${what}. [${where(p)}]`);
}

/** The step the quest system has open, as `quest.step`. */
export const openStep = (p: Play): string => {
  const quest = p.sys.quests.tracked();
  return quest ? `${quest.id}.${String(p.game.flags.get(`quest.${quest.id}.step`))}` : '';
};

function expectStep(p: Play, step: string): void {
  // The quest system checks on the step after an event, and twice a second besides.
  p.until(() => openStep(p) === step, 1.5);
  must(p, openStep(p) === step, `the open step should be ${step} and is ${openStep(p)}`);
}

/** The side of a block that faces the player, as a step out of the block. */
function faceToward(p: Play, x: number, z: number): Face {
  const dx = p.game.player.pos.x - (x + 0.5), dz = p.game.player.pos.z - (z + 0.5);
  return Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx), 0, 0] : [0, 0, Math.sign(dz)];
}

/** Walks up to someone, checks the prompt names them, presses E and clicks through, taking this choice. Returns the lines. */
export function talkTo(p: Play, id: NpcId, choice = 0): string[] {
  const npc = p.sys.people.get(id);
  must(p, npc, `nobody is called ${id}`);
  const want = `Talk to ${npc.name}`;
  // Closer each time, as a player steps in when the prompt names somebody else who stands near.
  for (const within of [1.7, 1.2, 0.8, 0.3]) {
    must(p, p.walkTo(npc.pos, { within, seconds: 240 }), `could not walk up to ${id} at ${npc.pos.x.toFixed(1)}, ${npc.pos.y}, ${npc.pos.z.toFixed(1)} (${npc.place})`);
    if (p.prompt() === want) break;
  }
  must(p, p.prompt() === want, `beside ${id} the prompt should be "${want}" and is "${String(p.prompt())}"`);
  must(p, p.interact() === want && p.sys.talk.active, `E beside ${id} did not start a conversation`);
  const lines = p.talkThrough(choice);
  must(p, !p.sys.talk.active && !p.game.player.busy, `the conversation with ${id} did not end`);
  p.advance(0.1);
  return lines;
}

// ------------------------------------------------------------------------------------------ wood and fiber

interface Trunk { x: number; y: number; z: number; logs: number }

/** Every tree the player may cut within 44 blocks: a log column of 3 or more on natural ground, outside the town. */
function trunks(p: Play): Trunk[] {
  const { world } = p, at = p.game.player.pos;
  const rocks = p.sys.region.place('grant.rocks').at;
  const found: Trunk[] = [];
  for (let x = Math.floor(at.x) - 44; x <= Math.floor(at.x) + 44; x++) {
    for (let z = Math.floor(at.z) - 44; z <= Math.floor(at.z) + 44; z++) {
      if (!world.isLoaded(x, z)) continue;
      for (let y = world.heightAt(x, z) - 1; y > 1; y--) {
        if (!LOGS.has(world.getBlock(x, y, z)) || LOGS.has(world.getBlock(x, y - 1, z))) continue;
        let logs = 0;
        while (LOGS.has(world.getBlock(x, y + logs, z))) logs++;
        const under = world.getBlock(x, y - 1, z);
        if (logs >= 3 && SOLID[under] && !LEAVES.has(under) && !p.sys.region.isProtected(x, y, z)) found.push({ x, y, z, logs });
        break;
      }
    }
  }
  // The oaks over the mossy rocks are the mosslings' shade. A player leaves them standing.
  return found
    .filter((t) => Math.hypot(t.x + 0.5 - rocks.x, t.z + 0.5 - rocks.z) > 12)
    .sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
}

/** Holds the button on the leaves in reach, nearest first, until the bag has `want` fiber or none are left. */
function pickLeaves(p: Play, want: number): void {
  const { world } = p, player = p.game.player;
  for (let tries = 0; tries < 60 && p.count('fiber') < want; tries++) {
    let best: Vec3 | null = null, bestD = 4.8;
    const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
    for (let x = px - 5; x <= px + 5; x++) {
      for (let z = pz - 5; z <= pz + 5; z++) {
        for (let y = py; y <= py + 7; y++) {
          if (!LEAVES.has(world.getBlock(x, y, z))) continue;
          const d = reachDistance(player, x, y, z, x + 1, y + 1, z + 1);
          if (d < bestD) { bestD = d; best = { x, y, z }; }
        }
      }
    }
    if (!best) return;
    must(p, p.dig(best.x, best.y, best.z, [0, -1, 0]), `leaves in reach at ${best.x}, ${best.y}, ${best.z} did not break`);
  }
}

/** Cuts real trees near the player until the bag holds `logs` logs and `fiber` fiber. */
function gather(p: Play, logs: number, fiber: number): void {
  must(p, p.take('axe'), 'there is no axe in the bag to take in hand');
  for (let trees = 0; trees < 12 && (p.count('oak_log') < logs || p.count('fiber') < fiber); trees++) {
    const tree = trunks(p)[0];
    must(p, tree, `no tree left to cut within 44 blocks, with ${p.count('oak_log')} logs and ${p.count('fiber')} fiber`);
    const spot = p.sys.nav.near({ x: tree.x + 0.5, y: tree.y, z: tree.z + 0.5 }, 1.5, (x, z) => x === tree.x && z === tree.z);
    must(p, spot, `nowhere to stand beside the tree at ${tree.x}, ${tree.z}`);
    must(p, p.walkTo(spot, { within: 0.3, seconds: 120 }), `could not walk to the tree at ${tree.x}, ${tree.z}`);
    for (let y = tree.y; LOGS.has(p.world.getBlock(tree.x, y, tree.z)); y++) {
      const before = p.count('oak_log');
      if (!p.dig(tree.x, y, tree.z, faceToward(p, tree.x, tree.z))) {
        // Too high to reach from the ground. The rest of the trunk stays.
        must(p, y > tree.y, `the lowest log of the tree at ${tree.x}, ${tree.y}, ${tree.z} did not break`);
        break;
      }
      must(p, p.count('oak_log') === before + 1, 'a log broke and gave no wood');
    }
    pickLeaves(p, fiber);
  }
  must(p, p.count('oak_log') >= logs, `only ${p.count('oak_log')} logs after a dozen trees`);
  must(p, p.count('fiber') >= fiber, `only ${p.count('fiber')} fiber after a dozen trees`);
}

// ------------------------------------------------------------------------------------------ the shelter

/** Where the hut goes: the bed's block, a few blocks north-west of the standing stone, and the height of the feet there. */
function hut(p: Play): { x: number; y: number; z: number } {
  const g = p.sys.region.grant();
  return { x: g.x + g.width - 6, y: p.sys.region.place('grant.center').at.y, z: g.z + g.depth - 8 };
}

/** Uses the held item on a block face and checks that a block of `id` now stands in front of that face. */
function set(p: Play, item: string, x: number, y: number, z: number, face: Face, id: number): void {
  must(p, p.take(item), `there is no ${item} in the bag`);
  const used = p.use(x, y, z, face);
  const [nx, ny, nz] = face;
  must(p, used && p.world.getBlock(x + nx, y + ny, z + nz) === id, `${item} did not go down at ${x + nx}, ${y + ny}, ${z + nz}`);
}

// ------------------------------------------------------------------------------------------ the leaftail

function leaftail(p: Play): PetState {
  const pet = p.sys.pets.all().find((one) => one.kind === 'leaftail');
  must(p, pet, 'there is no leaftail');
  return pet;
}

/** Walks to a point, softly whenever the wild leaftail is near, as a player does once the hint has told them. */
function walkCarefully(p: Play, goal: Vec3, within: number): boolean {
  const pet = leaftail(p), player = p.game.player;
  const close = (): boolean => !pet.bonded && distance2d(pet.pos, player.pos) < 9;
  const there = (): boolean => distance2d(goal, player.pos) <= within;
  for (let legs = 0; legs < 40 && !there(); legs++) {
    const soft = close();
    if (!p.walkTo(goal, { soft, within, seconds: 180, until: () => close() !== soft })) return false;
  }
  return there();
}

/** Holds a berry out to the leaftail and stands still until it has eaten. `byKey` presses E instead of clicking. */
function feed(p: Play, byKey: boolean): void {
  const pet = leaftail(p), player = p.game.player;
  const before = pet.trust;
  for (let tries = 0; tries < 8; tries++) {
    must(p, p.walkTo(pet.pos, { soft: true, within: 2.2, seconds: 120 }), 'could not walk softly up to the leaftail');
    if (byKey) {
      must(p, p.prompt() === 'Offer a berry', `beside the leaftail the prompt should be "Offer a berry" and is "${String(p.prompt())}"`);
      p.interact();
    } else {
      must(p, p.take('berry'), 'there is no berry in the bag');
      // The berry is held out with the secondary button on the ground at the player's feet.
      p.use(Math.floor(player.pos.x), Math.floor(player.pos.y) - 1, Math.floor(player.pos.z));
    }
    if (p.until(() => pet.trust > before, 6)) {
      // It eats for three seconds and takes nothing more until it is done.
      p.advance(3.2);
      return;
    }
  }
  must(p, false, `the leaftail did not take a berry in eight tries (trust ${pet.trust}, startled ${String(pet.startled)}, ${distance2d(pet.pos, player.pos).toFixed(1)} blocks away)`);
}

// ------------------------------------------------------------------------------------------ the field

/** The twelve soil blocks of the field, four by three, in the middle of the grant. */
function field(p: Play): { cells: { x: number; y: number; z: number }[]; stand: Vec3; water: { x: number; z: number }[] } {
  const c = p.sys.region.place('grant.center').at;
  const x0 = Math.floor(c.x) - 4, z0 = Math.floor(c.z) - 2, y = c.y - 1;
  const cells: { x: number; y: number; z: number }[] = [];
  for (let x = x0; x < x0 + 4; x++) for (let z = z0; z < z0 + 3; z++) cells.push({ x, y, z });
  return {
    cells,
    // Two blocks south of the field's middle: every cell is in reach and none is under the feet.
    stand: { x: x0 + 2.5, y: c.y, z: z0 + 4.5 },
    // The can wets three by three, so two uses cover four by three.
    water: [{ x: x0 + 1, z: z0 + 1 }, { x: x0 + 2, z: z0 + 1 }],
  };
}

function water(p: Play): void {
  const f = field(p);
  must(p, p.take('watering_can'), 'there is no watering can in the bag');
  for (const at of f.water) must(p, p.use(at.x, f.cells[0].y, at.z), `the can did not water the soil at ${at.x}, ${at.z}`);
}

/** Plants every seed the bag holds on the field's bare soil. Returns how many went in. */
function plant(p: Play): number {
  const f = field(p);
  let planted = 0;
  for (const cell of f.cells) {
    if (p.count('wheat_seeds') === 0) break;
    if (p.sys.crops.at(cell.x, cell.y, cell.z)) continue;
    must(p, p.take('wheat_seeds'), 'the seeds are in the bag and cannot be taken in hand');
    const before = p.count('wheat_seeds');
    p.use(cell.x, cell.y, cell.z);
    must(p, p.sys.crops.at(cell.x, cell.y, cell.z) && p.count('wheat_seeds') === before - 1, `a seed did not go into the soil at ${cell.x}, ${cell.z}`);
    planted++;
  }
  return planted;
}

// ------------------------------------------------------------------------------------------ the steps

export const STEPS: readonly Step[] = [
  // ---------------------------------------------------------------- 1. A plot of your own
  {
    quest: 'plot', name: 'meet Tamsin at the grant stone',
    run(p) {
      p.advance(0.5);
      expectStep(p, 'plot.meet');
      // The game opens two blocks from her: the prompt is there without a step taken.
      must(p, p.prompt() === 'Talk to Tamsin', `a new game should open on "Talk to Tamsin" and shows "${String(p.prompt())}"`);
      const lines = talkTo(p, 'tamsin');
      must(p, lines[0] === 'Twelve people have asked me for this plot.', `Tamsin's first line is "${lines[0]}"`);
      must(p, p.count('almanac') === 1 && p.count('axe') === 1, 'Tamsin should have given the Almanac and an axe');
      expectStep(p, 'plot.watch');
    },
  },
  {
    quest: 'plot', name: 'watch a mossling until both facts are learned',
    run(p) {
      must(p, p.walkTo('grant.rocks', { seconds: 60 }), 'could not walk to the mossy rocks');
      const page = (): string => (p.sys.almanac.page('mossling')?.facts ?? []).map((fact) => `${fact.id}:${fact.known ? 'known' : 'unknown'}`).join(' ');
      const done = p.until(() => p.sys.almanac.page('mossling')?.complete === true, 150);
      must(p, done, `the mossling page did not fill in 150 seconds of watching (${page()}, ${p.sys.creatures.all().length} creatures)`);
      expectStep(p, 'plot.tell');
    },
  },
  {
    quest: 'plot', name: 'tell Tamsin',
    run(p) {
      talkTo(p, 'tamsin');
      must(p, p.game.flags.is('plot.told'), 'telling Tamsin did not set plot.told');
    },
  },

  // ---------------------------------------------------------------- 2. A roof before dark
  {
    quest: 'roof', name: 'cut 12 logs and pick 3 fiber',
    run(p) {
      expectStep(p, 'roof.wood');
      gather(p, 12, 3);
      expectStep(p, 'roof.bench');
    },
  },
  {
    quest: 'roof', name: 'make planks and a workbench, and set it down',
    run(p) {
      // 4 for the bench, 6 for the bed, 12 for the shelter: 22 planks, so 6 logs.
      for (let i = 0; i < 6; i++) must(p, p.make('plank'), 'a log did not saw into planks by hand');
      must(p, p.make('workbench'), 'four planks did not make a workbench by hand');
      const h = hut(p);
      must(p, p.walkTo({ x: h.x + 0.5, y: h.y, z: h.z + 2.5 }, { within: 0.3, seconds: 120 }), 'could not walk to where the hut goes');
      must(p, p.take('workbench'), 'the workbench is not in the bag');
      must(p, p.use(h.x - 3, h.y - 1, h.z + 1), 'the workbench did not go down');
      must(p, p.sys.placeables.at(h.x - 3, h.y, h.z + 1)?.kind === 'workbench', 'no workbench stands where it was set down');
      expectStep(p, 'roof.shelter');
    },
  },
  {
    quest: 'roof', name: 'make a bed and build a shelter of planks over it',
    run(p) {
      const h = hut(p), g = h.y;
      must(p, p.walkTo({ x: h.x + 0.5, y: g, z: h.z + 2.5 }, { within: 0.3, seconds: 120 }), 'could not walk to the hut');
      must(p, p.make('bed'), `a bed could not be made beside the workbench (planks ${p.count('plank')}, fiber ${p.count('fiber')})`);
      // Walls three high on the west and north, two high on the east, the south side open.
      for (const [x, z, high] of [[h.x - 1, h.z, 3], [h.x - 1, h.z + 1, 3], [h.x, h.z - 1, 3], [h.x + 1, h.z, 2]] as const) {
        for (let i = 0; i < high; i++) set(p, 'plank', x, g - 1 + i, z, TOP, PLANK);
      }
      must(p, p.take('bed'), 'the bed is not in the bag');
      must(p, p.use(h.x, g - 1, h.z), 'the bed did not go down');
      must(p, p.sys.placeables.at(h.x, g, h.z)?.kind === 'bed', 'no bed stands where it was set down');
      // Under open sky the quest still waits.
      p.advance(1);
      must(p, openStep(p) === 'roof.shelter', 'a bed under open sky should not pass the shelter step');
      // The roof is what the quest asks for: one block over the bed, set out from the top of the west wall.
      set(p, 'plank', h.x - 1, g + 2, h.z, [1, 0, 0], PLANK);
      expectStep(p, 'roof.sleep');
    },
  },
  {
    quest: 'roof', name: 'wait for evening and sleep',
    run(p) {
      const h = hut(p), clock = p.game.clock;
      // The bed fills its block, so the player stands beside it, in the open doorway.
      must(p, p.walkTo({ x: h.x + 0.5, y: h.y, z: h.z + 1.5 }, { within: 0.25, seconds: 120 }), 'could not walk up to the bed');
      must(p, p.prompt() === 'Sleep', `beside the bed the prompt should be "Sleep" and is "${String(p.prompt())}"`);
      if (clock.timeOfDay < EVENING) {
        // Too early: the bed says so and the day goes on.
        p.interact();
        must(p, clock.day === 1 && p.said.at(-1) === TOO_EARLY_TOAST, `before evening the bed should say "${TOO_EARLY_TOAST}" and said "${String(p.said.at(-1))}"`);
        p.until(() => clock.timeOfDay >= EVENING, p.sys.time.dayLength);
      }
      must(p, p.sys.time.canSleep(), 'it is evening, the player stands beside a bed with a block over it, and canSleep() is false');
      const day = clock.day;
      p.interact();
      must(p, clock.day === day + 1 && p.heard.some((event) => event.name === 'slept'), 'E beside the bed in the evening did not sleep to the next morning');
    },
  },

  // ---------------------------------------------------------------- 3. Leaf and tail
  {
    quest: 'leaftail', name: 'walk to the dead garden',
    run(p) {
      expectStep(p, 'leaftail.find');
      const garden = p.sys.region.place('dead.garden').at;
      must(p, walkCarefully(p, garden, 9), 'could not walk to the dead garden');
      const pet = leaftail(p);
      must(p, distance2d(pet.pos, garden) < 8, `the leaftail should be tending the garden and is ${distance2d(pet.pos, garden).toFixed(1)} blocks from it`);
      p.advance(0.6);
      must(p, openStep(p) !== 'leaftail.find', 'ten blocks from the garden the find step is still open');
    },
  },
  {
    quest: 'leaftail', name: 'pick 3 berries',
    run(p) {
      const player = p.game.player;
      const bushes = [...(p.sys.region.berryBushes?.() ?? [])]
        .filter((bush) => distance2d(bush, player.pos) < 40)
        .sort((a, b) => distance2d(a, player.pos) - distance2d(b, player.pos));
      must(p, bushes.length >= 3, `only ${bushes.length} berry bushes within 40 blocks of the garden`);
      for (const bush of bushes) {
        if (p.count('berry') >= 3) break;
        if (!bush.ripe) continue;
        must(p, walkCarefully(p, { x: bush.x, y: bush.y, z: bush.z }, 1.2), `could not walk to the berry bush at ${bush.x}, ${bush.z}`);
        must(p, p.prompt() === 'Pick berries', `at a ripe bush the prompt should be "Pick berries" and is "${String(p.prompt())}"`);
        const before = p.count('berry');
        p.interact();
        must(p, p.count('berry') > before && !bush.ripe, 'picking a bush gave no berry');
      }
      must(p, p.count('berry') >= 3, `only ${p.count('berry')} berries after every bush near the garden`);
      p.advance(0.6);
      must(p, openStep(p) === 'leaftail.trust', `with 3 berries the open step should be leaftail.trust and is ${openStep(p)}`);
    },
  },
  {
    quest: 'leaftail', name: 'feed the leaftail twice',
    run(p) {
      const pet = leaftail(p);
      while (pet.trust < 2) feed(p, false);
      must(p, !pet.bonded, 'two berries should not bond it yet');
    },
  },
  {
    quest: 'leaftail', name: 'feed it a third time, and it bonds',
    run(p) {
      const pet = leaftail(p);
      // A bush or two more, should the bag have run out: a pick gives 1 or 2.
      for (const bush of p.sys.region.berryBushes?.() ?? []) {
        if (p.count('berry') >= 1) break;
        if (!bush.ripe || distance2d(bush, p.game.player.pos) > 40) continue;
        must(p, walkCarefully(p, { x: bush.x, y: bush.y, z: bush.z }, 1.2), `could not walk to the berry bush at ${bush.x}, ${bush.z}`);
        p.interact();
      }
      feed(p, true);
      must(p, pet.bonded && p.game.flags.is('pet.leaftail.bonded'), 'three berries did not bond the leaftail');
      must(p, p.sys.pets.companion()?.id === pet.id, 'the bonded leaftail is not the companion');
      expectStep(p, 'leaftail.show');
    },
  },
  {
    quest: 'leaftail', name: 'show it to Tamsin in Hollowmere',
    run(p) {
      const pet = leaftail(p);
      walkToTown(p);
      must(p, distance2d(pet.pos, p.game.player.pos) < 12, `the leaftail fell ${distance2d(pet.pos, p.game.player.pos).toFixed(1)} blocks behind on the path`);
      const lines = talkTo(p, 'tamsin');
      must(p, p.game.flags.is('leaftail.shown'), `showing the leaftail to Tamsin did not count. She said: ${lines.join(' / ')}`);
    },
  },

  // ---------------------------------------------------------------- 4. The queen's bread
  {
    quest: 'bread', name: 'meet Queen Maren in the granary',
    run(p) {
      // The gate was passed on the way to Tamsin, so the walk to town is already done. A game that was
      // skipped to this quest has not been there yet.
      if (openStep(p) === 'bread.town') walkToTown(p);
      expectStep(p, 'bread.queen');
      talkTo(p, 'maren');
      must(p, p.game.flags.is('bread.asked'), 'Maren did not ask for the wheat');
      expectStep(p, 'bread.seeds');
    },
  },
  {
    quest: 'bread', name: 'get the hoe, the can and 12 seeds from Gus',
    run(p) {
      const seeds = p.count('wheat_seeds');
      talkTo(p, 'gus');
      must(p, p.count('hoe') === 1 && p.count('watering_can') === 1, 'Gus should have given a hoe and a watering can');
      must(p, p.count('wheat_seeds') === seeds + 12, `Gus should have given 12 seeds and gave ${p.count('wheat_seeds') - seeds}`);
      expectStep(p, 'bread.grow');
    },
  },
  {
    quest: 'bread', name: 'till a field on the grant, plant and water',
    run(p) {
      must(p, p.walkTo('town.gate', { within: 2, seconds: 300 }), 'could not walk back to the town gate');
      must(p, p.walkTo('grant.stone', { via: PATH_TO_GRANT, within: 3, seconds: 400 }), 'could not walk the path back to the grant');
      const f = field(p);
      must(p, p.walkTo(f.stand, { within: 0.3, seconds: 120 }), 'could not walk to the field');
      must(p, p.take('hoe'), 'the hoe is not in the bag');
      for (const cell of f.cells) {
        must(p, p.world.getBlock(cell.x, cell.y, cell.z) === GRASS, `the grant's meadow at ${cell.x}, ${cell.z} is not grass`);
        must(p, p.use(cell.x, cell.y, cell.z) && p.world.getBlock(cell.x, cell.y, cell.z) === TILLED, `the hoe did not till ${cell.x}, ${cell.z}`);
      }
      must(p, plant(p) === 12, 'twelve seeds should have gone into twelve soil blocks');
      water(p);
      for (const cell of f.cells) must(p, (p.sys.crops.at(cell.x, cell.y, cell.z)?.wet ?? 0) > 0, `the crop at ${cell.x}, ${cell.z} is dry after watering`);
    },
  },
  {
    quest: 'bread', name: 'harvest and replant until there are 20 wheat',
    run(p) {
      const f = field(p);
      for (let rounds = 0; rounds < 6 && p.count('wheat') < 20; rounds++) {
        must(p, p.walkTo(f.stand, { within: 0.3, seconds: 120 }), 'could not walk to the field');
        if (p.sys.crops.all().length === 0) {
          must(p, plant(p) > 0, `there is no wheat in the ground and no seed in the bag, with ${p.count('wheat')} wheat`);
          water(p);
        }
        // Wet soil grows a stage in 45 seconds. Water lasts three minutes, so a dry crop is watered again.
        for (let waited = 0; waited < 600 && p.sys.crops.all().some((crop) => !crop.state.ripe); waited += 5) {
          if (p.sys.crops.all().some((crop) => !crop.state.ripe && crop.state.wet <= 0)) water(p);
          p.advance(5);
        }
        must(p, p.sys.crops.all().every((crop) => crop.state.ripe), 'the wheat was not ripe after ten minutes of wet soil');
        for (const cell of f.cells) {
          if (!p.sys.crops.at(cell.x, cell.y, cell.z)?.ripe) continue;
          const before = p.count('wheat');
          must(p, p.hit(cell.x, cell.y, cell.z), `the primary button did not harvest the ripe wheat at ${cell.x}, ${cell.z}`);
          must(p, p.count('wheat') === before + 2, `a ripe wheat gave ${p.count('wheat') - before} wheat, not 2`);
        }
        if (p.count('wheat') < 20) {
          plant(p);
          water(p);
        }
      }
      must(p, p.count('wheat') >= 20, `only ${p.count('wheat')} wheat after six harvests`);
      expectStep(p, 'bread.deliver');
    },
  },
  {
    quest: 'bread', name: 'bring 20 wheat to Maren',
    run(p) {
      walkToTown(p);
      const wheat = p.count('wheat');
      const lines = talkTo(p, 'maren');
      must(p, p.game.flags.is('bread.delivered') && p.count('wheat') === wheat - 20, `Maren did not take 20 wheat. She said: ${lines.join(' / ')}`);
    },
  },

  // ---------------------------------------------------------------- 5. The harvest festival
  {
    quest: 'festival', name: 'come to the square at dusk',
    run(p) {
      expectStep(p, 'festival.evening');
      // Waiting with Maren was the first choice, so dusk comes at once. Otherwise the player waits for it.
      must(p, p.until(() => p.game.flags.is('festival.started'), p.sys.time.dayLength), 'the festival did not start at dusk');
      must(p, p.game.clock.timeOfDay >= 0.73 || p.game.clock.timeOfDay < 0.23, `the festival started at ${p.game.clock.timeOfDay.toFixed(3)}, which is not dusk or night`);
      walkToTown(p);
      must(p, p.walkTo('town.square', { within: 3, seconds: 240 }), 'could not walk to the square');
      expectStep(p, 'festival.lamp');
    },
  },
  {
    quest: 'festival', name: 'get the river lamp from Odo',
    run(p) {
      talkTo(p, 'odo');
      must(p, p.count('river_lamp') === 1 && p.game.flags.is('festival.lamp.given'), 'Odo did not give the river lamp');
    },
  },
  {
    quest: 'festival', name: 'float the lamp from the river bank',
    run(p) {
      must(p, p.walkTo('river.bank', { within: 2, seconds: 240 }), 'could not walk to the river bank');
      must(p, p.take('river_lamp'), 'the river lamp is not in the bag');
      const at = p.game.player.pos;
      // The secondary button on the quay in front of the water.
      p.use(Math.floor(at.x), Math.floor(at.y) - 1, Math.floor(at.z) + 1);
      must(p, p.game.flags.is('festival.lamp') && p.count('river_lamp') === 0, 'the lamp did not float');
      expectStep(p, 'festival.end');
    },
  },
  {
    quest: 'festival', name: 'talk to Tamsin on the bank',
    run(p) {
      const tamsin = p.sys.people.get('tamsin');
      must(p, tamsin, 'Tamsin is gone');
      const bank = p.sys.region.place('river.bank').at;
      // She walks down from the lodge when the festival starts.
      p.until(() => distance2d(tamsin.pos, bank) < 6, 120);
      must(p, distance2d(tamsin.pos, bank) < 6, `Tamsin should be on the river bank and is ${distance2d(tamsin.pos, bank).toFixed(1)} blocks from it, at ${tamsin.place}`);
      const lines = talkTo(p, 'tamsin');
      must(p, lines.at(-1) === 'Go on. Float your lamp.', `Tamsin's last line is "${String(lines.at(-1))}"`);
      must(p, p.game.flags.is('festival.ended'), 'the last talk did not set festival.ended');
    },
  },
];

/** The quests in order. */
export const QUEST_ORDER: readonly string[] = ['plot', 'roof', 'leaftail', 'bread', 'festival'];
