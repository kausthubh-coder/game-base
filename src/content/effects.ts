// Particle effects as data. One pooled system in src/features/effects plays any entry here.
// A new effect is a new entry: it needs no code.
import type { Surface } from '../engine/types.ts';

/** The sprite each particle is drawn as. They are drawn by the shader, so there is no sheet to load. */
export type SpriteShape = 'glow' | 'square' | 'puff' | 'streak' | 'ring' | 'leaf' | 'spark';

export type Range = readonly [number, number];

export interface EffectEntry {
  shape: SpriteShape;
  /** `add` is for light: it glows and blooms. `normal` covers what is behind it and takes the color of the daylight. */
  blend: 'normal' | 'add';
  /** How a sprite sits: turned to the camera, stretched along its motion, or flat on the ground. */
  facing?: 'camera' | 'motion' | 'ground';
  /** Particles in one play. For weather entries: particles a second at full strength. */
  count: number;
  /** Seconds each one lives, shortest and longest. */
  life: Range;
  /** They start inside this radius around the point, and this far above it. */
  radius?: number;
  height?: Range;
  /** Meters a second, slowest and fastest. */
  speed: Range;
  /** Which way they go: how much straight up (negative is down), away from the center, and in any direction. */
  aim?: { up?: number; out?: number; any?: number };
  /** Meters a second squared, pulling down. Negative floats up. */
  gravity: number;
  /** How quickly they lose speed. 0 keeps it. */
  drag?: number;
  /** How much of the wind's speed they pick up. */
  wind?: number;
  /** A side-to-side drift: meters and turns a second. */
  wobble?: Range;
  /** Turns a second, for sprites that face the camera. */
  spin?: number;
  /** Length over width, for sprites stretched along their motion. */
  stretch?: number;
  /** Meters across at the start and at the end of its life. */
  size: Range;
  /** Color over life: at the start and at the end. */
  color: readonly [number, number];
  /** When true each particle keeps one color picked between the two. */
  pickColor?: boolean;
  /** Opacity at the start and at the end. */
  alpha?: Range;
  /** The part of its life spent fading in and fading out. */
  fade?: Range;
  /** Brightness above 1 makes the bloom catch it. */
  glow?: number;
  /** Fireflies blink. */
  blink?: boolean;
  /** It ends when it reaches the ground. */
  lands?: boolean;
  /** Weather entries share a smaller part of the pool, so rain can never crowd out a sword hit. */
  weather?: boolean;
  /** Other entries played at the same point. */
  with?: readonly string[];
}

