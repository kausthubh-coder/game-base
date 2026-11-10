// The map demo: walk a small land, watch the minimap turn with the camera, open the full map, drop
// waypoints, follow one by its beam, and talk to a baker and a child. It wires four features the
// way src/main.ts will: input, map, hud and dialogue, plus the camera.
import * as THREE from 'three';
import { bakerTalk, childTalk, sampleVoices } from '../../src/content/dialogue-samples.ts';
import { weatherTable, type WeatherKind } from '../../src/content/weather.ts';
import { createBus, type GameEvent } from '../../src/engine/events.ts';
import type { ViewContext } from '../../src/engine/system.ts';
import { calmNoon } from '../../src/engine/types.ts';
import { createCamera } from '../../src/features/camera/index.ts';
import { createDialogue, type Conversation, type Flags } from '../../src/features/dialogue/index.ts';
import { createHud } from '../../src/features/hud/index.ts';
import { ACTIONS, actionLabel, codeLabel, createInput, moveToWorld, type Action } from '../../src/features/input/index.ts';
import { createMap, type MapMarker } from '../../src/features/map/index.ts';
import { HOUSES, LAND, PLACES, colorAt, hideLand, landCanvas, landWorld, paintPatch, walkable } from './land.ts';

const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
if (params.has('fresh')) {
  for (const key of ['game-base.demo.map', 'game-base.bindings', 'game-base.hud.scale']) localStorage.removeItem(key);
}

// A 3D scene just large enough to show the beam: the land as one flat picture, a few houses and people.
const canvas = $<HTMLCanvasElement>('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: params.get('aa') !== '0' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc8e6);
const lens = new THREE.PerspectiveCamera(20, innerWidth / innerHeight, 1, 600);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a5a, 1.6));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(-40, 80, -30);
scene.add(sun);

const groundPicture = landCanvas();
const groundTexture = new THREE.CanvasTexture(groundPicture);
groundTexture.colorSpace = THREE.SRGBColorSpace;
groundTexture.magFilter = THREE.NearestFilter;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(LAND, LAND).rotateX(-Math.PI / 2).translate(LAND / 2, 0, LAND / 2),
  new THREE.MeshBasicMaterial({ map: groundTexture }),
);
const sea = new THREE.Mesh(
  new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2).translate(LAND / 2, -0.05, LAND / 2),
  new THREE.MeshBasicMaterial({ color: 0x2f6f9f }),
);
scene.add(sea, ground);

const box = new THREE.BoxGeometry(1, 1, 1);
const roof = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);
for (const house of HOUSES) {
  const walls = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: house.wall }));
  walls.scale.set(house.w - 1, house.h, house.d - 1);
  walls.position.set(house.x, house.h / 2, house.z);
  const top = new THREE.Mesh(roof, new THREE.MeshLambertMaterial({ color: house.roof }));
  top.scale.set(house.w, house.h * 0.6, house.d);
  top.position.set(house.x, house.h * 1.3, house.z);
  scene.add(walls, top);
}

/** A placeholder person: a body, a head and a nose that shows which way it faces. */
function figure(cloth: number, tall = 1): THREE.Group {
  const group = new THREE.Group();
  const part = (color: number, w: number, h: number, d: number, y: number, z = 0): void => {
    const mesh = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color }));
    mesh.scale.set(w, h, d);
    mesh.position.set(0, y, z);
    group.add(mesh);
  };
  part(cloth, 0.6, 1.2, 0.4, 0.6);
  part(0xf0c8a0, 0.52, 0.5, 0.48, 1.5);
  part(cloth, 0.14, 0.12, 0.12, 1.48, -0.28);
  group.scale.setScalar(tall);
  scene.add(group);
  return group;
}
const place = (group: THREE.Group, x: number, z: number, facing: number): void => {
  group.position.set(x, 0, z);
  // Facing 0 is north and grows clockwise seen from above. A turn about y runs the other way.
  group.rotation.y = -facing;
};

