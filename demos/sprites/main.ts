// The sprites demo: a crowd from the real manifest wandering on flat ground, drawn by the sprite
// system the way src/main.ts will use it. Q and E turn the camera a quarter turn, the wheel zooms.
//
// `window.__sprites` lets a script set a state, step time and read the counts
// (tools/sprites-runtime-shots.mjs and tools/sprites-runtime-check.mjs use it). The address bar takes:
//   ?count=500 &time=0.9 &quarter=2 &zoom=4 &solo=away &who=pet &paused=1 &panel=0 &seed=3
//   ?cast=hero,ghost     the sprites to draw. A name the manifest lacks shows the placeholder.
//   ?filter=nearest      no mipmaps on the sprite atlas
//   ?atlas=1024          a smaller atlas page, so the sheets spill onto more pages
//   ?tone=0              no tone mapping
import * as THREE from 'three';
import type { ViewContext } from '../../src/engine/system.ts';
import { calmNoon } from '../../src/engine/types.ts';
import { loadAssets, type Assets } from '../../src/features/assets/index.ts';
import { createSprites, dayLight, seededRandom, type SpriteHandle, type Sprites } from '../../src/features/sprites/index.ts';
import { DISTANCES, createDemoCamera } from './camera.ts';
import { buildCast } from './cast.ts';
import { createCrowd, type Crowd } from './crowd.ts';
import { createDemoScene, demoWorld, type DemoScene } from './scene.ts';

type SoloMode = '' | 'away' | 'toward' | 'across' | 'tool';

/** Everything a script or the address bar can set. */
export interface DemoState {
  count?: number;
  /** Time of day, 0 to 1. 0.5 is noon. */
  time?: number;
  /** Quarter turns of the camera, 0 to 3. It jumps there with no glide. */
  quarter?: number;
  /** The zoom step, 0 is nearest. */
  zoom?: number;
  paused?: boolean;
  /** One hero seen close, walking away from, toward or across the camera. An empty string brings the crowd back. */
  solo?: SoloMode;
  /** The sprite that walks alone. Default `hero`. */
  who?: string;
  panel?: boolean;
}

