// The game's panels, as plain HTML and CSS over the canvas. One function makes them all:
//   const ui = createGameUi(root, game, options)
// It reads the game only through game.systems and game.events. The HUD (bars, quick slots, the quest tracker,
// the minimap, the dialogue box) is a separate feature and is not here.

import type { Game } from '../api.sim.ts';
import { almanacPanel } from './almanac.ui.ts';
import { bagPanel, makePanel } from './bag.ui.ts';
import { focusables, h, lineIcon } from './dom.ui.ts';
import { readSettings } from './logic.ui.ts';
import { endPanel, pausePanel, settingsPanel, titlePanel } from './menus.ui.ts';
import { createOverlay } from './overlay.ui.ts';
import { questsPanel } from './quests.ui.ts';
import { STYLES } from './styles.ui.ts';
import type { GameUi, GameUiOptions, PanelName, PanelView, Settings, UiContext, VolumeChannel } from './types.ui.ts';

export { DEFAULT_KEYS, DEFAULT_SETTINGS } from './logic.ui.ts';
export type { EndStats, GameUi, GameUiOptions, IconRef, KeyHint, NineSlice, PanelName, PanelView, PictureRef, Quality, Settings, VolumeChannel } from './types.ui.ts';

const PANELS: readonly PanelName[] = ['bag', 'make', 'almanac', 'quests', 'title', 'pause', 'settings', 'account', 'end'];
/** Panels opened from the title or the pause menu. Closing one goes back to the menu it came from. */
const NESTED: readonly PanelName[] = ['settings', 'account'];
/** Panels the player opens and closes freely while playing. A click outside closes them, and their keys swap between them. */
const LIGHT: readonly PanelName[] = ['bag', 'make', 'almanac', 'quests'];
const VOLUMES: readonly VolumeChannel[] = ['music', 'ambience', 'effects', 'voice'];
const HOTKEYS: Record<string, PanelName> = { i: 'bag', b: 'bag', j: 'quests', tab: 'almanac' };

