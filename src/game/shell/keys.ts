// Every key, mouse button and wheel the game reads comes through here. The rest of the shell sees only
// `Keys`: what is held right now, and a `Press` for each thing that happens once. The base's input
// feature will replace this file, so nothing else listens to the keyboard or the mouse.
//
// The mouse works in one of three ways, picked by the camera and the Mouse setting:
//   `point` (the 2.5D camera) and `drag` (the free camera, Drag to turn) work as Roblox does: the cursor stays
//   free and aims, and holding the right button and dragging turns the camera. The cursor hides during the drag.
//   A right click that does not drag (see drag.ts) still uses or places what the hero holds, when it comes up.
//   `point` zooms in steps, `drag` smoothly.
//   `lock` (first person, and the free camera with Lock to turn) works as Genshin does on a PC: a click in the
//   world hides the cursor and from then on the mouse turns the view. That first click does nothing else, so
//   the click that takes the mouse never breaks a block. Alt or Esc gives the cursor back, and the next click in
//   the world takes it again. Anything that holds the player (a panel, the map, a conversation, the title) gives
//   it back too, and takes it again when it lets go, if the cursor was locked when it began and the browser
//   still counts the close as the player's doing (a click or a key, not Esc). Otherwise a click takes it.

import { RightDrag } from './drag.ts';

/** Something that happens once. */
export type Press =
  | { kind: 'interact' }
  /** 1 turns the view a quarter turn to the right, -1 to the left. */
  | { kind: 'turn'; direction: 1 | -1 }
  /** Positive zooms out one step. */
  | { kind: 'zoom'; steps: number }
  /** A quick slot picked by its number key, 0 to 8. */
  | { kind: 'slot'; index: number }
  /** The next or the previous quick slot. */
  | { kind: 'slotStep'; step: 1 | -1 }
  /** The left button went down on the world, or the right button clicked it without dragging. */
  | { kind: 'use'; button: 'primary' | 'secondary' }
  /** V: the next camera mode. */
  | { kind: 'camera' }
  | { kind: 'perf' }
  /** G: build mode on or off. */
  | { kind: 'build' }
  /** Z: take back the last stroke of build mode. */
  | { kind: 'undo' }
  /**
   * The left button is no longer down, once for each `use` with `primary`. `up`: the hand let go of it. `lost`:
   * the window lost it (it lost focus, the pointer left or was cancelled, a panel took the keys), so nobody chose to let go.
   */
  | { kind: 'letGo'; why: 'up' | 'lost' };

/** How the mouse turns the camera. See the top of this file. */
export type MouseMode = 'point' | 'drag' | 'lock';

export interface Keys {
  /** -1 to 1, relative to the camera. */
  readonly right: number;
  readonly forward: number;
  readonly jump: boolean;
  /** Shift: walk softly. */
  readonly soft: boolean;
  /** True while the left button is down on the world. */
  readonly primary: boolean;
  /** Where the pointer is on the canvas, -1 to 1 each way with y up. `over` is false when it is somewhere else. */
  readonly pointer: { readonly x: number; readonly y: number; readonly over: boolean };
  onPress(listener: (press: Press) => void): () => void;
  /**
   * Holds or lets go of a key by name, as if a finger did: `w`, `a`, `s`, `d`, `shift`, `space`, the arrows.
   * For the debug door and for tests.
   */
  hold(name: string, down: boolean): void;
  /** Presses a key once by name: `e`, `q`, `r`, `1` to `9`, `f3`, `space`. False when the name means nothing. */
  tap(name: string): boolean;
  /** Lets go of everything, for when a panel opens or the window loses focus. */
  release(): void;
  /** How the mouse turns the camera. `point` until told otherwise. */
  setMouse(mode: MouseMode): void;
  readonly mouse: MouseMode;
  /** True while the cursor is locked and the mouse turns the view, in `lock`. */
  readonly locked: boolean;
  /** True while a right-button drag turns the camera, in `point` and `drag`. */
  readonly dragging: boolean;
  /** Runs `fn` when a right-button drag ends. Returns a function that stops it. */
  onDragEnd(fn: () => void): () => void;
  /** With `true` the cursor is given back and no click takes it. Call it every frame with what holds the player. */
  freeCursor(free: boolean): void;
  /**
   * With `true` a left-button press keeps the pointer until the button comes up, so a drag that crosses the HUD or
   * leaves the window still ends with `letGo` and `up`. Build mode asks for it. Off, the pointer leaving the canvas lets go.
   */
  capturePrimary(capture: boolean): void;
  /** Pixels the mouse turned the view by since the last call, right and down, written into `out`: a locked mouse's or a drag's. */
  takeLook(out: { x: number; y: number }): void;
  dispose(): void;
}

const NAMES: Record<string, string> = {
  w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', e: 'KeyE', q: 'KeyQ', r: 'KeyR', g: 'KeyG', z: 'KeyZ',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  shift: 'ShiftLeft', space: 'Space', f3: 'F3', v: 'KeyV',
};
const codeOf = (name: string): string => NAMES[name.toLowerCase()] ?? (/^[1-9]$/.test(name) ? `Digit${name}` : name);

