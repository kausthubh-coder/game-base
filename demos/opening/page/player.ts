// The film on the stage: the clock, the sound, and the cut that draws the picture. A cut can change while the
// film plays; the new cut's ways load behind the old one, then take its place at the same film time, and the
// sound never stops. A way that fails to load says so on the stage, by name, for the shots it should draw.
import type { Quality } from '../../../src/engine/types.ts';
import { CUTS, WAYS, type CutName } from '../cuts.ts';
import { TITLE } from '../film.ts';
import { SEAM, type Film, type FilmRenderer, type Shot, type ShotId, type Soundtrack, type Way } from '../types.ts';

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (p: number) => p * p * (3 - 2 * p);

/** What each way is called on the page. */
export const WAY_NAME: Record<Way, string> = { plates: CUTS.plates.name, drawn: CUTS.drawn.name, cutout: CUTS.cutout.name, engine: CUTS.engine.name };

/** A run of shots drawn by one way. The same run with the same wall is loaded once and kept for the next switch. */
interface Layer {
  key: string;
  way: Way;
  shots: Shot[];
  from: number;
  to: number;
  renderer?: FilmRenderer;
  ready: boolean;
  error?: string;
  loading: Promise<void>;
}

export interface PlayerState {
  t: number;
  playing: boolean;
  words: boolean;
  sound: boolean;
  cut: CutName;
  /** The cut being loaded to take over, if any. */
  next: CutName | null;
}

export interface Player {
  readonly film: Film;
  readonly state: Readonly<PlayerState>;
  play(): void;
  pause(): void;
  seek(t: number): void;
  setCut(name: CutName): Promise<void>;
  setWords(on: boolean): void;
  setSound(on: boolean): void;
  /** What each way of the cut on screen says its last frame cost, or null for a way that does not count. */
  stats(): Record<string, { drawCalls: number; triangles: number } | null>;
  /** The ways of the cut on screen that failed, with why. */
  failures(): { way: Way; name: string; error: string }[];
  /** The way drawing the picture at film time t. */
  wayAt(t: number): Way;
  /** Called after every paint. */
  onPaint(fn: () => void): void;
  /** The stage changed size. */
  resize(): void;
}

export interface PlayerOptions {
  film: Film;
  sound: Soundtrack;
  quality: Quality;
  cut: CutName;
  stage: HTMLElement;
  say: HTMLElement;
  title: HTMLElement;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e)) || 'unknown error';

