// The adapter boundary, separate from Stroke.tla's bounded rules. Real keys feed the real
// build system through the release/cancel dispatch in world-build.view.ts. DOM delivery is
// explicit here; tools/play-touch.mjs supplies the real capture/bubbling evidence.
import { afterEach, expect, test } from 'bun:test';
import { blockId } from '../../../src/content/blocks.ts';
import { makeBuildStage } from '../../../src/game/build/stage.ts';
import { createKeys, type Press } from '../../../src/game/shell/keys.ts';
import { touchPointer } from '../../../src/game/views/touch-controls.ts';

const originals = new Map<string, PropertyDescriptor | undefined>();
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const fn of cleanups.splice(0).reverse()) fn();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  originals.clear();
});

class Element extends EventTarget {
  style = { cursor: '' };
  tagName = 'CANVAS';
  isContentEditable = false;
  captures = new Set<number>();
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  setPointerCapture(id: number) { this.captures.add(id); }
  hasPointerCapture(id: number) { return this.captures.has(id); }
  releasePointerCapture(id: number) { this.captures.delete(id); }
}
function setup(build = true) {
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { pointerLockElement: null });
  for (const [key, value] of Object.entries({ window, document, HTMLElement: Element })) {
    if (!originals.has(key)) originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  const canvas = new Element(), keys = createKeys(canvas as unknown as HTMLElement);
  cleanups.push(() => keys.dispose());
  const stage = build ? makeBuildStage() : null;
  stage?.hold('hoe'); stage?.point(3, 3);
  const presses: Press[] = [];
  let commits = 0;
  stage?.kernel.game.events.on('build.applied', e => { if (!e.undone) commits++; });
  keys.onPress(p => {
    presses.push(p);
    if (p.kind === 'use' && p.button === 'primary') stage?.build.press();
    if (p.kind === 'letGo') {
      if (p.why === 'up') stage?.build.release();
      else stage?.build.cancel();
    }
  });
  function event(target: EventTarget, name: string, values: Record<string, unknown> = {}) {
    const e = new Event(name, { cancelable: true });
    for (const [key, value] of Object.entries(values)) Object.defineProperty(e, key, { value });
    target.dispatchEvent(e);
  }
  const mouse = (down: boolean) => event(down ? canvas : window, down ? 'pointerdown' : 'pointerup', {
    pointerType: 'mouse', pointerId: 1, button: 0, buttons: down ? 1 : 0, clientX: 300, clientY: 300,
  });
  return { window, canvas, keys, stage, presses, event, mouse, get commits() { return commits; } };
}
const use = { kind: 'use', button: 'primary' };
const up = { kind: 'letGo', why: 'up' };
const lost = { kind: 'letGo', why: 'lost' };

for (const first of ['mouse', 'touch'] as const) for (const last of ['mouse', 'touch'] as const) {
  test(`${first} first, ${last} last: only the final holder releases a stroke`, () => {
    const h = setup(), { keys, stage } = h;
    const down = (kind: string) => kind === 'mouse' ? h.mouse(true) : keys.touch.primary(true);
    const release = (kind: string) => kind === 'mouse' ? h.mouse(false) : keys.touch.primary(false);
    down(first); down(first === 'mouse' ? 'touch' : 'mouse');
    // Mouse-down still emits use when touch is held. ButtonDown already permits this;
    // build.press ignores the repeat while dragging. It is not a second logical stroke.
    expect(h.presses).toEqual(first === 'mouse' ? [use] : [use, use]);
    stage!.point(4, 3);
    release(last === 'mouse' ? 'touch' : 'mouse');
    expect(keys.primary).toBe(true);
    expect(stage!.build.dragging).toBe(true);
    expect(h.commits).toBe(0);
    release(last); release(last);
    expect(h.presses.at(-1)).toEqual(up);
    expect(h.presses.filter(p => p.kind === 'letGo')).toHaveLength(1);
    expect(keys.primary).toBe(false);
    expect(stage!.build.dragging).toBe(false);
    expect(h.commits).toBe(1);
    expect(stage!.blocks(3, 3, 4, 3)).toEqual([blockId('tilled_soil'), blockId('tilled_soil')]);
  });
}

for (const action of ['cancel', 'Escape', 'blur', 'release', 'freeCursor'] as const) {
  test(`sole touch ${action} drops the real stroke without tilling`, () => {
    const h = setup();
    h.keys.touch.primary(true); h.keys.touch.primary(true);
    h.stage!.point(4, 3);
    if (action === 'cancel') h.keys.touch.cancel();
    if (action === 'Escape') h.event(h.window, 'keydown', { code: 'Escape' });
    if (action === 'blur') h.event(h.window, 'blur');
    if (action === 'release') h.keys.release();
    if (action === 'freeCursor') h.keys.freeCursor(true);
    h.keys.touch.primary(false);
    expect(h.presses).toEqual([use, lost]);
    expect(h.keys.primary).toBe(false);
    expect(h.stage!.build.dragging).toBe(false);
    expect(h.commits).toBe(0);
    expect(h.stage!.blocks(3, 3, 4, 3)).toEqual([blockId('grass'), blockId('grass')]);
  });
}

