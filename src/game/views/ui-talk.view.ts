// Talking: the line `game.systems.talk.current()` holds, drawn in the dialogue box with the speaker's
// portrait and name. A click, Space, Enter or E shows the whole line and then moves on. A number key or a
// click picks a choice. Each letter that types out is a blip in the speaker's voice. This is the one
// file that touches src/features/dialogue.
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
import { NARRATOR_SPEED, VOICES } from '../uiview/voices.ts';

/** The flag the box writes the picked choice to. */
const PICKED = 'picked';
/** Pixels between the box and whatever sits above it. */
const BOX_GAP = 12;

const STYLE = /* css */ `
/* The box takes every click while it is open: a click anywhere moves the line on. */
.ui-book .gb-dialogue { padding: 0 16px max(24px, env(safe-area-inset-bottom, 0px)); font-size: 18px; line-height: 1.45; pointer-events: auto; }
.ui-book .gb-dialogue-box { width: min(780px, 100%); gap: 24px; padding: 30px 40px 30px 34px; zoom: var(--ui-size); animation: ui-talk-in 140ms var(--ui-ease); }
/* It moves but never fades, so the first line is readable from its first frame. */
@keyframes ui-talk-in { from { transform: translateY(8px); } }
/* A portrait is 128 pixels of pixel art, so it is drawn at exactly that, on a darker tile of paper as the Almanac's pictures are. */
.ui-book .gb-dialogue-portrait { width: 128px; height: 128px; border: 0; border-radius: 12px; background: var(--ui-paper-2); box-shadow: none; }
.ui-book .gb-dialogue-portrait > .gb-dialogue-initial { font-size: 56px; font-weight: 600; color: var(--ui-ink-2); }
.ui-book .gb-dialogue-body { gap: 8px; }
.ui-book .gb-dialogue-name { padding-bottom: 8px; font-size: 20px; font-weight: 650; letter-spacing: -0.015em; color: var(--ui-ink); border-bottom: 1px solid var(--ui-line); }
/* Room for three rows, so the box keeps its height from line to line. */
.ui-book .gb-dialogue-text { margin: 0; min-height: 4.35em; max-width: 58ch; text-wrap: pretty; }
.ui-book .gb-dialogue-choices { margin: 4px 0 0; gap: 8px; }
.ui-book .gb-dialogue-choices button { min-height: 44px; gap: 12px; padding: 4px 16px 4px 8px; color: var(--ui-ink); background: var(--ui-paper-2); border: 0; border-radius: var(--ui-radius); box-shadow: none; transition: transform 80ms var(--ui-ease); }
.ui-book .gb-dialogue-choices button:hover, .ui-book .gb-dialogue-choices button:focus-visible { background: var(--ui-paper-3); }
.ui-book .gb-dialogue-choices button:focus-visible { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
.ui-book .gb-dialogue-choices button:active { background: var(--ui-paper-4); transform: scale(0.99); box-shadow: none; }
/* The number of a choice, as a key cap. */
.ui-book .gb-dialogue-key { width: 26px; height: 26px; font-size: 14px; font-weight: 600; color: var(--ui-ink); background: var(--ui-paper-light); border: 0; border-radius: var(--ui-radius-sm); box-shadow: inset 0 0 0 1px var(--ui-line-strong), inset 0 -2px 0 var(--ui-line); }
.ui-book .gb-dialogue-more { right: 0; bottom: 0; border-top-color: var(--ui-ink-2); }
/* A line nobody says: no portrait and no name. */
.ui-book .gb-dialogue.is-narrator .gb-dialogue-box { grid-template-columns: minmax(0, 1fr); }
.ui-book .gb-dialogue.is-narrator .gb-dialogue-portrait, .ui-book .gb-dialogue.is-narrator .gb-dialogue-name { display: none; }
.ui-book .gb-dialogue.is-narrator .gb-dialogue-text { font-style: italic; min-height: 2.9em; }

@media (max-width: 560px) {
  .ui-book .gb-dialogue { padding: 0 8px max(8px, env(safe-area-inset-bottom, 0px)); font-size: 16px; }
  .ui-book .gb-dialogue-box { gap: 14px; padding: 18px 20px; zoom: 1; }
  .ui-book .gb-dialogue-portrait { width: 64px; height: 64px; }
  .ui-book .gb-dialogue-portrait > * { image-rendering: auto; }
  .ui-book .gb-dialogue-portrait > .gb-dialogue-initial { font-size: 32px; }
  .ui-book .gb-dialogue-name { font-size: 18px; padding-bottom: 6px; }
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
    box.start(conversation);
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

  game.events.on('talk.started', () => {
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
  });
}
