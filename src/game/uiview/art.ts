// Pictures for the interface, all from the manifest through the asset loader: icons by name from either
// icon sheet, portraits, the first frame of a sprite, the three `ui` pictures, and the painted interface
// kit: the `uikit` images and the `uitabs` sheet of gold line icons. This is the one file
// of the interface views that touches src/features/assets.
import type { Assets, TileCell } from '../../features/assets/index.ts';
import type { IconRef, NineSlice, PictureRef } from '../ui/index.ui.ts';

/** The folder the manifest's paths are relative to, as the shell's art.ts loads it. */
const assetBase = (): string => new URL('assets/', document.baseURI).href;

export interface UiArt {
  /** An icon cell by name, from whichever icon sheet has it, or null. */
  icon(name: string): IconRef | null;
  /** A picture for an Almanac page: a portrait when the name has one, else the first standing frame of a sprite, or null. */
  picture(name: string): PictureRef | null;
  /** An element that draws an icon and fills the box it is put in, or null when no sheet has the name. */
  iconElement(name: string): HTMLElement | null;
  /** An element that draws a portrait and fills the box it is put in, or null when there is none. */
  portraitElement(name: string): HTMLElement | null;
  /** The painted kit by name (`panel`, `slot`, `minimap-ring` …) as URLs. Empty when the manifest has no `uikit`. */
  readonly kit: Readonly<Record<string, string>>;
  /** A gold line icon from the `uitabs` sheet (`bag`, `settings`, `sun` …) that fills its box, or null. */
  tabElement(name: string): HTMLElement | null;
  /** The `ui` pictures, each left out when the manifest does not list it. */
  readonly frames: { title?: string; panel?: NineSlice; button?: NineSlice };
}

/** A span that shows one cell of a sheet of tiles, scaled to whatever size CSS gives the span. */
function cellElement(url: string, cell: TileCell): HTMLElement {
  const [left, top, right, bottom] = cell.uv;
  const across = 1 / (right - left), down = 1 / (bottom - top);
  const element = document.createElement('span');
  element.className = 'ui-cell';
  element.style.backgroundImage = `url("${url}")`;
  element.style.backgroundSize = `${across * 100}% ${down * 100}%`;
  // A percentage position spreads the cells over the free room, which is the sheet less one cell.
  element.style.backgroundPosition = `${across > 1 ? (cell.column / (across - 1)) * 100 : 0}% ${down > 1 ? (cell.row / (down - 1)) * 100 : 0}%`;
  return element;
}

export function createUiArt(assets: Assets): UiArt {
  const icons = new Set(assets.iconNames());
  const portraits = assets.sheetNames().includes('portraits') ? assets.sheet('portraits') : null;
  const portraitNames = new Set(portraits?.names ?? []);

  const image = (name: string): string | undefined => (assets.imageNames('ui').includes(name) ? assets.image('ui', name).url : undefined);
  const panel = image('panel'), button = image('button');
  // The kit is lazy: nothing here fetches it. CSS asks for each file the first time it draws one.
  const kitEntry = assets.manifest.uikit;
  const kit: Record<string, string> = {};
  for (const [name, file] of Object.entries(kitEntry?.images ?? {})) kit[name] = assetBase() + file;
  const tabs = kitEntry?.tabs;

  return {
    icon(name) {
      if (!icons.has(name)) return null;
      const icon = assets.icon(name);
      return { url: icon.url, x: icon.x, y: icon.y, size: icon.tile };
    },

    picture(name) {
      if (portraits && portraitNames.has(name)) {
        const cell = portraits.cells(name)[0];
        if (cell) return { url: portraits.url, x: cell.x, y: cell.y, width: portraits.tile, height: portraits.tile };
      }
      const entry = assets.manifest.sprites[name];
      if (!entry) return null;
      const stand = entry.animations.idle ?? Object.values(entry.animations)[0];
      const [width, height] = entry.frame;
      return { url: assetBase() + entry.sheet, x: 0, y: (stand?.rows.front ?? 0) * height, width, height };
    },

    iconElement(name) {
      if (!icons.has(name)) return null;
      const icon = assets.icon(name);
      return cellElement(icon.url, icon);
    },

    portraitElement(name) {
      const cell = portraits && portraitNames.has(name) ? portraits.cells(name)[0] : undefined;
      return portraits && cell ? cellElement(portraits.url, cell) : null;
    },

    kit,

    tabElement(name) {
      const at = tabs?.names[name]?.[0];
      if (!tabs || !at) return null;
      // The sheet's grid, from the cells it lists: the loader never opens a lazy file, so its size is not known.
      const cells = Object.values(tabs.names).flat();
      const across = Math.max(...cells.map(([c]) => c)) + 1, down = Math.max(...cells.map(([, r]) => r)) + 1;
      const [column, row] = at;
      const element = document.createElement('span');
      element.className = 'ui-cell ui-smooth';
      element.style.backgroundImage = `url("${assetBase() + tabs.sheet}")`;
      element.style.backgroundSize = `${across * 100}% ${down * 100}%`;
      element.style.backgroundPosition = `${across > 1 ? (column / (across - 1)) * 100 : 0}% ${down > 1 ? (row / (down - 1)) * 100 : 0}%`;
      return element;
    },

    frames: {
      title: image('title'),
      panel: panel ? { url: panel } : undefined,
      button: button ? { url: button } : undefined,
    },
  };
}
