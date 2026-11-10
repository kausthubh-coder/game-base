// Every key, mouse button and wheel the game reads comes through here. The rest of the shell sees only
// `Keys`: what is held right now, and a `Press` for each thing that happens once. The base's input
// feature will replace this file, so nothing else listens to the keyboard or the mouse.

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
  dispose(): void;
}

const NAMES: Record<string, string> = {
  w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', e: 'KeyE', q: 'KeyQ', r: 'KeyR',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  shift: 'ShiftLeft', space: 'Space', f3: 'F3',
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

  const send = (press: Press): void => {
    for (const listener of [...listeners]) listener(press);
  };

  /** The press a key stands for, or null when the key is only ever held. */
  function pressOf(code: string): Press | null {
    if (code === 'KeyE') return { kind: 'interact' };
    if (code === 'KeyQ') return { kind: 'turn', direction: -1 };
    if (code === 'KeyR') return { kind: 'turn', direction: 1 };
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
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    // Space and Enter on a focused button belong to the button, not to the hero's legs.
    if ((e.code === 'Space' || e.code === 'Enter') && e.target instanceof HTMLElement && e.target.closest('button, a, [role="button"]')) return;
    if (e.code === 'F3' || e.code === 'Space') e.preventDefault();
    held.add(e.code);
    if (e.repeat) return;
    const press = pressOf(e.code);
    if (press) send(press);
  }, on);
  window.addEventListener('keyup', (e) => held.delete(e.code), on);
  window.addEventListener('blur', () => { held.clear(); primary = false; }, on);

  canvas.addEventListener('pointermove', movePointer, on);
  canvas.addEventListener('pointerleave', () => { pointer.over = false; primary = false; }, on);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault(), on);
  canvas.addEventListener('pointerdown', (e) => {
    movePointer(e);
    if (e.button === 0) {
      primary = true;
      send({ kind: 'use', button: 'primary' });
    } else if (e.button === 2) {
      send({ kind: 'use', button: 'secondary' });
    }
  }, on);
  window.addEventListener('pointerup', (e) => { if (e.button === 0) primary = false; }, on);

  // A mouse wheel sends one big step and a trackpad many small ones. Either way one gesture is one step.
  let wheel = 0, lastStep = 0;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
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
      primary = false;
    },

    dispose() {
      stop.abort();
      listeners.clear();
    },
  };
}
