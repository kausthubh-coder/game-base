// Input as rules: raw keys, buttons and sticks go in, intents come out. An intent is what the player
// wants ("walk this way", "jump", "open the map"), whatever device said it. Nothing here touches the
// page, so a test or a server can feed it. The page side is input.view.ts.

/** Everything a key or button can be bound to. The order is the order a settings panel lists them in. */
export const ACTIONS = [
  'moveForward', 'moveBack', 'moveLeft', 'moveRight',
  'jump', 'interact', 'use', 'place',
  'turnLeft', 'turnRight', 'zoomIn', 'zoomOut', 'map',
  'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9',
  'slotPrev', 'slotNext',
] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * The codes bound to each action. A code is `KeyboardEvent.code` for a key ('KeyW', 'Space'),
 * 'Mouse0' to 'Mouse4' for a mouse button and 'Pad0' to 'Pad16' for a gamepad button in the
 * standard layout.
 */
export type Bindings = Record<Action, string[]>;

export const DEFAULT_BINDINGS: Readonly<Bindings> = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBack: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  jump: ['Space', 'Pad0'],
  // E turns the camera, as in the camera feature, so talking is F.
  interact: ['KeyF', 'Pad2'],
  use: ['Mouse0', 'Pad7'],
  place: ['Mouse2', 'Pad6'],
  turnLeft: ['KeyQ', 'Pad4'],
  turnRight: ['KeyE', 'Pad5'],
  zoomIn: ['Equal', 'Pad12'],
  zoomOut: ['Minus', 'Pad13'],
  map: ['KeyM', 'Pad8'],
  slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'], slot5: ['Digit5'],
  slot6: ['Digit6'], slot7: ['Digit7'], slot8: ['Digit8'], slot9: ['Digit9'],
  slotPrev: ['Pad14'],
  slotNext: ['Pad15'],
};

/** The code a touch button sends for an action. It needs no binding: a touch button always does its own action. */
export const TOUCH_CODE = Object.fromEntries(ACTIONS.map((a) => [a, `Touch:${a}`])) as Readonly<Record<Action, string>>;

const SLOT_ACTIONS: readonly Action[] = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9'];

/** What the devices say this frame. The page side fills it in and clears `pressed` and `zoom` after each frame. */
export interface RawInput {
  /** Codes held down now. */
  held: Set<string>;
  /** Codes that went down since the last frame, even if they are up again already. */
  pressed: Set<string>;
  /** The touch stick: x is to the right and y is away from the player's thumb base, upward. -1 to 1. */
  stickX: number;
  stickY: number;
  /** The gamepad's left stick, with y already flipped so up is positive. -1 to 1. */
  padX: number;
  padY: number;
  /** Whole zoom steps from the wheel and from a pinch since the last frame. Positive zooms out. */
  zoom: number;
}

export function emptyRaw(): RawInput {
  return { held: new Set(), pressed: new Set(), stickX: 0, stickY: 0, padX: 0, padY: 0, zoom: 0 };
}

/** What the player wants this frame. The same object is filled in again every frame. */
export interface Intents {
  /** The move direction relative to the camera: `right` is toward the right of the screen, `forward` is away from the camera. Never longer than 1. */
  right: number;
  forward: number;
  /** Held. */
  jump: boolean;
  /** True on the frame the jump button went down. */
  jumpPressed: boolean;
  /** True on the frame the talk and pick-up button went down. */
  interact: boolean;
  /** Held: swing the tool, break a block. */
  use: boolean;
  usePressed: boolean;
  /** Held: put down what the selected slot holds. */
  place: boolean;
  placePressed: boolean;
  /** A quarter turn of the camera: 1 to the right, -1 to the left, 0 for none. */
  turn: -1 | 0 | 1;
  /** Zoom steps. Positive zooms out. */
  zoom: number;
  /** True on the frame the map button went down. */
  map: boolean;
  /** The quick slot picked this frame, 0 to 8, or -1. */
  slot: number;
  /** Step to the next quick slot (1) or the one before (-1). A gamepad has no number keys. */
  slotStep: -1 | 0 | 1;
}

export function emptyIntents(): Intents {
  return {
    right: 0, forward: 0, jump: false, jumpPressed: false, interact: false, use: false, usePressed: false,
    place: false, placePressed: false, turn: 0, zoom: 0, map: false, slot: -1, slotStep: 0,
  };
}

/** Sticks rest a little off center. Below this they count as zero. */
export const STICK_DEAD_ZONE = 0.18;

function isHeld(raw: RawInput, bindings: Bindings, action: Action): boolean {
  if (raw.held.has(TOUCH_CODE[action])) return true;
  const codes = bindings[action];
  for (let i = 0; i < codes.length; i++) if (raw.held.has(codes[i])) return true;
  return false;
}

function wasPressed(raw: RawInput, bindings: Bindings, action: Action): boolean {
  if (raw.pressed.has(TOUCH_CODE[action])) return true;
  const codes = bindings[action];
  for (let i = 0; i < codes.length; i++) if (raw.pressed.has(codes[i])) return true;
  return false;
}

