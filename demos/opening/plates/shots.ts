// Each shot of the mockup: where the camera moves over its plate, and what is drawn over the plate. It is the
// table in ~/dev/sandbox/game-look-test/playthrough/film.js, with every moment named by a beat of the film
// instead of a number of seconds, so a shot that grows to fit its spoken line keeps its timing.
import type { ShotId } from '../types.ts';

/** A point of the camera: the point of the plate at the middle of the screen (0 to 1) and how far it is zoomed in. */
export type Cam = readonly [x: number, y: number, zoom: number];

export type Tint = 'gold' | 'white';

/** What is drawn over a plate. Places are fractions of the plate, sizes fractions of its width. */
export type Fx =
  /** The wall paints itself in from the left, finishing on `beat`. */
  | { kind: 'paint'; beat: string }
  /** Dust drifting up through the light. */
  | { kind: 'motes'; tint: Tint }
  /** A soft pulse of light. With `beat` it swells as the shot reaches that moment. */
  | { kind: 'glow'; x: number; y: number; r: number; tint: Tint; beat?: string }
  /** Once the camera holds, everything but one place dims a little. */
  | { kind: 'spot'; x: number; y: number }
  /** The picture goes cold, all the way by `beat`. */
  | { kind: 'tint'; beat: string }
  /** Lights leave the houses after `from` and all reach (x, y) by `to`. */
  | { kind: 'lights'; x: number; y: number; from: string; to: string }
  /** Seven points in a ring on the hand. Each of the first six lights on its beat; the seventh never does. */
  | { kind: 'mark'; x: number; y: number; r: number; beats: readonly string[] }
  /** The dark of a room lit by one flickering candle. */
  | { kind: 'candle'; x: number; y: number }
  | { kind: 'rain' }
  /** A small hard glint on something that catches the light on `beat`. */
  | { kind: 'glint'; x: number; y: number; beat: string };

export interface PlateShot {
  /** Where the camera starts and where it ends. */
  cam: readonly [Cam, Cam];
  /** The beat on which the move ends. The rest of the shot holds still. Without it the move takes the whole shot. */
  hold?: string;
  fx: readonly Fx[];
}

export const SHOTS: Record<ShotId, PlateShot> = {
  war: {
    cam: [[0.5, 0.56, 1.42], [0.5, 0.5, 1.06]],
    fx: [{ kind: 'glow', x: 0.5, y: 0.6, r: 0.07, tint: 'white' }, { kind: 'motes', tint: 'gold' }, { kind: 'paint', beat: 'painted' }],
  },
  king: {
    cam: [[0.5, 0.68, 1.45], [0.5, 0.38, 1.25]],
    fx: [{ kind: 'glow', x: 0.5, y: 0.2, r: 0.14, tint: 'gold', beat: 'crown' }, { kind: 'motes', tint: 'gold' }],
  },
  friends: {
    cam: [[0.28, 0.52, 1.8], [0.83, 0.52, 1.8]],
    hold: 'scraped',
    fx: [{ kind: 'motes', tint: 'gold' }, { kind: 'spot', x: 0.83, y: 0.5 }],
  },
  roads: {
    cam: [[0.5, 0.5, 1.75], [0.5, 0.5, 1.08]],
    fx: [{ kind: 'glow', x: 0.5, y: 0.5, r: 0.1, tint: 'gold', beat: 'lit' }, { kind: 'motes', tint: 'gold' }],
  },
  sickness: {
    cam: [[0.36, 0.5, 1.5], [0.74, 0.56, 1.6]],
    fx: [{ kind: 'tint', beat: 'dim' }],
  },
  night: {
    cam: [[0.5, 0.7, 1.9], [0.5, 0.5, 1.12]],
    fx: [{ kind: 'lights', x: 0.5, y: 0.42, from: 'rise', to: 'dome' }, { kind: 'glow', x: 0.5, y: 0.42, r: 0.16, tint: 'gold', beat: 'dome' }],
  },
  gods: {
    cam: [[0.5, 0.5, 1.08], [0.5, 0.5, 1.35]],
    fx: [{ kind: 'glow', x: 0.5, y: 0.5, r: 0.13, tint: 'gold', beat: 'bands' }],
  },
  mark: {
    cam: [[0.5, 0.5, 1.06], [0.48, 0.52, 1.5]],
    fx: [{ kind: 'mark', x: 0.475, y: 0.455, r: 0.056, beats: ['light1', 'light2', 'light3', 'light4', 'light5', 'light6'] }],
  },
  wall: {
    cam: [[0.57, 0.58, 2.0], [0.55, 0.55, 1.08]],
    fx: [{ kind: 'candle', x: 0.515, y: 0.57 }],
  },
  doorstep: {
    cam: [[0.68, 0.72, 2.0], [0.5, 0.58, 1.08]],
    fx: [{ kind: 'rain' }, { kind: 'glow', x: 0.34, y: 0.42, r: 0.06, tint: 'gold' }, { kind: 'glint', x: 0.682, y: 0.652, beat: 'key' }],
  },
  morning: {
    cam: [[0.6, 0.62, 1.4], [0.5, 0.5, 1.1]],
    fx: [{ kind: 'motes', tint: 'white' }],
  },
};
