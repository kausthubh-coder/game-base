// Talking: the line `game.systems.talk.current()` holds, drawn in the dialogue box with the speaker's
// portrait in the face the line asks for, and their name. A click, Space, Enter or E shows the whole line and then
// moves on. A number key or a click picks a choice. L opens the log of what was said. This is the one file that
// touches src/features/dialogue. The look is the approved mockup, assets-src/concept/interface/dialogue.webp and
// dialogue-phone.webp: the medallion with a diamond top and bottom, the name over a gold rule, the choices as
// outlined pills to the right on a wide screen and under the line on a phone, and the cues at the bottom right.
//
// A scene shown as a film (content/scenes.ts) takes the screen: black bars top and bottom, the HUD steps out, the
// line sits centred in the lower bar, and each line moves on by itself once it has been read. Esc skips the rest.
//
// A voiced line (one with a clip in public/assets/voice, made by tools/voice.ts) plays its clip on the sound
// engine's voice bus and types in time with it. Any other line, or a voiced one whose clip is not ready in
// time, types at the speaker's speed and each letter is a blip in their voice. Showing the whole line, moving
// on or picking a choice stops the clip, so one line never talks over the next.
//
// The talk system runs the conversation. The dialogue feature runs conversations of its own, so each
// line is handed to it as a conversation of one line: when the box says that one is over, the talk
// system is moved on (or told the choice), and its next line is handed over.
import { createDialogue, type Conversation, type Flags } from '../../features/dialogue/index.ts';
import type { TalkLine } from '../api.sim.ts';
import { sceneOf } from '../content/scenes.ts';
import type { GameView } from '../shell/view.ts';
import { splitCues } from '../talk/cues.sim.ts';
import { bookOf } from '../uiview/book.ts';
import { TALK_ADVANCE_CODES } from '../uiview/keys.ts';
import { addStyle, frame } from '../uiview/theme.ts';
import { createSpokenLines, type VoiceRecord } from '../uiview/spoken.ts';
import { NARRATOR_SPEED, VOICES } from '../uiview/voices.ts';
import type { Speech } from '../../features/audio/index.ts';

/** The flag the box writes the picked choice to. */
const PICKED = 'picked';
/** Pixels between the box and whatever sits above it. */
const BOX_GAP = 12;
/** How long a voiced line waits for its clip before it types at its speed instead. */
const CLIP_WAIT_MS = 800;
/** Records kept in `window.__voice.log`. */
const LOG_SIZE = 300;
/** In a film a line stays this long after it has typed, plus a little for each letter, then moves on by itself. */
const FILM_HOLD = 1.6, FILM_PER_LETTER = 0.035;
/** Whether keys and the log are open for each key code. */
const LOG_KEY = 'KeyL';

