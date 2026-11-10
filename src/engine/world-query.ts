import type { Surface } from './types.ts';

/** What other features may ask the world. The world feature implements it. Demos use `flatWorld`. */
export interface WorldQuery {
  /** The y of the top of the highest solid block in this column. */
  heightAt(x: number, z: number): number;
  /** The surface a foot lands on in this column. */
  surfaceAt(x: number, z: number): Surface;
  /** True when no block is above this point, so rain and sunlight reach it. */
  openSky(x: number, y: number, z: number): boolean;
  /** The light level at this point, 0 to 15. */
  lightAt(x: number, y: number, z: number): number;
}

/** Flat grass at y = 0 under an open sky. For demos and tests. */
export const flatWorld: WorldQuery = {
  heightAt: () => 0,
  surfaceAt: () => 'grass',
  openSky: () => true,
  lightAt: () => 15,
};
