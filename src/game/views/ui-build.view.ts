// Build mode's words: a bar above the quick slots that says what the held item does and which keys work, and
// a line beside the pointer that counts the stroke ("Plant 12 · you have 9") or says why a cell is refused.
// Until build mode has been used once, a small chip names its key while the hand holds something it can use.
//
// Everything it says comes from `game.systems.build.plan()`. The picture in the world is world-build.view.ts.
import type { BuildPlan, CellVerdict, Systems } from '../api.sim.ts';
import { reasonOf } from '../build/plan.sim.ts';
import type { GameView } from '../shell/view.ts';
import { bookOf } from '../uiview/book.ts';
import { KNOWS_BUILD_FLAG } from '../uiview/build.ts';
import { addStyle } from '../uiview/theme.ts';

const STYLE = /* css */ `
.ui-book .bd-bar, .ui-book .bd-chip {
  position: absolute; left: 50%; bottom: calc(var(--ui-hud-clear) + 52px); transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px; padding: 8px 14px; white-space: nowrap;
  font: 500 14px / 1.3 var(--ui-font); font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased;
  color: var(--ui-glass-ink); background: var(--ui-glass); border-radius: var(--ui-radius); box-shadow: var(--ui-glass-shadow);
  transition: opacity 160ms var(--ui-ease), transform 160ms var(--ui-ease);
}
.ui-book .bd-chip { padding: 6px 12px; gap: 8px; color: var(--ui-glass-ink-2); }
.ui-book .bd-bar[hidden], .ui-book .bd-chip[hidden], .ui-book .bd-tip[hidden] { display: none; }
.ui-book.ui-covered .bd-bar, .ui-book.ui-covered .bd-chip, .ui-book.ui-covered .bd-tip, .ui-book.ui-talking .bd-chip { visibility: hidden; }
.ui-book .bd-name { display: inline-flex; align-items: center; gap: 8px; font-weight: 650; }
.ui-book .bd-name::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: oklch(0.82 0.13 180); box-shadow: 0 0 8px oklch(0.82 0.13 180 / 0.8); }
.ui-book .bd-what { color: var(--ui-glass-ink-2); }
.ui-book .bd-keys { display: inline-flex; align-items: center; gap: 10px; padding-left: 12px; border-left: 1px solid var(--ui-glass-line); color: var(--ui-glass-ink-2); }
.ui-book .bd-keys span[hidden] { display: none; }
.ui-book .bd-key {
  display: inline-grid; place-items: center; min-width: 22px; height: 22px; margin-right: 5px; padding: 0 5px;
  font: 650 12px / 1 var(--ui-font); color: var(--ui-glass-ink); background: var(--ui-glass-2); border: 1px solid var(--ui-glass-line); border-radius: var(--ui-radius-sm);
}
.ui-book .bd-tip {
  position: absolute; left: 0; top: 0; padding: 5px 10px; white-space: nowrap; pointer-events: none;
  font: 600 13px / 1.3 var(--ui-font); font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased;
  color: var(--ui-glass-ink); background: var(--ui-glass); border-radius: var(--ui-radius-sm); box-shadow: var(--ui-glass-shadow);
}
.ui-book .bd-tip.is-short { color: oklch(0.88 0.13 82); }
.ui-book .bd-tip.is-refused { color: oklch(0.84 0.11 30); }
/* The pointer is a cross while build mode is on. The keys hide it during a drag that turns the camera. */
canvas.bd-on { cursor: crosshair; }
@media (prefers-reduced-motion: reduce) { .ui-book .bd-bar, .ui-book .bd-chip { transition: none; } }
/* Narrow screens keep the bar to its first line. */
@container gu (width < 720px) { .ui-book .bd-keys { display: none; } }
`;

/** What the bar says the held item does, by the kind of stroke. */
const WHAT: Record<string, string> = {
  none: 'Pick a tool or a piece. Click a placed thing to pick it up.',
  till: 'Drag over grass to till a field.',
  plant: 'Drag over tilled soil to plant. One seed a cell.',
  water: 'Drag over soil to water it.',
  block: 'Drag to lay a line of blocks.',
  line: 'Drag to run a line. It joins by itself.',
  one: 'Click to set it down.',
};

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (text) el.textContent = text;
  return el;
}

function keyHint(keys: readonly string[], words: string): HTMLSpanElement {
  const span = document.createElement('span');
  for (const key of keys) span.append(make('kbd', 'bd-key', key));
  span.append(words);
  return span;
}

/** The first verdict that refuses a cell, or null when none does. */
function refusal(plan: BuildPlan): CellVerdict | null {
  for (let i = 0; i < plan.cells.length; i++) {
    const v = plan.cells[i].verdict;
    if (v !== 'ok' && v !== 'short' && v !== 'skip') return v;
  }
  return null;
}

