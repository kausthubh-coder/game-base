// The moment Tamsin hands over the Almanac. The book is the flag `has.almanac`, never a thing in the bag,
// so no "item gained" toast says so. Instead a card rises under the hint strip as her first talk closes
// (a talk's effects land when it ends): the book, its name, and whose it was. Her line "Take the book"
// and a narrated line of her putting it in your hands come first. The HUD's book button glows the first
// time it shows (ui-hud.view.ts).
//
// While the card shows, the hint and the Almanac's note at the top step aside and wait, so the screen says one thing
// at a time. The card names the Tab key, so the hint "Press Tab to open the Almanac" is not shown after it.
import { ALMANAC_BOOK } from '../content/almanac.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { addStyle } from '../uiview/theme.ts';

/** Seconds the card stays. */
const STAYS = 4.2;

const STYLE = /* css */ `
.st-gift {
  position: absolute; top: clamp(96px, 15vh, 152px); left: 50%; z-index: 35;
  display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 2px 18px;
  min-width: min(360px, calc(100% - 32px)); max-width: calc(100% - 32px); padding: 16px 24px 16px 16px;
  font-family: var(--ui-font); color: var(--ui-ink);
  pointer-events: none;
  transform: translateX(-50%);
  animation: st-gift-in 260ms var(--ui-ease) both;
}
.st-gift[hidden] { display: none; }
.st-gift.is-leaving { animation: st-gift-out 180ms ease-in both; }
.st-gift-icon { grid-row: span 4; width: 64px; height: 64px; padding: 8px; box-sizing: content-box; background: var(--ui-paper-2); border-radius: var(--ui-radius); }
.st-gift-eyebrow { font-size: 12px; font-weight: 600; line-height: 1.3; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ui-accent); }
.st-gift-name { margin: 0; font-size: 24px; font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; }
.st-gift-text { font-size: 15px; line-height: 1.4; color: var(--ui-ink-2); }
.st-gift-key { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 14px; font-weight: 600; color: var(--ui-ink); }
.st-gift-key kbd { display: inline-grid; place-items: center; min-width: 36px; height: 24px; padding: 0 6px; font: 600 13px/1 var(--ui-font); background: var(--ui-paper-light); border-radius: var(--ui-radius-sm); box-shadow: inset 0 0 0 1px var(--ui-line-strong), inset 0 -2px 0 var(--ui-line); }
@keyframes st-gift-in { from { opacity: 0; transform: translate(-50%, -8px) scale(0.97); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
@keyframes st-gift-out { to { opacity: 0; transform: translate(-50%, -4px); } }
@media (prefers-reduced-motion: reduce) {
  @keyframes st-gift-in { from { opacity: 0; transform: translate(-50%, 0); } to { opacity: 1; transform: translate(-50%, 0); } }
}
@media (max-width: 560px) {
  .st-gift { top: 96px; gap: 2px 14px; padding: 12px 16px 12px 12px; }
  .st-gift-icon { width: 48px; height: 48px; }
  .st-gift-name { font-size: 20px; }
}
.ui-book.ui-covered .st-gift { visibility: hidden; }
`;

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game, root } = view;
  addStyle(root, 'story-almanac', STYLE);

  let name = 'Almanac';
  try {
    name = book.sys.items?.get(ALMANAC_BOOK.item).name ?? name;
  } catch {
    // The book still has its name without the table.
  }

  const card = document.createElement('div');
  card.className = 'st-gift ui-card';
  card.hidden = true;
  card.setAttribute('role', 'status');
  const icon = book.art.iconElement('book');
  if (icon) {
    icon.classList.add('st-gift-icon');
    card.append(icon);
  }
  card.insertAdjacentHTML('beforeend', /* html */ `
    <span class="st-gift-eyebrow">Received from Tamsin</span>
    <h2 class="st-gift-name">The ${name}</h2>
    <span class="st-gift-text">Blank for forty years. Yours to fill, and to keep.</span>
    <span class="st-gift-key"><kbd>Tab</kbd> opens it</span>`);
  root.append(card);

  let left = 0;
  game.events.on('flag.changed', ({ flag, value }) => {
    // Only when it is handed over in play. A loaded game already has it, and says nothing.
    if (flag !== ALMANAC_BOOK.flag || value !== true || !view.started) return;
    card.classList.remove('is-leaving');
    card.hidden = false;
    left = STAYS;
    book.ui.notices.skip('almanac');
    book.ui.notices.hold(true);
    game.events.emit('ui.sound', { sound: 'open' });
  });

  view.onFrame((dt) => {
    if (card.hidden) return;
    left -= dt;
    if (left <= 0 && !card.classList.contains('is-leaving')) card.classList.add('is-leaving');
    if (left <= -0.2) {
      card.hidden = true;
      book.ui.notices.hold(false);
    }
  });
}