/** How far a stick is pushed once the dead zone is taken out, 0 to 1. The first bit past the dead zone starts at 0, so there is no jump. */
export function stickAmount(x: number, y: number, deadZone = STICK_DEAD_ZONE): number {
  const length = Math.hypot(x, y);
  if (length <= deadZone) return 0;
  return Math.min(1, (length - deadZone) / (1 - deadZone));
}

/** Turns raw input into intents. It writes into `out` and returns it, so a frame allocates nothing. */
export function mapIntents(raw: RawInput, bindings: Bindings, out: Intents): Intents {
  // Keys give a direction of length 1, so a diagonal is no faster than a straight line.
  let right = (isHeld(raw, bindings, 'moveRight') ? 1 : 0) - (isHeld(raw, bindings, 'moveLeft') ? 1 : 0);
  let forward = (isHeld(raw, bindings, 'moveForward') ? 1 : 0) - (isHeld(raw, bindings, 'moveBack') ? 1 : 0);
  if (right !== 0 && forward !== 0) { right *= Math.SQRT1_2; forward *= Math.SQRT1_2; }

  // A stick gives a direction and a strength: half a push is a slow walk.
  const stick = stickAmount(raw.stickX, raw.stickY);
  if (stick > 0) {
    const length = Math.hypot(raw.stickX, raw.stickY);
    right += (raw.stickX / length) * stick;
    forward += (raw.stickY / length) * stick;
  }
  const pad = stickAmount(raw.padX, raw.padY);
  if (pad > 0) {
    const length = Math.hypot(raw.padX, raw.padY);
    right += (raw.padX / length) * pad;
    forward += (raw.padY / length) * pad;
  }
  const length = Math.hypot(right, forward);
  if (length > 1) { right /= length; forward /= length; }
  out.right = right;
  out.forward = forward;

  out.jump = isHeld(raw, bindings, 'jump');
  out.jumpPressed = wasPressed(raw, bindings, 'jump');
  out.interact = wasPressed(raw, bindings, 'interact');
  out.use = isHeld(raw, bindings, 'use');
  out.usePressed = wasPressed(raw, bindings, 'use');
  out.place = isHeld(raw, bindings, 'place');
  out.placePressed = wasPressed(raw, bindings, 'place');
  out.turn = ((wasPressed(raw, bindings, 'turnRight') ? 1 : 0) - (wasPressed(raw, bindings, 'turnLeft') ? 1 : 0)) as -1 | 0 | 1;
  out.zoom = raw.zoom + (wasPressed(raw, bindings, 'zoomOut') ? 1 : 0) - (wasPressed(raw, bindings, 'zoomIn') ? 1 : 0);
  out.map = wasPressed(raw, bindings, 'map');
  out.slot = -1;
  for (let i = 0; i < SLOT_ACTIONS.length; i++) if (wasPressed(raw, bindings, SLOT_ACTIONS[i])) { out.slot = i; break; }
  out.slotStep = ((wasPressed(raw, bindings, 'slotNext') ? 1 : 0) - (wasPressed(raw, bindings, 'slotPrev') ? 1 : 0)) as -1 | 0 | 1;
  return out;
}

/**
 * Who the keys belong to. In 'play' every intent passes. In 'talk' a dialogue box owns the keys and
 * nothing passes. In 'menu' a full-screen panel is open and only `map` passes, so the same key closes it.
 */
export type InputMode = 'play' | 'talk' | 'menu';

/** Clears the intents the mode does not let through. */
export function maskIntents(intents: Intents, mode: InputMode): Intents {
  if (mode === 'play') return intents;
  const map = mode === 'menu' && intents.map;
  intents.right = 0; intents.forward = 0;
  intents.jump = false; intents.jumpPressed = false; intents.interact = false;
  intents.use = false; intents.usePressed = false; intents.place = false; intents.placePressed = false;
  intents.turn = 0; intents.zoom = 0; intents.slot = -1; intents.slotStep = 0;
  intents.map = map;
  return intents;
}

/**
 * Turns a move relative to the camera into a move in the world. `yaw` is the camera's yaw as the
 * camera feature gives it: 0 looks north (-z) and it grows counter-clockwise seen from above.
 */
export function moveToWorld(right: number, forward: number, yaw: number, out: { x: number; z: number }): { x: number; z: number } {
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  out.x = right * cos - forward * sin;
  out.z = -right * sin - forward * cos;
  return out;
}

/** Where a thumb is on the touch stick, from its offset in pixels from the stick's middle. Down the screen is toward the player, so y flips. */
export function stickFromOffset(dx: number, dy: number, radius: number, out: { x: number; y: number }): { x: number; y: number } {
  let x = dx / radius, y = -dy / radius;
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  out.x = x;
  out.y = y;
  return out;
}

/**
 * Wheel movement to whole zoom steps. A mouse wheel sends one big step and a trackpad many small
 * ones. Either way one gesture is one step, as in the camera feature.
 */
