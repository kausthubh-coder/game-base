// The one place that listens to keys, the mouse, touch and a gamepad. It fills in the raw input and
// lets the rules in intents.sim.ts turn it into intents once a frame. Read `intents` after `update`.
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import {
  DEFAULT_BINDINGS, PinchSteps, TOUCH_CODE, WheelSteps, cloneBindings, emptyIntents, emptyRaw, loadBindings, mapIntents, maskIntents,
  rebind, saveBindings,
  type Action, type Bindings, type InputMode, type Intents,
} from './intents.sim.ts';
import { createTouchControls, type TouchControls } from './touch.ui.ts';

/** Where bindings are kept. `localStorage` fits. */
export interface InputStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface InputOptions {
  /** Mouse buttons, the wheel and a pinch are read on this element. The game canvas by default. */
  element?: HTMLElement;
  /** Where the touch controls go. The page body by default. */
  parent?: HTMLElement;
  /** 'auto' shows the touch controls on a touch screen, and on any screen after the first touch. */
  touch?: 'auto' | 'on' | 'off';
  /** Where rebound keys are saved. `localStorage` by default. Pass null to keep them for this visit only. */
  storage?: InputStorage | null;
  storageKey?: string;
}

export interface InputView extends ViewSystem {
  /** What the player wants this frame. The same object every frame: read it after `update`. */
  readonly intents: Intents;
  readonly bindings: Readonly<Bindings>;
  readonly mode: InputMode;
  /** Say who owns the keys: 'play', 'talk' while a dialogue box is open, 'menu' while a full-screen panel is. Cheap to call every frame. */
  setMode(mode: InputMode): void;
  /** Binds a code to an action and saves. The code is taken from any other action. */
  rebind(action: Action, code: string, slot?: number): void;
  resetBindings(): void;
  /** Waits for the next key, mouse button or gamepad button and gives its code, or null on Escape. For a rebinding panel. */
  capture(): Promise<string | null>;
  /** Presses an action once, as if its key was tapped. For an on-screen button. */
  press(action: Action): void;
  /** True while the touch controls are in use. */
  readonly touch: boolean;
  setTouch(show: boolean): void;
}

const PAD_CODES = Array.from({ length: 17 }, (_, i) => `Pad${i}`);
const MOUSE_CODES = Array.from({ length: 5 }, (_, i) => `Mouse${i}`);

