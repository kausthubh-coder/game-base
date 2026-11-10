// How each character looks as a 3D model, as data: the body, the parts they wear and their colours, picked to
// match their sprite sheets. Used when Settings > View > Characters is "3D models".
//
// Bodies: `slim`, `dress` and `stout` are CC0 stand-ins from KayKit's Adventurers pack, recoloured
// (public/assets/stand-ins/kaykit, rebuilt by tools/models/cast/stand-ins.mjs). `mossling`, `leaftail` and
// `lanternfly` are built by code in src/features/toon/creatures.ts.
//
// Each body has one head: slim short hair, dress long hair, stout bald with a beard. Parts: `cape` (slim),
// `beard` (stout), and the accessories built by code in src/features/toon/accessories.ts: `wide-hat`,
// `straw-hat`, `cone-hat`, `cap`, `headscarf`, `circlet`, `apron`, `moustache`, `chick`, `bun`, `curls`, `hoe`.
//
// Colours are sRGB, one per slot: skin, hair, eyes, top, bottom, accent (collars, trim, cuffs), leather (belts,
// boots), metal (buckles, a circlet), hat, extra (an apron, a feather, a chick, a leaf of a tail).

export type CastBody = 'slim' | 'dress' | 'stout' | 'mossling' | 'leaftail' | 'lanternfly';

export interface CastColours {
  skin: number; hair: number; eyes: number; top: number; bottom: number;
  accent: number; leather: number; metal: number; hat: number; extra: number;
}

