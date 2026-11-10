// The demo's control panel: plain DOM. It only calls the hooks it is given and shows what `read` returns.
import type { Ambient, Quality } from '../../src/engine/types.ts';
import type { PropsStats } from '../../src/features/props/index.ts';
import type { DemoState, ViewName } from './main.ts';

export interface PanelReading {
  ambient: Ambient;
  counters: { calls: number; triangles: number };
  stats: PropsStats;
  quality: Quality;
  roofs: boolean;
  glow: number;
  lights: number;
  canvas: string;
}

export interface PanelHooks {
  mode: 'world' | 'turntable' | 'sheet';
  kinds: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  /** The kind or group this page shows, or '' on the world page. */
  current: string;
  read(): PanelReading;
  apply(state: DemoState): void;
  /** Runs the draw-call and triangle counts and returns them as text. */
  measure(): string;
}

export interface Panel {
  readonly root: HTMLElement;
  /** Shows the current numbers. */
  sync(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const clock = (time: number) => {
  const minutes = Math.round(time * 24 * 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

export function buildPanel(root: HTMLElement, hooks: PanelHooks): Panel {
  const syncs: (() => void)[] = [];
  const heading = (text: string) => root.append(el('h2', text));

  // ---- the counts
  heading('This frame');
  const stats = el('div', '', 'stats');
  root.append(stats);
  const rows: [string, (r: PanelReading) => string][] = [
    ['Draw calls', (r) => String(r.counters.calls)],
    ['Triangles', (r) => r.counters.triangles.toLocaleString('en')],
    ['Props placed', (r) => r.stats.placed.toLocaleString('en')],
    ['Props drawn', (r) => r.stats.drawn.toLocaleString('en')],
    ['Prop draw calls', (r) => `${r.stats.drawCalls} + ${r.stats.shadowCalls} for shadows`],
    ['Prop triangles', (r) => `${r.stats.triangles.toLocaleString('en')} + ${r.stats.shadowTriangles.toLocaleString('en')}`],
    ['Cells in view', (r) => `${r.stats.cellsInView} of ${r.stats.cells}`],
    ['Lit props', (r) => `${r.lights}, ${r.glow > 0.5 ? 'lit' : r.glow > 0 ? 'coming on' : 'dark'}`],
    ['Canvas', (r) => r.canvas],
  ];
  for (const [name, value] of rows) {
    const out = el('b');
    stats.append(el('span', name), out);
    syncs.push(() => (out.textContent = value(hooks.read())));
  }

  // ---- wind and the time of day
  heading('Wind and time');
  const slider = (name: string, max: number, get: (a: Ambient) => number, set: (value: number) => DemoState, show: (value: number) => string) => {
    const row = el('label', '', 'slider');
    const input = el('input');
    input.type = 'range';
    input.min = '0';
    input.max = String(max);
    input.step = String(max / 200);
    const out = el('output');
    row.append(el('span', name), input, out);
    root.append(row);
    input.addEventListener('input', () => hooks.apply(set(Number(input.value))));
    syncs.push(() => {
      const value = get(hooks.read().ambient);
      if (document.activeElement !== input) input.value = String(value);
      out.textContent = show(value);
    });
  };
  slider('Wind', 1, (a) => a.wind, (wind) => ({ wind }), (v) => v.toFixed(2));
  slider('Wind from', 6.28, (a) => a.windDir, (windDir) => ({ windDir }), (v) => `${Math.round((v * 180) / Math.PI)}°`);
  slider('Time', 1, (a) => a.timeOfDay, (time) => ({ time }), clock);

  const buttons = (items: [string, DemoState][], isOn?: (state: DemoState, r: PanelReading) => boolean) => {
    const row = el('div', '', 'row');
    for (const [name, state] of items) {
      const button = el('button', name);
      button.addEventListener('click', () => hooks.apply(state));
      if (isOn) syncs.push(() => button.classList.toggle('on', isOn(state, hooks.read())));
      row.append(button);
    }
    root.append(row);
  };
  buttons([['Dawn', { time: 0.26 }], ['Day', { time: 0.42 }], ['Dusk', { time: 0.76 }], ['Night', { time: 0.92 }]]);

  heading('Quality');
  buttons([['Low', { quality: 'low' }], ['Medium', { quality: 'medium' }], ['High', { quality: 'high' }]], (state, r) => state.quality === r.quality);

  if (hooks.mode === 'world') {
    heading('Camera');
    const views: [string, ViewName][] = [['Village', 'village'], ['Forest edge', 'forest'], ['Pond rim', 'pond'], ['Everything', 'whole']];
    buttons(views.map(([name, view]) => [name, { view }]));
    root.append(el('p', 'Q and E turn a quarter. Z and X or the wheel zoom. WASD or the arrows move.', 'note'));

    heading('Buildings');
    buttons([['Roofs on', { roofs: true }], ['Roofs off', { roofs: false }]], (state, r) => state.roofs === r.roofs);

    heading('Cost');
    const run = el('button', 'Count the scene and a forest of 2,000');
    const result = el('pre', '', 'note');
    result.style.whiteSpace = 'pre-wrap';
    run.addEventListener('click', () => (result.textContent = hooks.measure()));
    root.append(run, result);
  }

  // ---- the other pages
  heading('Look at one');
  const pick = (label: string, items: { id: string; name: string }[], param: string) => {
    const select = el('select');
    select.append(new Option(label, ''));
    for (const item of items) select.append(new Option(item.name, item.id, false, item.id === hooks.current));
    select.addEventListener('change', () => {
      if (select.value) location.search = `?${param}=${select.value}`;
    });
    return select;
  };
  const row = el('div', '', 'row');
  row.append(pick('A prop on the turntable', hooks.kinds, 'only'), pick('A contact sheet', hooks.groups, 'sheet'));
  if (hooks.mode !== 'world') {
    const back = el('a', 'Back to the world');
    back.href = './';
    row.append(back);
  }
  root.append(row);

  const sync = () => {
    for (const s of syncs) s();
  };
  return { root, sync };
}