/** True when the key belongs to a text box or a control, not to the game. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

export function createKeys(canvas: HTMLElement): Keys {
  const stop = new AbortController();
  const on = { signal: stop.signal };
  const held = new Set<string>();
  const listeners = new Set<(press: Press) => void>();
  const pointer = { x: 0, y: 0, over: false };
  const dragEnds = new Set<() => void>();
  let primary = false, capture = false;
  let mode: MouseMode = 'point', cursorFree = false, lockFailed = false, lookX = 0, lookY = 0;
  /** True while something holds the player that took the lock away, so letting go takes it again. */
  let relock = false, relocking = false;
  const right = new RightDrag();
  const isLocked = (): boolean => document.pointerLockElement === canvas;
  /** True when a click in the world may take the mouse. */
  const mayLock = (): boolean => mode === 'lock' && !cursorFree && !lockFailed;

  const send = (press: Press): void => {
    for (const listener of [...listeners]) listener(press);
  };

  /** The left button is no longer down. It tells the listeners once, however many events say so. */
  function letGo(why: 'up' | 'lost'): void {
    if (!primary) return;
    primary = false;
    send({ kind: 'letGo', why });
  }

  /** The press a key stands for, or null when the key is only ever held. */
  function pressOf(code: string): Press | null {
    if (code === 'KeyE') return { kind: 'interact' };
    if (code === 'KeyQ') return { kind: 'turn', direction: -1 };
    if (code === 'KeyR') return { kind: 'turn', direction: 1 };
    if (code === 'KeyV') return { kind: 'camera' };
    if (code === 'KeyG') return { kind: 'build' };
    if (code === 'KeyZ') return { kind: 'undo' };
    if (code === 'F3') return { kind: 'perf' };
    const digit = /^Digit([1-9])$/.exec(code);
    return digit ? { kind: 'slot', index: Number(digit[1]) - 1 } : null;
  }

  function movePointer(e: PointerEvent): void {
    // While the right button is down the aim stays where it was pressed: a click places on the block it went
    // down on, and a drag turns the camera without sweeping the aim about.
    if (right.down) return;
    const box = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - box.left) / (box.width || 1)) * 2 - 1;
    pointer.y = -(((e.clientY - box.top) / (box.height || 1)) * 2 - 1);
    // A drag let go of outside the canvas leaves the pointer off it.
    pointer.over = Math.abs(pointer.x) <= 1 && Math.abs(pointer.y) <= 1;
  }

  /** Ends a right-button press. A click uses; a drag gives the cursor back where the hand left it. */
  function endRight(e: PointerEvent | null): void {
    const was = right.dragging;
    const end = right.release(e ? e.timeStamp : 0);
    if (was) {
      canvas.style.cursor = '';
      if (e) movePointer(e);
      for (const fn of [...dragEnds]) fn();
    }
    if (end === 'click') send({ kind: 'use', button: 'secondary' });
  }
  /** Forgets a right-button press without using anything. */
  function cancelRight(): void {
    if (!right.down) return;
    const was = right.dragging;
    right.cancel();
    if (!was) return;
    canvas.style.cursor = '';
    for (const fn of [...dragEnds]) fn();
  }

  /** Asks the browser for the lock. A refused relock is no reason to stop asking on a click. */
  function takeLock(again: boolean): void {
    relocking = again;
    const asked = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    asked?.then?.(() => { relocking = false; }, () => { if (!relocking) lockFailed = true; relocking = false; });
  }

  /** A button went down on the world. */
  function buttonDown(e: PointerEvent): void {
    if (e.button === 0) {
      primary = true;
      if (capture) {
        try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer: the window still hears it */ }
      }
      send({ kind: 'use', button: 'primary' });
    } else if (e.button === 2) {
      if (mode === 'lock') { send({ kind: 'use', button: 'secondary' }); return; }
      if (cursorFree) return;
      right.press(e.clientX, e.clientY, e.timeStamp);
      // The drag goes on when the hand leaves the canvas, until the button comes up.
      try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer: the window still hears it */ }
    }
  }

  window.addEventListener('keydown', (e) => {
    // Alt gives the cursor back, as in Genshin.
    if ((e.code === 'AltLeft' || e.code === 'AltRight') && mode === 'lock') {
      e.preventDefault();
      if (isLocked()) document.exitPointerLock();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    // Space and Enter on a focused button belong to the button, not to the hero's legs.
    if ((e.code === 'Space' || e.code === 'Enter') && e.target instanceof HTMLElement && e.target.closest('button, a, [role="button"]')) return;
    if (e.code === 'F3' || e.code === 'Space') e.preventDefault();
    held.add(e.code);
    if (e.repeat) return;
    const press = pressOf(e.code);
    if (press) send(press);
  }, on);
  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
    // Alt let go on its own would put Windows' focus on the browser's menu.
    if ((e.code === 'AltLeft' || e.code === 'AltRight') && mode === 'lock') e.preventDefault();
  }, on);
  window.addEventListener('blur', () => { held.clear(); letGo('lost'); cancelRight(); }, on);

  canvas.addEventListener('pointermove', (e) => {
    // A second button pressed or let go while another is held comes as a move with `button` set.
    if (e.button === 0 || e.button === 2) {
      const bit = e.button === 0 ? 1 : 2;
      if (e.buttons & bit) { if (!(mayLock() && !isLocked())) buttonDown(e); }
      else if (e.button === 0) letGo('up');
      else endRight(e);
    }
    if (right.move(e.clientX, e.clientY)) {
      if (canvas.style.cursor !== 'none') canvas.style.cursor = 'none';
      lookX += right.dx;
      lookY += right.dy;
    }
    movePointer(e);
  }, on);
  canvas.addEventListener('pointerleave', () => { pointer.over = false; letGo('lost'); }, on);
  // A captured pointer that is taken away before the button came up.
  canvas.addEventListener('lostpointercapture', () => letGo('lost'), on);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault(), on);
  canvas.addEventListener('pointerdown', (e) => {
    movePointer(e);
    if (mayLock() && !isLocked()) {
      // This click takes the mouse and does nothing else.
      takeLock(false);
      return;
    }
    buttonDown(e);
  }, on);
  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) letGo('up');
    else if (e.button === 2) endRight(e);
  }, on);
  window.addEventListener('pointercancel', () => { letGo('lost'); cancelRight(); }, on);
  document.addEventListener('pointerlockerror', () => { if (!relocking) lockFailed = true; }, on);
  document.addEventListener('pointerlockchange', () => { if (!isLocked()) letGo('lost'); }, on);
  document.addEventListener('pointermove', (e) => {
    // Without the lock (a browser that refuses it) the mouse turns the view while it is over the world.
    if (mode !== 'lock' || cursorFree || !(isLocked() || (lockFailed && e.target === canvas))) return;
    lookX += e.movementX;
    lookY += e.movementY;
  }, on);

  // A mouse wheel sends one big step and a trackpad many small ones. Either way one gesture is one step.
  let wheel = 0, lastStep = 0;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (mode !== 'point' && !e.shiftKey) {
      // The free camera zooms smoothly: a notch of a mouse wheel is one step, a trackpad's swipe a few.
      send({ kind: 'zoom', steps: Math.max(-3, Math.min(3, (e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY) / 100)) });
      return;
    }
    // With Shift down some browsers report the wheel sideways.
    wheel += e.deltaY || e.deltaX;
    if (Math.abs(wheel) < 40 || e.timeStamp - lastStep < (e.shiftKey ? 90 : 220)) return;
    const step = wheel > 0 ? 1 : -1;
    send(e.shiftKey ? { kind: 'slotStep', step } : { kind: 'zoom', steps: step });
    wheel = 0;
    lastStep = e.timeStamp;
  }, { passive: false, signal: stop.signal });

  const down = (...codes: string[]): boolean => codes.some((code) => held.has(code));

  return {
    get right() { return (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0); },
    get forward() { return (down('KeyW', 'ArrowUp') ? 1 : 0) - (down('KeyS', 'ArrowDown') ? 1 : 0); },
    get jump() { return held.has('Space'); },
    get soft() { return down('ShiftLeft', 'ShiftRight'); },
    get primary() { return primary; },
    pointer,

    onPress(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    hold(name, isDown) {
      const code = codeOf(name);
      if (isDown) held.add(code);
      else held.delete(code);
    },

    tap(name) {
      const press = pressOf(codeOf(name));
      if (press) send(press);
      return press !== null;
    },

    release() {
      held.clear();
      letGo('lost');
      cancelRight();
    },

    setMouse(next) {
      if (next === mode) return;
      mode = next;
      lookX = lookY = 0;
      cancelRight();
      if (next !== 'lock' && isLocked()) document.exitPointerLock();
    },
    get mouse() { return mode; },
    get locked() { return isLocked(); },
    get dragging() { return right.dragging; },
    onDragEnd(fn) {
      dragEnds.add(fn);
      return () => dragEnds.delete(fn);
    },
    freeCursor(free) {
      const wasFree = cursorFree;
      cursorFree = free;
      if (free) cancelRight();
      if (free && isLocked()) {
        relock = true;
        document.exitPointerLock();
      }
      if (free || !wasFree || !relock) return;
      relock = false;
      // The browser grants the lock only soon after a click or a key, and never just after Esc.
      const active = (navigator as { userActivation?: { isActive: boolean } }).userActivation?.isActive ?? true;
      if (mayLock() && !isLocked() && active) takeLock(true);
    },
    capturePrimary(next) { capture = next; },
    takeLook(out) {
      out.x = lookX;
      out.y = lookY;
      lookX = lookY = 0;
    },

    dispose() {
      stop.abort();
      listeners.clear();
      dragEnds.clear();
    },
  };
}
