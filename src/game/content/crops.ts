// Every crop, as data. Wheat's numbers come from docs/play/act1.md. A new crop is a new row.
import type { CropDef } from '../api.sim.ts';

export interface CropEntry extends CropDef {
  /** The chance, 0 to 1, that a harvest also gives back one seed. */
  seedChance: number;
}

export const crops: readonly CropEntry[] = [
  { id: 'wheat', name: 'Wheat', seed: 'wheat_seeds', stages: 4, secondsPerStage: 45, gives: [{ id: 'wheat', count: 2 }], seedChance: 1 / 3 },
  // Slower crops for later parts. Nothing gives their seeds yet.
  { id: 'turnip', name: 'Turnip', seed: 'turnip_seeds', stages: 4, secondsPerStage: 75, gives: [{ id: 'turnip', count: 1 }], seedChance: 1 / 4 },
  { id: 'carrot', name: 'Carrot', seed: 'carrot_seeds', stages: 5, secondsPerStage: 90, gives: [{ id: 'carrot', count: 2 }], seedChance: 1 / 5 },
];

export const farming = {
  /** Seconds one watering keeps soil wet. */
  waterSeconds: 180,
  /** Stages a wet crop gains while the player sleeps. */
  sleepStages: 2,
  /** Rain stronger than this waters soil under open sky. The weather soaks open ground from the same level. */
  rainWaters: 0.05,
};
