// Stations and furniture the player sets down, as data. `prop` names the prop that draws it.
import type { PlaceableDef } from '../api.sim.ts';
import { HOME_PLACEABLES } from './people.ts';

export const PLACEABLES: readonly PlaceableDef[] = [
  { kind: 'workbench', name: 'Workbench', prop: 'workbench', size: [1, 1, 1], prompt: 'Craft', station: 'workbench', backs: true },
  { kind: 'bed', name: 'Bed', prop: 'bed', size: [1, 1, 2], prompt: 'Sleep', station: 'bed' },
  { kind: 'chest', name: 'Chest', prop: 'chest', size: [1, 1, 1], prompt: 'Open', station: 'chest', backs: true },
  // A fence is one post to a cell. The stations view joins it to the fences beside it with rails.
  { kind: 'fence', name: 'Fence', prop: 'fence', size: [1, 1, 1], prompt: null, joins: true },

  // The machine parts and simple builds of handbook chapter 30. The machines system runs them and the machines view
  // draws each with its state (working, starved, backed up) and its moving piece, so the stations view leaves them.
  // `prop` is the part's model in src/content/props.ts, which build mode shows as the ghost.
  { kind: 'waterwheel', name: 'Waterwheel', prop: 'partWheel', size: [1, 1, 1], prompt: null, drawnBy: 'machines' },
  { kind: 'gear_shaft', name: 'Gear shaft', prop: 'partShaft', size: [1, 1, 1], prompt: null, drawnBy: 'machines' },
  { kind: 'lever', name: 'Lever', prop: 'partLever', size: [1, 1, 1], prompt: 'Pull', drawnBy: 'machines' },
  { kind: 'sprinkler', name: 'Sprinkler', prop: 'partSprinkler', size: [1, 1, 1], prompt: null, waters: 1, drawnBy: 'machines' },
  { kind: 'chute', name: 'Chute', prop: 'partChute', size: [1, 1, 1], prompt: null, drawnBy: 'machines' },
  { kind: 'collector_chest', name: 'Collector chest', prop: 'partCollector', size: [1, 1, 1], prompt: 'Open', station: 'collector', drawnBy: 'machines', backs: true },
  { kind: 'pusher', name: 'Pusher', prop: 'partPusher', size: [1, 1, 1], prompt: null, drawnBy: 'machines' },
  { kind: 'sensor', name: 'Sensor', prop: 'partSensor', size: [1, 1, 1], prompt: 'Set what it watches', drawnBy: 'machines' },
  { kind: 'switch_lamp', name: 'Switchable lamp', prop: 'partSwitchableLamp', size: [1, 1, 1], prompt: null, drawnBy: 'machines' },
  { kind: 'harvester_arm', name: 'Harvester arm', prop: 'partArm', size: [1, 1, 1], prompt: null, drawnBy: 'machines' },
  { kind: 'saw_arm', name: 'Saw arm', prop: 'partSawArm', size: [1, 1, 1], prompt: null, drawnBy: 'machines' },
  { kind: 'bee_box', name: 'Bee box', prop: 'partBeeBox', size: [1, 1, 1], prompt: null, drawnBy: 'machines' },
  { kind: 'post', name: 'Post', prop: 'partFence', size: [1, 1, 1], prompt: null, drawnBy: 'machines' },
  { kind: 'clapper', name: 'Clapper', prop: 'partClapper', size: [1, 1, 1], prompt: null, drawnBy: 'machines' },
  { kind: 'hatch', name: 'Hatch', prop: 'partHatch', size: [1, 1, 1], prompt: 'Open or shut', drawnBy: 'machines' },
  // The settlement's buildings: the oven, the homes, the dinner table and the rest.
  ...HOME_PLACEABLES,
];

/** The size along x, y and z after turning: an odd number of quarter turns swaps x and z. */
export function footprint(size: readonly [number, number, number], quarterTurns: number): [number, number, number] {
  return quarterTurns & 1 ? [size[2], size[1], size[0]] : [size[0], size[1], size[2]];
}
