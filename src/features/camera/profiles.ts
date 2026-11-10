// Places to put the camera other than the default, to compare. `?cam=<name>` in the game's address picks one,
// and without it the game keeps the camera it has always had. Each profile says how the camera stands and
// what the rest of the picture needs to look right from there: how far the fog reaches, how much land is
// loaded and how far the sun's shadow is drawn. A camera that looks at the horizon shows where the loaded
// land ends, so its fog has to be whole before that edge.
import type { PerStep, RigOptions } from './rig.sim.ts';

const DEG = Math.PI / 180;

export interface CameraProfile {
  /** One line on what it is. */
  about: string;
  rig: Partial<RigOptions> & { distances: readonly number[]; zoom: number };
  /** The lens, the vertical field of view in degrees. */
  fov: PerStep;
  /** Meters past the hero where the fog starts and where it is whole. */
  fogStart: PerStep;
  fogEnd: PerStep;
  /** Half the width of the sun's shadow square around the hero, in meters. */
  shadowRange: PerStep;
  /** Multiplies how far the world loads land around the hero. */
  load: number;
}

export const CAMERA_PROFILES: Readonly<Record<string, CameraProfile>> = {
  horizon: {
    about: 'Above and behind the hero, the view tilted up so the sky fills the top third',
    rig: { distances: [16, 22, 30], zoom: 0, pitch: 20 * DEG, aim: 10 * DEG, lift: 1 },
    fov: 42,
    fogStart: 36,
    fogEnd: 88,
    shadowRange: 44,
    load: 1,
  },
  tilt: {
    about: 'Today\'s view zoomed out; each step in lowers the camera toward the horizon',
    rig: {
      distances: [14, 24, 34, 66, 94], zoom: 2,
      pitch: [15 * DEG, 22 * DEG, 35 * DEG, 35 * DEG, 35 * DEG],
      aim: [6 * DEG, 13 * DEG, 35 * DEG, 35 * DEG, 35 * DEG],
      lift: [1.3, 1.1, 1, 1, 1],
    },
    fov: [44, 34, 20, 20, 20],
    fogStart: [34, 34, 30, 30, 30],
    fogEnd: [86, 88, 170, 170, 170],
    shadowRange: [44, 40, 30, 72, 86],
    load: 1,
  },
  shoulder: {
    about: 'Third person, close behind and a little above the hero, as in Genshin',
    rig: { distances: [6, 9, 13], zoom: 1, pitch: 14 * DEG, aim: 5 * DEG, lift: 1.5 },
    fov: 50,
    fogStart: 32,
    fogEnd: 86,
    shadowRange: 44,
    load: 1,
  },
  crane: {
    about: 'Today\'s height over the hero, with a wide lens aimed up so the sky shows over the ground',
    rig: { distances: [13, 18, 26], zoom: 0, pitch: 34 * DEG, aim: 15 * DEG, lift: 1 },
    fov: 58,
    fogStart: 36,
    fogEnd: 88,
    shadowRange: 44,
    load: 1,
  },
};

/** The profile named in `?cam=`, or null for the default camera. `today` is the default by name. */
export function cameraProfile(name: string | null): CameraProfile | null {
  return name && Object.hasOwn(CAMERA_PROFILES, name) ? CAMERA_PROFILES[name] : null;
}
