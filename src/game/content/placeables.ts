// Stations and furniture the player sets down, as data. `prop` names the prop that draws it.
import type { PlaceableDef } from '../api.sim.ts';

export const PLACEABLES: readonly PlaceableDef[] = [
  { kind: 'workbench', name: 'Workbench', prop: 'workbench', size: [1, 1, 1], prompt: 'Craft', station: 'workbench', backs: true },
  { kind: 'bed', name: 'Bed', prop: 'bed', size: [1, 1, 2], prompt: 'Sleep', station: 'bed' },
  { kind: 'chest', name: 'Chest', prop: 'chest', size: [1, 1, 1], prompt: 'Open', station: 'chest', backs: true },
  // A fence is one post to a cell. The stations view joins it to the fences beside it with rails.
  { kind: 'fence', name: 'Fence', prop: 'fence', size: [1, 1, 1], prompt: null, joins: true },
  { kind: 'sprinkler', name: 'Sprinkler', prop: 'sprinkler', size: [1, 1, 1], prompt: null, waters: 2 },
];

/** The size along x, y and z after turning: an odd number of quarter turns swaps x and z. */
export function footprint(size: readonly [number, number, number], quarterTurns: number): [number, number, number] {
  return quarterTurns & 1 ? [size[2], size[1], size[0]] : [size[0], size[1], size[2]];
}
