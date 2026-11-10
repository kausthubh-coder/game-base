// How each character looks as a 3D model, as data. Used when Settings > View > Characters is "3D models".
//
// A model file is listed once in CAST_MODELS, with its clip names for the game's animations and the names of a few
// bones. Each character then names a file and a mesh in it, the parts it wears, its height, and colours. To swap in
// another cast, list its file and point the characters at its meshes: no code changes.
//
// Colours are sRGB and go by slot name. A file with a `_TONE` attribute (the stand-ins) paints with the ten slots
// of src/features/toon (skin, hair, eyes, top, bottom, accent, leather, metal, hat, extra), and needs colours for
// them. Any other file paints with its own materials, one slot per material named after it, and `colours`
// overrides any of them by that name. Accessories add their own slots (hat, extra...) to a body that lacks them.
//
// Today's cast: `slim`, `dress` and `stout` are CC0 stand-ins from KayKit's Adventurers pack, recoloured
// (public/assets/stand-ins/kaykit, rebuilt by tools/models/cast/stand-ins.mjs). Each has one head: slim short hair,
// dress long hair, stout bald with a beard. Their parts: `cape` (slim) and `beard` (stout). The creatures are
// built by code in src/features/toon/creatures.ts. Accessories, built by code in src/features/toon/accessories.ts
// and placed from the bones named below: `wide-hat`, `straw-hat`, `cone-hat`, `cap`, `headscarf`, `circlet`,
// `apron`, `moustache`, `chick`, `bun`, `curls`, `hoe`.

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

const KAYKIT_LIMBS: readonly (readonly [string, string, number])[] = [
  ['upperleg.l', 'lowerleg.l', 0.1], ['lowerleg.l', 'foot.l', 0.09], ['foot.l', 'toes.l', 0.08],
  ['upperleg.r', 'lowerleg.r', 0.1], ['lowerleg.r', 'foot.r', 0.09], ['foot.r', 'toes.r', 0.08],
  ['upperarm.l', 'lowerarm.l', 0.08], ['lowerarm.l', 'hand.l', 0.08],
  ['upperarm.r', 'lowerarm.r', 0.08], ['lowerarm.r', 'hand.r', 0.08],
];

export const CAST_MODELS: Readonly<Record<string, CastModel>> = {
  kaykit: {
    file: 'assets/stand-ins/kaykit/cast.glb',
    clips: { idle: 'Idle', walk: 'Walk', run: 'Run', tool: 'Tool', talk: 'Talk' },
    bones: { head: 'head', hand: 'handslot.r', hips: 'hips', chest: 'chest', knee: 'lowerleg.l', feet: ['foot.l', 'foot.r'], limbs: KAYKIT_LIMBS },
  },
  mossling: { file: 'code:mossling', clips: { idle: 'Idle', walk: 'Walk' } },
  leaftail: { file: 'code:leaftail', clips: { idle: 'Idle', walk: 'Walk' } },
  lanternfly: { file: 'code:lanternfly', clips: { idle: 'Flutter', walk: 'Flutter', flutter: 'Flutter' } },
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
}

const EYES = 0x2a1c22;
const SKIN = 0xf1c39d;
const LEATHER = 0x4e3022;
const BRASS = 0xc9a24a;

