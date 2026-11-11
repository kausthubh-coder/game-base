import { readGraphics, type Graphics } from './graphics.ts';
// The shell: it makes the renderer, the block world, the kernel with its systems and every base feature,
// steps the rules 20 times a second and draws in between. It hands all of it out as one `GameView`.
//
// One frame, in order: the keys steer the body (60 steps a second), every third body step is one kernel
// step, the camera follows, the world, sky, water and effects update, the views run, the sprites are
// written and the picture is drawn through post-processing.
import * as THREE from 'three';
import type { ViewContext } from '../../engine/system.ts';
import { calmNoon, type Quality } from '../../engine/types.ts';
import { flatWorld } from '../../engine/world-query.ts';
import { BLOCKS } from '../../content/blocks.ts';
import { LAND_BLOCKS } from '../../content/land.ts';
import { HAZE, PAINTED_WATER } from '../../content/painted.ts';
import type { BusName } from '../../features/audio/index.ts';
import { cameraProfile, createCamera } from '../../features/camera/index.ts';
import { createEffects } from '../../features/effects/index.ts';
import { createPerf } from '../../features/perf/index.ts';
import { createPost } from '../../features/post/index.ts';
import { createSky } from '../../features/sky/index.ts';
import { createWaterMaterial } from '../../features/water/index.ts';
import { createWorld, emptyHit, spawnPoint } from '../../features/world/index.ts';
import { reachDistance } from '../actions/index.sim.ts';
import type { Systems, UseContext } from '../api.sim.ts';
import { STEP, createKernel } from '../kernel.sim.ts';
import { installSystems, type Installed } from '../systems.ts';
import { loadArt, makeSprites } from './art.ts';
import { HINTS } from '../content/hints.ts';
import { createKeys, type MouseMode, type Press } from './keys.ts';
import { HERO_STEP, createPlayer, type PlayerRig } from './player.ts';
import { clearSave, hasSave, readSave, reloadInto, writeSave } from './save.ts';
import { BUSES, DEFAULT_VOLUMES, createSound } from './sound.ts';
import { CAMERA_MODES, CHARACTER_LOOKS, MOUSE_STYLES, TILT_TURNS, type CameraMode, type CharacterLook, type GameView, type Look, type MouseStyle, type QualityMode, type ScreenPoint, type TiltTurn } from './view.ts';
import { dressWater } from './water.ts';

/** The camera's distance at each wheel step, nearest first. A person is about 90 pixels tall at the first on a 900 pixel screen. */
const CAMERA_DISTANCES = [34, 46, 66, 94];
const SETTINGS_KEY = 'greenhollow.settings';
/** Body steps in one kernel step: 60 a second against 20. */
const BODY_STEPS = Math.round(STEP / HERO_STEP);
/** Seconds of play between two automatic saves. */
const SAVE_EVERY = 60;
/** The eyes are this far above the feet. Reach is measured from them, as the actions system does. */
const EYE_HEIGHT = 1.6;
/** A swimming hero floats with little more than the hair out of the water. In first person the eyes rise this much, to just over the surface. */
const SWIM_EYE = 0.55;
/** Radians the view turns for each pixel the mouse moves, locked or dragging. About 650 pixels make a quarter turn. */
const LOOK_SPEED = 0.0024;
/** The camera modes in the order V goes through them. */
const NEXT_CAMERA: Record<CameraMode, CameraMode> = { tilt: 'free', free: 'first', first: 'tilt' };
/** Chunks around the player that must exist before the rules run, each way. */
const READY_REACH = 1;
/** Chunks loaded on the spot around a teleport or a start, each way, so the rules never see a hole. */
const LOAD_REACH = 3;
const LEVELS: readonly Quality[] = ['low', 'medium', 'high'];

export interface ShellOptions {
  canvas: HTMLCanvasElement;
  root: HTMLElement;
  /** 0 to 1 while the art loads. */
  onProgress?: (done: number) => void;
}

