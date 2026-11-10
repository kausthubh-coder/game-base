// The map's small pictures, as SVG path data in a 24 by 24 box. The canvas draws them with Path2D
// and the picker shows the same paths as inline SVG, so a waypoint looks the same in both.
import type { PinKind, WaypointIcon } from './marks.sim.ts';

export const WAYPOINT_PATHS: Record<WaypointIcon, string> = {
  flag: 'M6 2.5h2.2V4H19l-2.6 4L19 12H8.2v9.5H6z',
  star: 'M12 2.5l2.8 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.8 3.2 1.3-6.5-4.9-4.5 6.6-.8z',
  home: 'M12 3 2.5 11.5h2.7V20h5v-5.5h3.6V20h5v-8.5h2.7z',
  gem: 'M7 4h10l4.5 5.5L12 21 2.5 9.5zM7.6 9.5 12 17l4.4-7.5z',
  leaf: 'M4.5 19.5C4 10 9.5 4 20 4c.5 10.5-5.5 16-13.5 15.5l6-7.5-1.4-1.1z',
  fish: 'M2.5 12c3.2-5 9.3-6 13.5-2l5-4v12l-5-4c-4.2 4-10.3 3-13.5-2zm5 -1.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z',
  danger: 'M12 2.5 22.5 20.5h-21zM10.9 9v6h2.2V9zm0 7.4v2.2h2.2v-2.2z',
  heart: 'M12 21C5.5 15.5 2.5 12.3 2.5 8.4a5.1 5.1 0 0 1 9.5-2.6 5.1 5.1 0 0 1 9.5 2.6c0 3.9-3 7.1-9.5 12.6z',
};

export const WAYPOINT_NAMES: Record<WaypointIcon, string> = {
  flag: 'Flag', star: 'Star', home: 'Home', gem: 'Ore', leaf: 'Plants', fish: 'Fishing', danger: 'Danger', heart: 'Favorite',
};

export const PIN_PATHS: Record<PinKind, string> = {
  waystone: 'M8.5 21V8.5C8.5 5 10 2.5 12 2.5s3.5 2.5 3.5 6V21zM11 9h2v6h-2z',
  gate: 'M3.5 21V11a8.5 8.5 0 0 1 17 0v10h-4.2V11a4.3 4.3 0 0 0-8.6 0v10z',
  shop: 'M5.5 8.5h13L20 21H4zM8.6 8.5V6.4a3.4 3.4 0 0 1 6.8 0v2.1h-1.7V6.4a1.7 1.7 0 0 0-3.4 0v2.1z',
  vault: 'M4.5 3.5h15V21h-15zM12 8.5a2.2 2.2 0 0 0-1.1 4.1V16h2.2v-3.4A2.2 2.2 0 0 0 12 8.5z',
  quest: 'M10.2 2.5h3.6l-.7 12.5h-2.2zM12 17a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z',
  farm: 'M11 21.5v-8C7 13.5 4.5 11 4.5 6.5c4.2 0 6.3 2 6.9 5 .3-5 2.6-8 8.1-8 0 6.2-3 9.6-6.5 10v8z',
};

export const PIN_NAMES: Record<PinKind, string> = {
  waystone: 'Waystone', gate: 'Old gate', shop: 'Shop', vault: 'Vault', quest: 'Quest', farm: 'Farm',
};

/** An arrow that points up, for the player and for marks at the edge. */
export const ARROW_PATH = 'M12 2.5 20 20l-8-4.2L4 20z';

/** '#rrggbb' from 0xRRGGBB. */
export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** An inline SVG of one path, for a button. */
export function svgIcon(path: string, fill = 'currentColor'): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${fill}" fill-rule="evenodd" d="${path}"/></svg>`;
}
