// A small badge in the bottom right corner of the copy at /playtest/, on the title and in play: it is a
// test build, and the stable game is at the site's root. `?playtest=1` shows it anywhere, to look at it.
import type { GameView } from '../shell/view.ts';
import { addStyle } from '../uiview/theme.ts';

const STYLE = /* css */ `
.ui-playtest {
  position: absolute; right: 12px; bottom: 12px; z-index: 30; max-width: calc(100% - 24px); padding: 5px 10px;
  font-family: var(--ui-font); font-size: 12px; line-height: 1.4; color: var(--ui-glass-ink);
  background: var(--ui-glass); border-radius: var(--ui-radius-sm); box-shadow: var(--ui-glass-shadow); pointer-events: auto;
}
.ui-playtest b { font-weight: 650; color: var(--ui-new); }
.ui-playtest a { color: oklch(0.89 0.07 188); font-weight: 650; }
.ui-playtest a:focus-visible { outline: 2px solid oklch(0.89 0.07 188); outline-offset: 2px; }
/* In play on a narrow screen the quick slots reach the corner, so the badge sits just above them. */
@container gu (width < 900px) {
  .ui-book:not(.ui-unstarted) .ui-playtest { bottom: var(--ui-hud-clear); }
}
`;

export function install(view: GameView): void {
  const shown = location.pathname.startsWith('/playtest') || new URLSearchParams(location.search).get('playtest') === '1';
  if (!shown) return;
  addStyle(view.root, 'playtest', STYLE);
  const badge = document.createElement('div');
  badge.className = 'ui-playtest';
  badge.dataset.key = 'playtest';
  const tag = document.createElement('b');
  tag.textContent = 'Playtest build.';
  const link = document.createElement('a');
  link.href = '/';
  link.textContent = '/';
  badge.append(tag, ' Something broke? Play the stable game at ', link);
  view.root.append(badge);
}
