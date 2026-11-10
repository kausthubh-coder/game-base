// The panels on their keys: I or B the bag, Tab the Almanac once Tamsin has given it, J the quest log,
// M the map, and Esc, which closes what is open or opens the pause menu. The list of keys is src/game/uiview/keys.ts.
//
// `createGameUi` has its own key handling switched off (`hotkeys: false`), so one place decides what a
// key does when the full map, a panel and the pause menu could all want it. It still closes its own
// panels on Esc and moves the focus with Tab inside them.
//
// A workbench opens the Make panel. Nothing in the rules sends `ui.open` for it, so this view listens
// to `placeables.onUse`, which is also what makes "E: Craft" show at a workbench.
import { ALMANAC_BOOK } from '../content/almanac.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { PANEL_KEYS } from '../uiview/keys.ts';

/** True when the key belongs to a text box or a slider, not to the game. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

export function install(view: GameView): void {
  const book = bookOf(view);
  const { ui, sys } = book;

  /** The key is used here, and nobody after this listener sees it. */
  const take = (event: KeyboardEvent): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  // In the capture phase, so this runs before createGameUi's listener and before the map's.
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = PANEL_KEYS[event.code];
    if (!target) return;
    const panel = book.panel;
    const mapOpen = book.map?.isOpen ?? false;
    const talking = sys.talk?.active ?? false;

    if (event.repeat) {
      // A held key opens or closes once. Tab still walks the focus inside a panel while it is held.
      if (event.code !== 'Tab' || panel === null || panel === 'almanac') take(event);
      return;
    }

    if (target === 'pause') {
      // An open panel closes itself on Esc, and so does the map.
      if (panel !== null || mapOpen) return;
      if (!view.started || talking) return;
      take(event);
      ui.open('pause');
      return;
    }

    // Before Tamsin gives the book, Tab does nothing at all, not even move the focus.
    if (target === 'almanac' && !view.game.flags.is(ALMANAC_BOOK.flag) && panel === null) {
      take(event);
      return;
    }
    if (typing(event.target) || !view.started || book.menuOpen || talking) return;
    // Inside the bag, the Make panel and the quest log, Tab moves the focus. In the Almanac it is the key that opened the book.
    if (event.code === 'Tab' && panel !== null && panel !== 'almanac') return;
    take(event);

    if (target === 'map') {
      if (!book.map) return;
      if (mapOpen) {
        book.map.close();
      } else {
        if (panel !== null) ui.close();
        book.map.open();
      }
      return;
    }
    if (mapOpen) book.map?.close();
    ui.toggle(target);
  }, { capture: true });

  // A station that opens a panel. A chest holds nothing in this part of the story, so it says so.
  sys.placeables?.onUse?.((placed) => {
    const station = sys.placeables?.defs().find((def) => def.kind === placed.kind)?.station;
    if (station === 'workbench') {
      if (!book.menuOpen && !ui.isOpen('make') && !(book.map?.isOpen ?? false)) ui.open('make');
    } else if (station === 'chest') {
      view.game.events.emit('toast', { text: 'The chest is empty.', icon: 'chest' });
    }
  });
}
