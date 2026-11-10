// Dragging a stack from one slot to another, with a mouse, a pen or a finger. The bag uses it, and so do the
// HUD's quick slots (src/game/views/ui-hud.view.ts). A slot is any element with `data-slot-drop="<index>"`, in
// any area, so a stack can go from one area to another.
//
// A press that moves less than a few pixels is a click and is left alone, so click-to-move still works. Past
// that a ghost of the stack follows the pointer and the slot under it lights up. The left button drags the
// whole stack; the right button, or Shift with the left, drags half of it. Esc or a lost pointer puts it back.

import type { Stack } from '../api.sim.ts';
import { half } from './logic.ui.ts';

/** Pixels the pointer must move before a press becomes a drag. */
const SLOP = 6;

export interface SlotDragOptions {
  /** The element whose slots can be picked up. */
  area: HTMLElement;
  /** The element the ghost is drawn in, asked for when a drag begins. It should cover the screen. */
  layer(): HTMLElement;
  /** What is in a slot now. */
  stackAt(index: number): Stack | null;
  /** The picture inside the ghost. */
  picture(stack: Stack): HTMLElement;
  /** Moves `count` of the stack, or all of it when `count` is undefined. */
  drop(from: number, to: number, count: number | undefined): void;
  /** Called as a drag begins and after it ends, dropped or not. */
  onStart?(): void;
  onEnd?(): void;
}

export interface SlotDrag {
  /** True while a stack is being dragged. */
  readonly active: boolean;
  /** Puts the stack back where it was. */
  cancel(): void;
  dispose(): void;
}

const slotOf = (element: Element | null): HTMLElement | null => element?.closest<HTMLElement>('[data-slot-drop]') ?? null;
const indexOf = (element: HTMLElement): number => Number(element.dataset.slotDrop);

/** True when `count` of the stack in `from` can go into `to`: a part only onto an empty slot or the same item. */
export function canDrop(from: Stack, to: Stack | null, count: number | undefined): boolean {
  if (count === undefined || count >= from.count) return true;
  return to === null || to.id === from.id;
}

export function createSlotDrag(options: SlotDragOptions): SlotDrag {
  const { area } = options;
  const stop = new AbortController();
  const signal = stop.signal;

  interface Press { pointerId: number; from: number; source: HTMLElement; x: number; y: number; split: boolean; touch: boolean }
  let press: Press | null = null;
  let dragging = false;
  let ghost: HTMLElement | null = null;
  let over: HTMLElement | null = null;
  let count: number | undefined;
  /** Where the layer's corner is on the screen, read once when a drag begins. */
  let originX = 0, originY = 0;
  /** True from a drop until the click that follows it, so the click is not also a pick. */
  let swallowClick = false;

  const light = (target: HTMLElement | null): void => {
    if (target === over) return;
    over?.classList.remove('is-drop', 'is-refused');
    over = target;
    if (!over || !press) return;
    const to = indexOf(over);
    if (to === press.from) return;
    const stack = options.stackAt(press.from);
    over.classList.add(stack && canDrop(stack, options.stackAt(to), count) ? 'is-drop' : 'is-refused');
  };

  /** Esc while dragging puts the stack back, and closes nothing else. It listens only while a drag is on. */
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    end(null);
  };

  const place = (x: number, y: number): void => {
    if (!ghost || !press) return;
    // The pointer holds the ghost near its top left corner, so the lit slot under the pointer still shows around it.
    // Under a finger the ghost rides above it, so the finger does not hide what it carries.
    const dx = press.touch ? -26 : -12, dy = press.touch ? -76 : -12;
    ghost.style.transform = `translate3d(${Math.round(x - originX + dx)}px, ${Math.round(y - originY + dy)}px, 0) rotate(-4deg)`;
  };

  const begin = (event: PointerEvent): void => {
    if (!press) return;
    const stack = options.stackAt(press.from);
    if (!stack) { press = null; return; }
    dragging = true;
    count = press.split && stack.count > 1 ? half(stack.count) : undefined;
    const layer = options.layer();
    const box = layer.getBoundingClientRect();
    originX = box.left;
    originY = box.top;
    ghost = document.createElement('div');
    ghost.className = 'gu-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.append(options.picture(stack));
    const shown = count ?? stack.count;
    if (shown > 1) {
      const tag = document.createElement('span');
      tag.className = 'gu-ghost-count gu-num';
      tag.textContent = String(shown);
      ghost.append(tag);
    }
    layer.append(ghost);
    press.source.classList.add(count === undefined ? 'is-drag-from' : 'is-split-from');
    document.documentElement.classList.add('gu-dragging');
    window.addEventListener('keydown', onKey, { capture: true });
    options.onStart?.();
    place(event.clientX, event.clientY);
  };

  const end = (dropAt: HTMLElement | null): void => {
    const was = press;
    press = null;
    if (!dragging || !was) return;
    dragging = false;
    light(null);
    ghost?.remove();
    ghost = null;
    was.source.classList.remove('is-drag-from', 'is-split-from');
    document.documentElement.classList.remove('gu-dragging');
    window.removeEventListener('keydown', onKey, { capture: true });
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    if (dropAt) {
      const to = indexOf(dropAt);
      const from = options.stackAt(was.from);
      if (from && to !== was.from && canDrop(from, options.stackAt(to), count)) options.drop(was.from, to, count);
    }
    options.onEnd?.();
  };

  area.addEventListener('pointerdown', (event) => {
    if (press || (event.button !== 0 && event.button !== 2)) return;
    const source = slotOf(event.target as Element);
    if (!source || !area.contains(source)) return;
    const from = indexOf(source);
    if (!options.stackAt(from)) return;
    press = { pointerId: event.pointerId, from, source, x: event.clientX, y: event.clientY, split: event.button === 2 || event.shiftKey, touch: event.pointerType === 'touch' };
    // The moves keep coming to this slot even when the pointer leaves it.
    source.setPointerCapture?.(event.pointerId);
  }, { signal });

  area.addEventListener('pointermove', (event) => {
    if (!press || event.pointerId !== press.pointerId) return;
    if (!dragging) {
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < SLOP) return;
      begin(event);
      if (!dragging) return;
    }
    place(event.clientX, event.clientY);
    // The ghost takes no pointer, so the element under the pointer is the slot or the space between.
    light(slotOf(document.elementFromPoint(event.clientX, event.clientY)));
  }, { signal });

  area.addEventListener('pointerup', (event) => {
    if (!press || event.pointerId !== press.pointerId) return;
    end(dragging ? slotOf(document.elementFromPoint(event.clientX, event.clientY)) : null);
  }, { signal });
  area.addEventListener('pointercancel', () => end(null), { signal });
  // The slot was drawn again under the drag, or the browser took the pointer: the stack goes back.
  area.addEventListener('lostpointercapture', () => { if (dragging) end(null); }, { signal });
  // The right button drags, so it opens no menu over the slots.
  area.addEventListener('contextmenu', (event) => { if (slotOf(event.target as Element)) event.preventDefault(); }, { signal });
  // The click that ends a drag is not a click on the slot.
  area.addEventListener('click', (event) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, signal });

  return {
    get active() { return dragging; },
    cancel: () => end(null),
    dispose() {
      end(null);
      stop.abort();
    },
  };
}
