// The HUD: the frame around the game, in plain HTML and CSS over the canvas. Health, stamina and
// mana at the top left. A place for the minimap, the clock and the weather at the top right. Nine
// quick slots at the bottom, the tracked quest at the right, short messages at the bottom left.
//
// The page is touched only when a value changes, so a frame where nothing changed costs a few
// comparisons.
import './hud.css';
import type { Bus, GameEvent } from '../../engine/events.ts';
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import { WEATHER_NAMES, barFraction, clampScale, clockMinutes, clockText, weatherIcon, type WeatherIcon } from './hud.sim.ts';

/** Where the size setting is kept. `localStorage` fits. */
export interface HudStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface HudOptions {
  /** Where the HUD goes. The page body by default. */
  parent?: HTMLElement;
  /** The size setting, 0.8 to 1.4. The saved one wins when there is one. */
  scale?: number;
  /** Where the size setting is saved. `localStorage` by default. Pass null to keep it for this visit only. */
  storage?: HudStorage | null;
  storageKey?: string;
  /** Called when a quick slot is clicked or tapped, after it is selected. */
  onSlot?: (index: number) => void;
  /** Slot clicks go here as `ui` events, for the click sound. */
  bus?: Bus<GameEvent>;
}

export type Vital = 'health' | 'stamina' | 'mana';

export interface HudSlot {
  /** A picture for the slot: a canvas, an image or an SVG. The HUD sizes it. */
  icon?: HTMLElement | null;
  /** What the slot holds, for a screen reader and the hover title. */
  label?: string;
  /** How many. 0 and 1 show no number. */
  count?: number;
}

export interface HudQuest {
  title: string;
  steps: readonly { text: string; done?: boolean }[];
}

export interface HudView extends ViewSystem {
  readonly element: HTMLElement;
  /** An empty box at the top right. Put the minimap in it: `hud.minimapSlot.append(map.minimap)`. */
  readonly minimapSlot: HTMLElement;
  setVital(vital: Vital, value: number, max: number): void;
  /** Fills a quick slot, 0 to 8, or empties it with null. */
  setSlot(index: number, slot: HudSlot | null): void;
  selectSlot(index: number): void;
  readonly selected: number;
  /** The one tracked quest, or null to hide the panel. */
  setQuest(quest: HudQuest | null): void;
  /** A short message at the bottom left. It leaves by itself after `seconds`, 6 by default. */
  message(text: string, options?: { from?: string; seconds?: number }): void;
  /** The size setting. 1 is the designed size. */
  readonly scale: number;
  setScale(scale: number): void;
  /** Tell the HUD the touch controls are showing, so messages move up out of their way. */
  setTouch(on: boolean): void;
  setVisible(visible: boolean): void;
}

const SLOTS = 9;
const MESSAGES = 4;
/** The touch controls take about this many pixels in each bottom corner. */
const TOUCH_CORNER = 176;

