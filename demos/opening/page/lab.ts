// The lab's controls under the film: the shots to jump by and the scrub bar, play and the time, words, sound,
// Hobb's take, the way to watch it as a player, and the six cuts with their keys. They step out of the way
// while the film plays and come back when the pointer moves.
import { CUTS, type CutName } from '../cuts.ts';
import type { VoiceTake } from '../types.ts';
import { WAY_NAME, type Player } from './player.ts';

export const CUT_NAMES = Object.keys(CUTS) as CutName[];

/** Film time as m:ss.t, with steady digits so it does not jitter while it runs. */
export const clock = (t: number, tenths = true) => {
  const s = Math.max(0, t);
  const whole = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return tenths ? `${whole}.${Math.floor((s * 10) % 10)}` : whole;
};

const plateUrl = (name: string) => new URL(`../art/plates/${name}.jpg`, import.meta.url).href;

/** An element with these properties (className, type, title, value…) and children. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...kids);
  return node;
}

const ICON = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3.2" height="11" rx="0.8" fill="currentColor"/><rect x="9.3" y="2.5" width="3.2" height="11" rx="0.8" fill="currentColor"/></svg>',
  watch: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5.5V3a1 1 0 0 1 1-1h2.5M10.5 2H13a1 1 0 0 1 1 1v2.5M14 10.5V13a1 1 0 0 1-1 1h-2.5M5.5 14H3a1 1 0 0 1-1-1v-2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};

export interface Lab {
  readonly root: HTMLElement;
  /** Shows the controls and keeps them up for a while. */
  wake(): void;
}

export interface LabOptions {
  voices: readonly VoiceTake[];
  voice: string;
  onVoice(id: string): void;
  onWatch(): void;
}

