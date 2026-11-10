// The demo's control panel: plain DOM. It only calls the hooks it is given and shows what `read` returns.
import type { EffectId } from '../../src/content/effects.ts';
import type { WeatherKind } from '../../src/content/weather.ts';
import type { GameEvent } from '../../src/engine/events.ts';
import type { Ambient, Quality, Surface, Vec3 } from '../../src/engine/types.ts';
import type { PostCost, PostSettings } from '../../src/features/post/index.ts';
import type { DemoState, ViewName } from './main.ts';

export interface PanelReading {
  ambient: Ambient;
  counters: { calls: number; triangles: number; geometries: number; textures: number; particles: number };
  budget: number;
  clock: string;
  moon: string;
  weather: string;
  extras: string;
  motes: number;
  rainbow: number;
  moonPhase: number;
  thunder: string;
  canvas: string;
  post: Readonly<PostSettings> | null;
  postCost: PostCost | null;
  quality: Quality;
  view: ViewName;
  kind: WeatherKind | null;
  machine: boolean;
  features: boolean;
  fx: EffectId | '';
}

export interface PanelHooks {
  kinds: { id: WeatherKind; name: string }[];
  effects: EffectId[];
  surfaces: Surface[];
  read(): PanelReading;
  apply(state: DemoState): void;
  playEffect(id: EffectId): void;
  strike(): void;
  emit(event: GameEvent): void;
  eventSpot(): Vec3;
  pondSpot(): Vec3;
  costs(): Readonly<Record<keyof PostSettings, string>> | null;
}

export interface Panel {
  readonly root: HTMLElement;
  /** Shows the current numbers. */
  sync(): void;
}