const line = (d: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const solid = (d: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;

const WEATHER_ART: Record<WeatherIcon, string> = {
  sun: line('M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 2v2.5M12 19.5v2.5M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8'),
  moon: line('M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z'),
  cloud: line('M7 18.5a4.2 4.2 0 0 1-.6-8.360A6 6 0 0 1 18 11.7a3.4 3.4 0 0 1-.5 6.8z'),
  rain: line('M7 14.5a4.2 4.2 0 0 1-.6-8.360A6 6 0 0 1 18 7.7a3.4 3.4 0 0 1-.5 6.8zM8 17.5l-1 3M12.5 17.5l-1 3M17 17.5l-1 3'),
  storm: line('M7 14.5a4.2 4.2 0 0 1-.6-8.360A6 6 0 0 1 18 7.7a3.4 3.4 0 0 1-.5 6.8zM12.5 13l-3 4.5h4l-2.5 4'),
  fog: line('M4 8c2-1.5 4-1.5 6 0s4 1.5 6 0 3-1.2 4-.6M4 12.5c2-1.5 4-1.5 6 0s4 1.5 6 0 3-1.2 4-.6M4 17c2-1.5 4-1.5 6 0s4 1.5 6 0 3-1.2 4-.6'),
  wind: line('M3 9h10.5a2.5 2.5 0 1 0-2.5-2.5M3 13.5h15.5a2.5 2.5 0 1 1-2.5 2.5M3 18h7'),
};

const VITALS: readonly { id: Vital; name: string; art: string }[] = [
  { id: 'health', name: 'Health', art: solid('M12 21C5.5 15.5 2.5 12.3 2.5 8.4a5.1 5.1 0 0 1 9.5-2.6 5.1 5.1 0 0 1 9.5 2.6c0 3.9-3 7.1-9.5 12.6z') },
  { id: 'stamina', name: 'Stamina', art: solid('M13.5 2 5 13.5h5.5L9.5 22 19 10h-6z') },
  { id: 'mana', name: 'Mana', art: solid('M12 2.5c3.5 4.5 6.5 8 6.5 11.5a6.5 6.5 0 0 1-13 0c0-3.5 3-7 6.5-11.5z') },
];

function defaultStorage(): HudStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createHud(_ctx: ViewContext, options: HudOptions = {}): HudView {
  const parent = options.parent ?? document.body;
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const storageKey = options.storageKey ?? 'game-base.hud.scale';
  const stop = new AbortController();
  const signal = stop.signal;

  const root = document.createElement('div');
  root.className = 'gb-hud';
  root.innerHTML = `
    <section class="gb-hud-vitals gb-panel" aria-label="Health, stamina and mana">
      ${VITALS.map((v) => `
        <div class="gb-bar gb-bar-${v.id}" role="meter" aria-label="${v.name}" aria-valuemin="0">
          <span class="gb-bar-icon">${v.art}</span>
          <span class="gb-bar-track"><span class="gb-bar-fill"></span></span>
          <span class="gb-bar-text"></span>
        </div>`).join('')}
    </section>
    <div class="gb-hud-right">
      <div class="gb-hud-minimap"></div>
      <section class="gb-hud-sky gb-panel" aria-label="Weather and time">
        <span class="gb-hud-weather" role="img"></span>
        <span class="gb-hud-clock"></span>
      </section>
      <section class="gb-hud-quest gb-panel" aria-label="Tracked quest" hidden>
        <h3></h3>
        <ul></ul>
      </section>
    </div>
    <ol class="gb-hud-log" aria-live="polite" aria-label="Messages"></ol>
    <nav class="gb-hud-slots gb-panel" aria-label="Quick slots">
      ${Array.from({ length: SLOTS }, (_, i) => `<button type="button" class="gb-slot" data-slot="${i}" aria-pressed="false" aria-label="Slot ${i + 1}, empty"><span class="gb-slot-key">${i + 1}</span><span class="gb-slot-icon"></span><span class="gb-slot-count"></span></button>`).join('')}
    </nav>`;
  parent.append(root);

  const minimapSlot = root.querySelector<HTMLElement>('.gb-hud-minimap')!;
  const weather = root.querySelector<HTMLElement>('.gb-hud-weather')!;
  const clock = root.querySelector<HTMLElement>('.gb-hud-clock')!;
  const quest = root.querySelector<HTMLElement>('.gb-hud-quest')!;
  const log = root.querySelector<HTMLElement>('.gb-hud-log')!;
  const slotBar = root.querySelector<HTMLElement>('.gb-hud-slots')!;
  const slots = [...slotBar.querySelectorAll<HTMLButtonElement>('.gb-slot')];
  const bars = new Map(VITALS.map((v) => {
    const bar = root.querySelector<HTMLElement>(`.gb-bar-${v.id}`)!;
    return [v.id, { bar, fill: bar.querySelector<HTMLElement>('.gb-bar-fill')!, text: bar.querySelector<HTMLElement>('.gb-bar-text')!, value: NaN, max: NaN }];
  }));

  let scale = 1;
  const applyScale = (next: number): void => {
    scale = clampScale(next);
    root.style.setProperty('--hud-scale', String(scale));
  };
  let saved = NaN;
  try {
    saved = Number(storage?.getItem(storageKey) ?? NaN);
  } catch {
    // Storage can be blocked. The designed size still works.
  }
  applyScale(Number.isFinite(saved) ? saved : options.scale ?? 1);

  // The touch controls sit in the bottom corners. When the quick slots reach into those corners,
  // as on a phone held upright, the controls move up above the slots. The input feature's
  // stylesheet reads this number.
  const layout = (): void => {
    const bar = slotBar.getBoundingClientRect();
    const lifted = bar.width > root.clientWidth - TOUCH_CORNER * 2;
    document.documentElement.style.setProperty('--gb-hud-bottom', lifted ? `${Math.ceil(root.clientHeight - bar.top)}px` : '0px');
  };
  const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(layout);
  watcher?.observe(root);
  watcher?.observe(slotBar);

  let selected = 0;
  const select = (index: number): void => {
    if (index < 0 || index >= SLOTS) return;
    slots[selected].setAttribute('aria-pressed', 'false');
    selected = index;
    slots[selected].setAttribute('aria-pressed', 'true');
  };
  select(0);
  slotBar.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('.gb-slot');
    if (!button) return;
    select(Number(button.dataset.slot));
    options.bus?.emit({ type: 'ui', sound: 'click' });
    options.onSlot?.(selected);
  }, { signal });
  // A click must not take the keys away from the game: the slot is picked and the focus stays where it was.
  slotBar.addEventListener('pointerdown', (e) => e.preventDefault(), { signal });

  const messages: { element: HTMLElement; left: number }[] = [];
  let minute = -1;
  let sky: WeatherIcon | null = null;

  return {
    element: root,
    minimapSlot,

    setVital(vital, value, max) {
      const bar = bars.get(vital)!;
      if (bar.value === value && bar.max === max) return;
      bar.value = value; bar.max = max;
      bar.fill.style.transform = `scaleX(${barFraction(value, max).toFixed(4)})`;
      const whole = Math.max(0, Math.round(value));
      bar.text.textContent = `${whole}/${Math.round(max)}`;
      bar.bar.setAttribute('aria-valuenow', String(whole));
      bar.bar.setAttribute('aria-valuemax', String(Math.round(max)));
      bar.bar.classList.toggle('is-low', barFraction(value, max) <= 0.25);
    },

    setSlot(index, slot) {
      const button = slots[index];
      if (!button) return;
      const icon = button.querySelector<HTMLElement>('.gb-slot-icon')!;
      const count = button.querySelector<HTMLElement>('.gb-slot-count')!;
      icon.replaceChildren();
      if (slot?.icon) icon.append(slot.icon);
      count.textContent = slot?.count && slot.count > 1 ? String(slot.count) : '';
      const name = slot ? slot.label ?? 'item' : 'empty';
      button.setAttribute('aria-label', `Slot ${index + 1}, ${name}${slot?.count && slot.count > 1 ? `, ${slot.count}` : ''}`);
      button.title = slot?.label ?? '';
      button.classList.toggle('is-empty', !slot);
    },

    selectSlot: select,
    get selected() { return selected; },

    setQuest(next) {
      quest.hidden = !next;
      if (!next) return;
      quest.querySelector('h3')!.textContent = next.title;
      const list = quest.querySelector('ul')!;
      list.replaceChildren(...next.steps.map((step) => {
        const item = document.createElement('li');
        item.textContent = step.text;
        if (step.done) item.className = 'is-done';
        return item;
      }));
    },

    message(text, message = {}) {
      const item = document.createElement('li');
      if (message.from) {
        const from = document.createElement('b');
        from.textContent = message.from;
        item.append(from, ' ');
      }
      item.append(text);
      log.append(item);
      messages.push({ element: item, left: message.seconds ?? 6 });
      while (messages.length > MESSAGES) messages.shift()!.element.remove();
    },

    get scale() { return scale; },
    setScale(next) {
      applyScale(next);
      try {
        storage?.setItem(storageKey, String(scale));
      } catch {
        // Storage full or blocked. The size still holds until the page closes.
      }
    },

    setTouch(on) {
      root.classList.toggle('gb-hud--touch', on);
    },

    setVisible(visible) {
      root.hidden = !visible;
    },

    update(dt, frame) {
      const now = clockMinutes(frame.ambient.timeOfDay);
      if (now !== minute) {
        minute = now;
        clock.textContent = clockText(frame.ambient.timeOfDay);
      }
      const icon = weatherIcon(frame.ambient);
      if (icon !== sky) {
        sky = icon;
        weather.innerHTML = WEATHER_ART[icon];
        weather.setAttribute('aria-label', WEATHER_NAMES[icon]);
        weather.title = WEATHER_NAMES[icon];
      }
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        const before = m.left;
        m.left -= dt;
        if (m.left <= 0) {
          m.element.remove();
          messages.splice(i, 1);
        } else if (m.left <= 0.5 && before > 0.5) {
          m.element.classList.add('is-leaving');
        }
      }
    },

    dispose() {
      stop.abort();
      watcher?.disconnect();
      document.documentElement.style.removeProperty('--gb-hud-bottom');
      root.remove();
    },
  };
}
