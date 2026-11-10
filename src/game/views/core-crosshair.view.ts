// The crosshair of the free and first-person cameras: a small ring in the middle of the screen, where they
// aim. It fills in when what it is on is within reach, and hides whenever something holds the player.
import type { GameView } from '../shell/view.ts';

export function install(view: GameView): void {
  const style = document.createElement('style');
  style.textContent = `
    .core-crosshair { position: absolute; left: 50%; top: 50%; width: 14px; height: 14px; margin: -7px 0 0 -7px;
      border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.85); box-shadow: 0 0 0 1px rgba(20, 24, 30, 0.45), inset 0 0 0 1px rgba(20, 24, 30, 0.35);
      pointer-events: none; transition: transform 90ms ease-out, background-color 90ms ease-out; }
    .core-crosshair::after { content: ''; position: absolute; left: 50%; top: 50%; width: 2px; height: 2px; margin: -1px 0 0 -1px;
      border-radius: 50%; background: rgba(255, 255, 255, 0.95); }
    .core-crosshair[data-reach] { transform: scale(0.78); background-color: rgba(255, 244, 214, 0.35); }
  `;
  document.head.append(style);
  const mark = document.createElement('div');
  mark.className = 'core-crosshair';
  mark.hidden = true;
  view.root.append(mark);

  let shown = false, reach = false;
  view.onFrame(() => {
    const show = view.settings.camera !== 'tilt' && view.started && !view.paused && !view.game.player.busy;
    if (show !== shown) { shown = show; mark.hidden = !show; }
    const near = show && view.aim !== null;
    if (near !== reach) { reach = near; mark.toggleAttribute('data-reach', near); }
  });
}
