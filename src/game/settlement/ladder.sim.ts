// The Heartstone's ladder, chapter 30: what has to be alive on the land for each step, worked out from a few
// facts the settlement gathers. Steps 1 to 5 come from what lives on the land, and each needs the one below
// it. The sixth comes when the Stag is free. The Order's pump, while it runs, holds the stone a step down.

import type { HeartNextView } from '../api.sim.ts';
import { HEART_LADDER } from '../content/people.ts';

/** What the settlement knows about the land, each a count or a yes. */
export interface HeartFacts {
  /** The first night's stone has been touched. Before that it is dormant. */
  seen: boolean;
  water: boolean;
  fire: boolean;
  kitchen: boolean;
  /** Beds under a roof. */
  beds: number;
  /** Farms on Give and running. */
  living: number;
  settlers: number;
  /** Settlers with every need met. */
  met: number;
  wheel: boolean;
  terrace: boolean;
  households: number;
  /** Goods that move by themselves: a chute or a pusher at work. */
  moving: boolean;
  hearts: number;
  stag: boolean;
  pump: boolean;
}

export const NO_FACTS: HeartFacts = {
  seen: false, water: false, fire: false, kitchen: false, beds: 0, living: 0, settlers: 0, met: 0, wheel: false,
  terrace: false, households: 0, moving: false, hearts: 0, stag: false, pump: false,
};

type Part = { label: string; have: number; need: number };
const yes = (label: string, held: boolean): Part => ({ label, have: held ? 1 : 0, need: 1 });
const count = (label: string, have: number, need: number): Part => ({ label, have: Math.min(have, need), need });

/** What a step asks for, each part with how much of it holds. */
export function partsOf(level: number, f: HeartFacts): Part[] {
  switch (level) {
    case 1: return [yes('Water in a field', f.water), yes('A fire', f.fire)];
    case 2: return [yes('A kitchen', f.kitchen), count('Beds under a roof', f.beds, 3), count('A living farm', f.living, 1)];
    case 3: return [count('Living farms', f.living, 3), yes('Everyone\'s needs met', f.settlers > 0 && f.met === f.settlers)];
    case 4: return [yes('A wheel turning', f.wheel), yes('A terrace that out-yields a pumped field', f.terrace)];
    case 5: return [count('Households', f.households, 3), count('Living farms', f.living, 6), yes('Goods that move by themselves', f.moving), count('Hearts', f.hearts, 60)];
    case 6: return [yes('The god of the land set free', f.stag)];
    default: return [];
  }
}

const holds = (level: number, f: HeartFacts): boolean => partsOf(level, f).every((p) => p.have >= p.need);

/** The level the land itself has reached, before the pump. */
export function landLevel(f: HeartFacts): number {
  if (!f.seen) return 0;
  if (f.stag) return 6;
  let level = 0;
  while (level < 5 && holds(level + 1, f)) level++;
  return level;
}

/** The level the stone reads: the land's, one lower while the pump runs. */
export function heartLevel(f: HeartFacts): number {
  const land = landLevel(f);
  return f.pump ? Math.max(0, land - 1) : land;
}

/** What the next step asks for, or null at the top. */
export function nextStep(f: HeartFacts): HeartNextView | null {
  const level = landLevel(f) + 1;
  if (!f.seen || level > 6) return null;
  const step = HEART_LADDER[level - 1];
  return { level, reach: step.reach, parts: partsOf(level, f), pump: f.pump };
}
