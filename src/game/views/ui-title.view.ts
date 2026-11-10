// The title flow. The game opens on the title screen: New game, Continue (off without a save) and
// Settings. Nothing is stepped until one of them starts the game, because the shell is asked to hold.
//
// The title is the manifest's `ui.title` picture, which fills the screen. With `?title=world` in the
// address it is the live world instead, and the camera drifts slowly over the grant behind the plate.
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { addStyle } from '../uiview/theme.ts';

/** How far the camera strays from the start while it drifts, in blocks east-west and north-south. */
const DRIFT_X = 9, DRIFT_Z = 6;

const STYLE = /* css */ `
/* Settings opened from the title keeps the title's picture behind it, under the shade every panel has. */
.ui-book.ui-unstarted .gu-art-title .gu-stage-settings { background: linear-gradient(var(--ui-scrim), var(--ui-scrim)), var(--gu-title-art) center / cover no-repeat, oklch(0.3 0.06 155); image-rendering: pixelated; }
`;

const WORLD_TITLE = /* css */ `
/* The live world shows through. A soft shade under the plate's side keeps the plate the first thing read. */
.ui-book .gu-stage-title { background: linear-gradient(90deg, oklch(0.2 0.03 60 / 0.6), oklch(0.2 0.03 60 / 0) 62%); image-rendering: auto; }
@container gu (width < 640px) {
  .ui-book .gu-stage-title { background: linear-gradient(0deg, oklch(0.2 0.03 60 / 0.6), oklch(0.2 0.03 60 / 0) 70%); }
}
`;

export function install(view: GameView): void {
  const book = bookOf(view);
  addStyle(view.root, 'title', STYLE);
  view.root.classList.add('ui-unstarted');
  view.holdStart();
  book.ui.open('title');

  // A page that reloaded into a game, and a test that starts one through the debug door, never press a
  // button here. The title, or Settings opened from it, steps aside the moment a game is running.
  book.onStart(() => {
    view.root.classList.remove('ui-unstarted');
    for (let i = 0; i < 3 && book.menuOpen; i++) book.ui.close();
  });

  if (!book.worldTitle) return;
  addStyle(view.root, 'title-world', WORLD_TITLE);

  // The shell tells the camera to follow the hero every frame. While the title is up that point is
  // moved along a slow loop, so the picture behind the plate is never still. When the game starts the
  // camera glides back onto the hero. (Asked of the shell in the report: a `view` call for this.)
  const camera = view.camera;
  const follow = camera.follow.bind(camera);
  let drift = 0;
  camera.follow = (x, y, z) => {
    if (book.panel === 'title') follow(x + Math.sin(drift * 0.11) * DRIFT_X, y, z + Math.cos(drift * 0.07) * DRIFT_Z);
    else follow(x, y, z);
  };
  view.onFrame((dt) => {
    if (book.panel === 'title') drift += dt;
  });
}