/** What the debug door and boot.ts need beyond the `GameView`. */
export interface Shell {
  view: GameView;
  systems: Installed;
  player: PlayerRig;
  /** Starts drawing frames. */
  run(): void;
  /** Steps the rules and the body `steps` kernel steps without drawing. */
  advance(steps: number): void;
  /** Puts the player somewhere at once: the land is loaded there, and the camera and the water follow. */
  place(x: number, y: number, z: number, facing?: number): void;
  /** Resolves after `count` more frames were drawn. */
  frames(count: number): Promise<void>;
  /** Resolves when every chunk in view has an up-to-date mesh. */
  settled(): Promise<void>;
  /** A listener of a view that threw: its name and message. Empty when all is well. */
  readonly errors: string[];
  /** True when a title screen, or `?hold` in the address, asked the game not to start by itself. */
  readonly holdsStart: boolean;
}

interface StoredSettings {
  graphics: Graphics;
  quality: QualityMode;
  volumes: Record<BusName, number>;
  camera: CameraMode;
  mouse: MouseStyle;
  tiltTurn: TiltTurn;
  characters: CharacterLook;
}

function readSettings(): StoredSettings {
  const settings: StoredSettings = { graphics: readGraphics(null), quality: 'auto', volumes: { ...DEFAULT_VOLUMES }, camera: 'tilt', mouse: 'drag', tiltTurn: 'quarter', characters: 'sprites' };
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<StoredSettings> | null;
    if (stored?.quality === 'auto' || LEVELS.includes(stored?.quality as Quality)) settings.quality = stored!.quality as QualityMode;
    settings.graphics = readGraphics(stored?.graphics);
    if (CAMERA_MODES.includes(stored?.camera as CameraMode)) settings.camera = stored!.camera as CameraMode;
    if (MOUSE_STYLES.includes(stored?.mouse as MouseStyle)) settings.mouse = stored!.mouse as MouseStyle;
    if (TILT_TURNS.includes(stored?.tiltTurn as TiltTurn)) settings.tiltTurn = stored!.tiltTurn as TiltTurn;
    if (CHARACTER_LOOKS.includes(stored?.characters as CharacterLook)) settings.characters = stored!.characters as CharacterLook;
    for (const bus of BUSES) {
      const value = stored?.volumes?.[bus];
      if (typeof value === 'number' && Number.isFinite(value)) settings.volumes[bus] = Math.min(1, Math.max(0, value));
    }
  } catch {
    // No storage, or something else's text under the key: the defaults stand.
  }
  return settings;
}

