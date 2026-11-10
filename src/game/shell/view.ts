import type { Graphics } from './graphics.ts';
// What a view file gets. A view is any file in src/game/views/ named `<something>.view.ts` that exports
// `install(view: GameView)`. src/game/boot.ts finds every one of them, sorts them by file name and calls
// each install once, after the world, the systems and the base features exist and before the first frame.
// A view that throws is logged and skipped, and the game still starts.
//
//   export function install(view: GameView): void {
//     const label = document.createElement('div');
//     view.root.append(label);
//     view.onFrame(() => { label.textContent = String(view.game.clock.day); });
//   }
//
// Nothing here is a global. A view keeps what it needs from the object it is handed.
import type * as THREE from 'three';
import type { ViewContext } from '../../engine/system.ts';
import type { Quality, Vec3 } from '../../engine/types.ts';
import type { Assets } from '../../features/assets/index.ts';
import type { AudioSystem, BusName } from '../../features/audio/index.ts';
import type { CameraView } from '../../features/camera/index.ts';
import type { Effects } from '../../features/effects/index.ts';
import type { PerfView } from '../../features/perf/index.ts';
import type { Post } from '../../features/post/index.ts';
import type { Sky } from '../../features/sky/index.ts';
import type { Sprites } from '../../features/sprites/index.ts';
import type { Water } from '../../features/water/index.ts';
import type { WorldView } from '../../features/world/index.ts';
import type { Game } from '../api.sim.ts';
import type { Kernel } from '../kernel.sim.ts';
import type { Keys } from './keys.ts';

/** A point on the page, in CSS pixels from the top left of `view.root`. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** The numbers on the end card. */
export interface EndStats {
  /** Days played, counting the one in progress. */
  days: number;
  /** Wheat that went into the bag. */
  wheat: number;
  /** Blocks and stations the player placed. */
  blocks: number;
  /** Almanac pages with both columns full. */
  pages: number;
}

export type QualityMode = 'auto' | Quality;

/**
 * How the camera stands. `tilt` is the 2.5D camera, the default: a fixed pitch with quarter turns and pointer
 * aiming. `free` is third person, orbited with the mouse, aimed from a crosshair. `first` is first person.
 */
export type CameraMode = 'tilt' | 'free' | 'first';
export const CAMERA_MODES: readonly CameraMode[] = ['tilt', 'free', 'first'];
/** How people, the pet and the creatures are drawn: pixel-art sprites, the default, or 3D models. */
export type CharacterLook = 'sprites' | 'models';
export const CHARACTER_LOOKS: readonly CharacterLook[] = ['sprites', 'models'];

/** The settings a title or pause screen changes. Each one is stored and is there again on the next visit. */
export interface ViewSettings {
  /** `auto` lets the performance meter pick the level. */
  readonly graphics: Readonly<Graphics>;
  setGraphics(settings: Partial<Graphics>): void;
  readonly quality: QualityMode;
  setQuality(mode: QualityMode): void;
  /** 0 to 1 for `master`, `music`, `ambience`, `effects` or `voice`. It holds before the sound has started too. */
  volume(bus: BusName): number;
  setVolume(bus: BusName, value: number): void;
  /** `?camera=free` in the address holds a mode for this visit, as `?quality=` does. */
  readonly camera: CameraMode;
  /** Takes effect at once, with no reload, and is stored. */
  setCamera(mode: CameraMode): void;
  /** `?chars=models` in the address holds a look for this visit. */
  readonly characters: CharacterLook;
  /** Takes effect at once, with no reload, and is stored. */
  setCharacters(look: CharacterLook): void;
  /** Runs `fn` after the camera mode or the character look changed. Returns a function that stops it. */
  onChange(fn: (setting: 'camera' | 'characters') => void): () => void;
}

/** What the aim is on: the block under the pointer when it is in reach, else null. */
export interface Aim {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
  id: number;
}

export interface GameView {
  readonly kernel: Kernel;
  readonly game: Game;
  /** The frame context every base feature is updated with. `ctx.ambient` is `game.ambient`. */
  readonly ctx: ViewContext;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly canvas: HTMLCanvasElement;
  /**
   * The element over the canvas for everything drawn in HTML. It fills the page and lets clicks through
   * (`pointer-events: none`), so set `pointer-events: auto` on anything of yours that takes a click.
   */
  readonly root: HTMLElement;

  // ---- the base features
  readonly world: WorldView;
  readonly camera: CameraView;
  readonly sprites: Sprites;
  readonly sky: Sky;
  readonly water: Water;
  readonly effects: Effects;
  readonly post: Post;
  readonly perf: PerfView;
  readonly assets: Assets;
  /** The sound engine. Null until the first click or key, because a browser will not start sound sooner. */
  readonly audio: AudioSystem | null;
  /** Runs `fn` when the sound engine starts, or at once when it already has. */
  onAudio(fn: (audio: AudioSystem) => void): void;
  /** Every key, button and wheel the game reads. */
  readonly keys: Keys;

  // ---- the two clocks
  /** Runs `fn` once a frame, after the simulation and the camera and before the picture is drawn. Returns a function that stops it. */
  onFrame(fn: (dt: number) => void): () => void;
  /** Runs `fn` after every simulation step, 20 times a second of game time, with dt = 0.05. It also runs during `window.__game.advance`. */
  onSimStep(fn: (dt: number) => void): () => void;

  // ---- reading the scene
  /**
   * Where a point of the world is on the page. Null when it is behind the camera or off the page.
   * Pass `out` to have it filled and returned, so a call every frame makes no garbage.
   */
  project(x: number, y: number, z: number, out?: ScreenPoint): ScreenPoint | null;
  /** Where the player's feet are drawn this frame. Smoother than `game.player.pos`, which moves in steps. */
  readonly playerPosition: Readonly<Vec3>;
  /** The block under the pointer, when it is in reach. The same object every frame. */
  readonly aim: Readonly<Aim> | null;
  stats(): EndStats;
  readonly settings: ViewSettings;

  // ---- the game's life, for the title and pause screens
  /** True once a new game or a saved one is running. */
  readonly started: boolean;
  /**
   * A title screen calls this from its install. Without it the game starts by itself as soon as the views are
   * installed: the saved game when there is one, a new one otherwise.
   */
  holdStart(): void;
  hasSave(): boolean;
  /** Loads the saved game and starts it. False when there is nothing to load. */
  continueGame(): boolean;
  /** Starts a new game at the region's spawn point. A game already in progress reloads the page to do it cleanly. */
  newGame(): void;
  /** Writes the save now. False when the browser would not store it. */
  save(): boolean;
  /** While paused the simulation stands still and the picture is still drawn. Each reason is counted on its own. */
  setPaused(reason: string, paused: boolean): void;
  readonly paused: boolean;
}

/** The shape of a file in src/game/views/. */
export interface ViewModule {
  install?: (view: GameView) => void | Promise<void>;
}
