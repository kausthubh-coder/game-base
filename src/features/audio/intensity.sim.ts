// Intensity is one number, 0 to 1, for how much is going on. Each layer comes in over a range of it.
// A layer switches on at one level and off at a lower one, so it cannot flicker at a threshold.
import { clamp } from './rng.sim.ts';

export interface Mood {
  town: number;
  danger: number;
  fight: number;
  boss: number;
  night: number;
  rain: number;
}

/** The layers that follow intensity. The first seven belong to a palette. The last three are laid over every land. */
export const LAYERS = ['drone', 'harmony', 'melody', 'sparkle', 'bass', 'perc', 'full', 'drums', 'tension', 'boss'] as const;
export type LayerId = (typeof LAYERS)[number];

/** Where intensity is heading. A calm day is 0.5, night 0.34, a town 0.66, a fight 0.95. */
export function intensityTarget(m: Mood): number {
  const calm = 0.5 + 0.16 * clamp(m.town, 0, 1) - 0.16 * clamp(m.night, 0, 1) + 0.14 * clamp(m.danger, 0, 1) - 0.03 * clamp(m.rain, 0, 1);
  const fight = Math.max(clamp(m.fight, 0, 1), 0.6 * clamp(m.boss, 0, 1));
  return clamp(calm + (0.95 - calm) * fight, 0, 1);
}

/** Rises in about half a second, falls over a few. A fight should hit and then let go slowly. */
export function smoothIntensity(current: number, target: number, dt: number): number {
  const seconds = target > current ? 0.5 : 2.6;
  return current + (target - current) * (1 - Math.exp(-dt / seconds));
}

interface Gate {
  on: number;
  off: number;
  /** The level at the `on` threshold. It reaches 1 a little above it. */
  floor: number;
}

/** `full` is the town arrangement. `drums` is the fight kit. The steady states sit clear of every band. */
const GATES: Record<Exclude<LayerId, 'tension' | 'boss'>, Gate> = {
  drone: { on: -1, off: -2, floor: 1 },
  harmony: { on: 0.14, off: 0.08, floor: 0.7 },
  melody: { on: 0.24, off: 0.18, floor: 0.8 },
  sparkle: { on: 0.2, off: 0.14, floor: 0.6 },
  bass: { on: 0.44, off: 0.38, floor: 0.75 },
  perc: { on: 0.46, off: 0.4, floor: 0.7 },
  full: { on: 0.6, off: 0.54, floor: 0.7 },
  drums: { on: 0.84, off: 0.7, floor: 0.85 },
};

export type LayerSwitches = Record<LayerId, boolean>;

export function newSwitches(): LayerSwitches {
  return { drone: true, harmony: false, melody: false, sparkle: false, bass: false, perc: false, full: false, drums: false, tension: false, boss: false };
}

/** Flips each layer's switch with hysteresis. Call it on a beat, so changes land in time. */
export function gateLayers(switches: LayerSwitches, intensity: number, danger: number, boss: number): void {
  for (const id of LAYERS) {
    if (id === 'tension') switches.tension = switches.tension ? danger > 0.12 : danger > 0.25;
    else if (id === 'boss') switches.boss = switches.boss ? boss > 0.3 : boss > 0.5;
    else {
      const gate = GATES[id];
      switches[id] = switches[id] ? intensity >= gate.off : intensity >= gate.on;
    }
  }
}

/** How loud a layer is, 0 to 1: nothing while off, then rising over the 0.15 above its threshold. */
export function layerLevel(id: LayerId, on: boolean, intensity: number, danger: number, boss: number): number {
  if (!on) return 0;
  if (id === 'tension') return clamp(0.4 + danger * 0.6, 0, 1);
  if (id === 'boss') return clamp(0.5 + boss * 0.5, 0, 1);
  const gate = GATES[id];
  return gate.floor + (1 - gate.floor) * clamp((intensity - gate.on) / 0.15, 0, 1);
}
