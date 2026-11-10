// Hints, toasts, the "E:" prompt and the end card in the running game. `createGameUi` draws all four
// and hears `hint`, `toast` and `act.ended` on the game's events by itself, and the end card's numbers
// are `view.stats()` (src/game/uiview/book.ts hands that over). What is left for this view:
//
// - Where they sit beside the HUD and the dialogue box, so nothing lies over anything else. A hint is
//   at the top of the screen and the dialogue box at the bottom, at every width.
// - A toast for each thing that goes into the bag. The rules send `item.gained` and no toast for it.
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { addStyle } from '../uiview/theme.ts';

/** The most toasts one gain sends. Each is the same line, so they add up to one line with a count. */
const MOST = 99;

const STYLE = /* css */ `
/* The prompt sits just above the quick slots, whatever room they take. */
.ui-book .gu-prompt { bottom: var(--ui-hud-clear) !important; }
/* Under an open panel or the full map nothing could be read, so the hints and the toasts step out. */
.ui-book.ui-covered .gu-top, .ui-book.ui-covered .gu-toasts { visibility: hidden; }
/* Toasts keep the bottom left corner. While someone talks they sit above the dialogue box. */
.ui-book.ui-talking .gu-toasts { bottom: var(--ui-talk-clear); }
/* Narrower than this, a long toast would reach the quick slots: it goes above them. */
@container gu (width < 1280px) {
  .ui-book .gu-toasts { bottom: var(--ui-bottom-clear); }
}
@container gu (width < 900px) {
  /* And above the prompt, which is as wide as the screen's middle here. */
  .ui-book:not(.ui-talking) .gu-toasts { bottom: calc(var(--ui-hud-clear) + 48px); }
  /* The minimap has the top right corner, so a hint takes the top left. */
  .ui-book .gu-top { left: 16px; width: min(440px, 100% - 232px); justify-items: start; transform: none; }
}
/* A phone held upright: the hint and the Almanac's note share the strip beside the minimap, so both are set smaller to end above the tracker. */
@container gu (width < 560px) {
  .ui-book .gu-top { left: 8px; top: 8px; gap: 6px; width: calc(100% - 156px); }
  .ui-book .gu-hint { padding-left: 12px; }
  .ui-book .gu-hint-text { font-size: 14px; line-height: 1.35; }
  .ui-book .gu-note { min-height: 44px; padding: 4px 12px; font-size: 14px; text-align: left; }
  .ui-book .gu-note .gu-keys { display: none; }
}
`;

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game } = view;
  addStyle(view.root, 'notices', STYLE);

  game.events.on('item.gained', ({ id, count }) => {
    // With the bag or the Make panel open, the new thing is already in front of the player.
    if (!view.started || book.panel === 'bag' || book.panel === 'make') return;
    let name = id, icon = id;
    try {
      const def = book.sys.items?.get(id);
      if (def) { name = def.name; icon = def.icon; }
    } catch {
      // An item nobody defined still gets its line, by its id.
    }
    for (let i = 0; i < Math.min(count, MOST); i++) game.events.emit('toast', { text: name, icon });
  });
}