export function createGameUi(root: HTMLElement, game: Game, options: GameUiOptions): GameUi {
  const storageKey = options.storageKey ?? 'game-ui.settings';
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {
    // No storage, in a private window for one. The defaults stand.
  }
  const settings: Settings = readSettings(stored);

  const layer = h('div', { class: 'gu-root' }, h('style', null, STYLES));
  const stage = h('div', { class: 'gu-stage', hidden: true });
  const art = options.art ?? {};
  if (art.title) {
    layer.classList.add('gu-art-title');
    layer.style.setProperty('--gu-title-art', `url("${art.title}")`);
  }
  if (art.panel) {
    const { url, slice = 28, width = slice * 2 } = art.panel;
    layer.classList.add('gu-art-panel');
    layer.style.setProperty('--gu-panel-art', `url("${url}")`);
    layer.style.setProperty('--gu-panel-slice', String(slice));
    layer.style.setProperty('--gu-panel-unit', `${width / slice}px`);
  }
  if (art.button) {
    const { url, slice = 6, width = slice } = art.button;
    layer.classList.add('gu-art-button');
    layer.style.setProperty('--gu-button-art', `url("${url}")`);
    layer.style.setProperty('--gu-button-slice', String(slice));
    layer.style.setProperty('--gu-button-width', `${width}px`);
  }

  const apply = (key: keyof Settings): void => {
    if (key === 'quality') options.setQuality(settings.quality);
    else if (key === 'size') {
      layer.style.setProperty('--gu-size', String(settings.size));
      options.setInterfaceSize?.(settings.size);
    } else options.setVolume(key, settings[key]);
  };

  let current: PanelName | null = null;
  let view: PanelView | null = null;
  let panel: HTMLElement | null = null;
  /** The panel Settings or Account was opened from, to go back to. */
  let behind: PanelName | null = null;
  /** The Account panel, once a view has given one. */
  let account: (() => PanelView) | null = null;
  /** What had the focus before the first panel opened. */
  let focusBefore: HTMLElement | null = null;

  const ui: GameUi = {
    open(name, detail) {
      if (!PANELS.includes(name) || (name === 'account' && !account)) return;
      if (current === null) focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (NESTED.includes(name)) behind = current === 'title' || current === 'pause' ? current : null;
      current = name;
      view = build(name, detail);
      const framed = view.framed !== false;
      const close = (): HTMLElement => h('button', { class: 'gu-close', type: 'button', 'aria-label': NESTED.includes(name) && behind ? 'Back' : 'Close', onclick: () => ui.close() }, '×');
      const { screen } = view;
      // A full-screen menu: a rail across the top with the name, the tabs and the close button, and one of key prompts at the bottom.
      panel = screen
        ? h('div', { class: `gu-panel gu-screen ${view.className ?? ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': view.title, tabindex: -1 },
            h('header', { class: 'gu-rail gu-rail-top' },
              h('div', { class: 'gu-rail-name' },
                h('span', { class: 'gu-rail-icon', 'aria-hidden': true }, lineIcon(options.ornament, screen.icon, view.title)),
                h('h2', { class: 'gu-panel-title' }, view.title),
              ),
              view.head ?? h('span'),
              close(),
            ),
            h('div', { class: 'gu-panel-body' }, view.body),
            h('footer', { class: 'gu-rail gu-rail-foot' }, screen.cues),
          )
        : h('div', { class: `gu-panel ${view.className ?? ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': view.title, tabindex: -1 },
            framed ? h('header', { class: 'gu-panel-head' }, h('h2', { class: 'gu-panel-title' }, view.title), view.head ?? null, close()) : null,
            h('div', { class: 'gu-panel-body' }, view.body),
          );
      stage.className = `gu-stage gu-stage-${name}${screen ? ' gu-stage-screen' : ''}`;
      stage.replaceChildren(panel);
      stage.hidden = false;
      view.render();
      (panel.querySelector<HTMLElement>('.gu-primary:not(:disabled), [aria-current="page"], .gu-slot[tabindex="0"]') ?? panel).focus({ preventScroll: true });
      game.player.busy = true;
      if (name === 'almanac') overlay.clearNote();
      ctx.sound('open');
      options.onChange?.(current);
    },
    close() {
      if (current === null) return;
      if (NESTED.includes(current) && behind) return ui.open(behind);
      current = view = panel = null;
      stage.hidden = true;
      stage.replaceChildren();
      // A conversation keeps the player busy after a panel closes.
      game.player.busy = game.systems.talk?.active ?? false;
      if (focusBefore?.isConnected) focusBefore.focus({ preventScroll: true });
      focusBefore = null;
      ctx.sound('close');
      options.onChange?.(null);
    },
    toggle(name) {
      if (current === name) ui.close();
      else ui.open(name);
    },
    isOpen: (name) => (name ? current === name : current !== null),
    settings: () => ({ ...settings }),
    setAccount(panel) {
      account = panel;
    },
    notices: {
      hold: (on) => overlay.hold(on),
      skip: (id) => overlay.skip(id),
    },
    dispose() {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      for (const off of offs) off();
      if (current !== null) game.player.busy = game.systems.talk?.active ?? false;
      current = view = panel = null;
      layer.remove();
    },
  };

  const ctx: UiContext = {
    game,
    options,
    ui,
    settings,
    setSetting(key, value) {
      settings[key] = value;
      try {
        localStorage.setItem(storageKey, JSON.stringify(settings));
      } catch {
        // The value still holds until the page closes.
      }
      apply(key);
    },
    sound: (sound) => game.events.emit('ui.sound', { sound }),
    fresh: new Map(),
    freshComplete: new Set(),
  };

  const build = (name: PanelName, detail: string | undefined): PanelView => {
    switch (name) {
      case 'bag': return bagPanel(ctx, detail);
      case 'make': return makePanel(ctx);
      case 'almanac': return almanacPanel(ctx, detail);
      case 'quests': return questsPanel(ctx);
      case 'title': return titlePanel(ctx);
      case 'pause': return pausePanel(ctx, account !== null);
      case 'settings': return settingsPanel(ctx);
      case 'account': return account ? account() : pausePanel(ctx, false);
      case 'end': return endPanel(ctx);
    }
  };

  const overlay = createOverlay(ctx, () => performance.now());
  layer.append(overlay.node, stage);
  root.append(layer);

  stage.addEventListener('pointerdown', (event) => {
    if (event.target === stage && current && LIGHT.includes(current)) ui.close();
  });

  const redraw = (...names: PanelName[]) => (): void => {
    if (current && names.includes(current)) view?.render();
  };
  const { events } = game;
  const offs: (() => void)[] = [
    events.on('inventory.changed', redraw('bag', 'make')),
    events.on('quest.started', redraw('quests')),
    events.on('quest.step', redraw('quests')),
    events.on('quest.completed', redraw('quests')),
    events.on('fact.learned', ({ page, fact }) => {
      let facts = ctx.fresh.get(page);
      if (!facts) ctx.fresh.set(page, (facts = new Set()));
      facts.add(fact);
      if (current === 'almanac') view?.render();
      else overlay.note(page);
    }),
    events.on('page.completed', ({ page }) => {
      ctx.freshComplete.add(page);
      if (current === 'almanac') view?.render();
    }),
    events.on('hint', ({ id, text }) => overlay.hint(id, text)),
    events.on('toast', ({ text, icon }) => overlay.toast(text, icon)),
    events.on('ui.open', ({ panel: name, detail }) => {
      if (LIGHT.includes(name as PanelName) && (current === null || LIGHT.includes(current))) ui.open(name as PanelName, detail);
    }),
    events.on('act.ended', () => ui.open('end')),
  ];

  const hotkeys = options.hotkeys !== false;
  const onKey = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (current !== null && view?.onKey?.(event)) {
      event.preventDefault();
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'escape') {
      if (current === null) {
        if (!hotkeys || game.systems.talk?.active) return;
        ui.open('pause');
      } else if (current !== 'title') ui.close();
      event.preventDefault();
      return;
    }
    // Tab moves the focus inside every panel but the Almanac, where it is the key that opened the book.
    if (key === 'tab' && current !== null && current !== 'almanac' && panel) {
      const stops = focusables(panel);
      const at = stops.indexOf(document.activeElement as HTMLElement);
      const edge = event.shiftKey ? at <= 0 : at === stops.length - 1;
      if (edge || at < 0) {
        event.preventDefault();
        stops[event.shiftKey ? stops.length - 1 : 0]?.focus();
      }
      return;
    }
    // Up and down walk a menu's buttons.
    const menu = (key === 'arrowdown' || key === 'arrowup') && document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>('.gu-menu') : null;
    if (menu) {
      const stops = focusables(menu);
      const next = stops[stops.indexOf(document.activeElement as HTMLElement) + (key === 'arrowdown' ? 1 : -1)];
      next?.focus();
      event.preventDefault();
      return;
    }
    const wanted = HOTKEYS[key];
    if (!wanted || !hotkeys || event.repeat) return;
    if (current === null ? game.systems.talk?.active : !LIGHT.includes(current)) return;
    event.preventDefault();
    ui.toggle(wanted);
  };
  window.addEventListener('keydown', onKey);

  let frame = requestAnimationFrame(function tick(time) {
    overlay.update(time, current !== null);
    frame = requestAnimationFrame(tick);
  });

  apply('quality');
  apply('size');
  for (const channel of VOLUMES) apply(channel);

  return ui;
}
