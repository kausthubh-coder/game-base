// The opening scene's clock and its one rule: it plays once, on a new game the player chose from the
// title, and never on Continue. No page and no camera here, so the tests run it. The view is
// src/game/views/story-opening.view.ts and the shots are src/game/content/opening.ts.
import type { Flags } from '../api.sim.ts';
import type { OpeningShot } from '../content/opening.ts';

/** Set when the opening starts, and saved with the game, so a reload or a Continue never plays it again. */
export const OPENING_FLAG = 'story.opening';

/** Seconds of the first fade up from black. */
const FADE_IN = 1.4;
/** Seconds of the dip to black at each side of a cut between two shots. */
const DIP = 0.55;
/** A line fades in this long after its shot starts, and out this long before the shot ends. */
const LINE_IN = 0.9, LINE_OUT = 0.7, LINE_FADE = 0.5;
/** Seconds the bars take to leave at the end. */
const BARS_OUT = 0.9;
/** Skip: down to black, then up on the hero. */
const SKIP_DOWN = 0.3, SKIP_UP = 0.6;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
/** Slow at both ends, for the camera. */
export const easeInOut = (t: number): number => t * t * (3 - 2 * t);

/** One moment of the opening, everything the view draws. */
export interface OpeningFrame {
  /** The shot on screen, an index into the shots. */
  shot: number;
  /** How far through the shot the camera is, 0 to 1, eased. */
  move: number;
  /** Black over everything, 0 to 1. */
  black: number;
  /** The letterbox bars, 0 gone to 1 in. */
  bars: number;
  /** The line and the title, 0 to 1. */
  words: number;
  /** True once the player has control. */
  done: boolean;
}

export interface Opening {
  /** Seconds since it began. */
  readonly time: number;
  readonly length: number;
  readonly done: boolean;
  readonly skipped: boolean;
  /** Moves it on. Real seconds: the rules are paused while it plays. */
  advance(dt: number): void;
  /** Ends it: a short dip to black, then the hero. Again does nothing. */
  skip(): void;
  /** The moment now. `out` is filled and returned, so a call every frame makes no garbage. */
  frame(out?: OpeningFrame): OpeningFrame;
}

export function createOpening(shots: readonly OpeningShot[]): Opening {
  const starts: number[] = [];
  let length = 0;
  for (const shot of shots) {
    starts.push(length);
    length += shot.seconds;
  }
  let time = 0;
  let skippedAt = -1;

  const opening: Opening = {
    get time() { return time; },
    length,
    get done() {
      return skippedAt >= 0 ? time >= skippedAt + SKIP_DOWN + SKIP_UP : time >= length;
    },
    get skipped() { return skippedAt >= 0; },
    advance(dt) {
      if (dt > 0 && !opening.done) time += dt;
    },
    skip() {
      if (skippedAt < 0 && !opening.done) skippedAt = time;
    },
    frame(out = { shot: 0, move: 0, black: 1, bars: 1, words: 0, done: false }) {
      out.done = opening.done;
      if (out.done) {
        // Over: the hero, as play begins.
        out.shot = shots.length - 1;
        out.move = 1;
        out.black = out.bars = out.words = 0;
        return out;
      }
      if (skippedAt >= 0) {
        const since = time - skippedAt;
        const playing = playingAt(skippedAt);
        if (since < SKIP_DOWN) {
          // The shot holds where it was while the screen goes dark.
          Object.assign(out, playing, { black: Math.max(playing.black, since / SKIP_DOWN), words: playing.words * (1 - since / SKIP_DOWN) });
        } else {
          const up = clamp01((since - SKIP_DOWN) / SKIP_UP);
          out.shot = shots.length - 1;
          out.move = 1;
          out.black = 1 - up;
          out.bars = 1 - up;
          out.words = 0;
        }
        return out;
      }
      return Object.assign(out, playingAt(time));
    },
  };

  function playingAt(t: number): Omit<OpeningFrame, 'done'> {
    let shot = shots.length - 1;
    while (shot > 0 && t < starts[shot]) shot--;
    const def = shots[shot];
    const into = t - starts[shot];
    const left = def.seconds - into;
    const last = shot === shots.length - 1;
    let black = 0;
    if (shot === 0) black = Math.max(black, 1 - into / FADE_IN);
    else black = Math.max(black, 1 - into / DIP);
    if (!last) black = Math.max(black, 1 - left / DIP);
    const words = Math.min(clamp01((into - LINE_IN) / LINE_FADE), clamp01((left - LINE_OUT) / LINE_FADE));
    return {
      shot,
      move: easeInOut(clamp01(into / def.seconds)),
      black: clamp01(black),
      bars: last ? clamp01(left / BARS_OUT) : 1,
      words,
    };
  }

  return opening;
}

/** Whether a game that just started plays the opening. */
export function playsOpening(options: { fresh: boolean; chosen: boolean; flags: Flags }): boolean {
  return options.fresh && options.chosen && !options.flags.is(OPENING_FLAG);
}

// The title's New game marks the choice for this tab. A New game during a game reloads the page first,
// so the mark lives in sessionStorage and is taken by the start that follows.
const CHOSEN_KEY = 'greenhollow.opening';

/** Called by the title's New game. */
export function markNewGame(storage: Pick<Storage, 'setItem'> | null = sessionStore()): void {
  try {
    storage?.setItem(CHOSEN_KEY, '1');
  } catch {
    // No storage at all: the game starts without the opening.
  }
}

/** True when the start now was the title's New game. It clears the mark. */
export function takeNewGame(storage: Pick<Storage, 'getItem' | 'removeItem'> | null = sessionStore()): boolean {
  try {
    const chosen = storage?.getItem(CHOSEN_KEY) === '1';
    storage?.removeItem(CHOSEN_KEY);
    return chosen;
  } catch {
    return false;
  }
}

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