type AmbientKey = keyof Ambient;
const SLIDERS: { key: AmbientKey; label: string; max: number }[] = [
  { key: 'timeOfDay', label: 'Time', max: 1 },
  { key: 'rain', label: 'Rain', max: 1 },
  { key: 'cloud', label: 'Cloud', max: 1 },
  { key: 'fog', label: 'Fog', max: 1 },
  { key: 'wind', label: 'Wind', max: 1 },
  { key: 'windDir', label: 'Wind dir', max: 6.28 },
  { key: 'wetness', label: 'Wetness', max: 1 },
  { key: 'flash', label: 'Flash', max: 1 },
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function buildPanel(root: HTMLElement, hooks: PanelHooks): Panel {
  const syncs: (() => void)[] = [];
  // One reading for each sync, shared by every control.
  let latest = hooks.read();
  const reading = () => latest;
  const section = (title: string) => {
    root.append(el('h2', title));
    const box = el('div');
    root.append(box);
    return box;
  };
  const row = (parent: HTMLElement) => {
    const box = el('div', '', 'row');
    parent.append(box);
    return box;
  };
  const button = (parent: HTMLElement, label: string, onClick: (event: MouseEvent) => void, isOn?: () => boolean, title = '') => {
    const node = el('button', label);
    node.type = 'button';
    if (title) node.title = title;
    node.addEventListener('click', onClick);
    if (isOn) syncs.push(() => node.classList.toggle('on', isOn()));
    parent.append(node);
    return node;
  };
  const slider = (parent: HTMLElement, label: string, max: number, step: number, get: () => number, set: (value: number) => void) => {
    const wrap = el('label', '', 'slider');
    const input = el('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(max);
    input.step = String(step);
    const out = el('output');
    wrap.append(el('span', label), input, out);
    input.addEventListener('input', () => set(Number(input.value)));
    syncs.push(() => {
      const value = get();
      if (document.activeElement !== input) input.value = String(value);
      out.textContent = value.toFixed(step >= 1 ? 0 : 2);
    });
    parent.append(wrap);
  };
  const check = (parent: HTMLElement, label: string, title: string, get: () => boolean, set: (value: boolean) => void) => {
    const wrap = el('label', '', 'check');
    const input = el('input');
    input.type = 'checkbox';
    wrap.title = title;
    wrap.append(input, el('span', label));
    input.addEventListener('change', () => set(input.checked));
    syncs.push(() => {
      input.checked = get();
    });
    parent.append(wrap);
    return input;
  };

  // ---- counters
  const stats = section('Cost of this frame');
  stats.className = 'stats';
  const stat = (label: string, value: () => string) => {
    const out = el('b');
    stats.append(el('span', label), out);
    syncs.push(() => {
      out.textContent = value();
    });
  };
  stat('Draw calls', () => String(reading().counters.calls));
  stat('Triangles', () => reading().counters.triangles.toLocaleString('en-US'));
  stat('Particles', () => `${reading().counters.particles} of ${reading().budget}`);
  stat('Geometries', () => String(reading().counters.geometries));
  stat('Textures', () => String(reading().counters.textures));
  stat('Canvas', () => reading().canvas);
  stat('Post passes', () => {
    const cost = reading().postCost;
    return cost ? `${cost.passes}, ${cost.screens.toFixed(2)} screens, ${cost.megabytes} MB` : 'off';
  });

  // ---- the clock and the weather
  const now = section('Sky now');
  now.className = 'stats';
  const line = (label: string, value: () => string) => {
    const out = el('b');
    now.append(el('span', label), out);
    syncs.push(() => {
      out.textContent = value();
    });
  };
  line('Clock', () => reading().clock);
  line('Moon', () => reading().moon);
  line('Weather', () => reading().weather);
  line('Also', () => reading().extras);
  line('Thunder', () => reading().thunder);

  // ---- Ambient by hand
  const sliders = section('Ambient numbers');
  for (const s of SLIDERS) {
    slider(sliders, s.label, s.max, 0.01, () => reading().ambient[s.key], (value) => hooks.apply(s.key === 'timeOfDay' ? { time: value } : { ambient: { [s.key]: value } }));
  }
  slider(sliders, 'Motes', 1, 0.01, () => reading().motes, (value) => hooks.apply({ motes: value }));
  slider(sliders, 'Rainbow', 1, 0.01, () => reading().rainbow, (value) => hooks.apply({ rainbow: value }));
  slider(sliders, 'Moon', 7, 1, () => reading().moonPhase, (value) => hooks.apply({ moonPhase: value }));
  sliders.append(el('p', 'Moving a slider takes the weather out of the machine’s hands.', 'note'));

  // ---- weather
  const weather = section('Weather');
  const kinds = row(weather);
  let asFront = false;
  for (const kind of hooks.kinds) button(kinds, kind.name, () => hooks.apply({ weather: kind.id, front: asFront }), () => reading().kind === kind.id);
  const machine = row(weather);
  machine.style.marginTop = '4px';
  button(machine, 'Run the machine at 20 times', () => hooks.apply({ machine: 20 }), () => reading().machine);
  button(machine, 'Lightning strike', () => hooks.strike());
  check(weather, 'Arrive as a front, over a minute', 'Off: the weather is there at once.', () => asFront, (value) => {
    asFront = value;
  });

  // ---- effects
  const effects = section('Effects');
  const plays = row(effects);
  for (const id of hooks.effects) {
    button(plays, id, (event) => (event.shiftKey ? hooks.apply({ fx: reading().fx === id ? '' : id }) : hooks.playEffect(id)), () => reading().fx === id, 'Click plays it once. Shift-click repeats it.');
  }
  effects.append(el('p', 'Game events, answered by effects.onEvent:', 'note'));
  const events = row(effects);
  const surface = el('select');
  for (const name of hooks.surfaces) surface.append(new Option(name, name));
  events.append(surface);
  const at = () => (surface.value === 'water' ? hooks.pondSpot() : hooks.eventSpot());
  button(events, 'Footstep', () => hooks.emit({ type: 'footstep', surface: surface.value as Surface, at: at() }));
  button(events, 'Land', () => hooks.emit({ type: 'land', surface: surface.value as Surface, at: at() }));
  button(events, 'Break', () => hooks.emit({ type: 'blockBroken', surface: surface.value as Surface, at: { ...hooks.eventSpot(), y: 0.5 } }));
  button(events, 'Place', () => hooks.emit({ type: 'blockPlaced', surface: surface.value as Surface, at: { ...hooks.eventSpot(), y: 0.5 } }));
  button(events, 'Pickup', () => hooks.emit({ type: 'pickup', at: { ...hooks.eventSpot(), y: 0.4 } }));

  // ---- quality and post
  const quality = section('Quality');
  const levels = row(quality);
  for (const level of ['low', 'medium', 'high'] as Quality[]) button(levels, level, () => hooks.apply({ quality: level }), () => reading().quality === level);

  const post = section('Final picture');
  const title = (key: keyof PostSettings) => hooks.costs()?.[key] ?? '';
  const switches: [keyof PostSettings, string][] = [['bloom', 'Bloom'], ['tiltShift', 'Far blur'], ['vignette', 'Vignette'], ['toneMapping', 'Tone map']];
  for (const [key, label] of switches) {
    check(post, label, title(key), () => reading().post?.[key] === true, (value) => hooks.apply({ post: { [key]: value } }));
  }
  slider(post, 'Size', 1, 0.05, () => reading().post?.renderScale ?? 1, (value) => hooks.apply({ post: { renderScale: Math.max(0.5, value) } }));
  slider(post, 'Samples', 4, 2, () => reading().post?.msaa ?? 0, (value) => hooks.apply({ post: { msaa: value } }));
  post.append(el('p', 'Hover a switch for what it costs. Everything off draws straight to the screen.', 'note'));

  // ---- views
  const views = section('View');
  const names = row(views);
  const labels: [ViewName, string][] = [['game', 'Game'], ['low', 'Horizon'], ['sun', 'Toward the sun'], ['pond', 'Pond'], ['fx', 'Effects']];
  for (const [name, label] of labels) button(names, label, () => hooks.apply({ view: name }), () => reading().view === name);
  let turn = 0;
  button(names, 'Turn', () => hooks.apply({ view: 'game', turn: ++turn }));
  const all = row(views);
  all.style.marginTop = '4px';
  button(all, 'Features on', () => hooks.apply({ features: true }), () => reading().features);
  button(all, 'Features off', () => hooks.apply({ features: false }), () => !reading().features);

  return {
    root,
    sync() {
      latest = hooks.read();
      for (const sync of syncs) sync();
    },
  };
}
