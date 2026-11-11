// Tools for tests, never for players: put items in the bag, and fill a world with creatures and placed
// things for the memory test. The Durable Object runs them only when DEV_TOOLS is "1" in .dev.vars.
import { LIQUID } from '../src/features/world/chunk.sim.ts';
import type { CreaturesSave } from '../src/game/creatures/index.sim.ts';
import type { Room } from './room.ts';

export type DevCommand =
  | { do: 'give'; item: string; count: number }
  | { do: 'fill'; creatures: number; placed: number };

export interface DevResult {
  ok: boolean;
  /** What was really added, which can be fewer than asked for where the land had no room. */
  creatures?: number;
  placed?: number;
  left?: number;
}

/** The kinds the memory test sets down, in turn. The rules have no machines yet. These are the placed things there are. */
const FILL_KINDS = ['sprinkler', 'fence', 'chest'];
/** The kind of creature the memory test adds. It is awake at every hour, so all of them are stepped. */
const FILL_CREATURE = 'mossling';
/** Blocks around the host that the fill leaves free of placed things. */
const CLEAR = 14;

export function runDev(room: Room, command: DevCommand): DevResult {
  const { game, sys, world, kernel } = room;
  if (command.do === 'give') {
    if (!sys.items.all().some((item) => item.id === command.item)) return { ok: false };
    return { ok: true, left: sys.inventory.add(command.item, command.count) };
  }

  // Around the host, on land that is in memory. A world with nobody in it has no such land.
  if (room.playerCount === 0) return { ok: false };
  const cx = Math.floor(game.player.pos.x), cz = Math.floor(game.player.pos.z);
  const open = (x: number, z: number): number | null => {
    if (!world.isLoaded(x, z) || sys.region.isProtected(x, 0, z)) return null;
    const y = world.heightAt(x, z);
    return y > 0 && y < 60 && !LIQUID[world.getBlock(x, y, z)] ? y : null;
  };

  // Creatures first: they go in through the creature system's own save, and loading a save sets every
  // placed thing down again.
  let creatures = 0;
  if (command.creatures > 0) {
    const save = kernel.save();
    const data = save.systems.creatures as CreaturesSave;
    let n = data.next[FILL_CREATURE] ?? 1;
    // Rings of columns two apart, out to 20 blocks. The rules step a creature within 48 blocks of the
    // host, a creature wanders 6 from its spot, and the test's players walk within 13 of where they began.
    for (let r = 2; r <= 20 && creatures < command.creatures; r += 2) {
      for (let x = cx - r; x <= cx + r && creatures < command.creatures; x += 2) {
        for (let z = cz - r; z <= cz + r && creatures < command.creatures; z += 2) {
          if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) !== r) continue;
          const y = open(x, z);
          if (y === null) continue;
          data.creatures.push({ kind: FILL_CREATURE, n: n++, pos: [x + 0.5, y, z + 0.5], home: [x + 0.5, y, z + 0.5], ready: 0 });
          creatures++;
        }
      }
    }
    data.next[FILL_CREATURE] = n;
    kernel.load(save);
  }

  // Placed things like the dark squares of a chessboard, in rings out from the host as far as the land is
  // in memory. The first 14 blocks stay clear, so the players have room to walk.
  let placed = 0;
  for (let r = CLEAR; r <= 120 && placed < command.placed; r++) {
    for (let x = cx - r; x <= cx + r && placed < command.placed; x++) {
      for (let z = cz - r; z <= cz + r && placed < command.placed; z++) {
        if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) !== r || ((x + z) & 1) !== 0) continue;
        const y = open(x, z);
        if (y === null) continue;
        if (sys.placeables.place(FILL_KINDS[placed % FILL_KINDS.length], x, y, z, 0)) placed++;
      }
    }
  }
  return { ok: true, creatures, placed };
}
