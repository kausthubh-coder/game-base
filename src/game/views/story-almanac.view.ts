// The moment Tamsin hands over the Almanac. The book is the flag `has.almanac`, never a thing in the bag,
// so no "item gained" toast says so. Instead a card rises under the hint strip as her first talk closes
// (a talk's effects land when it ends): the book, its name, and whose it was. Her line "Take the book"
// and a narrated line of her putting it in your hands come first. The HUD's book button glows the first
// time it shows (ui-hud.view.ts).
import { ALMANAC_BOOK } from '../content/almanac.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { addStyle } from '../uiview/theme.ts';

/** Seconds the card stays. */
const STAYS = 4.2;

const STYLE = /* css */ `
.st-gift {
  position: absolute; top: clamp(112px, 17vh, 168px); left: 50%; z-index: 35;
  display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px 16px;
  min-width: min(340px, calc(100% - 32px)); max-width: calc(100% - 32px); padding: 14px 22px 14px 16px;
  font-family: var(--ui-font); color: var(--ui-ink);
  pointer-events: none;
  transform: translateX(-50%);
  animation: st-gift-in 260ms var(--ui-ease) both;
}
.st-gift[hidden] { display: none; }
.st-gift.is-leaving { animation: st-gift-out 180ms ease-in both; }
.st-gift-icon { grid-row: span 3; width: 64px; height: 64px; padding: 8px; box-sizing: content-box; background: var(--ui-paper-3); border-radius: 2px; }
.st-gift-eyebrow { font-size: 12px; font-weight: 600; line-height: 1.2; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ui-brass-dark); }
.st-gift-name { margin: 0; font-size: 24px; font-weight: 600; line-height: 1.15; letter-spacing: -0.01em; }
.st-gift-text { font-size: 15px; line-height: 1.35; color: var(--ui-ink-2); }
@keyframes st-gift-in { from { opacity: 0; transform: translate(-50%, -8px) scale(0.97); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
@keyframes st-gift-out { to { opacity: 0; transform: translate(-50%, -4px); } }
@media (prefers-reduced-motion: reduce) {
  @keyframes st-gift-in { from { opacity: 0; transform: translate(-50%, 0); } to { opacity: 1; transform: translate(-50%, 0); } }
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
    <span class="st-gift-text">Blank for forty years. Yours to fill, and to keep.</span>`);
  root.append(card);

  let left = 0;
  game.events.on('flag.changed', ({ flag, value }) => {
    // Only when it is handed over in play. A loaded game already has it, and says nothing.
    if (flag !== ALMANAC_BOOK.flag || value !== true || !view.started) return;
    card.classList.remove('is-leaving');
    card.hidden = false;
    left = STAYS;
    game.events.emit('ui.sound', { sound: 'open' });
  });

  view.onFrame((dt) => {
    if (card.hidden) return;
    left -= dt;
    if (left <= 0 && !card.classList.contains('is-leaving')) card.classList.add('is-leaving');
    if (left <= -0.2) card.hidden = true;
  });
}
