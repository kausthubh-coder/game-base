// The sky demo: a small scene of its own with every sky feature wired the way src/main.ts will wire them.
//
// Sliders write the Ambient numbers by hand. The weather buttons hand them to the weather machine instead.
// `window.__sky` lets a script set a state, step time, and read the counters (tools/sky-shots.mjs uses it).
// `?state={...}` in the address applies a state at the start, `?panel=0` hides the panel.
import * as THREE from 'three';
import { effectBudget, effects as effectTable, type EffectEntry, type EffectId } from '../../src/content/effects.ts';
import { weatherTable, type WeatherKind } from '../../src/content/weather.ts';
import { createBus, type GameEvent } from '../../src/engine/events.ts';
import type { ViewContext } from '../../src/engine/system.ts';
import { calmNoon, type Ambient, type Quality, type Surface, type Vec3 } from '../../src/engine/types.ts';
import { createEffects, type Effects } from '../../src/features/effects/index.ts';
import { createPost, type Post, type PostSettings } from '../../src/features/post/index.ts';
import { createSky, type Sky } from '../../src/features/sky/index.ts';
import { createWaterMaterial, type Water } from '../../src/features/water/index.ts';
import { createWeather, WEATHER_KINDS } from '../../src/features/weather/index.ts';
import { buildPanel, type Panel } from './panel.ts';
import { createDemoScene } from './scene.ts';

export type ViewName = 'game' | 'low' | 'sun' | 'pond' | 'fx';

/** Everything a script or the address bar can set. */
export interface DemoState {
  features?: boolean;
  quality?: Quality;
  time?: number;
  /** Hands the weather to the machine and holds this kind. It is there at once unless `front` is true. */
  weather?: WeatherKind;
  front?: boolean;
  /** Lets the machine pick the weather, at this many times real speed. */
  machine?: number;
  /** Sets Ambient numbers by hand and stops the machine. */
  ambient?: Partial<Ambient>;
  motes?: number;
  rainbow?: number;
  moonPhase?: number;
  view?: ViewName;
  /** Quarter turns of the game view. */
  turn?: number;
  /** Plays this effect over and over. An empty string stops it. */
  fx?: EffectId | '';
  post?: Partial<PostSettings>;
  panel?: boolean;
  paused?: boolean;
}

interface Features {
  sky: Sky;
  water: Water;
  effects: Effects;
  post: Post;
  unsubscribe: () => void;
}

const EFFECT_IDS = Object.keys(effectTable) as EffectId[];
const SURFACES: Surface[] = ['grass', 'tallGrass', 'dirt', 'stone', 'wood', 'sand', 'water', 'snow', 'leaves', 'metal'];
const MOON_NAMES = ['new', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full', 'waning gibbous', 'last quarter', 'waning crescent'];

// ---------------------------------------------------------------- the renderer, the scene and the rules

const canvas = document.querySelector<HTMLCanvasElement>('#view') as HTMLCanvasElement;
const query = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: query.has('shots') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10141a);
const camera = new THREE.PerspectiveCamera(20, 1, 0.5, 1200);
const demo = createDemoScene();
scene.add(demo.group);

const ambient = calmNoon();
const ctx: ViewContext = { scene, camera, renderer, ambient, world: demo.world, quality: 'high', time: 0 };
const bus = createBus<GameEvent>();
const weather = createWeather({ seed: 7, ambient, emit: bus.emit, world: demo.world, startTimeOfDay: 0.5 });

let features: Features | null = null;
let mode: 'manual' | 'machine' = 'manual';
let speed = 1;
let view: ViewName = 'game';
let turn = 0;
let paused = false;
let motes = 0;
let rainbow = 0;
let moonPhase = weather.clock.moonPhase;
// Numbers set by hand win over the machine's until the next weather button.
const byHand: { motes: number | null; rainbow: number | null; moonPhase: number | null } = { motes: null, rainbow: null, moonPhase: null };
let repeatEffect: EffectId | '' = '';
let repeatIn = 0;
let seenStrikes = 0;
let boltSpot: Vec3 | null = null;
let struckAt = -1;
let thunderNote = 'none yet';
const counters = { calls: 0, triangles: 0, geometries: 0, textures: 0, particles: 0 };

