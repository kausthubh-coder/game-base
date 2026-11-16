// Watching the film as a player would: the whole window, no lab controls, a Begin press first (browsers keep
// sound off until one), hold anything to skip, and at the end "Play it again" or back to the lab. These are
// the game's own pieces, so they wear its interface look.
import type { Player } from './player.ts';

/** Seconds a press has to be held to skip. */
const HOLD = 1;

export interface Watch {
  readonly active: boolean;
  enter(): void;
  exit(): void;
  /** A key while watching. Returns true when the watch used it. */
  key(e: KeyboardEvent): boolean;
}

function button(className: string, label: string) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  return b;
}

export function createWatch(player: Player, view: HTMLElement, onExit: () => void): Watch {
  const { film, state } = player;
  let active = false;
  let holding = 0;
  let input = 0;

  const begin = document.createElement('div');
  begin.className = 'w-begin';
  const beginButton = button('w-btn w-primary', 'Begin');
  const beginNote = document.createElement('p');
  beginNote.textContent = 'With sound. Hold any key to skip.';
  begin.append(beginButton, beginNote);

  const end = document.createElement('div');
  end.className = 'w-end';
  const again = button('w-btn w-primary', 'Play it again');
  const back = button('w-btn', 'Back to the lab');
  end.append(again, back);

  const skip = document.createElement('div');
  skip.className = 'w-skip';
  // The ring is a plain stroke: a conic gradient under a mask held the film for 230 ms the first time it showed.
  skip.innerHTML = '<svg class="w-ring" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="10.5" pathLength="100"/><circle class="w-fill" cx="13" cy="13" r="10.5" pathLength="100"/></svg><span>Hold to skip</span>';
  const fill = skip.querySelector('.w-fill') as SVGCircleElement;
  const setHold = (p: number) => fill.style.setProperty('stroke-dashoffset', String(100 - p * 100));

  const leave = button('w-leave', 'Lab');
  leave.setAttribute('aria-label', 'Back to the lab');
  leave.title = 'Back to the lab (Esc)';

  const overlays = [begin, end, skip, leave];
  for (const x of overlays) x.hidden = true;
  view.append(...overlays);

  function show() {
    const atEnd = state.t >= film.length && !state.playing;
    const recent = performance.now() - input < 3000;
    // The pieces that come and go fade on their own layers; only leaving the watch takes them off the page.
    begin.hidden = !active;
    begin.classList.toggle('gone', state.playing || state.t > 0);
    end.hidden = !active || !atEnd;
    skip.hidden = !active;
    skip.classList.toggle('on', state.playing && (recent || holding > 0));
    leave.hidden = !active;
    leave.classList.toggle('on', !state.playing || recent);
  }
  player.onPaint(show);

  function startHold() {
    if (!active || !state.playing || holding) return;
    input = performance.now();
    holding = input;
    const step = (now: number) => {
      if (!holding) return;
      const p = Math.min(1, (now - holding) / 1000 / HOLD);
      setHold(p);
      if (p >= 1) {
        holding = 0;
        setHold(0);
        // Stop on the last picture now, so the end card comes with it and not a frame later.
        player.seek(film.length);
        player.pause();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    show();
  }
  function stopHold() {
    holding = 0;
    setHold(0);
    show();
  }

  beginButton.onclick = () => player.play();
  again.onclick = () => { player.seek(0); player.play(); };
  back.onclick = () => watch.exit();
  leave.onclick = () => watch.exit();
  view.addEventListener('pointerdown', (e) => {
    if (!active || (e.target as Element).closest('button')) return;
    startHold();
  });
  window.addEventListener('pointerup', stopHold);
  window.addEventListener('pointercancel', stopHold);
  window.addEventListener('pointermove', () => { if (active) { input = performance.now(); show(); } }, { passive: true });

  const watch: Watch = {
    get active() { return active; },
    enter() {
      active = true;
      document.body.classList.add('watch');
      player.pause();
      player.seek(0);
      beginButton.focus();
    },
    exit() {
      active = false;
      stopHold();
      document.body.classList.remove('watch');
      player.pause();
      onExit();
    },
    key(e) {
      if (!active) return false;
      if (e.key === 'Escape') { watch.exit(); return true; }
      if (e.type === 'keyup') { stopHold(); return true; }
      // Before Begin and after the end, keys work the buttons as usual.
      if (!state.playing) return false;
      if (!e.repeat) startHold();
      return true;
    },
  };
  return watch;
}
