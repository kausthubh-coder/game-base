// The Heartstone on the HUD: how alive the player's land is, as a glass strip under the tracked quest.
// It shows once the player has touched the stone (the flag `heart.seen`) and stays from then on. When the
// level rises the number pulses and a "+n" rises beside it; the Custodian's line for 3, 6 and 10 is a
// toast that the hall's rules send.
//
// The bar fills toward the next level the Custodian remarks on (3, 6, 10), then toward each next five.
// The level is the rules' own (`hall.heart()`), looked at twice a second, not every frame.
//
// The HUD's own view (ui-hud) installs after this one, so the strip is put into its right column on the
// first frame the column is there.
import { CUSTODIAN_HEART } from '../content/dialogue.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { addStyle } from '../uiview/theme.ts';

/** Seconds between two looks at the Heartstone's level. */
const LOOK_EVERY = 0.5;
/** Past the last level the Custodian remarks on, the bar fills toward each next multiple of this. */
const STEP_AFTER = 5;
const SEEN = 'heart.seen';

const STYLE = /* css */ `
.ui-book .ui-heart { flex: none; align-self: flex-end; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 4px 10px; width: 260px; padding: 9px 14px 10px; pointer-events: none; }
.ui-book .ui-heart[hidden] { display: none; }
.ui-heart-gem {
  grid-row: span 2; width: 20px; height: 20px; transform: rotate(45deg); border-radius: 4px;
  background: linear-gradient(135deg, oklch(0.93 0.09 180), oklch(0.62 0.12 192)); box-shadow: 0 0 10px oklch(0.85 0.1 185 / 0.55);
}
.ui-heart-name { font-size: 13px; font-weight: 500; color: var(--ui-glass-ink-2); }
.ui-heart-level { position: relative; font-size: 18px; font-weight: 700; line-height: 1; color: var(--ui-glass-ink); font-variant-numeric: tabular-nums lining-nums; text-shadow: var(--ui-text-shadow); }
.ui-heart-bar { grid-column: 2 / 4; height: 4px; border-radius: 2px; background: oklch(1 0 0 / 0.2); overflow: hidden; }
.ui-heart-fill { height: 100%; width: 100%; transform-origin: left; border-radius: 2px; background: oklch(0.89 0.07 188); transition: transform 600ms var(--ui-ease); }
.ui-heart-plus {
  position: absolute; right: 100%; top: 50%; margin: -9px 6px 0 0; font-size: 14px; font-weight: 700; color: oklch(0.89 0.07 188);
  opacity: 0; white-space: nowrap; text-shadow: var(--ui-text-shadow);
}
/* The level rose: the gem flares, the number swells, and "+n" floats up and fades. */
.ui-heart.is-rising .ui-heart-gem { animation: ui-heart-flare 1.4s var(--ui-ease); }
.ui-heart.is-rising .ui-heart-level { animation: ui-heart-swell 0.9s var(--ui-ease); }
.ui-heart.is-rising .ui-heart-plus { animation: ui-heart-plus 1.6s var(--ui-ease); }
@keyframes ui-heart-flare { 0% { box-shadow: 0 0 10px oklch(0.85 0.1 185 / 0.55); } 25% { box-shadow: 0 0 22px 6px oklch(0.9 0.12 185 / 0.9); } 100% { box-shadow: 0 0 10px oklch(0.85 0.1 185 / 0.55); } }
@keyframes ui-heart-swell { 0% { transform: scale(1); } 30% { transform: scale(1.45); color: oklch(0.93 0.09 180); } 100% { transform: scale(1); } }
@keyframes ui-heart-plus { 0% { opacity: 0; transform: translateY(6px); } 20% { opacity: 1; transform: translateY(0); } 70% { opacity: 1; } 100% { opacity: 0; transform: translateY(-10px); } }
@media (prefers-reduced-motion: reduce) {
  .ui-heart.is-rising .ui-heart-gem, .ui-heart.is-rising .ui-heart-level { animation: none; }
  .ui-heart-fill { transition: none; }
}
@media (max-width: 560px) {
  .ui-book .ui-heart { width: 13.5em; padding: 7px 12px 8px; }
}
`;

/** The level the bar fills toward from this one. */
function nextMark(level: number): number {
  for (const [at] of CUSTODIAN_HEART) if (level < at) return at;
  return (Math.floor(level / STEP_AFTER) + 1) * STEP_AFTER;
}

/** The level the bar starts from. */
function lastMark(level: number): number {
  let from = 0;
  for (const [at] of CUSTODIAN_HEART) if (level >= at) from = at;
  return Math.max(from, Math.floor(level / STEP_AFTER) * STEP_AFTER);
}

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game, root } = view;
  addStyle(root, 'heart', STYLE);

  const box = document.createElement('section');
  box.className = 'ui-heart gb-panel';
  box.dataset.key = 'hud:heart';
  box.setAttribute('role', 'meter');
  box.setAttribute('aria-label', 'Heartstone');
  box.setAttribute('aria-valuemin', '0');
  box.hidden = true;
  const gem = document.createElement('span');
  gem.className = 'ui-heart-gem';
  gem.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.className = 'ui-heart-name';
  name.textContent = 'Heartstone';
  const level = document.createElement('span');
  level.className = 'ui-heart-level';
  const plus = document.createElement('span');
  plus.className = 'ui-heart-plus';
  plus.setAttribute('aria-hidden', 'true');
  level.append(plus);
  const number = document.createTextNode('0');
  level.prepend(number);
  const bar = document.createElement('span');
  bar.className = 'ui-heart-bar';
  bar.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('span');
  fill.className = 'ui-heart-fill';
  bar.append(fill);
  box.append(gem, name, level, bar);
  box.addEventListener('animationend', (event) => {
    if (event.target === plus) box.classList.remove('is-rising');
  });

  let placed = false;
  /** The level on screen, or -1 before the first look. */
  let shown = -1;
  let sinceLook = LOOK_EVERY;

  function draw(now: number): void {
    const rose = shown >= 0 && now > shown;
    if (rose) {
      plus.textContent = `+${now - shown}`;
      // Taken off and put back, so a second rise right after the first plays again.
      box.classList.remove('is-rising');
      void box.offsetWidth;
      box.classList.add('is-rising');
    }
    shown = now;
    number.data = String(now);
    const from = lastMark(now), to = nextMark(now);
    fill.style.transform = `scaleX(${(now - from) / (to - from)})`;
    box.setAttribute('aria-valuenow', String(now));
    box.setAttribute('aria-valuetext', `${now}, next mark ${to}`);
  }

  game.events.on('flag.changed', ({ flag }) => {
    if (flag === SEEN) sinceLook = LOOK_EVERY;
  });

  view.onFrame((dt) => {
    if (!placed) {
      const column = root.querySelector('.gb-hud-right');
      if (!column) return;
      column.append(box);
      placed = true;
    }
    if (!view.started) return;
    sinceLook += dt;
    if (sinceLook < LOOK_EVERY) return;
    sinceLook = 0;
    const seen = game.flags.is(SEEN);
    if (box.hidden === seen) box.hidden = !seen;
    const hall = book.sys.hall;
    if (!seen || !hall) return;
    const now = hall.heart().level;
    if (now !== shown) draw(now);
  });
}
