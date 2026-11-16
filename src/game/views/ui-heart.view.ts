// The Heartstone on the HUD, as the approved mockup draws it (assets-src/concept/interface/heartstone): its name
// and level in cream over the world, and beside it a night-glass pill of six diamond notches, one lit for each
// step of chapter 30's ladder. It shows once the player has touched the stone (the flag `heart.seen`) and stays.
// When the level rises the newly lit notch flares and a "+1" rises beside the number.
//
// A click on it, or "E" on the stone in the Hall, opens "The next step": what the next level asks for, each part
// with how much of it holds, what that level puts in reach, and the pump's warning.
//
// The level is the settlement's own (`hall.heart()`), looked at twice a second, not every frame. The HUD's own
// view (ui-hud) installs after this one, so the strip is put into its right column on the first frame it is there.
import { HEART_NOTE } from '../content/people.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { el, homePanel, rule } from '../uiview/home-panel.ts';
import { addStyle } from '../uiview/theme.ts';

/** Seconds between two looks at the Heartstone's level. */
const LOOK_EVERY = 0.5;
const SEEN = 'heart.seen';
const STEPS = 6;

const STYLE = /* css */ `
.ui-book .ui-heart {
  flex: none; align-self: flex-end; display: flex; align-items: center; gap: 10px; padding: 4px 2px; border: 0; background: none;
  pointer-events: auto; cursor: pointer; color: var(--ui-glass-ink); font: inherit;
}
.ui-book .ui-heart[hidden] { display: none; }
.ui-heart-name { position: relative; font: 700 19px/1 var(--ui-display); text-shadow: var(--ui-text-shadow); white-space: nowrap; }
.ui-heart-name::after { content: ''; display: inline-block; width: 9px; height: 9px; margin-left: 8px; transform: rotate(45deg) translateY(-2px); border: 2px solid var(--ui-gold-bright); filter: drop-shadow(0 1px 2px rgb(10 12 20 / 0.7)); }
.ui-heart-notches { display: flex; gap: 7px; padding: 8px 12px; border-radius: 16px; background: var(--ui-glass); box-shadow: inset 0 0 0 1.5px var(--ui-glass-line), var(--ui-glass-shadow); }
.ui-heart-notch { width: 10px; height: 10px; transform: rotate(45deg); border-radius: 2px; background: rgb(255 255 255 / 0.16); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.22); }
.ui-heart-notch.is-lit { background: linear-gradient(135deg, var(--ui-gold-bright), #d8a94e); box-shadow: 0 0 6px rgb(240 212 138 / 0.65); }
.ui-heart-notch.is-sixth.is-lit { background: linear-gradient(135deg, oklch(0.93 0.09 180), oklch(0.62 0.12 192)); box-shadow: 0 0 8px oklch(0.85 0.1 185 / 0.7); }
.ui-heart-plus { position: absolute; left: 100%; top: -14px; margin-left: 2px; font: 800 14px var(--ui-font); color: var(--ui-gold-bright); opacity: 0; text-shadow: var(--ui-text-shadow); }
.ui-heart:hover .ui-heart-notches, .ui-heart:focus-visible .ui-heart-notches { box-shadow: inset 0 0 0 1.5px var(--ui-gold-bright), 0 0 12px rgb(240 212 138 / 0.4); }
/* The level rose: the new notch flares, and "+1" floats up and goes. */
.ui-heart.is-rising .ui-heart-notch.is-new { animation: ui-heart-flare 1.4s var(--ui-ease); }
.ui-heart.is-rising .ui-heart-plus { animation: ui-heart-plus 1.6s var(--ui-ease); }
@keyframes ui-heart-flare { 0% { transform: rotate(45deg) scale(1); } 30% { transform: rotate(45deg) scale(1.7); box-shadow: 0 0 18px 4px rgb(240 212 138 / 0.9); } 100% { transform: rotate(45deg) scale(1); } }
@keyframes ui-heart-plus { 0% { opacity: 0; transform: translateY(6px); } 20% { opacity: 1; transform: translateY(0); } 70% { opacity: 1; } 100% { opacity: 0; transform: translateY(-10px); } }
@media (prefers-reduced-motion: reduce) { .ui-heart.is-rising .ui-heart-notch.is-new, .ui-heart.is-rising .ui-heart-plus { animation: none; } }
@media (max-width: 560px) {
  .ui-heart-name { font-size: 15px; }
  .ui-heart-notches { gap: 5px; padding: 6px 9px; }
  .ui-heart-notch { width: 8px; height: 8px; }
}
.ui-book .hp-reach { text-align: center; margin: 0 0 12px; color: var(--ui-ink-2); }
.ui-book .hp-reach b { color: var(--ui-ink); }
.ui-book .hp-note { display: grid; gap: 2px; margin: 0 8px; }
.ui-book .hp-note p { margin: 0; padding: 8px 4px; border-bottom: 1px solid var(--ui-line); }
.ui-book .hp-note p:last-child { border-bottom: 0; }
`;

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game, root } = view;
  addStyle(root, 'heart', STYLE);
  const panel = homePanel(view, book);

  const box = el('button', 'ui-heart');
  box.type = 'button';
  box.dataset.key = 'hud:heart';
  box.setAttribute('aria-label', 'Heartstone: what the next step asks for');
  box.hidden = true;
  const name = el('span', 'ui-heart-name');
  const label = document.createTextNode('Heartstone 0');
  const plus = el('span', 'ui-heart-plus');
  plus.setAttribute('aria-hidden', 'true');
  name.append(label, plus);
  const notches = el('span', 'ui-heart-notches');
  notches.setAttribute('role', 'meter');
  notches.setAttribute('aria-valuemin', '0');
  notches.setAttribute('aria-valuemax', String(STEPS));
  const marks: HTMLElement[] = [];
  for (let i = 0; i < STEPS; i++) {
    const mark = el('span', `ui-heart-notch${i === STEPS - 1 ? ' is-sixth' : ''}`);
    marks.push(mark);
    notches.append(mark);
  }
  box.append(name, notches);
  box.addEventListener('animationend', (event) => {
    if (event.target === plus) box.classList.remove('is-rising');
  });
  box.addEventListener('click', () => openNext());

  let placed = false;
  /** The level on screen, or -1 before the first look. */
  let shown = -1;
  let sinceLook = LOOK_EVERY;

  function draw(now: number): void {
    const rose = shown >= 0 && now > shown;
    marks.forEach((mark, i) => {
      mark.classList.toggle('is-lit', i < now);
      mark.classList.toggle('is-new', rose && i === now - 1);
    });
    if (rose) {
      plus.textContent = `+${now - shown}`;
      // Taken off and put back, so a second rise right after the first plays again.
      box.classList.remove('is-rising');
      void box.offsetWidth;
      box.classList.add('is-rising');
    }
    shown = now;
    label.data = `Heartstone ${now}`;
    notches.setAttribute('aria-valuenow', String(now));
  }

  /** "The next step": what it asks for, each part with how much holds, and what it puts in reach. */
  function openNext(): void {
    const settlement = book.sys.settlement;
    if (!settlement || !game.flags.is(SEEN)) return;
    const next = settlement.next();
    const level = settlement.heartstone().level;
    panel.open((body) => {
      body.dataset.key = 'home:heartstone';
      body.append(el('h2', 'hp-title', next ? 'The next step.' : 'The land is well.'), rule(Math.min(3, level), 3));
      if (!next) {
        body.append(el('p', 'hp-reach', `The Heartstone holds ${level}. Everything Greenhollow asks of you is done.`));
        return;
      }
      const reach = el('p', 'hp-reach');
      reach.append(`Step ${next.level} · `, el('b', '', `${next.reach}.`));
      body.append(reach);
      const rows = el('div', 'hp-rows');
      for (const part of next.parts) {
        const done = part.have >= part.need;
        const row = el('div', `hp-row${done ? ' is-done' : ''}`);
        if (done) row.append(el('span', 'hp-check', '✓'));
        else row.append(el('span', 'hp-dia'));
        row.append(el('span', 'hp-row-label', part.label));
        if (part.need > 1) row.append(el('span', 'hp-count', `${part.have} / ${part.need}`));
        rows.append(row);
      }
      body.append(rows, el('div', 'hp-sep'));
      const note = el('div', 'hp-note');
      note.append(el('p', '', 'Farms on Give count.'), el('p', '', 'Farms on Take rest, and count for nothing.'));
      body.append(note);
      const pump = el('p', `hp-foot${next.pump ? ' is-warn' : ''}`, next.pump ? 'The Order\'s pump is running: the stone reads one step lower.' : 'An Order pump lowers the step by one.');
      body.append(pump);
      body.title = HEART_NOTE;
    });
  }

  game.events.on('flag.changed', ({ flag }) => {
    if (flag === SEEN) sinceLook = LOOK_EVERY;
  });
  game.events.on('heartstone.opened', () => openNext());

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