for (const action of ['Escape', 'blur', 'release'] as const) {
  test(`mixed holds ${action} produces one loss, never a commit`, () => {
    const h = setup();
    h.keys.touch.primary(true); h.mouse(true);
    if (action === 'Escape') h.event(h.window, 'keydown', { code: 'Escape' });
    if (action === 'blur') h.event(h.window, 'blur');
    if (action === 'release') h.keys.release();
    h.mouse(false); h.keys.touch.primary(false);
    expect(h.presses).toEqual([use, use, lost]);
    expect(h.keys.primary).toBe(false);
    expect(h.stage!.build.dragging).toBe(false);
    expect(h.commits).toBe(0);
  });
}

test('direct touch cancellation preserves a mouse hold until the mouse releases', () => {
  const h = setup();
  h.mouse(true); h.keys.touch.primary(true); h.keys.touch.cancel();
  expect(h.keys.primary).toBe(true);
  expect(h.stage!.build.dragging).toBe(true);
  expect(h.presses).toEqual([use]);
  h.mouse(false);
  expect(h.presses).toEqual([use, up]);
  expect(h.commits).toBe(1);
});

test('freeCursor drops touch but requires release() to clear an unlocked mouse hold', () => {
  const h = setup();
  h.mouse(true); h.keys.touch.primary(true); h.keys.freeCursor(true);
  expect(h.keys.primary).toBe(true);
  expect(h.presses).toEqual([use]);
  h.keys.release(); h.mouse(false);
  expect(h.presses).toEqual([use, lost]);
  expect(h.commits).toBe(0);
});

test('native touch pointercancel also cancels a held mouse through the window handler', () => {
  const h = setup();
  h.mouse(true);
  // Real pointercancel bubbles from the control to window. touch.cancel alone is
  // deliberately different: the existing global pointercancel listener is unfiltered.
  h.event(h.window, 'pointercancel', { pointerType: 'touch', pointerId: 9 });
  expect(h.keys.primary).toBe(false);
  expect(h.presses).toEqual([use, lost]);
  expect(h.stage!.build.dragging).toBe(false);
  h.mouse(false);
  expect(h.commits).toBe(0);
});

test('canvas capture loss drops mouse; a surviving touch remains held until cancelled', () => {
  const h = setup();
  h.mouse(true); h.keys.touch.primary(true);
  h.event(h.canvas, 'lostpointercapture', { pointerType: 'mouse', pointerId: 1 });
  expect(h.keys.primary).toBe(true);
  expect(h.presses).toEqual([use]);
  h.keys.touch.cancel(); h.mouse(false);
  expect(h.presses).toEqual([use, lost]);
  expect(h.stage!.build.dragging).toBe(false);
  expect(h.commits).toBe(0);
});

test('touchPointer rejects other fingers and cannot resume after disposal', () => {
  const h = setup(), element = new Element();
  const stop = touchPointer(element as unknown as HTMLElement, {
    start() { h.keys.touch.primary(true); },
    end(cancelled) { if (cancelled) h.keys.touch.cancel(); else h.keys.touch.primary(false); },
  });
  const finger = (name: string, id: number) => h.event(element, name, { pointerType: 'touch', pointerId: id });
  finger('pointerdown', 8); finger('pointerdown', 9); finger('pointerup', 9);
  expect(h.keys.primary).toBe(true);
  finger('lostpointercapture', 8); stop();
  finger('pointermove', 8); finger('pointerup', 8); finger('pointerdown', 10);
  expect(h.presses).toEqual([use, lost]);
  expect(h.stage!.build.dragging).toBe(false);
  expect(h.commits).toBe(0);
});

test('every four-event touch/mouse hold ordering obeys the aggregate release contract', () => {
  // Enumerates 6^4 sequences. No browser, scheduling, panels or geometry is modelled here.
  const alphabet = ['md', 'mu', 'td', 'tu', 'tc', 'release'];
  for (let code = 0; code < 6 ** 4; code++) {
    const h = setup(false);
    let value = code, mouse = false, touch = false;
    const expected: unknown[] = [];
    for (let step = 0; step < 4; step++) {
      const action = alphabet[value % 6]; value = Math.floor(value / 6);
      if (action === 'md') { mouse = true; expected.push(use); h.mouse(true); }
      if (action === 'mu') { if (mouse && !touch) expected.push(up); mouse = false; h.mouse(false); }
      if (action === 'td') { if (!touch && !mouse) expected.push(use); touch = true; h.keys.touch.primary(true); }
      if (action === 'tu') { if (touch && !mouse) expected.push(up); touch = false; h.keys.touch.primary(false); }
      if (action === 'tc') { if (touch && !mouse) expected.push(lost); touch = false; h.keys.touch.cancel(); }
      if (action === 'release') { if (mouse || touch) expected.push(lost); mouse = touch = false; h.keys.release(); }
      expect(h.keys.primary).toBe(mouse || touch);
      expect(h.presses).toEqual(expected);
    }
    h.keys.dispose(); cleanups.pop();
  }
});
