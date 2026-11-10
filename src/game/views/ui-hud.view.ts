// The HUD in the running game: the bag's first nine slots as quick slots with the held one marked, the
// tracked quest with its steps and counts, the day, the clock and the weather. This is the one file
// that touches src/features/hud.
//
// This part of the story has no fights, so there are no health, stamina or mana bars. The hud feature
// has no option to leave them out, so the stylesheet here hides them.
import { createHud, type HudSlot } from '../../features/hud/index.ts';
import type { QuestStepView, QuestView } from '../api.sim.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { addStyle } from '../uiview/theme.ts';

const QUICK = 9;
/** Seconds between two looks at what the tracker and the slots should show, beside the events that change them. */
const LOOK_EVERY = 0.25;
/** Pixels between the quick slots and whatever sits above them. */
const SLOT_GAP = 12;

const STYLE = /* css */ `
.ui-book .gb-hud { line-height: 1.3; }
.ui-book .gb-hud-vitals { display: none; }
.ui-book .gb-hud .gb-panel { border: 2px solid var(--ui-ink); border-radius: 2px; outline: 0; background: var(--ui-paper); box-shadow: 0 4px 14px var(--ui-shadow); }

/* ---- quick slots: the bag's first row, drawn as the bag draws it ---- */
.ui-book .gb-hud-slots { gap: 4px; padding: 6px; }
.ui-book .gb-slot { background: var(--ui-paper-3); border: 0; border-radius: 2px; transition: none; }
.ui-book .gb-slot:hover { background: var(--ui-paper-4); }
.ui-book .gb-slot:active { background: var(--ui-paper-2); }
/* The held slot: the accent line the bag puts on the picked slot. */
.ui-book .gb-slot[aria-pressed='true'] { background: var(--ui-paper-light); transform: none; box-shadow: inset 0 0 0 2px var(--ui-accent); }
.ui-book .gb-slot:focus-visible { outline: 2px solid var(--ui-ink); outline-offset: 2px; }
.ui-book .gb-slot-key { z-index: 1; top: 2px; left: 2px; padding: 0 3px; font-size: 12px; line-height: 1.3; color: var(--ui-ink-2); background: inherit; border-radius: 2px; }
/* An icon is 32 pixels of pixel art, so it is drawn at exactly that. */
.ui-book .gb-slot-icon { inset: 50% auto auto 50%; width: 32px; height: 32px; margin: -15px 0 0 -16px; }
.ui-book .gb-slot-count { z-index: 1; right: 2px; bottom: 2px; padding: 0 4px; font-size: 13px; font-weight: 600; line-height: 1.3; background: var(--ui-paper); border-radius: 2px; }

/* ---- top right: the minimap, then the day and the clock, then the quest ---- */
.ui-book .gb-hud-right { gap: 8px; }
.ui-book .gb-hud-sky { flex: none; gap: 8px; padding: 4px 12px; white-space: nowrap; }
.ui-book .gb-hud-weather svg { width: 1.25em; height: 1.25em; }
.ui-book .gb-hud-clock { font-weight: 600; letter-spacing: 0; }
.ui-day { white-space: nowrap; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ui-ink-2); }
.ui-book .gb-hud-quest { width: 17em; margin-top: 0; padding: 12px 16px 14px; }
.ui-book .gb-hud-quest h3 { margin: 0 0 8px; padding-bottom: 8px; font-size: 1em; font-weight: 600; letter-spacing: -0.01em; border-bottom: 1px solid var(--ui-line); text-wrap: balance; }
.ui-book .gb-hud-quest ul { gap: 6px; }
.ui-book .gb-hud-quest li { display: grid; grid-template-columns: 1fr auto; gap: 0 12px; align-items: baseline; padding-left: 20px; font-size: max(0.875em, 13px); color: var(--ui-ink-2); text-wrap: pretty; }
.ui-book .gb-hud-quest li::before { left: 1px; top: 0.3em; width: 10px; height: 10px; border: 1.5px solid var(--ui-ink-2); border-radius: 50%; }
.ui-book .gb-hud-quest li.is-done { color: var(--ui-ink-2); text-decoration: none; }
.ui-book .gb-hud-quest li.is-done::before { background: var(--ui-done); border-color: var(--ui-done); }
/* The step to do now is the one line in full ink. */
.ui-book .gb-hud-quest li:first-child:not(.is-done), .ui-book .gb-hud-quest li.is-done + li:not(.is-done) { color: var(--ui-ink); font-weight: 600; }
.ui-book .gb-hud-quest li:first-child:not(.is-done)::before, .ui-book .gb-hud-quest li.is-done + li:not(.is-done)::before { border-color: var(--ui-ink); }
.ui-count { font-variant-numeric: tabular-nums lining-nums; white-space: nowrap; }

/* While someone talks the dialogue box has the bottom of the screen. */
.ui-book.ui-talking .gb-hud-slots { visibility: hidden; }

/* A phone held upright: the corner is narrow, so the tracker shows only the step to do now. */
@media (max-width: 560px) {
  .ui-book .gb-hud-quest { width: 13.5em; padding: 8px 12px 10px; }
  .ui-book .gb-hud-quest h3 { margin-bottom: 6px; padding-bottom: 6px; }
  .ui-book .gb-hud-quest li.is-done, .ui-book .gb-hud-quest li:not(.is-done) ~ li:not(.is-done) { display: none; }
  /* The day and the clock are wider than the corner here, so they keep its right edge. */
  .ui-book .gb-hud-sky { align-self: flex-end; padding: 2px 10px; }
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

  // ---- the tracked quest
  let questShown = '';
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