export function install(view: GameView): void {
  // The book gives the root its look, whichever interface view asks first.
  bookOf(view);
  const { game, keys } = view;
  const sys = game.systems as Partial<Systems>;
  addStyle(view.root, 'build', STYLE);

  const bar = make('div', 'bd-bar');
  bar.setAttribute('role', 'status');
  const what = make('span', 'bd-what');
  const turnKeys = keyHint(['Q', 'R'], 'turn');
  const undoKey = keyHint(['Z'], 'undo');
  const keysBox = make('span', 'bd-keys');
  keysBox.append(turnKeys, undoKey, keyHint(['G'], 'done'));
  bar.append(make('span', 'bd-name', 'Build mode'), what, keysBox);
  const chip = make('div', 'bd-chip');
  chip.append(make('kbd', 'bd-key', 'G'), 'Build mode');
  const tip = make('div', 'bd-tip');
  bar.hidden = chip.hidden = tip.hidden = turnKeys.hidden = undoKey.hidden = true;
  view.root.append(bar, chip, tip);

  // What is on screen now. A frame writes to the page only when one of these changes.
  let shownBar = false, shownChip = false, shownWhat = '', shownTurn = false, shownUndo = false;
  let tipX = -1, tipY = -1;
  /** The numbers the line by the pointer was last made from. */
  const told = { kind: '', dragging: false, ok: -1, short: -1, have: -1, refused: null as CellVerdict | null, lift: '' };
  const hideTip = (): void => { if (told.kind !== '') { told.kind = ''; tip.hidden = true; } };

  function tipWords(plan: BuildPlan): { text: string; tone: '' | 'is-short' | 'is-refused' } {
    if (plan.lift) {
      const name = sys.placeables?.defs().find((d) => d.kind === plan.lift?.kind)?.name ?? 'it';
      return { text: `Click to pick up the ${name.toLowerCase()}`, tone: '' };
    }
    const { kind, shape } = plan.tool;
    const refused = refusal(plan);
    if (plan.ok === 0 && plan.short === 0) return { text: refused ? reasonOf(refused, plan.tool) : '', tone: 'is-refused' };
    if (shape === 'one') return { text: plan.short > 0 ? reasonOf('short', plan.tool) : '', tone: 'is-short' };
    if (!plan.dragging) return { text: '', tone: '' };
    const verb = kind === 'till' ? 'Till' : kind === 'plant' ? 'Plant' : kind === 'water' ? 'Water' : 'Place';
    if (plan.short > 0) return { text: `${verb} ${plan.ok + plan.short} · you have ${plan.have}`, tone: 'is-short' };
    return { text: `${verb} ${plan.ok}`, tone: '' };
  }

  view.onFrame(() => {
    const build = sys.build;
    const on = build?.active === true && view.started && !view.paused;
    const plan = on ? build.plan() : null;
    const tool = plan?.tool ?? null;

    if (on !== shownBar) { shownBar = on; bar.hidden = !on; view.canvas.classList.toggle('bd-on', on); }
    // Until build mode was used once, the chip shows while the hand holds something a stroke can use.
    const held = on || !view.started || game.player.busy || game.flags.is(KNOWS_BUILD_FLAG) ? null : sys.inventory?.held() ?? null;
    const def = held ? sys.items?.get(held.id) : undefined;
    const usable = def !== undefined && (def.tool?.kind === 'hoe' || def.tool?.kind === 'can' || def.seed !== undefined || def.block !== undefined || def.placeable !== undefined);
    if (usable !== shownChip) { shownChip = usable; chip.hidden = !usable; }
    if (!on) { hideTip(); return; }

    const key = !tool || tool.kind === 'none' ? 'none' : tool.kind === 'place' ? (tool.shape === 'line' ? 'line' : 'one') : tool.kind;
    if (WHAT[key] !== shownWhat) what.textContent = shownWhat = WHAT[key];
    const turns = key === 'one';
    if (turns !== shownTurn) { shownTurn = turns; turnKeys.hidden = !turns; }
    const undo = build.canUndo;
    if (undo !== shownUndo) { shownUndo = undo; undoKey.hidden = !undo; }

    // The line by the pointer. Its words are made again only when the numbers behind them change.
    if (!plan) { hideTip(); return; }
    const refused = refusal(plan), lift = plan.lift?.id ?? '';
    if (told.kind !== plan.tool.kind || told.dragging !== plan.dragging || told.ok !== plan.ok || told.short !== plan.short || told.have !== plan.have || told.refused !== refused || told.lift !== lift) {
      told.kind = plan.tool.kind; told.dragging = plan.dragging; told.ok = plan.ok; told.short = plan.short; told.have = plan.have; told.refused = refused; told.lift = lift;
      const { text, tone } = tipWords(plan);
      tip.hidden = text === '';
      tip.textContent = text;
      tip.className = tone ? `bd-tip ${tone}` : 'bd-tip';
    }
    if (tip.hidden) return;
    // A locked mouse points from the middle of the screen.
    const centre = keys.mouse === 'lock';
    const x = Math.round(((centre ? 0 : keys.pointer.x) + 1) / 2 * window.innerWidth) + 18;
    const y = Math.round((1 - (centre ? 0 : keys.pointer.y)) / 2 * window.innerHeight) + 22;
    if (x !== tipX || y !== tipY) { tipX = x; tipY = y; tip.style.transform = `translate(${x}px, ${y}px)`; }
  });

}
