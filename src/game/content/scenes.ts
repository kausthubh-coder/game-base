// The 38 scenes of act 1 (handbook chapter 22), as data: how each is shown, where it plays, who stands in it and
// what starts it. The words are conversations in ./dialogue.ts with the id `scene.<n>`, and `scene.<n>.before` for
// the lines said before a fight. The story director (src/game/story) starts them, the talk system plays them and
// sets `scene.<n>` when one ends, and the stage view (src/game/views/story-stage.view.ts) frames them.
//
// The kinds are `playthrough/content.js` `sceneKinds` (docs/cutscenes.md, "Three kinds of scene"):
//   film    the scene takes the camera: bars, no HUD, the lines timed under the picture, Esc skips it all
//   staged  the camera frames the people, and the player turns the lines in the dialogue box
//   talk    the game's own camera, and the dialogue box
// A film made shot by shot in ./cutscenes.ts (scene 9) plays there instead.

import type { PersonId, SceneNumber } from './ids.ts';

export type SceneKind = 'film' | 'staged' | 'talk';

/**
 * What starts a scene once its quest step is open:
 *   near   the player comes within `NEAR_SCENE` blocks of `at`, or at once when the region has no such place
 *   now    at once, wherever the player is
 *   npc    the player talks to the person the step marks; at once when that person is not in the world
 *   hall   src/game/hall starts it by its conversation id on the first night
 *   film   the film director plays it from ./cutscenes.ts
 *   fight  after the step's fight is won (or denied), `scene.<n>.before` having played as the fight began
 *   stone  the player touches a memory stone
 *   sleep  the player sleeps
 *   vault  the player comes out of the first vault they open
 */
export type SceneStart = 'near' | 'now' | 'npc' | 'hall' | 'film' | 'fight' | 'sleep' | 'vault' | 'stone';

export interface SceneCast {
  who: PersonId;
  /** Use this authored mark even when the scheduled person is nearby. */
  exact?: boolean;
  /** Blocks east and south of where the scene is staged. */
  x: number;
  z: number;
}

export interface SceneDef {
  n: SceneNumber;
  title: string;
  kind: SceneKind;
  start: SceneStart;
  /** A region place: where it plays and where the camera frames it. Without one, it is staged round the player. */
  at?: string;
  /** Who stands in it. Anyone the people system does not have there is stood in for while it plays. North of the
   * place (z below 0), so they face the player and the camera, which looks from the south. */
  cast?: readonly SceneCast[];
  /** A memory or a dream, not the present: the picture is washed warm, and the player is not in it. */
  memory?: boolean;
  /** A `near` scene in a room starts this close instead of `NEAR_SCENE`, so its people are on the screen when it does. */
  within?: number;
  /** How it is acted beyond who stands in it. */
  staging?: SceneStaging;
}

/**
 * What a scene shows beyond its cast (src/game/views/story-stage.view.ts). Without `hero`, the hero is stood beside
 * the people, at the side of them nothing hides from the camera; the camera frames everyone who speaks and the hero.
 */
export interface SceneStaging {
  /** Where the hero stands, blocks east and south of where the scene is staged, and the way they face. */
  hero?: { x: number; z: number; face?: 'camera' | 'cast' };
  /** `close` comes in near the hero and whoever speaks; `wide` keeps the crowd and the place in. */
  shot?: 'close' | 'wide';
  /** Authored minimum lens distance when the opening line needs more depth room. */
  distance?: number;
  /** Actors framed with the people who speak, by id: the fox at the door. A scene with its own `hero` mark frames its place too. */
  frame?: readonly string[];
  /** Presentation-only actors, removed when the conversation ends or is restored. */
  actors?: readonly { id: string; sprite: string; x: number; z: number }[];
  /** Townsfolk who watch, on these spots, facing the hero. They do not count as speakers. */
  crowd?: readonly { x: number; z: number }[];
  /** Things stood for the scene, from the line that says the words `at` (from the start without it). */
  props?: readonly SceneProp[];
  /** What happens as a line with these words shows. */
  beats?: readonly { at: string; do: SceneBeat }[];
}

