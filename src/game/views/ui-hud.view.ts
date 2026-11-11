// The HUD in the running game: the bag's first nine slots as quick slots with the held one marked, the
// tracked quest with its steps and counts, the day, the clock and the weather. This is the one file
// that touches src/features/hud.
//
// This part of the story has no fights, so there are no health, stamina or mana bars. The hud feature
// has no option to leave them out, so the stylesheet here hides them.
//
// The tracker shows the quest, a pip for each step and only the step to do now; the quest log (J) has the
// rest. A quick slot shows its item's name and use on hover, and a stack can be dragged from one quick slot
// to another, as in the bag (src/game/ui/drag.ui.ts).
import { createHud, type HudSlot } from '../../features/hud/index.ts';
import type { QuestStepView, QuestView } from '../api.sim.ts';
import { ALMANAC_BOOK } from '../content/almanac.ts';
import type { GameView } from '../shell/view.ts';
import { createSlotDrag } from '../ui/drag.ui.ts';
import { itemUse } from '../ui/logic.ui.ts';
import { bookOf } from '../uiview/book.ts';
import { addStyle } from '../uiview/theme.ts';

const QUICK = 9;
/** Seconds between two looks at what the tracker and the slots should show, beside the events that change them. */
const LOOK_EVERY = 0.25;
/** Pixels between the quick slots and whatever sits above them. */
const SLOT_GAP = 12;

