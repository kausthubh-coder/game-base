// For a check that can only load an address, such as `critly check`: `?show=<state>` skips the title,
// starts a new game and puts the interface in one state. Nobody playing uses it.
//
//   ?show=hud       the HUD with things in the quick slots, a hint and a toast
//   ?show=talk      a line from Mina          ?show=choice    Hobb's line with two choices
//   ?show=talk&talk=<conversation>             any conversation of content/dialogue.ts, at its first line,
//                                              or its first choice with &at=choice
//   ?show=bag | make | almanac | quests | map | pause | settings | end
//   &quest=<id>     with any of them: the game skipped to the start of that quest first
//
// When the state is up, `<html>` gets `data-show`, for `--ready "[data-show]"`. The rules are then
// paused, and the save this visit would leave behind is removed when the page closes. With a saved game
// in the browser it does nothing at all, so it can never write over one.
import { isQuestId } from '../content/ids.ts';
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
    const quest = new URLSearchParams(location.search).get('quest');
    if (quest && isQuestId(quest)) sys.quests?.skipTo(quest);
    const bag = sys.inventory;
    bag?.add('axe', 1);
    bag?.add('oak_log', 14);
    bag?.add('plank', 9);
    bag?.add('berry', 3);
    bag?.add('wheat', 7);
    if (bag) bag.selected = 1;

    if (show === 'hud') {
      game.events.emit('hint', { id: 'show', text: 'Hold the left button on a tree or a block to gather it.' });
    } else if (show === 'talk' || show === 'choice') {
      const params = new URLSearchParams(location.search);
      const id = params.get('talk') ?? (show === 'talk' ? 'scene.3' : 'choice.pump');
      sys.talk?.start(id);
      if (show === 'choice' || params.get('at') === 'choice') {
        for (let i = 0; i < 20 && sys.talk?.active && sys.talk.current()?.choices.length === 0; i++) sys.talk.advance();
      }
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
