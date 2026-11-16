// The opening of act 1, as data: what grant day at Saltgate says that is the opening's own, and the shots of the
// day up the river.
//
// The scenes themselves (handbook chapter 22, scenes 1 to 7) are `scene.<n>` in content/dialogue.ts, with the rack's
// choice `choice.weapon`; the story director starts each as the player comes near its place, and the opening
// answers where those places are in Saltgate. Here are only Hobb's porridge and the end of the bout with Dax,
// which the opening plays when the player has eaten it and won it. The film before all of it is `demos/opening`.

import type { Conversation, Line } from './dialogue.ts';
import { FLAG } from './flags.ts';
import type { NpcId } from './ids.ts';

/** Every conversation the opening starts, by what it is. A test checks each is in CONVERSATIONS. */
export const TALK = {
  porridge: 'grantday.porridge',
  /** The rack's choice, from content/dialogue.ts. */
  rack: 'choice.weapon',
  /** Dax's "Go on. Hit me", from content/dialogue.ts: the bout starts as it ends. */
  spar: 'scene.4.before',
  bout: 'grantday.bout',
} as const;

/** A conversation the opening starts by its id, each line naming who says it. */
const SCENE: NpcId = 'scene';
const narrator = (text: string): Line => ({ by: 'narrator', text });
const hobb = (text: string): Line => ({ by: 'hobb', text });
const dax = (text: string, mood?: Line['mood']): Line => ({ by: 'dax', text, ...(mood ? { mood } : {}) });

export const OPENING_TALKS: readonly Conversation[] = [
  {
    id: TALK.porridge,
    npc: SCENE,
    lines: [
      narrator('Porridge, with honey on it, and a spoon standing up in it. You eat all of it.'),
      hobb('Good. Now you\'ll last till noon. Dax is at the lock table.'),
    ],
  },
  // The end of scene 4, once the bout is won: chapter 22's lines after the bout. Scene 4's own conversation
  // (`scene.4`) narrates the bout for a game without the opening's; this one ends the scene in its place.
  {
    id: TALK.bout,
    npc: SCENE,
    kind: 'staged',
    lines: [
      dax('(shaking out his arm) Fine. You\'ll do.', 'glad'),
      { ...dax('I\'m coming up anyway. Once you\'ve got a roof.'), effects: [{ flag: FLAG.scene(4) }, { emit: 'scene.played', data: { scene: 4 } }] },
    ],
  },
];

/** The spots of Saltgate the story's scenes and the quest waypoints name, `saltgate.<name>`, and `saltgate` itself. */
export const PLACE_SPOTS = {
  saltgate: 'gate',
  'saltgate.bunks': 'bunk',
  'saltgate.kitchen': 'porridge',
  'saltgate.locks': 'locks',
  'saltgate.maps': 'maps',
  'saltgate.yard': 'ring',
  'saltgate.rack': 'rack',
  'saltgate.deed': 'deed',
  'saltgate.quay': 'berth',
} as const;

// ------------------------------------------------------------------------------------------ the river

export type Offset = readonly [east: number, up: number, south: number];

/**
 * One shot of a camera move over the real world, the way the day up the river is shown: the lens moves from
 * `from` to `to` looking from `look` to `lookTo`, every point blocks east, up and south of a place of the region.
 */
export interface OpeningShot {
  id: string;
  /** Seconds on screen, fades included. */
  seconds: number;
  /** The place the offsets start from. */
  place: string;
  from: Offset;
  to: Offset;
  look: Offset;
  lookTo: Offset;
  /** The vertical field of view in degrees. The game's own lens is 20. */
  fov: number;
  /** A place name set large over the shot. */
  title?: string;
  /** The words under the shot. */
  line: string;
  /** The shot ends on the game's own camera over the hero, with no fade, and play begins. */
  land?: boolean;
}

/** A day up the Mere on the ferry, from the marsh to the landing (chapter 27, quest 1, step 10). */
export const RIVER: readonly OpeningShot[] = [
  {
    // Lantern Marsh, where the Mere widens toward the sea, looking up the river.
    id: 'marsh',
    seconds: 6,
    place: 'shrine-marsh',
    from: [34, 16, 30],
    to: [24, 12, 6],
    look: [10, 0, -14],
    lookTo: [-4, 0, -30],
    fov: 32,
    title: 'The Mere',
    line: 'A day up the river.',
  },
  {
    // The Pump House on its bank, seen from the water. The line says only what the shot shows: the model has no door
    // on this side, and nobody stands by it.
    id: 'door',
    seconds: 6.5,
    place: 'pumphouse',
    from: [-46, 15, 46],
    to: [-38, 13, 38],
    look: [-10, 7, -4],
    lookTo: [-8, 7, -6],
    fov: 34,
    line: 'The Pump House on its bank. Its wheel has not turned in years.',
  },
  {
    // Up the river to where the High Road crosses it: its first lit arches, and the wood north of them gone grey.
    id: 'grey',
    seconds: 7,
    place: 'arches',
    from: [110, 12, 30],
    to: [108, 12, 18],
    look: [112, 7, -9],
    lookTo: [96, 8, -30],
    fov: 36,
    line: 'A wood gone grey, under a road that glows gold.',
  },
  {
    // Up the last stretch from the south to the landing, where the game's camera takes the hero.
    id: 'landing',
    seconds: 6,
    place: 'landing',
    from: [6, 10, 26],
    to: [0, 0, 0],
    look: [-1, 1, -3],
    lookTo: [0, 0, 0],
    fov: 26,
    line: 'The ferry bumps the jetty.',
    land: true,
  },
];
