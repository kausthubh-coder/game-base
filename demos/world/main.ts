// The world demo: walk, turn and zoom the camera, break and place blocks, change the time of day,
// save and load. It wires four features together the way src/main.ts will: world, camera, hero, perf.
import * as THREE from 'three';
import { BLOCKS, blockId } from '../../src/content/blocks.ts';
import { createBus, type GameEvent } from '../../src/engine/events.ts';
import type { ViewContext } from '../../src/engine/system.ts';
import { calmNoon, type Quality } from '../../src/engine/types.ts';
import { flatWorld } from '../../src/engine/world-query.ts';
import { createCamera } from '../../src/features/camera/index.ts';
import { createHero } from '../../src/features/hero/index.ts';
import { createPerf } from '../../src/features/perf/index.ts';
import {
  HEIGHT, LANDMARKS, createWorld, drawBlockAtlas, emptyHit, loadBlockAtlas, spawnPoint,
  type AtlasSource, type BlockAtlasEntry, type WorldSave,
} from '../../src/features/world/index.ts';
import { createDemoSky } from './sky.ts';

const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

// The painted atlas, when the asset manifest has one. The glob is empty until the file exists, so
// the page never asks the server for a file that is not there.
const manifests = import.meta.glob<{ blocks?: BlockAtlasEntry }>('../../public/assets/manifest.json', { eager: true, import: 'default' });
async function blockAtlas(): Promise<AtlasSource | undefined> {
  if (params.get('atlas') === 'test') {
    // Proves the manifest path without a painted atlas: the drawn tiles, tinted, loaded as an image.
    const drawn = drawBlockAtlas();
    const g = drawn.canvas.getContext('2d')!;
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = '#ffb0d0';
    g.fillRect(0, 0, drawn.canvas.width, drawn.canvas.height);
    return loadBlockAtlas({ tile: drawn.tile, atlas: drawn.canvas.toDataURL(), tiles: Object.fromEntries(drawn.cells) }, '');
  }
  // `?atlas=drawn` keeps the tiles drawn in code, to compare the two.
  const blocks = params.get('atlas') === 'drawn' ? undefined : Object.values(manifests)[0]?.blocks;
  return blocks ? loadBlockAtlas(blocks, new URL('assets/', document.baseURI).href) : undefined;
}