function createFeatures(): Features {
  const sky = createSky(ctx, { shadowRange: 40 });
  const water = createWaterMaterial(ctx);
  const effects = createEffects(ctx);
  const post = createPost(ctx);
  // The sky hands its light to the two features that draw unlit things.
  water.setSky(sky.look);
  effects.setSky(sky.look);
  demo.setWaterMaterial(water.material);
  const unsubscribe = bus.on((event) => {
    effects.onEvent(event);
    if (event.type === 'footstep' && event.surface === 'water') water.ripple(event.at);
  });
  return { sky, water, effects, post, unsubscribe };
}

function disposeFeatures(): void {
  if (!features) return;
  features.unsubscribe();
  demo.setWaterMaterial(null);
  features.sky.dispose();
  features.water.dispose();
  features.effects.dispose();
  features.post.dispose();
  features = null;
}

bus.on((event) => {
  if (event.type === 'thunder' && struckAt >= 0) thunderNote = `${(ctx.time - struckAt).toFixed(2)} s after the flash`;
});

// ---------------------------------------------------------------- the camera

const lookAt = new THREE.Vector3();
const NO_SUN = new THREE.Vector3(0.5, 0.5, 0.5).normalize();

function placeCamera(): void {
  const f = demo.focus;
  let fov = 20;
  if (view === 'game') {
    // The game's camera: a long lens looking down at 35 degrees.
    const angle = (turn * Math.PI) / 2;
    const pitch = (35 * Math.PI) / 180;
    camera.position.set(f.x + Math.sin(angle) * Math.cos(pitch) * 78, f.y + Math.sin(pitch) * 78, f.z + Math.cos(angle) * Math.cos(pitch) * 78);
    lookAt.copy(f);
  } else if (view === 'low') {
    fov = 50;
    camera.position.set(f.x - 13, 3.2, f.z + 22);
    lookAt.set(f.x + 5, 6, f.z - 20);
  } else if (view === 'sun') {
    // Toward whichever of the sun and the moon is lighting the world.
    fov = 50;
    const sun = features ? features.sky.sunDirection : NO_SUN;
    const flat = Math.hypot(sun.x, sun.z) || 1;
    const hx = sun.x / flat;
    const hz = sun.z / flat;
    // Stand a little to one side, so the nearest tree is not in the way.
    camera.position.set(f.x - hx * 26 + hz * 7, 3, f.z - hz * 26 - hx * 7);
    lookAt.set(f.x + hx * 40 + hz * 7, 4 + (sun.y / flat) * 34, f.z + hz * 40 - hx * 7);
  } else if (view === 'pond') {
    fov = 30;
    camera.position.set(demo.pondSpot.x - 3, 6.5, demo.pondSpot.z + 8.5);
    lookAt.set(demo.pondSpot.x + 1, demo.pondSpot.y, demo.pondSpot.z - 1.5);
  } else {
    fov = 30;
    camera.position.set(demo.effectSpot.x, 3.2, demo.effectSpot.z + 7.5);
    lookAt.set(demo.effectSpot.x, 0.8, demo.effectSpot.z);
  }
  camera.lookAt(lookAt);
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- one frame

/** Plays an entry at the effect spot. A weather entry is a rate, so it gets a small handful, started where the weather would start it. */
function playEffect(id: EffectId): void {
  if (!features) return;
  const entry: EffectEntry = effectTable[id];
  const height = entry.shape === 'ring' ? 0.03 : id === 'rainDrop' ? 0.05 : id === 'rain' ? 5 : entry.weather ? 2.5 : 0.4;
  const at = { x: demo.effectSpot.x, y: height, z: demo.effectSpot.z };
  const alongWind = id === 'windLine' ? { x: Math.cos(ambient.windDir), y: 0, z: Math.sin(ambient.windDir) } : undefined;
  features.effects.play(id, at, entry.weather ? { scale: 24 / entry.count, direction: alongWind } : undefined);
}

function strike(): void {
  // A bolt where the camera can see it: behind the trees, 20 meters off.
  boltSpot = { x: demo.focus.x - 7, y: 0, z: demo.focus.z - 12 };
  weather.strikeNow(Math.hypot(7, 12));
  struckAt = ctx.time;
}

function step(dt: number): void {
  ctx.time += dt;
  if (mode === 'machine') {
    weather.step(dt * speed, demo.focus);
    motes = byHand.motes ?? weather.motes;
    rainbow = byHand.rainbow ?? weather.rainbow;
    moonPhase = byHand.moonPhase ?? weather.clock.moonPhase;
  }
  if (weather.strike.count !== seenStrikes) {
    seenStrikes = weather.strike.count;
    if (!boltSpot) struckAt = ctx.time;
    features?.sky.strike(boltSpot ?? weather.strike);
    boltSpot = null;
  }
  demo.setWetness(ambient.wetness);
  placeCamera();
  if (!features) return;

  if (repeatEffect) {
    repeatIn -= dt;
    if (repeatIn <= 0) {
      repeatIn = 0.45;
      playEffect(repeatEffect);
    }
  }

  // The wiring: everything follows one focus point, and the sky gets what Ambient does not carry yet.
  const { sky, water, effects, post } = features;
  sky.setShadowTarget(demo.focus);
  sky.setMoonPhase(moonPhase);
  sky.setRainbow(rainbow);
  effects.setFocus(demo.focus);
  effects.setMotes(motes);
  water.setFocus(demo.focus);
  post.setFocus(view === 'pond' ? demo.pondSpot : view === 'fx' ? demo.effectSpot : demo.focus);
  sky.update(dt, ctx);
  water.update(dt, ctx);
  effects.update(dt, ctx);
  post.update(dt, ctx);
}

function render(): void {
  if (features) {
    features.post.render();
  } else {
    renderer.info.reset();
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }
  counters.calls = renderer.info.render.calls;
  counters.triangles = renderer.info.render.triangles;
  counters.geometries = renderer.info.memory.geometries;
  counters.textures = renderer.info.memory.textures;
  counters.particles = features ? features.effects.live : 0;
}

// ---------------------------------------------------------------- setting a state

function setQuality(quality: Quality): void {
  ctx.quality = quality;
  if (!features) return;
  features.sky.setQuality?.(quality);
  features.water.setQuality?.(quality);
  features.effects.setQuality?.(quality);
  features.post.setQuality?.(quality);
}

function apply(state: DemoState): void {
  if (state.features !== undefined && state.features !== (features !== null)) {
    if (state.features) features = createFeatures();
    else disposeFeatures();
  }
  if (state.quality) setQuality(state.quality);
  if (state.time !== undefined) {
    weather.clock.setTimeOfDay(state.time);
    ambient.timeOfDay = state.time;
  }
  if (state.weather || state.machine !== undefined) byHand.motes = byHand.rainbow = byHand.moonPhase = null;
  if (state.weather) {
    mode = 'machine';
    speed = 1;
    weather.set(state.weather, { hold: true, instant: !state.front });
    weather.step(0, demo.focus);
  }
  if (state.machine !== undefined) {
    mode = 'machine';
    speed = state.machine;
    weather.resume();
  }
  if (state.ambient) {
    mode = 'manual';
    Object.assign(ambient, state.ambient);
    if (state.ambient.timeOfDay !== undefined) weather.clock.setTimeOfDay(state.ambient.timeOfDay);
  }
  if (state.motes !== undefined) motes = byHand.motes = state.motes;
  if (state.rainbow !== undefined) rainbow = byHand.rainbow = state.rainbow;
  if (state.moonPhase !== undefined) moonPhase = byHand.moonPhase = state.moonPhase;
  if (state.view) view = state.view;
  if (state.turn !== undefined) turn = state.turn;
  if (state.fx !== undefined) {
    repeatEffect = state.fx;
    repeatIn = 0;
  }
  // The far blur belongs to the game's camera looking down. A view toward the horizon is not a miniature.
  if (features && (state.view || state.quality || state.features)) features.post.set({ tiltShift: ctx.quality === 'high' && view !== 'low' && view !== 'sun' });
  if (state.post && features) features.post.set(state.post);
  if (state.panel !== undefined) panel.root.classList.toggle('hidden', !state.panel);
  if (state.paused !== undefined) paused = state.paused;
  panel.sync();
}

// ---------------------------------------------------------------- the panel

const panel: Panel = buildPanel(document.querySelector('#panel') as HTMLElement, {
  kinds: WEATHER_KINDS.map((kind) => ({ id: kind, name: weatherTable[kind].name })),
  effects: EFFECT_IDS,
  surfaces: SURFACES,
  read: () => ({
    ambient,
    counters,
    budget: effectBudget.particles,
    clock: `${weather.clock.label()}, day ${weather.clock.day + 1}, ${weather.clock.part}`,
    moon: `${MOON_NAMES[moonPhase]} (${moonPhase} of 8)`,
    weather: mode === 'manual' ? 'by hand (the sliders)' : weather.auto ? `${weatherTable[weather.kind].name}, machine at ${speed} times, next in ${Math.max(0, weather.changeIn).toFixed(0)} s` : `${weatherTable[weather.kind].name}, held`,
    extras: `motes ${motes.toFixed(2)}, rainbow ${rainbow.toFixed(2)}`,
    motes,
    rainbow,
    moonPhase,
    thunder: thunderNote,
    canvas: `${canvas.width} by ${canvas.height}`,
    post: features ? features.post.settings : null,
    postCost: features ? features.post.cost() : null,
    quality: ctx.quality,
    view,
    kind: mode === 'machine' && !weather.auto ? weather.kind : null,
    machine: mode === 'machine' && weather.auto,
    features: features !== null,
    fx: repeatEffect,
  }),
  apply,
  playEffect,
  strike,
  emit: (event) => bus.emit(event),
  eventSpot: () => ({ x: demo.effectSpot.x, y: 0, z: demo.effectSpot.z }),
  pondSpot: () => ({ x: demo.pondSpot.x, y: demo.pondSpot.y, z: demo.pondSpot.z }),
  costs: () => (features ? features.post.costs : null),
});

// ---------------------------------------------------------------- start, and the hook for scripts

features = createFeatures();
resize();
const initial = query.get('state');
if (initial) apply(JSON.parse(initial) as DemoState);
if (query.get('panel') === '0') apply({ panel: false });
panel.sync();

const hook = {
  apply,
  /** Steps the demo this many seconds without drawing. */
  advance(seconds: number, dt = 1 / 30): void {
    for (let t = 0; t < seconds - 1e-9; t += dt) step(dt);
  },
  render(): typeof counters {
    render();
    return { ...counters };
  },
  strike,
  ambient: () => ({ ...ambient }),
  effectIds: EFFECT_IDS,
  /**
   * Check 5: draw calls and triangles with the features off, then with everything on at `high` in a storm,
   * with a bolt, a rainbow and the dawn shafts all showing.
   */
  measure() {
    apply({ features: false, view: 'game', paused: true });
    step(1 / 30);
    render();
    const off = { calls: counters.calls, triangles: counters.triangles };
    apply({ features: true, quality: 'high', time: 0.27, weather: 'storm', rainbow: 1 });
    hook.advance(6);
    strike();
    step(1 / 30);
    // The storm cloud hides the dawn shafts, but they share one mesh with the bolt and the rainbow, so the
    // count below already includes them.
    render();
    const storm = { calls: counters.calls, triangles: counters.triangles, particles: counters.particles };
    // The worst case: other effects fire until the pool is full.
    for (let i = 0; i < 400 && features && features.effects.live < features.effects.capacity; i++) for (const id of EFFECT_IDS) playEffect(id);
    step(1 / 30);
    render();
    const full = { calls: counters.calls, triangles: counters.triangles, particles: counters.particles };
    const added = (on: { calls: number; triangles: number }) => ({ calls: on.calls - off.calls, triangles: on.triangles - off.triangles });
    return { off, storm, full, addedInStorm: added(storm), addedWithPoolFull: added(full) };
  },
  /** Check 6: `minutes` of storm, sampled every simulated minute. It draws one frame a second. */
  soak(minutes: number) {
    apply({ features: true, quality: 'high', time: 0.5, weather: 'storm', view: 'game', paused: true });
    const samples: { minute: number; particles: number; geometries: number; textures: number; programs: number; strikes: number }[] = [];
    const sample = (minute: number) => samples.push({ minute, particles: counters.particles, geometries: counters.geometries, textures: counters.textures, programs: renderer.info.programs?.length ?? 0, strikes: weather.strike.count });
    hook.advance(5);
    render();
    sample(0);
    for (let minute = 1; minute <= minutes; minute++) {
      for (let second = 0; second < 60; second++) {
        hook.advance(1);
        render();
      }
      sample(minute);
    }
    return samples;
  },
};
(window as unknown as { __sky: typeof hook }).__sky = hook;

let last = performance.now();
let sinceSync = 0;
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (paused) return;
  step(dt);
  render();
  sinceSync += dt;
  if (sinceSync > 0.2) {
    sinceSync = 0;
    panel.sync();
  }
}
requestAnimationFrame(frame);
