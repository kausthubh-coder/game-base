// The twelve fights of act 1 and the night visitors, fought where they start in the world: the fight lab's rules,
// keys and picture on a stage made from the ground there, with the world's HUD (`src/game/fightview/world.ts`).
// The fights system (`src/game/fights`) says when one runs; this view steps it with the hero's body and draws it.
//
// The fight lab (`?scene=fight`, `?scene=stag`) has the body to itself, so this view stays out of it.
import { createWorldFights } from '../fightview/world.ts';
import type { GameView } from '../shell/view.ts';

export function install(view: GameView): void {
  const scene = new URLSearchParams(location.search).get('scene');
  if (scene === 'fight' || scene === 'stag') return;
  createWorldFights(view);
}
