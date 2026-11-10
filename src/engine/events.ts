import type { Surface, Vec3 } from './types.ts';

/** Things that happen in the world that sound, effects or the interface may react to. */
export type GameEvent =
  | { type: 'footstep'; surface: Surface; at: Vec3 }
  | { type: 'jump'; at: Vec3 }
  | { type: 'land'; surface: Surface; at: Vec3 }
  | { type: 'blockPlaced'; surface: Surface; at: Vec3 }
  | { type: 'blockBroken'; surface: Surface; at: Vec3 }
  | { type: 'pickup'; at: Vec3 }
  | { type: 'thunder'; at: Vec3 }
  | { type: 'ui'; sound: 'click' | 'open' | 'close' };

export interface Bus<E extends { type: string }> {
  emit(event: E): void;
  on(listener: (event: E) => void): () => void;
}

export function createBus<E extends { type: string }>(): Bus<E> {
  const listeners = new Set<(event: E) => void>();
  return {
    emit(event) {
      for (const listener of listeners) listener(event);
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