export const effects = {
  // ---- walking
  dust: { shape: 'puff', blend: 'normal', count: 6, life: [0.35, 0.7], radius: 0.15, speed: [0.5, 1.3], aim: { up: 0.6, out: 1 }, gravity: -0.4, drag: 3, size: [0.16, 0.4], color: [0xd6c29c, 0xd6c29c], alpha: [0.85, 0], fade: [0, 0.5] },
  flecks: { shape: 'leaf', blend: 'normal', count: 5, life: [0.4, 0.7], radius: 0.12, speed: [1.4, 2.6], aim: { up: 1, out: 0.8 }, gravity: 9, spin: 1.2, size: [0.18, 0.14], color: [0xb4e868, 0x6fbf4a], pickColor: true, fade: [0, 0.3], lands: true },
  splash: { shape: 'puff', blend: 'normal', count: 8, life: [0.35, 0.6], radius: 0.12, speed: [1.8, 3.2], aim: { up: 1, out: 0.6 }, gravity: 11, size: [0.1, 0.05], color: [0xe2f5ff, 0xbfe6ff], alpha: [0.9, 0.5], fade: [0, 0.3], with: ['splashRing'] },
  splashRing: { shape: 'ring', blend: 'normal', facing: 'ground', count: 1, life: [0.5, 0.6], speed: [0, 0], gravity: 0, size: [0.25, 1.2], color: [0xffffff, 0xd8f0ff], alpha: [0.8, 0], fade: [0, 0.4] },

  // ---- blocks
  chips: { shape: 'square', blend: 'normal', count: 14, life: [0.5, 0.9], radius: 0.35, height: [-0.3, 0.3], speed: [1.6, 3.8], aim: { up: 0.9, out: 1, any: 0.4 }, gravity: 12, spin: 0.9, size: [0.14, 0.09], color: [0x9a7b55, 0x7a5f40], fade: [0, 0.25], lands: true },
  // A felled tree's crown: leaves thrown out and drifting down.
  leafBurst: { shape: 'leaf', blend: 'normal', count: 16, life: [0.9, 1.8], radius: 1.1, height: [-0.4, 0.6], speed: [0.8, 2.4], aim: { up: 0.5, out: 1, any: 0.3 }, gravity: 2.5, drag: 1.2, wobble: [0.35, 0.6], spin: 1, size: [0.2, 0.16], color: [0x8fd65a, 0x4f9a3a], pickColor: true, fade: [0, 0.3], lands: true },
  pop: { shape: 'ring', blend: 'normal', facing: 'ground', count: 1, life: [0.28, 0.32], height: [0.03, 0.03], speed: [0, 0], gravity: 0, size: [0.5, 1.7], color: [0xffffff, 0xffffff], alpha: [0.75, 0], fade: [0, 0.4], with: ['popDust'] },
  popDust: { shape: 'puff', blend: 'normal', count: 8, life: [0.3, 0.5], radius: 0.45, height: [0.05, 0.2], speed: [1.2, 2.1], aim: { up: 0.2, out: 1 }, gravity: 0, drag: 4, size: [0.14, 0.32], color: [0xd9cdb8, 0xd9cdb8], alpha: [0.7, 0], fade: [0, 0.5] },

  // ---- items
  trail: { shape: 'spark', blend: 'add', count: 14, life: [0.5, 0.9], radius: 0.2, speed: [1.2, 2.4], aim: { up: 1, any: 0.25 }, gravity: -1.5, drag: 1.5, wobble: [0.18, 1.4], size: [0.24, 0.05], color: [0xfff0a0, 0x7df0d0], glow: 2.6, fade: [0.05, 0.4] },

  // ---- the ancients' lume: small teal motes that drift up from a woken lamp or the Heartstone.
  lume: { shape: 'glow', blend: 'add', count: 2, life: [3.5, 6], radius: 0.45, height: [0.2, 1.1], speed: [0.12, 0.3], aim: { up: 1 }, gravity: 0, wobble: [0.25, 0.2], size: [0.15, 0.05], color: [0x7fffd0, 0x3fe0c8], glow: 2.4, fade: [0.2, 0.5] },

  // ---- weather. `count` is particles a second at full strength.
  rain: { shape: 'streak', blend: 'normal', facing: 'motion', count: 1300, life: [0.6, 0.9], radius: 1.2, speed: [15, 19], aim: { up: -1 }, gravity: 0, wind: 0.75, stretch: 18, size: [0.018, 0.018], color: [0xd4e4f8, 0xd4e4f8], alpha: [0.23, 0.16], glow: 1, fade: [0.05, 0.05], weather: true },
  rainSplash: { shape: 'ring', blend: 'normal', facing: 'ground', count: 1, life: [0.25, 0.35], speed: [0, 0], gravity: 0, size: [0.06, 0.32], color: [0xe6f2ff, 0xe6f2ff], alpha: [0.3, 0], fade: [0, 0.3], weather: true },
  rainDrop: { shape: 'puff', blend: 'normal', count: 1, life: [0.22, 0.32], speed: [1.2, 2.2], aim: { up: 1, any: 0.5 }, gravity: 9, size: [0.07, 0.03], color: [0xe6f2ff, 0xe6f2ff], alpha: [0.8, 0.3], weather: true },
  leaf: { shape: 'leaf', blend: 'normal', count: 4, life: [6, 10], speed: [0.7, 1.1], aim: { up: -1 }, gravity: 0, wind: 0.6, wobble: [0.4, 0.34], spin: 0.4, size: [0.2, 0.2], color: [0x7cc24e, 0xe0b84a], pickColor: true, fade: [0.05, 0.1], lands: true, weather: true },
  windLine: { shape: 'streak', blend: 'normal', facing: 'motion', count: 12, life: [0.7, 1.1], speed: [10, 16], gravity: 0, wobble: [0.15, 0.5], stretch: 70, size: [0.045, 0.045], color: [0xffffff, 0xffffff], alpha: [0.3, 0.3], fade: [0.3, 0.4], weather: true },
  firefly: { shape: 'glow', blend: 'add', count: 5, life: [6, 10], speed: [0.05, 0.2], aim: { any: 1 }, gravity: 0, wobble: [0.9, 0.08], size: [0.22, 0.22], color: [0xd8ff6a, 0xa8e84a], glow: 2.4, blink: true, fade: [0.1, 0.1], weather: true },
  mote: { shape: 'glow', blend: 'add', count: 16, life: [9, 14], speed: [0.4, 0.7], aim: { up: -1 }, gravity: 0, wind: 0.3, wobble: [0.5, 0.13], size: [0.26, 0.2], color: [0x7fffd0, 0xfff2a0], pickColor: true, glow: 2.4, fade: [0.08, 0.12], lands: true, weather: true },
} satisfies Record<string, EffectEntry>;

export type EffectId = keyof typeof effects;

/** The color of the bits that fly off a surface. Block chips use it until the event carries the block's own color. */
export const surfaceColor: Record<Surface, number> = {
  grass: 0x5fa83c,
  tallGrass: 0x58a23a,
  dirt: 0x8a6a45,
  stone: 0x8d8f96,
  wood: 0x9a7448,
  sand: 0xdcc98a,
  water: 0x4fb8d8,
  snow: 0xf2f6fb,
  leaves: 0x3f8a36,
  metal: 0xaab2bd,
};

/** What a foot kicks up on each surface. `scale` multiplies the count. null is nothing at all. */
export const footstepEffect: Record<Surface, { effect: EffectId; color?: number; scale?: number } | null> = {
  grass: { effect: 'flecks', scale: 0.75 },
  tallGrass: { effect: 'flecks' },
  dirt: { effect: 'dust', color: 0xa98a62 },
  stone: { effect: 'dust', color: 0xc9cbd1, scale: 0.5 },
  wood: { effect: 'dust', color: 0xcdb48f, scale: 0.35 },
  sand: { effect: 'dust', color: 0xe6d6a0 },
  water: { effect: 'splash' },
  snow: { effect: 'dust', color: 0xffffff },
  leaves: { effect: 'flecks', scale: 0.75 },
  metal: null,
};

/** The most particles alive at once, and how many of those the weather may hold. */
export const effectBudget = { particles: 2000, weather: 1500 } as const;

/** Meters a second at `ambient.wind` 1. */
export const windSpeed = 8;
