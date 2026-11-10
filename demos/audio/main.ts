// A plain top-down map to walk around in and hear the sound engine. It exists to drive the engine:
// position becomes region weights, sliders become the weather, and keys become events.
import { createBus, type GameEvent } from '../../src/engine/events.ts';
import { calmNoon, type Ambient, type Surface } from '../../src/engine/types.ts';
import { createAudio, VOICE_LIMIT, type AudioSystem, type BusName, type Element, type LayerId, type PetMood } from '../../src/features/audio/index.ts';
import { NPCS, type Npc } from './cast.ts';
import { runScene } from './lab.ts';
import {
  BOSS, bossAmount, CAMPS, dangerAmount, indoorsAmount, LANDS, MACHINE, makeTrees, makeWaterField, noise2, POND, regionWeights,
  SPOTS, START, SURFACE_COLOR, surfaceAt, townAmount, TOWNS, WORLD_RADIUS,
} from './world.ts';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector(selector) as T;
const canvas = $<HTMLCanvasElement>('#map');
const g = canvas.getContext('2d') as CanvasRenderingContext2D;
const panel = $('#panel');
const startButton = $<HTMLButtonElement>('#start');
const talkBox = $('#talk');
const whereBox = $('#where');

// ---------------------------------------------------------------------------------------------------
// The world, built once

const trees = makeTrees();
const waterNear = makeWaterField();

/** The ground, painted once at one pixel for every two units. */
const ground = document.createElement('canvas');
const GROUND_SCALE = 2;
ground.width = ground.height = (WORLD_RADIUS * 2) / GROUND_SCALE;
{
  const c = ground.getContext('2d') as CanvasRenderingContext2D;
  const image = c.createImageData(ground.width, ground.height);
  for (let pz = 0; pz < ground.height; pz++) {
    for (let px = 0; px < ground.width; px++) {
      const x = -WORLD_RADIUS + (px + 0.5) * GROUND_SCALE;
      const z = -WORLD_RADIUS + (pz + 0.5) * GROUND_SCALE;
      const at = (pz * ground.width + px) * 4;
      if (Math.hypot(x, z) > WORLD_RADIUS) {
        image.data[at + 3] = 0;
        continue;
      }
      const [r, gr, b] = SURFACE_COLOR[surfaceAt(x, z)];
      const shade = 0.9 + 0.2 * noise2(x, z, 5, 77);
      image.data[at] = r * shade;
      image.data[at + 1] = gr * shade;
      image.data[at + 2] = b * shade;
      image.data[at + 3] = 255;
    }
  }
  c.putImageData(image, 0, 0);
}

interface Pickup {
  x: number;
  z: number;
  /** The time it comes back, or 0 while it is there. */
  back: number;
}
const pickups: Pickup[] = [];
// A row by the start, close together, so collecting them quickly makes the notes climb.
for (let i = 0; i < 9; i++) pickups.push({ x: START.x + 10 + i * 5, z: START.z - 14, back: 0 });
{
  let seed = 777;
  const rand = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2;
    const r = 30 + Math.sqrt(rand()) * (WORLD_RADIUS - 60);
    pickups.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, back: 0 });
  }
}

// ---------------------------------------------------------------------------------------------------
// State

const player = { x: START.x, z: START.z, facing: 0, moving: false, hop: 0, stepIn: 0 };
const pet = { x: START.x - 4, z: START.z + 3, chirpIn: 4 };
const keys = new Set<string>();
const weights: Record<string, number> = {};
const ambient: Ambient = { ...calmNoon(), timeOfDay: 0.4, windDir: 0.6 };
const world = { fight: 0, autoDay: false, time: 0, machineIn: 0, machineStep: 0, machineFlash: 0 };
const cost = { sum: 0, n: 0, max: 0, mean: 0, worst: 0 };
let talking: { npc: Npc; line: number; shown: number; typed: number } | null = null;
/** The mixer sliders. They can be moved before the first click, so they are applied when the engine starts. */
const volumes: Record<BusName, number> = { master: 0.9, music: 0.8, ambience: 0.7, effects: 0.8, voice: 0.8 };

