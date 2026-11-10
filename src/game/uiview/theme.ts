// The book look for everything that is not inside createGameUi: the HUD, the minimap, the full map and
// the dialogue box. src/game/ui/styles.ui.ts sets the look (parchment, ink, brass corners, one serif),
// but its tokens live on `.gu-root`, where the features cannot read them. So the same values are named
// here on the views' root, and handed to the features through the `--book-*` names they read.
//
// Each view adds its own rules with `addStyle`. The rules start with `.ui-book`, so they outrank the
// feature's own stylesheet whatever order the two are loaded in.

export const TOKENS = /* css */ `
.ui-book {
  /* The same values as .gu-root in src/game/ui/styles.ui.ts. */
  --ui-paper: oklch(0.886 0.076 76);
  --ui-paper-2: oklch(0.845 0.072 78);
  --ui-paper-3: oklch(0.795 0.078 76);
  --ui-paper-4: oklch(0.76 0.08 75);
  --ui-paper-light: oklch(0.909 0.089 85);
  --ui-plate: oklch(0.921 0.032 87);
  --ui-ink: oklch(0.27 0.025 40);
  --ui-ink-2: oklch(0.38 0.04 55);
  --ui-line: oklch(0.27 0.025 40 / 0.28);
  --ui-line-strong: oklch(0.402 0.055 61);
  --ui-brass: oklch(0.76 0.112 82);
  --ui-brass-dark: oklch(0.6 0.105 76);
  --ui-accent: oklch(0.46 0.15 32);
  --ui-done: oklch(0.42 0.075 165);
  --ui-scrim: oklch(0.2 0.03 60 / 0.5);
  --ui-shadow: oklch(0.15 0.03 60 / 0.4);
  --ui-font: ui-serif, 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
  --ui-ease: cubic-bezier(0.23, 1, 0.32, 1);
  /* Pixels kept clear at the bottom: the quick slots (the HUD view measures them), or the dialogue box while someone talks (the talk view does). */
  --ui-hud-clear: 96px;
  --ui-talk-clear: 0px;
  --ui-bottom-clear: max(var(--ui-hud-clear), var(--ui-talk-clear));
  /* The interface size from Settings: 0.9, 1 or 1.15. */
  --ui-size: 1;

  /* What the hud, map and dialogue features read. */
  --book-parchment: var(--ui-paper);
  --book-parchment-deep: var(--ui-paper-3);
  --book-ink: var(--ui-ink);
  --book-ink-soft: var(--ui-ink-2);
  --book-brass: var(--ui-brass-dark);
  --book-brass-light: var(--ui-brass);
  --book-font: var(--ui-font);
}
.ui-book .gb-hud, .ui-book .gb-dialogue, .ui-book .gb-map, .ui-book .gb-beacon {
  color-scheme: light;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  font-variant-numeric: lining-nums;
}
/* One cell of a sheet of pixel art, filling its box. */
.ui-cell { display: block; width: 100%; height: 100%; background-repeat: no-repeat; image-rendering: pixelated; }
.ui-letters { display: grid; place-items: center; width: 100%; height: 100%; font-size: 13px; font-weight: 600; line-height: 1; color: var(--ui-ink-2); }

/*
 * A large panel: the frame is ui/panel.png cut at its corner ornaments, as createGameUi's panels are.
 * The picture's middle has a stain that smears when stretched, so one layer of flat paper is laid over
 * everything inside the frame lines (the ui-sheet elements that frame() adds): a tall sheet, a wide sheet
 * and a middle one, which leave only the four ornaments showing. --u is one picture pixel. The 2px is the panel's own border.
 */
.ui-book.ui-art .ui-frame {
  --u: 2px;
  position: relative; isolation: isolate;
  border: 2px solid transparent; border-radius: 0; outline: 0;
  border-image: var(--ui-panel-art) 28 / calc(28 * var(--u)) stretch;
  background: var(--ui-paper); background-clip: padding-box;
  image-rendering: pixelated;
  box-shadow: 0 16px 48px var(--ui-shadow);
}
.ui-book.ui-art .ui-frame > * { image-rendering: auto; }
.ui-sheet { display: none; }
.ui-book.ui-art .ui-frame > .ui-sheet { display: block; position: absolute; z-index: -1; pointer-events: none; background: var(--ui-paper); }
.ui-book.ui-art .ui-frame > .ui-sheet-tall { inset: calc(10 * var(--u) - 2px) calc(28 * var(--u) - 2px); }
.ui-book.ui-art .ui-frame > .ui-sheet-wide { inset: calc(28 * var(--u) - 2px) calc(10 * var(--u) - 2px); }
.ui-book.ui-art .ui-frame > .ui-sheet-middle { inset: calc(16 * var(--u) - 2px); }
/* Without the picture: the same frame in lines, as createGameUi's fallback draws it. */
.ui-book:not(.ui-art) .ui-frame {
  border: 2px solid var(--ui-ink); border-radius: 2px; outline: 0;
  background: var(--ui-paper);
  box-shadow: inset 0 0 0 2px var(--ui-paper-light), inset 0 0 0 4px var(--ui-paper), inset 0 0 0 6px var(--ui-line-strong), 0 16px 48px var(--ui-shadow);
}
/* A small card over the game: the prompt, a toast and a hint are drawn this way by createGameUi. */
.ui-book .ui-card {
  border: 2px solid var(--ui-ink); border-radius: 2px; outline: 0;
  background: var(--ui-paper);
  box-shadow: 0 4px 14px var(--ui-shadow);
}
`;

/** Gives an element the large panel's frame: the `ui-frame` class and the three sheets of paper that lie inside the frame lines. */
export function frame(element: Element | null): void {
  if (!element || element.classList.contains('ui-frame')) return;
  element.classList.add('ui-frame');
  for (const part of ['middle', 'wide', 'tall']) {
    const sheet = document.createElement('i');
    sheet.className = `ui-sheet ui-sheet-${part}`;
    sheet.setAttribute('aria-hidden', 'true');
    element.prepend(sheet);
  }
}

/** Adds a stylesheet to an element once. `id` names it, so a second call with the same id does nothing. */
export function addStyle(root: HTMLElement, id: string, css: string): void {
  if (root.querySelector(`style[data-ui="${id}"]`)) return;
  const style = document.createElement('style');
  style.dataset.ui = id;
  style.textContent = css;
  root.append(style);
}
