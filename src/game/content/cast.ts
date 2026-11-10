// How each character looks as a 3D model, as data. Used when Settings > View > Characters is "3D models".
//
// A model file is listed once in CAST_MODELS, with its clip names for the game's animations and the names of a few
// bones. Each character then names a file and a mesh in it, the parts it wears, its height, and colours. To swap in
// another cast, list its file and point the characters at its meshes: no code changes.
//
// Colours are sRGB and go by slot name. A file with a `_TONE` attribute (as the CC0 stand-ins had) paints with the ten slots
// of src/features/toon (skin, hair, eyes, top, bottom, accent, leather, metal, hat, extra), and needs colours for
// them. Any other file paints with its own materials, one slot per material named after it, and `colours`
// overrides any of them by that name. Accessories add their own slots (hat, extra...) to a body that lacks them.
//
// Today's cast: Kausthubh's own, modelled in Blender from the sprites (assets-src/cast, exported by
// tools/models/cast/build.mjs to public/assets/models/cast-*.glb). Each file is one character: one mesh named after
// it, painted with vertex colours, on its own rig. The eleven people share one 18-bone skeleton and its clips
// (idle, walk, run, swing, talk, wave). The creatures have idle, walk and special. The only accessory is the `hoe`,
// built by code in src/features/toon/accessories.ts and hung on the hand's tool bone while working.

export interface CastModel {
  /** A GLB under public/, or `code:<creature>` for a creature built by code (mossling, leaftail, lanternfly). */
  file: string;
  /** The game's animations (idle, walk, run, tool, talk, flutter) to the clip names in the file. */
  clips: Readonly<Record<string, string>>;
  /** Bone names in the file, for the stride, the shadow and the accessories. Without them a body casts its own shadow and wears no accessories. */
  bones?: {
    head: string; hand: string; hips: string; chest: string; knee: string;
    feet: readonly string[];
    /** Pairs of bones a capsule of the shadow runs between. */
    limbs: readonly (readonly [string, string, number])[];
  };
  /** Blocks a second above which a walk plays the run clip. Default 3.1. */
  runFrom?: number;
}

/** The bones every person in the cast has, named as in their files. */
const PERSON_BONES: NonNullable<CastModel['bones']> = {
  head: 'head', hand: 'hand.R.tool', hips: 'hips', chest: 'chest', knee: 'lower_leg.L', feet: ['foot.L', 'foot.R'],
  limbs: [
    ['upper_leg.L', 'lower_leg.L', 0.09], ['lower_leg.L', 'foot.L', 0.08],
    ['upper_leg.R', 'lower_leg.R', 0.09], ['lower_leg.R', 'foot.R', 0.08],
    ['upper_arm.L', 'lower_arm.L', 0.07], ['lower_arm.L', 'hand.L', 0.07],
    ['upper_arm.R', 'lower_arm.R', 0.07], ['lower_arm.R', 'hand.R', 0.07],
  ],
};
const PERSON_CLIPS = { idle: 'idle', walk: 'walk', run: 'run', tool: 'swing', talk: 'talk', wave: 'wave' };

const person = (name: string): CastModel => ({ file: `assets/models/cast-${name}.glb`, clips: PERSON_CLIPS, bones: PERSON_BONES });
const creature = (name: string, clips: Readonly<Record<string, string>>): CastModel => ({ file: `assets/models/cast-${name}.glb`, clips });

export const CAST_MODELS: Readonly<Record<string, CastModel>> = {
  hero: person('hero'), tamsin: person('tamsin'), maren: person('maren'), odo: person('odo'), gus: person('gus'),
  mira: person('mira'), wren: person('wren'), juniper: person('juniper'), brack: person('brack'),
  'villager-a': person('villager-a'), 'villager-b': person('villager-b'),
  leaftail: creature('leaftail', { idle: 'idle', walk: 'walk', special: 'special' }),
  mossling: creature('mossling', { idle: 'idle', walk: 'walk', special: 'special' }),
  lanternfly: creature('lanternfly', { idle: 'idle', walk: 'walk', flutter: 'special' }),
};

export type CastColours = Readonly<Record<string, number>>;

export interface CastLook {
  /** A key of CAST_MODELS. */
  model: string;
  /**
   * A mesh (or a group of meshes) in that file, or several to put together as one body, such as a head and a body
   * that the file keeps apart. A creature built by code has one: `body`.
   */
  mesh: string | readonly string[];
  parts?: readonly string[];
  /** Parts worn only while an animation plays, such as the hoe while working. */
  partsWhile?: Readonly<Record<string, readonly string[]>>;
  /** Colours by slot name, over the file's own. */
  colours?: CastColours;
  /** The top of the head in blocks. A person's sprite is 2 blocks tall. */
  height: number;
  /** Multiplies the file's own size. Left out, the body is scaled so the top of its head is at `height`. */
  scale?: number;
}

/** By sprite name. Every sprite a character uses is here, so both looks show the same cast. Heights are the files' own, hats included. */
export const CAST: Readonly<Record<string, CastLook>> = {
  // The hoe is built by code, so it takes its colours from here: a wooden handle and an iron blade.
  hero: { model: 'hero', mesh: 'hero', partsWhile: { tool: ['hoe'] }, height: 1.809, scale: 1, colours: { leather: 0x8a5a34, metal: 0xb4bcc0 } },
  tamsin: { model: 'tamsin', mesh: 'tamsin', height: 1.85, scale: 1 },
  maren: { model: 'maren', mesh: 'maren', height: 1.69, scale: 1 },
  odo: { model: 'odo', mesh: 'odo', height: 1.65, scale: 1 },
  gus: { model: 'gus', mesh: 'gus', height: 1.68, scale: 1 },
  mira: { model: 'mira', mesh: 'mira', height: 1.72, scale: 1 },
  wren: { model: 'wren', mesh: 'wren', height: 1.66, scale: 1 },
  juniper: { model: 'juniper', mesh: 'juniper', height: 1.2, scale: 1 },
  brack: { model: 'brack', mesh: 'brack', height: 1.83, scale: 1 },
  'villager-a': { model: 'villager-a', mesh: 'villager-a', height: 1.73, scale: 1 },
  'villager-b': { model: 'villager-b', mesh: 'villager-b', height: 1.63, scale: 1 },
  leaftail: { model: 'leaftail', mesh: 'leaftail', height: 0.695, scale: 1 },
  pet: { model: 'leaftail', mesh: 'leaftail', height: 0.695, scale: 1 },
  critter: { model: 'mossling', mesh: 'mossling', height: 0.541, scale: 1 },
  lanternfly: { model: 'lanternfly', mesh: 'lanternfly', height: 0.248, scale: 1 },
};

/** One character drawn by a sprite they share with others, told apart by colour: by actor id, over the sprite's look. None yet: each file is painted by its vertex colours in one slot. */
export const CAST_BY_ID: Readonly<Record<string, CastColours>> = {};

/** The sprite a character uses while doing something, to the character's own sprite. */
export const CAST_ALIAS: Readonly<Record<string, string>> = { 'hero-swing': 'hero' };
