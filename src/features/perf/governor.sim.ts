// Automatic quality. When the frame rate stays under the low mark it gives something up: render
// size first, effects second. When the rate holds above the high mark it takes them back, in the
// opposite order. A step up that fails makes it wait longer before it tries again, so it settles
// and does not flicker between two levels.
import type { Quality } from '../../engine/types.ts';

export interface GovernorStep {
  quality: Quality;
  /** The share of the full render size on each axis, 1 is full size. */
  scale: number;
}

export interface GovernorOptions {
  /** Under this many frames a second the game is too slow. */
  low: number;
  /** Above this many it has room to spare. */
  high: number;
  /** Seconds the rate must stay low before a step down. */
  lowHold: number;
  /** Seconds the rate must stay high before a step up. */
  highHold: number;
  /** The steps, best first. */
  ladder: readonly GovernorStep[];
}

export const DEFAULT_GOVERNOR: GovernorOptions = {
  low: 50,
  high: 58,
  lowHold: 2,
  highHold: 4,
  ladder: [
    { quality: 'high', scale: 1 },
    { quality: 'high', scale: 0.85 },
    { quality: 'high', scale: 0.7 },
    { quality: 'medium', scale: 0.7 },
    { quality: 'low', scale: 0.7 },
  ],
};

export class Governor {
  readonly options: GovernorOptions;
  /** The step in use, as an index into the ladder. 0 is the best. */
  level = 0;
  private below = 0;
  private above = 0;
  private sinceRaise = Infinity;
  private patience = 1;

  constructor(options: Partial<GovernorOptions> = {}) {
    this.options = { ...DEFAULT_GOVERNOR, ...options };
  }

  get step(): GovernorStep {
    return this.options.ladder[this.level];
  }

  /** Feed it the current frame rate every frame. True when the step changed. */
  update(dt: number, fps: number): boolean {
    const o = this.options;
    this.sinceRaise += dt;
    this.below = fps < o.low ? this.below + dt : 0;
    this.above = fps > o.high ? this.above + dt : 0;

    if (this.below >= o.lowHold && this.level < o.ladder.length - 1) {
      // A drop soon after a step up means that step was too much. Wait longer next time.
      this.patience = this.sinceRaise < 10 ? Math.min(this.patience * 2, 16) : this.patience;
      this.level++;
      this.below = 0;
      this.above = 0;
      return true;
    }
    if (this.above >= o.highHold * this.patience && this.level > 0) {
      this.level--;
      this.below = 0;
      this.above = 0;
      this.sinceRaise = 0;
      return true;
    }
    return false;
  }

  reset(level = 0): void {
    this.level = Math.max(0, Math.min(this.options.ladder.length - 1, level));
    this.below = 0;
    this.above = 0;
    this.sinceRaise = Infinity;
    this.patience = 1;
  }
}