const ctx: ViewContext = { scene, camera: lens, renderer, ambient: calmNoon(), world: landWorld, quality: 'high', time: 0 };
ctx.ambient.timeOfDay = Number(params.get('time') ?? 0.4);
const bus = createBus<GameEvent>();
const camera = createCamera(ctx, { input: false });

// The player, two people to talk to, two friends and a pet.
const player = { x: Number(params.get('x') ?? PLACES.spawn.x), z: Number(params.get('z') ?? PLACES.spawn.z), facing: 0, stamina: 100 };
const hero = figure(0xd8663a);
const people = [
  { key: 'odo', name: 'Odo', talk: bakerTalk, x: PLACES.odo.x, z: PLACES.odo.z, facing: Math.PI, body: figure(0xf2ead8, 1.05) },
  { key: 'juniper', name: 'Juniper', talk: childTalk, x: PLACES.juniper.x, z: PLACES.juniper.z, facing: Math.PI / 2, body: figure(0x6f8f4a, 0.72) },
];
for (const p of people) place(p.body, p.x, p.z, p.facing);
const friends = [
  { name: 'Ana', color: '#3f93e0', cloth: 0x3f93e0, around: { x: 276, z: 284 }, reach: 16, speed: 0.22, at: 0 },
  { name: 'Ben', color: '#e0609a', cloth: 0xe0609a, around: { x: 232, z: 240 }, reach: 22, speed: -0.15, at: 2 },
].map((f) => ({ ...f, body: figure(f.cloth), marker: { kind: 'friend', x: 0, z: 0, color: f.color } as MapMarker }));
const pet = { x: player.x - 1.5, z: player.z + 1, body: figure(0xf2a23c, 0.45), marker: { kind: 'pet', x: 0, z: 0 } as MapMarker };

// The game's flags. Conversations read and change them, and the demo shows what they are.
const flags: Flags = { wood: 12 };
const markers: MapMarker[] = [];
const questMarkers = people.map((p) => ({ kind: 'quest', x: p.x, z: p.z } as MapMarker));

// The four features.
const input = createInput(ctx, { touch: params.get('touch') === '1' ? 'on' : params.get('touch') === '0' ? 'off' : 'auto' });
const hud = createHud(ctx, { bus, onSlot: (i) => hud.message(`Slot ${i + 1}: ${slotItems[i]?.label ?? 'empty'}`) });
const map = createMap(ctx, { colorAt, worldSize: LAND * 1.5, storageKey: 'game-base.demo.map', bus });
hud.minimapSlot.append(map.minimap);
let voiced = 0;
const dialogue = createDialogue(ctx, {
  flags,
  bus,
  // The sound engine would voice each letter here: audio.emit({ type: 'talk', voice: sampleVoices[voiceId], char: letter }).
  onCharacter: (_letter, voiceId) => { if (sampleVoices[voiceId]) voiced++; },
  portrait: (key) => portraitFor(key),
  advanceKeys: () => ['Enter', 'NumpadEnter', 'Space', ...input.bindings.interact],
  onEnd: (conversation) => afterTalk(conversation),
});