export async function createShell(options: ShellOptions): Promise<Shell> {
  const { canvas, root } = options;
  const params = new URLSearchParams(location.search);
  const settings = readSettings();
  // `?quality=low` holds a level for this visit only. It is how a test gets the same picture every time.
  const asked = LEVELS.find((level) => level === params.get('quality'));
  let mode: QualityMode = asked ?? settings.quality;
  // `?camera=free`, `?mouse=lock`, `?turn=smooth` and `?chars=models` hold a camera mode, a mouse style, the 2.5D
  // turning and a character look for this visit, so a test or a comparison shot gets the same picture whatever was stored.
  let cameraMode: CameraMode = CAMERA_MODES.find((m) => m === params.get('camera')) ?? settings.camera;
  let mouseStyle: MouseStyle = MOUSE_STYLES.find((m) => m === params.get('mouse')) ?? settings.mouse;
  let tiltTurn: TiltTurn = TILT_TURNS.find((t) => t === params.get('turn')) ?? settings.tiltTurn;
  let characterLook: CharacterLook = CHARACTER_LOOKS.find((l) => l === params.get('chars')) ?? settings.characters;
  const changeListeners: ((setting: 'camera' | 'mouse' | 'tiltTurn' | 'characters') => void)[] = [];

  // ---------------------------------------------------------------- the renderer and the scene
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // A laptop at 150% scaling would draw 2.25 times the pixels of 1080p for little gain in a pixel-art world.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10141a);
  const lens = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 1, 400);
  const ctx: ViewContext = { scene, camera: lens, renderer, ambient: calmNoon(), world: flatWorld, quality: mode === 'auto' ? 'high' : mode, time: 0 };

  const art = await loadArt(options.onProgress);

  // ---------------------------------------------------------------- the world, the rules, the features
  const perfHolder = document.createElement('div');
  perfHolder.hidden = params.get('perf') !== '1';
  perfHolder.style.pointerEvents = 'auto';
  root.append(perfHolder);
  let basePostScale = 1, appliedScale = -1;
  const perf = createPerf(ctx, {
    parent: perfHolder,
    auto: mode === 'auto',
    onQuality(quality) {
      world.setQuality?.(quality);
      sky.setQuality?.(quality);
      water.setQuality?.(quality);
      effects.setQuality?.(quality);
      sprites.setQuality?.(quality);
      post.setQuality?.(quality);
      sound.audio?.setQuality?.(quality);
      basePostScale = post.settings.renderScale;
      appliedScale = -1;
      applyGraphics();
    },
  });

  // The camera is the tilt profile: today's top-down view zoomed out, lowering toward the horizon as you zoom
  // in. `?cam=today` gives the old camera, and `?cam=horizon` and the others in profiles.ts stand it elsewhere.
  const cam = cameraProfile(params.get('cam') ?? 'tilt');

  // The ground is drawn clean: the same blocks as painted land, with soft edges between materials.
  // `?ground=today` gives the old, tile-by-tile ground to compare.
  const ground = params.get('ground') === 'today' ? 'today' : 'clean';
  // The painted world draws the natural ground itself, as one smooth surface, so the block mesher leaves
  // those blocks out. `?look=blocks` draws the ground as blocks again.
  const look: Look = params.get('look') === 'blocks' ? 'blocks' : params.get('look') === 'steps' ? 'steps' : 'smooth';
  const painted = look !== 'blocks';
  const leaveOut = painted ? BLOCKS.filter((block) => LAND_BLOCKS.includes(block.key)).map((block) => block.id) : [];
  const world = createWorld(ctx, { seed: Number(params.get('seed')) || 1, atlas: art.blockAtlas, viewScale: perf.stress * (cam?.load ?? 1), ground, leaveOut });
  let groundAt: (x: number, z: number) => number = () => NaN;
  /**
   * How far above the block it stands on something is drawn. The painted land is smooth, so it lies up to half
   * a block from the tops of the blocks. Nothing where the land is not drawn, and nothing for what stands on a
   * floor or a roof and not on the ground.
   */
  function lift(x: number, y: number, z: number): number {
    const g = groundAt(x, z);
    if (!(g === g)) return 0;
    const base = world.sim.heightAt(Math.floor(x), Math.floor(z)), d = g - base;
    return Math.abs(d) <= 0.75 && Math.abs(y - base) < 1.7 ? d : 0;
  }
  ctx.world = world.query;
  const kernel = createKernel(world.sim, Number(params.get('seed')) || 7);
  const game = kernel.game;
  // One Ambient for the rules and the picture: the time system writes it, every feature reads it.
  ctx.ambient = game.ambient;
  const systems = installSystems(kernel);
  const sys = game.systems as Partial<Systems>;

  // A closer step than the base's three, and the game opens on it, so a face and the pet read at a glance.
  const camera = createCamera(ctx, { blocks: world.sim, input: false, rig: cam?.rig ?? { distances: CAMERA_DISTANCES, zoom: 0 }, fov: cam?.fov, mode: cameraMode });
  // The painted world paints its own clouds (src/features/painted/sky.ts), so the sky leaves its flat ones out.
  const sky = createSky(ctx, { shadowRange: 40, clouds: !painted });
  // The painted world's water is the pale blue of the painted meadow's pond.
  const water = createWaterMaterial(ctx, painted ? { shallow: PAINTED_WATER.shallow, deep: PAINTED_WATER.deep } : {});
  const effects = createEffects(ctx);
  // The painted world is finished as it is drawn: its colours are the painter's, so the final pass adds nothing but glow.
  const post = createPost(ctx, painted ? { saturation: 1 } : {});
  const sprites = makeSprites(ctx, art.assets);
  water.setSky(sky.look);
  effects.setSky(sky.look);
  sprites.setSky(sky.look);
  basePostScale = post.settings.renderScale;
  // `?water=plain` keeps the world's own flat water, to compare the two.
  const dress = params.get('water') === 'plain' ? null : dressWater(scene, water.material);

  const sound = createSound(settings.volumes);
  sound.onStart((audio) => audio.setQuality?.(ctx.quality));

  const keys = createKeys(canvas);
  // With Quarter turns the 2.5D camera turns with the hand during a drag and glides to the nearest quarter after it.
  keys.onDragEnd(() => { if (tiltTurn === 'quarter') camera.settle(); });
  const start = sys.region?.spawn() ?? spawnPoint();
  const player = createPlayer(game, world.sim, keys, start, { stepUp: look === 'smooth' ? 1 : 0, lift });

  /**
   * How the mouse works with a camera: the 2.5D camera points and drags, first person locks the mouse, and the free
   * camera does as the Mouse setting says.
   */
  const mouseOf = (mode: CameraMode): MouseMode => (mode === 'tilt' ? 'point' : mode === 'first' || mouseStyle === 'lock' ? 'lock' : 'drag');

  /** Puts the camera mode into effect: the camera, the mouse, and the hero's body hidden in first person. */
  function applyCamera(next: CameraMode): void {
    camera.setMode(next);
    keys.setMouse(mouseOf(next));
    player.actor.visible = next !== 'first';
    lastRange = lastZoom = -1;
  }
  /** The shadow range and the zoom the sky was last given, so it is told only when they change. */
  let lastRange = -1, lastZoom = -1;

  // A hint that names camera keys is worded for the mouse in use when it is sent. The shell hears it before any view.
  game.events.on('hint', (e) => {
    const worded = HINTS.find((hint) => hint.id === e.id)?.mouse?.[keys.mouse];
    if (worded) e.text = worded;
  });

  // ---------------------------------------------------------------- the end card's numbers
  let wheat = 0, blocks = 0;
  game.events.on('item.gained', (e) => { if (e.id === 'wheat') wheat += e.count; });
  game.events.on('block.placed', (e) => { if (e.by === 'player') blocks++; });
  game.events.on('placeable.placed', () => { blocks++; });

  // ---------------------------------------------------------------- listeners of views
  type Listener = (dt: number) => void;
  const frameListeners: Listener[] = [];
  const stepListeners: Listener[] = [];
  const errors: string[] = [];

  function listen(list: Listener[], fn: Listener): () => void {
    list.push(fn);
    return () => {
      const at = list.indexOf(fn);
      if (at >= 0) list.splice(at, 1);
    };
  }

  /** Calls every listener. One that throws is logged once and taken off the list, so the frame goes on. */
  function call(list: Listener[], dt: number, what: string): void {
    for (let i = 0; i < list.length; i++) {
      try {
        list[i](dt);
      } catch (error) {
        const text = `${what} listener: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(text);
        console.error(`[game] a view's ${what} listener threw and was removed:`, error);
        list.splice(i--, 1);
      }
    }
  }

  // ---------------------------------------------------------------- the aim: the block under the pointer
  const hit = emptyHit();
  const origin = new THREE.Vector3(), ray = new THREE.Vector3();
  let aimed = false;

  function takeAim(): void {
    aimed = false;
    // A locked mouse aims from the middle of the screen, where the crosshair is. A free cursor aims where it is.
    const centre = keys.mouse === 'lock';
    const pointer = keys.pointer;
    // A drag turning the camera aims at nothing, so no box or ghost sweeps over the land while it turns.
    if (!centre && (!pointer.over || keys.dragging)) return;
    origin.copy(lens.position);
    ray.set(centre ? 0 : pointer.x, centre ? 0 : pointer.y, 0.5).unproject(lens).sub(origin);
    // The ray skips what the cutaway hides, so a click goes through a hidden roof to the floor.
    ray.normalize();
    const blockHit = world.sim.raycast(origin.x, origin.y, origin.z, ray.x, ray.y, ray.z, 500, hit, camera.hides);
    const treeHit = sys.trees?.raycast(origin, ray, blockHit ? hit.distance : 500, hit);
    if (!blockHit && !treeHit) return;
    const p = game.player.pos, eye = p.y + EYE_HEIGHT;
    const dx = Math.max(hit.x - p.x, 0, p.x - hit.x - 1), dy = Math.max(hit.y - eye, 0, eye - hit.y - 1), dz = Math.max(hit.z - p.z, 0, p.z - hit.z - 1);
    const tree=sys.trees?.at(hit.x,hit.y,hit.z);
    aimed = tree ? reachDistance(game.player,tree.box.x0,tree.box.y0,tree.box.z0,tree.box.x1,tree.box.y1,tree.box.z1) <= (sys.actions?.reach ?? 5) : Math.hypot(dx, dy, dz) <= (sys.actions?.reach ?? 5);
  }

  const using: UseContext = { hit: null, held: null, button: 'primary' };
  function useContext(button: 'primary' | 'secondary'): UseContext {
    using.hit = aimed ? hit : null;
    using.held = sys.inventory?.held() ?? null;
    using.button = button;
    return using;
  }

  // ---------------------------------------------------------------- the game's life
  let started = false;
  /** True once the kernel has run or loaded. From then on a new game needs a fresh page. */
  let dirty = false;
  let held = params.has('hold');
  const pauses = new Set<string>();
  let saveDue = false, sinceSave = 0;

  const running = (): boolean => started && pauses.size === 0;

  /** True when the land around a point is in memory, `reach` chunks each way. */
  function loadedAround(x: number, z: number, reach: number): boolean {
    const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4;
    for (let dx = -reach; dx <= reach; dx++) for (let dz = -reach; dz <= reach; dz++) if (!world.sim.chunkAt(cx + dx, cz + dz)) return false;
    return true;
  }

  /** Makes the land around a point right now, without waiting for the worker. */
  function loadAround(x: number, z: number, reach: number): void {
    const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4;
    for (let dx = -reach; dx <= reach; dx++) for (let dz = -reach; dz <= reach; dz++) world.sim.load(cx + dx, cz + dz);
  }

  function place(x: number, y: number, z: number, facing?: number, loadNow = true): void {
    if (loadNow) loadAround(x, z, LOAD_REACH);
    player.teleport(x, y, z, facing);
    camera.follow(x, y, z);
    camera.snap();
    world.setFocus(x, z);
    water.setFocus(player.position);
    water.refresh();
  }

  function save(): boolean {
    if (!started) return false;
    sinceSave = 0;
    saveDue = false;
    try {
      return writeSave({ version: 1, at: Date.now(), world: world.save(), game: kernel.save(), shell: { wheat, blocks } });
    } catch (error) {
      console.warn('[game] a system could not be saved:', error);
      return false;
    }
  }

  function newGame(): void {
    if (dirty) {
      // Systems keep their state in closures, so the clean way back to day 1 is a fresh page.
      clearSave();
      reloadInto('new');
      return;
    }
    const at = sys.region?.spawn() ?? spawnPoint();
    place(at.x, at.y, at.z, Math.PI);
    started = dirty = true;
  }

  function continueGame(): boolean {
    if (dirty) {
      if (!hasSave()) return false;
      reloadInto('continue');
      return true;
    }
    const file = readSave();
    if (!file) return false;
    dirty = true;
    try {
      // The world first, so a station's cells match the blocks around it when the systems load.
      world.load(file.world);
      loadAround(file.game.player.x, file.game.player.z, LOAD_REACH);
      kernel.load(file.game);
      wheat = file.shell.wheat;
      blocks = file.shell.blocks;
    } catch (error) {
      console.error('[game] the save did not load:', error);
      return false;
    }
    const p = game.player;
    place(p.pos.x, p.pos.y, p.pos.z, p.facing);
    started = true;
    return true;
  }

  // A save asked for in the middle of a step is written at its end, when every system has finished.
  game.events.on('slept', () => { saveDue = true; });
  game.events.on('quest.step', () => { saveDue = true; });
  window.addEventListener('pagehide', () => { if (started) save(); });

  // ---------------------------------------------------------------- presses a view took for itself
  const claims = new Map<string, readonly Press['kind'][]>();
  function claimed(kind: Press['kind']): boolean {
    for (const kinds of claims.values()) if (kinds.includes(kind)) return true;
    return false;
  }

  // ---------------------------------------------------------------- one step of the rules
  function simStep(): void {
    if (keys.primary && !game.player.busy && !claimed('use')) sys.actions?.hold(useContext('primary'), STEP);
    kernel.step();
    call(stepListeners, STEP, 'step');
    sinceSave += STEP;
    if (saveDue || sinceSave >= SAVE_EVERY) save();
  }

  let carry = 0, bodySteps = 0;
  function bodyStep(): void {
    player.step(camera.yaw, camera.mode === 'first');
    if (++bodySteps < BODY_STEPS) return;
    bodySteps = 0;
    simStep();
  }

  function advance(steps: number): void {
    if (!started) return;
    for (let i = 0; i < steps; i++) {
      if (!loadedAround(player.body.x, player.body.z, READY_REACH)) loadAround(player.body.x, player.body.z, LOAD_REACH);
      for (let b = 0; b < BODY_STEPS; b++) bodyStep();
    }
    player.blend(1);
  }

  // ---------------------------------------------------------------- the keys
  function onPress(press: Press): void {
    // A view that claimed this kind of press acts on it itself.
    if (claimed(press.kind)) return;
    if (press.kind === 'perf') { perfHolder.hidden = !perfHolder.hidden; return; }
    if (press.kind === 'turn') { camera.turn(press.direction); return; }
    if (press.kind === 'zoom') { camera.zoomBy(press.steps); return; }
    if (press.kind === 'camera') { view.settings.setCamera(NEXT_CAMERA[cameraMode]); return; }
    if (!running()) return;
    if (press.kind === 'slot') {
      if (sys.inventory) sys.inventory.selected = press.index;
    } else if (press.kind === 'slotStep') {
      if (sys.inventory) sys.inventory.selected += press.step;
    } else if (game.player.busy) {
      // A panel or a conversation has the player: nothing in the world acts.
    } else if (press.kind === 'interact') {
      sys.interact?.act();
    } else if (press.kind === 'use') {
      takeAim();
      sys.actions?.use(useContext(press.button));
    }
  }
  keys.onPress(onPress);

  // ---------------------------------------------------------------- one frame
  const projected = new THREE.Vector3();
  const size = { width: window.innerWidth, height: window.innerHeight };
  window.addEventListener('resize', () => {
    size.width = window.innerWidth;
    size.height = window.innerHeight;
    renderer.setSize(size.width, size.height, false);
    lens.aspect = size.width / size.height;
  });

  let last = performance.now(), frameCount = 0, quiet = 0;
  const mouse = { x: 0, y: 0 };
  const waiters: { until: () => boolean; done: () => void }[] = [];
  const until = (test: () => boolean): Promise<void> => new Promise((done) => waiters.push({ until: test, done }));

  function frame(now: number): void {
    requestAnimationFrame(frame);
    perf.begin('frame');
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    ctx.time += dt;

    if (running() && loadedAround(player.body.x, player.body.z, READY_REACH)) {
      perf.begin('sim');
      carry = Math.min(carry + dt, 0.25);
      while (carry >= HERO_STEP) {
        bodyStep();
        carry -= HERO_STEP;
      }
      perf.end('sim');
      player.blend(carry / HERO_STEP);
    }

    // A locked mouse or a right-button drag turns the view; the 2.5D camera only along the ground. Anything that
    // holds the player gives the cursor back and ends a drag.
    keys.freeCursor(!running() || game.player.busy);
    keys.takeLook(mouse);
    if (mouse.x !== 0 || mouse.y !== 0) camera.look(-mouse.x * LOOK_SPEED, camera.mode === 'tilt' ? 0 : mouse.y * LOOK_SPEED);

    const p = player.position;
    camera.follow(p.x, p.y + (camera.mode === 'first' && player.body.swimming ? SWIM_EYE : 0), p.z);
    if (settings.graphics.reduceMotion) camera.snap();
    camera.update(settings.graphics.reduceMotion ? 1 : Math.min(dt, 0.1), ctx);
    world.setFocus(p.x, p.z);
    world.setCutaway(camera.cutaway);
    world.update(dt, ctx);
    dress?.();

    // Everything follows the hero. The sky gets what Ambient does not carry: the moon, a rainbow after rain.
    const a = game.ambient;
    const look = camera.profile;
    if (look) {
      // The free and first-person cameras see the horizon: the fog reaches as far as the view distance asks and is
      // whole before the loaded land ends.
      const range = settings.graphics.shadowDistance ?? look.shadowRange;
      if (range !== lastRange) sky.setShadowRange((lastRange = range));
      const edge = world.stats.radius * 16 - 8, far = settings.graphics.viewDistance ?? 1;
      // The painted world draws land to the horizon, so its fog is only the air: thin, and whole far past the loaded land.
      if (painted) sky.setFogReach(HAZE.fog[0] as number, HAZE.fog[1] as number);
      else sky.setFogReach(Math.min(look.fogStart * far, edge * 0.45), Math.min(look.fogEnd * far, edge));
    } else if (cam) {
      const range = settings.graphics.shadowDistance ?? Math.round(camera.stepped(cam.shadowRange));
      if (range !== lastRange) sky.setShadowRange((lastRange = range));
      // The fog is whole before the loaded land ends, which is nearer at a lower quality.
      const edge = world.stats.radius * 16 - 8;
      if (painted) sky.setFogReach(HAZE.fog[0] as number, HAZE.fog[1] as number);
      else sky.setFogReach(Math.min(camera.stepped(cam.fogStart), edge * 0.45), Math.min(camera.stepped(cam.fogEnd), edge));
    } else if (camera.zoom !== lastZoom) {
      lastZoom = camera.zoom;
      sky.setShadowRange(30 + 14 * camera.zoom);
    }
    sky.setShadowTarget(p);
    sky.setMoonPhase(3 + game.clock.day);
    sky.setRainbow(a.rain < 0.05 && a.wetness > 0.3 ? Math.min(1, (a.wetness - 0.3) * 2.5) : 0);
    effects.setFocus(p);
    effects.setMotes(sky.look.night * 0.35 * (1 - a.rain));
    water.setFocus(p);
    post.setFocus(p);
    sky.update(dt, ctx);
    water.update(dt, ctx);
    effects.update(dt, ctx);

    takeAim();
    call(frameListeners, dt, 'frame');
    sprites.update(dt, ctx);

    // The meter lowers the render size before it lowers the quality level. The size is post's to set.
    const scale = Math.max(0.5, basePostScale * perf.snapshot.renderScale);
    if (scale !== appliedScale) {
      appliedScale = scale;
      post.setRenderScale(scale);
    }
    post.update(dt, ctx);
    post.render();

    perf.counters.chunks = world.stats.chunks;
    perf.counters.meshQueue = world.stats.queue;
    perf.counters.meshMs = world.stats.meshMs;
    perf.update(dt, ctx);
    perf.end('frame');

    frameCount++;
    quiet = world.stats.queue === 0 ? quiet + 1 : 0;
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].until()) waiters.splice(i, 1)[0].done();
  }

  // ---------------------------------------------------------------- the view
  function setQuality(next: QualityMode): void {
    mode = next;
    settings.quality = next;
    perf.setMode(next);
    store();
  }

  function store(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // The setting still holds for this visit.
    }
  }

  function applyGraphics(): void {
    const g = settings.graphics;
    sky.sun.castShadow = g.shadows !== 'off';
    sky.sun.shadow.radius = g.shadows === 'sharp' ? 0 : 3;
    sprites.setShadowsEnabled(g.shadows !== 'off');
    const type = g.shadows === 'sharp' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    if (renderer.shadowMap.type !== type) {
      renderer.shadowMap.type = type;
      scene.traverse((object) => { const m = (object as THREE.Mesh).material; if (m) { if (Array.isArray(m)) m.forEach(x => x.needsUpdate = true); else m.needsUpdate = true; } });
    }
    sky.setCloudShadows(g.cloudShadows);
    effects.setWeatherEnabled(g.weatherParticles ?? true);
    post.set({ bloom: g.bloom ?? ctx.quality !== 'low' });
    // No blur toward the screen's edges, no dark corners and no roll-off: the painted picture is sharp and plain.
    if (painted) post.set({ tiltShift: false, vignette: false, toneMapping: false });
    world.setViewDistance((g.viewDistance ?? 1) * perf.stress * (cam?.load ?? 1));
  }
  const view: GameView = {
    kernel, game, ctx, renderer, scene, canvas, root,
    world, camera, sprites, sky, water, effects, post, perf,
    assets: art.assets,
    get audio() { return sound.audio; },
    onAudio: (fn) => sound.onStart(fn),
    keys,

    onFrame: (fn) => listen(frameListeners, fn),
    onSimStep: (fn) => listen(stepListeners, fn),

    project(x, y, z, out) {
      projected.set(x, y, z).project(lens);
      if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) return null;
      const point: ScreenPoint = out ?? { x: 0, y: 0 };
      point.x = ((projected.x + 1) / 2) * size.width;
      point.y = ((1 - projected.y) / 2) * size.height;
      return point;
    },
    playerPosition: player.position,
    get aim() { return aimed ? hit : null; },

    stats() {
      let pages = 0;
      for (const page of sys.almanac?.pages() ?? []) if (page.complete) pages++;
      return { days: game.clock.day, wheat, blocks, pages };
    },

    settings: {
      get graphics() { return settings.graphics; },
      setGraphics(next) { settings.graphics = readGraphics({ ...settings.graphics, ...next }); applyGraphics(); store(); },
      get quality() { return mode; },
      setQuality,
      volume: (bus) => sound.volume(bus),
      setVolume(bus, value) {
        sound.setVolume(bus, value);
        store();
      },
      get camera() { return cameraMode; },
      setCamera(next) {
        settings.camera = next;
        store();
        if (next === cameraMode) return;
        cameraMode = next;
        applyCamera(next);
        for (const fn of [...changeListeners]) fn('camera');
      },
      get mouse() { return mouseStyle; },
      setMouse(next) {
        settings.mouse = next;
        store();
        if (next === mouseStyle) return;
        mouseStyle = next;
        keys.setMouse(mouseOf(cameraMode));
        for (const fn of [...changeListeners]) fn('mouse');
      },
      get tiltTurn() { return tiltTurn; },
      setTiltTurn(next) {
        settings.tiltTurn = next;
        store();
        if (next === tiltTurn) return;
        tiltTurn = next;
        if (next === 'quarter') camera.settle();
        for (const fn of [...changeListeners]) fn('tiltTurn');
      },
      get characters() { return characterLook; },
      setCharacters(next) {
        settings.characters = next;
        store();
        if (next === characterLook) return;
        characterLook = next;
        for (const fn of [...changeListeners]) fn('characters');
      },
      onChange: (fn) => {
        changeListeners.push(fn);
        return () => {
          const at = changeListeners.indexOf(fn);
          if (at >= 0) changeListeners.splice(at, 1);
        };
      },
    },

    get started() { return started; },
    holdStart() { held = true; },
    hasSave,
    continueGame,
    newGame,
    save,
    setPaused(reason, paused) {
      if (paused) pauses.add(reason);
      else pauses.delete(reason);
      if (paused) keys.release();
    },
    get paused() { return pauses.size > 0; },

    painted,
    look,
    groundAt: (x, z) => groundAt(x, z),
    lift,
    setGround(heightAt) { groundAt = heightAt; },
    standIns: new Map(),

    claim(reason, kinds) {
      if (kinds) claims.set(reason, kinds);
      else claims.delete(reason);
    },
    claimed,
  };

  applyGraphics();

  // The camera looks at the start from the first frame, behind a title or not. The worker loads the land there.
  place(start.x, start.y, start.z, Math.PI, false);
  applyCamera(cameraMode);

  return {
    view,
    systems,
    player,
    errors,
    run() {
      requestAnimationFrame(frame);
    },
    advance,
    place: (x, y, z, facing) => place(x, y, z, facing),
    frames(count) {
      const target = frameCount + count;
      return until(() => frameCount >= target);
    },
    async settled() {
      await until(() => quiet >= 3);
    },
    get holdsStart() { return held; },
  };
}
