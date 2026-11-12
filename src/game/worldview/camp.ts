// What the camp's fire is doing, shared by the view that draws it (src/game/views/world-camp.view.ts) and a
// film that holds it (src/game/views/story-cutscene.view.ts). Kept per `GameView`, not as a global.
import type { GameView } from '../shell/view.ts';

/** The fire as a film holds it: its light (1 burning well), whether it is the low fire, and its sound close by. */
export interface HeldFire {
  light: number;
  low: boolean;
  sound: number;
}

export interface Camp {
  /** Set by a film while it plays, null otherwise. The camp view then draws the fire as the film says. */
  held: HeldFire | null;
}

const camps = new WeakMap<GameView, Camp>();

export function campOf(view: GameView): Camp {
  let camp = camps.get(view);
  if (!camp) camps.set(view, (camp = { held: null }));
  return camp;
}