export interface SceneProp {
  /** A kind of src/content/props.ts and its variant. */
  kind: string;
  variant: number;
  /** Blocks east and south of where the scene is staged, or of this person of its cast where they stand. */
  x: number;
  z: number;
  by?: PersonId;
  turn?: number;
  scale?: number;
  at?: string;
}

/**
 * hand   the Mark glows in the hero's hand while the line shows
 * wake   the speaker opens its eyes and gets up: its sleeping look and the sleeping mark go
 * face   the hero turns to face the camera
 */
export type SceneBeat = 'hand' | 'wake' | 'face';

/** Stage cues in the lines (src/game/talk/cues.sim.ts) and what the stage does for each. Any other cue turns the speaker to the hero. */
export const CUE_BEATS: Readonly<Record<string, SceneBeat>> = {
  'one eye opening': 'wake',
  'waking, not getting up': 'wake',
};

/** A row of people along a path: `n` of them from (x, z), a step `dx`, `dz` apart. */
const row = (n: number, x: number, z: number, dx: number, dz: number): { x: number; z: number }[] =>
  Array.from({ length: n }, (_, i) => ({ x: x + dx * i, z: z + dz * i }));

/** How close the player comes to a scene's place before a `near` scene starts. */
export const NEAR_SCENE = 12;

const c = (who: PersonId, x: number, z: number): SceneCast => ({ who, x, z });