// Pictures: icons for the slots and portraits for the dialogue box, from the asset manifest when it has them.
interface Manifest {
  icons?: { tile: number; sheet: string; names: Record<string, [number, number]> };
  portraits?: { tile: number; sheet: string; names: Record<string, [number, number]> };
  sprites?: Record<string, { sheet: string; frame: [number, number] }>;
}
const manifest = Object.values(import.meta.glob<Manifest>('../../public/assets/manifest.json', { eager: true, import: 'default' }))[0] ?? {};
const assetUrl = (path: string): string => new URL(`assets/${path}`, document.baseURI).href;
const images = new Map<string, Promise<HTMLImageElement>>();
const image = (path: string): Promise<HTMLImageElement> => {
  let loading = images.get(path);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`could not load ${path}`));
      img.src = assetUrl(path);
    });
    images.set(path, loading);
  }
  return loading;
};
/** A canvas that fills in with a piece of a sheet once the sheet has loaded. */
function crop(path: string, sx: number, sy: number, sw: number, sh: number, size: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = out.height = size;
  image(path).then((img) => {
    const g = out.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
  }, () => { /* The picture is missing. The slot or the portrait stays blank. */ });
  return out;
}
function iconFor(name: string): HTMLElement | null {
  const cell = manifest.icons?.names[name];
  if (!manifest.icons || !cell) return null;
  const t = manifest.icons.tile;
  return crop(manifest.icons.sheet, cell[0] * t, cell[1] * t, t, t, t);
}
/** A portrait: from the portrait sheet, or the head of the person's sprite, or null for the drawn initial. */
function portraitFor(key: string): HTMLElement | null {
  const cell = manifest.portraits?.names[key];
  if (manifest.portraits && cell) {
    const t = manifest.portraits.tile;
    return crop(manifest.portraits.sheet, cell[0] * t, cell[1] * t, t, t, t);
  }
  // Until the baker has a sprite of his own, the old villager stands in for him.
  const sprite = manifest.sprites?.[key] ?? (key === 'odo' ? manifest.sprites?.['villager-b'] : undefined);
  if (!sprite) return null;
  const [w, h] = sprite.frame;
  return crop(sprite.sheet, w * 0.22, h * 0.04, w * 0.56, h * 0.56, 96);
}

// The quick slots. The first holds the wood the baker asks for, and the last the sweets he pays with.
const slotItems: ({ label: string; icon: string; count?: number } | null)[] = [
  { label: 'Wood', icon: 'wood', count: 12 }, { label: 'Pickaxe', icon: 'pickaxe' }, { label: 'Axe', icon: 'axe' },
  { label: 'Sword', icon: 'sword' }, { label: 'Bow', icon: 'bow' }, { label: 'Potion', icon: 'potion', count: 3 },
  { label: 'Seeds', icon: 'seed', count: 24 }, { label: 'Lantern', icon: 'lantern' }, null,
];
const slotIcons = slotItems.map((item) => (item ? iconFor(item.icon) : null));
function showSlots(): void {
  slotItems[0]!.count = Number(flags.wood ?? 0);
  const sweets = Number(flags.sweets ?? 0);
  slotItems[8] = sweets > 0 ? { label: 'Honey bun', icon: 'wheat', count: sweets } : null;
  if (sweets > 0 && !slotIcons[8]) slotIcons[8] = iconFor('wheat');
  slotItems.forEach((item, i) => hud.setSlot(i, item && (item.count === undefined || item.count > 0) ? { icon: slotIcons[i], label: item.label, count: item.count } : null));
}

/** Everything that follows from the flags: the tracked quest, who has a quest mark, and the rumor on the map. */
function showProgress(): void {
  const lit = flags.oven === 'lit', told = flags['rumor.leaftail'] === true;
  hud.setQuest({
    title: 'Bread by noon',
    steps: [
      { text: 'Talk to Odo the baker', done: flags['met.odo'] === true },
      { text: 'Bring Odo ten logs', done: lit },
      { text: "Trade a honey bun for Juniper's secret", done: told },
      { text: 'Look by the old mill' },
    ],
  });
  markers.length = 0;
  if (!lit) markers.push(questMarkers[0]);
  if (!told) markers.push(questMarkers[1]);
  markers.push(pet.marker, ...friends.map((f) => f.marker));
  if (told && !map.rules.marks.rumors.some((r) => r.id === 'leaftail')) {
    map.rules.marks.setRumor('leaftail', PLACES.mill.x, PLACES.mill.z, 36, 'Something green');
    hud.message('A rumor is marked on your map.');
  }
  showSlots();
}
function afterTalk(conversation: Conversation): void {
  showProgress();
  if (conversation.id === 'odo-oven' && flags.oven === 'lit' && !flags['told.oven']) {
    flags['told.oven'] = true;
    hud.message('lit his oven with your wood.', { from: 'Odo' });
  }
}