const STYLE = /* css */ `
/* The box takes every click while it is open: a click anywhere moves the line on. There is no box over the world:
   the bottom of the screen darkens, the name sits in gold over a fine rule, and the portrait is a round medallion. */
.ui-book .gb-dialogue { padding: 0 16px max(28px, env(safe-area-inset-bottom, 0px)); font-size: 19px; line-height: 1.5; pointer-events: auto; color: var(--ui-glass-ink); }
.ui-book .gb-dialogue::before { content: ''; position: absolute; inset: auto 0 0 0; height: min(46vh, 340px); background: linear-gradient(0deg, rgb(10 12 20 / 0.86), rgb(10 12 20 / 0.62) 45%, rgb(10 12 20 / 0)); pointer-events: none; }
.ui-book .gb-dialogue-box {
  width: min(880px, 100%); gap: 28px; padding: 12px 8px 4px; align-items: start;
  background: none; border: 0; outline: 0; box-shadow: none; border-radius: 0;
  zoom: var(--ui-size); animation: ui-talk-in 160ms var(--ui-ease);
}
/* It moves but never fades, so the first line is readable from its first frame. */
@keyframes ui-talk-in { from { transform: translateY(10px); } }
/* A portrait is 128 pixels of pixel art, drawn at 112 in a gold ring. */
.ui-book .gb-dialogue-portrait {
  width: 112px; height: 112px; border: 0; border-radius: 50%;
  background: radial-gradient(80% 80% at 35% 25%, #f8f3e8, var(--ui-paper-3));
  box-shadow: 0 0 0 3px var(--ui-gold), 0 0 0 5px rgb(22 26 38 / 0.6), 0 0 0 6px rgb(211 188 142 / 0.5), 0 8px 20px rgb(0 0 0 / 0.45);
}
.ui-book .gb-dialogue-portrait > * { image-rendering: auto; }
.ui-book .gb-dialogue-portrait > .gb-dialogue-initial { font-family: var(--ui-display); font-size: 52px; font-weight: 650; color: var(--ui-ink); }
.ui-book .gb-dialogue-body { gap: 10px; }
.ui-book .gb-dialogue-name {
  position: relative; justify-self: start; padding: 0 0 8px; font-family: var(--ui-display); font-size: 24px; font-weight: 650; letter-spacing: 0.01em;
  color: var(--ui-gold-bright); border: 0; text-shadow: 0 1px 3px rgb(0 0 0 / 0.7);
}
.ui-book .gb-dialogue-name::after { content: ''; position: absolute; left: 0; bottom: 0; width: max(100%, 240px); height: 1px; background: linear-gradient(90deg, var(--ui-gold), rgb(211 188 142 / 0)); }
/* Room for three rows, so the box keeps its height from line to line. */
.ui-book .gb-dialogue-text { margin: 0; min-height: 4.5em; max-width: 60ch; font-weight: 600; text-wrap: pretty; text-shadow: 0 1px 3px rgb(0 0 0 / 0.7); }
.ui-book .gb-dialogue-choices { justify-items: start; margin: 6px 0 0; gap: 8px; }
.ui-book .gb-dialogue-choices li { width: min(100%, 460px); }
.ui-book .gb-dialogue-choices button {
  min-height: 46px; gap: 12px; padding: 4px 22px 4px 6px; color: var(--ui-glass-ink); font-weight: 700; text-shadow: 0 1px 2px rgb(0 0 0 / 0.5);
  background: linear-gradient(90deg, rgb(22 26 38 / 0.85), rgb(43 50 69 / 0.7)); border: 0; border-radius: 999px;
  box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.5); transition: transform 100ms var(--ui-ease), box-shadow 120ms var(--ui-ease);
}
.ui-book .gb-dialogue-choices button:hover, .ui-book .gb-dialogue-choices button:focus-visible { background: linear-gradient(90deg, rgb(43 50 69 / 0.95), rgb(74 83 102 / 0.85)); box-shadow: inset 0 0 0 1.5px var(--ui-gold-bright), 0 0 14px rgb(240 212 138 / 0.35); transform: translateX(4px); }
.ui-book .gb-dialogue-choices button:focus-visible { outline: none; }
.ui-book .gb-dialogue-choices button:active { transform: translateX(4px) scale(0.99); }
/* The number of a choice, in a gold disc. */
.ui-book .gb-dialogue-key { width: 34px; height: 34px; font-size: 14px; font-weight: 800; color: var(--ui-night); background: radial-gradient(80% 80% at 35% 25%, var(--ui-gold-bright), var(--ui-gold)); border: 0; border-radius: 50%; text-shadow: none; box-shadow: 0 0 0 1px var(--ui-bronze); }
.ui-book .gb-dialogue-more { right: 4px; bottom: -2px; border-top-color: var(--ui-gold-bright); filter: drop-shadow(0 0 4px rgb(240 212 138 / 0.8)); }
/* A line nobody says: no portrait and no name, set in italic in the middle. */
.ui-book .gb-dialogue.is-narrator .gb-dialogue-box { grid-template-columns: minmax(0, 1fr); text-align: center; }
.ui-book .gb-dialogue.is-narrator .gb-dialogue-portrait, .ui-book .gb-dialogue.is-narrator .gb-dialogue-name { display: none; }
.ui-book .gb-dialogue.is-narrator .gb-dialogue-text { justify-self: center; font-family: var(--ui-display); font-style: italic; font-weight: 500; min-height: 2.9em; }


/* ---- the mockup: the medallion set with a diamond top and bottom, the face clipped round inside it ---- */
.ui-book .gb-dialogue::before { height: min(52vh, 380px); background: linear-gradient(0deg, rgb(20 24 38 / 0.94), rgb(22 27 42 / 0.82) 42%, rgb(22 27 42 / 0)); }
.ui-book .gb-dialogue-portrait { overflow: visible; position: relative; }
.ui-book .gb-dialogue-portrait > * { border-radius: 50%; overflow: hidden; }
.ui-book .gb-dialogue-portrait::before, .ui-book .gb-dialogue-portrait::after {
  content: ''; position: absolute; left: 50%; width: 11px; height: 11px; margin-left: -5.5px;
  background: linear-gradient(135deg, var(--ui-gold-bright), var(--ui-gold) 60%, var(--ui-bronze));
  transform: rotate(45deg); box-shadow: 0 0 0 1.5px rgb(22 26 38 / 0.8), 0 0 6px rgb(240 212 138 / 0.5);
}
.ui-book .gb-dialogue-portrait::before { top: -11px; }
.ui-book .gb-dialogue-portrait::after { bottom: -11px; }
/* The name's rule ends in a small diamond, as on the phone mockup. */
.ui-book .gb-dialogue-name::before {
  content: ''; position: absolute; left: min(60%, 180px); bottom: -3.5px; width: 7px; height: 7px;
  border: 1.2px solid var(--ui-gold); background: rgb(22 26 38); transform: rotate(45deg);
}
/* Choices: outlined pills with a diamond, not numbered discs. On a wide screen they stand to the right of the line. */
.ui-book .gb-dialogue-choices button {
  min-height: 48px; padding: 4px 26px 4px 20px; gap: 16px; font-weight: 700;
  background: linear-gradient(180deg, rgb(30 36 54 / 0.78), rgb(22 26 38 / 0.86));
  box-shadow: inset 0 0 0 1.5px rgb(211 188 142 / 0.85), 0 2px 8px rgb(0 0 0 / 0.3);
}
.ui-book .gb-dialogue-choices button:hover, .ui-book .gb-dialogue-choices button:focus-visible {
  box-shadow: inset 0 0 0 2px var(--ui-gold-bright), 0 0 18px rgb(240 212 138 / 0.35);
}
.ui-book .gb-dialogue-key {
  width: 12px; height: 12px; flex: none; font-size: 0; color: transparent; border-radius: 1px; transform: rotate(45deg);
  background: transparent; box-shadow: inset 0 0 0 1.5px var(--ui-gold-bright);
}
.ui-book .gb-dialogue-choices button:hover .gb-dialogue-key, .ui-book .gb-dialogue-choices button:focus-visible .gb-dialogue-key {
  background: var(--ui-gold-bright); box-shadow: 0 0 8px rgb(240 212 138 / 0.8);
}
@media (min-width: 980px) {
  .ui-book .gb-dialogue-box { width: min(1240px, 100%); }
  .ui-book .gb-dialogue.has-choices .gb-dialogue-body { grid-template-columns: minmax(0, 1fr) minmax(300px, 420px); column-gap: 48px; align-items: center; }
  .ui-book .gb-dialogue-name, .ui-book .gb-dialogue-text { grid-column: 1; }
  .ui-book .gb-dialogue-choices { grid-column: 2; grid-row: 1 / span 2; margin: 0; align-self: center; }
  .ui-book .gb-dialogue-choices li { width: 100%; }
}
/* The cues at the bottom right: keycaps and one verb each (rule 9 of the look). */
.ui-talk-cues {
  position: absolute; right: max(24px, env(safe-area-inset-right, 0px)); bottom: max(10px, env(safe-area-inset-bottom, 0px)); z-index: 1;
  display: flex; gap: 22px; align-items: center; pointer-events: auto;
}
.ui-talk-cue {
  display: inline-flex; align-items: center; gap: 8px; padding: 0; min-height: 32px;
  font: 700 15px / 1 var(--ui-font); color: var(--ui-paper-light, #f6f1e7); text-shadow: 0 1px 2px rgb(0 0 0 / 0.6);
  background: none; border: 0; cursor: pointer;
}
.ui-talk-cue kbd {
  display: inline-grid; place-items: center; min-width: 30px; height: 28px; padding: 0 8px; font: 800 13px / 1 var(--ui-font); color: var(--ui-night);
  background: radial-gradient(90% 90% at 35% 25%, var(--ui-gold-bright), var(--ui-gold)); border-radius: 7px; box-shadow: 0 0 0 1px var(--ui-bronze), 0 2px 4px rgb(0 0 0 / 0.4);
}
.ui-talk-cue:hover { color: var(--ui-gold-bright); }
.ui-talk-cue:focus-visible { outline: 2px solid var(--ui-gold-bright); outline-offset: 3px; border-radius: 4px; }
.ui-book .gb-dialogue.has-choices .ui-talk-continue { visibility: hidden; }
/* Choices reach lower than a line: the box keeps the cues' row under them, so no choice runs into Log. */
.ui-book .gb-dialogue.has-choices { padding-bottom: max(56px, env(safe-area-inset-bottom, 0px)); }
@media (pointer: coarse) { .ui-talk-cue kbd { display: none; } }

/* ---- the log: what was said, on night glass down the right side ---- */
.ui-talk-log {
  position: absolute; top: 0; right: 0; bottom: 0; z-index: 40; width: min(460px, 100%); box-sizing: border-box;
  display: flex; flex-direction: column; padding: 22px 0 18px; pointer-events: auto; cursor: default;
  background: linear-gradient(270deg, rgb(20 24 38 / 0.96), rgb(22 27 42 / 0.9)); box-shadow: -1px 0 0 rgb(211 188 142 / 0.5), -12px 0 30px rgb(0 0 0 / 0.4);
  color: var(--ui-glass-ink); animation: ui-log-in 200ms var(--ui-ease);
}
.ui-talk-log[hidden] { display: none; }
@keyframes ui-log-in { from { transform: translateX(12px); } }
.ui-talk-log-head { display: flex; align-items: center; gap: 12px; padding: 0 22px 12px; border-bottom: 1px solid rgb(211 188 142 / 0.35); }
.ui-talk-log-title { margin: 0; flex: 1; font: 650 22px / 1.2 var(--ui-display); color: var(--ui-gold-bright); }
.ui-talk-log-close {
  width: 40px; height: 40px; border-radius: 50%; border: 0; cursor: pointer; font: 700 18px / 1 var(--ui-font); color: var(--ui-paper-light, #f6f1e7);
  background: rgb(43 50 69 / 0.9); box-shadow: inset 0 0 0 1.5px var(--ui-gold);
}
.ui-talk-log-close:hover, .ui-talk-log-close:focus-visible { box-shadow: inset 0 0 0 2px var(--ui-gold-bright), 0 0 10px rgb(240 212 138 / 0.4); outline: none; }
.ui-talk-log-list { flex: 1; overflow-y: auto; margin: 0; padding: 14px 22px; list-style: none; display: grid; align-content: start; gap: 12px; scrollbar-color: rgb(211 188 142 / 0.35) transparent; }
.ui-talk-log-list li { display: grid; gap: 2px; font-size: 16px; line-height: 1.45; font-weight: 600; }
.ui-talk-log-who { font: 650 15px / 1.2 var(--ui-display); color: var(--ui-gold); }
.ui-talk-log-said.is-narrator { font-family: var(--ui-display); font-style: italic; font-weight: 500; opacity: 0.85; }
.ui-talk-log-chose { display: inline-flex; align-items: center; gap: 8px; color: var(--ui-gold-bright); font-weight: 700; }
.ui-talk-log-chose::before { content: ''; width: 8px; height: 8px; background: var(--ui-gold-bright); transform: rotate(45deg); }

/* ---- a film: the bars, the line centred in the lower one, and nothing else on screen ---- */
/* The bars sit under the dialogue's layer (30) and the top one, with Skip, over it. */
.ui-talk-bars { position: absolute; inset: 0; pointer-events: none; }
.ui-talk-bars[hidden] { display: none; }
.ui-talk-bar { position: absolute; left: 0; right: 0; height: clamp(56px, 12vh, 128px); background: oklch(0.1 0.012 60); animation: ui-bar-in 380ms var(--ui-ease); }
.ui-talk-bar-top { top: 0; z-index: 31; display: flex; align-items: center; justify-content: flex-end; padding: 0 clamp(16px, 4vw, 48px); }
.ui-talk-bar-bottom { bottom: 0; z-index: 29; height: clamp(120px, 22vh, 200px); }
@keyframes ui-bar-in { from { transform: scaleY(0); } }
/* A memory or a dream: the picture between the bars washed warm and soft at the edges, as if remembered. */
.ui-talk-bars.is-memory::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(70% 62% at 50% 46%, rgb(255 236 190 / 0.1), rgb(240 212 138 / 0.34) 72%, rgb(196 150 84 / 0.55));
  mix-blend-mode: soft-light; animation: ui-memory-in 900ms var(--ui-ease);
}
@keyframes ui-memory-in { from { opacity: 0; } }
.ui-talk-skip { pointer-events: auto; }
.ui-book.ui-filming .gb-dialogue::before { display: none; }
.ui-book.ui-filming .gb-dialogue { padding-bottom: max(22px, env(safe-area-inset-bottom, 0px)); }
.ui-book.ui-filming .gb-dialogue-box { grid-template-columns: minmax(0, 1fr); width: min(900px, 100%); text-align: center; gap: 0; animation: none; }
.ui-book.ui-filming .gb-dialogue-portrait { display: none; }
.ui-book.ui-filming .gb-dialogue-name { justify-self: center; font-size: 18px; padding-bottom: 4px; }
.ui-book.ui-filming .gb-dialogue-name::after, .ui-book.ui-filming .gb-dialogue-name::before { display: none; }
.ui-book.ui-filming .gb-dialogue-text, .ui-book .gb-dialogue.is-narrator .gb-dialogue-text { text-align: center; }
.ui-book.ui-filming .gb-dialogue-text { justify-self: center; min-height: 3em; font-family: var(--ui-display); font-style: italic; font-weight: 500; color: oklch(0.93 0.035 85); }
.ui-book.ui-filming .ui-talk-continue { display: none; }
.ui-book.ui-filming .gb-hud, .ui-book.ui-filming .gb-beacon, .ui-book.ui-filming .gu-top, .ui-book.ui-filming .gu-toasts,
.ui-book.ui-filming .gu-prompt, .ui-book.ui-filming .marks, .ui-book.ui-filming .st-gift, .ui-book.ui-filming .ui-playtest,
.ui-book.ui-filming .ui-experiment { visibility: hidden; }

@media (max-width: 560px) {
  .ui-book .gb-dialogue { padding: 0 10px max(10px, env(safe-area-inset-bottom, 0px)); font-size: 16px; }
  .ui-book .gb-dialogue-box { gap: 14px; padding: 8px 4px 4px; zoom: 1; }
  .ui-book .gb-dialogue-portrait { width: 60px; height: 60px; }
  .ui-book .gb-dialogue-portrait > .gb-dialogue-initial { font-size: 30px; }
  .ui-book .gb-dialogue-name { font-size: 19px; padding-bottom: 6px; }
  .ui-book .gb-dialogue-text { min-height: 5.8em; }
  /* The phone mockup: the medallion and the name in a row, the line and the choices full width under them. */
  .ui-book .gb-dialogue-box { grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "face name" "body body"; row-gap: 14px; padding-bottom: 36px; }
  .ui-book .gb-dialogue-portrait { grid-area: face; width: 76px; height: 76px; }
  .ui-book .gb-dialogue-body { display: contents; }
  .ui-book .gb-dialogue-name { grid-area: name; align-self: center; }
  .ui-book .gb-dialogue-text, .ui-book .gb-dialogue-choices { grid-column: 1 / -1; }
  .ui-book .gb-dialogue-text { min-height: 3em; }
  .ui-book .gb-dialogue-choices li { width: 100%; }
  .ui-book .gb-dialogue.is-narrator .gb-dialogue-box { grid-template-areas: "body"; }
  .ui-talk-cues { right: 14px; bottom: 6px; gap: 16px; }
  .ui-talk-cue { font-size: 13.5px; }
}
@media (prefers-reduced-motion: reduce) {
  .ui-book .gb-dialogue-box, .ui-talk-log, .ui-talk-bar { animation: none; }
  .ui-book .gb-dialogue-choices button { transition: none; }
}
`;

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game, root } = view;
  const { sys, art } = book;
  const talk = sys.talk;
  if (!talk) return;
  addStyle(root, 'talk', STYLE);

  /** The line in the box. The talk system hands out the same object until the line changes. */
  let shown: TalkLine | null = null;
  /** True while this view closes the box itself, so the box's "it ended" is not read as the player moving on. */
  let closing = false;
  /** True for the rest of the key press or click that opened the conversation, so it does not also skip the first line. */
  let opening = false;
  /** The quick slot held when the conversation began. A number key picks a choice, not a slot, until it ends. */
  let slotBefore = 0;

  // ---- the voiced lines
  const spoken = createSpokenLines(new URL('assets/', document.baseURI).href);
  /** The clip speaking now. */
  let speech: Speech | null = null;
  /** What happened to the voiced line showing now. */
  let record: VoiceRecord | null = null;
  /** Counts up for every line shown and every skip, so a clip that loads too late for its line is dropped. */
  let turn = 0;
  const log: VoiceRecord[] = [];
  window.__voice = { log, elapsed: () => (speech && !speech.ended ? speech.elapsed() : null) };

  /** Stops the clip speaking now, if any, and drops one still loading. */
  function hush(): void {
    turn++;
    if (record?.status === 'loading') record.status = 'stopped';
    if (speech && !speech.ended) {
      speech.stop();
      if (record?.status === 'playing') record.status = 'stopped';
    }
    speech = null;
  }

  /** Plays the line's clip and types the box in time with it. A line with no clip is left to type and blip. */
  function voice(line: TalkLine): void {
    const found = line.npc ? spoken.clip(line.npc, line.text) : null;
    // A clip made for other words (an old list) would type the wrong letters, so it is not played.
    const clip = found && found.reveal.length === line.text.length ? found : null;
    record = null;
    if (!clip) return;
    const entry: VoiceRecord = { key: `${line.npc}|${line.text}`, file: clip.file, status: 'loading', seconds: clip.seconds, lastLetter: (clip.reveal.at(-1) ?? 0) / 1000 };
    record = entry;
    if (log.push(entry) > LOG_SIZE) log.shift();
    const audio = view.audio;
    if (!audio) {
      entry.status = 'silent';
      return;
    }
    const mine = turn;
    // Nothing types until the clip starts: below 0 the box waits.
    // The box shows the line without its stage cues, so each letter shown takes the time of its own letter in the clip.
    const keep = splitCues(line.text).keep;
    box.follow(keep.length === clip.reveal.length ? clip.reveal : keep.map((i) => clip.reveal[i] ?? 0), () => (speech ? speech.elapsed() : -1));
    const late = setTimeout(() => {
      if (mine !== turn || speech) return;
      turn++;
      entry.status = audio.live ? 'late' : 'silent';
      box.follow(null);
    }, CLIP_WAIT_MS);
    /** Starts the clip once the engine's clock runs: the key that opened the talk may have only just started it. */
    const begin = (buffer: AudioBuffer): void => {
      if (mine !== turn) return;
      if (!audio.live) {
        setTimeout(() => begin(buffer), 30);
        return;
      }
      clearTimeout(late);
      speech = audio.speak(buffer);
      if (speech) entry.status = 'playing';
      else {
        entry.status = 'silent';
        box.follow(null);
      }
    };
    void spoken.decoded(clip, audio, (status) => { entry.http = status; }).then((buffer) => {
      if (buffer) entry.decoded = buffer.duration;
      if (mine !== turn) return;
      if (!buffer) {
        clearTimeout(late);
        entry.status = 'failed';
        box.follow(null);
        return;
      }
      begin(buffer);
    });
  }

  const flags: Flags = {};
  const box = createDialogue(view.ctx, {
    parent: root,
    flags,
    charsPerSecond: NARRATOR_SPEED,
    // The keys come through here, so Space never reaches the shell as a jump and E is the shell's own "use" key.
    advanceKeys: [],
    // The box keeps one picture for each key. The key carries the name too, so two villagers who share
    // a portrait name, and have no portrait, each get their own initial.
    // The key is `face|portrait|name`: the line's face if the manifest has it, else the plain portrait.
    portrait: (key) => {
      const [face = '', plain = ''] = key.split('|');
      return art.portraitElement(face) ?? art.portraitElement(plain);
    },
    onCharacter(letter, voice) {
      const spec = VOICES[voice];
      if (spec) view.audio?.emit({ type: 'talk', voice: spec, char: letter });
    },
    onSkip: hush,
    onEnd() {
      if (closing) return;
      const line = shown;
      shown = null;
      if (!line || !talk.active) return;
      // The box finished its one line: move the real conversation on, then show where it went.
      if (line.choices.length > 0) talk.choose(Number(flags[PICKED] ?? 0));
      else talk.advance();
      sync();
    },
  });
  const pane = box.element.querySelector<HTMLElement>('.gb-dialogue-box');
  frame(pane);

  /** Keeps the bottom of the screen clear for the box: toasts and hints sit above it while it is open. */
  const measure = (): void => {
    const top = box.isOpen && pane ? pane.getBoundingClientRect().top : NaN;
    root.style.setProperty('--ui-talk-clear', Number.isFinite(top) ? `${Math.max(0, Math.ceil(root.clientHeight - top + BOX_GAP))}px` : '0px');
  };
  if (pane && typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(pane);

  function present(line: TalkLine): void {
    const conversation: Conversation = {
      id: 'line',
      start: 'line',
      speakers: {
        speaker: { name: line.name, voice: line.voice, portrait: `${line.face}|${line.portrait}|${line.name}`, speed: VOICES[line.voice]?.speed ?? NARRATOR_SPEED },
      },
      lines: {
        line: {
          who: 'speaker',
          // A stage cue is acted by the stage view, never printed.
          text: splitCues(line.text).shown,
          choices: line.choices.map((text, index) => ({ text, do: [{ set: PICKED, to: index }] })),
        },
      },
    };
    box.element.classList.toggle('is-narrator', line.name === '');
    box.element.classList.toggle('has-choices', line.choices.length > 0);
    film(line.kind === 'film');
    bars.classList.toggle('is-memory', line.kind === 'film' && sceneOf(line.scene)?.memory === true);
    held = 0;
    hush();
    box.start(conversation);
    voice(line);
  }

  let wasOpen = false;
  /** Brings the box in line with the talk system: the same line, another line, or closed. */
  function sync(): void {
    const line = talk?.active ? talk.current() : null;
    if (line !== shown) {
      shown = line;
      if (line) {
        present(line);
      } else if (box.isOpen) {
        hush();
        closing = true;
        box.close();
        closing = false;
      }
    }
    if (box.isOpen === wasOpen) return;
    wasOpen = box.isOpen;
    root.classList.toggle('ui-talking', wasOpen);
    if (!wasOpen) {
      film(false);
      showLog(false);
    }
    measure();
  }

  // ---- the cues: keycaps and a verb, bottom right
  const cues = document.createElement('div');
  cues.className = 'ui-talk-cues';
  cues.innerHTML = /* html */ `
    <button type="button" class="ui-talk-cue ui-talk-log-open" data-key="talk:log"><kbd>L</kbd> Log</button>
    <span class="ui-talk-cue ui-talk-continue"><kbd>E</kbd> Continue</span>`;
  box.element.append(cues);
  cues.addEventListener('click', (event) => event.stopPropagation());
  cues.querySelector('.ui-talk-log-open')!.addEventListener('click', () => showLog(!logOpen));

  // ---- the log of what was said
  const logPanel = document.createElement('aside');
  logPanel.className = 'ui-talk-log';
  logPanel.dataset.key = 'talk-log';
  logPanel.hidden = true;
  logPanel.setAttribute('aria-label', 'What was said');
  logPanel.innerHTML = /* html */ `
    <div class="ui-talk-log-head"><h2 class="ui-talk-log-title">What was said</h2><button type="button" class="ui-talk-log-close" data-key="talk-log:close" aria-label="Close">×</button></div>
    <ol class="ui-talk-log-list"></ol>`;
  root.append(logPanel);
  const logList = logPanel.querySelector<HTMLElement>('.ui-talk-log-list')!;
  logPanel.addEventListener('click', (event) => event.stopPropagation());
  logPanel.querySelector('.ui-talk-log-close')!.addEventListener('click', () => showLog(false));

  let logOpen = false;
  function showLog(open: boolean): void {
    if (open === logOpen) return;
    logOpen = open;
    logPanel.hidden = !open;
    if (!open) return;
    logList.replaceChildren(...talk!.log().map((entry) => {
      const item = document.createElement('li');
      if (entry.name) {
        const who = document.createElement('span');
        who.className = 'ui-talk-log-who';
        who.textContent = entry.name;
        item.append(who);
      }
      const text = document.createElement('span');
      text.className = `ui-talk-log-said${entry.name ? '' : ' is-narrator'}`;
      text.textContent = splitCues(entry.text).shown;
      item.append(text);
      if (entry.chose) {
        const chose = document.createElement('span');
        chose.className = 'ui-talk-log-chose';
        chose.textContent = entry.chose;
        item.append(chose);
      }
      return item;
    }));
    logList.scrollTop = logList.scrollHeight;
    view.game.events.emit('ui.sound', { sound: 'click' });
  }

  // ---- a film: the bars, the HUD away, the lines moving on by themselves
  const bars = document.createElement('div');
  bars.className = 'ui-talk-bars';
  bars.hidden = true;
  bars.innerHTML = /* html */ `
    <div class="ui-talk-bar ui-talk-bar-top"><button class="sf-skip ui-talk-skip" type="button" data-key="talk:skip">Skip <kbd>Esc</kbd></button></div>
    <div class="ui-talk-bar ui-talk-bar-bottom"></div>`;
  root.append(bars);
  bars.querySelector('.ui-talk-skip')!.addEventListener('click', (event) => {
    event.stopPropagation();
    skipFilm();
  });
  /** Seconds the line on screen has been fully shown, in a film. */
  let held = 0;
  let filming = false;

  function film(on: boolean): void {
    if (on === filming) return;
    filming = on;
    bars.hidden = !on;
    root.classList.toggle('ui-filming', on);
  }

  function skipFilm(): void {
    if (!filming || !talk?.active) return;
    hush();
    talk.skip();
    view.game.events.emit('ui.sound', { sound: 'click' });
    sync();
  }

  /** What a click does: the whole line, then the next one. */
  function advance(): void {
    if (box.isOpen && !opening && !logOpen) box.advance();
  }

  game.events.on('talk.started', (e) => {
    spoken.prepare(e.conversation);
    slotBefore = sys.inventory?.selected ?? 0;
    opening = true;
    setTimeout(() => { opening = false; }, 0);
    // The talk system sends this just before it sets its first line, so look once it has.
    queueMicrotask(sync);
  });
  game.events.on('talk.ended', sync);

  // L opens and closes the log, Esc closes it or skips a film. In the capture phase, before the shell's own keys.
  window.addEventListener('keydown', (event) => {
    if (!box.isOpen || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.code === LOG_KEY) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showLog(!logOpen);
    } else if (event.code === 'Escape' && (logOpen || filming)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (logOpen) showLog(false);
      else skipFilm();
    }
  }, { capture: true });

  // E is the shell's key for "use and talk", so it is heard where the shell sends it.
  view.keys.onPress((press) => {
    if (!box.isOpen) return;
    if (press.kind === 'interact') advance();
    // The shell has just picked a quick slot with the number key. In a conversation the number is for a choice.
    else if ((press.kind === 'slot' || press.kind === 'slotStep') && sys.inventory) sys.inventory.selected = slotBefore;
  });

  // Space and Enter. In the capture phase, so the shell never holds Space as a jump that fires when the talk ends.
  window.addEventListener('keydown', (event) => {
    if (!box.isOpen || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!TALK_ADVANCE_CODES.includes(event.code)) return;
    event.stopImmediatePropagation();
    // On a choice that has the focus, the key presses that button as it would any other.
    if (event.target instanceof HTMLElement && event.target.closest('[data-choice]')) return;
    event.preventDefault();
    if (!event.repeat) advance();
  }, { capture: true });

  view.onFrame((dt) => {
    // A load, or anything else that ends a conversation without the event, is caught here.
    sync();
    box.update(dt, view.ctx);
    // A film moves on by itself once the line has been read, unless a voice is still saying it.
    if (filming && box.isOpen && !box.typing && shown && shown.choices.length === 0 && !logOpen && !(speech && !speech.ended)) {
      held += dt;
      if (held >= FILM_HOLD + shown.text.length * FILM_PER_LETTER) {
        held = 0;
        box.advance();
      }
    }
    if (speech && record) {
      if (record.typedAt === undefined && !box.typing && record.status === 'playing') record.typedAt = speech.elapsed();
      if (speech.ended && record.status === 'playing') record.status = 'ended';
    }
  });
}
