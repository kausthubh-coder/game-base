// Shared types. This file is the contract between features, so keep it small.
//
// Space: y is up. One unit is one block, which is one meter. The block at (x, y, z) fills
// x..x+1, y..y+1, z..z+1. North is -z and east is +x.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** The kinds of ground a foot can land on. Every block maps to one. Sound and effects read it. */
export type Surface = 'grass' | 'tallGrass' | 'dirt' | 'stone' | 'wood' | 'sand' | 'water' | 'snow' | 'leaves' | 'metal';

/** The numbers every system reads about the sky and the weather. Each is 0 to 1 unless it says otherwise. */
export interface Ambient {
  /** 0 is midnight, 0.25 is sunrise, 0.5 is noon, 0.75 is sunset. */
  timeOfDay: number;
  rain: number;
  cloud: number;
  fog: number;
  wind: number;
  /** The direction the wind blows toward, in radians around the up axis. 0 is +x. */
  windDir: number;
  /** How wet open ground is. It rises in rain and falls afterwards. */
  wetness: number;
  /** 1 on the frame lightning strikes, then it falls back to 0. */
  flash: number;
}

export function calmNoon(): Ambient {
  return { timeOfDay: 0.5, rain: 0, cloud: 0.2, fog: 0, wind: 0.2, windDir: 0, wetness: 0, flash: 0 };
}

/** How much the machine can afford. Every view system must look right at each level. */
export type Quality = 'low' | 'medium' | 'high';
