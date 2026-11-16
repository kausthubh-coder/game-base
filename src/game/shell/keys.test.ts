import { afterEach, expect, test } from 'bun:test';
import { createKeys, touchDevice } from './keys.ts';

const originals = new Map<string, PropertyDescriptor | undefined>();
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  originals.clear();
});

function setup() {
  class Element extends EventTarget {
    style = { cursor: '' };
    tagName = 'CANVAS';
    isContentEditable = false;
    closest() { return null; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
    setPointerCapture() {}
  }
  const window = new EventTarget(), document = Object.assign(new EventTarget(), { pointerLockElement: null });
  for (const [key, value] of Object.entries({ window, document, HTMLElement: Element })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  const canvas = new Element(), keys = createKeys(canvas as unknown as HTMLElement);
  dispose = () => keys.dispose();
  function event(target: EventTarget, name: string, values: Record<string, unknown> = {}) {
    const e = new Event(name, { cancelable: true });
    for (const [key, value] of Object.entries(values)) Object.defineProperty(e, key, { value });
    target.dispatchEvent(e);
  }
  function drag() {
    event(canvas, 'pointerdown', { button: 2, buttons: 2, clientX: 100, clientY: 100, pointerId: 1 });
    event(canvas, 'pointermove', { button: -1, buttons: 2, clientX: 120, clientY: 100 });
    expect(keys.dragging).toBe(true);
    keys.takeLook({ x: 0, y: 0 });
  }
  return { window, canvas, keys, event, drag };
}

test('losing right-button capture stops rotation and restores the cursor', () => {
  const { canvas, keys, event, drag } = setup();
  drag();
  event(canvas, 'lostpointercapture');
  event(canvas, 'pointermove', { button: -1, buttons: 0, clientX: 170, clientY: 100 });
  const look = { x: 0, y: 0 };
  keys.takeLook(look);
  expect(keys.dragging).toBe(false);
  expect(canvas.style.cursor).toBe('');
  expect(look).toEqual({ x: 0, y: 0 });
});

test('Escape cancels a drag even before a panel has opened', () => {
  const { window, canvas, keys, event, drag } = setup();
  drag();
  event(window, 'keydown', { code: 'Escape' });
  event(canvas, 'pointermove', { button: -1, buttons: 0, clientX: 180, clientY: 100 });
  const look = { x: 0, y: 0 };
  keys.takeLook(look);
  expect(keys.dragging).toBe(false);
  expect(look).toEqual({ x: 0, y: 0 });
});

test('opening UI discards movement already queued by a drag', () => {
  const { canvas, keys, event, drag } = setup();
  drag();
  event(canvas, 'pointermove', { button: -1, buttons: 2, clientX: 150, clientY: 100 });
  keys.freeCursor(true);
  const look = { x: 0, y: 0 };
  keys.takeLook(look);
  expect(look).toEqual({ x: 0, y: 0 });
  expect(keys.dragging).toBe(false);
});

test('a missing pointerup cannot keep a drag alive after the right button is released', () => {
  const { canvas, keys, event, drag } = setup();
  drag();
  event(canvas, 'pointermove', { button: -1, buttons: 0, clientX: 150, clientY: 100 });
  const look = { x: 0, y: 0 };
  keys.takeLook(look);
  expect(look).toEqual({ x: 0, y: 0 });
  expect(keys.dragging).toBe(false);
});

test('a right click released while the left button stays held still acts once', () => {
  const { canvas, keys, event } = setup();
  const uses: string[] = [];
  keys.onPress((p) => { if (p.kind === 'use') uses.push(p.button); });
  event(canvas, 'pointerdown', { button: 2, buttons: 3, clientX: 100, clientY: 100, pointerId: 1 });
  event(canvas, 'pointermove', { button: 2, buttons: 1, clientX: 100, clientY: 100 });
  expect(uses).toEqual(['secondary']);
});

test('touch holds and keyboard holds remain independent', () => {
  const { keys } = setup();
  keys.hold('w', true);
  keys.hold('space', true);
  keys.touch.move(.5, -.25);
  keys.touch.jump(true);
  expect(keys.right).toBe(.5);
  expect(keys.forward).toBe(.75);
  keys.touch.cancel();
  expect(keys.forward).toBe(1);
  expect(keys.jump).toBe(true);
  keys.hold('w', false);
  keys.hold('space', false);
  expect(keys.forward).toBe(0);
  expect(keys.jump).toBe(false);
});

test('touch primary uses once and cancellation never commits a build stroke', () => {
  const { keys } = setup();
  const presses: unknown[] = [];
  keys.onPress(p => presses.push(p));
  keys.touch.primary(true);
  keys.touch.primary(true);
  expect(keys.primary).toBe(true);
  keys.touch.cancel();
  keys.touch.primary(false);
  expect(keys.primary).toBe(false);
  expect(presses).toEqual([{ kind: 'use', button: 'primary' }, { kind: 'letGo', why: 'lost' }]);
});

test('touch aim and swipe do not request a pointer lock; menus discard all touch holds', () => {
  const { keys } = setup();
  keys.setMouse('lock');
  keys.touch.aim(.4, -.3);
  keys.touch.look(24, -12);
  keys.touch.move(1, 1);
  keys.touch.jump(true);
  keys.touch.primary(true);
  expect(keys.pointer).toEqual({ x: .4, y: -.3, over: true });
  const out = { x: 0, y: 0 };
  keys.takeLook(out);
  expect(out).toEqual({ x: 24, y: -12 });
  keys.freeCursor(true);
  keys.touch.move(1, 1);
  keys.touch.primary(true);
  keys.touch.look(12, 6);
  keys.takeLook(out);
  expect(out).toEqual({ x: 0, y: 0 });
  expect([keys.right, keys.forward, keys.jump, keys.primary]).toEqual([0, 0, false, false]);
});

test('native touch on canvas never fires mouse use or takes pointer lock', () => {
  const { canvas, keys, event } = setup();
  keys.setMouse('lock');
  const presses: unknown[] = [];
  keys.onPress(p => presses.push(p));
  event(canvas, 'pointerdown', { pointerType: 'touch', button: 0 });
  expect(presses).toEqual([]);
});

test('touch release leaves a held mouse primary alone', () => {
  const { canvas, window, keys, event } = setup();
  const presses: unknown[] = [];
  keys.onPress(p => presses.push(p));
  event(canvas, 'pointerdown', { button: 0, clientX: 10, clientY: 10 });
  keys.touch.primary(true);
  keys.touch.cancel();
  expect(keys.primary).toBe(true);
  event(window, 'pointerup', { button: 0 });
  expect(presses).toEqual([{ kind: 'use', button: 'primary' }, { kind: 'letGo', why: 'up' }]);
});

test('touch combat sends typed actions and releases calm on blur and menus', () => {
  const { keys, window, event } = setup();
  const presses: unknown[] = [];
  keys.onPress(p => presses.push(p));
  keys.touch.press({ kind: 'fight', action: 'dodge' });
  keys.touch.press({ kind: 'fight', action: 'skill' });
  keys.touch.calm(true);
  expect(keys.touch.calmHeld).toBe(true);
  event(window, 'blur');
  expect(keys.touch.calmHeld).toBe(false);
  keys.freeCursor(true);
  keys.touch.calm(true);
  keys.touch.press({ kind: 'fight', action: 'use' });
  expect(keys.touch.calmHeld).toBe(false);
  expect(presses).toEqual([{ kind: 'fight', action: 'dodge' }, { kind: 'fight', action: 'skill' }]);
});


test('touch help and controls share the coarse-pointer or touch-capability decision', () => {
  for (const key of ['navigator', 'matchMedia']) originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  for (const [points, coarse, expected] of [[0, false, false], [0, true, true], [1, false, true]] as const) {
    Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: points }, configurable: true });
    Object.defineProperty(globalThis, 'matchMedia', { value: () => ({ matches: coarse }), configurable: true });
    expect(touchDevice()).toBe(expected);
  }
});
