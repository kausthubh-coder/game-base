// The small paper panels of the settlement, in the Gilded Hearth look (docs/ui-look.md): a settler's card, the
// dinner table's asks and the Heartstone's next step. Cream paper in a gold frame with the title over a gold
// rule of three diamonds, need rows as pills, navy job cards with a gold rim when picked, pill buttons, a round
// close button. The approved mockups are assets-src/concept/interface/people, dinner and heartstone.
//
// One panel is open at a time. While it is, the hero is busy, so the cursor is free and E does nothing; Esc
// closes it before the pause menu sees the key (the views that use this install before ui-panels).
import type { GameView } from '../shell/view.ts';
import type { Book } from './book.ts';
import { addStyle } from './theme.ts';

const STYLE = /* css */ `
.ui-book .hp-layer { position: absolute; inset: 0; z-index: 38; display: grid; place-items: center; padding: 16px 16px var(--ui-bottom-clear); pointer-events: none; }
.ui-book .hp-layer[hidden] { display: none; }
.ui-book .hp-panel {
  position: relative; width: min(460px, 100%); max-height: calc(100% - 24px); overflow: auto; padding: 22px 26px 20px; pointer-events: auto;
  color: var(--ui-ink); font-family: var(--ui-font); font-weight: 600; font-size: calc(15px * var(--ui-size));
  animation: hp-grow 160ms var(--ui-ease);
}
.ui-book .hp-panel.hp-wide { width: min(720px, 100%); }
@keyframes hp-grow { from { transform: translateY(6px) scale(0.97); } to { transform: none; } }
.ui-book .hp-close {
  position: absolute; top: 14px; right: 14px; width: 36px; height: 36px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%;
  background: var(--ui-paper-light); color: var(--ui-ink); box-shadow: inset 0 0 0 2px var(--ui-gold), 0 1px 3px var(--ui-shadow); cursor: pointer; font: 700 18px/1 var(--ui-font);
}
.ui-book .hp-close:hover { box-shadow: inset 0 0 0 2px var(--ui-gold-bright), 0 0 10px rgb(240 212 138 / 0.6); }
.ui-book .hp-title { margin: 0; text-align: center; font: 700 calc(30px * var(--ui-size))/1.15 var(--ui-display); color: var(--ui-ink); }
.ui-book .hp-sub { margin: 6px 0 0; text-align: center; color: var(--ui-ink-2); }
.ui-book .hp-rule { display: flex; align-items: center; gap: 6px; margin: 10px auto 14px; width: 70%; }
.ui-book .hp-rule::before, .ui-book .hp-rule::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--ui-gold)); }
.ui-book .hp-rule::after { background: linear-gradient(90deg, var(--ui-gold), transparent); }
.ui-book .hp-dia { width: 7px; height: 7px; transform: rotate(45deg); border: 1.5px solid var(--ui-bronze); background: var(--ui-paper-light); }
.ui-book .hp-dia.is-on { background: var(--ui-gold-bright); border-color: var(--ui-bronze); }
.ui-book .hp-rows { display: grid; gap: 8px; }
.ui-book .hp-row { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 6px 8px 6px 16px; border-radius: 22px; background: var(--ui-paper-2); }
.ui-book .hp-row-label { flex: 1; font-weight: 800; }
.ui-book .hp-row-label small { font-weight: 600; color: var(--ui-ink-2); }
.ui-book .hp-row-icon { flex: none; width: 22px; height: 22px; display: grid; place-items: center; color: var(--ui-ink-2); }
.ui-book .hp-pill { flex: none; display: inline-flex; align-items: center; gap: 6px; min-width: 104px; justify-content: center; padding: 6px 14px; border-radius: 16px; font-weight: 800; font-size: 0.93em; }
.ui-book .hp-pill.is-met { background: #dfe8cf; color: #4c7a38; }
.ui-book .hp-pill.is-missing { background: var(--ui-navy, #4a5366); color: var(--ui-paper-light); }
.ui-book .hp-row.is-done { background: #dfe8cf; }
.ui-book .hp-check { flex: none; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: #5e8a4a; color: #fff; font-size: 13px; }
.ui-book .hp-count { flex: none; font-variant-numeric: tabular-nums; font-weight: 800; padding-right: 10px; }
.ui-book .hp-sep { height: 1px; margin: 14px 4px; background: linear-gradient(90deg, transparent, var(--ui-gold) 20%, var(--ui-gold) 80%, transparent); position: relative; }
.ui-book .hp-sep::after { content: ''; position: absolute; left: 50%; top: -3.5px; width: 6px; height: 6px; transform: translateX(-50%) rotate(45deg); background: var(--ui-paper); border: 1.5px solid var(--ui-gold); }
.ui-book .hp-line { display: flex; gap: 12px; align-items: baseline; padding: 0 8px; }
.ui-book .hp-line-key { flex: none; color: var(--ui-bronze); font-weight: 800; }
.ui-book .hp-heading { display: flex; align-items: center; gap: 12px; margin: 4px 0 10px; font: 700 1.05em var(--ui-display); }
.ui-book .hp-heading::before, .ui-book .hp-heading::after { content: ''; flex: 1; height: 1px; background: var(--ui-gold); }
.ui-book .hp-jobs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ui-book .hp-job {
  position: relative; display: grid; gap: 4px; justify-items: center; align-content: start; min-height: 112px; padding: 14px 12px 12px; border: 0; border-radius: 22px;
  background: var(--ui-night-2); color: var(--ui-paper-light); text-align: center; cursor: pointer; font: inherit;
  box-shadow: inset 0 0 0 1.5px rgb(211 188 142 / 0.35), 0 2px 6px var(--ui-shadow); transition: transform 120ms var(--ui-ease), box-shadow 120ms var(--ui-ease);
}
.ui-book .hp-job:hover { transform: translateY(-2px); box-shadow: inset 0 0 0 1.5px var(--ui-gold), 0 6px 14px var(--ui-shadow); }
.ui-book .hp-job.is-picked { box-shadow: inset 0 0 0 3px var(--ui-gold-bright), 0 0 16px rgb(240 212 138 / 0.45); }
.ui-book .hp-job.is-held::after { content: 'At work'; position: absolute; top: 10px; left: 12px; font-size: 0.72em; color: var(--ui-gold-bright); letter-spacing: 0.04em; }
.ui-book .hp-job .hp-dia { position: absolute; top: 12px; right: 14px; background: transparent; border-color: var(--ui-paper-light); }
.ui-book .hp-job.is-picked .hp-dia { background: var(--ui-gold-bright); border-color: var(--ui-gold-bright); }
.ui-book .hp-job-name { font: 700 1.12em/1.2 var(--ui-display); }
.ui-book .hp-job-text { font-size: 0.88em; color: var(--ui-glass-ink-2); line-height: 1.3; }
.ui-book .hp-job-room { font-size: 0.78em; color: var(--ui-gold); }
.ui-book .hp-job[aria-disabled='true'] { opacity: 0.62; }
.ui-book .hp-actions { display: flex; justify-content: center; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
.ui-book .hp-btn {
  min-height: 44px; min-width: 120px; padding: 0 26px; border: 0; border-radius: 22px; cursor: pointer; font: 800 1em var(--ui-font);
  color: var(--ui-paper-light); background: #4a5366; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12), 0 2px 6px var(--ui-shadow);
}
.ui-book .hp-btn.hp-primary { min-width: 260px; color: var(--ui-night); background: linear-gradient(180deg, #f6dfa0, #e2c07a 55%, #cfa863); box-shadow: inset 0 0 0 1px rgb(255 247 220 / 0.7), 0 0 0 1px var(--ui-bronze), 0 2px 10px rgb(201 162 94 / 0.45); }
.ui-book .hp-btn:hover { filter: brightness(1.08); }
.ui-book .hp-btn:active { transform: scale(0.97); }
.ui-book .hp-btn:disabled { color: var(--ui-ink-2); background: var(--ui-paper-3); box-shadow: inset 0 0 0 1px var(--ui-line-strong); cursor: default; transform: none; filter: none; }
.ui-book .hp-foot { margin: 10px 0 0; text-align: center; font-style: italic; color: var(--ui-ink-2); font-size: 0.9em; }
.ui-book .hp-foot.is-warn { color: var(--ui-bronze); }
.ui-book .hp-portrait { width: 84px; height: 84px; flex: none; border-radius: 50%; overflow: hidden; background: var(--ui-paper-3); box-shadow: 0 0 0 3px var(--ui-gold), 0 0 0 5px var(--ui-paper-light), 0 3px 8px var(--ui-shadow); }
.ui-book .hp-portrait > * { image-rendering: auto; }
.ui-book .hp-head { display: flex; align-items: center; gap: 18px; padding-right: 36px; margin-bottom: 14px; }
.ui-book .hp-head .hp-title { text-align: left; }
.ui-book .hp-head .hp-rule { margin: 6px 0 0; width: 100%; justify-content: flex-start; }
.ui-book .hp-head .hp-rule::before { display: none; }
@media (prefers-reduced-motion: reduce) { .ui-book .hp-panel { animation: none; } .ui-book .hp-job { transition: none; } }
@media (max-width: 560px) {
  .ui-book .hp-panel { padding: 18px 16px 16px; }
  .ui-book .hp-jobs { grid-template-columns: 1fr; }
  .ui-book .hp-btn.hp-primary { min-width: 0; width: 100%; }
}
`;

