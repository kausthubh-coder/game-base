// Starts the game: makes the shell, installs every view, opens the debug door and draws the first frame.
//
// A view is a file in src/game/views/ named `<something>.view.ts` that exports `install(view)`. They are
// found with a glob and installed in the order of their file names, so adding one needs no edit here or
// anywhere else. A view that throws is logged and skipped, and the game still starts.
import { createDoor, type DebugDoor } from './shell/door.ts';
import { createShell } from './shell/game.ts';
import { takeAfterReload } from './shell/save.ts';
import type { GameView, ViewModule } from './shell/view.ts';

const views = import.meta.glob<ViewModule>('./views/*.view.ts', { eager: true });

declare global {
  interface Window {
    __game?: DebugDoor;
  }
}

export interface BootOptions {
  canvas: HTMLCanvasElement;
  /** The element over the canvas that views put their HTML in. */
  root: HTMLElement;
  onProgress?: (done: number) => void;
}

export async function boot(options: BootOptions): Promise<GameView> {
  const shell = await createShell(options);
  const view = shell.view;

  for (const path of Object.keys(views).sort()) {
    const name = path.slice(path.lastIndexOf('/') + 1);
    try {
      const install = views[path]?.install;
      if (install) await install(view);
      else console.warn(`[game] ${name} exports no install(view), so it was skipped.`);
    } catch (error) {
      console.error(`[game] the view ${name} threw while installing and was skipped:`, error);
    }
  }

  for (const left of shell.systems.leftOut) console.info(`[game] the ${left.name} system is left out: ${left.why}.`);
  window.__game = createDoor(shell);

  // A page that reloaded to start over does what it reloaded for. Otherwise the game starts by itself
  // unless a title screen, or `?hold` in the address, asked to do it.
  const after = takeAfterReload();
  if (after === 'new') view.newGame();
  else if (after === 'continue') view.continueGame() || view.newGame();
  else if (!shell.holdsStart) view.continueGame() || view.newGame();

  shell.run();
  return view;
}
