// The dialogue box: a strip at the bottom with a portrait and a name. The line types out a letter
// at a time. A click or a key shows the whole line, and the next one moves on. Up to three choices
// appear under the line once it is typed.
//
// While it is open the box owns the keys and the screen: it listens for its own keys and a click
// anywhere advances it. The game should stop reading input for that time (the input feature's
// 'talk' mode does that).
import './dialogue.css';
import type { Bus, GameEvent } from '../../engine/events.ts';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import { Talk, Typewriter, isVoiced, type Conversation, type Flags, type Said, type Speaker } from './dialogue.sim.ts';

export interface DialogueOptions {
  /** Where the box goes. The page body by default. */
  parent?: HTMLElement;
  /** The game's flags. Conversations read and change this object. The box keeps its own when none is given. */
  flags?: Flags;
  /** Called for each letter and digit as it appears, with the speaker's voice. Hand it to the sound engine. Letters skipped by a click are not reported. */
  onCharacter?: (letter: string, voiceId: string) => void;
  /** Called when a line starts. */
  onLine?: (said: Said) => void;
  /** Called when the player shows the whole line early or moves on: a click, a key, a pad button or a choice. Stop a spoken clip here. */
  onSkip?: () => void;
  /** Called when a conversation ends, after its last effects. */
  onEnd?: (conversation: Conversation, flags: Flags) => void;
  /** A picture for a speaker: a canvas, an image or any element. Return null for the drawn initial. */
  portrait?: (key: string, speaker: Speaker) => HTMLElement | null;
  /** Letters a second for a speaker with no speed of their own. 32 by default. */
  charsPerSecond?: number;
  /** The keys that show the whole line and move on, as `KeyboardEvent.code`. Enter, Space and F by default. A function is asked each time, so it can follow rebound keys. */
  advanceKeys?: readonly string[] | (() => readonly string[]);
  /** Open and close sounds go here as `ui` events. */
  bus?: Bus<GameEvent>;
}

export interface DialogueView extends ViewSystem {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
  readonly flags: Flags;
  /** The line showing now, or null. */
  readonly current: Said | null;
  /** True while the line is still typing out. */
  readonly typing: boolean;
  /** Opens the box on a conversation. Returns false when the conversation has nothing to say with the flags as they are. */
  start(conversation: Conversation): boolean;
  /** What a click does: show the whole line, or move on when it is already whole. On a line with choices it waits for a pick. */
  advance(): void;
  /** Picks an offered choice, 0 first. */
  choose(offered: number): void;
  /** Ends the conversation where it is. */
  close(): void;
  /**
   * Types the line showing now in time with a spoken clip instead of at its speed: letter `i` shows once
   * `clock()` (seconds into the clip) reaches `times[i]` milliseconds. While `clock()` is below 0 nothing
   * types, so the line can wait for its clip to load. The letters make no blips: the clip is the voice.
   * `null` goes back to typing at the speed from where the line is. It lasts until the line changes.
   */
  follow(times: readonly number[] | null, clock?: () => number): void;
}

const DEFAULT_ADVANCE = ['Enter', 'NumpadEnter', 'Space', 'KeyF'];
const PICK_KEYS: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 };
/** A click in the first moments after the box opens is the click that opened it. */
const OPEN_GUARD_MS = 220;