const canvas = $<HTMLCanvasElement>('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: params.get('aa') !== '0', powerPreference: 'high-performance' });
// A laptop at 150% scaling would draw 2.25 times the pixels of 1080p for little gain in a pixel-art world.
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene();
const lens = new THREE.PerspectiveCamera(20, innerWidth / innerHeight, 1, 400);

const startQuality = (['low', 'medium', 'high'] as const).find((q) => q === params.get('quality'));
const ctx: ViewContext = { scene, camera: lens, renderer, ambient: calmNoon(), world: flatWorld, quality: startQuality ?? 'high', time: 0 };
const bus = createBus<GameEvent>();

const sky = createDemoSky(scene, renderer);
const perf = createPerf(ctx, {
  auto: !startQuality && params.get('auto') !== '0',
  onQuality: (quality: Quality) => {
    world.setQuality?.(quality);
    sky.setQuality(quality);
  },
});
const world = createWorld(ctx, { seed: Number(params.get('seed')) || 1, atlas: await blockAtlas(), viewScale: perf.stress });
ctx.world = world.query;
sky.setQuality(ctx.quality);
const camera = createCamera(ctx, { blocks: world.sim, rig: { zoom: Number(params.get('zoom') ?? 1) } });
const hero = createHero(ctx, { blocks: world.sim, spawn: spawnPoint(), bus });

// Time of day and wet ground.
const timeInput = $<HTMLInputElement>('time'), wetInput = $<HTMLInputElement>('wet');
function setTime(t: number): void {
  ctx.ambient.timeOfDay = t;
  timeInput.value = String(t);
  const minutes = Math.round(t * 24 * 60) % (24 * 60);
  $('timeOut').textContent = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
function setWet(w: number): void {
  ctx.ambient.wetness = w;
  wetInput.value = String(w);
  $('wetOut').textContent = `${Math.round(w * 100)}%`;
}
timeInput.addEventListener('input', () => setTime(Number(timeInput.value)));
wetInput.addEventListener('input', () => setWet(Number(wetInput.value)));
setTime(Number(params.get('time') ?? 0.5));
setWet(Number(params.get('wet') ?? 0));

// The hotbar: ten blocks on the number keys.
const hotbar = ['grass', 'dirt', 'stone', 'cobble', 'stone_brick', 'oak_plank', 'oak_log', 'glass', 'lamp', 'lume_crystal'].map(blockId);
const slots: HTMLButtonElement[] = [];
let picked = 0;
function pickSlot(i: number): void {
  picked = i;
  slots.forEach((slot, n) => slot.setAttribute('aria-pressed', String(n === i)));
  $('picked').textContent = BLOCKS[hotbar[i]].name;
}
hotbar.forEach((id, i) => {
  const slot = document.createElement('button');
  slot.type = 'button';
  slot.title = BLOCKS[id].name;
  const swatch = document.createElement('canvas');
  swatch.width = swatch.height = world.atlas.tile;
  const cell = world.atlas.cells.get(BLOCKS[id].tiles.side)?.[0];
  if (cell) swatch.getContext('2d')!.drawImage(world.atlas.canvas, cell[0] * world.atlas.tile, cell[1] * world.atlas.tile, world.atlas.tile, world.atlas.tile, 0, 0, world.atlas.tile, world.atlas.tile);
  const label = document.createElement('span');
  label.textContent = String((i + 1) % 10);
  slot.append(swatch, label);
  slot.addEventListener('click', () => pickSlot(i));
  $('slots').append(slot);
  slots.push(slot);
});
pickSlot(0);
window.addEventListener('keydown', (e) => {
  const digit = /^Digit(\d)$/.exec(e.code);
  if (digit && !e.ctrlKey && !e.metaKey) pickSlot((Number(digit[1]) + 9) % 10);
});

// Events from the rules, shown so the demo proves they fire.
const counts = { footstep: 0, jump: 0, land: 0, blockPlaced: 0, blockBroken: 0 };
let lastEvent = '';
bus.on((e) => {
  if (e.type in counts) counts[e.type as keyof typeof counts]++;
  lastEvent = 'surface' in e ? `${e.type} on ${e.surface}` : e.type;
});

// Breaking and placing. The ray skips blocks the cutaway hides, so you can click into a house.
const REACH = 7;
const pointer = new THREE.Vector2(2, 2);
const origin = new THREE.Vector3(), aim = new THREE.Vector3();
const hit = emptyHit();
let aimed = false;
const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }),
);
outline.renderOrder = 10;
outline.visible = false;
scene.add(outline);

function takeAim(): void {
  aimed = false;
  if (pointer.x <= 1) {
    origin.copy(lens.position);
    aim.set(pointer.x, pointer.y, 0.5).unproject(lens).sub(origin);
    if (world.sim.raycast(origin.x, origin.y, origin.z, aim.x, aim.y, aim.z, 500, hit, camera.hides)) {
      const p = hero.position;
      aimed = Math.hypot(hit.x + 0.5 - p.x, hit.y + 0.5 - p.y - 1, hit.z + 0.5 - p.z) <= REACH;
    }
  }
  outline.visible = aimed;
  if (aimed) outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
}

function breakBlock(): void {
  if (!aimed) return;
  const surface = BLOCKS[hit.id].surface;
  if (world.setBlock(hit.x, hit.y, hit.z, 0)) bus.emit({ type: 'blockBroken', surface, at: { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 } });
}

