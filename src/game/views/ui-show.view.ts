// For a check that can only load an address, such as `critly check`: `?show=<state>` skips the title,
// starts a new game and puts the interface in one state. Nobody playing uses it.
//
//   ?show=hud       the HUD with things in the quick slots, a hint and a toast
//   ?show=talk      a line from Tamsin        ?show=choice    Maren's line with three choices
//   ?show=bag | make | almanac | quests | map | pause | settings | end
//
// When the state is up, `<html>` gets `data-show`, for `--ready "[data-show]"`. The rules are then
// paused, and the save this visit would leave behind is removed when the page closes. With a saved game
// in the browser it does nothing at all, so it can never write over one.
import { clearSave } from '../shell/save.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';

const PANELS = ['bag', 'make', 'almanac', 'quests', 'pause', 'end'] as const;
/** Frames to wait after the game starts, so the land around the hero is drawn. */
const SETTLE = 4;

export function install(view: GameView): void {
  const show = new URLSearchParams(location.search).get('show');
  if (!show) return;
  if (view.hasSave()) {
    console.info('[ui] ?show does nothing while a saved game exists, so it never writes over one.');
    return;
  }
  const book = bookOf(view);
  const { game } = view;
  const { sys, ui } = book;

  function arrange(): void {
    const bag = sys.inventory;
    bag?.add('axe', 1);
    bag?.add('oak_log', 14);
    bag?.add('plank', 9);
    bag?.add('berry', 3);
    bag?.add('wheat', 7);
    if (bag) bag.selected = 1;

    if (show === 'hud') {
      game.events.emit('hint', { id: 'show', text: 'Hold the left button on a tree or a block to gather it.' });
    } else if (show === 'talk') {
      sys.talk?.start('tamsin.meet', 'tamsin');
    } else if (show === 'choice') {
      sys.talk?.start('maren.ask', 'maren');
      for (let i = 0; i < 20 && sys.talk?.active && sys.talk.current()?.choices.length === 0; i++) sys.talk.advance();
    } else if (show === 'map') {
      book.map?.open();
    } else if (show === 'settings') {
      ui.open('pause');
      ui.open('settings');
    } else if ((PANELS as readonly string[]).includes(show ?? '')) {
      ui.open(show as (typeof PANELS)[number]);
    }
    view.setPaused('show', true);
    document.documentElement.dataset.show = show ?? '';
  }

  // After the shell's own listener, which saves as the page closes.
  window.addEventListener('pagehide', clearSave);

  let frames = 0;
  const stop = view.onFrame(() => {
    if (!view.started) {
      view.newGame();
      return;
    }
    if (++frames !== SETTLE) return;
    // Not in the middle of the shell's walk through its listeners.
    queueMicrotask(stop);
    arrange();
  });
}
