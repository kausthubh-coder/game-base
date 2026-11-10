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
