// Sky and weather data: the calendar, the kinds of weather and how a front moves.
// The weather machine in src/features/weather reads only this file. A new kind of weather is a new entry.

export type WeatherKind = 'clear' | 'breezy' | 'overcast' | 'rain' | 'storm' | 'fog' | 'motes';

export interface WeatherEntry {
  name: string;
  /** How likely the machine is to pick it next, against the other weights. */
  weight: number;
  /** The part of the day, as timeOfDay from and to, when it starts at full weight. */
  hours?: readonly [number, number];
  /** The weight is multiplied by this outside `hours`. 0 means it never starts then. */
  offHours?: number;
  /** How long it stays once its front has arrived, in seconds of game time. */
  lasts: readonly [number, number];
  /** Where each Ambient number settles. */
  cloud: number;
  rain: number;
  fog: number;
  wind: number;
  /** Lightning strikes a minute once the rain has arrived. */
  lightning: number;
  /** Glowing motes in the air, 0 to 1. */
  motes: number;
}

export const weatherTable: Record<WeatherKind, WeatherEntry> = {
  clear: { name: 'Clear', weight: 40, lasts: [240, 540], cloud: 0.2, rain: 0, fog: 0, wind: 0.2, lightning: 0, motes: 0 },
  breezy: { name: 'Breezy', weight: 22, lasts: [180, 420], cloud: 0.3, rain: 0, fog: 0, wind: 0.65, lightning: 0, motes: 0 },
  overcast: { name: 'Overcast', weight: 14, lasts: [180, 360], cloud: 0.9, rain: 0, fog: 0.08, wind: 0.3, lightning: 0, motes: 0 },
  rain: { name: 'Rain', weight: 10, lasts: [180, 360], cloud: 0.85, rain: 0.6, fog: 0.2, wind: 0.45, lightning: 0, motes: 0 },
  storm: { name: 'Storm', weight: 3, lasts: [120, 240], cloud: 1, rain: 1, fog: 0.3, wind: 1, lightning: 7, motes: 0 },
  // Some mornings.
  fog: { name: 'Fog', weight: 16, hours: [0.2, 0.36], offHours: 0.1, lasts: [150, 300], cloud: 0.5, rain: 0, fog: 1, wind: 0.08, lightning: 0, motes: 0 },
  // The rare gentle one: glowing seeds drift down at dusk. A few times a month.
  motes: { name: 'Seedfall', weight: 30, hours: [0.66, 0.75], offHours: 0, lasts: [150, 240], cloud: 0.15, rain: 0, fog: 0, wind: 0.12, lightning: 0, motes: 1 },
};

/** A day is 20 minutes: 1 of dawn, 12 of light, 1 of dusk and 6 of night. A month is 28 days and the moon has 8 phases. */
export const calendar = {
  dawnSeconds: 60,
  lightSeconds: 720,
  duskSeconds: 60,
  nightSeconds: 360,
  daysInMonth: 28,
  moonPhases: 8,
  /** The moon on the first night. 0 is new and 4 is full. */
  firstMoonPhase: 3,
};

/**
 * A front. Each number waits `[delay, ramp]` seconds after the change starts, then eases to its new value.
 * Arriving weather brings wind first, then cloud, then rain. Leaving weather stops raining first and calms last.
 */
export const frontTiming = {
  /** How long a whole front takes, about a minute. A kind's `lasts` is counted after it. */
  seconds: 62,
  arrive: { wind: [0, 18], cloud: [8, 34], fog: [12, 40], rain: [40, 22], motes: [0, 30] },
  leave: { rain: [0, 16], fog: [6, 40], cloud: [12, 38], wind: [26, 30], motes: [0, 30] },
  /** The wind swings to its new direction over this many seconds. */
  turnSeconds: 40,
  /** The most the wind turns in one change, in radians. */
  maxTurn: 1.2,
} as const;

export const wetnessRules = {
  /** Seconds of full rain to soak open ground. */
  soakSeconds: 45,
  /** Seconds for soaked ground to dry under a clear midday sky. Cloud and night slow it. */
  drySeconds: 180,
};

export const lightningRules = {
  /** How far from the listener a strike can land, in meters. */
  nearest: 30,
  farthest: 900,
  /** Meters a second. Thunder arrives this much later than the flash. */
  soundSpeed: 343,
};

export const rainbowRules = {
  /** The chance of a rainbow when rain ends in daylight. */
  chance: 0.6,
  /** Seconds after the rain starts to leave before it shows, and how long it stays. */
  delay: 24,
  lasts: 110,
};
