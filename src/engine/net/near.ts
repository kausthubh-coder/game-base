// What one browser knows of the world near its player, built up from the server's snaps. A snap holds
// only what changed, so someone has to keep the rest: this does, for the actors and the placed things.
// Changed blocks are not kept here. They go straight into the browser's own world, from each snap.
import type { ActorState, BodyState, PlacedState, Snap } from './messages.ts';

export interface Near {
  /** The server's step count at the last snap. -1 before the first. */
  step: number;
  /** The number of the last input the server used. */
  ack: number;
  /** This player's own body at that step, or null before the first snap. */
  you: BodyState | null;
  day: number;
  time: number;
  /** Everyone else in range, by actor id. */
  readonly actors: Map<string, ActorState>;
  /** Every placed thing in range, by id. */
  readonly placed: Map<string, PlacedState>;
}

export function createNear(): Near {
  return { step: -1, ack: 0, you: null, day: 1, time: 0, actors: new Map(), placed: new Map() };
}

/** Takes one snap in. Snaps must be applied in the order they arrive. */
export function applySnap(near: Near, snap: Snap): void {
  near.step = snap.step;
  near.ack = snap.ack;
  near.you = snap.you;
  near.day = snap.day;
  near.time = snap.time;
  if (snap.gone) for (const id of snap.gone) near.actors.delete(id);
  if (snap.actors) for (const actor of snap.actors) near.actors.set(actor.id, actor);
  if (snap.unplaced) for (const id of snap.unplaced) near.placed.delete(id);
  if (snap.placed) for (const placed of snap.placed) near.placed.set(placed.id, placed);
}