interface Counters {
  characters: number;
  /** Draw calls and triangles of the whole frame. */
  calls: number;
  triangles: number;
  /** Draw calls and triangles of the sprites and their shadows alone. */
  spriteCalls: number;
  spriteTriangles: number;
  geometries: number;
  textures: number;
  capacity: number;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || 1;

const canvas = $<HTMLCanvasElement>('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shots') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// The game tone-maps in its last pass. With no last pass here, each material does it.
renderer.toneMapping = params.get('tone') === '0' ? THREE.NoToneMapping : THREE.NeutralToneMapping;
const scene = new THREE.Scene();
const background = new THREE.Color(0x10141a);
scene.background = background;
const view = createDemoCamera();
const ambient = calmNoon();
ambient.cloud = 0;
const ctx: ViewContext = { scene, camera: view.camera, renderer, ambient, world: demoWorld, quality: 'high', time: 0 };

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  view.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- loading

const notice = $('notice');
let assets: Assets;
try {
  const bar = $<HTMLProgressElement>('bar'), text = $('loading-text');
  assets = await loadAssets({
    maxAtlasSize: Math.min(Number(params.get('atlas')) || 4096, renderer.capabilities.maxTextureSize),
    spriteFilter: params.get('filter') === 'nearest' ? 'nearest' : 'smooth',
    onProgress: ({ loaded, total, file }) => {
      bar.value = loaded / total;
      text.textContent = `Loaded ${loaded} of ${total}: ${file}`;
    },
  });
} catch (error) {
  $('loading').classList.add('done');
  notice.textContent = `The assets did not load. ${error instanceof Error ? error.message : String(error)}`;
  throw error;
}
$('loading').classList.add('done');

const cast = buildCast(assets, params.get('cast')?.split(',').filter(Boolean));
const ground: DemoScene = createDemoScene(assets);
scene.add(ground.mesh);
const sprites: Sprites = createSprites(ctx, { assets, seed, alphaCut: params.has('cut') ? Number(params.get('cut')) : undefined });
const crowd: Crowd = createCrowd(sprites, cast, seededRandom(seed));

// ---------------------------------------------------------------- one hero, close

const HERO_SPEED = 2.4;
let solo: SoloMode = '';
let soloHero: SpriteHandle | null = null;
let soloName = 'hero';
let zoomBefore = view.zoom;
// Where the lone walker starts: clear of the lamps and the hollow whichever way it goes.
const SOLO_START = { x: -12.5, z: 12.5 };
const soloAt = { ...SOLO_START };

function setSolo(mode: SoloMode, who = soloName): void {
  if (mode === solo && who === soloName) return;
  if (solo === '') zoomBefore = view.zoom;
  if (who !== soloName) {
    soloHero?.remove();
    soloHero = null;
    soloName = who;
  }
  solo = mode;
  crowd.setVisible(mode === '');
  if (mode === '') {
    soloHero?.remove();
    soloHero = null;
    view.focus.set(0, 0, 0);
    view.setZoom(zoomBefore);
    return;
  }
  soloHero ??= sprites.add(soloName);
  soloAt.x = SOLO_START.x;
  soloAt.z = SOLO_START.z;
  view.setZoom(0);
  // Not every sprite has a walk or a tool swing. One that does not keeps its own animation.
  const wanted = mode === 'tool' ? 'tool' : 'walk';
  if (soloHero.has(wanted)) soloHero.play(wanted, { restart: true });
}

function stepSolo(dt: number): void {
  if (!soloHero) return;
  // Relative to the camera, so the hero keeps walking away, toward or across whichever way the view is turned.
  const heading = solo === 'away' ? -view.yaw : solo === 'across' ? Math.PI / 2 - view.yaw : Math.PI - view.yaw;
  if (solo !== 'tool') {
    soloAt.x += Math.sin(heading) * HERO_SPEED * dt;
    soloAt.z -= Math.cos(heading) * HERO_SPEED * dt;
    // Back to the start before the edge of the ground.
    if (Math.max(Math.abs(soloAt.x), Math.abs(soloAt.z)) > 40) {
      soloAt.x = SOLO_START.x;
      soloAt.z = SOLO_START.z;
    }
  }
  soloHero.setFacing(heading);
  soloHero.setPosition(soloAt.x, 0, soloAt.z);
  view.focus.set(soloAt.x, 0, soloAt.z);
}

// ---------------------------------------------------------------- a frame

let paused = false;
const counters: Counters = { characters: 0, calls: 0, triangles: 0, spriteCalls: 0, spriteTriangles: 0, geometries: 0, textures: 0, capacity: 0 };
const light: [number, number, number] = [1, 1, 1];

function step(dt: number): void {
  ctx.time += dt;
  crowd.update(dt);
  stepSolo(dt);
  view.update(dt);
  sprites.update(dt, ctx);
}

function render(): Counters {
  // The ground and the backdrop take the same daylight as the sprites.
  dayLight(ambient, light);
  ground.sky.r = light[0];
  ground.sky.g = light[1];
  ground.sky.b = light[2];
  background.r = 0.02 + light[0] * 0.2;
  background.g = 0.03 + light[1] * 0.4;
  background.b = 0.06 + light[2] * 0.72;
  renderer.render(scene, view.camera);
  counters.characters = sprites.count;
  counters.calls = renderer.info.render.calls;
  counters.triangles = renderer.info.render.triangles;
  counters.spriteCalls = sprites.stats.drawCalls;
  counters.spriteTriangles = sprites.stats.triangles;
  counters.geometries = renderer.info.memory.geometries;
  counters.textures = renderer.info.memory.textures;
  counters.capacity = sprites.capacity;
  return counters;
}

// ---------------------------------------------------------------- the panel

const timeInput = $<HTMLInputElement>('time'), countInput = $<HTMLInputElement>('count');
const stats = $('stats');
const hours = (t: number): string => {
  const minutes = Math.round(t * 24 * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

function showStats(): void {
  const c = counters;
  const rows: [string, string | number][] = [
    ['Characters', c.characters],
    ['Draw calls, whole frame', c.calls],
    ['Draw calls, sprites and shadows', c.spriteCalls],
    ['Triangles, whole frame', c.triangles.toLocaleString()],
    ['Triangles, sprites and shadows', c.spriteTriangles.toLocaleString()],
    ['Geometries', c.geometries],
    ['Textures', c.textures],
    ['Camera', `turn ${view.quarter}, zoom ${view.zoom + 1} of ${DISTANCES.length}`],
  ];
  stats.innerHTML = rows.map(([name, value]) => `<span>${name}</span><b>${value}</b>`).join('');
  const missing = sprites.missing, lacking = sprites.missingAnimations;
  notice.textContent = (missing.length
    ? `Missing from the manifest: ${missing.join(', ')}. ${missing.length === 1 ? 'A plain placeholder is' : 'Plain placeholders are'} drawn in ${missing.length === 1 ? 'its' : 'their'} place. `
    : '') + (lacking.length ? `Animations asked for that a sprite does not have: ${lacking.join(', ')}.` : '');
}

function showControls(): void {
  timeInput.value = String(ambient.timeOfDay);
  $('time-out').textContent = hours(ambient.timeOfDay);
  countInput.value = String(crowd.count);
  $('count-out').textContent = String(crowd.count);
  $('pause').textContent = paused ? 'Play' : 'Pause';
  $('pause').classList.toggle('on', paused);
  for (const button of document.querySelectorAll<HTMLButtonElement>('#solo button')) button.classList.toggle('on', button.dataset.solo === solo);
}

function apply(state: DemoState): void {
  if (state.count !== undefined) crowd.setCount(Math.max(0, Math.min(1000, Math.round(state.count))));
  if (state.time !== undefined) ambient.timeOfDay = ((state.time % 1) + 1) % 1;
  if (state.solo !== undefined || state.who !== undefined) setSolo(state.solo ?? solo, state.who);
  if (state.zoom !== undefined) view.setZoom(state.zoom);
  if (state.quarter !== undefined) view.setQuarter(((Math.round(state.quarter) % 4) + 4) % 4);
  if (state.paused !== undefined) paused = state.paused;
  if (state.panel !== undefined) $('panel').classList.toggle('hidden', !state.panel);
  showControls();
}

timeInput.addEventListener('input', () => apply({ time: Number(timeInput.value) }));
countInput.addEventListener('input', () => apply({ count: Number(countInput.value) }));
$('turn-left').addEventListener('click', () => view.turn(-1));
$('turn-right').addEventListener('click', () => view.turn(1));
$('zoom-in').addEventListener('click', () => view.setZoom(view.zoom - 1));
$('zoom-out').addEventListener('click', () => view.setZoom(view.zoom + 1));
$('pause').addEventListener('click', () => apply({ paused: !paused }));
for (const button of document.querySelectorAll<HTMLButtonElement>('#solo button')) {
  button.addEventListener('click', () => apply({ solo: (button.dataset.solo ?? '') as SoloMode }));
}
window.addEventListener('keydown', (e) => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'KeyQ') view.turn(-1);
  else if (e.code === 'KeyE') view.turn(1);
  else if (e.code === 'Equal' || e.code === 'NumpadAdd') view.setZoom(view.zoom - 1);
  else if (e.code === 'Minus' || e.code === 'NumpadSubtract') view.setZoom(view.zoom + 1);
  else if (e.code === 'KeyP') apply({ paused: !paused });
});
// A mouse wheel sends one big step and a trackpad many small ones. Either way one gesture is one zoom step.
let wheel = 0, lastZoom = 0;
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  wheel += e.deltaY;
  if (Math.abs(wheel) < 40 || e.timeStamp - lastZoom < 220) return;
  view.setZoom(view.zoom + Math.sign(wheel));
  wheel = 0;
  lastZoom = e.timeStamp;
}, { passive: false });

