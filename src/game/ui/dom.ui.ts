// Small helpers for building elements by hand.

import { initials } from './logic.ui.ts';
import type { IconRef, PictureRef } from './types.ui.ts';

type Attr = string | number | boolean | null | undefined | ((event: never) => void);
type Child = Node | string | null | undefined | false;

/** Makes an element. `on…` attributes are listeners, true and false toggle an attribute, the rest are set as text. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, Attr> | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [name, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (typeof value === 'function') node.addEventListener(name.slice(2), value as EventListener);
      else if (value === true) node.setAttribute(name, '');
      else node.setAttribute(name, String(value));
    }
  }
  add(node, ...children);
  return node;
}

/** Appends children, skipping null, undefined and false. */
export function add(node: Element, ...children: Child[]): void {
  for (const child of children) if (child !== null && child !== undefined && child !== false) node.append(child);
}

/** A square picture `box` pixels wide: a cell of a sheet scaled to fit, or two letters on a plain square. */
export function picture(ref: IconRef | PictureRef | null, name: string, box: number): HTMLElement {
  const frame = h('span', { class: 'gu-pic', 'aria-hidden': true });
  frame.style.width = frame.style.height = `${box}px`;
  if (!ref) {
    frame.classList.add('gu-pic-plain');
    frame.style.fontSize = `${Math.max(13, Math.round(box * 0.36))}px`;
    frame.textContent = initials(name);
    return frame;
  }
  const width = 'size' in ref ? ref.size : ref.width;
  const height = 'size' in ref ? ref.size : ref.height;
  const scale = box / Math.max(width, height);
  if (scale < 1) frame.classList.add('gu-pic-small');
  const cell = h('span', { class: 'gu-pic-cell' });
  cell.style.width = `${width}px`;
  cell.style.height = `${height}px`;
  cell.style.backgroundImage = `url("${ref.url}")`;
  cell.style.backgroundPosition = `-${ref.x}px -${ref.y}px`;
  cell.style.transform = `translate(${(box - width * scale) / 2}px, ${(box - height * scale) / 2}px) scale(${scale})`;
  frame.append(cell);
  return frame;
}

/** A row of keycaps, such as I or B. */
export function keycaps(keys: readonly string[], joiner = 'or'): HTMLElement {
  const row = h('span', { class: 'gu-keys' });
  keys.forEach((key, i) => {
    if (i > 0 && joiner) row.append(h('span', { class: 'gu-keys-join' }, joiner));
    row.append(h('kbd', null, key));
  });
  return row;
}

/** One key prompt in a menu's bottom rail: the keys, then a short verb. `only` keeps it to a mouse or to a finger. */
export interface Cue {
  keys: readonly string[];
  verb: string;
  only?: 'fine' | 'coarse';
}

/** Puts a row of key prompts in `row`, replacing what was there: `Esc Close`, `Drag Move`. A cue with no keys is a status, in gold. */
export function fillCues(row: HTMLElement, list: readonly Cue[]): void {
  row.replaceChildren(...list.map((cue) =>
    h('span', { class: `gu-cue${cue.only ? ` gu-cue-${cue.only}` : ''}${cue.keys.length ? '' : ' gu-cue-status'}` },
      ...cue.keys.map((key) => h('kbd', null, key)),
      h('span', { class: 'gu-cue-verb' }, cue.verb),
    ),
  ));
}

// Gold line icons drawn in code, for when the kit's icon sheet does not have the name yet. Strokes on a 24 grid.
const GLYPHS: Record<string, string> = {
  things: '<path d="M9 4.5h6l-1.2 3h-3.6z"/><path d="M8.2 7.5h7.6c1.6 2 3.7 5 3.7 8.3 0 2.6-1.8 4.2-4.6 4.2H9.1c-2.8 0-4.6-1.6-4.6-4.2 0-3.3 2.1-6.3 3.7-8.3z"/><path d="M9.5 13h5"/>',
  'by-hand': '<path d="M4.5 19.5l8.5-8.5"/><path d="M11.5 6.5l3-3 6 6-3 3z"/><path d="M13 8l3 3"/>',
  creatures: '<path d="M12 12.5c-3 0-5.5 3.2-5.5 5.4 0 1.4 1.2 2.1 2.4 2.1 1.3 0 1.9-.7 3.1-.7s1.8.7 3.1.7c1.2 0 2.4-.7 2.4-2.1 0-2.2-2.5-5.4-5.5-5.4z"/><ellipse cx="6" cy="10" rx="1.6" ry="2"/><ellipse cx="9.6" cy="6.4" rx="1.6" ry="2.1"/><ellipse cx="14.4" cy="6.4" rx="1.6" ry="2.1"/><ellipse cx="18" cy="10" rx="1.6" ry="2"/>',
  pets: '<path d="M12 19.5s-7-4.3-7-9.6a3.9 3.9 0 0 1 7-2.4 3.9 3.9 0 0 1 7 2.4c0 5.3-7 9.6-7 9.6z"/>',
  crops: '<path d="M12 20.5V9"/><path d="M12 14c-3.8 0-6-2.2-6-6 3.8 0 6 2.2 6 6z"/><path d="M12 11c0-3.8 2.2-6 6-6 0 3.8-2.2 6-6 6z"/>',
  people: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5"/>',
  places: '<path d="M12 20.5s-6-5.6-6-10.5a6 6 0 0 1 12 0c0 4.9-6 10.5-6 10.5z"/><circle cx="12" cy="10" r="2.2"/>',
};

/**
 * A gold line icon by name that fills its box: from the kit's sheets when they have it, else drawn here, else the
 * name's first letter in a gold ring.
 */
export function lineIcon(ornament: ((name: string) => HTMLElement | null) | undefined, name: string, label: string): HTMLElement {
  const art = ornament?.(name);
  if (art) return art;
  const glyph = GLYPHS[name];
  if (glyph) {
    const span = h('span', { class: 'gu-glyph' });
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>`;
    return span;
  }
  return h('span', { class: 'gu-glyph gu-glyph-letter' }, label.slice(0, 1).toUpperCase());
}

/** A round tab with a line icon in a full-screen menu's top rail. Its name shows under it while it is picked or pointed at. */
export function iconTab(
  ornament: ((name: string) => HTMLElement | null) | undefined, icon: string, label: string, selected: boolean, attrs: Record<string, Attr>,
): HTMLButtonElement {
  return h('button', { class: 'gu-tab', type: 'button', role: 'tab', 'aria-selected': String(selected), 'aria-label': label, ...attrs },
    h('span', { class: 'gu-tab-icon', 'aria-hidden': true }, lineIcon(ornament, icon, label)),
    h('span', { class: 'gu-tab-name', 'aria-hidden': true }, label),
  );
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The elements Tab stops at, in order. Of a set of radio buttons only the picked one is a stop. */
export function focusables(inside: HTMLElement): HTMLElement[] {
  return [...inside.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (node) => node.offsetParent !== null && !(node instanceof HTMLInputElement && node.type === 'radio' && !node.checked),
  );
}

/** Rebuilds a panel's body and puts the focus back on the element with the same `data-key`. */
export function keepFocus(inside: HTMLElement, rebuild: () => void): void {
  const active = document.activeElement instanceof HTMLElement && inside.contains(document.activeElement) ? document.activeElement : null;
  const key = active?.dataset.key;
  rebuild();
  if (key) inside.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
}
