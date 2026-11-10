// The game's entry: the page's canvas and overlay go to boot, which wires everything else.
import { boot } from './game/boot.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#view');
const root = document.querySelector<HTMLElement>('#ui');
const loading = document.querySelector<HTMLElement>('#loading');

if (canvas && root) {
  boot({
    canvas,
    root,
    onProgress(done) {
      if (loading) loading.textContent = `Loading ${Math.round(done * 100)}%`;
    },
  }).then(
    () => loading?.remove(),
    (error: unknown) => {
      console.error('[game] the game did not start:', error);
      if (loading) loading.textContent = `The game did not start. ${error instanceof Error ? error.message : String(error)}`;
    },
  );
}
