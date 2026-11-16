// The opening lab's page: it plays the film and swaps the way its picture is made. A cut names the way that
// draws each part (cuts.ts); page/player.ts loads those ways, stacks their canvases and fades one into the next
// at the seam, page/lab.ts is the controls under the film, and page/watch.ts plays it as a player would see it.
//
// In the address: `?cut=plates|drawn|cutout|engine|mix-drawn|mix-cutout`, `?t=12.5` (hold the film at that
// second), `?shot=friends&p=0.8` (hold it that share of the way through a shot), `?voice=a` (the take of
// Hobb), `?quality=low|medium|high|ultra`, `?panel=0` (no controls), `?watch=1` (as a player, with Begin).
//
// Keys: Space plays and pauses, the arrows step a shot (with Shift, a second), 1 to 6 pick a cut at the same
// moment, W words, M sound, F watch as a player, Esc back.
//
// `window.__opening` lets a script wait for the page (`ready`), jump (`seek`), play, pause, switch the cut
// (`setCut`, which resolves once the new cut is on screen), read the time (`time()`) and `stats()`.
import type { Quality } from '../../src/engine/types.ts';
import { CUTS, type CutName } from './cuts.ts';
import { TITLE, makeFilm } from './film.ts';
import { CUT_NAMES, createLab } from './page/lab.ts';
import './page/page.css';
import { createPlayer } from './page/player.ts';
import { createWatch } from './page/watch.ts';
import { VOICES, loadSoundtrack } from './sound/index.ts';
import type { ShotId } from './types.ts';

const query = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const clamp = (x: number) => Math.max(0, Math.min(1, x));

const asked = query.get('cut') ?? 'plates';
const cutName: CutName = asked in CUTS ? (asked as CutName) : 'plates';
const quality = (query.get('quality') ?? 'high') as Quality;
const voice = VOICES.some((v) => v.id === query.get('voice')) ? (query.get('voice') as string) : VOICES[0].id;

const sound = await loadSoundtrack({ voice });
const film = makeFilm(sound.voiceSeconds);

const title = $('title');
(title.querySelector('small') as HTMLElement).textContent = TITLE.eyebrow;
(title.querySelector('b') as HTMLElement).textContent = TITLE.name;

// The film's words wait for their faces, so the first picture is the right one.
await Promise.all([document.fonts.load('700 20px Nunito'), document.fonts.load('650 40px Fraunces')]).catch(() => undefined);

const player = await createPlayer({ film, sound, quality, cut: cutName, stage: $('stage'), say: $('say'), title });

/** Keeps the address in step with the page, so a link opens what is on screen. */
function address(change: Record<string, string | null>) {
  for (const [k, v] of Object.entries(change)) v === null ? query.delete(k) : query.set(k, v);
  history.replaceState(null, '', `?${query}`);
}

const watch = createWatch(player, $('view'), () => { address({ watch: null }); lab.wake(); });
const lab = createLab(player, $('lab'), {
  voices: VOICES,
  voice,
  onVoice: (id) => { query.set('voice', id); query.set('t', state.t.toFixed(2)); query.delete('shot'); location.search = query.toString(); },
  onWatch: () => { address({ watch: '1' }); watch.enter(); },
});
const state = player.state;

function setCut(name: CutName) {
  address({ cut: name });
  return player.setCut(name);
}

new ResizeObserver(() => player.resize()).observe($('stage'));

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (watch.key(e)) { e.preventDefault(); return; }
  const target = e.target as Element;
  if (target.closest('select')) return;
  const onControl = target.closest('button, input');
  const n = film.at(Math.min(state.t, film.length - 0.001)).n;
  const k = e.key.toLowerCase();
  if (e.key === ' ' && !onControl) { e.preventDefault(); if (state.playing) player.pause(); else player.play(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); player.seek(e.shiftKey ? state.t + 1 : (film.shots[n + 1]?.at ?? state.t)); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); player.seek(e.shiftKey ? state.t - 1 : film.shots[Math.max(0, n - 1)].at); }
  else if (/^[1-6]$/.test(e.key)) void setCut(CUT_NAMES[Number(e.key) - 1]);
  else if (k === 'w') player.setWords(!state.words);
  else if (k === 'm') player.setSound(!state.sound);
  else if (k === 'f') { address({ watch: '1' }); watch.enter(); }
  else return;
  lab.wake();
});
window.addEventListener('keyup', (e) => { if (watch.key(e)) e.preventDefault(); });
$('stage').addEventListener('click', () => {
  if (watch.active) return;
  if (state.playing) player.pause();
  else player.play();
});

const held = query.get('shot') as ShotId | null;
if (held && film.shot(held)) player.seek(film.shot(held).at + film.shot(held).len * clamp(Number(query.get('p') ?? 0.5)));
else if (query.has('t')) player.seek(Number(query.get('t')));
if (query.get('panel') === '0') document.body.classList.add('bare');
if (query.get('watch') === '1') watch.enter();

declare global { interface Window { __opening?: unknown } }
window.__opening = {
  ready: true,
  film,
  get cut() { return state.cut; },
  get playing() { return state.playing; },
  time: () => state.t,
  seek: player.seek,
  play: player.play,
  pause: player.pause,
  setCut,
  stats: player.stats,
  failures: player.failures,
};