let context: AudioContext | null = null;
let audio: AudioSystem | null = null;
/** The base's own event bus. The engine listens to it through `onEvent`, as it will in the game. */
const events = createBus<GameEvent>();
events.on((event) => audio?.onEvent(event));

const here = (): { x: number; y: number; z: number } => ({ x: player.x, y: 0, z: player.z });

// ---------------------------------------------------------------------------------------------------
// The panel

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, parent?: HTMLElement): HTMLElementTagNameMap[K] => {
  const node = Object.assign(document.createElement(tag), props);
  parent?.appendChild(node);
  return node;
};
const section = (title: string): HTMLElement => {
  el('h2', { textContent: title }, panel);
  return el('div', {}, panel);
};

const readouts: Record<string, HTMLElement> = {};
{
  const dl = el('dl', { className: 'grid' }, section('Now playing'));
  for (const name of ['Tempo', 'Bar, beat', 'Key', 'Chord', 'Notes', 'Land', 'Intensity', 'Voices', 'Nodes', 'Cost']) {
    el('dt', { textContent: name }, dl);
    readouts[name] = el('dd', { textContent: 'not started' }, dl);
  }
}
const weightBars: Record<string, { fill: HTMLElement; text: HTMLElement }> = {};
{
  const box = el('div', { className: 'bars' }, section('Region weights'));
  for (const land of LANDS) {
    el('span', { textContent: land }, box);
    const bar = el('div', { className: 'bar' }, box);
    weightBars[land] = { fill: el('i', {}, bar), text: el('span', { textContent: '0' }, box) };
  }
}
const chips: Partial<Record<LayerId, HTMLElement>> = {};
{
  const box = el('div', { className: 'chips' }, section('Layers playing'));
  for (const id of ['drone', 'harmony', 'melody', 'sparkle', 'bass', 'perc', 'full', 'drums', 'tension', 'boss'] as LayerId[]) {
    chips[id] = el('span', { className: 'chip', textContent: id === 'full' ? 'town' : id }, box);
  }
}