export interface HomePanel {
  /** The paper the panel's own content goes in. Emptied on each open. */
  readonly body: HTMLElement;
  readonly isOpen: boolean;
  /**
   * Opens with `fill` building the content. `wide` for a wider paper; `dinner` for the dinner table's asks, which sit
   * low on night glass in the dialogue's own look, so the table and the people at it stay in view.
   */
  open(fill: (body: HTMLElement) => void, shape?: boolean | 'dinner'): void;
  close(): void;
}

const panels = new WeakMap<GameView, HomePanel>();

/** The one settlement panel of this view. The first call makes it. */
export function homePanel(view: GameView, book: Book): HomePanel {
  let panel = panels.get(view);
  if (!panel) panels.set(view, (panel = makePanel(view, book)));
  return panel;
}

function makePanel(view: GameView, book: Book): HomePanel {
  const { root, game } = view;
  addStyle(root, 'home-panel', STYLE);
  const layer = document.createElement('div');
  layer.className = 'hp-layer';
  layer.hidden = true;
  const paper = document.createElement('section');
  paper.className = 'hp-panel ui-frame';
  paper.setAttribute('role', 'dialog');
  paper.dataset.key = 'home:panel';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'hp-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';
  const body = document.createElement('div');
  paper.append(body, close);
  layer.append(paper);
  root.append(layer);

  let open = false;
  const shut = (): void => {
    if (!open) return;
    open = false;
    layer.hidden = true;
    body.replaceChildren();
    book.settle();
  };
  close.addEventListener('click', shut);

  // Before the panels view's own Esc, which would open the pause menu.
  window.addEventListener('keydown', (event) => {
    if (!open || event.code !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    shut();
  }, { capture: true });

  view.onFrame(() => {
    if (!open) return;
    // A conversation, a menu or the map takes the screen: the panel steps aside.
    if (book.panel !== null || (book.map?.isOpen ?? false) || (book.sys.talk?.active ?? false)) { shut(); return; }
    game.player.busy = true;
  });

  return {
    body,
    get isOpen() { return open; },
    open(fill, shape = false) {
      body.replaceChildren();
      paper.classList.toggle('hp-wide', shape === true);
      paper.classList.toggle('hp-dinner', shape === 'dinner');
      paper.classList.toggle('ui-frame', shape !== 'dinner');
      layer.classList.toggle('is-dinner', shape === 'dinner');
      fill(body);
      layer.hidden = false;
      open = true;
      game.player.busy = true;
      close.focus({ preventScroll: true });
    },
    close: shut,
  };
}

// ------------------------------------------------------------------------------------------ small pieces

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The gold rule under a title: a line, `on` lit diamonds of `of`, a line. */
export function rule(on = 0, of = 3): HTMLElement {
  const line = el('div', 'hp-rule');
  for (let i = 0; i < of; i++) line.append(el('span', `hp-dia${i < on ? ' is-on' : ''}`));
  return line;
}

export function button(text: string, primary: boolean, onClick: () => void): HTMLButtonElement {
  const b = el('button', `hp-btn${primary ? ' hp-primary' : ''}`, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}
