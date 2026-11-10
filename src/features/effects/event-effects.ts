// Which effect answers which game event. No Three.js here.
import type { GameEvent } from '../../engine/events.ts';
import type { Surface, Vec3 } from '../../engine/types.ts';
import { footstepEffect, surfaceColor } from '../../content/effects.ts';
import type { ParticleStore } from './particles.ts';

function kick(store: ParticleStore, surface: Surface, at: Vec3, scale: number): number {
  const step = footstepEffect[surface];
  if (!step) return 0;
  return store.emit(step.effect, at.x, at.y + 0.05, at.z, { color: step.color, scale: (step.scale ?? 1) * scale });
}

/**
 * Plays the effect for an event and returns how many particles it started.
 * Block events are taken to be at the center of the block.
 */
export function playEvent(store: ParticleStore, event: GameEvent): number {
  switch (event.type) {
    case 'footstep':
      return kick(store, event.surface, event.at, 1);
    case 'land':
      return kick(store, event.surface, event.at, 2);
    case 'jump':
      return store.emit('dust', event.at.x, event.at.y + 0.05, event.at.z, { scale: 0.6 });
    case 'blockBroken':
      return store.emit('chips', event.at.x, event.at.y, event.at.z, { color: surfaceColor[event.surface] });
    case 'blockPlaced':
      return store.emit('pop', event.at.x, event.at.y - 0.5, event.at.z);
    case 'pickup':
      return store.emit('trail', event.at.x, event.at.y, event.at.z);
    default:
      return 0;
  }
}
