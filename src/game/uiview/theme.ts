// The look for everything that is not inside createGameUi: the HUD, the minimap, the full map, the dialogue
// box and the story cards. src/game/ui/styles.ui.ts sets the same look for the panels, but its tokens live on
// `.gu-root`, where the features cannot read them. So the same values are named here on the views' root, and
// handed to the features through the `--book-*` names they read.
//
// The look is "Gilded Hearth" (docs/ui-look.md): Genshin's interface language, warmer. Cream parchment and
// navy ink for panels, fine gold filigree, nothing boxed over the world but soft dark glass, Fraunces for
// titles and Nunito for the rest. The painted pieces are the `uikit` images in the manifest: `kitStyle()`
// names each as `--kit-<name>` on the views' root and adds the class `ui-kit`, and KIT below puts them on.
// Without the kit everything still draws, in CSS alone.
//
// Each view adds its own rules with `addStyle`. The rules start with `.ui-book`, so they outrank the
// feature's own stylesheet whatever order the two are loaded in.

/** The two faces, from public/fonts. Both are variable, 400 to 800, under the SIL Open Font License. */
export const FONTS = (base: string): string => /* css */ `
@font-face { font-family: 'Fraunces'; src: url('${base}fonts/fraunces.woff2') format('woff2'); font-weight: 400 800; font-style: normal; font-display: swap; }
@font-face { font-family: 'Nunito'; src: url('${base}fonts/nunito.woff2') format('woff2'); font-weight: 400 800; font-style: normal; font-display: swap; }
`;

export const TOKENS = /* css */ `
.ui-book {
  /* The same values as .gu-root in src/game/ui/styles.ui.ts. */
  --ui-paper: #ece5d8;
  --ui-paper-2: #e4dbc9;
  --ui-paper-3: #d9cdb6;
  --ui-paper-4: #cdbfa4;
  --ui-paper-light: #f6f1e7;
  --ui-plate: #f6f1e7;
  --ui-ink: #3b4255;
  --ui-ink-2: #6b6f7e;
  --ui-line: rgb(59 66 85 / 0.14);
  --ui-line-strong: rgb(59 66 85 / 0.3);
  /* Gold: the filigree, the thing picked, the next action. */
  --ui-gold: #d3bc8e;
  --ui-gold-bright: #f0d48a;
  --ui-bronze: #a6895a;
  --ui-brass: var(--ui-gold);
  --ui-brass-dark: var(--ui-bronze);
  --ui-accent: #c9a25e;
  --ui-accent-soft: rgb(211 188 142 / 0.28);
  --ui-done: #6f9a54;
  --ui-done-light: #a9d08a;
  --ui-new: #e8a33c;
  --ui-night: #1f2433;
  --ui-night-2: #2b3245;
  --ui-scrim: rgb(14 17 27 / 0.62);
  --ui-shadow: rgb(10 12 20 / 0.35);
  --ui-lift: 0 2px 4px rgb(10 12 20 / 0.18), 0 18px 48px rgb(10 12 20 / 0.38);
  /* Over the world: dark night glass with a gold hairline. No blur, so it costs nothing to draw. */
  --ui-glass: rgb(22 26 38 / 0.62);
  --ui-glass-2: rgb(255 255 255 / 0.08);
  --ui-glass-line: rgb(211 188 142 / 0.45);
  --ui-glass-ink: #f6f1e7;
  --ui-glass-ink-2: #d9d2c3;
  --ui-glass-shadow: 0 2px 12px rgb(10 12 20 / 0.28);
  --ui-text-shadow: 0 1px 2px rgb(10 12 20 / 0.85), 0 0 8px rgb(10 12 20 / 0.45);
  --ui-radius: 12px;
  --ui-radius-sm: 7px;
  --ui-font: 'Nunito', ui-rounded, 'SF Pro Rounded', ui-sans-serif, system-ui, sans-serif;
  --ui-display: 'Fraunces', 'Iowan Old Style', Georgia, serif;
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
  --book-brass: var(--ui-bronze);
  --book-brass-light: var(--ui-gold);
  --book-font: var(--ui-font);
}
.ui-book .gb-hud, .ui-book .gb-dialogue, .ui-book .gb-map, .ui-book .gb-beacon {
  color-scheme: light; font-family: var(--ui-font);
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  font-variant-numeric: lining-nums;
}
/* One cell of a sheet of pixel art, filling its box. */
.ui-cell { display: block; width: 100%; height: 100%; background-repeat: no-repeat; image-rendering: pixelated; }
.ui-cell.ui-smooth { image-rendering: auto; }
.ui-letters { display: grid; place-items: center; width: 100%; height: 100%; font-size: 13px; font-weight: 700; line-height: 1; color: var(--ui-ink-2); }

/* A large panel: cream paper, a gold hairline inside the edge, one deep shadow. With the kit it is the painted frame. */
.ui-book .ui-frame {
  position: relative; isolation: isolate;
  border: 0; border-radius: var(--ui-radius); outline: 0;
  background: var(--ui-paper);
  box-shadow: inset 0 0 0 1px var(--ui-paper-light), inset 0 0 0 5px var(--ui-paper), inset 0 0 0 6px var(--ui-gold), var(--ui-lift);
}
.ui-sheet { display: none; }
/* A small card over the game, on paper: the Almanac's gift card. */
.ui-book .ui-card {
  border: 0; border-radius: var(--ui-radius); outline: 0;
  background: var(--ui-paper);
  box-shadow: inset 0 0 0 5px var(--ui-paper), inset 0 0 0 6px var(--ui-gold), var(--ui-lift);
}
/* A strip of night glass over the world: the hint, the prompt, the toasts. */
.ui-book .ui-glass {
  color: var(--ui-glass-ink);
  background: var(--ui-glass);
  border: 0; border-radius: var(--ui-radius); outline: 0;
  box-shadow: inset 0 0 0 1px var(--ui-glass-line), var(--ui-glass-shadow);
}
/* The stack under the pointer while it is dragged, here and in the bag. */
.ui-book .gu-ghost, .gu-root .gu-ghost {
  position: absolute; left: 0; top: 0; z-index: 60; display: grid; place-items: center;
  width: 56px; height: 56px; pointer-events: none;
  background: var(--ui-night-2, #2b3245); border-radius: var(--ui-radius, 12px);
  box-shadow: 0 0 0 2px var(--ui-gold-bright, #f0d48a), 0 0 18px rgb(240 212 138 / 0.55), 0 12px 26px rgb(10 12 20 / 0.45);
  will-change: transform;
}
`;

