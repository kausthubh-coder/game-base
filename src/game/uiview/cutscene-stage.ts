// How another view asks the director (src/game/views/story-cutscene.view.ts) for a film: the experiment badge's
// button, and anything later that wants a scene on a click. Kept per `GameView`, not as a global. The director
// fills it in when it installs; before that, and in a game without it, a call does nothing.
import type { GameView } from '../shell/view.ts';

export interface Stage {
  /**
   * Sets the game up for a film's scene and plays it: a new game when none is running, then the quest, the place
   * and the hour the film's `setup` names. From a click, so the sound can start. False for a scene with no film.
   */
  play(scene: string): boolean;
  /** True while a film is on screen. */
  readonly playing: boolean;
}

const stages = new WeakMap<GameView, Stage>();
const NONE: Stage = { play: () => false, playing: false };

export function stageOf(view: GameView): Stage {
  return stages.get(view) ?? NONE;
}

/** The director hands itself in here. */
export function setStage(view: GameView, stage: Stage): void {
  stages.set(view, stage);
}
