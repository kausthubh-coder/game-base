// The Verdant Stag's hall's own line at the top of the screen: the phase, what to do in it and how far it has
// come, and a bar for the guard of the thing the hero hit last. The lab's card, bars and "Again?" are
// `panel.ui.ts`, as for any fight.
import { STAG } from '../content/fight.ts';
import type { Target } from '../fight/fight.sim.ts';
import type { Hall } from '../fight/hall.sim.ts';
import { addStyle } from '../uiview/theme.ts';

const STYLE = /* css */ `
.ui-book .fl-hall {
  /* Centered in the room between the lab's card (--fl-free, from panel.ui.ts) and the minimap, 216 pixels from the right. */
  position: absolute; left: calc(var(--fl-free, 16px) + (100% - var(--fl-free, 16px) - 216px) / 2); top: 16px; translate: -50% 0; box-sizing: border-box;
  width: max-content; max-width: min(560px, calc(100% - var(--fl-free, 16px) - 232px)); padding: 9px 16px 10px;
  pointer-events: none; text-align: center; font: 600 13px / 1.35 var(--ui-font); color: var(--ui-glass-ink); text-shadow: var(--ui-text-shadow);
  background: var(--ui-glass); border-radius: var(--ui-radius); box-shadow: var(--ui-glass-shadow);
}
.ui-book.ui-covered .fl-hall { visibility: hidden; }
.ui-book .fl-hall b { display: block; font: 650 15px / 1.2 var(--ui-font); letter-spacing: 0.01em; }
.ui-book .fl-hall span { display: block; margin-top: 2px; font-weight: 500; opacity: 0.9; }
.ui-book .fl-hall .fl-bar { margin: 7px auto 0; width: 220px; height: 8px; }
.ui-book .fl-hall .fl-bar i { background: oklch(0.82 0.13 85); }
.ui-book .fl-hall .fl-bar[hidden] { display: none; }
`;

export interface HallLine {
  /** Once a frame. `last` is the target the hero hit last. */
  update(hall: Hall, last: Target | null): void;
}

const NAMES: Record<string, string> = { pin: 'Pin', lamp: 'Lamp', pod: 'Seed pod', collar: 'The collar' };

export function createHallLine(root: HTMLElement): HallLine {
  addStyle(root, 'lab-stag', STYLE);
  const box = document.createElement('div');
  box.className = 'fl-hall';
  const title = document.createElement('b'), what = document.createElement('span');
  const bar = document.createElement('div'), fill = document.createElement('i');
  bar.className = 'fl-bar';
  bar.append(fill);
  box.append(title, what, bar);
  root.append(box);
  let shownTitle = '', shownWhat = '', shownGuard = -1, shownBar = true;

  return {
    update(hall, last) {
      const broken = (list: readonly Target[]) => list.filter((t) => t.broken).length;
      let head = STAG.phases[hall.phase] as string, line = '';
      if (hall.freed) { head = 'Freed'; line = 'The chains are off. It lowers its head to you.'; }
      else if (hall.stag.doing === 'asleep') { head = STAG.name; line = 'Chained in its hall. Step in, and break the pins.'; }
      else if (hall.phase === 0) line = `Break the pins: ${broken(hall.pins)} of ${hall.pins.length}. Step out of the gold before it lands.`;
      else if (hall.phase === 1) line = `Light the lamps: ${broken(hall.lamps)} of ${hall.lamps.length}. Pods grow only in the dark: cut them before they burst.`;
      else line = hall.collar.open ? 'Cut the collar.' : 'Climb the vines up its flank to the collar. It shakes them.';
      if (head !== shownTitle) { shownTitle = head; title.textContent = head; }
      if (line !== shownWhat) { shownWhat = line; what.textContent = line; }
      const show = !!last && !last.broken && !hall.freed;
      if (show !== shownBar) { shownBar = show; bar.hidden = !show; }
      if (show && last) {
        const g = Math.round((last.guard / last.full) * 100);
        if (g !== shownGuard) { shownGuard = g; fill.style.transform = `scaleX(${g / 100})`; bar.title = NAMES[last.name.replace(/\d+$/, '')] ?? last.name; }
      }
    },
  };
}
