// Films: the scenes the player watches, as data. One director plays any of them
// (src/game/views/story-cutscene.view.ts), and src/game/uiview/cutscene.ts turns a film and a time in seconds
// into everything on screen. Adding a film adds an entry here and changes no code. The design is
// docs/cutscenes.md.
//
// Every point is blocks east, up and south of a named place of the region, as in ./opening.ts, so a film
// follows the region when it moves. The people in a film are puppets: they are drawn from the film, never
// stepped by the rules, and the actor of the rules each one stands for is hidden while it plays.
//
// The art the film asks for may not be in the game yet. Each pose names a sprite and an animation, and what
// stands in until they land (`or`). The director checks the manifest when it plays, so the art is picked up
// the day it is merged, with no change here.

export type Offset = readonly [east: number, up: number, south: number];

/** A point of the region: a named place, and blocks east, up and south of it. */
export interface Spot {
  place: string;
  offset?: Offset;
}

export interface Pose {
  sprite: string;
  anim: string;
  /** Blocks walked in one loop of the animation, for a pose that walks. The steps follow the ground covered. */
  stride?: number;
  /** Played once, holding its last frame. */
  once?: boolean;
}

/** The pose wanted, and the one drawn while the sprite or its animation is not in the manifest. */
export interface PuppetPose extends Pose {
  or: Pose;
}

/** Something a puppet starts doing at a moment of the film. Each part left out carries on as it was. */
export interface Beat {
  /** Seconds into the film. */
  at: number;
  pose?: PuppetPose;
  /** Walks to here, starting at `at`, over `move` seconds: slow to start, slow to stop, facing the way it goes. */
  to?: Spot;
  move?: number;
  /** Turns to face this point over `turn` seconds, slow at both ends. */
  face?: Spot;
  turn?: number;
  visible?: boolean;
}

export interface Puppet {
  /** The actor of the rules it stands for (`player` is the hero). It is hidden while the film plays. */
  actor: string;
  start: Spot;
  face: Spot;
  pose: PuppetPose;
  visible: boolean;
  beats: readonly Beat[];
}

export interface FilmShot {
  id: string;
  /** Seconds on screen. */
  seconds: number;
  /** Where the lens is at the start and the end of the shot, and what it looks at, from the film's place. */
  from: Offset;
  to: Offset;
  look: Offset;
  lookTo: Offset;
  /** The vertical field of view in degrees, at the start and the end. The game's own lens is 20. */
  fov: number;
  fovTo?: number;
  /** How the shot begins: up from black, through a dip to black from the shot before, or a straight cut. */
  enter: 'fade' | 'dip' | 'cut';
  /** The words under the picture, faded in and out within the shot. */
  words?: string;
  /** The last shot: the lens eases from `from` to the game's own camera over the hero, and the bars leave. */
  land?: boolean;
}

/** A number that changes over the film: from `at`, it moves from where it was to `value` over `over` seconds, eased. */
export type Track = readonly (readonly [at: number, value: number, over?: number])[];

/** The sounds a film starts at a moment. They are made by code in src/game/uiview/film-sound.ts. */
export type FilmCue = 'twig' | 'pop';

export interface Film {
  id: string;
  /** `?scene=<scene>` in the address starts a new game straight into this film. */
  scene: string;
  title: string;
  /** Every offset starts here. */
  place: string;
  /**
   * When it plays: the first time the flag is set in play, with the player within `within` blocks of the place
   * `near`. Never from a loaded save. Its own flag is `cut.<id>`, set as it starts, so it plays once in a save.
   */
  trigger: { flag: string; near: string; within: number };
  /** What `?scene=` sets up before the trigger: the quest skipped to, where the player stands, the hour. */
  setup: { quest: string; stand: string; timeOfDay: number };
  shots: readonly FilmShot[];
  puppets: readonly Puppet[];
  /**
   * Where everyone stands when play resumes, by actor. The director puts the player there under black as the
   * film starts, so the world after it is the same watched or skipped. Every puppet ends its film here.
   */
  land: Readonly<Record<string, { at: Spot; face: Spot }>>;
  /** The hour across the film, from its first frame to its last. The rules are paused, so the director holds it. */
  sky: readonly [from: number, to: number];
  /** The fire's light: 1 burning well, 0 out. Below `LOW_FIRE` it is drawn as the `low` fire. */
  fire: Track;
  /** The game's own sound under the film (its ambience and its music, 0 to 1 of the player's volume), and the film's own. */
  sound: {
    world: Track;
    music: Track;
    /** The fire close by, and a low held note. */
    fire: Track;
    note: Track;
    cues: readonly { at: number; cue: FilmCue }[];
    /** Seconds the world and the music take to come back to the player's volume after the film. */
    after: number;
  };
}

/** The fire's light below which it is drawn as the `low` fire. */
export const LOW_FIRE = 0.85;

const at = (place: string): Spot => ({ place });

const HERO = 'hero', HERO_CAMP = 'hero-camp', FOX = 'fox-blighted';
const heroPose = (anim: string, once = false): PuppetPose => ({ sprite: HERO_CAMP, anim, once, or: { sprite: HERO, anim: 'idle' } });

/**
 * Scene 9, "Something outside", from docs/cutscenes.md: dusk at the player's camp on the first night, the last
 * calm minute before the story starts. Nobody speaks. The fox walks out of the trees south-west of the fire,
 * thin and shaking, and stops at the edge of the light. The camp is `CAMP` in ./region.ts: the fire at `camp`,
 * the hero at `camp.seat` a step north-west of it, `camp.edge` 6.4 blocks south-west, `camp.trees` 13.
 */
