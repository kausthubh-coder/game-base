import type { Graphics } from '../shell/graphics.ts';
// The shapes the panels share: what createGameUi takes, what it returns, and what one panel is.

import type { Game } from '../api.sim.ts';

/** One square cell of the icon sheet, in sheet pixels. */
export interface IconRef {
  url: string;
  x: number;
  y: number;
  size: number;
}

/** One frame of a sprite sheet, in sheet pixels. For the picture on an Almanac page. */
export interface PictureRef {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A border image cut in nine. `slice` is the corner size in image pixels and `width` the size it is drawn at in
 * CSS pixels. Left out, they fit the 96 by 96 ui/panel.png (28 and 56) and the 96 by 32 ui/button.png (6 and 6).
 */
export interface NineSlice {
  url: string;
  slice?: number;
  width?: number;
}

export type Quality = 'low' | 'medium' | 'high' | 'auto';
export type VolumeChannel = 'music' | 'ambience' | 'effects' | 'voice';

export interface Settings {
  quality: Quality;
  /** Each volume runs from 0 to 1. */
  music: number;
  ambience: number;
  effects: number;
  voice: number;
  /** The interface size: 0.9, 1 or 1.15. */
  size: number;
}

/** The numbers on the end card. */
export interface EndStats {
  days: number;
  wheat: number;
  blocks: number;
  pages: number;
}

export interface KeyHint {
  action: string;
  keys: readonly string[];
}

export type PanelName = 'bag' | 'make' | 'almanac' | 'quests' | 'title' | 'pause' | 'settings' | 'account' | 'end';

export interface GameUiOptions {
  /** An icon from the manifest by name, or null when it has none. Null draws a plain square with two letters. */
  icon(name: string): IconRef | null;
  /** A sprite frame from the manifest for an Almanac page. When it is missing or returns null, `icon` is tried. */
  picture?(name: string): PictureRef | null;
  /** A small line icon for a menu button (`resume`, `settings`, `account`, `save-quit` …) that fills its box, or null for none. */
  ornament?(name: string): HTMLElement | null;
  /** True once the player has the Almanac, so the pause menu shows its tile. */
  hasAlmanac?(): boolean;
  /** Opens the full map. The pause menu shows a Map tile only when this is given. */
  openMap?(): void;
  /** Where a point in the world is on screen, in CSS pixels from the root's top left, or null when it is off screen. */
  project(x: number, y: number, z: number): { x: number; y: number } | null;
  /** The numbers for the end card, read when the card opens. */
  stats(): EndStats;
  /** True when Continue has a save to load. Read each time the title opens. */
  hasSave(): boolean;
  /** Title: New game. The title closes after it returns. */
  newGame(): void;
  /** Title: Continue. The title closes after it returns. */
  continueGame(): void;
  /** Pause: Save and return to title. The title opens after it returns. */
  saveAndQuit(): void;
  /** Called once when the interface is made, with the stored value, and again on every change. */
  graphics?: { get(): Readonly<Graphics>; set(next: Partial<Graphics>): void };
  setQuality(quality: Quality): void;
  /** Called once per channel when the interface is made, and again on every change. 0 to 1. */
  setVolume(channel: VolumeChannel, value: number): void;
  /** Called with 0.9, 1 or 1.15 so the HUD can match. The panels scale themselves. */
  setInterfaceSize?(size: number): void;
  /** The View section of Settings: the camera and how characters are drawn. The game stores both. Left out, there is no View section. */
  view?: ViewChoices;
  /** Pictures from the manifest's `ui` entry. Each one is optional and has a CSS fallback. */
  art?: { title?: string; panel?: NineSlice; button?: NineSlice };
  /** The list of keys in Settings. Defaults to DEFAULT_KEYS. */
  keys?: readonly KeyHint[];
  /** False stops the interface from listening to I, B, J, Tab and Esc itself. Default true. */
  hotkeys?: boolean;
  /** Pixels to keep free at the bottom for the HUD's quick slots. The prompt sits above it. Default 96. */
  hudBottom?: number;
  /** The localStorage key for settings. Default `game-ui.settings`. */
  storageKey?: string;
  /** Called after a panel opens or closes, with the open panel or null. */
  onChange?(panel: PanelName | null): void;
}

/** The View section's choices. The game owns and stores them; Settings only shows them and passes picks on. */
export interface ViewChoices {
  camera(): ViewCamera;
  setCamera(mode: ViewCamera): void;
  mouse(): ViewMouse;
  setMouse(style: ViewMouse): void;
  tiltTurn(): ViewTiltTurn;
  setTiltTurn(turn: ViewTiltTurn): void;
  characters(): ViewCharacters;
  setCharacters(look: ViewCharacters): void;
}
export type ViewCamera = 'tilt' | 'free' | 'first';
/** How the mouse turns the free camera: `drag` with the right button held, as in Roblox, or `lock` it, as in Genshin. */
export type ViewMouse = 'drag' | 'lock';
/** Where the 2.5D camera rests after a drag: on the nearest quarter turn, or where it was let go. */
export type ViewTiltTurn = 'quarter' | 'smooth';
export type ViewCharacters = 'sprites' | 'models';

export interface GameUi {
  /** Opens a panel, replacing any open one. `detail` is a page id for the Almanac. */
  open(panel: PanelName, detail?: string): void;
  /** Closes the open panel. Settings goes back to the panel it was opened from. */
  close(): void;
  toggle(panel: PanelName): void;
  /** True when this panel is open, or when any panel is open if no name is given. */
  isOpen(panel?: PanelName): boolean;
  /** The stored settings. */
  settings(): Settings;
  /**
   * Gives the pause menu an Account entry that opens this panel. Closing it goes back to the pause menu.
   * Until a view calls this the pause menu has no such entry, and `open('account')` does nothing.
   */
  setAccount(panel: () => PanelView): void;
  /** The hints and the Almanac's note at the top of the screen. */
  readonly notices: {
    /** While held they step aside and their time stands still, so a story card can have the top of the screen. */
    hold(on: boolean): void;
    /** A hint with this id is never shown, because something else on screen already says it. */
    skip(id: string): void;
  };
  /** Removes every element and listener. */
  dispose(): void;
}

/** What a panel gets to work with. */
export interface UiContext {
  game: Game;
  options: GameUiOptions;
  ui: GameUi;
  settings: Settings;
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
  /** Sends `ui.sound`. */
  sound(sound: 'click' | 'open' | 'close'): void;
  /** Facts learned since their page was last shown, by page id. The Almanac inks them in and clears them. */
  fresh: Map<string, Set<string>>;
  /** Pages completed since they were last shown. */
  freshComplete: Set<string>;
}

/** One open panel. `render` rebuilds `body` from the game. */
export interface PanelView {
  title: string;
  /** Extra class names for the panel frame. */
  className?: string;
  /** Tabs or other controls for the heading row. */
  head?: HTMLElement;
  body: HTMLElement;
  /** False hides the heading row and the close button, for the title and the end card. */
  framed?: boolean;
  /**
   * A full-screen menu instead of a card: the night sky behind, a top rail with the line icon `icon`, the title,
   * `head` in the middle and the close button, and a bottom rail holding `cues`, the key prompts the view keeps up to date.
   */
  screen?: { icon: string; cues: HTMLElement };
  render(): void;
  /** Returns true when the panel used the key. */
  onKey?(event: KeyboardEvent): boolean;
}
