// Everyone else in an online world, drawn a little in the past, between two updates the server really sent.
//
// A snap tells a player of the others when they change: players every step, everything else every fourth.
// Each actor keeps its last few positions with the server step they belong to. A frame draws it at a time
// behind the newest step by its delay: a tenth of a second for a player, a quarter for the rest, whose
// updates are further apart. Between two kept positions it is blended; past the last it stands there.
import type { ActorState } from '../../engine/net/messages.ts';

/** Steps behind the server a player is drawn: 2 is a tenth of a second. */
export const PLAYER_DELAY = 2;
/** Steps behind for anyone else, who is told of five times a second: more than one gap between updates. */
export const OTHER_DELAY = 5;
/** Positions kept for each actor. */
const KEEP = 8;

interface Sample {
  step: number;
  x: number; y: number; z: number;
  facing: number;
}

export interface Track {
  readonly id: string;
  /** The newest of what the server said, for everything but the position. */
  state: ActorState;
  readonly delay: number;
  readonly samples: Sample[];
}

/** Where an actor is drawn this frame. The same object for every call. */
export interface Drawn {
  x: number; y: number; z: number;
  facing: number;
}

export interface Others {
  /** Takes in the actors of one snap, at its step. */
  take(step: number, actors: readonly ActorState[] | undefined, gone: readonly string[] | undefined): void;
  /** Where `track` is drawn at server time `at`, in steps (fractional). */
  sample(track: Track, at: number, out: Drawn): Drawn;
  readonly tracks: ReadonlyMap<string, Track>;
  clear(): void;
}

const isPlayer = (id: string): boolean => id.startsWith('player:');

/** The shorter way round from one facing to another, blended. */
function blendAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function createOthers(): Others {
  const tracks = new Map<string, Track>();

  return {
    tracks,

    take(step, actors, gone) {
      if (gone) for (const id of gone) tracks.delete(id);
      if (!actors) return;
      for (const state of actors) {
        let track = tracks.get(state.id);
        if (!track) {
          track = { id: state.id, state, delay: isPlayer(state.id) ? PLAYER_DELAY : OTHER_DELAY, samples: [] };
          tracks.set(state.id, track);
        }
        track.state = state;
        const samples = track.samples;
        const last = samples[samples.length - 1];
        if (last && last.step >= step) {
          // The same step again: the newer word stands.
          last.x = state.x; last.y = state.y; last.z = state.z; last.facing = state.facing;
          continue;
        }
        // An actor is told of only when it changes. After a still spell it stood where it was until the step
        // before this news, and is not drawn sliding there over the whole spell.
        const gap = isPlayer(state.id) ? 1 : 4;
        if (last && step - last.step > gap) samples.push({ step: step - gap, x: last.x, y: last.y, z: last.z, facing: last.facing });
        samples.push({ step, x: state.x, y: state.y, z: state.z, facing: state.facing });
        while (samples.length > KEEP) samples.shift();
      }
    },

    sample(track, at, out) {
      const samples = track.samples, t = at - track.delay;
      let i = samples.length - 1;
      while (i > 0 && samples[i - 1].step > t) i--;
      const b = samples[i];
      const a = i > 0 ? samples[i - 1] : b;
      if (t >= b.step || a === b) {
        out.x = b.x; out.y = b.y; out.z = b.z; out.facing = b.facing;
        return out;
      }
      const f = Math.max(0, Math.min(1, (t - a.step) / (b.step - a.step)));
      out.x = a.x + (b.x - a.x) * f;
      out.y = a.y + (b.y - a.y) * f;
      out.z = a.z + (b.z - a.z) * f;
      out.facing = blendAngle(a.facing, b.facing, f);
      return out;
    },

    clear() {
      tracks.clear();
    },
  };
}

/**
 * The server's step count now, as this browser best knows it, in fractional steps. A snap that came through
 * quickly says the most: the clock follows the quickest of the recent ones and lets go of it slowly, so a
 * snap that was held up on the way does not pull the drawing back.
 */
export function createServerClock(stepsPerSecond: number): { heard(step: number, now: number): void; at(now: number): number; readonly known: boolean } {
  let offset = 0, known = false;
  return {
    get known() { return known; },
    heard(step, now) {
      const sample = step - now * stepsPerSecond;
      if (!known || sample > offset) offset = sample;
      // Half a step a second, so a clock that ran fast comes back over a few seconds.
      else offset -= 0.5 / stepsPerSecond;
      known = true;
    },
    at: (now) => now * stepsPerSecond + offset,
  };
}