function slider(parent: HTMLElement, name: string, value: number, onInput: (v: number) => void, format = (v: number) => v.toFixed(2)): HTMLInputElement {
  const row = el('label', { className: 'row' }, parent);
  el('span', { textContent: name }, row);
  const input = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: String(value) }, row);
  const text = el('span', { textContent: format(value) }, row);
  input.addEventListener('input', () => {
    onInput(Number(input.value));
    text.textContent = format(Number(input.value));
  });
  return input;
}
const clock = (v: number): string => {
  const minutes = Math.round(v * 24 * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};
let timeSlider: HTMLInputElement;
let fightButton: HTMLButtonElement;
{
  const box = section('World');
  timeSlider = slider(box, 'Time of day', ambient.timeOfDay, (v) => (ambient.timeOfDay = v), clock);
  slider(box, 'Rain', ambient.rain, (v) => (ambient.rain = v));
  slider(box, 'Wind', ambient.wind, (v) => (ambient.wind = v));
  const row = el('div', { className: 'buttons' }, box);
  fightButton = el('button', { className: 'toggle', type: 'button', textContent: 'Fight (F)' }, row);
  fightButton.addEventListener('click', () => toggleFight());
  const day = el('button', { className: 'toggle', type: 'button', textContent: 'Day passes' }, row);
  day.addEventListener('click', () => {
    world.autoDay = !world.autoDay;
    day.classList.toggle('on', world.autoDay);
  });
}
{
  const box = section('Mixer');
  for (const bus of Object.keys(volumes) as BusName[]) {
    slider(box, bus, volumes[bus], (v) => {
      volumes[bus] = v;
      audio?.setVolume(bus, v);
    });
  }
}
{
  const box = el('div', { className: 'buttons' }, section('Go to'));
  for (const spot of SPOTS) {
    el('button', { type: 'button', textContent: spot.name }, box).addEventListener('click', () => teleport(spot.x, spot.z));
  }
}
{
  const box = el('div', { className: 'buttons' }, section('Try a sound'));
  const add = (name: string, run: () => void): void => {
    el('button', { type: 'button', textContent: name }, box).addEventListener('click', run);
  };
  add('Quest stinger (Q)', () => audio?.emit({ type: 'stinger' }));
  add('Hit (H)', () => audio?.emit({ type: 'hit', at: here() }));
  for (const element of ['bloom', 'flame', 'tide', 'spark', 'gale', 'stone'] as Element[]) add(`Spell: ${element}`, () => audio?.emit({ type: 'spell', element, at: here() }));
  add('Thunder', () => events.emit({ type: 'thunder', at: { x: player.x + 30, y: 0, z: player.z - 40 } }));
  add('Place block (B)', () => events.emit({ type: 'blockPlaced', surface: surfaceAt(player.x, player.z), at: here() }));
  add('Break block (N)', () => events.emit({ type: 'blockBroken', surface: surfaceAt(player.x, player.z), at: here() }));
  for (const mood of ['happy', 'curious', 'sad', 'alert'] as PetMood[]) add(`Pet: ${mood}`, () => audio?.emit({ type: 'pet', mood, at: { x: pet.x, y: 0, z: pet.z } }));
  for (const surface of Object.keys(SURFACE_COLOR) as Surface[]) add(`Step: ${surface}`, () => events.emit({ type: 'footstep', surface, at: here() }));
}
// A button keeps the keyboard after a click, and Space would press it again. Give the keys back to the map.
panel.addEventListener('click', (e) => {
  if (e.target instanceof HTMLButtonElement) {
    e.target.blur();
    events.emit({ type: 'ui', sound: 'click' });
  }
});

// ---------------------------------------------------------------------------------------------------
// Actions

function toggleFight(): void {
  world.fight = world.fight ? 0 : 1;
  fightButton.classList.toggle('on', world.fight === 1);
}

function teleport(x: number, z: number): void {
  player.x = x;
  player.z = z;
  pet.x = x - 3;
  pet.z = z + 3;
  closeTalk();
}

function nearestNpc(): Npc | null {
  let best: Npc | null = null;
  let bestD = 16;
  for (const npc of NPCS) {
    const d = Math.hypot(npc.x - player.x, npc.z - player.z);
    if (d < bestD) {
      bestD = d;
      best = npc;
    }
  }
  return best;
}

function closeTalk(): void {
  if (!talking) return;
  talking = null;
  talkBox.style.display = 'none';
  events.emit({ type: 'ui', sound: 'close' });
}

function pressTalk(): void {
  if (talking) {
    const line = talking.npc.lines[talking.line] ?? '';
    if (talking.shown < line.length) talking.shown = talking.typed = line.length;
    else if (talking.line + 1 < talking.npc.lines.length) talking = { npc: talking.npc, line: talking.line + 1, shown: 0, typed: 0 };
    else closeTalk();
    return;
  }
  const npc = nearestNpc();
  if (!npc) return;
  talking = { npc, line: 0, shown: 0, typed: 0 };
  talkBox.style.display = 'block';
  (talkBox.querySelector('.who') as HTMLElement).textContent = npc.name;
  events.emit({ type: 'ui', sound: 'open' });
}

function jump(): void {
  if (player.hop > 0) return;
  player.hop = 0.001;
  events.emit({ type: 'jump', at: here() });
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (!audio) return;
  if (k === 'e') pressTalk();
  else if (k === 'f') toggleFight();
  else if (k === ' ') jump();
  else if (k === 'q') audio.emit({ type: 'stinger' });
  else if (k === 'h') audio.emit({ type: 'hit', at: here() });
  else if (k === 'b') events.emit({ type: 'blockPlaced', surface: surfaceAt(player.x, player.z), at: here() });
  else if (k === 'n') events.emit({ type: 'blockBroken', surface: surfaceAt(player.x, player.z), at: here() });
  else if (k >= '1' && k <= '6') audio.emit({ type: 'spell', element: (['bloom', 'flame', 'tide', 'spark', 'gale', 'stone'] as Element[])[Number(k) - 1] as Element, at: here() });
});
window.addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
window.addEventListener('blur', () => keys.clear());