export interface CastLook {
  body: CastBody;
  parts: readonly string[];
  /** Parts worn only while an animation plays, such as the hoe while working. */
  partsWhile?: Readonly<Record<string, readonly string[]>>;
  colours: CastColours;
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
    body: 'slim', parts: ['cape'], partsWhile: { tool: ['hoe'] }, height: 1.85,
    colours: { skin: SKIN, hair: 0x8c4a2c, eyes: EYES, top: 0x7a4a2e, bottom: 0x5a3624, accent: 0xd9b07c, leather: LEATHER, metal: BRASS, hat: 0x8c4a2c, extra: 0xd9b07c },
  },
  tamsin: {
    body: 'dress', parts: ['wide-hat'], height: 1.8,
    colours: { skin: 0xeebf98, hair: 0xd2cdc4, eyes: EYES, top: 0x7a5236, bottom: 0x4e3626, accent: 0x9a7a44, leather: 0x5a3b28, metal: BRASS, hat: 0x8b5a34, extra: 0xe8d6a0 },
  },
  maren: {
    body: 'dress', parts: ['apron', 'circlet'], height: 1.85,
    colours: { skin: SKIN, hair: 0x7a4a2c, eyes: EYES, top: 0x3e6a3a, bottom: 0x2f4f2c, accent: 0xe9dcc0, leather: 0x5a3b28, metal: 0xd9ac42, hat: 0x7a4a2c, extra: 0xf2e8d2 },
  },
  odo: {
    body: 'stout', parts: ['curls', 'apron'], height: 1.85,
    colours: { skin: 0xf3c29a, hair: 0x9a5a34, eyes: EYES, top: 0xefe0c4, bottom: 0x6e4a32, accent: 0xa0503c, leather: LEATHER, metal: BRASS, hat: 0x9a5a34, extra: 0xf6eedc },
  },
  gus: {
    body: 'stout', parts: ['straw-hat', 'moustache'], height: 1.85,
    colours: { skin: 0xe9b58a, hair: 0x4e3020, eyes: EYES, top: 0xd0a868, bottom: 0x4e6a8a, accent: 0x5a7898, leather: LEATHER, metal: 0xa8b0b4, hat: 0xe6c472, extra: 0xe6c472 },
  },
  mira: {
    body: 'slim', parts: ['bun'], height: 1.8,
    colours: { skin: SKIN, hair: 0x8e3e2e, eyes: EYES, top: 0xa63a3a, bottom: 0x5e3e2a, accent: 0xe8dcc8, leather: LEATHER, metal: 0xb0b0a8, hat: 0x8e3e2e, extra: 0xe8c060 },
  },
  wren: {
    body: 'slim', parts: ['chick'], height: 1.72,
    colours: { skin: 0xe8b48a, hair: 0x6e4428, eyes: EYES, top: 0x7a5a34, bottom: 0xe0d0aa, accent: 0x6a7a3a, leather: LEATHER, metal: BRASS, hat: 0xe8902a, extra: 0xf6d44a },
  },
  juniper: {
    body: 'slim', parts: ['cape'], height: 1.6,
    colours: { skin: SKIN, hair: 0x5e3e26, eyes: EYES, top: 0x8a6a3e, bottom: 0x5a4028, accent: 0xc29a52, leather: LEATHER, metal: BRASS, hat: 0x5e3e26, extra: 0xc29a52 },
  },
  brack: {
    body: 'stout', parts: ['beard', 'cone-hat'], height: 1.85,
    colours: { skin: 0xe6b28a, hair: 0xbdb7ad, eyes: EYES, top: 0x3c3c5c, bottom: 0x2e2c42, accent: 0x6a5a7a, leather: 0x4a3426, metal: 0xb08a4a, hat: 0xcaa25e, extra: 0xcaa25e },
  },
  'villager-a': {
    body: 'dress', parts: ['headscarf', 'apron'], height: 1.8,
    colours: { skin: SKIN, hair: 0x7a4a2c, eyes: EYES, top: 0x8a3a34, bottom: 0x6a2c2c, accent: 0xe8dcc4, leather: 0x5a3b28, metal: BRASS, hat: 0xb8433a, extra: 0xf0e6d2 },
  },
  'villager-b': {
    body: 'stout', parts: ['beard', 'cap'], height: 1.85,
    colours: { skin: 0xecb890, hair: 0x9a8c80, eyes: EYES, top: 0x5e4a2e, bottom: 0x8a4a3a, accent: 0xe8dcc0, leather: LEATHER, metal: BRASS, hat: 0x6e5a3c, extra: 0x6e5a3c },
  },
  leaftail: {
    body: 'leaftail', parts: [], height: 0.95,
    colours: { skin: 0x7caa58, hair: 0x5e8a40, eyes: 0x2a1c14, top: 0x7caa58, bottom: 0x5e8a40, accent: 0xf2e6c4, leather: LEATHER, metal: BRASS, hat: 0x7caa58, extra: 0x5a9e3e },
  },
  pet: {
    body: 'leaftail', parts: [], height: 0.95,
    colours: { skin: 0xd67c59, hair: 0xb0603e, eyes: 0x2a1c14, top: 0xd67c59, bottom: 0xb0603e, accent: 0xf6ead2, leather: LEATHER, metal: BRASS, hat: 0xd67c59, extra: 0xd67c59 },
  },
  critter: {
    body: 'mossling', parts: [], height: 0.75,
    colours: { skin: 0x6e9440, hair: 0x4e7030, eyes: 0x3a2418, top: 0xa2d45e, bottom: 0x5a6a2e, accent: 0xffffff, leather: LEATHER, metal: BRASS, hat: 0x6e9440, extra: 0x6e9440 },
  },
  lanternfly: {
    body: 'lanternfly', parts: [], height: 0.75,
    colours: { skin: 0x5a3a24, hair: 0x5a3a24, eyes: 0x2a1c14, top: 0x8a5e30, bottom: 0x8a5e30, accent: 0xf4ecd0, leather: LEATHER, metal: BRASS, hat: 0x8a5e30, extra: 0xffd76a },
  },
};

/** One character drawn by a sprite they share with others, told apart by colour: by actor id, over the sprite's look. */
export const CAST_BY_ID: Readonly<Record<string, Partial<CastColours>>> = {
  'npc:villager-1': { hair: 0x5a3a22, top: 0x4a6a8a, bottom: 0x3a4e6a, hat: 0x5a7aa0 },
  'npc:villager-3': { hair: 0xc89a5a, top: 0x7a6a3a, bottom: 0x5a4a2a, hat: 0xd8b04a },
  'npc:villager-5': { hair: 0x3a2a22, top: 0x6a4a7a, bottom: 0x4a3458, hat: 0x8a5aa0 },
  'npc:villager-2': { hair: 0x8a8078, top: 0x3e5a3a, bottom: 0x6a5a3a, hat: 0x4e6a3e },
  'npc:villager-4': { hair: 0xd8d0c4, top: 0x7a3e2e, bottom: 0x4e4a5a, hat: 0x5a4a6a },
  'npc:villager-6': { hair: 0x6a5040, top: 0x2e4a5a, bottom: 0x7a5a3a, hat: 0x9a7a4a },
};

/** The sprite a character uses while doing something, to the character's own sprite. */
export const CAST_ALIAS: Readonly<Record<string, string>> = { 'hero-swing': 'hero' };