function placeBlock(): void {
  if (!aimed) return;
  const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
  if (y < 0 || y >= HEIGHT || BLOCKS[world.sim.getBlock(x, y, z)].solid) return;
  // Not inside the hero.
  const b = hero.body, t = b.tuning;
  if (x + 1 > b.x - t.half && x < b.x + t.half && z + 1 > b.z - t.half && z < b.z + t.half && y + 1 > b.y && y < b.y + t.tall) return;
  const id = hotbar[picked];
  if (world.setBlock(x, y, z, id)) bus.emit({ type: 'blockPlaced', surface: BLOCKS[id].surface, at: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } });
}

canvas.addEventListener('pointermove', (e) => pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
canvas.addEventListener('pointerleave', () => pointer.set(2, 2));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  takeAim();
  if (e.button === 0) breakBlock();
  else if (e.button === 2) placeBlock();
});

// Save and load. A save is the seed, the changed blocks, the hero's place and the hour.
const SAVE_KEY = 'game-base:world-demo';
interface DemoSave { world: WorldSave; hero: { x: number; y: number; z: number }; time: number }
const note = (text: string): void => { $('note').textContent = text; };

function moveHero(x: number, y: number, z: number): void {
  hero.teleport(x, y, z);
  camera.follow(x, y, z);
  camera.snap();
  world.setFocus(x, z);
}

function saveGame(): DemoSave {
  const save: DemoSave = { world: world.save(), hero: { x: hero.body.x, y: hero.body.y, z: hero.body.z }, time: ctx.ambient.timeOfDay };
  const changed = save.world.edits.reduce((n, e) => n + e[2].length / 2, 0);
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    note(`Saved: seed ${save.world.seed}, ${changed} changed blocks.`);
  } catch {
    note('This browser would not store the save.');
  }
  return save;
}

function loadGame(save?: DemoSave): boolean {
  const text = save ? null : localStorage.getItem(SAVE_KEY);
  const data = save ?? (text ? (JSON.parse(text) as DemoSave) : null);
  if (!data) { note('Nothing saved yet.'); return false; }
  world.load(data.world);
  moveHero(data.hero.x, data.hero.y, data.hero.z);
  setTime(data.time);
  note(`Loaded: seed ${data.world.seed}.`);
  return true;
}

$('save').addEventListener('click', () => saveGame());
$('load').addEventListener('click', () => loadGame());
$('reset').addEventListener('click', () => {
  const seed = Math.floor(Math.random() * 1e6);
  world.load({ version: 1, seed, edits: [] });
  const s = spawnPoint();
  moveHero(s.x, s.y, s.z);
  note(`New land from seed ${seed}.`);
});

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  lens.aspect = innerWidth / innerHeight;
});

const start = params.get('at') as keyof typeof LANDMARKS | null;
const from = start && LANDMARKS[start] ? LANDMARKS[start] : spawnPoint();
moveHero(from.x, from.y, from.z);
for (let i = Number(params.get('turn') ?? 0); i > 0; i--) camera.turn(1);

// The frame.
let last = performance.now(), frames = 0, quiet = 0, loaded = false;
let auto: { stuck: number; lifts: number; lastX: number; lastZ: number } | null = null;
const waiters: { until: () => boolean; done: () => void }[] = [];

