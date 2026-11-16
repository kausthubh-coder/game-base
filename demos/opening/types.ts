// The opening lab's contract: one film, several ways of making its picture. Everything a way, the sound and
// the page need from each other is in this file. docs/opening-lab.md says why it is cut this way.
import type { Quality } from '../../src/engine/types.ts';

export type ShotId = 'war' | 'king' | 'friends' | 'roads' | 'sickness' | 'night' | 'gods' | 'mark' | 'wall' | 'doorstep' | 'morning';

/** 0 is the legend on the temple wall (eight shots). 1 is you: the wall in the dark room, the doorstep, the morning. */
export type Part = 0 | 1;

export interface Shot {
  id: ShotId;
  /** Its place in the film, from 0. */
  n: number;
  part: Part;
  title: string;
  /** What Hobb says. The page shows it as words and the soundtrack speaks it. A way never draws words. */
  say: string;
  /** What the picture has to show. */
  see: string;
  /** Seconds from the start of the film to the start of this shot. */
  at: number;
  /** Seconds it lasts. It grows with the spoken line, so read it here and never write a length into a way. */
  len: number;
  /** Named moments the picture and the sound both hit, in seconds from the start of the shot. */
  beats: Readonly<Record<string, number>>;
  /** The mockup's painted picture of this shot, a file name in art/plates without `.jpg`. */
  plate: string;
}

export interface Film {
  shots: readonly Shot[];
  /** Seconds, start to end. */
  length: number;
  /** Seconds into a shot before its words appear and its line is spoken. */
  lead: number;
  shot(id: ShotId): Shot;
  /** The shot on screen at film time t. */
  at(t: number): Shot;
}

/** A way of making the picture. */
export type Way = 'plates' | 'drawn' | 'cutout' | 'engine';

/** Seconds a way keeps drawing past its last shot, while the next way fades in over it. */
export const SEAM = 1;

/**
 * One way's picture. It draws on its own canvas, which the page stacks, sizes and fades.
 *
 * The picture at film time t is a function of t alone: no state carried from the frame before, no clock of
 * its own, no Math.random() at draw time. Then the scrub bar can jump anywhere and a screenshot at `?t=12`
 * is the same every time. Particles take their place from their index and t.
 */
export interface FilmRenderer {
  readonly canvas: HTMLCanvasElement;
  /** Gets ready to draw these shots, and only these. Resolves when any of them can be drawn. */
  load(shots: readonly Shot[]): Promise<void>;
  /**
   * True once a shot's pictures are in, so the game can start the film on its first shots and hold the clock at a
   * shot whose art is still on its way. A way without it is ready when `load` resolves.
   */
  ready?(id: ShotId): boolean;
  /**
   * Draws the film at t seconds. Called with t from the start of the first loaded shot to SEAM seconds past
   * the end of the last one; past the end, the last shot keeps moving. Between two of its own shots the way
   * picks the cut or the dissolve, and the change lands within 0.4 s of the next shot's `at`.
   */
  draw(t: number): void;
  /** The page's stage changed size: CSS pixels and the device pixel ratio. A way with a fixed canvas ignores it. */
  resize?(width: number, height: number, pixelRatio: number): void;
  /**
   * The whole picture of one legend shot as a still, with no camera move, 16:9. The engine paints it on the
   * hall's wall when this way plays the legend in a mix, so the wall matches the film the player just saw.
   */
  panel?(id: ShotId): CanvasImageSource | null;
  /** What the last draw cost, for a way that draws with WebGL. */
  stats?(): { drawCalls: number; triangles: number };
  dispose(): void;
}

export interface RendererOptions {
  quality: Quality;
  /** In a mix: the legend way's still of each panel, for the wall in the hall. Without it the engine uses the plates. */
  wall?: (id: ShotId) => CanvasImageSource | null;
}

/** What each way's index.ts exports as `create`. */
export type CreateRenderer = (film: Film, options: RendererOptions) => FilmRenderer;

/** The film's sound: Hobb's voice, the score and the effects, all scheduled from film time. */
export interface Soundtrack {
  /** Seconds each spoken line lasts, by shot. A shot with no clip is missing. */
  readonly voiceSeconds: Partial<Record<ShotId, number>>;
  /** Starts the sound as if the film had been playing all along and is now at t. Only after a press: browsers block sound before one. */
  play(film: Film, t: number): void;
  /** Quiet within a tenth of a second. */
  stop(): void;
  /** Permanently stops the film and closes its own audio context. Safe to call twice. */
  dispose(): void;
}

/** What sound/index.ts exports as `loadSoundtrack`. `voice` is the id of one of the takes of Hobb in `VOICES`. */
export type LoadSoundtrack = (options: { voice: string }) => Promise<Soundtrack>;

/** One take of Hobb. sound/index.ts exports the list as `VOICES`, the first being the one to start with. */
export interface VoiceTake { id: string; name: string }

/** A 3D set the engine way plays a shot on. engine/sets builds them and the director moves the camera, the people and the light. */
export interface StageSet {
  readonly root: import('three').Object3D;
  /** Named points on the set in its own space, in metres: where a person stands, where a panel hangs. */
  readonly anchors: Readonly<Record<string, readonly [x: number, y: number, z: number]>>;
  /** What moves by itself on the set (flags, a lamp's chain), as a function of film time. */
  update?(t: number): void;
  dispose(): void;
}