export function createDialogue(_ctx: ViewContext, options: DialogueOptions = {}): DialogueView {
  const flags = options.flags ?? {};
  const stop = new AbortController();
  const signal = stop.signal;

  const root = document.createElement('div');
  root.className = 'gb-dialogue';
  root.hidden = true;
  root.innerHTML = `
    <div class="gb-dialogue-box" role="dialog" aria-label="Conversation">
      <div class="gb-dialogue-portrait" aria-hidden="true"></div>
      <div class="gb-dialogue-body">
        <div class="gb-dialogue-name"></div>
        <p class="gb-dialogue-text" aria-hidden="true"><span class="gb-dialogue-typed"></span><span class="gb-dialogue-untyped"></span></p>
        <p class="gb-dialogue-spoken" aria-live="polite"></p>
        <ol class="gb-dialogue-choices" hidden></ol>
        <div class="gb-dialogue-more" aria-hidden="true"></div>
      </div>
    </div>`;
  (options.parent ?? document.body).append(root);
  const box = root.querySelector<HTMLElement>('.gb-dialogue-box')!;
  const portrait = root.querySelector<HTMLElement>('.gb-dialogue-portrait')!;
  const name = root.querySelector<HTMLElement>('.gb-dialogue-name')!;
  const typed = root.querySelector<HTMLElement>('.gb-dialogue-typed')!;
  const untyped = root.querySelector<HTMLElement>('.gb-dialogue-untyped')!;
  const spoken = root.querySelector<HTMLElement>('.gb-dialogue-spoken')!;
  const choices = root.querySelector<HTMLElement>('.gb-dialogue-choices')!;

  const type = new Typewriter(options.charsPerSecond ?? 32);
  const portraits = new Map<string, HTMLElement>();
  let talk: Talk | null = null;
  let voice = '';
  let openedAt = 0;
  let shown = -1;
  let returnFocus: HTMLElement | null = null;
  /** The letter times and clock of a spoken line, or null to type at the speed. */
  let times: readonly number[] | null = null;
  let clock: (() => number) | null = null;

  const portraitFor = (key: string, speaker: Speaker): HTMLElement => {
    let element = portraits.get(key);
    if (!element) {
      element = options.portrait?.(key, speaker) ?? undefined;
      if (!element) {
        // No picture: the speaker's initial, inked.
        element = document.createElement('span');
        element.className = 'gb-dialogue-initial';
        element.textContent = speaker.name.slice(0, 1).toUpperCase();
      }
      portraits.set(key, element);
    }
    return element;
  };

  const showChoices = (): void => {
    const said = talk?.current;
    if (!said || said.choices.length === 0) {
      choices.hidden = true;
      box.classList.toggle('is-waiting', !!said);
      return;
    }
    choices.replaceChildren(...said.choices.map((choice, i) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.choice = String(i);
      const key = document.createElement('span');
      key.className = 'gb-dialogue-key';
      key.textContent = String(i + 1);
      button.append(key, choice.text);
      item.append(button);
      return item;
    }));
    choices.hidden = false;
    box.classList.remove('is-waiting');
  };

  const paint = (): void => {
    if (shown === type.shown) return;
    shown = type.shown;
    typed.textContent = type.text.slice(0, shown);
    // The rest of the line is there but unseen, so words do not jump to the next row as they grow.
    untyped.textContent = type.text.slice(shown);
    if (type.done) showChoices();
  };

  const showLine = (): void => {
    const said = talk?.current;
    if (!talk || !said) {
      finish();
      return;
    }
    voice = said.speaker.voice;
    name.textContent = said.speaker.name;
    portrait.replaceChildren(portraitFor(said.speaker.portrait ?? said.who, said.speaker));
    spoken.textContent = `${said.speaker.name}: ${said.text}`;
    choices.hidden = true;
    choices.replaceChildren();
    box.classList.remove('is-waiting');
    times = null;
    clock = null;
    type.start(said.text, said.speaker.speed ?? options.charsPerSecond ?? 32);
    shown = -1;
    paint();
    options.onLine?.(said);
  };

  function finish(): void {
    if (!talk) return;
    const ended = talk;
    talk = null;
    root.hidden = true;
    options.bus?.emit({ type: 'ui', sound: 'close' });
    returnFocus?.focus?.({ preventScroll: true });
    options.onEnd?.(ended.conversation, flags);
  }

  const each = (char: string): void => {
    if (isVoiced(char)) options.onCharacter?.(char, voice);
  };

  const advance = (): void => {
    if (!talk) return;
    options.onSkip?.();
    if (!type.done) {
      type.finish();
      paint();
      return;
    }
    if (talk.current && talk.current.choices.length > 0) {
      // A pick is needed. Put the focus on the first choice so Enter picks it next.
      if (!choices.contains(document.activeElement)) choices.querySelector<HTMLElement>('button')?.focus();
      return;
    }
    talk.advance();
    options.bus?.emit({ type: 'ui', sound: 'click' });
    showLine();
  };

  const choose = (offered: number): void => {
    if (!talk || !type.done || !talk.choose(offered)) return;
    options.onSkip?.();
    options.bus?.emit({ type: 'ui', sound: 'click' });
    showLine();
  };

  const focusChoice = (step: 1 | -1): void => {
    const buttons = choices.querySelectorAll<HTMLElement>('button');
    if (choices.hidden || buttons.length === 0) return;
    let at = -1;
    for (let i = 0; i < buttons.length; i++) if (buttons[i] === document.activeElement) at = i;
    buttons[step === 1 ? (at + 1) % buttons.length : at <= 0 ? buttons.length - 1 : at - 1].focus();
  };

  // A gamepad sends no key events, so the box asks it while it is open: A or X moves on or picks
  // the focused choice, and the D-pad moves between choices.
  const PAD_A = 0, PAD_X = 2, PAD_UP = 12, PAD_DOWN = 13;
  const padWas = new Uint8Array(16);
  const readPad = (act: boolean): void => {
    const pads = navigator.getGamepads?.();
    if (!pads) return;
    for (let p = 0; p < pads.length; p++) {
      const pad = pads[p];
      if (!pad || !pad.connected) continue;
      for (let i = 0; i < padWas.length && i < pad.buttons.length; i++) {
        const down = pad.buttons[i].pressed ? 1 : 0;
        if (act && down && !padWas[i]) {
          if (i === PAD_UP) focusChoice(-1);
          else if (i === PAD_DOWN) focusChoice(1);
          else if (i === PAD_A || i === PAD_X) {
            const focused = choices.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.choice : undefined;
            if (focused !== undefined) choose(Number(focused));
            else advance();
          }
        }
        padWas[i] = down;
      }
      return;
    }
  };

  root.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('[data-choice]');
    if (button) choose(Number(button.dataset.choice));
    else if (performance.now() - openedAt > OPEN_GUARD_MS) advance();
  }, { signal });
  // A press on the box must not reach the game under it.
  root.addEventListener('pointerdown', (e) => e.stopPropagation(), { signal });
  root.addEventListener('mousedown', (e) => e.stopPropagation(), { signal });
  root.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });

  window.addEventListener('keydown', (e) => {
    if (!talk || e.ctrlKey || e.metaKey || e.altKey) return;
    const keys = typeof options.advanceKeys === 'function' ? options.advanceKeys() : options.advanceKeys ?? DEFAULT_ADVANCE;
    const onChoice = (e.target as HTMLElement | null)?.closest?.('[data-choice]');
    if (e.code in PICK_KEYS && type.done && talk.current && talk.current.choices.length > 0) {
      e.preventDefault();
      if (!e.repeat) choose(PICK_KEYS[e.code]);
    } else if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      if (choices.hidden) return;
      e.preventDefault();
      focusChoice(e.code === 'ArrowDown' ? 1 : -1);
    } else if (keys.includes(e.code)) {
      // Enter and Space on a focused choice press it, as on any button. The F key picks it too.
      if (onChoice && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) return;
      e.preventDefault();
      if (e.repeat) return;
      if (onChoice) choose(Number((onChoice as HTMLElement).dataset.choice));
      else advance();
    }
  }, { signal });

  return {
    element: root,
    get isOpen() { return talk !== null; },
    flags,
    get current() { return talk?.current ?? null; },
    get typing() { return talk !== null && !type.done; },

    start(conversation) {
      const next = new Talk(conversation, flags);
      if (next.done) return false;
      if (!talk) {
        returnFocus = document.activeElement as HTMLElement | null;
        options.bus?.emit({ type: 'ui', sound: 'open' });
      }
      talk = next;
      openedAt = performance.now();
      // The button that started the talk is still down. Note it, so it does not also move the talk on.
      readPad(false);
      root.hidden = false;
      showLine();
      return true;
    },
    advance,
    choose,
    close: finish,

    follow(next, nextClock) {
      const fits = next !== null && nextClock !== undefined && next.length === type.text.length;
      times = fits ? next : null;
      clock = fits ? nextClock : null;
    },

    update(dt) {
      if (!talk) return;
      readPad(true);
      if (!talk || type.done) return;
      if (times && clock) {
        // In time with the clip: every letter whose moment has come.
        const ms = clock() * 1000;
        let n = type.shown;
        while (n < times.length && times[n] <= ms) n++;
        type.shown = n;
      } else {
        // A long frame types a fifth of a second at most, so a stall does not dump the whole line.
        type.tick(Math.min(dt, 0.2), each);
      }
      paint();
    },

    dispose() {
      stop.abort();
      talk = null;
      root.remove();
    },
  };
}
