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
import type { Keys, Press } from './keys.ts';

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
 * How the camera stands. `tilt` is the 2.5D camera, the default: a fixed pitch, turned with a right-button drag or
 * in quarter turns, and pointer aiming. `free` is third person, orbited with the mouse as `MouseStyle` says.
 * `first` is first person, aimed from a crosshair.
 */
export type CameraMode = 'tilt' | 'free' | 'first';
export const CAMERA_MODES: readonly CameraMode[] = ['tilt', 'free', 'first'];
/**
 * How the mouse turns the free camera. `drag` is Roblox's way, the default: the cursor stays free and aims, and a
 * drag with the right button held turns the camera. `lock` is Genshin's: a click takes the mouse, and from then on
 * the mouse turns the camera and the crosshair in the middle aims. First person always locks the mouse.
 */
export type MouseStyle = 'drag' | 'lock';
export const MOUSE_STYLES: readonly MouseStyle[] = ['drag', 'lock'];
/**
 * How the 2.5D camera comes to rest after a right-button drag. `quarter`, the default: the drag turns it smoothly
 * with the hand, and when it is let go it glides to the nearest quarter turn, where the blocks read as 3D.
 * `smooth`: it stays where it was let go. Halfway between two quarters the view looks straight along the grid
 * and the blocks show only their fronts and tops.
 */
export type TiltTurn = 'quarter' | 'smooth';
export const TILT_TURNS: readonly TiltTurn[] = ['quarter', 'smooth'];
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
  /** `?mouse=lock` in the address holds a style for this visit. */
  readonly mouse: MouseStyle;
  /** Takes effect at once, and is stored. */
  setMouse(style: MouseStyle): void;
  /** `?turn=smooth` in the address holds it for this visit. */
  readonly tiltTurn: TiltTurn;
  /** Takes effect at once, and is stored. Quarter turns brings a camera that rests between two quarters to the nearest. */
  setTiltTurn(turn: TiltTurn): void;
  /** `?chars=models` in the address holds a look for this visit. */
  readonly characters: CharacterLook;
  /** Takes effect at once, with no reload, and is stored. */
  setCharacters(look: CharacterLook): void;
  /** Runs `fn` after the camera mode, the mouse style, the 2.5D turning or the character look changed. Returns a function that stops it. */
  onChange(fn: (setting: 'camera' | 'mouse' | 'tiltTurn' | 'characters') => void): () => void;
}

/** What the aim is on: the block under the pointer, or under the crosshair when the mouse is locked, when it is in reach. Else null. */
export interface Aim {
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
  id: number;
}

/**
 * How the ground is drawn. `smooth`, the default: painted land, every one-block step a slope the hero walks up.
 * `steps` (`?look=steps`): the same painted land with every block's top flat and a riser between, climbed with
 * a jump. `blocks` (`?look=blocks`): the block world as it was before the painted look, with its own trees.
 */
export type Look = 'smooth' | 'steps' | 'blocks';

/** Something that draws a scattered prop its own way. `place` returns a number above 0 to take it away by. */
export interface StandIn {
  place(x: number, y: number, z: number, rotation: number, scale: number, variant: number): number;
  remove(id: number): void;
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

  // ---- the painted world
  /** True when the world is drawn in the painted look. False with `?look=blocks` in the address. */
  readonly painted: boolean;
  /** How the ground is drawn. */
  readonly look: Look;
  /**
   * The height of the drawn ground at a point. On painted land it is the smooth surface, which lies up to
   * half a block from the tops of the blocks. NaN where the land is not drawn yet, and everywhere without painted land.
   */
  groundAt(x: number, z: number): number;
  /** How far above the block it stands on a thing at this point is drawn. 0 without painted land. */
  lift(x: number, y: number, z: number): number;
  /** The painted world's view hands its ground in here. */
  setGround(heightAt: (x: number, z: number) => number): void;
  /**
   * What the painted world draws in place of a scattered prop, by the prop's kind (`rock`, `bush`, `berryBush`).
   * A view that places a prop asks here first. Empty without painted land.
   */
  readonly standIns: Map<string, StandIn>;

  // ---- a view that takes some of the keys for itself
  /**
   * Takes presses of these kinds away from the shell: while a reason claims a kind, the shell does nothing for it
   * and the claimer acts on it from `keys.onPress`. `use` also stops the held left button from breaking blocks.
   * Build mode claims `use` so a drag paints a field. `null` gives the reason's kinds back.
   */
  claim(reason: string, kinds: readonly Press['kind'][] | null): void;
  /** True while some reason claims presses of this kind. */
  claimed(kind: Press['kind']): boolean;
}

/** The shape of a file in src/game/views/. */
export interface ViewModule {
  install?: (view: GameView) => void | Promise<void>;
}