// No sound before the first click: the context does not exist until then.
startButton.addEventListener('click', () => {
  if (audio) return;
  context = new AudioContext();
  audio = createAudio(context);
  for (const bus of Object.keys(volumes) as BusName[]) audio.setVolume(bus, volumes[bus]);
  regionWeights(player.x, player.z, weights);
  audio.setState({ regions: weights });
  audio.followAmbient(ambient);
  audio.start();
  startButton.remove();
});
// A hidden tab stops drawing frames. Pause the clock with it, so the music picks up where it stopped.
document.addEventListener('visibilitychange', () => {
  if (!context) return;
  if (document.hidden) void context.suspend();
  else void context.resume();
});

// ---------------------------------------------------------------------------------------------------
// The loop

const MACHINE_PATTERN = 'x.xx.x..x.x.xx..';

function step(dt: number): void {
  world.time += dt;
  if (world.autoDay) {
    ambient.timeOfDay = (ambient.timeOfDay + dt / 150) % 1;
    timeSlider.value = String(ambient.timeOfDay);
    (timeSlider.nextElementSibling as HTMLElement).textContent = clock(ambient.timeOfDay);
  }
  ambient.cloud = 0.2 + 0.7 * ambient.rain;
  ambient.wetness += (ambient.rain - ambient.wetness) * Math.min(1, dt / 6);

  // Walk
  let dx = 0;
  let dz = 0;
  if (!talking) {
    if (keys.has('a') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) dx += 1;
    if (keys.has('w') || keys.has('ArrowUp')) dz -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) dz += 1;
  }
  const running = keys.has('Shift');
  player.moving = dx !== 0 || dz !== 0;
  if (player.moving) {
    const speed = (running ? 34 : 15) / Math.hypot(dx, dz);
    const nx = player.x + dx * speed * dt;
    const nz = player.z + dz * speed * dt;
    if (Math.hypot(nx, nz) < WORLD_RADIUS - 4) {
      player.x = nx;
      player.z = nz;
    }
    player.facing = Math.atan2(dz, dx);
  }
  const surface = surfaceAt(player.x, player.z);
  if (player.hop > 0) {
    player.hop += dt / 0.42;
    if (player.hop >= 1) {
      player.hop = 0;
      events.emit({ type: 'land', surface, at: here() });
      player.stepIn = 0.3;
    }
  } else if (player.moving) {
    player.stepIn -= dt;
    if (player.stepIn <= 0) {
      player.stepIn = running ? 0.25 : 0.36;
      events.emit({ type: 'footstep', surface, at: here() });
    }
  } else {
    player.stepIn = 0.08;
  }

  // The pet trails behind and says how it feels.
  const gap = Math.hypot(player.x - pet.x, player.z - pet.z);
  if (gap > 6) {
    const pull = Math.min(1, dt * 3) * (1 - 6 / gap);
    pet.x += (player.x - pet.x) * pull;
    pet.z += (player.z - pet.z) * pull;
  }
  pet.chirpIn -= dt;
  const danger = dangerAmount(player.x, player.z);
  if (pet.chirpIn <= 0 && audio) {
    pet.chirpIn = 5 + Math.random() * 5;
    const mood: PetMood = danger > 0.3 || world.fight ? 'alert' : ambient.rain > 0.6 ? 'sad' : nearestNpc() ? 'curious' : 'happy';
    audio.emit({ type: 'pet', mood, at: { x: pet.x, y: 0, z: pet.z } });
  }

  // Pickups
  for (const p of pickups) {
    if (p.back > 0) {
      if (world.time > p.back) p.back = 0;
      continue;
    }
    if (Math.hypot(p.x - player.x, p.z - player.z) < 3.2) {
      p.back = world.time + 25;
      events.emit({ type: 'pickup', at: { x: p.x, y: 0, z: p.z } });
    }
  }

  // The machine acts in an uneven pattern. The engine moves each tick onto the half beat.
  world.machineIn -= dt;
  world.machineFlash = Math.max(0, world.machineFlash - dt * 6);
  if (world.machineIn <= 0) {
    world.machineIn += 0.22;
    world.machineStep = (world.machineStep + 1) % MACHINE_PATTERN.length;
    if (MACHINE_PATTERN[world.machineStep] === 'x' && Math.hypot(MACHINE.x - player.x, MACHINE.z - player.z) < 90) {
      world.machineFlash = 1;
      audio?.emit({ type: 'machine', at: { x: MACHINE.x, y: 0, z: MACHINE.z } });
    }
  }

  // Dialogue types out at the speaker's speed, one blip per character.
  if (talking) {
    const line = talking.npc.lines[talking.line] ?? '';
    talking.shown = Math.min(line.length, talking.shown + dt * talking.npc.voice.speed);
    while (talking.typed < Math.floor(talking.shown)) {
      audio?.emit({ type: 'talk', voice: talking.npc.voice, char: line[talking.typed] ?? ' ', at: { x: talking.npc.x, y: 0, z: talking.npc.z } });
      talking.typed++;
    }
    (talkBox.querySelector('.line') as HTMLElement).textContent = line.slice(0, Math.floor(talking.shown));
    if (Math.hypot(talking.npc.x - player.x, talking.npc.z - player.z) > 30) closeTalk();
  }

  // Hand the engine the world as numbers.
  if (audio) {
    const before = performance.now();
    regionWeights(player.x, player.z, weights);
    audio.setState({
      regions: weights,
      town: townAmount(player.x, player.z),
      indoors: indoorsAmount(player.x, player.z),
      danger,
      fight: world.fight,
      boss: bossAmount(player.x, player.z),
      nearWater: waterNear(player.x, player.z),
      trees: trees.near(player.x, player.z),
    });
    audio.followAmbient(ambient);
    audio.setListener(here());
    audio.update(dt);
    const ms = performance.now() - before;
    cost.sum += ms;
    cost.n++;
    cost.max = Math.max(cost.max, ms);
    if (cost.n >= 120) {
      cost.mean = cost.sum / cost.n;
      cost.worst = cost.max;
      cost.sum = cost.n = cost.max = 0;
    }
  }
}

