// Experiment A: a short scene of act 1 with every line voiced ahead of time. The words type in time
// with the voice, from the character times ElevenLabs returned (audio/lines.json). A click or Space
// shows the whole line, the next one moves on; R plays the line again.
import { CAST } from '../cast.ts';
import { SCENES, COMPARE, type SceneLine } from './lines.ts';
import { createBox, portrait, useBook } from '../ui/book.ts';
import made from '../audio/lines.json';

interface Made {
  file: string;
  seconds: number;
  reveal: number[];
  model: string;
}
const LINES = made.lines as Record<string, Made>;
const CLIPS = made.compare as Record<string, Made>;

const BACKDROPS: Record<string, string> = { stone: 'stone', granary: 'square', field: 'field', square: 'square', bank: 'bank' };
/** Letters a second for lines nobody voices. */
const NARRATOR_CPS = 42;
/** Pause after a voiced line before auto-advance moves on, in seconds. */
const BEAT = 0.7;

const stage = document.getElementById('stage')!;
useBook(stage);
const box = createBox(stage);
const audio = new Audio();
audio.preload = 'auto';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const auto = $<HTMLInputElement>('auto');
const meta = $('meta');

let sceneAt = 0, lineAt = 0;
/** When the current line started, on the page clock, for unvoiced lines. */
let lineStart = 0;
/** The line is fully shown: a press moves on. */
let whole = false;
let endedAt = 0;
let started = false;

const scene = () => SCENES[sceneAt];
const line = (): SceneLine => scene().lines[lineAt];
const key = () => `${scene().id}-${lineAt}`;

function splitCue(text: string): [string, string] {
  const cue = text.match(/^\([^)]*\)\s*/)?.[0] ?? '';
  return [cue, text.slice(cue.length)];
}

// --- the scene buttons ------------------------------------------------------------
const nav = $('scenes');
SCENES.forEach((s, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn';
  b.textContent = `${i + 1}. ${s.title}`;
  b.onclick = (e) => (e.stopPropagation(), go(i, 0));
  nav.append(b);
});
function markScene(): void {
  [...nav.children].forEach((b, i) => (b as HTMLElement).setAttribute('aria-pressed', String(i === sceneAt)));
  $('backdrop').style.backgroundImage = `url(/backdrops/${BACKDROPS[scene().id]}.jpg)`;
}

// --- one line ------------------------------------------------------------------------
function present(): void {
  const l = line();
  whole = false;
  endedAt = 0;
  lineStart = performance.now();
  audio.pause();
  box.choices.hidden = true;
  box.choices.replaceChildren();
  if (l.by === 'narrator') {
    box.speaker(null);
    meta.textContent = 'Narration, not voiced';
  } else if (l.by === 'player') {
    box.speaker('You', [2, 2]);
    box.show('', '', 0);
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span class="gb-dialogue-key">1</span>';
    b.append(l.text);
    b.onclick = (e) => (e.stopPropagation(), next());
    li.append(b);
    box.choices.append(li);
    box.choices.hidden = false;
    whole = true;
    endedAt = performance.now();
    meta.textContent = 'Your choice';
  } else {
    const who = CAST[l.by];
    box.speaker(who.name, who.portrait);
    const m = LINES[key()];
    audio.src = `/audio/${m.file}`;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    meta.textContent = `${m.model}, ${m.seconds.toFixed(1)} s`;
  }
  box.waiting(whole);
  measure();
}

/** How much of the line shows now. Voiced lines follow the audio clock. */
function tick(): void {
  requestAnimationFrame(tick);
  if (!started) return;
  const l = line();
  if (l.by === 'player') {
    if (whole && auto.checked && endedAt && performance.now() - endedAt > 1800) next();
    return;
  }
  const [cue, body] = splitCue(l.text);
  let shown = body.length;
  if (!whole) {
    if (l.by === 'narrator') {
      shown = Math.min(body.length, Math.floor(((performance.now() - lineStart) / 1000) * NARRATOR_CPS));
      if (shown >= body.length) finish();
    } else {
      const m = LINES[key()];
      const reveal = m.reveal;
      // If the audio has not started 1.5 s in (blocked autoplay, a failed load), the words keep time on their own.
      const stalled = audio.currentTime === 0 && performance.now() - lineStart > 1500;
      const t = stalled ? (performance.now() - lineStart) / 1000 - 1.5 : audio.currentTime;
      if (stalled) meta.textContent = 'The audio did not start. Words only.';
      shown = 0;
      while (shown < body.length && reveal[cue.length + shown] <= t) shown++;
      if (audio.ended || (stalled && t >= m.seconds)) finish();
    }
  }
  box.show(cue, body, shown);
  const hold = l.by === 'narrator' ? 1600 : l.by === 'player' ? 1800 : BEAT * 1000;
  if (whole && auto.checked && endedAt && performance.now() - endedAt > hold) next();
}

