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
import type { BusName } from '../../features/audio/index.ts';
import { cameraProfile, createCamera } from '../../features/camera/index.ts';
import { createEffects } from '../../features/effects/index.ts';
import { createPerf } from '../../features/perf/index.ts';
import { createPost } from '../../features/post/index.ts';
import { createSky } from '../../features/sky/index.ts';
import { createWaterMaterial } from '../../features/water/index.ts';
import { createWorld, emptyHit, spawnPoint } from '../../features/world/index.ts';
import type { Systems, UseContext } from '../api.sim.ts';
import { STEP, createKernel } from '../kernel.sim.ts';
import { installSystems, type Installed } from '../systems.ts';
import { loadArt, makeSprites } from './art.ts';
import { createKeys, type Press } from './keys.ts';
import { HERO_STEP, createPlayer, type PlayerRig } from './player.ts';
import { clearSave, hasSave, readSave, reloadInto, writeSave } from './save.ts';
import { BUSES, DEFAULT_VOLUMES, createSound } from './sound.ts';
import type { GameView, QualityMode, ScreenPoint } from './view.ts';
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
}

function readSettings(): StoredSettings {
  const settings: StoredSettings = { graphics: readGraphics(null), quality: 'auto', volumes: { ...DEFAULT_VOLUMES } };
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<StoredSettings> | null;
    if (stored?.quality === 'auto' || LEVELS.includes(stored?.quality as Quality)) settings.quality = stored!.quality as QualityMode;
    settings.graphics = readGraphics(stored?.graphics);
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
  const world = createWorld(ctx, { seed: Number(params.get('seed')) || 1, atlas: art.blockAtlas, viewScale: perf.stress * (cam?.load ?? 1), ground });
  ctx.world = world.query;
  const kernel = createKernel(world.sim, Number(params.get('seed')) || 7);
  const game = kernel.game;
  // One Ambient for the rules and the picture: the time system writes it, every feature reads it.
  ctx.ambient = game.ambient;
  const systems = installSystems(kernel);
  const sys = game.systems as Partial<Systems>;

  // A closer step than the base's three, and the game opens on it, so a face and the pet read at a glance.
  const camera = createCamera(ctx, { blocks: world.sim, input: false, rig: cam?.rig ?? { distances: CAMERA_DISTANCES, zoom: 0 }, fov: cam?.fov });
  const sky = createSky(ctx, { shadowRange: 40 });
  const water = createWaterMaterial(ctx);
  const effects = createEffects(ctx);
  const post = createPost(ctx);
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
  const start = sys.region?.spawn() ?? spawnPoint();
  const player = createPlayer(game, world.sim, keys, start);

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
    const pointer = keys.pointer;
    if (!pointer.over) return;
    origin.copy(lens.position);
    ray.set(pointer.x, pointer.y, 0.5).unproject(lens).sub(origin);
    // The ray skips what the cutaway hides, so a click goes through a hidden roof to the floor.
    if (!world.sim.raycast(origin.x, origin.y, origin.z, ray.x, ray.y, ray.z, 500, hit, camera.hides)) return;
    const p = game.player.pos, eye = p.y + EYE_HEIGHT;
    const dx = Math.max(hit.x - p.x, 0, p.x - hit.x - 1), dy = Math.max(hit.y - eye, 0, eye - hit.y - 1), dz = Math.max(hit.z - p.z, 0, p.z - hit.z - 1);
    aimed = Math.hypot(dx, dy, dz) <= (sys.actions?.reach ?? 5);
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

  // ---------------------------------------------------------------- one step of the rules
  function simStep(): void {
    if (keys.primary && !game.player.busy) sys.actions?.hold(useContext('primary'), STEP);
    kernel.step();
    call(stepListeners, STEP, 'step');
    sinceSave += STEP;
    if (saveDue || sinceSave >= SAVE_EVERY) save();
  }

  let carry = 0, bodySteps = 0;
  function bodyStep(): void {
    player.step(camera.yaw);
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
    if (press.kind === 'perf') { perfHolder.hidden = !perfHolder.hidden; return; }
    if (press.kind === 'turn') { camera.turn(press.direction); return; }
    if (press.kind === 'zoom') { camera.zoomBy(press.steps); return; }
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

  let last = performance.now(), frameCount = 0, quiet = 0, lastZoom = -1, lastRange = -1;
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

    const p = player.position;
    camera.follow(p.x, p.y, p.z);
    if (settings.graphics.reduceMotion) camera.snap();
    camera.update(settings.graphics.reduceMotion ? 1 : Math.min(dt, 0.1), ctx);
    world.setFocus(p.x, p.z);
    world.setCutaway(camera.cutaway);
    world.update(dt, ctx);
    dress?.();

    // Everything follows the hero. The sky gets what Ambient does not carry: the moon, a rainbow after rain.
    const a = game.ambient;
    if (cam) {
      const range = settings.graphics.shadowDistance ?? Math.round(camera.stepped(cam.shadowRange));
      if (range !== lastRange) sky.setShadowRange((lastRange = range));
      // The fog is whole before the loaded land ends, which is nearer at a lower quality.
      const edge = world.stats.radius * 16 - 8;
      sky.setFogReach(Math.min(camera.stepped(cam.fogStart), edge * 0.45), Math.min(camera.stepped(cam.fogEnd), edge));
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
    sprites.setShadowsEnabled(g.shadows !== 'off');
    const type = g.shadows === 'sharp' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    if (renderer.shadowMap.type !== type) {
      renderer.shadowMap.type = type;
      scene.traverse((object) => { const m = (object as THREE.Mesh).material; if (m) { if (Array.isArray(m)) m.forEach(x => x.needsUpdate = true); else m.needsUpdate = true; } });
    }
    sky.setCloudShadows(g.cloudShadows);
    effects.setWeatherEnabled(g.weatherParticles ?? true);
    post.set({ bloom: g.bloom ?? ctx.quality !== 'low' });
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
  };

  applyGraphics();

  // The camera looks at the start from the first frame, behind a title or not. The worker loads the land there.
  place(start.x, start.y, start.z, Math.PI, false);

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
