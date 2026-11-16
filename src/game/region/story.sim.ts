// The story as the land shows it. Four things change on the map as act 1 is played (handbook chapters 26 and 27):
//
//   - the Order lights the stretch of the High Road above your land at dusk on the day of scene 23, and by morning
//     the grass under it is grey. It goes dark again once Hollowmere has filled the queen's ledger and shut off
//     its pumps
//   - a brass pump stands in each of Hollowmere's edge fields, with a ring of grey round it. They come out a few
//     at a time as the ledger's four sections fill
//   - the grey forest turns green overnight once the Verdant Stag is freed (fight 12)
//   - your plot is pale, tired grass when you arrive, and greens outward from whatever you tend, a few blocks more
//     each time the Heartstone rises
//
// The region system works these out from the shared flags each step and writes them as flags of its own
// (`road.relit`, `land.pumps`, `land.healed`, `land.green`), so the views and any system read one answer.
import type { Flags } from '../api.sim.ts';
import { CITY_FIELDS } from '../content/greenhollow.ts';
import { FLAG } from '../content/flags.ts';
import { LEDGER_SECTIONS } from '../content/ids.ts';

export interface LandState {
  /** The relit stretch of the High Road glows, and the land under it is grey. */
  relit: boolean;
  /** How many of the Order's pumps still stand in Hollowmere's fields, from all of them down to none. */
  pumps: number;
  /** The grey forest has its colour back. */
  healed: boolean;
  /** How far tended ground greens the tired grass round it on your plot, in blocks. */
  green: number;
}

/** The pumps, one to each edge field. */
export const PUMPS = CITY_FIELDS.length;

/** What the land shows for these flags. */
export function landState(flags: Pick<Flags, 'get' | 'is'>): LandState {
  const filled = LEDGER_SECTIONS.filter((s) => flags.is(FLAG.ledgerFilled(s))).length;
  const heart = Number(flags.get(FLAG.heartstone) ?? 0);
  return {
    relit: flags.is(FLAG.scene(23)) && filled < LEDGER_SECTIONS.length,
    pumps: Math.ceil((PUMPS * (LEDGER_SECTIONS.length - filled)) / LEDGER_SECTIONS.length),
    healed: flags.is(FLAG.fightWon(12)),
    green: 3 + 2 * (Number.isFinite(heart) ? Math.max(0, Math.min(6, heart)) : 0),
  };
}

/** Writes the land's state as flags, only when one has changed. */
export function writeLandState(flags: Flags, state: LandState): void {
  if (flags.get(FLAG.roadRelit) !== state.relit) flags.set(FLAG.roadRelit, state.relit);
  if (flags.get(FLAG.landPumps) !== state.pumps) flags.set(FLAG.landPumps, state.pumps);
  if (flags.get(FLAG.landHealed) !== state.healed) flags.set(FLAG.landHealed, state.healed);
  if (flags.get(FLAG.landGreen) !== state.green) flags.set(FLAG.landGreen, state.green);
}

/** The land's state as the region last wrote it, for a view: what a new game shows until the first step. */
export function readLandState(flags: Pick<Flags, 'get'>): LandState {
  const pumps = flags.get(FLAG.landPumps), green = flags.get(FLAG.landGreen);
  return {
    relit: flags.get(FLAG.roadRelit) === true,
    pumps: typeof pumps === 'number' ? pumps : PUMPS,
    healed: flags.get(FLAG.landHealed) === true,
    green: typeof green === 'number' ? green : 3,
  };
}