export async function createPlayer(o: PlayerOptions): Promise<Player> {
  const { film, sound, stage } = o;
  const state: PlayerState = { t: 0, playing: false, words: true, sound: true, cut: o.cut, next: null };
  const cache = new Map<string, Layer>();
  const listeners: (() => void)[] = [];
  let layers: Layer[] = [];
  let last = 0;
  let token = 0;

  // One card on the stage tells when the way that should be drawing has not loaded or broke.
  const notice = document.createElement('div');
  notice.className = 'notice';
  notice.hidden = true;
  stage.insertBefore(notice, o.say);

  function layerFor(way: Way, shots: Shot[], wall?: Layer): Layer {
    const key = `${way}:${shots[0].id}-${shots[shots.length - 1].id}${wall ? `:wall=${wall.key}` : ''}`;
    const cached = cache.get(key);
    if (cached && !cached.error) return cached;
    const layer: Layer = { key, way, shots, from: shots[0].at, to: shots[shots.length - 1].at + shots[shots.length - 1].len, ready: false, loading: Promise.resolve() };
    layer.loading = (async () => {
      try {
        if (wall) await wall.loading;
        const legend = wall?.ready ? wall.renderer : undefined;
        const renderer = (await WAYS[way]()).create(film, {
          quality: o.quality,
          wall: legend?.panel ? (id: ShotId) => legend.panel?.(id) ?? null : undefined,
        });
        layer.renderer = renderer;
        renderer.canvas.classList.add('way');
        renderer.canvas.dataset.way = way;
        await renderer.load(shots);
        layer.ready = true;
      } catch (e) {
        layer.error = message(e);
        console.error(`opening: the way "${way}" (${WAY_NAME[way]}) failed to load:`, e);
      }
    })();
    cache.set(key, layer);
    return layer;
  }

  /** The layers that draw a cut: one per way, the legend's first, since in a mix the next way hangs its panels. */
  function layersOf(name: CutName): Layer[] {
    const parts = CUTS[name].parts;
    const out: Layer[] = [];
    for (const way of new Set(parts)) {
      const shots = film.shots.filter((s) => parts[s.part] === way);
      const wall = way !== parts[0] ? out[0] : undefined;
      out.push(layerFor(way, shots, wall));
    }
    return out;
  }

  function mount(next: Layer[]) {
    // A canvas stays on the stage once it has been there, hidden while its cut is not on screen: taking it off
    // and putting it back made the browser rebuild its layer, which held the film for 200 ms at every switch.
    for (const l of layers) if (!next.includes(l) && l.renderer) l.renderer.canvas.style.opacity = '0';
    next.forEach((l, i) => {
      if (!l.renderer) return;
      if (!l.renderer.canvas.isConnected) stage.insertBefore(l.renderer.canvas, notice);
      // Later layers lie over earlier ones, so the next way fades in over the one before.
      l.renderer.canvas.style.zIndex = String(i + 1);
    });
    for (const l of layers) if (!next.includes(l) && l.renderer) l.renderer.canvas.style.zIndex = '0';
    layers = next;
    resize();
  }

  function resize() {
    const box = stage.getBoundingClientRect();
    for (const l of layers) if (l.ready) l.renderer?.resize?.(box.width, box.height, window.devicePixelRatio);
  }

  function paint() {
    const t = Math.min(state.t, film.length - 0.001);
    let showing: Layer | undefined;
    layers.forEach((l, i) => {
      const lastLayer = i === layers.length - 1;
      const on = t >= l.from && t < l.to + (lastLayer ? 0 : SEAM);
      if (t >= l.from && t < l.to) showing = l;
      const canvas = l.renderer?.canvas;
      if (!canvas) return;
      const drawing = on && l.ready && !l.error;
      canvas.style.opacity = drawing ? String(i === 0 ? 1 : ease(clamp((t - l.from) / SEAM))) : '0';
      if (!drawing) return;
      try {
        l.renderer?.draw(t);
      } catch (e) {
        l.error = message(e);
        console.error(`opening: the way "${l.way}" (${WAY_NAME[l.way]}) failed while drawing:`, e);
      }
    });
    notice.hidden = !showing || (showing.ready && !showing.error);
    if (showing && !notice.hidden) {
      notice.replaceChildren();
      const b = document.createElement('b');
      b.textContent = showing.error ? `${WAY_NAME[showing.way]} did not load` : `Loading ${WAY_NAME[showing.way]}…`;
      notice.append(b);
      if (showing.error) {
        const p = document.createElement('span');
        p.textContent = showing.error;
        notice.append(p);
      }
    }

    const shot = film.at(t);
    const tl = t - shot.at;
    const spoken = sound.voiceSeconds[shot.id];
    if (o.say.textContent !== shot.say) {
      // A new line cuts in and the old one is gone at once: fading out, it would show the new words for a moment.
      o.say.classList.add('cut');
      o.say.classList.remove('on');
      o.say.textContent = shot.say;
      void o.say.offsetWidth;
      o.say.classList.remove('cut');
    }
    o.say.classList.toggle('on', state.words && tl >= film.lead && tl < (spoken ? film.lead + spoken + 0.5 : shot.len - 0.8));
    o.title.classList.toggle('on', shot.id === TITLE.shot && tl >= shot.beats[TITLE.beat]);
    for (const fn of listeners) fn();
  }

  function tick(now: number) {
    if (!state.playing) return;
    state.t = Math.min(film.length, state.t + (now - last) / 1000);
    last = now;
    if (state.t >= film.length) {
      state.playing = false;
      sound.stop();
    }
    paint();
    if (state.playing) requestAnimationFrame(tick);
  }

  const player: Player = {
    film,
    state,
    play() {
      if (state.playing) return;
      if (state.t >= film.length) state.t = 0;
      state.playing = true;
      last = performance.now();
      if (state.sound) sound.play(film, state.t);
      requestAnimationFrame(tick);
      paint();
    },
    pause() {
      state.playing = false;
      sound.stop();
      paint();
    },
    seek(t) {
      state.t = Math.max(0, Math.min(film.length, t));
      if (state.playing && state.sound) sound.play(film, state.t);
      paint();
    },
    async setCut(name) {
      if (!(name in CUTS)) throw new Error(`no cut "${name}"; the cuts are ${Object.keys(CUTS).join(', ')}`);
      const mine = ++token;
      const next = layersOf(name);
      state.next = name === state.cut && next.every((l) => layers.includes(l)) ? null : name;
      paint();
      await Promise.all(next.map((l) => l.loading));
      if (mine !== token) return;
      state.cut = name;
      state.next = null;
      mount(next);
      paint();
    },
    setWords(on) {
      state.words = on;
      paint();
    },
    setSound(on) {
      state.sound = on;
      if (state.playing && on) sound.play(film, state.t);
      else sound.stop();
      paint();
    },
    stats() {
      return Object.fromEntries(layers.map((l) => [l.way, (l.ready && l.renderer?.stats?.()) || null]));
    },
    failures() {
      return layers.filter((l) => l.error).map((l) => ({ way: l.way, name: WAY_NAME[l.way], error: l.error as string }));
    },
    wayAt(t) {
      return CUTS[state.cut].parts[film.at(t).part];
    },
    onPaint(fn) {
      listeners.push(fn);
    },
    resize() {
      resize();
      paint();
    },
  };
  await player.setCut(o.cut);
  return player;
}
