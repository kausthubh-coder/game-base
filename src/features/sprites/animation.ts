// Animation timing. The GPU works out the frame of every character from one clock, so these few
// rules are all the timing there is. The vertex shader in sprites.view.ts repeats `frameAt` line for line.

/**
 * The frame to show `elapsed` seconds after an animation started. A looping animation wraps. One
 * played once stops on its last frame.
 */
export function frameAt(elapsed: number, frames: number, fps: number, loop = true): number {
  const frame = Math.floor(Math.max(elapsed, 0) * fps);
  return loop ? frame % frames : Math.min(frame, frames - 1);
}

/** How long one pass through an animation takes, in seconds. */
export function loopSeconds(frames: number, fps: number): number {
  return frames / fps;
}

/**
 * When an animation must have started for it to be `phase` of the way through its loop at `now`.
 * `phase` is 0 to 1. A crowd gets a random phase each, so it does not move in step.
 */
export function startForPhase(now: number, frames: number, fps: number, phase: number): number {
  return now - phase * loopSeconds(frames, fps);
}

/**
 * The same moment in the loop, moved to within one loop of `now`. Start times are kept as 32 bit
 * numbers on the GPU, and this keeps them small however long the game has run.
 */
export function foldStart(start: number, now: number, frames: number, fps: number, loop: boolean): number {
  const length = loopSeconds(frames, fps);
  const elapsed = now - start;
  if (elapsed <= length) return start;
  // An animation played once has ended: any start at least one loop back shows its last frame.
  return loop ? now - (elapsed % length) : now - length - 1;
}

/** A small seeded random number source: the same seed gives the same crowd. */
export function seededRandom(seed: number): () => number {
  // The state is kept in a typed array. As a plain variable it would be a new heap number on every call.
  const state = new Uint32Array([seed]);
  return () => {
    state[0] += 0x6d2b79f5;
    let t = Math.imul(state[0] ^ (state[0] >>> 15), 1 | state[0]);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
