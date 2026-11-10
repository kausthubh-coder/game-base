// The props demo. Three pages in one:
//   ./                      a small world: a meadow, a forest edge, a pond rim and a village of the three buildings
//   ./?only=<kind>          one kind alone on a turntable, with its triangle count (add &variant=1 for one variant)
//   ./?sheet=<group>        every prop and variant of a group in labeled rows (tree, plant, ground, town, clutter, station)
//
// Keys in the world: Q and E turn the camera a quarter, Z and X or the wheel zoom, WASD or the arrows move.
// `window.__props` lets a script set a state, step time, draw a frame and read the counters
// (tools/props-shots.mjs uses it). `?panel=0` hides the panel.
import * as THREE from 'three';
import { PROPS, PROP_KINDS, propDef, type PropGroup, type PropKind } from '../../src/content/props.ts';
import type { ViewContext } from '../../src/engine/system.ts';
import { calmNoon, type Quality } from '../../src/engine/types.ts';
import { flatWorld } from '../../src/engine/world-query.ts';
import { createProps, scatter } from '../../src/features/props/index.ts';
import { createSky } from '../../src/features/sky/index.ts';
import { createWaterMaterial, type Water } from '../../src/features/water/index.ts';
import { createGround, LAND, SIZE, type Ground } from './ground.ts';
import { buildPanel } from './panel.ts';
import { frame, GROUP_NAMES, GROUPS, kindsOf, layoutRows, pictureHeight, PITCH, type Layout } from './sheet.ts';
import { buildVillage } from './village.ts';

export type ViewName = 'village' | 'forest' | 'pond' | 'whole';

/** Everything a script, the panel or the address bar can set. */
export interface DemoState {
  view?: ViewName;
  /** Quarter turns of the camera. */
  turn?: number;
  /** Meters from the camera to the point it looks at. */
  distance?: number;
  focus?: [number, number];
  time?: number;
  wind?: number;
  windDir?: number;
  quality?: Quality;
  /** False lifts the roofs off, to see inside the buildings. */
  roofs?: boolean;
  /** The turntable's angle, in radians. Setting it stops the turning. */
  angle?: number;
  panel?: boolean;
  paused?: boolean;
}

const VIEWS: Record<ViewName, { x: number; z: number; distance: number }> = {
  village: { x: 35.5, z: 58, distance: 92 },
  forest: { x: 41, z: 23, distance: 54 },
  pond: { x: 65, z: 73.5, distance: 38 },
  whole: { x: 48, z: 52, distance: 220 },
};
const ZOOMS = [38, 58, 92, 150, 220];

const query = new URLSearchParams(location.search);
const only = query.get('only');
const sheet = query.get('sheet');
const mode: 'world' | 'turntable' | 'sheet' = only ? 'turntable' : sheet ? 'sheet' : 'world';

// ---------------------------------------------------------------- the renderer and the features

const canvas = document.querySelector<HTMLCanvasElement>('#view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: query.has('shots') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// The game's last pass tone-maps. This page has no last pass, so the materials do it.
renderer.toneMapping = THREE.NeutralToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10141a);
const camera = new THREE.PerspectiveCamera(20, 1, 0.5, 1500);
const ambient = calmNoon();
ambient.timeOfDay = 0.42;
ambient.wind = 0.35;
ambient.windDir = 0.6;
const ctx: ViewContext = { scene, camera, renderer, ambient, world: flatWorld, quality: 'high', time: 0 };

// The sky owns the lights. Its sun's shadow camera already sees the layer the props put their shadow casters on.
const sky = createSky(ctx, { shadowRange: 60 });
// The two pages that show props on their own place each exactly as its builder made it.
const props = createProps(ctx, { vary: mode === 'world' });

const counters = { calls: 0, triangles: 0 };
const rig = { x: 0, y: 0, z: 0, distance: 92, turn: 0, yaw: 0, pitch: PITCH };
let paused = false;
let roofs = true;
let spinning = true;

// ---------------------------------------------------------------- labels over the picture

interface Label {
  el: HTMLDivElement;
  at: THREE.Vector3;
}
const labelRoot = document.querySelector('#labels') as HTMLElement;
const labels: Label[] = [];
const projected = new THREE.Vector3();