export const SCENE_9: Film = {
  id: 'scene9',
  scene: '9',
  title: 'Something outside',
  place: 'camp',
  trigger: { flag: 'night.fox', near: 'camp', within: 10 },
  setup: { quest: 'night', stand: 'camp.seat', timeOfDay: 0.782 },
  shots: [
    // 1. High and wide from the south-east: the plot small, the fire and the tent, the hill and the door behind.
    { id: 'dusk', seconds: 5, enter: 'fade', from: [28, 12, 24], to: [23, 10, 19.5], look: [-2, 2, -12], lookTo: [-2, 1.5, -10], fov: 32, fovTo: 30 },
    // 2. Low and close across the flames, the hero beyond them, lit warm.
    { id: 'fire', seconds: 4.5, enter: 'dip', from: [3.4, 1.55, 3.3], to: [2.9, 1.45, 2.8], look: [-1, 0.65, -1], lookTo: [-1, 0.7, -1], fov: 34, fovTo: 32 },
    // 3. Closer on the hero. The twig snaps on the cut; the head comes up and turns.
    { id: 'listen', seconds: 3, enter: 'cut', from: [0.5, 1.5, 5.6], to: [0.35, 1.45, 4.95], look: [-1, 0.8, -1], lookTo: [-1, 0.8, -1], fov: 32, fovTo: 30 },
    // 4. The hero's eye line, from just behind and over their head, toward the tree line. A long lens: the grey
    // shape comes out between the trunks, and the lens follows it in to where it stops at the edge of the light.
    { id: 'trees', seconds: 5.5, enter: 'cut', from: [-0.6, 2.1, -1.8], to: [-0.75, 2, -1.5], look: [-6, 0.5, 9.5], lookTo: [-5, 0.35, 4], fov: 24, fovTo: 17 },
    // 5. Low, from the side: the hero by the fire on the left, the fox at the edge of the light on the right.
    { id: 'edge', seconds: 4.5, enter: 'cut', from: [-11.4, 1.05, -2.6], to: [-10.9, 1.05, -2.3], look: [-2.9, 0.8, 1.6], lookTo: [-2.9, 0.8, 1.6], fov: 30, words: 'The fire is low. Something is standing at the edge of the light.' },
    // 6. The lens eases to the game's own camera over the hero, and the bars leave.
    { id: 'play', seconds: 2, enter: 'cut', from: [-10.9, 1.05, -2.3], to: [-10.9, 1.05, -2.3], look: [-2.9, 0.8, 1.6], lookTo: [-2.9, 0.8, 1.6], fov: 30, land: true },
  ],
  puppets: [
    {
      actor: 'player',
      start: at('camp.seat'), face: at('camp'), pose: heroPose('sit'), visible: true,
      beats: [
        // A twig snaps: the head comes up and turns, away from the fire, toward the trees.
        { at: 9.62, pose: heroPose('look'), face: at('camp.trees'), turn: 0.75 },
        // Up on their feet, facing what is out there. The stand-up ends in the idle stance play resumes with.
        { at: 18.45, pose: heroPose('rise', true), face: at('camp.edge'), turn: 0.6 },
        { at: 19.55, pose: { sprite: HERO, anim: 'idle', or: { sprite: HERO, anim: 'idle' } } },
      ],
    },
    {
      actor: 'fox:blighted',
      start: at('camp.trees'), face: at('camp.edge'), pose: { sprite: FOX, anim: 'idle', or: { sprite: FOX, anim: 'idle' } }, visible: false,
      beats: [
        // Out between the two trunks, head low, slow to start and slow to stop.
        { at: 12.5, visible: true },
        { at: 12.85, pose: { sprite: FOX, anim: 'stalk', stride: 0.55, or: { sprite: FOX, anim: 'walk', stride: 0.8 } }, to: at('camp.edge'), move: 4.5 },
        // Where the firelight ends it stops, turns to the fire, and shakes.
        { at: 17.35, pose: { sprite: FOX, anim: 'shake', or: { sprite: FOX, anim: 'idle' } }, face: at('camp.seat'), turn: 0.7 },
      ],
    },
  ],
  land: {
    player: { at: at('camp.seat'), face: at('camp.edge') },
    // Where the hall's rules stand it when it comes to a player at the camp (src/game/hall/index.sim.ts).
    'fox:blighted': { at: at('camp.edge'), face: at('camp.seat') },
  },
  // Blue hour: the sun just down (0.785 in src/features/sky/palette.ts), so the fire is what lights the people.
  sky: [0.782, 0.798],
  fire: [[0, 1], [10.1, 0.66, 1.9]],
  sound: {
    // The crickets and the wind, then at 3.4 s into the fire shot the crickets stop. The night comes back quieter.
    world: [[0, 1], [8.4, 0, 0.3], [22.5, 0.45, 2]],
    music: [[0, 1], [0, 0, 3]],
    fire: [[0, 0.3], [5, 1], [9.5, 0.85], [10.1, 0.5, 1.9], [12.5, 0.35], [18, 0.45], [22.5, 0.3, 2]],
    note: [[0, 0], [12.9, 0.85, 4.6], [22.5, 0, 2.2]],
    cues: [{ at: 9.5, cue: 'twig' }, { at: 20.7, cue: 'pop' }],
    after: 8,
  },
};

export const FILMS: readonly Film[] = [SCENE_9];

/** The flag a film sets as it starts, so it plays once in a save. */
export const filmFlag = (film: Film): string => `cut.${film.id}`;