export class WheelSteps {
  private sum = 0;
  private last = -Infinity;

  /** Add one wheel event. Returns 1 to zoom out, -1 to zoom in, or 0. */
  add(deltaY: number, timeMs: number): number {
    this.sum += deltaY;
    if (Math.abs(this.sum) < 40 || timeMs - this.last < 220) return 0;
    const step = Math.sign(this.sum);
    this.sum = 0;
    this.last = timeMs;
    return step;
  }
}

/** Two fingers to whole zoom steps. Spreading the fingers by a quarter zooms in one step, and closing them zooms out. */
export class PinchSteps {
  private from = 0;
  readonly ratio: number;

  constructor(ratio = 1.25) {
    this.ratio = ratio;
  }

  start(distance: number): void {
    this.from = distance;
  }

  /** The fingers are now this far apart. Returns zoom steps: negative zooms in. */
  move(distance: number): number {
    if (this.from <= 0 || distance <= 0) return 0;
    let steps = 0;
    while (distance >= this.from * this.ratio) { this.from *= this.ratio; steps--; }
    while (distance <= this.from / this.ratio) { this.from /= this.ratio; steps++; }
    return steps;
  }
}

/**
 * Binds a code to an action and returns the new bindings. A code does one thing: it is taken away
 * from any other action that had it. `slot` picks which of the action's codes to replace, so the
 * first can be a key and the second a gamepad button.
 */
export function rebind(bindings: Bindings, action: Action, code: string, slot = 0): Bindings {
  const next = cloneBindings(bindings);
  for (const other of ACTIONS) next[other] = next[other].filter((c) => c !== code);
  const codes = next[action];
  if (slot < codes.length) codes[slot] = code;
  else codes.push(code);
  return next;
}

/** Takes a code away from an action. */
export function unbind(bindings: Bindings, action: Action, code: string): Bindings {
  const next = cloneBindings(bindings);
  next[action] = next[action].filter((c) => c !== code);
  return next;
}

export function cloneBindings(bindings: Readonly<Bindings>): Bindings {
  const next = {} as Bindings;
  for (const action of ACTIONS) next[action] = [...bindings[action]];
  return next;
}

/** The bindings as text, to save. */
export function saveBindings(bindings: Bindings): string {
  return JSON.stringify({ v: 1, keys: bindings });
}

/**
 * Reads saved bindings. An action the save does not name keeps its default, so a new action added
 * to the game later still has a key. Text that is not a save gives the defaults.
 */
export function loadBindings(text: string | null | undefined): Bindings {
  const next = cloneBindings(DEFAULT_BINDINGS);
  if (!text) return next;
  try {
    const save = JSON.parse(text) as { v?: number; keys?: Record<string, unknown> };
    if (save?.v !== 1 || typeof save.keys !== 'object' || save.keys === null) return next;
    for (const action of ACTIONS) {
      const codes = save.keys[action];
      if (Array.isArray(codes)) next[action] = codes.filter((c): c is string => typeof c === 'string');
    }
  } catch {
    // Not a save. Keep the defaults.
  }
  return next;
}

const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L stick', 'R stick', 'Up', 'Down', 'Left', 'Right', 'Home'];
const MOUSE_NAMES = ['Left click', 'Middle click', 'Right click', 'Mouse 4', 'Mouse 5'];
const KEY_NAMES: Record<string, string> = {
  Space: 'Space', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab', Backspace: 'Backspace',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Equal: '=', Minus: '-', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Backquote: '`',
  ShiftLeft: 'Shift', ShiftRight: 'Right Shift', ControlLeft: 'Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Alt', AltRight: 'Right Alt',
};

/** A short name for a code, to show on a key cap: 'KeyW' is 'W', 'Mouse0' is 'Left click', 'Pad0' is 'Pad A'. */
export function codeLabel(code: string): string {
  if (code in KEY_NAMES) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  if (code.startsWith('Mouse')) return MOUSE_NAMES[Number(code.slice(5))] ?? code;
  if (code.startsWith('Pad')) return `Pad ${PAD_NAMES[Number(code.slice(3))] ?? code.slice(3)}`;
  return code;
}

const ACTION_NAMES: Record<Action, string> = {
  moveForward: 'Walk forward', moveBack: 'Walk back', moveLeft: 'Walk left', moveRight: 'Walk right',
  jump: 'Jump', interact: 'Talk and pick up', use: 'Use', place: 'Place',
  turnLeft: 'Turn the camera left', turnRight: 'Turn the camera right', zoomIn: 'Zoom in', zoomOut: 'Zoom out', map: 'Map',
  slot1: 'Slot 1', slot2: 'Slot 2', slot3: 'Slot 3', slot4: 'Slot 4', slot5: 'Slot 5', slot6: 'Slot 6', slot7: 'Slot 7', slot8: 'Slot 8', slot9: 'Slot 9',
  slotPrev: 'Slot before', slotNext: 'Next slot',
};

/** A name for an action, for a settings panel. */
export function actionLabel(action: Action): string {
  return ACTION_NAMES[action];
}