const STYLE = /* css */ `
.ui-book .gb-hud { line-height: 1.35; color: var(--ui-glass-ink); font-family: var(--ui-font); }
.ui-book .gb-hud-vitals { display: none; }
/* Over the world nothing is boxed but the quick slots: the clock and the tracker are cream text with a soft shadow. */
.ui-book .gb-hud .gb-panel { color: var(--ui-glass-ink); background: none; border: 0; border-radius: 0; outline: 0; box-shadow: none; }

/* ---- quick slots: nine night wells with gold rims on a faint rail. The held one glows gold. ---- */
.ui-book .gb-hud-slots { gap: 6px; padding: 6px 10px; border-radius: 999px !important; background: linear-gradient(180deg, rgb(22 26 38 / 0.18), rgb(22 26 38 / 0.48)) !important; box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.28) !important; }
.ui-book .gb-slot {
  width: 54px; height: 54px; color: var(--ui-glass-ink); border: 0; border-radius: var(--ui-radius); transition: transform 120ms var(--ui-ease); touch-action: none;
  background: radial-gradient(90% 90% at 30% 20%, rgb(58 66 88 / 0.86), rgb(31 36 51 / 0.86));
  box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55), inset 0 2px 6px rgb(0 0 0 / 0.3), 0 2px 6px rgb(10 12 20 / 0.3);
}
.ui-book .gb-slot:hover { filter: brightness(1.15); }
.ui-book .gb-slot:active { filter: brightness(0.95); }
.ui-book .gb-slot[aria-pressed='true'] { transform: translateY(-4px); box-shadow: inset 0 0 0 2px var(--ui-gold-bright), 0 0 0 2px rgb(240 212 138 / 0.3), 0 0 16px rgb(240 212 138 / 0.65), 0 6px 10px rgb(10 12 20 / 0.35); }
.ui-book .gb-slot:focus-visible { outline: 2px solid var(--ui-gold-bright); outline-offset: 2px; }
.ui-book .gb-slot-key { z-index: 1; top: 3px; left: 6px; padding: 0; font-size: 11px; font-weight: 800; line-height: 1.3; color: var(--ui-gold); background: none; text-shadow: var(--ui-text-shadow); }
/* An icon is 32 pixels of pixel art, so it is drawn at exactly that. */
.ui-book .gb-slot-icon { inset: 50% auto auto 50%; width: 32px; height: 32px; margin: -15px 0 0 -16px; }
.ui-book .gb-slot-count { z-index: 1; right: 3px; bottom: 3px; min-width: 18px; padding: 0 4px; font-size: 11px; font-weight: 800; line-height: 16px; text-align: center; color: var(--ui-ink); background: var(--ui-paper-light); border-radius: 5px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.4); }
/* A drag between quick slots: the slot it came from fades and the one under the pointer lights up. */
.ui-book .gb-slot.is-drag-from .gb-slot-icon, .ui-book .gb-slot.is-drag-from .gb-slot-count { opacity: 0.3; }
.ui-book .gb-slot.is-drop { box-shadow: inset 0 0 0 2px var(--ui-gold-bright), 0 0 16px rgb(240 212 138 / 0.7); }
.ui-book .gb-slot.is-refused { box-shadow: inset 0 0 0 2px #d06a4a; }
.ui-book .gu-ghost-count { position: absolute; right: 3px; bottom: 3px; min-width: 20px; padding: 0 5px; font-size: 12px; font-weight: 800; line-height: 17px; text-align: center; color: var(--ui-ink); background: var(--ui-paper-light); border-radius: 5px; }
:root.gu-dragging, :root.gu-dragging * { cursor: grabbing !important; }
/* The name and use of a quick slot's item, above it. */
.ui-slot-tip {
  position: absolute; left: 0; top: 0; z-index: 13; display: grid; gap: 2px; width: max-content; max-width: 240px; padding: 10px 14px 12px;
  font-family: var(--ui-font); font-size: 14px; line-height: 1.4; color: var(--ui-glass-ink); background: linear-gradient(180deg, #2c3346, #232838); border-radius: var(--ui-radius);
  box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.55), var(--ui-glass-shadow); pointer-events: none;
}
.ui-slot-tip[hidden] { display: none; }
.ui-slot-tip b { font-family: var(--ui-display); font-size: 16px; font-weight: 650; color: var(--ui-gold-bright); }
.ui-slot-tip span { color: var(--ui-glass-ink-2); }

/* ---- top right: the minimap in its ring, then the day and the clock, then the quest ---- */
.ui-book .gb-hud-right { gap: 4px; width: 184px; }
.ui-book .gb-hud-sky { flex: none; gap: 8px; padding: 2px 4px; white-space: nowrap; text-shadow: var(--ui-text-shadow); }
.ui-book .gb-hud-weather { color: var(--ui-gold-bright); filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.6)); }
.ui-book .gb-hud-weather svg { width: 1.25em; height: 1.25em; }
.ui-book .gb-hud-clock { font-size: 17px; font-weight: 800; letter-spacing: 0.02em; }
.ui-day { white-space: nowrap; font-family: var(--ui-display); font-size: 15px; font-weight: 600; color: var(--ui-glass-ink); }
/* The tracker: a gold diamond, the quest, how far it has come, and only the step to do now. The quest log (J) has the rest. */
.ui-book .gb-hud-quest { position: relative; width: 270px; margin-top: 6px; padding: 4px 4px 4px 26px; text-shadow: var(--ui-text-shadow); }
.ui-book .gb-hud-quest::before { content: ''; position: absolute; left: 6px; top: 9px; width: 10px; height: 10px; background: var(--ui-gold-bright); transform: rotate(45deg); box-shadow: 0 0 10px rgb(240 212 138 / 0.9), 0 0 0 2px rgb(22 26 38 / 0.5); }
.ui-book .gb-hud-quest h3 { margin: 0; padding: 0; font-family: var(--ui-display); font-size: 17px; font-weight: 650; letter-spacing: 0; color: var(--ui-gold-bright); border: 0; text-wrap: balance; }
.ui-pips { display: flex; gap: 4px; margin: 6px 0 6px; max-width: 160px; }
.ui-pips i { flex: 1; height: 3px; border-radius: 2px; background: rgb(246 241 231 / 0.3); box-shadow: 0 1px 2px rgb(0 0 0 / 0.4); }
.ui-pips i.is-done { background: var(--ui-gold-bright); }
.ui-pips i.is-now { background: rgb(246 241 231 / 0.75); }
.ui-book .gb-hud-quest ul { gap: 0; }
.ui-book .gb-hud-quest li { display: none; grid-template-columns: 1fr auto; gap: 0 12px; align-items: baseline; padding-left: 0; font-size: 15px; font-weight: 700; color: var(--ui-glass-ink); text-wrap: pretty; }
.ui-book .gb-hud-quest li::before { content: none; }
/* The step to do now is the one line shown. */
.ui-book .gb-hud-quest li:first-child:not(.is-done), .ui-book .gb-hud-quest li.is-done + li:not(.is-done) { display: grid; }
.ui-count { font-size: 14px; font-weight: 800; color: var(--ui-gold-bright); font-variant-numeric: tabular-nums lining-nums; white-space: nowrap; }

/* ---- the Almanac: a button of its own at the left of the quick slots, never a slot. It shows once Tamsin has given the book. */
.ui-bookbtn { position: absolute; right: 100%; bottom: 0; margin-right: 10px; padding: 6px; pointer-events: auto; border-radius: 999px !important; background: linear-gradient(180deg, rgb(22 26 38 / 0.18), rgb(22 26 38 / 0.48)) !important; box-shadow: inset 0 0 0 1px rgb(211 188 142 / 0.28) !important; }
.ui-bookbtn[hidden] { display: none; }
.ui-bookbtn button {
  position: relative; display: block; width: 54px; height: 54px; margin: 0; padding: 0;
  font: inherit; color: var(--ui-glass-ink); border: 0; border-radius: 50%; cursor: pointer;
  background: radial-gradient(90% 90% at 30% 20%, rgb(74 68 52 / 0.92), rgb(46 40 30 / 0.92));
  box-shadow: inset 0 0 0 1.5px var(--ui-gold), 0 2px 6px rgb(10 12 20 / 0.3);
}
.ui-bookbtn button:hover { filter: brightness(1.15); }
.ui-bookbtn button:active { filter: brightness(0.95); }
.ui-bookbtn button[aria-expanded='true'] { box-shadow: inset 0 0 0 2px var(--ui-gold-bright), 0 0 14px rgb(240 212 138 / 0.6); }
.ui-bookbtn button:focus-visible { outline: 2px solid var(--ui-gold-bright); outline-offset: 2px; }
.ui-bookbtn .ui-bookbtn-icon { position: absolute; inset: 50% auto auto 50%; width: 32px; height: 32px; margin: -15px 0 0 -16px; }
.ui-bookbtn .ui-bookbtn-key { position: absolute; z-index: 1; top: -4px; left: 50%; transform: translateX(-50%); padding: 0 5px; font-size: 10px; font-weight: 800; line-height: 14px; color: var(--ui-night); background: var(--ui-gold); border-radius: 4px; }
/* The first time it shows, it glows twice so the eye finds it. */
.ui-bookbtn.is-new button { animation: ui-book-glow 1.1s var(--ui-ease) 2; }
@keyframes ui-book-glow { 0% { box-shadow: inset 0 0 0 2px var(--ui-gold-bright), 0 0 0 0 rgb(240 212 138 / 0.75); } 100% { box-shadow: inset 0 0 0 2px var(--ui-gold-bright), 0 0 0 14px rgb(240 212 138 / 0); } }
@media (prefers-reduced-motion: reduce) { .ui-bookbtn.is-new button { animation: none; box-shadow: inset 0 0 0 2px var(--ui-gold-bright); } .ui-book .gb-slot { transition: none; } }
@media (max-width: 560px) {
  .ui-bookbtn { right: auto; left: 0; bottom: 100%; margin: 0 0 8px; }
}

/* While someone talks the dialogue box has the bottom of the screen. */
.ui-book.ui-talking .gb-hud-slots { visibility: hidden; }

/* A phone held upright: the corner is narrow and the slots wrap to five and four. */
@media (max-width: 560px) {
  .ui-book .gb-hud-right { width: 140px; }
  .ui-book .gb-slot { width: 48px; height: 48px; }
  .ui-book .gb-hud-slots { width: calc(5 * 48px + 4 * 6px + 20px); border-radius: 18px !important; }
  .ui-book .gb-hud-quest { width: 13.5em; }
  .ui-book .gb-hud-quest li { font-size: 14px; }
  .ui-pips { margin: 4px 0 6px; }
  /* The day and the clock are wider than the corner here, so they keep its right edge. */
  .ui-book .gb-hud-sky { align-self: flex-end; }
}
`;

