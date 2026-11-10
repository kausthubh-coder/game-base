// Sleep shows: the screen fades to dark, a card says the day and the hour, the world moves to morning
// while it is dark, and the screen fades back in. The clock is src/game/uiview/sleep.ts, which hands the
// time system a sleep curtain, so the morning comes only once the screen is dark.
//
// From `sleep()` until the screen is clear the player is busy, the HUD steps out and the keys are the
// card's: nothing can be opened, walked or used half asleep.
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { createSleepCard, hasCurtain } from '../uiview/sleep.ts';
import { addStyle } from '../uiview/theme.ts';

const STYLE = /* css */ `
.st-sleep { position: absolute; inset: 0; z-index: 45; pointer-events: none; display: grid; place-items: center; --st-black: 0; --st-card: 0; }
.st-sleep[hidden] { display: none; }
.st-sleep-veil { position: absolute; inset: 0; background: oklch(0.12 0.012 60); opacity: var(--st-black); transition: opacity 60ms linear; }
.st-sleep-card {
  position: relative; display: grid; justify-items: center; gap: 12px;
  color: oklch(0.95 0.03 88);
  opacity: var(--st-card);
  transform: translateY(calc(6px * (1 - var(--st-card))));
  transition: opacity 60ms linear, transform 60ms linear;
  -webkit-font-smoothing: antialiased;
}
.st-sleep-eyebrow { font: 600 13px / 1 var(--ui-font); letter-spacing: 0.22em; text-transform: uppercase; color: oklch(0.86 0.09 84); }
.st-sleep-day { margin: 0; font: 400 clamp(44px, 6.5vw, 76px) / 1 var(--ui-font); letter-spacing: -0.015em; }
.st-sleep-rule { width: 56px; height: 2px; background: var(--ui-brass); }
.st-sleep-hour { font: 600 17px / 1 var(--ui-font); letter-spacing: 0.04em; font-variant-numeric: tabular-nums lining-nums; color: oklch(0.86 0.035 85); }
.ui-book.st-asleep .gb-hud, .ui-book.st-asleep .gb-beacon, .ui-book.st-asleep .gu-top,
.ui-book.st-asleep .gu-toasts, .ui-book.st-asleep .gu-prompt, .ui-book.st-asleep .marks { visibility: hidden; }
`;

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game, root } = view;
  const time = book.sys.time;
  if (!hasCurtain(time)) return;
  addStyle(root, 'story-sleep', STYLE);

  const layer = document.createElement('div');
  layer.className = 'st-sleep';
  layer.hidden = true;
  layer.innerHTML = /* html */ `
    <div class="st-sleep-veil"></div>
    <div class="st-sleep-card" role="status" aria-live="polite">
      <span class="st-sleep-eyebrow">Morning</span>
      <h2 class="st-sleep-day"></h2>
      <span class="st-sleep-rule"></span>
      <span class="st-sleep-hour"></span>
    </div>`;
  root.append(layer);
  const day = layer.querySelector<HTMLElement>('.st-sleep-day')!;
  const hour = layer.querySelector<HTMLElement>('.st-sleep-hour')!;

  const card = createSleepCard(game, time);
  let showing = false;
  /** True while the card holds the player. The hold ends on a step, so time passed with no frame drawn ends it too. */
  let holding = false;

  view.onSimStep((dt) => {
    card.step(dt);
    if (card.frame.active) {
      game.player.busy = true;
      holding = true;
    } else if (holding) {
      holding = false;
      // Awake: whatever is open says whether the player is busy again.
      book.settle();
    }
  });

  view.onFrame(() => {
    const frame = card.frame;
    if (frame.active !== showing) {
      showing = frame.active;
      layer.hidden = !showing;
      root.classList.toggle('st-asleep', showing);
    }
    if (!showing) return;
    if (day.textContent !== frame.day) day.textContent = frame.day;
    if (hour.textContent !== frame.hour) hour.textContent = frame.hour;
    layer.style.setProperty('--st-black', frame.black.toFixed(3));
    layer.style.setProperty('--st-card', frame.card.toFixed(3));
  });

  // Half asleep, no key opens a panel or the pause menu. In the capture phase, before the ui-* views.
  window.addEventListener('keydown', (event) => {
    if (!card.frame.active) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });
}
