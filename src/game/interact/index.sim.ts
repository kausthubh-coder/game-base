// The "E" prompt registry. Anything the player can walk up to and use adds a target here: people,
// pets, placed stations. The interface shows the prompt of the nearest one, and the E key runs it.
import type { InteractApi, Interactable } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';

export function install(kernel: Kernel): void {
  const game = kernel.game;
  const targets = new Map<string, Interactable>();

  function nearest(): Interactable | null {
    // While a panel or a conversation has the player, nothing can be used, so no prompt shows either.
    if (game.player.busy) return null;
    const p = game.player.pos;
    let best: Interactable | null = null, bestSq = Infinity;
    for (const target of targets.values()) {
      const at = target.pos();
      const dx = at.x - p.x, dy = at.y - p.y, dz = at.z - p.z;
      const sq = dx * dx + dy * dy + dz * dz;
      if (sq > target.radius * target.radius || sq >= bestSq) continue;
      if (target.prompt() === null) continue;
      best = target;
      bestSq = sq;
    }
    return best;
  }

  const api: InteractApi = {
    /** A target with an id that is already there replaces the old one. */
    add(target) {
      targets.set(target.id, target);
    },
    remove(id) {
      targets.delete(id);
    },
    nearest,
    act() {
      const target = nearest();
      if (!target) return false;
      target.act();
      return true;
    },
  };

  // Nothing to save: whoever added a target adds it again when it loads.
  kernel.add('interact', api, {});
}
