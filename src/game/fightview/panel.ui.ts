// The fight lab's interface, in HTML over the game: the card that picks the way to fight and the beast, the
// hero's two bars, the pet's hearts and skills, the kit of rigs, the bar over the beast, the "Again?" card, the
// log, and the warm edge of the screen when the hero is low. It reads the fight and draws it. Every button calls
// back into the lab's view, which owns the fight.
import { BEASTS, FIGHT_PETS, HERO, LOW_HEALTH, RIGS, WAYS, type RigKind, type Way } from '../content/fight.ts';
import type { BeastState, Fight } from '../fight/fight.sim.ts';
import { checksOf, type Check } from '../fight/record.sim.ts';
import type { QualityMode } from '../shell/view.ts';
import { addStyle } from '../uiview/theme.ts';
import type { FightLog, LoggedFight } from './log.ts';

export interface PanelActions {
  setWay(way: Way): void;
  bring(kind: string): void;
  wake(): void;
  clear(): void;
  setGentle(on: boolean): void;
  /** Turns the screen's shake on or off, and `shaking` says which it is. */
  setShake(on: boolean): void;
  shaking(): boolean;
  setPet(kind: string): void;
  setQuality(mode: QualityMode): void;
  pickRig(kind: RigKind | null): void;
  again(): void;
}

export interface LabPanel {
  /** Once a frame. `held` is the rig in the hand. `beastAt` is where the bar over a beast goes on the page, or null when it is out of view. */
  update(fight: Fight, held: RigKind | null, quality: QualityMode, beastAt: (beast: BeastState) => { x: number; y: number } | null): void;
  /** Shows "Again?" for a fight that just ended. */
  ask(fight: LoggedFight): void;
  /** A short line under the bars: why something could not be done. */
  say(text: string): void;
  /** The name of a gift, floating over the page where it flies. Null `at` hides it. */
  label(text: string, at: { x: number; y: number } | null, alpha: number): void;
  /** True while the pointer is over a part of the interface, so a click there is not a swing. */
  readonly element: HTMLElement;
}

const WAY_NAMES: Record<Way, string> = { hero: 'The hero fights', pet: 'The pet fights', world: 'The world fights' };
const WAY_SHORT: Record<Way, string> = { hero: 'Hero', pet: 'Pet', world: 'World' };

const KEYS: Record<Way, readonly (readonly [string, string])[]> = {
  hero: [
    ['Click', 'Cut. Click again for a second cut'],
    ['Hold click', 'Charge a spin, let go to strike all round'],
    ['Shift', 'Dodge the way you walk'],
    ['C', "Your pet's pounce"],
    ['Hold F', 'Hold out the Mark to a dizzy beast'],
  ],
  pet: [
    ['Click a beast', 'Send your pet at it'],
    ['Click', 'Throw light. Each hit marks the beast for the pet'],
    ['Right click', 'Whistle the pet out of an attack'],
    ['Shift', 'Dodge the way you walk'],
    ['C and T', "Your pet's two skills"],
    ['Hold F', 'Hold out the Mark to a dizzy beast'],
  ],
  world: [
    ['1 to 4', 'Take a rig in hand, click to set it down'],
    ['Z', 'Take the last rig back'],
    ['E', 'Wake the beast, or walk up to it'],
    ['C', 'Send your pet to the pointer as a lure'],
    ['Shift', 'Dodge the way you walk'],
    ['F', 'Spring the plate. Hold it to calm a dizzy beast'],
  ],
};

const WHAT_TO_FEEL: Record<Way, string> = {
  hero: 'Does a cut have weight? Can you say why each hit on you landed?',
  pet: 'Are you fighting or watching? Do you flinch when your pet is about to be hit?',
  world: 'Do you think "I outsmarted it"? Is the setup play or a chore?',
};

const AGAIN_WORDS = ['', 'No', 'Not really', 'Maybe', 'Yes', 'Right now'];