function finish(): void {
  whole = true;
  endedAt = performance.now();
  box.waiting(true);
}

/** A press: show the whole line, or move on when it is whole. */
function advance(): void {
  if (!started) return;
  if (!whole) {
    finish();
    endedAt = auto.checked ? performance.now() + 2500 : 0; // a skipped line holds a moment longer
    return;
  }
  next();
}

function next(): void {
  if (lineAt + 1 < scene().lines.length) return go(sceneAt, lineAt + 1);
  if (sceneAt + 1 < SCENES.length) return go(sceneAt + 1, 0);
  audio.pause();
  meta.textContent = 'The end. Pick a scene to play it again.';
  endedAt = 0;
}

function go(s: number, l: number): void {
  sceneAt = s;
  lineAt = l;
  markScene();
  present();
}

function replay(): void {
  if (started) present();
}

/** The bottom of the screen the box takes, so the key card sits above it. */
function measure(): void {
  const top = box.pane.getBoundingClientRect().top;
  stage.style.setProperty('--box-h', `${Math.max(0, innerHeight - top)}px`);
}
addEventListener('resize', measure);

// --- input --------------------------------------------------------------------------
box.root.addEventListener('click', advance);
$('skip').onclick = (e) => (e.stopPropagation(), advance());
$('replay').onclick = (e) => (e.stopPropagation(), replay());
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.repeat || !started) return;
  if (e.code === 'Space' || e.code === 'Enter') (e.preventDefault(), advance());
  else if (e.code === 'KeyR') replay();
  else if (e.code === 'Digit1' && line().by === 'player') next();
  else if (e.code === 'Escape') $('compare').hidden = true;
});
$('play').onclick = () => {
  $('start').hidden = true;
  started = true;
  go(0, 0);
};

// --- compare models ----------------------------------------------------------------------
const compareRows = $('compare-rows');
const preview = new Audio();
for (const { scene: id, index } of COMPARE) {
  const l = SCENES.find((s) => s.id === id)!.lines[index];
  if (l.by === 'narrator' || l.by === 'player') continue;
  const row = document.createElement('div');
  row.className = 'compare-row';
  const face = document.createElement('div');
  face.className = 'face';
  face.append(portrait(CAST[l.by].portrait));
  const body = document.createElement('div');
  body.innerHTML = `<p><span class="who"></span> <span class="said"></span></p><div class="models"></div>`;
  body.querySelector('.who')!.textContent = `${CAST[l.by].name}:`;
  body.querySelector('.said')!.textContent = l.say;
  const models = body.querySelector('.models')!;
  const clips: [string, Made][] = [
    ['v3 + tags', LINES[`${id}-${index}`]],
    ['v4 + tags', CLIPS[`${id}-${index}-v4`]],
    ['v4 Turbo', CLIPS[`${id}-${index}-v4turbo`]],
    ['Flash v2.5', CLIPS[`${id}-${index}-flash`]],
  ];
  for (const [label, clip] of clips) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.innerHTML = `▶ ${label} <small>${clip.seconds.toFixed(1)} s</small>`;
    b.onclick = () => {
      audio.pause();
      preview.src = `/audio/${clip.file}`;
      preview.play().catch(() => {});
    };
    models.append(b);
  }
  row.append(face, body);
  compareRows.append(row);
}
$('compare-open').onclick = (e) => (e.stopPropagation(), audio.pause(), ($('compare').hidden = false));
$('compare-close').onclick = () => (preview.pause(), ($('compare').hidden = true));

// The opening frame: the first scene's backdrop behind the start card.
markScene();
box.speaker(CAST.tamsin.name, CAST.tamsin.portrait);
box.show('', SCENES[0].lines[0].text, 0);
measure();
requestAnimationFrame(tick);

/** For checks in headless Chrome. */
(window as any).__scene = {
  state: () => ({ scene: scene().id, line: lineAt, whole, playing: !audio.paused, time: audio.currentTime, text: box.text.textContent }),
  go: (s: number, l: number) => (($('start').hidden = true), (started = true), go(s, l)),
  advance,
};
