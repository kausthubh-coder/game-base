// The state of a play as one number and as a short list of facts. Two plays of the same seed and the same
// inputs must give the same number: a test asks for it, and a replay is checked against it.

import type { Play } from './harness.sim.ts';

/** A 53-bit hash of a string (cyrb53), as 14 hex digits. */
function hashOf(text: string): string {
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 2654435761);
    b = Math.imul(b ^ code, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(16).padStart(14, '0');
}

/**
 * Everything the rules keep, as one hash: the step count, the world's changed blocks, what every system saves,
 * where every actor stands, the player's body and the weather. It reads the play and changes nothing.
 */
export function stateHash(p: Play): string {
  const { game } = p;
  const actors: unknown[] = [];
  for (const actor of game.actors.values()) actors.push([actor.id, actor.pos.x, actor.pos.y, actor.pos.z, actor.facing, actor.anim, actor.visible, actor.mark ?? '']);
  const { player, ambient } = game;
  return hashOf(JSON.stringify([
    p.steps,
    p.world.save(),
    p.kernel.save(),
    actors,
    [player.onGround, player.inWater, player.busy],
    [ambient.rain, ambient.cloud, ambient.fog, ambient.wind, ambient.wetness],
    [p.sys.build.active, p.sys.build.dragging, p.sys.talk.active],
  ]));
}

/** The game in a few plain facts, for a replay to print. */
export interface Summary {
  step: number;
  hash: string;
  clock: { day: number; timeOfDay: number; seconds: number };
  player: { x: number; y: number; z: number; facing: number; onGround: boolean; inWater: boolean; busy: boolean };
  held: string;
  bag: Record<string, number>;
  quests: Record<string, string>;
  pets: string[];
  people: Record<string, string>;
  placed: string[];
  crops: number;
  buildMode: boolean;
  talking: string | null;
  lastSaid: string[];
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

export function summary(p: Play): Summary {
  const { game, sys } = p;
  const { clock, player } = game;
  const bag: Record<string, number> = {};
  for (const slot of sys.inventory.slots) if (slot) bag[slot.id] = (bag[slot.id] ?? 0) + slot.count;
  const quests: Record<string, string> = {};
  for (const view of sys.quests.all()) quests[view.id] = view.state === 'active' ? `at ${String(game.flags.get(`quest.${view.id}.step`))}` : view.state;
  const held = sys.inventory.held();
  const placed = sys.placeables.all();
  return {
    step: p.steps,
    hash: stateHash(p),
    clock: { day: clock.day, timeOfDay: round(clock.timeOfDay), seconds: round(clock.seconds) },
    player: { x: round(player.pos.x), y: round(player.pos.y), z: round(player.pos.z), facing: round(player.facing), onGround: player.onGround, inWater: player.inWater, busy: player.busy },
    held: held ? `${held.count} ${held.id} in slot ${sys.inventory.selected}` : `nothing in slot ${sys.inventory.selected}`,
    bag,
    quests,
    pets: sys.pets.all().map((pet) => `${pet.kind} trust ${pet.trust}${pet.bonded ? ', bonded' : ''} at ${round(pet.pos.x)}, ${round(pet.pos.y)}, ${round(pet.pos.z)}`),
    people: Object.fromEntries(sys.people.all().map((npc) => [npc.id, npc.place])),
    placed: placed.slice(-12).map((one) => `${one.kind} at ${one.x}, ${one.y}, ${one.z}`).concat(placed.length > 12 ? [`and ${placed.length - 12} more`] : []),
    crops: sys.crops.all().length,
    buildMode: sys.build.active,
    talking: sys.talk.current()?.text ?? null,
    lastSaid: p.said.slice(-4),
  };
}
