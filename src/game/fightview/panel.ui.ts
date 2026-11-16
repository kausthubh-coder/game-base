// The fight lab's interface, in HTML over the game: the card that picks the weapon, the companion and the
// beasts (or the traps), the hero's two bars, the weapon in the hand and the companion's skill, the kit of rigs,
// a bar over each beast, the card after a fight, the log, and the warm edge of the screen when the hero is low.
// It reads the fight and draws it. Every button calls back into the lab's view, which owns the fight.
//
// The card folds itself to its title when a beast wakes, so it never hides the fight, and opens again when the
// fight ends. A player who opens it by hand during a fight keeps it open. On a narrow window the bars and the
// card after a fight sit in the room the card leaves.
//
// In the Stag's hall the card shows only what works there: the weapon and the companion, a "Start over" for the
// hall, the keys, and the hall's three phases as its rules. It folds when the Stag wakes and opens when it is freed.
import { BEASTS, LAB_COMPANIONS as COMPANIONS, HERO, LOW_HEALTH, RIGS, WEAPONS, beastOf, type RigKind, type WeaponKind } from '../content/fight.ts';
import type { BeastState, Fight } from '../fight/fight.sim.ts';
import type { Hall } from '../fight/stag-hall.sim.ts';
import { checksOf, endedWord, foesOf, summaryOf, type Check } from '../fight/record.sim.ts';
import type { QualityMode } from '../shell/view.ts';
import { addStyle } from '../uiview/theme.ts';
import type { FightLog, LoggedFight } from './log.ts';

export interface PanelActions {
  /** Takes a weapon in hand. From the traps it goes back to the fight first. */
  setWeapon(kind: WeaponKind): void;
  setCompanion(kind: string): void;
  /** The traps, or back to the fight. */
  setTraps(on: boolean): void;
  /** Brings a beast in, and a second one beside it when `also` names one. */
  bring(kind: string, also?: string): void;
  wake(): void;
  clear(): void;
  setGentle(on: boolean): void;
  /** Turns the screen's shake on or off, and `shaking` says which it is. */
  setShake(on: boolean): void;
  shaking(): boolean;
  setQuality(mode: QualityMode): void;
  /** Starts the fight the card after a fight names again: its weapon, its companion and its beasts. */
  again(fight: LoggedFight): void;
}

export interface PanelOptions {
  /** True in the Stag's hall (`?scene=stag`). */
  hall?: boolean;
}

export interface LabPanel {
  /**
   * Once a frame. `held` is the rig in the hand. `beastAt` is where the bar over a beast goes on the page, or null
   * when it is out of view. `hall` is the Stag's hall, or null in the meadow.
   */
  update(fight: Fight, held: RigKind | null, quality: QualityMode, beastAt: (beast: BeastState) => { x: number; y: number } | null, hall?: Hall | null): void;
  /** Shows the card after a fight that just ended. */
  ask(fight: LoggedFight): void;
  /** A short line over the bars: why something could not be done. It stays `ms` milliseconds. */
  say(text: string, ms?: number): void;
  /** The name of a gift, floating over the page where it flies. Null `at` hides it. */
  label(text: string, at: { x: number; y: number } | null, alpha: number): void;
  /** True while the pointer is over a part of the interface, so a click there is not a swing. */
  readonly element: HTMLElement;
}

/** What each weapon's two moves do, for the keys on the card. */
const WEAPON_KEYS: Record<WeaponKind, readonly (readonly [string, string])[]> = {
  sword: [['Click', 'Cut. Click again for a second cut'], ['Hold click', 'Charge a spin, let go to strike all round']],
  bow: [['Click', 'An arrow down the aim'], ['Hold click', 'Draw, let go: a shot that passes through and pushes']],
  staff: [['Click', 'A bolt of light that marks the beast'], ['Hold click', 'Gather light, let go: a burst at the pointer that slows']],
};

/** What each companion's skill on C does. */
const SKILL_WORDS: Record<string, string> = {
  Pounce: 'It leaps at the beast',
  Brace: 'It plants itself and takes the next attack',
  Mend: 'It gives back health at once',
  Bloom: 'A few seconds of harder hits',
};

const ROLE: Record<string, string> = { striker: 'Striker', guard: 'Guard', healer: 'Healer', booster: 'Booster' };

const COMMON_KEYS: readonly (readonly [string, string])[] = [
  ['1, 2, 3', 'Sword, bow, staff, also mid-fight'],
  ['Shift', 'Dodge the way you walk'],
];

const TRAP_KEYS: readonly (readonly [string, string])[] = [
  ['1 to 4', 'Take a rig in hand, click to set it down'],
  ['Z', 'Take the last rig back'],
  ['E', 'Wake the beast, or walk up to it'],
  ['C', 'Send your companion to the pointer as a lure'],
  ['Shift', 'Dodge the way you walk'],
  ['F', 'Spring the plate. Hold it near a dizzy beast to calm it'],
];

const HALL_RULES = [
  'The chains: break the four pins. It sweeps its antlers across the floor and stamps when you come close.',
  'The overgrowth: light the lamps. Seed pods grow only in the dark; cut them before they burst.',
  'The collar: climb the vines up its flank and cut the collar. It shakes the vines under you.',
];