/** By sprite name. Every sprite a character uses is here, so both looks show the same cast. */
export const CAST: Readonly<Record<string, CastLook>> = {
  hero: {
    model: 'kaykit', mesh: 'slim', parts: ['cape'], partsWhile: { tool: ['hoe'] }, height: 1.85,
    colours: { skin: SKIN, hair: 0x8c4a2c, eyes: EYES, top: 0x7a4a2e, bottom: 0x5a3624, accent: 0xd9b07c, leather: LEATHER, metal: BRASS, hat: 0x8c4a2c, extra: 0xd9b07c },
  },
  tamsin: {
    model: 'kaykit', mesh: 'dress', parts: ['wide-hat'], height: 1.8,
    colours: { skin: 0xeebf98, hair: 0xd2cdc4, eyes: EYES, top: 0x7a5236, bottom: 0x4e3626, accent: 0x9a7a44, leather: 0x5a3b28, metal: BRASS, hat: 0x8b5a34, extra: 0xe8d6a0 },
  },
  maren: {
    model: 'kaykit', mesh: 'dress', parts: ['apron', 'circlet'], height: 1.85,
    colours: { skin: SKIN, hair: 0x7a4a2c, eyes: EYES, top: 0x3e6a3a, bottom: 0x2f4f2c, accent: 0xe9dcc0, leather: 0x5a3b28, metal: 0xd9ac42, hat: 0x7a4a2c, extra: 0xf2e8d2 },
  },
  odo: {
    model: 'kaykit', mesh: 'stout', parts: ['curls', 'apron'], height: 1.85,
    colours: { skin: 0xf3c29a, hair: 0x9a5a34, eyes: EYES, top: 0xefe0c4, bottom: 0x6e4a32, accent: 0xa0503c, leather: LEATHER, metal: BRASS, hat: 0x9a5a34, extra: 0xf6eedc },
  },
  gus: {
    model: 'kaykit', mesh: 'stout', parts: ['straw-hat', 'moustache'], height: 1.85,
    colours: { skin: 0xe9b58a, hair: 0x4e3020, eyes: EYES, top: 0xd0a868, bottom: 0x4e6a8a, accent: 0x5a7898, leather: LEATHER, metal: 0xa8b0b4, hat: 0xe6c472, extra: 0xe6c472 },
  },
  mira: {
    model: 'kaykit', mesh: 'slim', parts: ['bun'], height: 1.8,
    colours: { skin: SKIN, hair: 0x8e3e2e, eyes: EYES, top: 0xa63a3a, bottom: 0x5e3e2a, accent: 0xe8dcc8, leather: LEATHER, metal: 0xb0b0a8, hat: 0x8e3e2e, extra: 0xe8c060 },
  },
  wren: {
    model: 'kaykit', mesh: 'slim', parts: ['chick'], height: 1.72,
    colours: { skin: 0xe8b48a, hair: 0x6e4428, eyes: EYES, top: 0x7a5a34, bottom: 0xe0d0aa, accent: 0x6a7a3a, leather: LEATHER, metal: BRASS, hat: 0xe8902a, extra: 0xf6d44a },
  },
  juniper: {
    model: 'kaykit', mesh: 'slim', parts: ['cape'], height: 1.6,
    colours: { skin: SKIN, hair: 0x5e3e26, eyes: EYES, top: 0x8a6a3e, bottom: 0x5a4028, accent: 0xc29a52, leather: LEATHER, metal: BRASS, hat: 0x5e3e26, extra: 0xc29a52 },
  },
  brack: {
    model: 'kaykit', mesh: 'stout', parts: ['beard', 'cone-hat'], height: 1.85,
    colours: { skin: 0xe6b28a, hair: 0xbdb7ad, eyes: EYES, top: 0x3c3c5c, bottom: 0x2e2c42, accent: 0x6a5a7a, leather: 0x4a3426, metal: 0xb08a4a, hat: 0xcaa25e, extra: 0xcaa25e },
  },
  'villager-a': {
    model: 'kaykit', mesh: 'dress', parts: ['headscarf', 'apron'], height: 1.8,
    colours: { skin: SKIN, hair: 0x7a4a2c, eyes: EYES, top: 0x8a3a34, bottom: 0x6a2c2c, accent: 0xe8dcc4, leather: 0x5a3b28, metal: BRASS, hat: 0xb8433a, extra: 0xf0e6d2 },
  },
  'villager-b': {
    model: 'kaykit', mesh: 'stout', parts: ['beard', 'cap'], height: 1.85,
    colours: { skin: 0xecb890, hair: 0x9a8c80, eyes: EYES, top: 0x5e4a2e, bottom: 0x8a4a3a, accent: 0xe8dcc0, leather: LEATHER, metal: BRASS, hat: 0x6e5a3c, extra: 0x6e5a3c },
  },
  leaftail: {
    model: 'leaftail', mesh: 'body', height: 0.95,
    colours: { skin: 0x7caa58, hair: 0x5e8a40, eyes: 0x2a1c14, top: 0x7caa58, bottom: 0x5e8a40, accent: 0xf2e6c4, leather: LEATHER, metal: BRASS, hat: 0x7caa58, extra: 0x5a9e3e },
  },
  pet: {
    model: 'leaftail', mesh: 'body', height: 0.95,
    colours: { skin: 0xd67c59, hair: 0xb0603e, eyes: 0x2a1c14, top: 0xd67c59, bottom: 0xb0603e, accent: 0xf6ead2, leather: LEATHER, metal: BRASS, hat: 0xd67c59, extra: 0xd67c59 },
  },
  critter: {
    model: 'mossling', mesh: 'body', height: 0.75,
    colours: { skin: 0x6e9440, hair: 0x4e7030, eyes: 0x3a2418, top: 0xa2d45e, bottom: 0x5a6a2e, accent: 0xffffff, leather: LEATHER, metal: BRASS, hat: 0x6e9440, extra: 0x6e9440 },
  },
  lanternfly: {
    model: 'lanternfly', mesh: 'body', height: 0.75,
    colours: { skin: 0x5a3a24, hair: 0x5a3a24, eyes: 0x2a1c14, top: 0x8a5e30, bottom: 0x8a5e30, accent: 0xf4ecd0, leather: LEATHER, metal: BRASS, hat: 0x8a5e30, extra: 0xffd76a },
  },
};

/** One character drawn by a sprite they share with others, told apart by colour: by actor id, over the sprite's look. */
export const CAST_BY_ID: Readonly<Record<string, CastColours>> = {
  'npc:villager-1': { hair: 0x5a3a22, top: 0x4a6a8a, bottom: 0x3a4e6a, hat: 0x5a7aa0 },
  'npc:villager-3': { hair: 0xc89a5a, top: 0x7a6a3a, bottom: 0x5a4a2a, hat: 0xd8b04a },
  'npc:villager-5': { hair: 0x3a2a22, top: 0x6a4a7a, bottom: 0x4a3458, hat: 0x8a5aa0 },
  'npc:villager-2': { hair: 0x8a8078, top: 0x3e5a3a, bottom: 0x6a5a3a, hat: 0x4e6a3e },
  'npc:villager-4': { hair: 0xd8d0c4, top: 0x7a3e2e, bottom: 0x4e4a5a, hat: 0x5a4a6a },
  'npc:villager-6': { hair: 0x6a5040, top: 0x2e4a5a, bottom: 0x7a5a3a, hat: 0x9a7a4a },
};

/** The sprite a character uses while doing something, to the character's own sprite. */
export const CAST_ALIAS: Readonly<Record<string, string>> = { 'hero-swing': 'hero' };
