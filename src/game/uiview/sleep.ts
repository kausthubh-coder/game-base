// The sleep card's clock. Sleeping fades the screen to dark, the world moves to morning while it is
// dark, a card says the day and the hour, and the screen fades back in. The time system jumps the clock
// only when this calls `wake`, through its sleep curtain (src/game/time). No page here, so the tests run
// it. The view is src/game/views/story-sleep.view.ts.
//
// It runs on the rules' steps, so `window.__game.advance` moves it as it moves the clock, and the pause
// menu holds it.
import { clockText } from '../../features/hud/hud.sim.ts';
import type { Game } from '../api.sim.ts';
import type { TimeWithCurtain } from '../time/index.sim.ts';

/** Seconds of each part: down to dark, the card, and back up. The card fades in and out inside its own. */
export const SLEEP_DOWN = 1, SLEEP_CARD = 2.2, SLEEP_UP = 1.2;
const CARD_FADE = 0.35;

export interface SleepCardFrame {
  /** True from `sleep()` until the screen is clear again. */
  active: boolean;
  /** Black over the world, 0 to 1. */
  black: number;
  /** The card, 0 to 1. */
  card: number;
  /** "Day 2". */
  day: string;
  /** The hour woken at, as the HUD's clock shows it: "06:28". */
  hour: string;
}

export interface SleepCard {
  /** One step of the rules. */
  step(dt: number): void;
  readonly frame: Readonly<SleepCardFrame>;
  /** Takes the curtain off the time system. */
  dispose(): void;
}

/** True when this time system takes a sleep curtain. Fakes in tests do not. */
export function hasCurtain(time: unknown): time is TimeWithCurtain {
  return typeof time === 'object' && time !== null && 'setSleepCurtain' in time;
}

export function createSleepCard(game: Game, time: TimeWithCurtain): SleepCard {
  const frame: SleepCardFrame = { active: false, black: 0, card: 0, day: '', hour: '' };
  let wake: (() => void) | null = null;
  /** Seconds since `sleep()`, or -1 when not sleeping. */
  let t = -1;

  time.setSleepCurtain((next) => {
    wake = next;
    t = 0;
    frame.active = true;
  });

  const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
  /** Slow at both ends, so the dark settles like closing eyes. */
  const soft = (n: number): number => n * n * (3 - 2 * n);

  return {
    frame,
    step(dt) {
      if (t < 0) return;
      t += dt;
      if (wake && t >= SLEEP_DOWN) {
        const go = wake;
        wake = null;
        go();
        frame.day = `Day ${game.clock.day}`;
        frame.hour = clockText(game.clock.timeOfDay);
      }
      const inCard = t - SLEEP_DOWN;
      const inUp = inCard - SLEEP_CARD;
      if (t < SLEEP_DOWN) frame.black = soft(t / SLEEP_DOWN);
      else if (inUp < 0) frame.black = 1;
      else frame.black = 1 - soft(clamp01(inUp / SLEEP_UP));
      frame.card = inCard < 0 || inUp >= 0 ? 0 : Math.min(clamp01(inCard / CARD_FADE), clamp01((SLEEP_CARD - inCard) / CARD_FADE));
      if (inUp >= SLEEP_UP) {
        t = -1;
        frame.active = false;
        frame.black = 0;
        frame.card = 0;
      }
    },
    dispose() {
      time.setSleepCurtain(null);
    },
  };
}