export function install(view: GameView): void {
  const book = bookOf(view);
  const { game, root } = view;
  const { sys, art } = book;
  addStyle(root, 'hud', STYLE);

  const hud = createHud(view.ctx, {
    parent: root,
    // Settings keeps the interface size, for the panels and the HUD together.
    storage: null,
    onSlot(index) {
      if (sys.inventory && view.started && !game.player.busy) sys.inventory.selected = index;
    },
  });
  book.minimapSlot = hud.minimapSlot;
  book.onSize((size) => hud.setScale(size));
  hud.setVisible(false);

  // The day goes beside the clock. The feature has no place for it, so it is added to its clock strip.
  const day = document.createElement('span');
  day.className = 'ui-day';
  hud.element.querySelector('.gb-hud-sky')?.prepend(day);
  let dayShown = 0;

  // ---- quick slots
  const shown: string[] = Array.from({ length: QUICK }, () => '');
  const icons: (HTMLElement | null)[] = Array.from({ length: QUICK }, () => null);
  const held: string[] = Array.from({ length: QUICK }, () => '');

  function letters(name: string): HTMLElement {
    const element = document.createElement('span');
    element.className = 'ui-letters';
    element.textContent = name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2);
    return element;
  }

  function drawSlots(): void {
    const slots = sys.inventory?.slots;
    if (!slots) return;
    for (let i = 0; i < QUICK; i++) {
      const stack = slots[i] ?? null;
      const signature = stack ? `${stack.id}:${stack.count}` : '';
      if (signature === shown[i]) continue;
      shown[i] = signature;
      if (!stack) {
        held[i] = '';
        icons[i] = null;
        hud.setSlot(i, null);
        continue;
      }
      let name = stack.id, icon = stack.id;
      try {
        const def = sys.items?.get(stack.id);
        if (def) { name = def.name; icon = def.icon; }
      } catch {
        // An item nobody defined still shows, by its id.
      }
      if (held[i] !== stack.id) {
        held[i] = stack.id;
        icons[i] = art.iconElement(icon) ?? letters(name);
      }
      const slot: HudSlot = { icon: icons[i], label: name, count: stack.count };
      hud.setSlot(i, slot);
    }
  }

  // ---- the tracked quest, with a pip for each step: done, now, or still to come
  let questShown = '';
  const pips = document.createElement('div');
  pips.className = 'ui-pips';
  pips.setAttribute('aria-hidden', 'true');
  hud.element.querySelector('.gb-hud-quest h3')?.after(pips);
  const stepText = (step: QuestStepView): string => step.text;
  const stepCount = (step: QuestStepView): string => (step.need !== undefined && !step.done ? `${step.have ?? 0}/${step.need}` : '');

  function drawQuest(): void {
    const quest: QuestView | null = sys.quests?.tracked() ?? null;
    let signature = quest ? quest.id : '';
    if (quest) for (const step of quest.steps) signature += `|${step.done ? 1 : 0}${stepCount(step)}`;
    if (signature === questShown) return;
    questShown = signature;
    hud.setQuest(quest ? { title: quest.title, steps: quest.steps.map((step) => ({ text: stepText(step), done: step.done })) } : null);
    if (!quest) return;
    const now = quest.steps.findIndex((step) => !step.done);
    pips.replaceChildren(...quest.steps.map((step, i) => {
      const pip = document.createElement('i');
      if (step.done) pip.className = 'is-done';
      else if (i === now) pip.className = 'is-now';
      return pip;
    }));
    // A step that counts shows how far it is, at the right of its line.
    const lines = hud.element.querySelectorAll('.gb-hud-quest li');
    if (lines.length !== quest.steps.length) return;
    quest.steps.forEach((step, i) => {
      const count = stepCount(step);
      if (!count) return;
      const tag = document.createElement('span');
      tag.className = 'ui-count';
      tag.textContent = count;
      tag.setAttribute('aria-label', `${step.have ?? 0} of ${step.need}`);
      lines[i]?.append(tag);
    });
  }

  let due = true;
  const soon = (): void => { due = true; };
  game.events.on('inventory.changed', soon);
  game.events.on('quest.started', soon);
  game.events.on('quest.step', soon);
  game.events.on('quest.completed', soon);
  book.onStart(soon);

  // ---- the Almanac's button. The book is the flag `has.almanac`, never a quick slot. Tab opens it too.
  const bookBox = document.createElement('div');
  bookBox.className = 'ui-bookbtn gb-panel';
  bookBox.hidden = true;
  const bookButton = document.createElement('button');
  bookButton.type = 'button';
  bookButton.dataset.key = 'hud:almanac';
  bookButton.setAttribute('aria-label', 'Almanac (Tab)');
  bookButton.setAttribute('aria-expanded', 'false');
  bookButton.title = 'Almanac (Tab)';
  const bookKey = document.createElement('span');
  bookKey.className = 'ui-bookbtn-key';
  bookKey.textContent = 'Tab';
  const bookIcon = art.iconElement('book') ?? letters('Almanac');
  bookIcon.classList.add('ui-bookbtn-icon');
  bookButton.append(bookKey, bookIcon);
  bookBox.append(bookButton);
  hud.element.querySelector('.gb-hud-slots')?.append(bookBox);
  bookButton.addEventListener('click', () => {
    if (!view.started || !game.flags.is(ALMANAC_BOOK.flag) || book.menuOpen || (sys.talk?.active ?? false)) return;
    book.ui.toggle('almanac');
  });
  book.onPanel((panel) => bookButton.setAttribute('aria-expanded', String(panel === 'almanac')));
  let bookShown = false;
  const drawBook = (): void => {
    const has = game.flags.is(ALMANAC_BOOK.flag);
    if (has === bookShown) return;
    bookShown = has;
    bookBox.hidden = !has;
  };
  game.events.on('flag.changed', ({ flag, value }) => {
    if (flag !== ALMANAC_BOOK.flag) return;
    // Handed over in play, it glows. A loaded game simply has it.
    if (value === true && view.started) bookBox.classList.add('is-new');
    drawBook();
  });
  book.onPanel((panel) => { if (panel === 'almanac') bookBox.classList.remove('is-new'); });
  book.onStart(drawBook);

  // ---- a stack dragged from one quick slot to another, and each slot's name and use on hover
  const slotBar = hud.element.querySelector<HTMLElement>('.gb-hud-slots');
  const slotButtons = [...(slotBar?.querySelectorAll<HTMLElement>('.gb-slot') ?? [])];
  slotButtons.forEach((button, i) => { button.dataset.slotDrop = String(i); });
  const free = (): boolean => view.started && !game.player.busy && !book.covered;
  if (slotBar && sys.inventory) {
    const inventory = sys.inventory;
    createSlotDrag({
      area: slotBar,
      layer: () => root,
      stackAt: (index) => (free() && index < QUICK ? inventory.slots[index] ?? null : null),
      picture: (stack) => {
        let icon = stack.id;
        try { icon = sys.items?.get(stack.id).icon ?? icon; } catch { /* drawn by its letters */ }
        const element = art.iconElement(icon) ?? letters(stack.id);
        element.style.width = element.style.height = '32px';
        return element;
      },
      drop(from, to, count) {
        if (!free()) return;
        inventory.move(from, to, count);
        game.events.emit('ui.sound', { sound: 'click' });
        due = true;
      },
      onStart: () => { tip.hidden = true; },
    });
  }
  const tip = document.createElement('div');
  tip.className = 'ui-slot-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  root.append(tip);
  slotButtons.forEach((button, i) => {
    button.addEventListener('pointerenter', (event) => {
      const stack = sys.inventory?.slots[i];
      if (event.pointerType === 'touch' || !stack || document.documentElement.classList.contains('gu-dragging')) return;
      let name = stack.id, use: string | null = null;
      try {
        const def = sys.items?.get(stack.id);
        if (def) { name = def.name; use = itemUse(def); }
      } catch {
        // An item nobody defined still has its id.
      }
      const title = document.createElement('b');
      title.textContent = name;
      tip.replaceChildren(title);
      if (use) {
        const line = document.createElement('span');
        line.textContent = use;
        tip.append(line);
      }
      tip.hidden = false;
      const at = button.getBoundingClientRect(), room = root.getBoundingClientRect(), box = tip.getBoundingClientRect();
      const left = Math.min(Math.max(8, at.left - room.left + at.width / 2 - box.width / 2), room.width - box.width - 8);
      tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(at.top - room.top - box.height - 10)}px)`;
    });
    button.addEventListener('pointerleave', () => { tip.hidden = true; });
    // The tooltip says more than the browser's own, so that one is not shown too.
    button.addEventListener('mouseover', () => button.removeAttribute('title'));
  });

  // ---- the room the quick slots take, so the prompt and the toasts sit clear of them
  const bar = hud.element.querySelector<HTMLElement>('.gb-hud-slots');
  const measure = (): void => {
    if (!bar || hud.element.hidden) return;
    const top = bar.getBoundingClientRect().top;
    root.style.setProperty('--ui-hud-clear', `${Math.max(0, Math.ceil(root.clientHeight - top + SLOT_GAP))}px`);
  };
  if (bar && typeof ResizeObserver !== 'undefined') {
    const watcher = new ResizeObserver(measure);
    watcher.observe(bar);
    watcher.observe(root);
  }

  let visible = false, sinceLook = 0;
  view.onFrame((dt) => {
    // Nothing here means anything before a game runs, and a panel or the full map has the screen to itself.
    const show = view.started && !book.covered;
    if (show !== visible) {
      visible = show;
      hud.setVisible(show);
      if (show) measure();
      else tip.hidden = true;
    }
    if (!show) return;

    sinceLook += dt;
    if (due || sinceLook >= LOOK_EVERY) {
      due = false;
      sinceLook = 0;
      drawSlots();
      drawQuest();
    }
    const selected = sys.inventory?.selected ?? 0;
    if (selected !== hud.selected) hud.selectSlot(selected);
    if (game.clock.day !== dayShown) {
      dayShown = game.clock.day;
      day.textContent = `Day ${dayShown}`;
    }
    hud.update(dt, view.ctx);
  });
}