const STYLE = /* css */ `
.ui-book .fl-card {
  position: absolute; left: 16px; top: 16px; width: 316px; max-height: calc(100% - 32px); overflow: auto; padding: 14px 16px 12px;
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
.ui-book .fl-card.is-small h2 { margin: 0; }
.ui-book .fl-note { margin-top: 8px; font-size: 12px; }

.ui-book .fl-hud {
  position: absolute; left: 50%; bottom: 18px; translate: -50% 0; display: flex; gap: 14px; align-items: flex-end; pointer-events: none;
  font: 600 12px / 1.2 var(--ui-font); color: var(--ui-glass-ink); text-shadow: var(--ui-text-shadow);
}
.ui-book .fl-box { padding: 8px 10px; background: var(--ui-glass); border-radius: var(--ui-radius); box-shadow: var(--ui-glass-shadow); }
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
.ui-book .fl-say { position: absolute; left: 50%; bottom: 96px; translate: -50% 0; padding: 5px 12px; border-radius: 999px; pointer-events: none;
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
.ui-book .fl-beast small { font-size: 11px; font-weight: 600; opacity: 0.85; }

.ui-book .fl-again, .ui-book .fl-log {
  position: absolute; left: 50%; top: 12%; translate: -50% 0; width: min(460px, calc(100% - 32px)); padding: 16px 18px; pointer-events: auto;
  font: 400 13.5px / 1.45 var(--ui-font); color: var(--ui-ink); background: var(--ui-paper); border-radius: var(--ui-radius); box-shadow: var(--ui-lift);
}
.ui-book .fl-again h2, .ui-book .fl-log h2 { margin: 0 0 4px; font: 650 18px / 1.2 var(--ui-font); }
.ui-book .fl-again p { margin: 0 0 10px; color: var(--ui-ink-2); }
.ui-book .fl-rate { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 12px; }
.ui-book .fl-rate button { min-height: 52px; display: grid; place-items: center; gap: 2px; padding: 4px; white-space: normal; }
.ui-book .fl-rate button b { font-size: 18px; }
.ui-book .fl-rate button span { font-weight: 500; font-size: 11px; color: var(--ui-ink-2); }
.ui-book .fl-rate button.is-on { color: var(--ui-paper-light); background: var(--ui-accent); border-color: transparent; }
.ui-book .fl-rate button.is-on span { color: inherit; }
.ui-book .fl-checks { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12.5px; }
.ui-book .fl-checks td { padding: 3px 6px 3px 0; border-top: 1px solid var(--ui-line); vertical-align: top; }
.ui-book .fl-checks td:last-child { white-space: nowrap; font-weight: 650; }
.ui-book .fl-pass { color: var(--ui-done); }
.ui-book .fl-fail { color: oklch(0.55 0.17 25); }
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
@container gu (width < 720px) { .ui-book .fl-card { width: 250px; font-size: 12px; } }
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

export function createPanel(root: HTMLElement, log: FightLog, actions: PanelActions): LabPanel {
  addStyle(root, 'lab-fight', STYLE);
  root.classList.add('lab-fight');

  // ---------------------------------------------------------------- the card
  const card = el('section', 'fl-card');
  const title = el('h2');
  const fold = button('Hide', () => { fold.textContent = card.classList.toggle('is-small') ? 'Show' : 'Hide'; });
  title.append('Fight lab', fold);
  const ways = el('div', 'fl-row');
  const wayButtons = new Map<Way, HTMLButtonElement>();
  for (const way of WAYS) {
    const b = button(WAY_SHORT[way], () => actions.setWay(way));
    b.title = WAY_NAMES[way];
    wayButtons.set(way, b);
    ways.append(b);
  }
  const feel = el('p', 'fl-note');
  const beasts = el('div', 'fl-row');
  for (const beast of BEASTS) beasts.append(button(beast.kind === 'boar' ? 'Boar' : beast.name.replace('Blighted ', '').replace(/^./, (c) => c.toUpperCase()), () => actions.bring(beast.kind)));
  const control = el('div', 'fl-row');
  const wake = button('Wake it', () => actions.wake());
  control.append(wake, button('Take it away', () => actions.clear()));
  const options = el('div', 'fl-row');
  const gentle = button('Gentle', () => actions.setGentle(!gentle.classList.contains('is-on')));
  gentle.title = 'Longer warnings and half the hurt';
  const shake = button('Shake', () => actions.setShake(!actions.shaking()));
  shake.title = 'The screen shakes for a spin that lands and a heavy hit on you';
  const pets = el('select');
  for (const pet of FIGHT_PETS) { const o = el('option', '', pet.name); o.value = pet.kind; pets.append(o); }
  pets.addEventListener('change', () => { actions.setPet(pets.value); pets.blur(); });
  const quality = el('select');
  for (const [value, name] of [['auto', 'Quality: auto'], ['low', 'Quality: low'], ['medium', 'Quality: medium'], ['high', 'Quality: high']] as const) { const o = el('option', '', name); o.value = value; quality.append(o); }
  quality.addEventListener('change', () => { actions.setQuality(quality.value as QualityMode); quality.blur(); });
  options.append(gentle, shake, pets, quality);
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
  card.append(title, el('h3', '', 'Way to fight'), ways, feel, el('h3', '', 'Bring in'), beasts, control, el('h3', '', 'Keys'), keys, rulesTitle, rules, el('h3', '', 'Lab'), options, logRow);

  // ---------------------------------------------------------------- the bars
  const hud = el('div', 'fl-hud');
  const bars = el('div', 'fl-box fl-bars');
  const health = el('div', 'fl-bar fl-health'), healthFill = el('i');
  const stamina = el('div', 'fl-bar fl-stamina'), staminaFill = el('i');
  health.append(healthFill);
  stamina.append(staminaFill);
  bars.append(health, stamina);
  const petBox = el('div', 'fl-box fl-chips');
  const hearts = el('span', 'fl-hearts');
  const skills = [0, 1].map(() => {
    const chip = el('div', 'fl-chip'), key = el('b'), name = el('span'), cover = el('i');
    chip.append(cover, key, name);
    return { chip, key, name, cover };
  });
  petBox.append(hearts, ...skills.map((s) => s.chip));
  const kitBox = el('div', 'fl-box fl-chips');
  const kit = RIGS.map((rig, i) => {
    const chip = el('div', 'fl-chip'), key = el('b', '', String(i + 1)), name = el('span', '', rig.name);
    chip.title = rig.does;
    chip.append(key, name);
    kitBox.append(chip);
    return { kind: rig.kind, chip };
  });
  hud.append(bars, petBox, kitBox);
  const line = el('div', 'fl-say');
  const edge = el('div', 'fl-edge');
  edge.append(el('i'));

  // ---------------------------------------------------------------- over the beast
  const over = el('div', 'fl-beast');
  const overName = el('div'), guard = el('div', 'fl-guard'), guardFill = el('i'), overState = el('em');
  guard.append(guardFill);
  over.append(overName, guard, overState);
  over.hidden = true;

  // ---------------------------------------------------------------- again, and the log
  const again = el('section', 'fl-again');
  again.hidden = true;
  const logBox = el('section', 'fl-log');
  logBox.hidden = true;
  const gift = el('div', 'fl-gift');
  gift.hidden = true;
  root.append(edge, card, hud, line, over, gift, again, logBox);
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

  function ask(fight: LoggedFight): void {
    const earlier = log.all().filter((f) => f !== fight && f.at <= fight.at);
    const beast = BEASTS.find((b) => b.kind === fight.enemy);
    again.replaceChildren();
    const head = el('h2', '', 'Again?');
    const sum = el('p', '', `${beast?.name ?? fight.enemy}, ${fight.result === 'calmed' ? (beast?.machine ? 'shut down' : 'calmed') : 'left'} in ${fight.length.toFixed(1)} s. ${WAY_NAMES[fight.way]}. Hits taken: ${fight.hitsTaken}${fight.faints ? `, fainted ${fight.faints} time${fight.faints > 1 ? 's' : ''}` : ''}.`);
    const rate = el('div', 'fl-rate');
    const buttons: HTMLButtonElement[] = [];
    for (let n = 1; n <= 5; n++) {
      const b = el('button');
      b.type = 'button';
      b.append(el('b', '', String(n)), el('span', '', AGAIN_WORDS[n] as string));
      b.addEventListener('click', () => {
        log.rate(fight, n);
        buttons.forEach((other, i) => other.classList.toggle('is-on', i + 1 === n));
        refreshLogButton();
      });
      buttons.push(b);
      rate.append(b);
    }
    const hits = Object.entries(fight.hitBy).map(([attack, count]) => `${attack} ${count}`).join(', ');
    const why = el('p', '', hits ? `What hit you: ${hits}.` : 'Nothing hit you.');
    const row = el('div', 'fl-row');
    row.append(button('Fight it again', () => { again.hidden = true; actions.again(); }), button('Close', () => { again.hidden = true; }));
    again.append(head, sum, rate, why, checkRows(checksOf(fight, earlier)), row);
    again.hidden = false;
    refreshLogButton();
  }

  function showLog(): void {
    logBox.replaceChildren();
    const head = el('h2', '', 'Every fight');
    const table = el('table');
    const top = el('tr');
    for (const name of ['When', 'Way', 'Beast', 'Ended', 'Seconds', 'Hits', 'Faints', 'Again?', 'Numbers']) top.append(el('th', '', name));
    table.append(top);
    for (const fight of [...log.all()].reverse()) {
      const row = el('tr');
      const numbers = fight.way === 'hero'
        ? `${fight.whiffs} of ${fight.swings} swings hit nothing, ${fight.dodges} dodges`
        : fight.way === 'pet'
          ? `${(fight.length > 0 ? (fight.inputs / fight.length) * 10 : 0).toFixed(1)} presses in 10 s, gap ${fight.longestGap.toFixed(1)} s, ${fight.whistles} whistles, pet hit ${fight.petHits}, fainted ${fight.petFaints}`
          : `setup ${fight.setup.toFixed(1)} s, ${fight.rigsTriggered} of ${fight.rigsPlaced} rigs set off, ${fight.crashes} crashes, ${fight.layout.join(' ') || 'no rigs'}`;
      for (const text of [new Date(fight.at).toLocaleTimeString(), fight.way, fight.enemy, fight.result, fight.length.toFixed(1), String(fight.hitsTaken), String(fight.faints), fight.again ? String(fight.again) : '', numbers]) row.append(el('td', '', text));
      table.append(row);
    }
    const row = el('div', 'fl-row');
    row.style.marginTop = '12px';
    row.append(button('Close', () => { logBox.hidden = true; }), button('Empty the log', () => { log.clear(); refreshLogButton(); showLog(); }));
    logBox.append(head, table, row);
    logBox.hidden = false;
  }

  function refreshLogButton(): void {
    logButton.textContent = `Log (${log.all().length})`;
  }
  refreshLogButton();

  let sayTimer = 0;
  function say(text: string): void {
    line.textContent = text;
    line.classList.add('is-on');
    clearTimeout(sayTimer);
    sayTimer = window.setTimeout(() => line.classList.remove('is-on'), 1600);
  }

  // ---------------------------------------------------------------- what was drawn last, so a frame writes only what changed
  let shownWay: Way | null = null, shownBeast = '', shownHealth = -1, shownStamina = -1, shownGuard = -1, shownState = '', shownHearts = -1, shownSegments = 0;
  const shownSkill = ['?', '?'], shownCover = [-1, -1], shownKit = ['?', '?', '?', '?'];

  function refreshSlow(fight: Fight, held: RigKind | null): void {
    for (let i = 0; i < 2; i++) {
      const skill = fight.skill(i as 0 | 1), slot = skills[i] as (typeof skills)[number];
      const name = skill?.name ?? '';
      if (name !== shownSkill[i]) {
        shownSkill[i] = name;
        slot.chip.hidden = !skill;
        slot.key.textContent = i === 0 ? 'C' : 'T';
        slot.name.textContent = name;
      }
      const cover = skill ? Math.round((skill.left / skill.rest) * 50) : 0;
      if (cover !== shownCover[i]) { shownCover[i] = cover; slot.cover.style.transform = `scaleX(${cover / 50})`; }
    }
    petBox.hidden = !fight.skill(0) && fight.way !== 'pet';
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

  let tick = 0;

  function stateOf(beast: BeastState): string {
    if (beast.doing === 'asleep') return 'Asleep. Walk up, or press E';
    if (beast.doing === 'dizzy') return beast.def.machine ? 'Hold F to shut it down' : 'Hold F to calm it';
    if (beast.doing === 'calmed') return beast.def.machine ? 'Shut down' : 'Calmed';
    if (beast.doing === 'held') return 'Snared';
    if (beast.doing === 'stun' || beast.doing === 'flung') return 'Helpless';
    return '';
  }

  return {
    element: root,
    ask,
    say,
    label(text, at, alpha) {
      gift.hidden = !at || alpha <= 0;
      if (gift.hidden || !at) return;
      if (text !== giftText) { giftText = text; gift.textContent = text; }
      const a = Math.round(alpha * 20) / 20;
      if (a !== giftAlpha) { giftAlpha = a; gift.style.opacity = String(a); }
      gift.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
    },
    update(fight, held, mode, beastAt) {
      const beast = fight.beasts[0];
      if (fight.way !== shownWay) {
        shownWay = fight.way;
        for (const [way, b] of wayButtons) b.classList.toggle('is-on', way === fight.way);
        feel.textContent = WHAT_TO_FEEL[fight.way];
        keys.replaceChildren(...KEYS[fight.way].map(([key, words]) => { const li = el('li'); li.append(el('b', '', key), words); return li; }));
        kitBox.hidden = fight.way !== 'world';
        hearts.hidden = fight.way !== 'pet';
      }
      const kind = beast?.def.kind ?? '';
      if (kind !== shownBeast) {
        shownBeast = kind;
        rulesTitle.hidden = rules.hidden = !beast;
        rules.replaceChildren(...(beast?.def.rules ?? []).map((rule) => el('li', '', rule)));
        overName.replaceChildren(beast ? `${beast.def.name} ` : '', beast ? el('small', '', `depth ${beast.def.depth}`) : '');
        shownSegments = 0;
      }
      wake.disabled = !beast || beast.doing !== 'asleep';
      gentle.classList.toggle('is-on', fight.gentle);
      shake.classList.toggle('is-on', actions.shaking());
      if (pets.value !== fight.pet.def.kind) pets.value = fight.pet.def.kind;
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

      if (fight.way === 'pet' && fight.pet.hearts !== shownHearts) {
        shownHearts = fight.pet.hearts;
        hearts.textContent = '♥'.repeat(Math.max(0, fight.pet.hearts)) + '♡'.repeat(Math.max(0, fight.pet.def.hearts - fight.pet.hearts));
      }
      // The skills and the kit are asked for ten times a second: each answer is a small new object.
      if (tick++ % 6 === 0) refreshSlow(fight, held);
      // A calmed beast needs no bar: the heart and the gift say it.
      const at = beast && beast.doing !== 'calmed' ? beastAt(beast) : null;
      over.hidden = !at;
      if (beast && at) {
        over.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
        const g = Math.round((beast.guard / beast.def.guard) * 200);
        if (g !== shownGuard) { shownGuard = g; guardFill.style.transform = `scaleX(${g / 200})`; }
        if (shownSegments !== beast.def.segments) {
          shownSegments = beast.def.segments;
          guard.querySelectorAll('u').forEach((tick) => tick.remove());
          for (let i = 1; i < beast.def.segments; i++) { const tick = el('u'); tick.style.left = `${(i / beast.def.segments) * 100}%`; guard.append(tick); }
        }
        const state = stateOf(beast);
        if (state !== shownState) { shownState = state; overState.textContent = state; }
      }
    },
  };
}