// Pins the game adds by itself, a waypoint a friend shares, and three numbers for the bars.
const marks = map.rules.marks;
marks.setPin({ id: 'bakery', kind: 'shop', x: PLACES.bakery.x, z: PLACES.bakery.z, label: "Odo's bakery" });
marks.setPin({ id: 'waystone-village', kind: 'waystone', x: PLACES.waystone.x, z: PLACES.waystone.z, label: 'Village waystone' });
marks.setPin({ id: 'gate', kind: 'gate', x: PLACES.gate.x, z: PLACES.gate.z, label: 'Old gate' });
marks.setPin({ id: 'vault', kind: 'vault', x: PLACES.vault.x, z: PLACES.vault.z, label: 'Sunken vault' });
marks.setCrew('Ana', [{ x: 300.5, z: 300.5, icon: 'fish', color: 'tide', label: '' }]);
map.setMarkers(markers);
hud.setVital('health', 82, 100);
hud.setVital('mana', 40, 60);
showProgress();
hud.message('Walk up to Odo and press F to talk.');
let uiSounds = 0;
bus.on((e) => { if (e.type === 'ui') uiSounds++; });

// The demo's own buttons.
$('turn').addEventListener('click', () => input.press('turnRight'));
const weathers: WeatherKind[] = ['clear', 'breezy', 'overcast', 'rain', 'storm', 'fog'];
let weather = Math.max(0, weathers.indexOf((params.get('weather') ?? 'clear') as WeatherKind));
function setWeather(kind: WeatherKind): void {
  const w = weatherTable[kind];
  Object.assign(ctx.ambient, { cloud: w.cloud, rain: w.rain, fog: w.fog, wind: w.wind });
}
setWeather(weathers[weather]);
$('weather').addEventListener('click', () => {
  weather = (weather + 1) % weathers.length;
  setWeather(weathers[weather]);
  hud.message(`The weather turns: ${weatherTable[weathers[weather]].name}.`);
});
$('hour').addEventListener('click', () => { ctx.ambient.timeOfDay = (ctx.ambient.timeOfDay + 1 / 24) % 1; });
// The demo's panel sits under the health bars, whatever size the HUD is.
const placeDemo = (): void => {
  $('demo').style.top = `${Math.round(hud.element.querySelector('.gb-hud-vitals')!.getBoundingClientRect().bottom + 12)}px`;
};
new ResizeObserver(placeDemo).observe(hud.element.querySelector('.gb-hud-vitals')!);
$('smaller').addEventListener('click', () => hud.setScale(hud.scale - 0.1));
$('bigger').addEventListener('click', () => hud.setScale(hud.scale + 0.1));
$('touch').addEventListener('click', () => input.setTouch(!input.touch));
$('fresh').addEventListener('click', () => { location.search = '?fresh=1'; });
$('dig').addEventListener('click', () => {
  // The world changes: a pond appears north of the player, and the map redraws only that patch.
  const x = Math.floor(player.x), z = Math.floor(player.z) - 14;
  paintPatch(x, z, 9, 0x4c9bc8);
  map.invalidate(x - 5, z - 5, 10, 10);
  groundPicture.getContext('2d')!.drawImage(landCanvas(), 0, 0);
  groundTexture.needsUpdate = true;
  hud.message('A pond appears to the north.');
});
if (params.has('scale')) hud.setScale(Number(params.get('scale')));
if (innerWidth < 700 || innerHeight < 500) $<HTMLDetailsElement>('more').open = false;

// The keys panel: click a key, press the new one. The input feature saves it.
const keysPanel = $('keys');
const shownActions: Action[] = ACTIONS.filter((a) => !a.startsWith('slot'));
function drawKeys(): void {
  keysPanel.innerHTML = `<div class="sheet"><h2>Keys</h2><p>Click a key, then press the new one. Esc leaves it as it is. The keys are saved.</p><table>${
    shownActions.map((action) => `<tr><td>${actionLabel(action)}</td><td>${
      input.bindings[action].map((code, slot) => `<button type="button" data-action="${action}" data-slot="${slot}">${codeLabel(code)}</button>`).join('')
    }</td></tr>`).join('')
  }</table><div class="foot"><button type="button" data-do="reset">Defaults</button><button type="button" data-do="close">Done</button></div></div>`;
}
keysPanel.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.dataset.do === 'close') { keysPanel.hidden = true; return; }
  if (button.dataset.do === 'reset') { input.resetBindings(); drawKeys(); return; }
  button.classList.add('is-waiting');
  button.textContent = 'Press a key';
  const code = await input.capture();
  if (code) input.rebind(button.dataset.action as Action, code, Number(button.dataset.slot));
  drawKeys();
});
$('rebind').addEventListener('click', () => { drawKeys(); keysPanel.hidden = false; });