/**
 * The painted pieces. Every rule starts with `.ui-book.ui-kit`, so it applies only once `kitStyle` has found the
 * kit in the manifest. A nine-slice is drawn by a `::before` that fills its element, at half the image's pixels.
 */
export const KIT = /* css */ `
/* ---- panels: the painted frame ---- */
.ui-book.ui-kit .gu-panel, .ui-book.ui-kit .ui-frame, .ui-book.ui-kit .gb-map-page, .ui-book.ui-kit .ui-card { background: transparent; box-shadow: none; }
.ui-book.ui-kit .gu-panel::before, .ui-book.ui-kit .ui-frame::before, .ui-book.ui-kit .gb-map-page::before, .ui-book.ui-kit .ui-card::before {
  content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
  border: 56px solid transparent; border-image: var(--kit-panel) 112 fill / 56px stretch;
  filter: drop-shadow(0 14px 30px rgb(10 12 20 / 0.45));
}
.ui-book.ui-kit .gu-panel, .ui-book.ui-kit .gb-map-page { isolation: isolate; }
.ui-book.ui-kit .gu-panel-head::after, .ui-book.ui-kit .gb-map-head::after {
  content: ''; position: absolute; left: 50%; bottom: -10px; width: min(420px, 80%); height: 24px; transform: translateX(-50%);
  background: var(--kit-divider) center / contain no-repeat; pointer-events: none;
}
.ui-book.ui-kit .gu-close { color: transparent !important; background: var(--kit-close) center / 36px 36px no-repeat !important; }
.ui-book.ui-kit .gu-close:hover { filter: brightness(1.08); transform: scale(1.06); }
.ui-book.ui-kit .gu-close[aria-label='Back'] { background-image: var(--kit-back) !important; }

/* ---- buttons: painted pills ---- */
.ui-book.ui-kit .gu-btn, .ui-book.ui-kit .gb-map button:not(.gb-pick-grid button) {
  border: 0 solid transparent; border-width: 0 26px; padding: 0 6px;
  border-image: var(--kit-button) 0 56 fill / 0 26px stretch; background: transparent !important; box-shadow: none !important;
  color: var(--ui-paper-light);
}
.ui-book.ui-kit .gu-btn.gu-primary { border-image-source: var(--kit-button-gold); color: var(--ui-night); }
.ui-book.ui-kit .gu-btn:hover:not(:disabled) { filter: brightness(1.1); }
.ui-book.ui-kit .gu-btn:disabled, .ui-book.ui-kit .gu-btn[aria-disabled='true'] { border-image-source: var(--kit-button-light); color: var(--ui-ink-2); opacity: 0.6; }

/* ---- slots: night wells with a gold rim ---- */
.ui-book.ui-kit .gu-slot, .ui-book.ui-kit .gb-slot, .ui-book.ui-kit .ui-bookbtn button {
  background: transparent; box-shadow: none;
  border: 20px solid transparent; border-image: var(--kit-slot) 40 fill / 20px stretch;
}
.ui-book.ui-kit .gu-slot:hover:not(.gu-slot-empty), .ui-book.ui-kit .gb-slot:hover, .ui-book.ui-kit .ui-bookbtn button:hover { border-image-source: var(--kit-slot-hover); background: transparent; }
.ui-book.ui-kit .gu-picked, .ui-book.ui-kit .gb-slot[aria-pressed='true'], .ui-book.ui-kit .gu-slot.is-drop, .ui-book.ui-kit .gb-slot.is-drop, .ui-book.ui-kit .ui-bookbtn button[aria-expanded='true'] {
  border-image-source: var(--kit-slot-selected); background: transparent; box-shadow: none;
}

/* ---- over the world: the minimap's ring, the dial, the hint banner, the tooltip ---- */
.ui-book.ui-kit .gb-hud-minimap { position: relative; padding: 13%; }
.ui-book.ui-kit .gb-hud-minimap::after { content: ''; position: absolute; inset: 0; background: var(--kit-minimap-ring) center / 100% 100% no-repeat; pointer-events: none; }
.ui-book.ui-kit .gb-minimap { border: 0 !important; box-shadow: none !important; }
.ui-book.ui-kit .gu-tip, .ui-book.ui-kit .ui-slot-tip { background: transparent; box-shadow: none; isolation: isolate; }
.ui-book.ui-kit .gu-tip::before, .ui-book.ui-kit .ui-slot-tip::before {
  content: ''; position: absolute; inset: 0; z-index: -1; border: 24px solid transparent; border-image: var(--kit-tooltip) 48 fill / 24px stretch;
}
`;

/** Names each `uikit` image as `--kit-<name>` on the views' root, and adds the class `ui-kit` when the kit has its panel. */
export function kitStyle(root: HTMLElement, kit: Readonly<Record<string, string>>): void {
  for (const [name, url] of Object.entries(kit)) root.style.setProperty(`--kit-${name}`, `url("${url}")`);
  root.classList.toggle('ui-kit', 'panel' in kit);
}

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
