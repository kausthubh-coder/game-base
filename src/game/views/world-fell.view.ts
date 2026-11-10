// A tree being felled throws wood chips at each stroke, and when it comes down its crown bursts into
// leaves over the whole space it stood in.
import type { GameView } from '../shell/view.ts';

/** Seconds between strokes while the button is held on a tree. */
const STROKE = 0.3;

export function install(view: GameView): void {
  const { game } = view;
  const at = { x: 0, y: 0, z: 0 };
  let since = 0;

  view.onFrame((dt) => {
    const breaking = game.systems.actions?.breaking() ?? null;
    if (!breaking?.tree) {
      since = STROKE;
      return;
    }
    since += dt;
    if (since < STROKE) return;
    since = 0;
    at.x = breaking.x + 0.5; at.y = breaking.y + 0.6; at.z = breaking.z + 0.5;
    view.effects.play('chips', at);
  });

  game.events.on('tree.felled', ({ x, y, z, box }) => {
    at.x = x + 0.5; at.y = y + 0.5; at.z = z + 0.5;
    view.effects.play('chips', at);
    // Bursts spread over the crown, about one for every nine blocks of its top.
    const w = box.x1 - box.x0, d = box.z1 - box.z0, top = box.y1 - 1;
    for (let i = 0; i < w; i += 2) for (let k = 0; k < d; k += 2) {
      at.x = box.x0 + i + 1; at.y = top - ((i + k) & 1); at.z = box.z0 + k + 1;
      view.effects.play('leafBurst', at);
    }
  });
}
