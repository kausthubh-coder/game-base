// The painted meadow: a test scene for the environment's look, apart from the game. It asks one
// question: can this engine draw a place that looks like a hand-painted film background?
//
// In the address: `?view=wide|tree|pond|house|tilt|solo`, `?mood=noon|evening`, `?trees=leafy|painted|fluffy`,
// `?paint=1` (the paint filter), `?radius=5` (its brush size), `?quality=low|medium|high`, `?t=12` (hold the
// clock at 12 s, for screenshots), `?panel=0`. Keys: 1 to 6 pick a view, T changes the trees, M the mood,
// P turns the filter on and off. Drag to look round. `window.__ghibli` lets a script wait for the scene and read its counters.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GREAT_TREE, HOUSE, POND, SPECIMEN, WATER_Y, heightAt } from './land.ts';
import { shared } from './paint.ts';
import { createPost } from './post.ts';
import { TREE_LOOKS, createWorld, type MoodName, type Quality, type TreeLook } from './scene.ts';
import { loadTextures } from './textures.ts';

type ViewName = 'wide' | 'tree' | 'pond' | 'house' | 'tilt' | 'solo';
interface View { from: [number, number, number]; to: [number, number, number]; fov: number }

const eye = (x: number, z: number, lift = 1.7): [number, number, number] => [x, heightAt(x, z) + lift, z];
/** The game's 2.5D camera looks down at 35 degrees through a long lens. */
const tilt = (x: number, z: number, distance: number): View => {
  const y = heightAt(x, z), pitch = THREE.MathUtils.degToRad(35);
  return { from: [x, y + Math.sin(pitch) * distance, z + Math.cos(pitch) * distance], to: [x, y, z], fov: 24 };
};
const VIEWS: Record<ViewName, View> = {
  wide: { from: eye(4.5, 54, 2.1), to: [7, heightAt(7, -24) + 5.5, -24], fov: 44 },
  tree: { from: eye(-9, 3, 1.5), to: [GREAT_TREE.x, heightAt(GREAT_TREE.x, GREAT_TREE.z) + 10, GREAT_TREE.z], fov: 52 },
  pond: { from: eye(4, 22, 1.6), to: [POND.x + 6, WATER_Y + 1, POND.z - 6], fov: 46 },
  house: { from: eye(12, -27, 1.7), to: [HOUSE.x, heightAt(HOUSE.x, HOUSE.z) + 3, HOUSE.z], fov: 44 },
  tilt: tilt(2, 14, 64),
  // One tree alone with the pond and the sky behind it.
  solo: { from: eye(SPECIMEN.x + 2, SPECIMEN.z + 21, 1.5), to: [SPECIMEN.x, heightAt(SPECIMEN.x, SPECIMEN.z) + 5, SPECIMEN.z], fov: 42 },
};

const query = new URLSearchParams(location.search);
const pick = <T extends string>(name: string, options: readonly T[], fallback: T): T => {
  const value = query.get(name) as T | null;
  return value && options.includes(value) ? value : fallback;
};
const quality = pick<Quality>('quality', ['low', 'medium', 'high'], 'high');
const held = query.has('t') ? Number(query.get('t')) : null;

const canvas = document.querySelector<HTMLCanvasElement>('#view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: held !== null });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 1.5 : 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false;

const camera = new THREE.PerspectiveCamera(44, 1, 0.3, 3000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.497;
controls.minDistance = 2;
controls.maxDistance = 160;

const textures = await loadTextures();
const world = await createWorld(textures, quality);
const post = createPost(textures.paper, textures.paperMean);
// The paint filter is off unless asked for: Kausthubh did not like it.
post.settings.paint = query.get('paint') === '1';
post.settings.radius = Number(query.get('radius') ?? (quality === 'high' ? 5 : 3));

let view: ViewName = pick<ViewName>('view', ['wide', 'tree', 'pond', 'house', 'tilt', 'solo'], 'wide');
let mood: MoodName = pick<MoodName>('mood', ['noon', 'evening'], 'noon');
let trees: TreeLook = pick<TreeLook>('trees', TREE_LOOKS, 'leafy');

function setView(name: ViewName): void {
  view = name;
  const v = VIEWS[name];
  camera.position.set(...v.from);
  controls.target.set(...v.to);
  camera.fov = v.fov;
  camera.updateProjectionMatrix();
  controls.update();
  refreshPanel();
}

function setMood(name: MoodName): void {
  mood = name;
  world.setMood(name);
  refreshPanel();
}

function setTrees(look: TreeLook): void {
  trees = look;
  world.setTrees(look);
  refreshPanel();
}

// ---------------------------------------------------------------- the panel

const panel = document.querySelector<HTMLDivElement>('#panel') as HTMLDivElement;
const stats = document.createElement('span');
stats.id = 'stats';
const buttons: Array<{ el: HTMLButtonElement; on: () => boolean }> = [];
function button(label: string, on: () => boolean, press: () => void): void {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = label;
  el.addEventListener('click', () => { press(); refreshPanel(); });
  buttons.push({ el, on });
  panel.append(el);
}
function label(text: string): void {
  const el = document.createElement('span');
  el.textContent = text;
  panel.append(el);
}
function refreshPanel(): void {
  for (const b of buttons) b.el.classList.toggle('on', b.on());
}
label('View');
(Object.keys(VIEWS) as ViewName[]).forEach((name, i) => button(`${i + 1} ${name}`, () => view === name, () => setView(name)));
label('Light');
button('noon', () => mood === 'noon', () => setMood('noon'));
button('evening', () => mood === 'evening', () => setMood('evening'));
label('Trees');
for (const look of TREE_LOOKS) button(look, () => trees === look, () => setTrees(look));
label('Filter');
button('paint', () => post.settings.paint, () => { post.settings.paint = !post.settings.paint; });
panel.append(stats);
if (textures.standIns.length) label(`stand-in textures: ${textures.standIns.join(', ')}`);
if (query.get('panel') !== '0') panel.classList.remove('hidden');

window.addEventListener('keydown', (e) => {
  const names = Object.keys(VIEWS) as ViewName[];
  const n = Number(e.key);
  if (n >= 1 && n <= names.length) setView(names[n - 1] as ViewName);
  else if (e.key === 'p') { post.settings.paint = !post.settings.paint; refreshPanel(); }
  else if (e.key === 'm') setMood(mood === 'noon' ? 'evening' : 'noon');
  else if (e.key === 't') setTrees(TREE_LOOKS[(TREE_LOOKS.indexOf(trees) + 1) % TREE_LOOKS.length] as TreeLook);
});

// ---------------------------------------------------------------- the loop

function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  post.setSize(size.x, size.y);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
setMood(mood);
setTrees(trees);
setView(view);
document.querySelector('#loading')?.remove();

let frames = 0, last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  shared.uTime.value = held ?? shared.uTime.value + dt;
  controls.update();
  world.update(camera, held === null ? dt : 0);
  post.render(renderer, world.scene, camera);
  frames++;
  if (frames % 20 === 1) stats.textContent = `${post.stats.calls} calls · ${Math.round(post.stats.triangles / 1000)}k triangles`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

declare global {
  interface Window { __ghibli: { frames(): number; stats(): { calls: number; triangles: number }; setView(name: ViewName): void; setMood(name: MoodName): void; setTrees(look: TreeLook): void; standIns: string[] } }
}
window.__ghibli = { frames: () => frames, stats: () => ({ ...post.stats }), setView, setMood, setTrees, standIns: textures.standIns };
