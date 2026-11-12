// A small badge in the bottom right corner of the copy at /experiment/, on the title and in play: it is the
// experiment build, where the cutscenes are tried (docs/cutscenes.md), and its button plays scene 9 there and
// then. The click is what lets the browser start the sound, so the scene plays in place, never after a reload.
// `?experiment=1` shows it anywhere, to look at it.
import type { GameView } from '../shell/view.ts';
import { stageOf } from '../uiview/cutscene-stage.ts';
import { addStyle } from '../uiview/theme.ts';

/** The scene the button plays. */
const SCENE = '9';

const STYLE = /* css */ `
.ui-experiment {
  position: absolute; right: 12px; bottom: 12px; z-index: 30; max-width: calc(100% - 24px); padding: 5px 6px 5px 10px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px;
  font-family: var(--ui-font); font-size: 12px; line-height: 1.4; color: var(--ui-glass-ink);
  background: var(--ui-glass); border-radius: var(--ui-radius-sm); box-shadow: var(--ui-glass-shadow); pointer-events: auto;
}
.ui-experiment b { font-weight: 650; color: var(--ui-new); }
.ui-experiment-play {
  padding: 3px 9px; font: inherit; font-weight: 650; color: var(--ui-glass-ink); cursor: pointer;
  background: transparent; border: 1px solid currentColor; border-radius: var(--ui-radius-sm);
}
.ui-experiment-play:hover { background: oklch(1 0 0 / 0.1); }
.ui-experiment-play:active { background: oklch(1 0 0 / 0.16); }
.ui-experiment-play:disabled { opacity: 0.5; cursor: default; }
.ui-experiment-play:focus-visible { outline: 2px solid oklch(0.89 0.07 188); outline-offset: 2px; }
/* In play on a narrow screen the quick slots reach the corner, so the badge sits just above them. */
@container gu (width < 900px) {
  .ui-book:not(.ui-unstarted) .ui-experiment { bottom: var(--ui-hud-clear); }
}
`;

export function install(view: GameView): void {
  const shown = location.pathname.startsWith('/experiment') || new URLSearchParams(location.search).get('experiment') === '1';
  if (!shown) return;
  addStyle(view.root, 'experiment', STYLE);
  const badge = document.createElement('div');
  badge.className = 'ui-experiment';
  badge.dataset.key = 'experiment';
  const tag = document.createElement('b');
  tag.textContent = 'Experiment build.';
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'ui-experiment-play';
  play.dataset.key = 'experiment:scene9';
  play.textContent = 'Play scene 9: Something outside';
  play.addEventListener('click', () => {
    if (stageOf(view).play(SCENE)) play.blur();
  });
  badge.append(tag, ' Cutscenes are being tried here.', play);
  view.root.append(badge);

  let since = 0;
  view.onFrame((dt) => {
    since += dt;
    if (since < 0.25) return;
    since = 0;
    play.disabled = stageOf(view).playing || view.online !== null;
  });
}
