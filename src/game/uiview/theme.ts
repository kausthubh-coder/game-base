// The look for everything that is not inside createGameUi: the HUD, the minimap, the full map, the dialogue
// box and the story cards. src/game/ui/styles.ui.ts sets the same look for the panels, but its tokens live on
// `.gu-root`, where the features cannot read them. So the same values are named here on the views' root, and
// handed to the features through the `--book-*` names they read.
//
// Two grounds, from the handbook's direction (design/.critly/direction.md): warm near-white paper for panels
// and cards, and dark glass for what sits over the world while walking. One sans family from the system,
// one teal accent from the lume crystal, green for done, amber for new. 10px corners, 1px lines, space first.
//
// Each view adds its own rules with `addStyle`. The rules start with `.ui-book`, so they outrank the
// feature's own stylesheet whatever order the two are loaded in.

export const TOKENS = /* css */ `
.ui-book {
  /* The same values as .gu-root in src/game/ui/styles.ui.ts. */
  --ui-paper: oklch(0.975 0.014 88);
  --ui-paper-2: oklch(0.945 0.02 86);
  --ui-paper-3: oklch(0.91 0.026 84);
  --ui-paper-4: oklch(0.88 0.03 82);
  --ui-paper-light: oklch(0.99 0.008 90);
  --ui-plate: oklch(0.99 0.008 90);
  --ui-ink: oklch(0.29 0.022 62);
  --ui-ink-2: oklch(0.47 0.022 68);
  --ui-line: oklch(0.29 0.022 62 / 0.12);
  --ui-line-strong: oklch(0.29 0.022 62 / 0.28);
  --ui-brass: oklch(0.8 0.13 78);
  --ui-brass-dark: oklch(0.62 0.13 68);
  --ui-accent: oklch(0.53 0.095 192);
  --ui-accent-soft: oklch(0.53 0.095 192 / 0.16);
  --ui-done: oklch(0.56 0.12 150);
  --ui-new: oklch(0.72 0.15 68);
  --ui-scrim: oklch(0.18 0.02 60 / 0.45);
  --ui-shadow: oklch(0.18 0.03 60 / 0.28);
  --ui-lift: 0 1px 2px oklch(0.18 0.03 60 / 0.14), 0 12px 32px oklch(0.18 0.03 60 / 0.24);
  /* Dark glass over the world: no blur, so it costs nothing to draw. */
  --ui-glass: oklch(0.21 0.018 62 / 0.62);
  --ui-glass-2: oklch(1 0 0 / 0.1);
  --ui-glass-line: oklch(1 0 0 / 0.14);
  --ui-glass-ink: oklch(0.985 0.008 88);
  --ui-glass-ink-2: oklch(0.87 0.014 86);
  --ui-glass-shadow: 0 2px 10px oklch(0.12 0.02 60 / 0.22);
  --ui-text-shadow: 0 1px 2px oklch(0.12 0.02 60 / 0.6);
  --ui-radius: 10px;
  --ui-radius-sm: 6px;
  --ui-font: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
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

/* A large panel: warm paper, 10px corners, one soft shadow. The ui-sheet elements frame() adds are kept for the old nine-slice frame and draw nothing now. */
.ui-book .ui-frame {
  position: relative; isolation: isolate;
  border: 0; border-radius: var(--ui-radius); outline: 0;
  background: var(--ui-paper);
  box-shadow: var(--ui-lift);
}
.ui-sheet { display: none; }
/* A small card over the game, on paper: the Almanac's gift card. */
.ui-book .ui-card {
  border: 0; border-radius: var(--ui-radius); outline: 0;
  background: var(--ui-paper);
  box-shadow: var(--ui-lift);
}
/* A strip of dark glass over the world: the tracker, the clock, the quick slots. */
.ui-book .ui-glass {
  color: var(--ui-glass-ink);
  background: var(--ui-glass);
  border: 0; border-radius: var(--ui-radius); outline: 0;
  box-shadow: var(--ui-glass-shadow);
}
/* The stack under the pointer while it is dragged, here and in the bag. */
.ui-book .gu-ghost, .gu-root .gu-ghost {
  position: absolute; left: 0; top: 0; z-index: 60; display: grid; place-items: center;
  width: 56px; height: 56px; pointer-events: none;
  background: var(--ui-paper, oklch(0.975 0.014 88)); border-radius: var(--ui-radius, 10px);
  box-shadow: 0 0 0 2px oklch(0.53 0.095 192), 0 10px 24px oklch(0.18 0.03 60 / 0.35);
  will-change: transform;
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
