// Talking: the line `game.systems.talk.current()` holds, drawn in the dialogue box with the speaker's
// portrait and name. A click, Space, Enter or E shows the whole line and then moves on. A number key or a
// click picks a choice. This is the one file that touches src/features/dialogue.
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
import type { GameView } from '../shell/view.ts';
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

@media (max-width: 560px) {
  .ui-book .gb-dialogue { padding: 0 10px max(10px, env(safe-area-inset-bottom, 0px)); font-size: 16px; }
  .ui-book .gb-dialogue-box { gap: 14px; padding: 8px 4px 4px; zoom: 1; }
  .ui-book .gb-dialogue-portrait { width: 60px; height: 60px; }
  .ui-book .gb-dialogue-portrait > .gb-dialogue-initial { font-size: 30px; }
  .ui-book .gb-dialogue-name { font-size: 19px; padding-bottom: 6px; }
  .ui-book .gb-dialogue-text { min-height: 5.8em; }
}
@media (prefers-reduced-motion: reduce) {
  .ui-book .gb-dialogue-box { animation: none; }
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
    box.follow(clip.reveal, () => (speech ? speech.elapsed() : -1));
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
    portrait: (key) => art.portraitElement(key.split('|')[0] ?? ''),
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
        speaker: { name: line.name, voice: line.voice, portrait: `${line.portrait}|${line.name}`, speed: VOICES[line.voice]?.speed ?? NARRATOR_SPEED },
      },
      lines: {
        line: {
          who: 'speaker',
          text: line.text,
          choices: line.choices.map((text, index) => ({ text, do: [{ set: PICKED, to: index }] })),
        },
      },
    };
    box.element.classList.toggle('is-narrator', line.name === '');
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
    measure();
  }

  /** What a click does: the whole line, then the next one. */
  function advance(): void {
    if (box.isOpen && !opening) box.advance();
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
    if (speech && record) {
      if (record.typedAt === undefined && !box.typing && record.status === 'playing') record.typedAt = speech.elapsed();
      if (speech.ended && record.status === 'playing') record.status = 'ended';
    }
  });
}