function draw(): void {
  const ratio = Math.min(2, devicePixelRatio || 1);
  const w = Math.round(canvas.clientWidth * ratio);
  const h = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const zoom = 3.2 * ratio;
  const sx = (x: number): number => (x - player.x) * zoom + w / 2;
  const sz = (z: number): number => (z - player.z) * zoom + h / 2;
  const seen = (x: number, z: number, pad = 12): boolean => Math.abs(x - player.x) * zoom < w / 2 + pad * zoom && Math.abs(z - player.z) * zoom < h / 2 + pad * zoom;
  const disc = (x: number, z: number, r: number, fill: string): void => {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(sx(x), sz(z), r * zoom, 0, Math.PI * 2);
    g.fill();
  };

  g.fillStyle = '#0b0e13';
  g.fillRect(0, 0, w, h);
  g.imageSmoothingEnabled = false;
  g.drawImage(ground, sx(-WORLD_RADIUS), sz(-WORLD_RADIUS), WORLD_RADIUS * 2 * zoom, WORLD_RADIUS * 2 * zoom);

  // Towns: a house you can enter and a name.
  g.font = `${11 * ratio}px ui-sans-serif, system-ui, sans-serif`;
  g.textAlign = 'center';
  for (const t of TOWNS) {
    if (!seen(t.x, t.z, 70)) continue;
    g.fillStyle = 'rgb(60 44 30 / 0.55)';
    g.fillRect(sx(t.house.x), sz(t.house.z), t.house.w * zoom, t.house.d * zoom);
    g.strokeStyle = '#3a2a1c';
    g.lineWidth = 2 * ratio;
    g.strokeRect(sx(t.house.x), sz(t.house.z), t.house.w * zoom, t.house.d * zoom);
    g.fillStyle = 'rgb(255 255 255 / 0.8)';
    g.fillText(`${t.land} town`, sx(t.x), sz(t.z - 30));
  }
  // The boss gate and the camps
  if (seen(BOSS.x, BOSS.z, BOSS.r)) {
    g.strokeStyle = '#b77cf0';
    g.lineWidth = 2 * ratio;
    g.setLineDash([6 * ratio, 5 * ratio]);
    g.beginPath();
    g.arc(sx(BOSS.x), sz(BOSS.z), BOSS.r * zoom, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#d7b6ff';
    g.fillText('boss zone', sx(BOSS.x), sz(BOSS.z));
  }
  for (const c of CAMPS) {
    if (!seen(c.x, c.z, 80)) continue;
    disc(c.x, c.z, 72, 'rgb(200 60 50 / 0.08)');
    for (const [ox, oz] of [[0, 0], [7, 4], [-6, 5]] as const) disc(c.x + ox, c.z + oz, 2.6, '#c8463c');
    g.fillStyle = '#ffb4a8';
    g.fillText('enemy camp', sx(c.x), sz(c.z - 8));
  }
  if (seen(POND.x, POND.z, POND.r)) {
    g.fillStyle = 'rgb(255 255 255 / 0.7)';
    g.fillText('pond', sx(POND.x), sz(POND.z));
  }
  // The machine: its arm flashes when it acts.
  if (seen(MACHINE.x, MACHINE.z)) {
    g.fillStyle = '#5a6272';
    g.fillRect(sx(MACHINE.x - 3), sz(MACHINE.z - 3), 6 * zoom, 6 * zoom);
    g.fillStyle = `rgb(255 220 120 / ${0.25 + 0.75 * world.machineFlash})`;
    g.fillRect(sx(MACHINE.x - 1 + world.machineFlash * 3), sz(MACHINE.z - 1), 2 * zoom, 2 * zoom);
  }
  for (const p of pickups) {
    if (p.back > 0 || !seen(p.x, p.z)) continue;
    const bob = Math.sin(world.time * 3 + p.x) * 0.3;
    g.fillStyle = '#ffd95a';
    g.beginPath();
    g.moveTo(sx(p.x), sz(p.z - 1.5 + bob));
    g.lineTo(sx(p.x + 1.1), sz(p.z + bob));
    g.lineTo(sx(p.x), sz(p.z + 1.5 + bob));
    g.lineTo(sx(p.x - 1.1), sz(p.z + bob));
    g.fill();
  }
  for (const npc of NPCS) {
    if (!seen(npc.x, npc.z)) continue;
    disc(npc.x, npc.z, 2.4, npc.color);
    g.fillStyle = '#fff';
    g.fillText(Math.hypot(npc.x - player.x, npc.z - player.z) < 16 ? `${npc.name} (E)` : npc.name, sx(npc.x), sz(npc.z - 4));
  }
  disc(pet.x, pet.z, 1.4, '#f6a6c8');
  // The player hops when it jumps.
  const lift = player.hop > 0 ? Math.sin(player.hop * Math.PI) * 4 : 0;
  disc(player.x, player.z, 2.2, 'rgb(0 0 0 / 0.25)');
  disc(player.x, player.z - lift, 2.2, world.fight ? '#ff8a66' : '#ffffff');
  disc(player.x + Math.cos(player.facing) * 1.3, player.z - lift + Math.sin(player.facing) * 1.3, 0.7, '#1a2330');
  for (const t of trees.all) {
    if (!seen(t.x, t.z, 6)) continue;
    disc(t.x, t.z, t.size, 'rgb(34 84 52 / 0.82)');
    disc(t.x - t.size * 0.25, t.z - t.size * 0.25, t.size * 0.5, 'rgb(70 128 78 / 0.8)');
  }

  // Night and rain
  const sun = -Math.cos(2 * Math.PI * ambient.timeOfDay);
  const dark = Math.max(0, Math.min(1, (0.25 - sun) / 0.5));
  if (dark > 0) {
    g.fillStyle = `rgb(8 14 40 / ${0.55 * dark})`;
    g.fillRect(0, 0, w, h);
  }
  if (ambient.rain > 0.02) {
    g.strokeStyle = `rgb(190 210 240 / ${0.35 * ambient.rain})`;
    g.lineWidth = ratio;
    g.beginPath();
    for (let i = 0; i < 90 * ambient.rain; i++) {
      const x = ((i * 137.5 + world.time * 220) % (w + 40)) - 20;
      const y = (i * 71.3 + world.time * 900) % h;
      g.moveTo(x, y);
      g.lineTo(x - 4 * ratio, y + 12 * ratio);
    }
    g.stroke();
  }

  // A small map of the whole world
  const m = Math.min(132 * ratio, w * 0.3);
  const mx = w - m - 10 * ratio;
  const my = 10 * ratio;
  g.globalAlpha = 0.9;
  g.imageSmoothingEnabled = true;
  g.drawImage(ground, mx, my, m, m);
  g.globalAlpha = 1;
  g.fillStyle = '#fff';
  g.strokeStyle = '#000';
  g.lineWidth = ratio;
  g.beginPath();
  g.arc(mx + ((player.x + WORLD_RADIUS) / (WORLD_RADIUS * 2)) * m, my + ((player.z + WORLD_RADIUS) / (WORLD_RADIUS * 2)) * m, 3 * ratio, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

let panelIn = 0;
function readPanel(dt: number): void {
  panelIn -= dt;
  if (panelIn > 0) return;
  panelIn = 0.1;
  const land = LANDS.reduce((a, b) => ((weights[b] ?? 0) > (weights[a] ?? 0) ? b : a));
  whereBox.textContent = `${land} · ${surfaceAt(player.x, player.z)}${townAmount(player.x, player.z) > 0.5 ? ' · town' : ''}${indoorsAmount(player.x, player.z) > 0.5 ? ' · indoors' : ''}`;
  if (!audio) return;
  const d = audio.debug();
  const set = (name: string, text: string): void => {
    const node = readouts[name];
    if (node && node.textContent !== text) node.textContent = text;
  };
  set('Tempo', `${d.bpm.toFixed(1)} bpm (land ${d.baseBpm.toFixed(0)}, heading for ${d.targetBpm.toFixed(0)})`);
  set('Bar, beat', `${d.bar + 1} · ${d.beat + 1}${d.resolving ? ' · resolving' : ''}`);
  set('Key', `${d.key}, ${d.scale}`);
  set('Chord', d.chord);
  set('Notes', d.notes);
  set('Land', d.lead);
  set('Intensity', d.intensity.toFixed(2));
  set('Voices', `${d.voices} of ${VOICE_LIMIT} (peak ${d.voicePeak}, refused ${d.dropped})`);
  set('Nodes', `${d.nodes} live (${d.fixedNodes} fixed)`);
  set('Cost', `${cost.mean.toFixed(2)} ms a frame (worst ${cost.worst.toFixed(1)})`);
  for (const name of LANDS) {
    const bar = weightBars[name];
    const w = d.weights[name] ?? 0;
    if (!bar) continue;
    bar.fill.style.width = `${(w * 100).toFixed(0)}%`;
    bar.text.textContent = w.toFixed(2);
  }
  for (const id in chips) chips[id as LayerId]?.classList.toggle('on', d.layers[id as LayerId].on);
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  step(dt);
  draw();
  readPanel(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// For the checks: what the page is doing, and the scripted offline scenes.
Object.assign(window, {
  __audioDemo: {
    contextState: (): string => context?.state ?? 'none',
    debug: () => (audio ? { ...audio.debug() } : null),
    cost: () => ({ mean: cost.mean, worst: cost.worst }),
    player,
    teleport,
  },
  __audioLab: { run: runScene },
});
