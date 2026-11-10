// Every key, mouse button and wheel the game reads comes through here. The rest of the shell sees only
// `Keys`: what is held right now, and a `Press` for each thing that happens once. The base's input
// feature will replace this file, so nothing else listens to the keyboard or the mouse.
//
// With mouse look on (the free and first-person cameras) it works as Genshin does on a PC: a click in the
// world hides the cursor and from then on the mouse turns the view. That first click does nothing else, so
// the click that takes the mouse never breaks a block. Alt or Esc gives the cursor back, and so does anything
// that holds the player (a panel, the map, a conversation, the title). The next click in the world takes it again.

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
  /** The left or the right mouse button went down on the world. */
  | { kind: 'use'; button: 'primary' | 'secondary' }
  /** V: the next camera mode. */
  | { kind: 'camera' }
  | { kind: 'perf' };

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
  /**
   * Mouse look, for the free and first-person cameras: the mouse turns the view once a click has taken it, and
   * the wheel zooms smoothly instead of in steps.
   */
  setLook(on: boolean): void;
  readonly looking: boolean;
  /** True while the cursor is hidden and the mouse turns the view. */
  readonly locked: boolean;
  /** With `true` the cursor is given back and no click takes it. Call it every frame with what holds the player. */
  freeCursor(free: boolean): void;
  /** Pixels the mouse moved since the last call, right and down, written into `out`. */
  takeLook(out: { x: number; y: number }): void;
  dispose(): void;
}

const NAMES: Record<string, string> = {
  w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', e: 'KeyE', q: 'KeyQ', r: 'KeyR',
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
  let primary = false;
  let look = false, cursorFree = false, lockFailed = false, lookX = 0, lookY = 0;
  const isLocked = (): boolean => document.pointerLockElement === canvas;
  /** True when a click in the world may take the mouse. */
  const mayLock = (): boolean => look && !cursorFree && !lockFailed;

  const send = (press: Press): void => {
    for (const listener of [...listeners]) listener(press);
  };

  /** The press a key stands for, or null when the key is only ever held. */
  function pressOf(code: string): Press | null {
    if (code === 'KeyE') return { kind: 'interact' };
    if (code === 'KeyQ') return { kind: 'turn', direction: -1 };
    if (code === 'KeyR') return { kind: 'turn', direction: 1 };
    if (code === 'KeyV') return { kind: 'camera' };
    if (code === 'F3') return { kind: 'perf' };
    const digit = /^Digit([1-9])$/.exec(code);
    return digit ? { kind: 'slot', index: Number(digit[1]) - 1 } : null;
  }

  function movePointer(e: PointerEvent): void {
    const box = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - box.left) / (box.width || 1)) * 2 - 1;
    pointer.y = -(((e.clientY - box.top) / (box.height || 1)) * 2 - 1);
    pointer.over = true;
  }

  window.addEventListener('keydown', (e) => {
    // Alt gives the cursor back, as in Genshin.
    if ((e.code === 'AltLeft' || e.code === 'AltRight') && look) {
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
    if ((e.code === 'AltLeft' || e.code === 'AltRight') && look) e.preventDefault();
  }, on);
  window.addEventListener('blur', () => { held.clear(); primary = false; }, on);

  canvas.addEventListener('pointermove', movePointer, on);
  canvas.addEventListener('pointerleave', () => { pointer.over = false; primary = false; }, on);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault(), on);
  canvas.addEventListener('pointerdown', (e) => {
    movePointer(e);
    if (mayLock() && !isLocked()) {
      // This click takes the mouse and does nothing else.
      const asked = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      asked?.catch?.(() => { lockFailed = true; });
      return;
    }
    if (e.button === 0) {
      primary = true;
      send({ kind: 'use', button: 'primary' });
    } else if (e.button === 2) {
      send({ kind: 'use', button: 'secondary' });
    }
  }, on);
  window.addEventListener('pointerup', (e) => { if (e.button === 0) primary = false; }, on);
  document.addEventListener('pointerlockerror', () => { lockFailed = true; }, on);
  document.addEventListener('pointerlockchange', () => { if (!isLocked()) primary = false; }, on);
  document.addEventListener('pointermove', (e) => {
    // Without the lock (a browser that refuses it) the mouse turns the view while it is over the world.
    if (!look || cursorFree || !(isLocked() || (lockFailed && e.target === canvas))) return;
    lookX += e.movementX;
    lookY += e.movementY;
  }, on);

  // A mouse wheel sends one big step and a trackpad many small ones. Either way one gesture is one step.
  let wheel = 0, lastStep = 0;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    // With Shift down some browsers report the wheel sideways.
    if (look && !e.shiftKey) {
      // The free camera zooms smoothly: a notch of a mouse wheel is one step, a trackpad's swipe a few.
      send({ kind: 'zoom', steps: Math.max(-3, Math.min(3, (e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY) / 100)) });
      return;
    }
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
      primary = false;
    },

    setLook(on) {
      look = on;
      lookX = lookY = 0;
      if (!on && isLocked()) document.exitPointerLock();
    },
    get looking() { return look; },
    get locked() { return isLocked(); },
    freeCursor(free) {
      cursorFree = free;
      if (free && isLocked()) document.exitPointerLock();
    },
    takeLook(out) {
      out.x = lookX;
      out.y = lookY;
      lookX = lookY = 0;
    },

    dispose() {
      stop.abort();
      listeners.clear();
    },
  };
}
