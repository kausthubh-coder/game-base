// What the interface views share: the one `createGameUi`, the pictures, and who has the screen.
// Each `ui-*.view.ts` asks for it with `bookOf(view)`. The first call makes it, so the views work in
// any order. It is kept per `GameView`, not as a global.
import type { Systems } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';
import { createGameUi, type GameUi, type PanelName } from '../ui/index.ui.ts';
import { createUiArt, type UiArt } from './art.ts';
import { KEY_LIST } from './keys.ts';
import { markNewGame } from './opening.ts';
import { TOKENS, addStyle } from './theme.ts';

/** Panels that stop the rules while they are up. The bag, the Make panel, the Almanac and the quest log do not. */
const MENUS: readonly PanelName[] = ['title', 'pause', 'settings', 'end'];

/** The full map, as the panels view needs it. The map view sets it. */
export interface MapDoor {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
}

export interface Book {
  readonly view: GameView;
  /** The panels, the title, pause, Settings, the prompt, hints, toasts and the end card. */
  readonly ui: GameUi;
  readonly art: UiArt;
  /** The game's systems. One that another agent has not finished is missing, so read each with `?.`. */
  readonly sys: Partial<Systems>;
  /** The panel `createGameUi` has open, or null. */
  readonly panel: PanelName | null;
  /** True while the title, pause, Settings or the end card is up. */
  readonly menuOpen: boolean;
  /** True when the title screen is the live world, with `?title=world` in the address, and not the picture. */
  readonly worldTitle: boolean;
  /** The HUD's box for the minimap. The HUD view sets it. */
  minimapSlot: HTMLElement | null;
  /** The full map. The map view sets it. */
  map: MapDoor | null;
  /** Hears every panel that opens or closes, with its name or null. Returns a function that stops listening. */
  onPanel(fn: (panel: PanelName | null) => void): () => void;
  /** Hears the interface size from Settings: 0.9, 1 or 1.15. It is called at once with the size now. */
  onSize(fn: (size: number) => void): void;
  /**
   * Hears the game start, on the frame it does: by the title's buttons, by the page reloading into a game,
   * or by the debug door. `fresh` is true for a new game and false for a loaded one.
   */
  onStart(fn: (fresh: boolean) => void): void;
  /** True while a panel or the full map is open. The HUD, the hints and the toasts step out from under it. */
  readonly covered: boolean;
  /** Brings `game.player.busy` and `covered` in line with what is open: a panel, the full map or a conversation. The map view calls it when the map opens or closes. */
  settle(): void;
}

const books = new WeakMap<GameView, Book>();

export function bookOf(view: GameView): Book {
  let book = books.get(view);
  if (!book) books.set(view, (book = createBook(view)));
  return book;
}

function createBook(view: GameView): Book {
  const { game, root } = view;
  const sys = game.systems as Partial<Systems>;
  const params = new URLSearchParams(location.search);
  const worldTitle = params.get('title') === 'world';
  const art = createUiArt(view.assets);

  root.classList.add('ui-book');
  addStyle(root, 'tokens', TOKENS);

  const panelListeners = new Set<(panel: PanelName | null) => void>();
  const sizeListeners = new Set<(size: number) => void>();
  const startListeners = new Set<(fresh: boolean) => void>();
  let panel: PanelName | null = null;
  let size = 1;
  /** `?quality=low` holds a level for this visit, so the stored one is not applied over it when the interface is made. */
  let made = false;
  const heldQuality = ['low', 'medium', 'high'].includes(params.get('quality') ?? '');

  const ui = createGameUi(root, game, {
    icon: art.icon,
    picture: art.picture,
    project: (x, y, z) => view.project(x, y, z),
    stats: () => view.stats(),
    // A game in progress can always be gone back to, saved or not.
    hasSave: () => view.started || view.hasSave(),
    // The title's New game is the one start that plays the opening scene. See ./opening.ts.
    newGame() {
      markNewGame();
      view.newGame();
    },
    continueGame() {
      // Back at the title from the pause menu, the game is still here: Continue picks it up without a reload.
      if (view.started) return;
      if (!view.continueGame()) view.newGame();
    },
    saveAndQuit: () => { view.save(); },
    setQuality(quality) {
      if (made || !heldQuality) view.settings.setQuality(quality);
    },
    setVolume: (channel, value) => view.settings.setVolume(channel, value),
    setInterfaceSize(next) {
      size = next;
      root.style.setProperty('--ui-size', String(next));
      for (const fn of sizeListeners) fn(next);
    },
    // The panels are drawn in CSS, on the direction's paper. The pixel frames ui/panel.png and ui/button.png stay in the manifest, unused.
    art: { title: worldTitle ? undefined : art.frames.title },
    keys: KEY_LIST,
    // The panels view binds I, B, J, Tab, M and Esc in one place, so the map and the pause menu cannot both take a key.
    hotkeys: false,
    storageKey: 'greenhollow.ui',
    onChange(next) {
      panel = next;
      view.setPaused('menu', next !== null && MENUS.includes(next));
      settle();
      for (const fn of panelListeners) fn(next);
    },
  });
  made = true;

  let covered = false;
  function settle(): void {
    const mapOpen = book.map?.isOpen ?? false;
    game.player.busy = panel !== null || mapOpen || (sys.talk?.active ?? false);
    covered = panel !== null || mapOpen;
    root.classList.toggle('ui-covered', covered);
  }

  const book: Book = {
    view, ui, art, sys, worldTitle,
    get panel() { return panel; },
    get menuOpen() { return panel !== null && MENUS.includes(panel); },
    minimapSlot: null,
    map: null,
    onPanel(fn) {
      panelListeners.add(fn);
      return () => panelListeners.delete(fn);
    },
    onSize(fn) {
      sizeListeners.add(fn);
      fn(size);
    },
    onStart(fn) {
      startListeners.add(fn);
    },
    get covered() { return covered; },
    settle,
  };

  // A game that has run under a second is new: a save is written after play, and its clock comes back with it.
  let started = false;
  view.onFrame(() => {
    if (started || !view.started) return;
    started = true;
    const fresh = game.clock.seconds < 1;
    for (const fn of startListeners) fn(fresh);
  });

  return book;
}
