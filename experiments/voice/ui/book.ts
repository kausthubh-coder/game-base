// The game's book look, for the voice pages: the play build's tokens and frame (src/game/uiview/theme.ts),
// the dialogue feature's stylesheet, and the play build's dialogue box rules (copied from
// src/game/views/ui-talk.view.ts, where they are not exported). The box is built here with the same
// class names, because the feature's box types at its own pace and these pages type in time with a voice.
import '../../../src/features/dialogue/dialogue.css';
import { TOKENS, frame } from '../../../src/game/uiview/theme.ts';
import type { CastId } from '../cast.ts';

const TALK = /* css */ `
.ui-book { --ui-panel-art: url(/assets/ui/panel.png); }
.ui-book .gb-dialogue { padding: 0 16px max(24px, env(safe-area-inset-bottom, 0px)); font-size: 18px; line-height: 1.45; pointer-events: auto; }
.ui-book .gb-dialogue-box { width: min(780px, 100%); gap: 24px; padding: 30px 40px 30px 34px; zoom: var(--ui-size); animation: ui-talk-in 140ms var(--ui-ease); }
@keyframes ui-talk-in { from { transform: translateY(8px); } }
.ui-book.ui-art .gb-dialogue-box { --u: 1px; }
.ui-book .gb-dialogue-portrait { width: 128px; height: 128px; border: 0; border-radius: 2px; background: var(--ui-paper-2); box-shadow: none; }
.ui-book .gb-dialogue-body { gap: 8px; }
.ui-book .gb-dialogue-name { padding-bottom: 8px; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; border-bottom: 1px solid var(--ui-line); display: flex; align-items: baseline; gap: 10px; }
.ui-book .gb-dialogue-text { margin: 0; min-height: 4.35em; max-width: 58ch; text-wrap: pretty; }
.ui-book .gb-dialogue-choices { margin: 4px 0 0; gap: 8px; }
.ui-book .gb-dialogue-choices button { min-height: 44px; gap: 12px; padding: 4px 16px 4px 10px; color: var(--ui-ink); background: var(--ui-plate); border: 2px solid var(--ui-ink); border-radius: 2px; box-shadow: none; transition: transform 80ms var(--ui-ease); }
.ui-book .gb-dialogue-choices button:hover, .ui-book .gb-dialogue-choices button:focus-visible { background: var(--ui-paper-light); }
.ui-book .gb-dialogue-key { width: 26px; height: 26px; font-size: 14px; font-weight: 600; color: var(--ui-ink); background: var(--ui-paper); border: 1px solid var(--ui-line-strong); border-bottom-width: 2px; border-radius: 3px; }
.ui-book .gb-dialogue-more { right: 0; bottom: 0; border-top-color: var(--ui-ink-2); }
.ui-book .gb-dialogue.is-narrator .gb-dialogue-box { grid-template-columns: minmax(0, 1fr); }
.ui-book .gb-dialogue.is-narrator .gb-dialogue-portrait, .ui-book .gb-dialogue.is-narrator .gb-dialogue-name { display: none; }
.ui-book .gb-dialogue.is-narrator .gb-dialogue-text { font-style: italic; min-height: 2.9em; }
.ui-book .gb-dialogue-cue { font-style: italic; color: var(--ui-ink-2); }
@media (max-width: 560px) {
  .ui-book .gb-dialogue { padding: 0 8px max(8px, env(safe-area-inset-bottom, 0px)); font-size: 16px; }
  .ui-book.ui-art .gb-dialogue-box { --u: 1px; }
  .ui-book .gb-dialogue-box { gap: 14px; padding: 18px 20px; zoom: 1; }
  .ui-book .gb-dialogue-portrait { width: 64px; height: 64px; }
  .ui-book .gb-dialogue-name { font-size: 18px; padding-bottom: 6px; }
  .ui-book .gb-dialogue-text { min-height: 5.8em; }
}
@media (prefers-reduced-motion: reduce) {
  .ui-book .gb-dialogue-box { animation: none; }
}
.ui-portrait { display: block; width: 100%; height: 100%; background: url(/assets/portraits/portraits.png) no-repeat; image-rendering: pixelated; }
`;

/** Puts the book look on the page and marks `root` as a book view with the panel art. */
export function useBook(root: HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = TOKENS + TALK;
  document.head.append(style);
  root.classList.add('ui-book', 'ui-art');
}

/** A cell of the portrait sheet, scaled to fill its box. */
export function portrait(cell: [number, number]): HTMLElement {
  const el = document.createElement('i');
  el.className = 'ui-portrait';
  el.style.backgroundSize = '300% 300%';
  el.style.backgroundPosition = `${cell[0] * 50}% ${cell[1] * 50}%`;
  return el;
}

export interface Box {
  root: HTMLElement;
  pane: HTMLElement;
  portrait: HTMLElement;
  name: HTMLElement;
  text: HTMLElement;
  choices: HTMLUListElement;
  /** Shows a speaker (or the narrator, with null). */
  speaker(name: string | null, cell?: [number, number]): void;
  /** Shows `cue` whole and `body` up to `shown` letters, keeping the rest laid out but hidden. */
  show(cue: string, body: string, shown: number): void;
  waiting(on: boolean): void;
}

/** The dialogue box, in the play build's markup. */
export function createBox(parent: HTMLElement): Box {
  const root = document.createElement('div');
  root.className = 'gb-dialogue';
  root.innerHTML = `<div class="gb-dialogue-box" role="dialog" aria-live="polite">
    <div class="gb-dialogue-portrait"></div>
    <div class="gb-dialogue-body">
      <div class="gb-dialogue-name"></div>
      <p class="gb-dialogue-text"></p>
      <ul class="gb-dialogue-choices" hidden></ul>
      <span class="gb-dialogue-more" aria-hidden="true"></span>
    </div>
  </div>`;
  parent.append(root);
  const pane = root.querySelector<HTMLElement>('.gb-dialogue-box')!;
  frame(pane);
  const box: Box = {
    root,
    pane,
    portrait: root.querySelector('.gb-dialogue-portrait')!,
    name: root.querySelector('.gb-dialogue-name')!,
    text: root.querySelector('.gb-dialogue-text')!,
    choices: root.querySelector('.gb-dialogue-choices')!,
    speaker(name, cell) {
      root.classList.toggle('is-narrator', name === null);
      box.name.textContent = name ?? '';
      box.portrait.replaceChildren(...(cell ? [portrait(cell)] : []));
    },
    show(cue, body, shown) {
      const typed = document.createElement('span');
      typed.textContent = body.slice(0, shown);
      const rest = document.createElement('span');
      rest.className = 'gb-dialogue-untyped';
      rest.textContent = body.slice(shown);
      const parts: Node[] = [];
      if (cue) {
        const c = document.createElement('span');
        c.className = 'gb-dialogue-cue';
        c.textContent = cue;
        parts.push(c);
      }
      box.text.replaceChildren(...parts, typed, rest);
    },
    waiting(on) {
      pane.classList.toggle('is-waiting', on);
    },
  };
  return box;
}

export type { CastId };
