// The opening scene of a new game, as data: a few shots of the valley with one line each, played with the
// real camera over the real world before the player has control. src/game/views/story-opening.view.ts
// plays it and src/game/uiview/opening.ts times it.
//
// The lines set up who the player is and what the world believes, from docs/play/act1.md and the handbook's
// story chapter: the old people are said to have followed the Ascended into heaven, their ruins have been
// shut ever since, the Delvers' Guild raised the player and grants its wards ground nobody wants, and Tamsin
// is waiting at the grant stone. The lines say what people believe. None of them says what is true.
//
// Every point is blocks east, up and south of a named place of the region, so the shots follow the region
// when it moves. The last shot ends on the hero, where the game's own camera takes over.

export type Offset = readonly [east: number, up: number, south: number];

export interface OpeningShot {
  id: string;
  /** Seconds on screen, fades included. */
  seconds: number;
  /** The place the offsets start from. */
  place: string;
  /** Where the camera is at the start and the end of the shot. */
  from: Offset;
  to: Offset;
  /** What it looks at, at the start and the end. */
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

export const OPENING: readonly OpeningShot[] = [
  {
    id: 'valley',
    seconds: 6.5,
    place: 'grant.stone',
    from: [62, 44, 52],
    to: [44, 38, 44],
    look: [-18, 0, -22],
    lookTo: [-24, 0, -16],
    fov: 30,
    title: 'Greenhollow',
    line: 'Meadow, old forest, and the Mere running east to the sea.',
  },
  {
    id: 'path',
    seconds: 6,
    place: 'grant.stone',
    from: [2, 24, 22],
    to: [16, 22, 18],
    look: [28, 0, -6],
    lookTo: [36, 0, -6],
    fov: 30,
    line: 'A thousand years ago, they say, the Ascended led the old people up into heaven.',
  },
  {
    id: 'door',
    seconds: 6,
    place: 'shut.door',
    from: [13, 9, 13],
    to: [7, 6, 9],
    look: [0, 1.5, -3],
    lookTo: [0, 1.5, -4],
    fov: 26,
    line: 'They left their ruins shut behind them. Nobody has opened one since.',
  },
  {
    id: 'grant',
    seconds: 6,
    place: 'grant.stone',
    from: [-28, 18, 14],
    to: [-16, 17, 16],
    look: [-8, 0, -14],
    lookTo: [0, 0, -11],
    fov: 30,
    line: 'The Delvers\' Guild raised you. At sixteen, every ward is granted land nobody else wants.',
  },
  {
    id: 'stone',
    seconds: 6.5,
    place: 'grant.stone',
    from: [12, 7, 15],
    to: [0, 0, 0],
    look: [-1, 1.5, -1],
    lookTo: [0, 0, 0],
    fov: 24,
    line: 'Tamsin signs the grants. She is waiting for you at the stone.',
    land: true,
  },
];