function frame(now: number): void {
  perf.begin('frame');
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  ctx.time += dt;

  if (auto) autoWalk(dt);
  perf.begin('sim');
  hero.update(dt, ctx);
  perf.end('sim');

  const p = hero.position;
  camera.follow(p.x, p.y, p.z);
  camera.update(Math.min(dt, 0.1), ctx);
  world.setFocus(p.x, p.z);
  world.setCutaway(camera.cutaway);
  world.update(dt, ctx);
  sky.update(ctx.ambient.timeOfDay, ctx.ambient.fog, p, lens.position.distanceTo(p as THREE.Vector3Like));
  takeAim();

  renderer.render(scene, lens);

  perf.counters.chunks = world.stats.chunks;
  perf.counters.meshQueue = world.stats.queue;
  perf.counters.meshMs = world.stats.meshMs;
  perf.update(dt, ctx);
  perf.end('frame');

  frames++;
  quiet = world.stats.queue === 0 ? quiet + 1 : 0;
  if (!loaded && quiet > 1) { loaded = true; $('loading').classList.add('done'); }
  if (frames % 15 === 0) {
    $('events').textContent = `steps ${counts.footstep} · jumps ${counts.jump} · lands ${counts.land}\nplaced ${counts.blockPlaced} · broken ${counts.blockBroken}\n${lastEvent}`;
  }
  for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].until()) waiters.splice(i, 1)[0].done();
  requestAnimationFrame(frame);
}
$('events').style.whiteSpace = 'pre';
requestAnimationFrame(frame);

// Scripted walking for the long test: hold forward, jump at a step, and climb over what a jump cannot clear.
function autoWalk(dt: number): void {
  const a = auto!, b = hero.body;
  const moved = Math.hypot(b.x - a.lastX, b.z - a.lastZ);
  a.lastX = b.x; a.lastZ = b.z;
  a.stuck = moved < 0.5 * dt ? a.stuck + dt : 0;
  if (a.stuck > 1.2) {
    lens.getWorldDirection(aim);
    const flat = Math.hypot(aim.x, aim.z) || 1;
    const x = b.x + (aim.x / flat) * 1.2, z = b.z + (aim.z / flat) * 1.2;
    hero.teleport(x, Math.max(world.query.heightAt(x, z), b.y) + 0.05, z);
    a.stuck = 0;
    a.lifts++;
  }
  hero.control({ right: 0, forward: 1, jump: a.stuck > 0.1 || b.swimming });
}

// Hooks for the scripts in tools/world-*.mjs, and for poking at the demo from the console.
const until = (test: () => boolean): Promise<void> => new Promise((done) => waiters.push({ until: test, done }));
const demo = {
  world, hero, camera, perf, ctx, renderer, LANDMARKS,
  setTime, setWet, pickSlot, saveGame, loadGame, moveHero,
  /** Resolves after `n` more frames. */
  frames(n: number): Promise<void> {
    const target = frames + n;
    return until(() => frames >= target);
  },
  /** Resolves when every chunk in view has an up-to-date mesh and the camera has stopped turning. */
  async settle(): Promise<void> {
    await until(() => quiet >= 3);
    await demo.frames(2);
  },
  async goto(place: keyof typeof LANDMARKS | 'spawn'): Promise<void> {
    const to = place === 'spawn' ? spawnPoint() : LANDMARKS[place];
    moveHero(to.x, to.y, to.z);
    await demo.frames(2);
    await demo.settle();
  },
  numbers() {
    return {
      ...perf.snapshot,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      chunks: world.stats.chunks, meshes: world.stats.meshes, drawn: world.stats.drawn, queue: world.stats.queue, radius: world.stats.radius,
      worstMeshMs: world.stats.worstMeshMs, hero: { x: hero.body.x, y: hero.body.y, z: hero.body.z }, cutaway: { ...camera.cutaway },
    };
  },
  /** Where a point of the world is on the page, in CSS pixels. */
  screenOf(x: number, y: number, z: number): { x: number; y: number } {
    aim.set(x, y, z).project(lens);
    return { x: ((aim.x + 1) / 2) * innerWidth, y: ((1 - aim.y) / 2) * innerHeight };
  },
  /** Starts or stops the scripted walk. It returns how often it had to lift the hero over something. */
  walk(on: boolean): number {
    const lifts = auto?.lifts ?? 0;
    auto = on ? { stuck: 0, lifts: 0, lastX: hero.body.x, lastZ: hero.body.z } : null;
    if (!on) hero.control(null);
    return lifts;
  },
};
(window as unknown as { demo: typeof demo }).demo = demo;
