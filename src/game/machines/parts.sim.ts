// What each machine part does on a shaft, as data: whether it carries power, what it asks for, and whether it
// switches its shaft. From handbook chapter 30, "The parts". A part not listed here (a collector chest, a post,
// a bee box) stands on no shaft.

import type { SensorMode } from '../api.sim.ts';

export interface PartRule {
  /** It joins the parts beside it into one shaft. */
  carries: boolean;
  /** Power it asks for while its shaft runs. */
  cost: number;
  /** A lever or a sensor switches every part on its shaft. */
  switch?: 'lever' | 'sensor';
}

export const PART_RULES: Readonly<Record<string, PartRule>> = {
  waterwheel: { carries: true, cost: 0 },
  gear_shaft: { carries: true, cost: 0 },
  lever: { carries: true, cost: 0, switch: 'lever' },
  sensor: { carries: true, cost: 0, switch: 'sensor' },
  sprinkler: { carries: true, cost: 1 },
  pusher: { carries: true, cost: 1 },
  harvester_arm: { carries: true, cost: 2 },
  saw_arm: { carries: true, cost: 2 },
  switch_lamp: { carries: true, cost: 0 },
  hatch: { carries: true, cost: 0 },
  // A chute carries goods downhill by itself. On a shaft it also carries them uphill, for 1 power.
  chute: { carries: true, cost: 1 },
  collector_chest: { carries: false, cost: 0 },
  bee_box: { carries: false, cost: 0 },
  post: { carries: false, cost: 0 },
  clapper: { carries: false, cost: 0 },
};

/** A wheel's power: 4 on flat water, 6 where the water drops. */
export const WHEEL_FLAT = 4;
export const WHEEL_DROP = 6;

/** The modes a sensor steps through when the player sets it, and what each says. */
export const SENSOR_MODES: readonly SensorMode[] = ['creature', 'good', 'ripe', 'dry', 'light', 'dark', 'room'];
export const SENSOR_WORDS: Readonly<Record<SensorMode, string>> = {
  creature: 'a creature',
  good: 'a good on the ground',
  ripe: 'a ripe crop',
  dry: 'dry soil',
  light: 'light',
  dark: 'the dark',
  room: 'room in the chest',
};

/** The cell in front of a part, by its quarter turns: 0 faces north, and each turn is clockwise seen from above. */
export const FRONT: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