export function createLab(player: Player, root: HTMLElement, o: LabOptions): Lab {
  const { film, state } = player;

  // The shots, each as wide as it lasts, with a small copy of its plate behind its number. The copies are drawn
  // once into small canvases, so the strip never asks the browser to shrink a full plate while the film plays.
  const strip = el('div', { className: 'strip' });
  strip.setAttribute('role', 'group');
  strip.setAttribute('aria-label', 'Jump to a shot');
  const shotButtons = film.shots.map((s) => {
    const thumb = el('canvas', { className: 'thumb', width: '192', height: '108' });
    thumb.setAttribute('aria-hidden', 'true');
    const img = new Image();
    img.onload = () => {
      const c = thumb.getContext('2d') as CanvasRenderingContext2D;
      c.imageSmoothingQuality = 'high';
      c.drawImage(img, 0, 0, thumb.width, thumb.height);
    };
    img.src = plateUrl(s.plate);
    const b = el('button', { type: 'button', className: 'shot', title: `${s.n + 1}. ${s.title}` }, thumb, el('span', { className: 'n' }, String(s.n + 1)), el('span', { className: 'name' }, s.title));
    b.style.flexGrow = String(s.len);
    b.setAttribute('aria-label', `Shot ${s.n + 1}, ${s.title}`);
    // Paused, a jump lands a little way in, where the picture is whole. Playing, it lands on the cut.
    b.onclick = () => player.seek(s.at + (state.playing ? 0 : Math.min(3, s.len * 0.55)));
    strip.append(b);
    return b;
  });
  // One line across the strip marks now. It only moves, so the browser slides it without repainting the strip.
  const head = el('div', { className: 'head' });
  head.setAttribute('aria-hidden', 'true');
  strip.append(head);
  const scrub = el('input', { type: 'range', className: 'scrub', min: '0', max: String(film.length), step: '0.05', value: '0' });
  scrub.setAttribute('aria-label', 'Where in the film');
  scrub.oninput = () => player.seek(Number(scrub.value));

  const play = el('button', { type: 'button', className: 'btn play', title: 'Play or pause (Space)' });
  play.onclick = () => (state.playing ? player.pause() : player.play());
  const now = el('span', { className: 'now' });
  const total = el('span', { className: 'total' }, `/ ${clock(film.length)}`);
  const where = el('span', { className: 'where' });
  const stats = el('span', { className: 'stats' });

  const toggle = (label: string, key: string, on: () => boolean, set: (v: boolean) => void) => {
    const b = el('button', { type: 'button', className: 'btn toggle', title: `${label} on or off (${key})` }, label);
    b.onclick = () => set(!on());
    return b;
  };
  const words = toggle('Words', 'W', () => state.words, player.setWords);
  const soundOn = toggle('Sound', 'M', () => state.sound, player.setSound);

  const take = el('select', { className: 'take' });
  take.setAttribute('aria-label', "Hobb's take");
  for (const v of o.voices) take.add(new Option(`Hobb: ${v.name}`, v.id, false, v.id === o.voice));
  take.disabled = o.voices.length < 2;
  take.onchange = () => o.onVoice(take.value);

  const watch = el('button', { type: 'button', className: 'btn watch', title: 'Watch it as a player would (F)' });
  watch.innerHTML = `${ICON.watch}<span>Watch as a player</span>`;
  watch.setAttribute('aria-label', 'Watch as a player');
  watch.onclick = o.onWatch;

  const about = el('p', { className: 'about' });
  const cuts = el('div', { className: 'cuts' });
  cuts.setAttribute('role', 'radiogroup');
  cuts.setAttribute('aria-label', 'The cut');
  let hover: CutName | null = null;
  const cutButtons = CUT_NAMES.map((name, i) => {
    const b = el('button', { type: 'button', className: 'cut', title: `${CUTS[name].about} (${i + 1})` }, el('kbd', {}, String(i + 1)), el('span', {}, CUTS[name].name));
    b.setAttribute('role', 'radio');
    b.dataset.cut = name;
    b.onclick = () => void player.setCut(name);
    b.onpointerenter = () => { hover = name; statsAt = 0; update(); };
    b.onpointerleave = () => { hover = null; statsAt = 0; update(); };
    cuts.append(b);
    return b;
  });

  root.replaceChildren(
    el('div', { className: 'timeline' }, strip, scrub),
    el('div', { className: 'row' }, play, el('span', { className: 'time' }, now, total), where, el('span', { className: 'gap' }), stats, words, soundOn, take, watch),
    cuts,
    about,
  );

  /** Writes text only when it changed, so a frame that changes nothing lays nothing out. */
  const write = (node: HTMLElement, text: string) => { if (node.textContent !== text) node.textContent = text; };
  const mark = (node: HTMLElement, name: string, value: string) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };

  let shotOn = -1;
  let statsAt = 0;
  let playing: boolean | null = null;
  let scrubbed = -1;
  let cutWas = '';
  function update() {
    const t = state.t;
    const shot = film.at(Math.min(t, film.length - 0.001));
    if (playing !== state.playing) {
      playing = state.playing;
      play.innerHTML = `${playing ? ICON.pause : ICON.play}<span>${playing ? 'Pause' : 'Play'}</span>`;
    }
    write(now, clock(t));
    head.style.transform = `translateX(${((t / film.length) * 100).toFixed(3)}%)`;
    // The scrub bar's thumb moves in steps of its own width anyway; a twentieth of a second is plenty.
    if (Math.abs(t - scrubbed) >= 0.05) { scrubbed = t; scrub.value = String(t); }
    if (shot.n !== shotOn) {
      shotOn = shot.n;
      shotButtons.forEach((b, n) => b.classList.toggle('on', n === shot.n));
      write(where, `${shot.n + 1} · ${shot.title}`);
    }
    mark(words, 'aria-pressed', String(state.words));
    mark(soundOn, 'aria-pressed', String(state.sound));
    for (const b of cutButtons) {
      const name = b.dataset.cut as CutName;
      mark(b, 'aria-checked', String(name === state.cut));
      if (b.classList.contains('loading') !== (name === state.next)) b.classList.toggle('loading');
    }
    // The stats change every frame, and a failure can come at any time; four times a second is enough for both.
    const ms = performance.now();
    const cutNow = `${state.cut}/${state.next}`;
    if (ms - statsAt < 250 && state.playing && cutNow === cutWas) return;
    cutWas = cutNow;
    statsAt = ms;
    const shown = hover ?? state.next ?? state.cut;
    const failed = player.failures();
    const bad = failed.length > 0 && shown === state.cut && !state.next;
    write(about, state.next && !hover
      ? `Loading ${CUTS[state.next].name}. ${CUTS[state.next].about}`
      : bad
        ? `${failed.map((f) => f.name).join(' and ')} did not load: ${failed[0].error}`
        : CUTS[shown].about);
    if (about.classList.contains('bad') !== bad) about.classList.toggle('bad');
    const list = Object.entries(player.stats()).filter(([, s]) => s) as [keyof typeof WAY_NAME, { drawCalls: number; triangles: number }][];
    write(stats, list.map(([way, s]) => `${list.length > 1 ? `${WAY_NAME[way]}: ` : ''}${s.drawCalls} draws · ${Math.round(s.triangles / 1000)}k tris`).join('  '));
    stats.title = list.length ? 'What the last frame cost: draw calls and triangles' : '';
  }
  player.onPaint(update);

  // Away while the film plays and nobody touches anything; back on any move.
  let idle = 0;
  function wake() {
    root.classList.remove('away');
    clearTimeout(idle);
    idle = window.setTimeout(() => {
      if (state.playing && !root.matches(':hover')) root.classList.add('away');
    }, 2500);
  }
  window.addEventListener('pointermove', wake, { passive: true });
  window.addEventListener('pointerdown', wake, { passive: true });
  player.onPaint(() => { if (!state.playing && root.classList.contains('away')) wake(); });
  root.addEventListener('focusin', wake);

  update();
  return { root, wake };
}