// The loader's icons, cut from the sheet with CSS.
$('icons').innerHTML = assets.iconNames().map((name) => {
  const icon = assets.icon(name);
  return `<i title="${name}" style="background: url('${icon.url}') -${icon.x}px -${icon.y}px"></i>`;
}).join('');
const atlas = assets.spriteAtlas();
$('atlas-note').textContent = `${assets.spriteNames().length} sprite sheets (${assets.spriteNames().length - Object.keys(assets.manifest.sprites).length} are color variants) on one atlas of ${atlas.width} by ${atlas.height}, ${atlas.pages} page${atlas.pages === 1 ? '' : 's'}. `
  + `Sheets of tiles in the manifest: ${assets.sheetNames().map((name) => `${name} (${assets.sheet(name).names.length})`).join(', ')}.`;

// ---------------------------------------------------------------- checks a script can run

/** Adds and removes `count` characters `rounds` times and reports what the GPU holds after each round. */
function churn(count: number, rounds: number): { round: number; geometries: number; textures: number; capacity: number; atPeak: number }[] {
  const names = assets.spriteNames();
  const report = [];
  render();
  report.push({ round: 0, geometries: counters.geometries, textures: counters.textures, capacity: counters.capacity, atPeak: counters.characters });
  for (let round = 1; round <= rounds; round++) {
    const handles = Array.from({ length: count }, (_, i) => sprites.add(names[i % names.length], { x: (i % 40) - 20, z: Math.floor(i / 40) - 12 }));
    step(1 / 60);
    const atPeak = render().characters;
    for (const handle of handles) handle.remove();
    step(1 / 60);
    render();
    report.push({ round, geometries: counters.geometries, textures: counters.textures, capacity: counters.capacity, atPeak });
  }
  return report;
}