const TRAPS_NOTE = 'Set rigs in its path, then bait it into them. The wall and the trees work too.';

/** Under the keys: the one word for the state the Mark needs. */
const DIZZY = 'A beast is dizzy only once its guard bar is empty. The Mark cannot hold it before.';

/** The width of the game's minimap and clock in the top right corner, with their margin. */
const MAP_CORNER = 232;

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const STYLE = /* css */ `
.ui-book .fl-card {
  position: absolute; z-index: 2; left: 16px; top: 16px; width: 348px; max-height: calc(100% - 32px); overflow: auto; padding: 14px 16px 12px; box-sizing: border-box;
  pointer-events: auto; user-select: none; font: 400 13px / 1.45 var(--ui-font); -webkit-font-smoothing: antialiased;
  color: var(--ui-ink); background: var(--ui-paper); border-radius: var(--ui-radius); box-shadow: var(--ui-lift);
}
.ui-book.ui-covered .fl-card, .ui-book.ui-covered .fl-hud, .ui-book.ui-covered .fl-beast { visibility: hidden; }
.ui-book .fl-card h2 { margin: 0 0 10px; font: 650 16px / 1.2 var(--ui-font); letter-spacing: -0.005em; }
.ui-book .fl-card h3 { margin: 12px 0 5px; font: 600 11px / 1.2 var(--ui-font); letter-spacing: 0.04em; text-transform: uppercase; color: var(--ui-ink-2); }
.ui-book .fl-card p { margin: 0; color: var(--ui-ink-2); text-wrap: pretty; }
.ui-book .fl-row { display: flex; gap: 6px; flex-wrap: wrap; }
.ui-book .fl-card button, .ui-book .fl-again button, .ui-book .fl-log button, .ui-book .fl-card select {
  flex: 1; min-height: 30px; padding: 0 9px; cursor: pointer; white-space: nowrap;
  font: 600 12.5px / 1 var(--ui-font); color: var(--ui-ink); background: var(--ui-paper-3); border: 1px solid var(--ui-line-strong); border-radius: var(--ui-radius-sm);
}
.ui-book .fl-card button:hover, .ui-book .fl-again button:hover, .ui-book .fl-log button:hover { background: var(--ui-paper-4); }
.ui-book .fl-card button:focus-visible, .ui-book .fl-again button:focus-visible { outline: 2px solid var(--ui-accent); outline-offset: 2px; }
.ui-book .fl-card button.is-on { color: var(--ui-paper-light); background: var(--ui-accent); border-color: transparent; }
.ui-book .fl-card h2 button { float: right; flex: none; min-height: 24px; margin: -3px -4px 0 12px; padding: 0 8px; font-weight: 500; }
.ui-book .fl-keys { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
.ui-book .fl-keys li { display: grid; grid-template-columns: 86px 1fr; gap: 8px; color: var(--ui-ink-2); }
.ui-book .fl-keys li b { font-weight: 600; color: var(--ui-ink); }
.ui-book .fl-rules { margin: 0; padding-left: 16px; color: var(--ui-ink-2); }
.ui-book .fl-card.is-small > :not(h2) { display: none; }
.ui-book .fl-card.is-small { width: auto; padding: 8px 12px; }
.ui-book .fl-card .fl-dizzy { margin-top: 6px; font-size: 12px; }
.ui-book .fl-card.is-small h2 { margin: 0; }
.ui-book .fl-note { margin-top: 8px; font-size: 12px; }

.ui-book .fl-hud {
  position: absolute; left: var(--fl-hud-x, 50%); bottom: 18px; translate: -50% 0; width: max-content; display: flex; flex-wrap: wrap-reverse; justify-content: center; gap: 10px 14px; align-items: flex-end; pointer-events: none;
  font: 600 12px / 1.2 var(--ui-font); color: var(--ui-glass-ink); text-shadow: var(--ui-text-shadow);
}
.ui-book .fl-hud.is-wrapped { left: var(--fl-free); right: 16px; width: auto; translate: none; }
.ui-book .fl-box { flex: none; padding: 8px 10px; background: var(--ui-glass); border-radius: var(--ui-radius); box-shadow: var(--ui-glass-shadow); }
.ui-book .fl-bars { display: grid; gap: 5px; width: 220px; }
.ui-book .fl-bar { height: 10px; border-radius: 5px; background: oklch(1 0 0 / 0.16); overflow: hidden; }
.ui-book .fl-bar i { display: block; height: 100%; width: 100%; border-radius: 5px; transform-origin: left; }
.ui-book .fl-health i { background: oklch(0.72 0.17 25); }
.ui-book .fl-stamina { height: 6px; }
.ui-book .fl-stamina i { background: oklch(0.85 0.15 95); }
.ui-book .fl-chips { display: flex; gap: 6px; align-items: center; }
.ui-book .fl-chip { position: relative; min-width: 62px; padding: 6px 8px; border-radius: var(--ui-radius-sm); background: oklch(1 0 0 / 0.12); overflow: hidden; text-align: center; }
.ui-book .fl-chip b { margin-right: 5px; padding: 1px 5px; border-radius: 4px; background: oklch(1 0 0 / 0.18); font-weight: 700; }
.ui-book .fl-chip i { position: absolute; inset: 0; background: oklch(0 0 0 / 0.5); transform-origin: left; }
.ui-book .fl-chip span { position: relative; }
.ui-book .fl-chip.is-held { outline: 2px solid oklch(0.85 0.14 180); background: oklch(0.85 0.14 180 / 0.3); }
.ui-book .fl-chip.is-gone { opacity: 0.4; }
.ui-book .fl-hearts { letter-spacing: 2px; font-size: 15px; color: oklch(0.78 0.16 20); }
.ui-book .fl-say { position: absolute; z-index: 3; left: var(--fl-hud-x, 50%); bottom: calc(var(--fl-hud-h, 60px) + 36px); translate: -50% 0; max-width: calc(100% - var(--fl-free, 16px) - 16px); box-sizing: border-box; text-align: center; padding: 5px 12px; border-radius: 999px; pointer-events: none;
  font: 600 13px / 1.2 var(--ui-font); color: var(--ui-glass-ink); background: var(--ui-glass); opacity: 0; transition: opacity 0.2s; }
.ui-book .fl-say.is-on { opacity: 1; }

/* Low health: the edge of the screen glows warm and beats slowly. Never a red flash over the whole picture. */
.ui-book .fl-edge { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 0.4s; }
.ui-book .fl-edge i { position: absolute; inset: 0; opacity: 0.8;
  background: radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, oklch(0.72 0.15 55 / 0.42) 82%, oklch(0.6 0.16 45 / 0.7) 100%); }
/* Only the opacity moves, so the beat costs the page no repaint. */
.ui-book .fl-edge.is-low i { animation: fl-beat 1.1s ease-in-out infinite; }
@keyframes fl-beat { 0%, 100% { opacity: 0.8; } 18% { opacity: 1; } 36% { opacity: 0.82; } 52% { opacity: 0.95; } }
@media (prefers-reduced-motion: reduce) { .ui-book .fl-edge.is-low i { animation: none; } }

.ui-book .fl-beast { position: absolute; left: 0; top: 0; width: 170px; margin: -52px 0 0 -85px; pointer-events: none; text-align: center;
  font: 600 12px / 1.25 var(--ui-font); color: var(--ui-glass-ink); text-shadow: var(--ui-text-shadow); will-change: transform; }
.ui-book .fl-beast .fl-guard { position: relative; height: 9px; margin: 3px 0; border-radius: 5px; background: oklch(0 0 0 / 0.45); overflow: hidden; }
.ui-book .fl-beast .fl-guard i { display: block; height: 100%; width: 100%; background: oklch(0.83 0.15 85); transform-origin: left; }
.ui-book .fl-beast .fl-guard u { position: absolute; top: 0; bottom: 0; width: 2px; background: oklch(0 0 0 / 0.7); }
.ui-book .fl-beast em { display: block; font-style: normal; font-weight: 700; color: oklch(0.9 0.12 180); }
.ui-book .fl-beast em.is-angry { color: oklch(0.88 0.08 40); }
.ui-book .fl-beast small { font-size: 11px; font-weight: 600; opacity: 0.85; }

.ui-book .fl-again, .ui-book .fl-log {
  position: absolute; z-index: 4; left: 50%; top: 12%; translate: -50% 0; width: min(460px, calc(100% - 32px)); max-height: 84%; overflow: auto; box-sizing: border-box; padding: 16px 18px; pointer-events: auto;
  font: 400 13.5px / 1.45 var(--ui-font); color: var(--ui-ink); background: var(--ui-paper); border-radius: var(--ui-radius); box-shadow: var(--ui-lift);
}
.ui-book .fl-again h2, .ui-book .fl-log h2 { margin: 0 0 4px; font: 650 18px / 1.2 var(--ui-font); }
.ui-book .fl-again p { margin: 0 0 10px; color: var(--ui-ink-2); }
.ui-book .fl-again .fl-lines { margin: 6px 0 12px; display: grid; gap: 4px; }
.ui-book .fl-again .fl-lines p { margin: 0; color: var(--ui-ink); }
.ui-book .fl-again .fl-lines p + p { color: var(--ui-ink-2); }
.ui-book .fl-card .fl-row button small { display: block; margin-top: 2px; font-weight: 500; font-size: 10.5px; color: var(--ui-ink-2); }
.ui-book .fl-card .fl-row button.is-on small { color: inherit; opacity: 0.85; }
.ui-book .fl-card .fl-row.is-tall button { min-height: 38px; padding: 4px 6px; }
.ui-book .fl-chip small { position: relative; display: block; margin-top: 2px; font-size: 10.5px; font-weight: 600; opacity: 0.8; }
.ui-book .fl-checks { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12.5px; }
.ui-book .fl-checks td { padding: 3px 6px 3px 0; border-top: 1px solid var(--ui-line); vertical-align: top; }
.ui-book .fl-checks td:last-child { white-space: nowrap; font-weight: 650; }
.ui-book .fl-pass { color: var(--ui-done); }
.ui-book .fl-fail { color: oklch(0.55 0.17 25); }
.ui-book .fl-again { left: calc(var(--fl-free, 16px) + (100% - var(--fl-free, 16px) - var(--fl-right, 16px)) / 2); width: min(460px, calc(100% - var(--fl-free, 16px) - var(--fl-right, 16px))); }
.ui-book .fl-log { top: 6%; width: min(880px, calc(100% - 32px)); max-height: 86%; overflow: auto; user-select: text; }
.ui-book .fl-log table { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; }
.ui-book .fl-log th { text-align: left; font-weight: 600; color: var(--ui-ink-2); padding: 4px 8px 4px 0; }
.ui-book .fl-log td { padding: 4px 8px 4px 0; border-top: 1px solid var(--ui-line); }
/* A part that is switched off stays off, whatever display its class gives it. */
.ui-book .fl-card [hidden], .ui-book .fl-hud [hidden], .ui-book .fl-beast[hidden], .ui-book .fl-again[hidden], .ui-book .fl-log[hidden] { display: none !important; }
/* The game's own quest card, quick slots, waypoint, hints and the marks over people's heads have no place in the lab. */
.ui-book.lab-fight .gb-hud-quest, .ui-book.lab-fight .gb-hud-slots, .ui-book.lab-fight .gb-beacon, .ui-book.lab-fight .ui-bookbtn,
.ui-book.lab-fight .marks, .ui-book.lab-fight .watch-ring, .ui-book.lab-fight .gu-hint { display: none !important; }
/* The name of a gift, over it as it flies to the hero. */
.ui-book .fl-gift { position: absolute; left: 0; top: 0; padding: 3px 10px; translate: -50% -100%; border-radius: 999px; pointer-events: none; white-space: nowrap;
  font: 650 13px / 1.2 var(--ui-font); color: var(--ui-glass-ink); background: var(--ui-glass); text-shadow: var(--ui-text-shadow); will-change: transform, opacity; }
@container gu (width < 720px) { .ui-book .fl-card { width: 282px; font-size: 12px; } }
/* A short window: the card tightens so it fits at 720 pixels, and below that its scroll bar always shows. */
.ui-book .fl-card { scrollbar-width: thin; scrollbar-color: var(--ui-line-strong) transparent; }
@media (max-height: 820px) {
  .ui-book .fl-card { padding-top: 10px; line-height: 1.32; }
  .ui-book .fl-card h2 { margin-bottom: 6px; }
  .ui-book .fl-card h3 { margin: 8px 0 4px; }
  .ui-book .fl-keys { gap: 2px; }
  .ui-book .fl-card button, .ui-book .fl-card select { min-height: 27px; }
}
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function button(text: string, act: () => void): HTMLButtonElement {
  const b = el('button', '', text);
  b.type = 'button';
  b.addEventListener('click', () => { act(); b.blur(); });
  return b;
}

/** A button with a second, smaller line under its name. */
function tallButton(name: string, small: string, act: () => void): HTMLButtonElement {
  const b = button('', act);
  b.append(name, el('small', '', small));
  return b;
}

function keyList(list: HTMLUListElement, rows: readonly (readonly [string, string])[]): void {
  list.replaceChildren(...rows.map(([key, words]) => { const li = el('li'); li.append(el('b', '', key), words); return li; }));
}

export function createPanel(root: HTMLElement, log: FightLog, actions: PanelActions, scene: PanelOptions = {}): LabPanel {
  const inHall = scene.hall ?? false;
  addStyle(root, 'lab-fight', STYLE);
  root.classList.add('lab-fight');

  // ---------------------------------------------------------------- the card
  const card = el('section', 'fl-card');
  const title = el('h2');
  /** True while the card is folded because a beast woke, not because the player folded it. */
  let foldedForFight = false;
  const setFolded = (small: boolean): void => { card.classList.toggle('is-small', small); fold.textContent = small ? 'Show' : 'Hide'; };
  const fold = button('Hide', () => { foldedForFight = false; setFolded(!card.classList.contains('is-small')); });
  title.append('Fight lab', fold);

  const weapons = el('div', 'fl-row');
  const weaponButtons = new Map<WeaponKind, HTMLButtonElement>();
  WEAPONS.forEach((w, i) => {
    const b = tallButton(w.name, `key ${i + 1}`, () => actions.setWeapon(w.kind));
    b.title = w.asks;
    weaponButtons.set(w.kind, b);
    weapons.append(b);
  });
  weapons.classList.add('is-tall');
  const asks = el('p', 'fl-note');
  const companions = el('div', 'fl-row is-tall');
  const companionButtons = new Map<string, HTMLButtonElement>();
  for (const c of COMPANIONS) {
    const b = tallButton(c.name, ROLE[c.role] ?? c.role, () => actions.setCompanion(c.kind));
    b.title = c.does;
    companionButtons.set(c.kind, b);
    companions.append(b);
  }
  const does = el('p', 'fl-note');

  const beasts = el('div', 'fl-row');
  const second = el('select');
  for (const [value, name] of [['', 'Alone'], ...BEASTS.map((b) => [b.kind, `With a ${b.kind}`])] as [string, string][]) { const o = el('option', '', name); o.value = value; second.append(o); }
  second.addEventListener('change', () => second.blur());
  second.title = 'Bring a second beast in beside the first: two of a kind, or one of each';
  for (const beast of BEASTS) beasts.append(button(capital(beast.kind), () => actions.bring(beast.kind, second.value || undefined)));
  const pairRow = el('div', 'fl-row');
  pairRow.append(second);
  const control = el('div', 'fl-row');
  const wake = button('Wake it', () => actions.wake());
  // In the hall "Take it away" is "Start over": the hall's clear starts it again from the chains.
  control.append(wake, button(inHall ? 'Start over' : 'Take it away', () => actions.clear()));
  wake.hidden = inHall;
  const elsewhere = el('div', 'fl-row');
  const trapsButton = button('Traps', () => actions.setTraps(!trapsButton.classList.contains('is-on')));
  trapsButton.title = 'A side scene: rigs on the ground do the fighting';
  // ---- milestone 3: one entry on the card, the Stag's hall (`?scene=stag`) and the way back to the meadow
  const hallButton = button(inHall ? 'Back to the meadow' : 'The Stag hall', () => {
    const address = new URLSearchParams(location.search);
    address.set('scene', inHall ? 'fight' : 'stag');
    location.search = address.toString();
  });
  // ---- end of the Stag's entry
  if (!inHall) elsewhere.append(trapsButton);
  elsewhere.append(hallButton);

  const options = el('div', 'fl-row');
  const gentle = button('Gentle', () => actions.setGentle(!gentle.classList.contains('is-on')));
  gentle.title = 'Longer warnings and half the hurt';
  const shake = button('Shake', () => actions.setShake(!actions.shaking()));
  shake.title = 'The screen shakes for a spin that lands and a heavy hit on you';
  const quality = el('select');
  for (const [value, name] of [['auto', 'Quality: auto'], ['low', 'Quality: low'], ['medium', 'Quality: medium'], ['high', 'Quality: high']] as const) { const o = el('option', '', name); o.value = value; quality.append(o); }
  quality.addEventListener('change', () => { actions.setQuality(quality.value as QualityMode); quality.blur(); });
  options.append(gentle, shake, quality);
  const keys = el('ul', 'fl-keys');
  const rulesTitle = el('h3', '', 'Its rules');
  const rules = el('ul', 'fl-rules');
  const logRow = el('div', 'fl-row');
  const logButton = button('Log', () => showLog());
  logRow.append(logButton, button('Copy log', () => { void navigator.clipboard?.writeText(log.text()).then(() => say('The log is on the clipboard.'), () => say('The browser would not copy it. Use Save file.')); }), button('Save file', () => {
    const link = el('a');
    link.href = URL.createObjectURL(new Blob([log.text()], { type: 'application/json' }));
    link.download = 'fight-log.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }));
  const weaponTitle = el('h3', '', 'Weapon'), companionTitle = el('h3', '', 'Companion');
  const dizzy = el('p', 'fl-dizzy', DIZZY);
  if (inHall) {
    rules.replaceChildren(...HALL_RULES.map((rule) => el('li', '', rule)));
    card.append(title, weaponTitle, weapons, asks, companionTitle, companions, does, el('h3', '', 'The Verdant Stag'), control, elsewhere, el('h3', '', 'Keys'), keys, rulesTitle, rules, el('h3', '', 'Lab'), options, logRow);
  } else {
    card.append(title, weaponTitle, weapons, asks, companionTitle, companions, does, el('h3', '', 'Bring in'), beasts, pairRow, control, el('h3', '', 'Elsewhere'), elsewhere, el('h3', '', 'Keys'), keys, dizzy, rulesTitle, rules, el('h3', '', 'Lab'), options, logRow);
  }

  // ---------------------------------------------------------------- the bars
  const hud = el('div', 'fl-hud');
  const bars = el('div', 'fl-box fl-bars');
  const health = el('div', 'fl-bar fl-health'), healthFill = el('i');
  const stamina = el('div', 'fl-bar fl-stamina'), staminaFill = el('i');
  health.append(healthFill);
  stamina.append(staminaFill);
  bars.append(health, stamina);
  /** A chip with a key, a name, a small line under it and a cover that shrinks as its rest runs out. */
  const chip = (key: string) => {
    const box = el('div', 'fl-chip'), k = el('b', '', key), name = el('span'), small = el('small'), cover = el('i');
    box.append(cover, k, name, small);
    return { box, key: k, name, small, cover };
  };
  const handBox = el('div', 'fl-box fl-chips');
  const hand = chip('1-3');
  handBox.append(hand.box);
  const companionBox = el('div', 'fl-box fl-chips');
  const skill = chip('C');
  companionBox.append(skill.box);
  const kitBox = el('div', 'fl-box fl-chips');
  const kit = RIGS.map((rig, i) => {
    const c = el('div', 'fl-chip'), key = el('b', '', String(i + 1)), name = el('span', '', rig.name);
    c.title = rig.does;
    c.append(key, name);
    kitBox.append(c);
    return { kind: rig.kind, chip: c };
  });
  hud.append(bars, handBox, companionBox, kitBox);
  const line = el('div', 'fl-say');
  const edge = el('div', 'fl-edge');
  edge.append(el('i'));

  // ---------------------------------------------------------------- over each beast
  const overs = [0, 1].map(() => {
    const over = el('div', 'fl-beast');
    const name = el('div'), guard = el('div', 'fl-guard'), fill = el('i'), state = el('em');
    guard.append(fill);
    over.append(name, guard, state);
    over.hidden = true;
    return { over, name, guard, fill, state, kind: '', guardShown: -1, stateShown: '', segments: 0 };
  });

  // ---------------------------------------------------------------- after a fight, and the log
  const again = el('section', 'fl-again');
  again.hidden = true;
  const logBox = el('section', 'fl-log');
  logBox.hidden = true;
  const gift = el('div', 'fl-gift');
  gift.hidden = true;
  root.append(edge, card, hud, line, ...overs.map((o) => o.over), gift, again, logBox);
  let giftText = '', giftAlpha = -1;

  function checkRows(checks: Check[]): HTMLTableElement {
    const table = el('table', 'fl-checks');
    for (const check of checks) {
      const row = el('tr'), result = el('td', check.pass === null ? '' : check.pass ? 'fl-pass' : 'fl-fail', check.pass === null ? '' : check.pass ? 'Pass' : 'Fail');
      row.append(el('td', '', check.what), el('td', '', `${check.got} (${check.want})`), result);
      table.append(row);
    }
    return table;
  }

  /** The encounter the open card after a fight is about: its beasts, way and companion. Any change closes it. */
  const asked = { beast: -1, way: '', companion: '' };

  function showAgain(fight: LoggedFight): void {
    again.replaceChildren();
    const head = el('h2', '', capital(endedWord(fight)));
    const lines = el('div', 'fl-lines');
    lines.append(...summaryOf(fight).map((text) => el('p', '', text)));
    const row = el('div', 'fl-row');
    row.append(button('Fight it again', () => { again.hidden = true; actions.again(fight); }), button('Close', () => { again.hidden = true; }));
    again.append(head, lines);
    // The hall keeps its checks: is the Stag ever quiet for long?
    if (fight.way === 'stag') again.append(checkRows(checksOf(fight)));
    again.append(row);
    again.hidden = false;
    refreshLogButton();
  }

  function showLog(): void {
    logBox.replaceChildren();
    const head = el('h2', '', 'Every fight');
    const table = el('table');
    const top = el('tr');
    for (const name of ['When', 'Weapon', 'Companion', 'Beasts', 'Ended', 'Seconds', 'Hits', 'Health lost', 'Faints', 'What hit you']) top.append(el('th', '', name));
    table.append(top);
    for (const fight of [...log.all()].reverse()) {
      const row = el('tr');
      // Fights from before milestone 4 have no weapon or companion: their way and pet say what they were.
      const old = fight as LoggedFight & { pet?: string };
      const weapon = fight.way === 'world' ? 'traps' : fight.weapon ?? `${fight.way} way`;
      const by = Object.entries(fight.hitBy ?? {}).map(([attack, n]) => `${attack} ${n}`).join(', ') || 'nothing';
      for (const text of [new Date(fight.at).toLocaleTimeString(), weapon, fight.companion ?? old.pet ?? '', fight.way === 'stag' ? 'the Stag' : foesOf(fight), endedWord(fight), fight.length.toFixed(1), String(fight.hitsTaken), fight.healthLost === undefined ? '' : String(Math.round(fight.healthLost)), String(fight.faints), by]) row.append(el('td', '', text));
      table.append(row);
    }
    const row = el('div', 'fl-row');
    row.style.marginTop = '12px';
    row.append(button('Close', () => { logBox.hidden = true; }), button('Empty the log', () => { log.clear(); refreshLogButton(); showLog(); }));
    logBox.append(head, table, row);
    logBox.hidden = false;
  }

  /** The count on the Log button is the log's length, whatever added to it: a fight won, one left, an emptied log. */
  let shownLogCount = -1;
  function refreshLogButton(): void {
    const count = log.all().length;
    if (count === shownLogCount) return;
    shownLogCount = count;
    logButton.textContent = `Log (${count})`;
  }
  refreshLogButton();

  let sayTimer = 0;
  function say(text: string, ms = 1600): void {
    line.textContent = text;
    line.classList.add('is-on');
    clearTimeout(sayTimer);
    sayTimer = window.setTimeout(() => line.classList.remove('is-on'), ms);
  }

  // ---------------------------------------------------------------- the room the card leaves
  // Centered bars cross the card on a narrow window. They move right of it, and wrap when even that is too narrow.
  // "Again?" and the short line center in the same room. "Again?" also keeps clear of the minimap and the clock in
  // the top right corner, 232 pixels wide, when it would reach them.
  const hudWidth = (): number => {
    let width = 0, shown = 0;
    for (const box of hud.children) if (!(box as HTMLElement).hidden) { width += (box as HTMLElement).offsetWidth; shown++; }
    return width + Math.max(0, shown - 1) * 14;
  };
  function layout(): void {
    const page = root.clientWidth, free = card.offsetLeft + card.offsetWidth + 16, wide = hudWidth();
    root.style.setProperty('--fl-free', `${free}px`);
    const room = page - free - 16, card460 = Math.min(460, room);
    root.style.setProperty('--fl-right', `${free + (room + card460) / 2 > page - MAP_CORNER ? MAP_CORNER : 16}px`);
    const wrapped = free + wide > page - 16;
    hud.classList.toggle('is-wrapped', wrapped);
    const middle = wrapped ? free + (page - 16 - free) / 2 : Math.max(page / 2, free + wide / 2);
    root.style.setProperty('--fl-hud-x', `${Math.round(middle)}px`);
    root.style.setProperty('--fl-hud-h', `${hud.offsetHeight}px`);
  }
  const watcher = new ResizeObserver(layout);
  for (const part of [root, card, hud]) watcher.observe(part);

  // ---------------------------------------------------------------- what was drawn last, so a frame writes only what changed
  let shownWay = '', shownWeapon = '', shownCompanion = '', shownBeasts = '', shownHealth = -1, shownStamina = -1;
  let shownSkill = '?', shownCover = -1, shownHand = '?', shownHandCover = -1;
  const shownKit = ['?', '?', '?', '?'];

  function refreshSlow(fight: Fight, held: RigKind | null): void {
    const s = fight.skill(), name = s.name;
    if (name !== shownSkill) {
      shownSkill = name;
      skill.name.textContent = name;
      skill.small.textContent = fight.way === 'world' ? fight.companion.def.name : `${fight.companion.def.name}, ${ROLE[fight.companion.def.role]?.toLowerCase() ?? ''}`;
    }
    const cover = Math.round((s.left / s.rest) * 50);
    if (cover !== shownCover) { shownCover = cover; skill.cover.style.transform = `scaleX(${cover / 50})`; }
    const weapon = WEAPONS.find((w) => w.kind === fight.hero.weapon), handName = weapon?.name ?? '';
    if (handName !== shownHand) { shownHand = handName; hand.name.textContent = handName; hand.small.textContent = weapon ? `hold: ${weapon.held.name.toLowerCase()}` : ''; }
    const handCover = Math.round((fight.hero.swap / HERO.swap) * 20);
    if (handCover !== shownHandCover) { shownHandCover = handCover; hand.cover.style.transform = `scaleX(${handCover / 20})`; }
    if (fight.way === 'world') {
      const left = fight.kit();
      kit.forEach((slot, i) => {
        const state = slot.kind === held ? 'is-held' : left.includes(slot.kind) ? '' : 'is-gone';
        if (state === shownKit[i]) return;
        shownKit[i] = state;
        slot.chip.className = `fl-chip ${state}`;
      });
    }
  }

  let tick = 0, shownAwake = false;

  function stateOf(beast: BeastState): { text: string; angry: boolean } {
    if (beast.doing === 'asleep') return { text: 'Asleep. Walk up, or press E', angry: false };
    if (beast.doing === 'dizzy') return { text: beast.def.machine ? 'Dizzy. Hold F to shut it down' : 'Dizzy. Hold F to calm it', angry: false };
    if (beast.doing === 'calmed') return { text: beast.def.machine ? 'Shut down' : 'Calmed', angry: false };
    if (beast.doing === 'held') return { text: 'Snared', angry: false };
    if (beast.doing === 'stun' || beast.doing === 'flung') return { text: 'Helpless', angry: false };
    if (beast.enraged) return { text: 'Angry: it comes faster', angry: true };
    if (beast.slow > 0) return { text: 'Slowed', angry: false };
    return { text: '', angry: false };
  }

  /** The keys for what is in the hand now, and the companion's skill. */
  function refreshKeys(fight: Fight): void {
    if (fight.way === 'world') { keyList(keys, TRAP_KEYS); return; }
    const s = fight.companion.def.skill;
    const rows: (readonly [string, string])[] = [...WEAPON_KEYS[fight.hero.weapon], ...COMMON_KEYS, ['C', `${s.name}. ${SKILL_WORDS[s.name] ?? ''}`]];
    if (!inHall) rows.push(['Hold F', 'Hold out the Mark to a dizzy beast to calm it']);
    keyList(keys, rows);
  }

  return {
    element: root,
    ask: showAgain,
    say,
    label(text, at, alpha) {
      gift.hidden = !at || alpha <= 0;
      if (gift.hidden || !at) return;
      if (text !== giftText) { giftText = text; gift.textContent = text; }
      const a = Math.round(alpha * 20) / 20;
      if (a !== giftAlpha) { giftAlpha = a; gift.style.opacity = String(a); }
      gift.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
    },
    update(fight, held, mode, beastAt, hall = null) {
      const first = fight.beasts[0];
      // The card after a fight is about one fight: new beasts, the traps or a new companion close it. In the hall,
      // the hall starting over does.
      const encounter = hall ? hall.round : first?.id ?? -1;
      if (again.hidden) { asked.beast = encounter; asked.way = fight.way; asked.companion = fight.companion.def.kind; }
      else if (encounter !== asked.beast || fight.way !== asked.way || fight.companion.def.kind !== asked.companion) again.hidden = true;
      refreshLogButton();
      // The card folds while a beast or the Stag is awake, and opens again when it is calmed, freed or gone.
      const awake = hall ? hall.stag.doing !== 'asleep' && !hall.freed : fight.phase === 'fight';
      if (awake !== shownAwake) {
        shownAwake = awake;
        if (awake && !card.classList.contains('is-small')) { foldedForFight = true; setFolded(true); }
        else if (!awake && foldedForFight) { foldedForFight = false; setFolded(false); }
      }
      const traps = fight.way === 'world';
      if (fight.way !== shownWay || fight.hero.weapon !== shownWeapon || fight.companion.def.kind !== shownCompanion) {
        shownWay = fight.way;
        shownWeapon = fight.hero.weapon;
        shownCompanion = fight.companion.def.kind;
        for (const [kind, b] of weaponButtons) b.classList.toggle('is-on', !traps && kind === fight.hero.weapon);
        for (const [kind, b] of companionButtons) b.classList.toggle('is-on', kind === fight.companion.def.kind);
        trapsButton.classList.toggle('is-on', traps);
        const weapon = WEAPONS.find((w) => w.kind === fight.hero.weapon);
        asks.textContent = traps ? TRAPS_NOTE : `${weapon?.name ?? ''}: ${weapon?.asks ?? ''}`;
        does.textContent = traps ? `${fight.companion.def.name} lures the beast where you point.` : `${fight.companion.def.name}: ${fight.companion.def.does}`;
        pairRow.hidden = traps || inHall;
        refreshKeys(fight);
        kitBox.hidden = !traps;
        handBox.hidden = traps;
        shownKit.fill('?');
      }
      const kinds = fight.beasts.map((b) => b.def.kind).join('+');
      if (kinds !== shownBeasts && !inHall) {
        shownBeasts = kinds;
        rulesTitle.hidden = rules.hidden = kinds === '';
        const list: string[] = [];
        for (const kind of new Set(fight.beasts.map((b) => b.def.kind))) for (const rule of beastOf(kind).rules) list.push(fight.beasts.length > 1 && new Set(fight.beasts.map((b) => b.def.kind)).size > 1 ? `${capital(kind)}: ${rule}` : rule);
        rules.replaceChildren(...list.map((rule) => el('li', '', rule)));
        rulesTitle.textContent = fight.beasts.length > 1 ? 'Their rules' : 'Its rules';
      }
      wake.disabled = !first || first.doing !== 'asleep';
      gentle.classList.toggle('is-on', fight.gentle);
      shake.classList.toggle('is-on', actions.shaking());
      if (quality.value !== mode) quality.value = mode;

      const h = Math.round((fight.hero.health / HERO.health) * 100), s = Math.round((fight.hero.stamina / HERO.stamina) * 100);
      if (h !== shownHealth) {
        shownHealth = h;
        healthFill.style.transform = `scaleX(${h / 100})`;
        // The edge comes in below LOW_HEALTH and is whole at a quarter of that. A fainted hero is past it.
        const low = fight.hero.act === 'faint' ? 0 : Math.min(1, Math.max(0, (LOW_HEALTH * 100 - h) / (LOW_HEALTH * 75)));
        edge.style.opacity = low.toFixed(2);
        edge.classList.toggle('is-low', low > 0);
      }
      if (s !== shownStamina) { shownStamina = s; staminaFill.style.transform = `scaleX(${s / 100})`; }
      // The skill, the weapon and the kit are asked for ten times a second: each answer is a small new object.
      if (tick++ % 6 === 0) refreshSlow(fight, held);
      // A bar over each beast. A calmed beast needs none: the heart and the gift say it.
      for (let i = 0; i < overs.length; i++) {
        const o = overs[i] as (typeof overs)[number], beast = fight.beasts[i];
        const at = beast && beast.doing !== 'calmed' ? beastAt(beast) : null;
        o.over.hidden = !at;
        if (!beast || !at) continue;
        o.over.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        if (o.kind !== beast.def.kind) {
          o.kind = beast.def.kind;
          o.name.replaceChildren(`${beast.def.name} `, el('small', '', `depth ${beast.def.depth}`));
          o.segments = 0;
        }
        const g = Math.round((beast.guard / beast.full) * 200);
        if (g !== o.guardShown) { o.guardShown = g; o.fill.style.transform = `scaleX(${g / 200})`; }
        if (o.segments !== beast.def.segments) {
          o.segments = beast.def.segments;
          o.guard.querySelectorAll('u').forEach((tick) => tick.remove());
          for (let k = 1; k < beast.def.segments; k++) { const tick = el('u'); tick.style.left = `${(k / beast.def.segments) * 100}%`; o.guard.append(tick); }
        }
        const state = stateOf(beast);
        if (state.text !== o.stateShown) { o.stateShown = state.text; o.state.textContent = state.text; o.state.classList.toggle('is-angry', state.angry); }
      }
    },
  };
}