export const SCENES: readonly SceneDef[] = [
  // ---------------------------------------------------------------------------- chapter 1: the Shut Door
  // Saltgate is the opening's set. Until it has places, its scenes play where the player stands.
  { n: 1, title: 'Grant day', kind: 'staged', start: 'near', at: 'saltgate.bunks', cast: [c('hobb', 2, -1)], staging: { shot: 'close' } },
  { n: 2, title: 'The last lock', kind: 'staged', start: 'near', at: 'saltgate.locks', within: 5, cast: [c('dax', 2, -2)] },
  { n: 3, title: 'The map wall', kind: 'talk', start: 'near', at: 'saltgate.maps', within: 5, cast: [c('mina', 2, -1)] },
  { n: 4, title: 'The rack', kind: 'staged', start: 'near', at: 'saltgate.yard', cast: [c('dax', 2.5, -2)] },
  { n: 5, title: 'The grant', kind: 'staged', start: 'near', at: 'saltgate.deed', within: 6, cast: [c('guildmaster', 0, -3), c('hobb', -2, -1)], staging: { shot: 'wide' } },
  { n: 6, title: 'The quay', kind: 'film', start: 'near', at: 'saltgate.quay', cast: [c('hobb', -3, -6), c('dax', 3, -8)], staging: { hero: { x: 0, z: -6, face: 'cast' } } },
  { n: 7, title: 'Ground nobody wanted', kind: 'film', start: 'near', at: 'landing' },
  { n: 8, title: 'The door, by day', kind: 'staged', start: 'hall', at: 'shut.door' },
  { n: 9, title: 'Something outside', kind: 'film', start: 'film', at: 'camp' },
  // Your back against the stone door, facing the fox and the camera.
  { n: 10, title: 'The door', kind: 'film', start: 'hall', at: 'shut.door', staging: { hero: { x: 0, z: 1.2, face: 'camera' }, shot: 'close', frame: ['fox:blighted'] } },
  // The lamps wake one after another, then the hand burns: the hero turned to the camera, close.
  { n: 11, title: 'The Mark', kind: 'film', start: 'hall', at: 'hall.heart', staging: {
    hero: { x: 0, z: 2, face: 'camera' }, shot: 'wide', beats: [{ at: 'Lamps wake', do: 'face' }, { at: 'Your hand burns', do: 'hand' }, { at: 'The ring stays', do: 'hand' }],
  } },
  // West of the plinth: the small Custodian stays beside the hero even from the incoming north-west lens.
  { n: 12, title: '"You\'re late."', kind: 'staged', start: 'hall', at: 'hall.custodian', staging: { hero: { x: -2, z: 0, face: 'cast' }, shot: 'close', beats: [{ at: 'Show me', do: 'hand' }] } },
  { n: 13, title: 'The fox', kind: 'film', start: 'hall', at: 'hall.door', staging: { hero: { x: -2, z: 4, face: 'cast' }, shot: 'close', frame: ['fox:blighted'], beats: [{ at: 'marked hand', do: 'hand' }] } },
  { n: 14, title: 'The Heartstone', kind: 'staged', start: 'hall', at: 'hall.heart' },
  // Half of Hollowmere at your fence. The speakers and hero stand on the level ground west of the stone,
  // away from the eastern slope and its tree; the crowd keeps its fence-side marks.
  { n: 15, title: 'The morning after', kind: 'staged', start: 'npc', at: 'grant.stone', cast: [{ ...c('tamsin', -8, -2), exact: true }, { ...c('aldric', -11, -2), exact: true }], staging: {
    hero: { x: -5, z: -2, face: 'cast' }, shot: 'wide', crowd: [...row(4, -6, -5, 1.6, -0.3), ...row(3, 3, -6, 1.5, 0.2)], beats: [{ at: 'into your marked hand', do: 'hand' }],
  } },
  // ---------------------------------------------------------------------------- chapter 2: the herald
  // The blessing stands on the level western ground. Exact marks keep scheduled villagers out of the cast.
  { n: 16, title: 'The blessing', kind: 'film', start: 'near', at: 'grant.stone', cast: [
    { ...c('elowen', -7, -2), exact: true }, { ...c('calla', -9, -2), exact: true },
    { ...c('aldric', -11, -2), exact: true }, { ...c('tamsin', -13, -2), exact: true },
  ], staging: {
    shot: 'wide', distance: 44, hero: { x: -5, z: -2, face: 'cast' },
    crowd: [...row(4, -6, -9, -2.5, 0), ...row(4, -6, 6, -2.5, 0)],
    props: [{ kind: 'crate', variant: 0, by: 'elowen', x: 0, z: -3.5, turn: 0.4, scale: 1.4, at: 'set down a crate' }],
    beats: [{ at: 'looks at the Mark', do: 'hand' }],
  } },
  { n: 17, title: 'What the Custodian thinks', kind: 'talk', start: 'near', at: 'hall.heart' },
  // Dax carries a crate the size of a door.
  { n: 18, title: 'Hobb and Dax', kind: 'staged', start: 'near', at: 'grant.stone', cast: [c('hobb', 1, -1), c('dax', 3, -1)], staging: {
    props: [{ kind: 'crate', variant: 0, by: 'dax', x: 1.1, z: -1.1, turn: 0.2, scale: 1.8 }],
  } },
  { n: 19, title: 'In the field at night', kind: 'staged', start: 'fight', at: 'plot', cast: [c('dax', 2, -1)] },
  { n: 20, title: 'The grey wood', kind: 'staged', start: 'near', at: 'boar', cast: [c('wren', 2, -2)] },
  { n: 21, title: 'Not yet', kind: 'staged', start: 'fight', at: 'boar', cast: [c('wren', 2, -2)] },
  // Asleep on a sack in the granary, and not getting up for anyone.
  { n: 22, title: 'The queen\'s count', kind: 'talk', start: 'npc', at: 'granary', cast: [c('maren', 0, -2)], staging: {
    props: [{ kind: 'sack', variant: 1, x: 0, z: -2.6 }],
  } },
  // North of the place stand the arches' piers: the people stand on the road south of them, under the lit tops.
  { n: 23, title: 'The road is lit', kind: 'film', start: 'near', at: 'arches', cast: [c('aldric', 2.5, 2), c('tamsin', -2.5, 2.5)] },
  // ---------------------------------------------------------------------------- chapter 3: what the ruins say
  // The mural is on the Hall's north wall: the memory plays in the court in front of it.
  { n: 24, title: 'The first Echo', kind: 'film', start: 'stone', at: 'hall.mural', cast: [c('auren', -2, 2.5), c('ilara', 2, 2)], staging: { actors: [{ id: 'echo-fox', sprite: 'fox', x: 3.6, z: 2.8 }] }, memory: true },
  { n: 25, title: 'Calla\'s seal', kind: 'staged', start: 'vault', cast: [c('calla', 2, -1)] },
  { n: 26, title: 'The pails', kind: 'film', start: 'near', at: 'pumphouse', cast: [c('auren', -1.5, 2)], memory: true },
  // Keep the speakers on distinct marks even when their scheduled selves are nearby.
  { n: 27, title: 'The pumps go quiet', kind: 'film', start: 'near', at: 'plot', cast: [
    { ...c('maren', 2, -2), exact: true }, { ...c('gus', 5, -2), exact: true }, { ...c('aldric', -2, -2), exact: true },
  ], staging: { shot: 'wide', distance: 30 } },
  { n: 28, title: 'Eight chairs', kind: 'film', start: 'near', at: 'lampgallery', cast: [c('auren', 0, -3)], memory: true },
  { n: 29, title: 'The Stag\'s nose', kind: 'film', start: 'near', at: 'seedvault', cast: [c('stag', -2, 3), c('ilara', -3, 6), c('auren', 1, 5)], staging: { shot: 'wide' }, memory: true },
  { n: 30, title: 'A hamlet', kind: 'staged', start: 'near', at: 'hall.gate', cast: [c('mina', 2, -1)], staging: { distance: 32 } },
  { n: 31, title: 'Bramble', kind: 'film', start: 'fight', at: 'boar', cast: [c('wren', 2, -2)] },
  // ---------------------------------------------------------------------------- chapter 4: the Rootworks
  { n: 32, title: 'Three keystones', kind: 'film', start: 'near', at: 'terraces', cast: [c('calla', 2, -1)], staging: { shot: 'wide', hero: { x: 0, z: -4, face: 'cast' } } },
  { n: 33, title: 'The Stag', kind: 'film', start: 'fight', at: 'terraces', cast: [c('stag', 0, -6)] },
  // ---------------------------------------------------------------------------- chapter 5: the pilgrimage
  { n: 34, title: 'Green overnight', kind: 'film', start: 'now', at: 'grant.stone', cast: [c('maren', 2, -1)] },
  { n: 35, title: 'The dream', kind: 'film', start: 'sleep', memory: true },
  { n: 36, title: 'The second blessing', kind: 'staged', start: 'near', at: 'town.square', cast: [c('elowen', 0, -2), c('ren', 2, -1), c('maren', -3, -1)] },
  { n: 37, title: '"She was kinder, before."', kind: 'film', start: 'now', at: 'terraces', cast: [c('stag', 0, -6)] },
  { n: 38, title: 'Leaving', kind: 'staged', start: 'near', at: 'grant.stone', cast: [{...c('tamsin', 1, -1),exact:true}, {...c('hobb', 4, 2),exact:true}, {...c('dax', 5, -3),exact:true}, {...c('wren', -2, -2),exact:true}] },
];

export const sceneOf = (n: number): SceneDef | undefined => SCENES[n - 1]?.n === n ? SCENES[n - 1] : SCENES.find((s) => s.n === n);

/** The conversation that plays scene n, and the one said before its fight. */
export const sceneTalk = (n: number): string => `scene.${n}`;
export const sceneBefore = (n: number): string => `scene.${n}.before`;