/** True when the keys are going into a text box. A checkbox or a slider takes no letters, so game keys still work on it. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.tagName === 'INPUT') return !['checkbox', 'radio', 'button', 'range'].includes((el as HTMLInputElement).type);
  return el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

function defaultStorage(): InputStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createInput(ctx: ViewContext, options: InputOptions = {}): InputView {
  const element = options.element ?? ctx.renderer.domElement;
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const storageKey = options.storageKey ?? 'game-base.bindings';
  const stop = new AbortController();
  const signal = stop.signal;

  const raw = emptyRaw();
  const intents = emptyIntents();
  let bindings = cloneBindings(DEFAULT_BINDINGS);
  try {
    bindings = loadBindings(storage?.getItem(storageKey));
  } catch {
    // Storage can be blocked. The defaults still work.
  }
  // Every bound code, so a bound key does not also scroll the page.
  const bound = new Set<string>();
  const indexBindings = (): void => {
    bound.clear();
    for (const codes of Object.values(bindings)) for (const code of codes) bound.add(code);
  };
  indexBindings();
  const persist = (): void => {
    indexBindings();
    try {
      storage?.setItem(storageKey, saveBindings(bindings));
    } catch {
      // Storage full or blocked. The new keys still work until the page closes.
    }
  };

  let mode: InputMode = 'play';
  let capturing: ((code: string | null) => void) | null = null;
  const finishCapture = (code: string | null): void => {
    const done = capturing;
    capturing = null;
    done?.(code);
  };

  // Keys.
  window.addEventListener('keydown', (e) => {
    if (capturing) {
      e.preventDefault();
      e.stopPropagation();
      finishCapture(e.code === 'Escape' ? null : e.code);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    if (mode === 'play' && bound.has(e.code) && (e.target as HTMLElement | null)?.tagName !== 'BUTTON') e.preventDefault();
    if (e.repeat) return;
    raw.held.add(e.code);
    raw.pressed.add(e.code);
  }, { signal, capture: true });
  window.addEventListener('keyup', (e) => raw.held.delete(e.code), { signal });
  const dropAll = (): void => {
    raw.held.clear();
    raw.stickX = raw.stickY = 0;
  };
  window.addEventListener('blur', dropAll, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) dropAll(); }, { signal });

  // The mouse. Mouse events, not pointer events, because a second button pressed while the first
  // is held sends no pointerdown.
  element.addEventListener('mousedown', (e) => {
    const code = MOUSE_CODES[e.button];
    if (!code || capturing) return;
    raw.held.add(code);
    raw.pressed.add(code);
  }, { signal });
  window.addEventListener('mousedown', (e) => {
    if (!capturing || !MOUSE_CODES[e.button]) return;
    e.preventDefault();
    e.stopPropagation();
    finishCapture(MOUSE_CODES[e.button]);
  }, { signal, capture: true });
  window.addEventListener('mouseup', (e) => { const code = MOUSE_CODES[e.button]; if (code) raw.held.delete(code); }, { signal });
  element.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });

  const wheel = new WheelSteps();
  element.addEventListener('wheel', (e) => {
    e.preventDefault();
    raw.zoom += wheel.add(e.deltaY, e.timeStamp);
  }, { passive: false, signal });

  // Touch on the game itself: two fingers pinch to zoom. A finger there never counts as a mouse click.
  let touch: TouchControls | null = null;
  let touchOn = false;
  const wantTouch = options.touch ?? 'auto';
  const showTouch = (show: boolean): void => {
    touchOn = show;
    if (show && !touch) touch = createTouchControls(options.parent ?? document.body, raw);
    touch?.setVisible(show && mode === 'play');
  };
  const pinch = new PinchSteps();
  const fingerIds = [-1, -1], fingerX = [0, 0], fingerY = [0, 0];
  const spread = (): number => Math.hypot(fingerX[0] - fingerX[1], fingerY[0] - fingerY[1]);
  element.style.touchAction = 'none';
  element.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    const slot = fingerIds[0] === -1 ? 0 : fingerIds[1] === -1 ? 1 : -1;
    if (slot === -1) return;
    fingerIds[slot] = e.pointerId; fingerX[slot] = e.clientX; fingerY[slot] = e.clientY;
    if (fingerIds[0] !== -1 && fingerIds[1] !== -1) pinch.start(spread());
  }, { signal });
  element.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') return;
    const slot = e.pointerId === fingerIds[0] ? 0 : e.pointerId === fingerIds[1] ? 1 : -1;
    if (slot === -1) return;
    fingerX[slot] = e.clientX; fingerY[slot] = e.clientY;
    if (fingerIds[0] !== -1 && fingerIds[1] !== -1) raw.zoom += pinch.move(spread());
  }, { signal });
  const liftFinger = (e: PointerEvent): void => {
    if (e.pointerId === fingerIds[0]) fingerIds[0] = -1;
    else if (e.pointerId === fingerIds[1]) fingerIds[1] = -1;
  };
  element.addEventListener('pointerup', liftFinger, { signal });
  element.addEventListener('pointercancel', liftFinger, { signal });
  if (wantTouch === 'on' || (wantTouch === 'auto' && globalThis.matchMedia?.('(pointer: coarse)').matches)) showTouch(true);
  if (wantTouch === 'auto') {
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !touchOn) showTouch(true); }, { signal, capture: true });
  }

  // The gamepad is asked every frame, and only while one is plugged in.
  let pads = 0;
  const padDown = new Uint8Array(PAD_CODES.length);
  const dropPad = (): void => {
    for (let i = 0; i < PAD_CODES.length; i++) { padDown[i] = 0; raw.held.delete(PAD_CODES[i]); }
    raw.padX = raw.padY = 0;
  };
  window.addEventListener('gamepadconnected', () => { pads++; }, { signal });
  window.addEventListener('gamepaddisconnected', () => { pads = Math.max(0, pads - 1); dropPad(); }, { signal });
  const readPad = (): void => {
    const list = navigator.getGamepads?.();
    if (!list) return;
    for (let p = 0; p < list.length; p++) {
      const pad = list[p];
      if (!pad || !pad.connected) continue;
      const count = Math.min(PAD_CODES.length, pad.buttons.length);
      for (let i = 0; i < count; i++) {
        const down = pad.buttons[i].pressed || pad.buttons[i].value > 0.5;
        if (down && !padDown[i]) {
          if (capturing) finishCapture(PAD_CODES[i]);
          else raw.pressed.add(PAD_CODES[i]);
        }
        if (down) raw.held.add(PAD_CODES[i]);
        else raw.held.delete(PAD_CODES[i]);
        padDown[i] = down ? 1 : 0;
      }
      raw.padX = pad.axes[0] ?? 0;
      raw.padY = -(pad.axes[1] ?? 0);
      return;
    }
  };

  return {
    intents,
    get bindings() { return bindings; },
    get mode() { return mode; },
    setMode(next) {
      if (next === mode) return;
      mode = next;
      // A press that opened or closed a panel must not also act in the game on the next frame.
      raw.pressed.clear();
      raw.zoom = 0;
      touch?.setVisible(touchOn && mode === 'play');
    },
    rebind(action, code, slot) {
      bindings = rebind(bindings, action, code, slot);
      persist();
    },
    resetBindings() {
      bindings = cloneBindings(DEFAULT_BINDINGS);
      persist();
    },
    capture() {
      finishCapture(null);
      return new Promise((resolve) => { capturing = resolve; });
    },
    press(action) {
      raw.pressed.add(TOUCH_CODE[action]);
    },
    get touch() { return touchOn; },
    setTouch: showTouch,

    update() {
      if (pads > 0) readPad();
      maskIntents(mapIntents(raw, bindings, intents), mode);
      raw.pressed.clear();
      raw.zoom = 0;
    },

    dispose() {
      stop.abort();
      finishCapture(null);
      touch?.dispose();
    },
  };
}