function addLabel(html: string, x: number, y: number, z: number, className = ''): void {
  const el = document.createElement('div');
  el.innerHTML = html;
  el.className = className;
  labelRoot.append(el);
  labels.push({ el, at: new THREE.Vector3(x, y, z) });
}

function placeLabels(): void {
  for (const label of labels) {
    projected.copy(label.at).project(camera);
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth, y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    label.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, 0)`;
  }
}

// ---------------------------------------------------------------- the world page

let ground: Ground | null = null;
let water: Water | null = null;

// The props only list where their lights sit: lighting the blocks around them is the world's job. Until
// the world does, this page puts a real light at each lamp post, so a night picture shows what the list is for.
const lampLights: THREE.PointLight[] = [];

function lightLamps(): void {
  const lamps = props.lights().filter((light) => light.kind === 'lampPost');
  while (lampLights.length < lamps.length) {
    const light = new THREE.PointLight(0xffd890, 0, 11, 1.7);
    lampLights.push(light);
    scene.add(light);
  }
  lampLights.forEach((light, i) => {
    light.visible = i < lamps.length;
    if (i < lamps.length) light.position.set(lamps[i].x, lamps[i].y - 0.15, lamps[i].z);
  });
}

/** Places everything again: the village, then the scatter around it. */
function populate(): void {
  if (!ground) return;
  props.clear();
  // With the roofs off, the walls are cut one block lower too, so the camera sees over the near one.
  const hideFrom = roofs ? Infinity : LAND + 2;
  const village = buildVillage(ground, props.place, hideFrom);
  ground.rebuild(roofs ? undefined : hideFrom);
  const wild = scatter(2026, ground.world, {
    area: { x0: 0, z0: 0, x1: SIZE, z1: SIZE },
    // Forest in the north, with a wavy edge, thinning to open meadow around the village and the pond.
    forest: (x, z) => Math.max(0, Math.min(1, (36 - z + Math.sin(x / 7) * 4 + Math.sin(x / 3.1) * 1.5) / 9)),
    blocked: village.blocked,
    waterLevel: ground.waterLevel,
  });
  for (const p of wild.props) props.place(p.kind, p.variant, p, p.rotation, p.scale);
  lightLamps();
}

async function startWorld(): Promise<void> {
  const [atlas, manifest] = await Promise.all([
    new THREE.TextureLoader().loadAsync('./assets/blocks/atlas.png'),
    fetch('./assets/manifest.json').then((r) => r.json() as Promise<{ blocks: { tile: number; tiles: Record<string, [number, number][]> } }>),
  ]);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.magFilter = THREE.NearestFilter;
  atlas.minFilter = THREE.LinearFilter;
  atlas.generateMipmaps = false;
  ground = createGround(atlas, manifest.blocks);
  scene.add(ground.group);
  ctx.world = ground.world;
  water = createWaterMaterial(ctx);
  water.setSky(sky.look);
  ground.water.material = water.material;
  populate();
  water.refresh();
  apply({ view: 'village' });
}

// ---------------------------------------------------------------- the pages that show props alone

let layout: Layout | null = null;

function standOn(shape: THREE.BufferGeometry): void {
  const mesh = new THREE.Mesh(shape, new THREE.MeshLambertMaterial({ color: 0x6d7b45 }));
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function caption(item: Layout['items'][number], withKind: boolean): string {
  const def = PROPS[item.kind];
  const name = withKind ? `<b>${def.name}</b> ${def.variants.length > 1 ? def.variants[item.variant] : ''}` : `<b>${def.variants[item.variant]}</b>`;
  return `${name}<br>${item.triangles} of ${item.budget} triangles`;
}

/** Stands every item of a layout on the ground with its label: in front of it on a sheet, under it on the turntable. */
function showLayout(next: Layout, withKind: boolean): void {
  layout = next;
  // The sky's low level draws no cloud shadows, which would cross the page.
  ambient.cloud = 0;
  sky.setQuality?.('low');
  for (const item of next.items) {
    props.place(item.kind, item.variant, { x: item.x - item.offsetX, y: 0, z: item.z - item.offsetZ });
    const over = item.triangles > item.budget ? 'over' : '';
    if (withKind) addLabel(caption(item, true), item.x, 0, item.z + item.depth / 2 + 0.04, over);
    else addLabel(caption(item, false), item.x, -0.2, item.z, over);
  }
}

function startTurntable(kind: string): void {
  if (!(kind in PROPS)) throw new Error(`no prop called ${kind}. Try one of: ${PROP_KINDS.join(', ')}`);
  const def = propDef(kind);
  const one = query.get('variant');
  const row = layoutRows([kind as PropKind], 1);
  if (one !== null) {
    row.items = row.items.filter((item) => item.variant === Number(one));
    if (row.items.length === 0) throw new Error(`${kind} has no variant ${one}`);
    row.items[0].x = 0;
  }
  showLayout(row, false);
  const radius = Math.max(...row.items.map((item) => Math.hypot(Math.abs(item.x) + item.width / 2, item.depth / 2))) + 0.45;
  const disc = new THREE.CylinderGeometry(radius, radius, 0.3, 64);
  disc.translate(0, -0.15, 0);
  standOn(disc);
  const facts = [`budget ${def.triangles} triangles`, def.wind ? 'sways in wind' : 'still', def.light > 0 ? `gives light ${def.light}${def.alwaysLit ? ', by day too' : ' when it is dark'}` : 'no light'];
  addLabel(`${def.name} <span style="font-weight:400">(${kind}): ${facts.join(', ')}</span>`, 0, row.tallest + radius * 0.22, 0, 'title');
  const { distance } = frame({ ...row, x0: -radius, x1: radius, z0: -radius, z1: radius, high: row.tallest }, camera.fov, window.innerWidth / window.innerHeight, 1.3);
  Object.assign(rig, { x: 0, y: row.tallest * 0.4, z: 0, distance, pitch: (28 * Math.PI) / 180 });
  sky.setShadowRange(Math.max(6, radius * 1.6));
}

function startSheet(group: string): void {
  if (!GROUPS.includes(group as PropGroup)) throw new Error(`no group called ${group}. Try one of: ${GROUPS.join(', ')}`);
  const kinds = kindsOf(group as PropGroup);
  const count = kinds.reduce((sum, kind) => sum + PROPS[kind].variants.length, 0);
  showLayout(layoutRows(kinds, Math.max(1, Math.min(4, Math.ceil(count / 8)))), true);
  const plane = new THREE.PlaneGeometry(600, 600);
  plane.rotateX(-Math.PI / 2);
  standOn(plane);
  spinning = false;
  // A very long lens, so the rows at the front are drawn no larger than the rows at the back.
  camera.fov = 6;
  camera.updateProjectionMatrix();
  fitSheet();
}

/** Aims the camera so the whole sheet shows, whatever the shape of the page. */
function fitSheet(): void {
  if (!layout || mode !== 'sheet') return;
  const { target, distance } = frame(layout, camera.fov, window.innerWidth / window.innerHeight);
  Object.assign(rig, { x: target.x, y: target.y, z: target.z, distance });
  sky.setShadowRange(Math.max(10, (layout.x1 - layout.x0) * 0.75));
}

// ---------------------------------------------------------------- the camera

function placeCamera(dt: number): void {
  // A quarter turn takes a third of a second.
  const want = (rig.turn * Math.PI) / 2;
  const ease = dt <= 0 ? 1 : 1 - Math.exp(-dt * 12);
  rig.yaw += (want - rig.yaw) * ease;
  const flat = Math.cos(rig.pitch) * rig.distance;
  camera.position.set(rig.x + Math.sin(rig.yaw) * flat, rig.y + Math.sin(rig.pitch) * rig.distance, rig.z + Math.cos(rig.yaw) * flat);
  camera.lookAt(rig.x, rig.y, rig.z);
}

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  fitSheet();
}
window.addEventListener('resize', resize);

const held = new Set<string>();
window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  const key = event.key.toLowerCase();
  held.add(key);
  if (mode !== 'world') return;
  if (key === 'q') rig.turn -= 1;
  if (key === 'e') rig.turn += 1;
  if (key === 'z' || key === 'x') {
    const nearest = ZOOMS.reduce((best, d, i) => (Math.abs(d - rig.distance) < Math.abs(ZOOMS[best] - rig.distance) ? i : best), 0);
    rig.distance = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, nearest + (key === 'x' ? 1 : -1)))];
  }
});
window.addEventListener('keyup', (event) => held.delete(event.key.toLowerCase()));
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  if (mode === 'world') rig.distance = Math.max(20, Math.min(300, rig.distance * Math.exp(event.deltaY * 0.001)));
}, { passive: false });

function pan(dt: number): void {
  if (mode !== 'world') return;
  const right = (held.has('d') || held.has('arrowright') ? 1 : 0) - (held.has('a') || held.has('arrowleft') ? 1 : 0);
  const down = (held.has('s') || held.has('arrowdown') ? 1 : 0) - (held.has('w') || held.has('arrowup') ? 1 : 0);
  if (!right && !down) return;
  const speed = rig.distance * 0.45 * dt;
  rig.x = Math.max(0, Math.min(SIZE, rig.x + (Math.cos(rig.yaw) * right + Math.sin(rig.yaw) * down) * speed));
  rig.z = Math.max(0, Math.min(SIZE, rig.z + (-Math.sin(rig.yaw) * right + Math.cos(rig.yaw) * down) * speed));
}

// ---------------------------------------------------------------- one frame

const focus = { x: 0, y: 0, z: 0 };

function step(dt: number): void {
  ctx.time += dt;
  if (mode === 'turntable' && spinning) rig.turn += (dt * 0.45) / (Math.PI / 2);
  pan(dt);
  placeCamera(dt);
  focus.x = rig.x;
  focus.y = rig.y;
  focus.z = rig.z;
  sky.setShadowTarget(focus);
  sky.update(dt, ctx);
  if (water) {
    water.setFocus(focus);
    water.update(dt, ctx);
  }
  props.update(dt, ctx);
  for (const light of lampLights) light.intensity = props.glow * 9;
}

function render(): typeof counters {
  renderer.render(scene, camera);
  counters.calls = renderer.info.render.calls;
  counters.triangles = renderer.info.render.triangles;
  placeLabels();
  return counters;
}

// ---------------------------------------------------------------- setting a state

function apply(state: DemoState): void {
  if (state.view) {
    const view = VIEWS[state.view];
    Object.assign(rig, { x: view.x, y: LAND, z: view.z, distance: view.distance });
    sky.setShadowRange(Math.max(40, Math.min(75, view.distance * 0.42)));
  }
  if (state.focus) [rig.x, rig.z] = state.focus;
  if (state.distance !== undefined) rig.distance = state.distance;
  if (state.turn !== undefined) {
    rig.turn = state.turn;
    rig.yaw = (state.turn * Math.PI) / 2;
  }
  if (state.angle !== undefined) {
    spinning = false;
    rig.turn = state.angle / (Math.PI / 2);
    rig.yaw = state.angle;
  }
  if (state.time !== undefined) ambient.timeOfDay = state.time;
  if (state.wind !== undefined) ambient.wind = state.wind;
  if (state.windDir !== undefined) ambient.windDir = state.windDir;
  if (state.quality) {
    ctx.quality = state.quality;
    if (mode === 'world') sky.setQuality?.(state.quality);
    water?.setQuality?.(state.quality);
  }
  if (state.roofs !== undefined && state.roofs !== roofs) {
    roofs = state.roofs;
    populate();
  }
  if (state.panel !== undefined) panel.root.classList.toggle('hidden', !state.panel);
  if (state.paused !== undefined) paused = state.paused;
  panel.sync();
}

/**
 * The two numbers the brief asks for. First the whole demo scene from each view: every draw call and
 * triangle in the frame, shadow pass included. Then a forest of 2,000 props on flat ground: what the
 * props alone add to the frame.
 */
function measure(): unknown {
  if (!ground) throw new Error('measure runs on the world page');
  apply({ quality: 'high', time: 0.42, roofs: true, paused: true });
  const views: Record<string, unknown> = {};
  for (const name of Object.keys(VIEWS) as ViewName[]) {
    apply({ view: name, turn: 0 });
    step(1 / 30);
    render();
    const stats = props.stats();
    views[name] = { drawCalls: counters.calls, triangles: counters.triangles, propDrawCalls: stats.drawCalls + stats.shadowCalls, propsDrawn: stats.drawn, propTriangles: stats.triangles + stats.shadowTriangles };
  }

  props.clear();
  ground.group.visible = false;
  const forest = scatter(11, flatWorld, { area: { x0: 0, z0: 0, x1: 80, z1: 80 }, forest: () => 0.8 }).props.slice(0, 2000);
  for (const p of forest) props.place(p.kind, p.variant, p, p.rotation, p.scale);
  Object.assign(rig, { x: 40, y: 0, z: 40, distance: 290 });
  sky.setShadowRange(75);
  step(1 / 30);
  render();
  const withProps = { ...counters };
  const stats = { ...props.stats() };
  props.group.visible = false;
  render();
  const without = { ...counters };
  props.group.visible = true;
  const result = {
    views,
    forest: {
      props: stats.drawn,
      kindsAndVariants: new Set(forest.map((p) => `${p.kind}:${p.variant}`)).size,
      trees: forest.filter((p) => PROPS[p.kind].group === 'tree').length,
      drawCallsAddedByProps: withProps.calls - without.calls,
      trianglesAddedByProps: withProps.triangles - without.triangles,
      ofWhichShadowCalls: stats.shadowCalls,
      ofWhichShadowTriangles: stats.shadowTriangles,
      frameWithProps: withProps,
      frameWithout: without,
    },
  };
  ground.group.visible = true;
  populate();
  apply({ view: 'village' });
  return result;
}

// ---------------------------------------------------------------- the panel, the start, and the hook for scripts

const panel = buildPanel(document.querySelector('#panel') as HTMLElement, {
  mode,
  kinds: PROP_KINDS.map((kind) => ({ id: kind, name: PROPS[kind].name })),
  groups: GROUPS.map((group) => ({ id: group, name: GROUP_NAMES[group] })),
  current: only ?? sheet ?? '',
  read: () => ({ ambient, counters, stats: props.stats(), quality: ctx.quality, roofs, glow: props.glow, lights: props.lights().length, canvas: `${canvas.width} by ${canvas.height}` }),
  apply,
  measure: () => JSON.stringify(measure(), null, 1),
});

resize();
try {
  if (mode === 'world') await startWorld();
  else if (mode === 'turntable') startTurntable(only as string);
  else startSheet(sheet as string);
} catch (error) {
  // A name that is not in the table: say so on the page, and to a script that is waiting for the page.
  const message = error instanceof Error ? error.message : String(error);
  addLabel(message, 0, 0, 0, 'title over');
  labels[labels.length - 1].el.style.transform = 'translate(24px, 24px)';
  labels.length = 0;
  (window as unknown as { __propsError: string }).__propsError = message;
  throw error;
}
if (query.get('panel') === '0') apply({ panel: false });
const initial = query.get('state');
if (initial) apply(JSON.parse(initial) as DemoState);
placeCamera(0);

const hook = {
  mode,
  /** On the turntable: the group of the kind it shows, which names the contact sheet it belongs on. */
  group: only && only in PROPS ? propDef(only).group : null,
  apply,
  /** Steps the demo this many seconds without drawing. */
  advance(seconds: number, dt = 1 / 30): void {
    for (let t = 0; t < seconds - 1e-9; t += dt) step(dt);
  },
  render: () => ({ ...render(), props: { ...props.stats() }, lights: props.lights().length, glow: props.glow }),
  measure,
  /** What each instanced mesh costs in this frame: its name, its copies and its triangles, largest first. */
  breakdown(): [string, number, number][] {
    const rows = props.group.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh && c.visible).map((mesh): [string, number, number] => [mesh.name, mesh.count, mesh.count * ((mesh.geometry.index ?? mesh.geometry.getAttribute('position')).count / 3)]);
    return rows.sort((p, q) => q[2] - p[2]);
  },
  /** How tall a picture of the sheet should be for a picture this wide. */
  sheetHeight: (width: number) => (layout ? pictureHeight(layout, width) : 0),
  kinds: PROP_KINDS,
  groups: GROUPS,
};
(window as unknown as { __props: typeof hook }).__props = hook;

let last = performance.now();
let sinceSync = 0;
function tick(now: number): void {
  requestAnimationFrame(tick);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (paused) return;
  step(dt);
  render();
  sinceSync += dt;
  if (sinceSync > 0.25) {
    sinceSync = 0;
    panel.sync();
  }
}
requestAnimationFrame(tick);