interface DrawnCase {
  sprite: string;
  animation: string;
  view: string;
  cameraYaw: number;
  frame: number;
  /** Pixels that are solid where the sheet is clear, or clear where it is solid. */
  wrongShape: number;
  /** The largest difference of any color channel, 0 to 255. */
  worstColor: number;
}

/**
 * Draws every frame of every animation of every sprite, from every side, at one screen pixel per
 * sprite pixel, and compares what the GPU drew with the sheet. This checks the vertex shader's part:
 * the frame for the time, the row, the mirror, the anchor and the hard alpha cut.
 */
function selfTest(): { cases: number; failed: DrawnCase[]; worstColor: number } {
  const before = { tone: renderer.toneMapping, paused, camera: ctx.camera, time: ctx.time, clear: renderer.getClearAlpha() };
  ground.mesh.visible = false;
  crowd.setVisible(false);
  soloHero?.setVisible(false);
  scene.background = null;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearAlpha(0);
  // Full white light, and a tint that cancels the little light that is always there, so colors pass through unchanged.
  sprites.setSky({ light: new THREE.Color(1, 1, 1) });
  const undo = 1 / 1.06;
  const FAR = 40.5;

  const failed: DrawnCase[] = [];
  let cases = 0, worstColor = 0;
  const views = ['front', 'back', 'side', 'side mirrored'] as const;
  for (const name of assets.spriteNames()) {
    const asset = assets.sprite(name);
    const [fw, fh] = asset.frame, [ax, ay] = asset.anchor;
    const scale = asset.worldHeight / fh;
    const target = new THREE.WebGLRenderTarget(fw, fh);
    target.texture.colorSpace = THREE.SRGBColorSpace;
    const drawn = new Uint8Array(fw * fh * 4);
    // A camera level with the feet whose view is exactly the frame.
    const lens = new THREE.OrthographicCamera(-ax * scale, (fw - ax) * scale, ay * scale, -(fh - ay) * scale, 0.1, 50);
    // Out of reach of the lamps, where the only light is the sky's.
    const handle = sprites.add(name, { x: FAR, z: FAR, shadow: 0, tint: [undo, undo, undo] });
    for (const cameraYaw of [0, Math.PI / 2, Math.PI / 4]) {
      lens.position.set(FAR + Math.sin(cameraYaw) * 10, 0, FAR + Math.cos(cameraYaw) * 10);
      lens.lookAt(FAR, 0, FAR);
      ctx.camera = lens;
      for (const [animation, anim] of Object.entries(asset.animations)) {
        views.forEach((viewName, v) => {
          // The facing that shows this view to this camera.
          handle.setFacing([Math.PI, 0, Math.PI / 2, -Math.PI / 2][v] - cameraYaw);
          const row = v === 0 ? anim.rows.front : v === 1 ? anim.rows.back ?? anim.rows.front : anim.rows.side ?? anim.rows.front;
          const mirrored = v === 3 && anim.rows.side !== undefined;
          handle.play(animation, { restart: true });
          const started = ctx.time;
          for (let frame = 0; frame < anim.frames; frame++) {
            ctx.time = started + (frame + 0.5) / anim.fps;
            sprites.update(0, ctx);
            renderer.setRenderTarget(target);
            renderer.clear();
            renderer.render(scene, lens);
            renderer.readRenderTargetPixels(target, 0, 0, fw, fh, drawn);
            let wrongShape = 0, worst = 0;
            for (let y = 0; y < fh; y++) {
              for (let x = 0; x < fw; x++) {
                const from = mirrored ? 2 * ax - 1 - x : x;
                const s = ((row * fh + y) * asset.pixels.width + frame * fw + from) * 4;
                const solid = from >= 0 && from < fw && asset.pixels.data[s + 3] === 255;
                // The GPU's rows start at the bottom.
                const d = ((fh - 1 - y) * fw + x) * 4;
                if (solid !== (drawn[d + 3] > 0)) wrongShape++;
                else if (solid) for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(drawn[d + c] - asset.pixels.data[s + c]));
              }
            }
            cases++;
            worstColor = Math.max(worstColor, worst);
            if (wrongShape > 0 || worst > 2) failed.push({ sprite: name, animation, view: viewName, cameraYaw, frame, wrongShape, worstColor: worst });
          }
        });
      }
    }
    handle.remove();
    target.dispose();
  }

  renderer.setRenderTarget(null);
  renderer.setClearAlpha(before.clear);
  renderer.toneMapping = before.tone;
  scene.background = background;
  sprites.setSky(null);
  ground.mesh.visible = true;
  crowd.setVisible(solo === '');
  soloHero?.setVisible(true);
  ctx.camera = before.camera;
  ctx.time = before.time;
  sprites.update(0, ctx);
  return { cases, failed, worstColor };
}