// One frame.
const move = { x: 0, z: 0 };
const prompt = $('prompt');
let near: (typeof people)[number] | null = null;
let shownNear: unknown = undefined;
let arrived = false;
let touchShown: boolean | null = null;
/** Walks the player by itself, for the timing run: `left` frames at `speed` blocks a second. */
let auto: { left: number; speed: number; flush: boolean; render: boolean; done: (result: object) => void; mapMs: number; flushMs: number; frames: number } | null = null;
let heading = 0.6;
const probe = map.minimap.querySelector('canvas')!;

function frame(dt: number, draw = true): void {
  ctx.time += dt;
  ctx.ambient.timeOfDay = (ctx.ambient.timeOfDay + dt / 1200) % 1;

  input.setMode(dialogue.isOpen ? 'talk' : map.isOpen || !keysPanel.hidden ? 'menu' : 'play');
  input.update(dt, ctx);
  const want = input.intents;
  if (want.map && keysPanel.hidden) map.toggle();
  if (want.turn) camera.turn(want.turn);
  if (want.zoom) camera.zoomBy(want.zoom);
  if (want.slot >= 0) hud.selectSlot(want.slot);
  if (want.slotStep) hud.selectSlot((hud.selected + want.slotStep + 9) % 9);

  // Walk. The move is relative to the camera, so it turns with it.
  let right = want.right, forward = want.forward, speed = 5;
  if (auto) {
    heading += 0.0035;
    move.x = Math.sin(heading); move.z = -Math.cos(heading);
    speed = auto.speed;
    if (auto.left % 150 === 75) camera.turn(1);
  } else {
    moveToWorld(right, forward, camera.yaw, move);
  }
  const moving = auto !== null || right !== 0 || forward !== 0;
  if (moving) {
    const nx = player.x + move.x * speed * dt, nz = player.z + move.z * speed * dt;
    if (auto || walkable(nx, player.z)) player.x = nx;
    if (auto || walkable(player.x, nz)) player.z = nz;
    player.facing = Math.atan2(move.x, -move.z);
  }
  player.stamina = Math.max(0, Math.min(100, player.stamina + (moving ? -3 : 9) * dt));
  hud.setVital('stamina', Math.round(player.stamina), 100);
  place(hero, player.x, player.z, player.facing);

  for (const f of friends) {
    f.at += f.speed * dt;
    f.marker.x = f.around.x + Math.cos(f.at) * f.reach;
    f.marker.z = f.around.z + Math.sin(f.at) * f.reach;
    place(f.body, f.marker.x, f.marker.z, f.at + (f.speed > 0 ? Math.PI : 0));
  }
  const gap = Math.hypot(player.x - pet.x, player.z - pet.z);
  if (gap > 2) {
    const k = Math.min(1, ((gap - 2) / gap) * 6 * dt);
    pet.x += (player.x - pet.x) * k;
    pet.z += (player.z - pet.z) * k;
  }
  pet.marker.x = pet.x; pet.marker.z = pet.z;
  place(pet.body, pet.x, pet.z, Math.atan2(player.x - pet.x, -(player.z - pet.z)));

  // Talking, a ping and a pin where the player stands.
  near = null;
  for (const p of people) if (Math.hypot(p.x - player.x, p.z - player.z) < 3.2) near = p;
  if (want.interact && near) dialogue.start(near.talk);
  if (want.usePressed) {
    marks.ping(player.x, player.z, 'you', 'ochre');
    hud.message('pinged this spot.', { from: 'You' });
  }
  if (want.placePressed) {
    hud.message(map.dropWaypoint() ? 'Waypoint dropped where you stand.' : 'You have 20 waypoints. Remove one on the map.');
  }
  const showNear = dialogue.isOpen || map.isOpen ? null : near;
  if (showNear !== shownNear) {
    shownNear = showNear;
    prompt.hidden = !showNear;
    if (showNear) prompt.innerHTML = `<kbd>${input.touch ? 'Talk' : codeLabel(input.bindings.interact[0] ?? '')}</kbd>Talk to ${showNear.name}`;
  }
  const active = marks.active;
  const there = !!active && Math.hypot(active.x - player.x, active.z - player.z) < 3;
  if (there && !arrived) hud.message('You reached your waypoint.');
  arrived = there;
  if (input.touch !== touchShown) {
    touchShown = input.touch;
    hud.setTouch(touchShown);
  }

  camera.follow(player.x, 0, player.z);
  camera.update(dt, ctx);
  lens.updateMatrixWorld();
  map.setPlayer(player.x, player.z, player.facing);
  const before = auto ? performance.now() : 0;
  map.update(dt, ctx);
  if (auto) {
    const mid = performance.now();
    // Reading a pixel back makes the browser finish drawing the minimap now, inside the timed part.
    if (auto.flush) probe.getContext('2d')!.getImageData(probe.width >> 1, probe.height >> 1, 1, 1);
    auto.mapMs += mid - before;
    auto.flushMs += performance.now() - mid;
    auto.frames++;
  }
  hud.update(dt, ctx);
  dialogue.update(dt, ctx);
  if (draw && (!auto || auto.render)) renderer.render(scene, lens);

  if (auto && --auto.left <= 0) {
    const run = auto;
    auto = null;
    const s = map.stats;
    run.done({
      frames: s.frames, drawn: s.drawn, minimapAvgMs: s.totalMs / s.frames, minimapMaxMs: s.maxMs,
      mapUpdateAvgMs: run.mapMs / run.frames, flushAvgMs: run.flushMs / run.frames, speed: run.speed, flush: run.flush, render: run.render,
      x: player.x, z: player.z,
    });
  }
}

