// Every crop, as data. The rates are handbook chapter 30's clock: a day is 20 minutes, wheat is ripe in one day and
// gives 2 a block, carrots and sunroot in two. A new crop is a new row.
import type { CropDef } from '../api.sim.ts';

export interface CropEntry extends CropDef {
  /** The chance, 0 to 1, that a harvest also gives back one seed. */
  seedChance: number;
  /** It stays in the ground when picked and grows again from its first stage, as a hedge does. */
  keeps?: boolean;
}

export const crops: readonly CropEntry[] = [
  // Four stages, three steps of 400 s: ripe in one day of wet soil.
  { id: 'wheat', name: 'Wheat', seed: 'wheat_seeds', stages: 4, secondsPerStage: 400, gives: [{ id: 'wheat', count: 2 }], seedChance: 1 / 3 },
  // Five stages, four steps of 600 s: two days. The fox hedge gives the seed.
  { id: 'carrot', name: 'Carrot', seed: 'carrot_seeds', stages: 5, secondsPerStage: 600, gives: [{ id: 'carrot', count: 2 }], seedChance: 1 / 5 },
  { id: 'sunroot', name: 'Sunroot', seed: 'sunroot_seeds', stages: 5, secondsPerStage: 600, gives: [{ id: 'sunroot', count: 2 }], seedChance: 1 / 5 },
  // A berry planted grows into a hedge in two days, and keeps giving: the fox's hedge.
  { id: 'berry_bush', name: 'Berry hedge', seed: 'berry', stages: 2, secondsPerStage: 2400, gives: [{ id: 'berry', count: 3 }], seedChance: 0, keeps: true },
];

export const farming = {
  /** Seconds one watering keeps soil wet. */
  waterSeconds: 180,
  /** Rain stronger than this waters soil under open sky. The weather soaks open ground from the same level. */
  rainWaters: 0.05,
  /** Seconds between two looks at which soil lies beside water or under a working sprinkler. */
  waterCheck: 1,
};