const api = {
  apply,
  /** Runs the demo forward in fixed steps, then draws one frame. */
  advance(seconds: number, hz = 30): Counters {
    for (let i = Math.round(seconds * hz); i > 0; i--) step(1 / hz);
    const result = { ...render() };
    showStats();
    return result;
  },
  /**
   * Runs the per-frame work `count` times with no drawing, turning the camera every `turnEvery` steps.
   * With `wander` false the crowd stands still, so only the camera and the sprite system work.
   * A script measures what this allocates.
   */
  steps(count: number, turnEvery = 0, wander = true): void {
    for (let i = 1; i <= count; i++) {
      if (turnEvery && i % turnEvery === 0) view.turn(1);
      if (wander) step(1 / 60);
      else {
        ctx.time += 1 / 60;
        view.update(1 / 60);
        sprites.update(1 / 60, ctx);
      }
    }
  },
  /** The counts of the last frame drawn. */
  counters: (): Counters => ({ ...counters }),
  churn,
  selfTest,
  missing: (): string[] => [...sprites.missing],
  /** The sprites the manifest lists. */
  sprites: (): string[] => Object.keys(assets.manifest.sprites),
  atlas: (): { width: number; height: number; pages: number; sheets: number } => {
    const a = assets.spriteAtlas();
    return { width: a.width, height: a.height, pages: a.pages, sheets: assets.spriteNames().length };
  },
};
(window as unknown as { __sprites: typeof api }).__sprites = api;

// ---------------------------------------------------------------- start

apply({
  count: params.has('count') ? Number(params.get('count')) : 200,
  time: params.has('time') ? Number(params.get('time')) : 0.5,
  quarter: Number(params.get('quarter')) || 0,
  zoom: params.has('zoom') ? Number(params.get('zoom')) : 3,
  solo: (params.get('solo') ?? '') as SoloMode,
  who: params.get('who') ?? 'hero',
  paused: params.get('paused') === '1',
  panel: params.get('panel') !== '0',
});

const frameClock = { last: performance.now(), frames: 0 };
function loop(nowMs: number): void {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (nowMs - frameClock.last) / 1000);
  frameClock.last = nowMs;
  if (paused) return;
  step(dt);
  render();
  if (frameClock.frames++ % 15 === 0) showStats();
}
render();
showStats();
requestAnimationFrame(loop);