let last = performance.now();
let paused = params.has('paused');
let frames = 0;
let readoutClock = 0;
const readout = $('readout');
function tick(now: number): void {
  // The first frame's time can be earlier than the moment the page finished starting, so never go backwards.
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = now;
  if (!paused) {
    frame(auto ? 1 / 60 : dt);
    frames++;
    readoutClock += dt;
    if (readoutClock > 0.5) {
      readoutClock = 0;
      const s = map.stats;
      readout.textContent = `minimap ${(s.frames ? s.totalMs / s.frames : 0).toFixed(3)} ms a frame · ${voiced} letters voiced · ${uiSounds} ui sounds · wood ${flags.wood ?? 0}`;
    }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  lens.aspect = innerWidth / innerHeight;
  lens.updateProjectionMatrix();
});

// For the screenshot and timing scripts in tools/.
const demo = {
  input, map, hud, dialogue, camera, player, flags, places: PLACES, people, hideLand,
  get frames() { return frames; },
  pause(): void { paused = true; },
  resume(): void { paused = false; last = performance.now(); },
  /** Runs frames by hand, each `dt` seconds long, and draws the last. For a screenshot at an exact moment. */
  step(count = 1, dt = 1 / 60): void { for (let i = 0; i < count; i++) frame(dt, i === count - 1); },
  teleport(x: number, z: number): void { player.x = x; player.z = z; camera.follow(x, 0, z); camera.snap(); },
  /**
   * Walks in a wide circle for `count` frames of a sixtieth of a second, turning the camera now and
   * then, and times the minimap. `flush` reads a pixel back each frame so the browser's own drawing
   * lands inside the timed part. `render` false skips the 3D scene, which this Mac draws slowly.
   */
  measure(count = 600, speed = 4.4, flush = false, render = true): Promise<object> {
    map.stats.reset();
    paused = false;
    return new Promise((done) => { auto = { left: count, speed, flush, render, done, mapMs: 0, flushMs: 0, frames: 0 }; });
  },
};
(window as unknown as { demo: typeof demo }).demo = demo;
