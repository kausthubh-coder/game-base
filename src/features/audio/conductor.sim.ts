// The one clock. It counts ticks and never goes back: region changes, fights and nightfall only change
// how fast it runs. Twelve ticks make a beat, so sixteenths (3 ticks) and triplets (4 ticks) share one grid.
import { clamp } from './rng.sim.ts';

export const TICKS_PER_BEAT = 12;
export const BEATS_PER_BAR = 4;
export const TICKS_PER_BAR = TICKS_PER_BEAT * BEATS_PER_BAR;

/** How far a fight pushes the tempo. The brief asks for 20 to 35 percent. */
export const FIGHT_TEMPO = 0.28;
/** Night is this much slower. */
export const NIGHT_TEMPO = 0.08;

/** Ticks for the tempo to cover about two thirds of a change. Up is quick: a fight has to bite inside two bars. */
const GLIDE_UP_TICKS = 52;
/** Down is slow, so the music settles after a fight. */
const GLIDE_DOWN_TICKS = 100;

export interface Conductor {
  /** The tempo right now, in beats a minute. */
  bpm: number;
  /** Ticks since the music started. It only goes up. */
  tick: number;
  /** The clock time, in seconds, at which `tick` sounds. */
  time: number;
}

export function createConductor(bpm: number, startTime: number): Conductor {
  return { bpm, tick: 0, time: startTime };
}

/** Moves the clock one tick on, gliding the tempo toward the target. */
export function stepTick(c: Conductor, targetBpm: number): void {
  const ticks = targetBpm > c.bpm ? GLIDE_UP_TICKS : GLIDE_DOWN_TICKS;
  c.bpm += (targetBpm - c.bpm) * (1 - Math.exp(-1 / ticks));
  c.time += 60 / c.bpm / TICKS_PER_BEAT;
  c.tick += 1;
}

/** After a stall (a hidden tab), the clock picks up from now. The count carries on from where it was. */
export function resumeAt(c: Conductor, time: number): void {
  if (time > c.time) c.time = time;
}

export function barOf(tick: number): number {
  return Math.floor(tick / TICKS_PER_BAR);
}

export function beatOf(tick: number): number {
  return Math.floor(tick / TICKS_PER_BEAT) % BEATS_PER_BAR;
}

/** The tempo the music is heading for. Night's slowdown gives way to a fight. */
export function targetTempo(base: number, fight: number, night: number, danger: number, boss: number): number {
  const f = clamp(fight, 0, 1);
  const up = 1 + FIGHT_TEMPO * f + 0.03 * clamp(danger, 0, 1) * (1 - f) + 0.04 * clamp(boss, 0, 1) * f;
  const down = 1 - NIGHT_TEMPO * clamp(night, 0, 1) * (1 - f);
  return base * up * down;
}
