import { describe, expect, test } from 'bun:test';
import {
  ACTIONS, DEFAULT_BINDINGS, PinchSteps, TOUCH_CODE, WheelSteps, cloneBindings, codeLabel, emptyIntents, emptyRaw,
  loadBindings, mapIntents, maskIntents, moveToWorld, rebind, saveBindings, stickFromOffset, unbind,
  type Bindings, type RawInput,
} from './intents.sim.ts';

const defaults = (): Bindings => cloneBindings(DEFAULT_BINDINGS);

function raw(held: string[] = [], pressed: string[] = held): RawInput {
  const r = emptyRaw();
  for (const code of held) r.held.add(code);
  for (const code of pressed) r.pressed.add(code);
  return r;
}

describe('keys to a move direction', () => {
  test('W walks away from the camera and D walks to the right', () => {
    const out = mapIntents(raw(['KeyW']), defaults(), emptyIntents());
    expect([out.right, out.forward]).toEqual([0, 1]);
    mapIntents(raw(['KeyD']), defaults(), out);
    expect([out.right, out.forward]).toEqual([1, 0]);
    mapIntents(raw(['ArrowLeft', 'ArrowDown']), defaults(), out);
    expect(out.right).toBeCloseTo(-Math.SQRT1_2, 10);
    expect(out.forward).toBeCloseTo(-Math.SQRT1_2, 10);
  });

  test('a diagonal is no faster than a straight line', () => {
    const out = mapIntents(raw(['KeyW', 'KeyD']), defaults(), emptyIntents());
    expect(Math.hypot(out.right, out.forward)).toBeCloseTo(1, 10);
    expect(out.right).toBeCloseTo(out.forward, 10);
  });

  test('opposite keys cancel', () => {
    const out = mapIntents(raw(['KeyA', 'KeyD', 'KeyW']), defaults(), emptyIntents());
    expect([out.right, out.forward]).toEqual([0, 1]);
  });

  test('no keys is no move, and the same object is returned', () => {
    const out = emptyIntents();
    expect(mapIntents(raw(), defaults(), out)).toBe(out);
    expect([out.right, out.forward, out.jump, out.slot]).toEqual([0, 0, false, -1]);
  });
});

describe('a stick to a move direction', () => {
  test('a full push is a full move in that direction', () => {
    const r = raw();
    r.stickX = 0; r.stickY = 1;
    const out = mapIntents(r, defaults(), emptyIntents());
    expect([out.right, out.forward]).toEqual([0, 1]);
    r.stickX = -1; r.stickY = 0;
    mapIntents(r, defaults(), out);
    expect([out.right, out.forward]).toEqual([-1, 0]);
  });

  test('a stick at rest inside the dead zone does not move the player', () => {
    const r = raw();
    r.padX = 0.1; r.padY = -0.12;
    const out = mapIntents(r, defaults(), emptyIntents());
    expect([out.right, out.forward]).toEqual([0, 0]);
  });

  test('half a push is a slow walk in the same direction', () => {
    const r = raw();
    r.stickX = 0.3; r.stickY = 0.4;
    const out = mapIntents(r, defaults(), emptyIntents());
    const speed = Math.hypot(out.right, out.forward);
    expect(speed).toBeGreaterThan(0.3);
    expect(speed).toBeLessThan(0.5);
    expect(out.forward / out.right).toBeCloseTo(4 / 3, 10);
  });

  test('a stick and a key together never move faster than 1', () => {
    const r = raw(['KeyW']);
    r.padX = 0; r.padY = 1;
    const out = mapIntents(r, defaults(), emptyIntents());
    expect([out.right, out.forward]).toEqual([0, 1]);
  });

  test('a thumb offset on the touch stick: up the screen is forward, and it stops at the rim', () => {
    const out = { x: 0, y: 0 };
    expect(stickFromOffset(0, -30, 60, out)).toEqual({ x: 0, y: 0.5 });
    stickFromOffset(300, 0, 60, out);
    expect(out.x).toBe(1);
    expect(out.y).toBeCloseTo(0, 10);
    stickFromOffset(60, 60, 60, out);
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(1, 10);
    expect(out.y).toBeLessThan(0);
  });

  test('a move relative to the camera turns with the camera', () => {
    const out = { x: 0, z: 0 };
    // Yaw 0 looks north, so forward is -z and right is +x.
    moveToWorld(0, 1, 0, out);
    expect(out.x).toBeCloseTo(0, 10);
    expect(out.z).toBeCloseTo(-1, 10);
    moveToWorld(1, 0, 0, out);
    expect(out.x).toBeCloseTo(1, 10);
    expect(out.z).toBeCloseTo(0, 10);
    // A quarter turn counter-clockwise: the camera stands east and looks west.
    moveToWorld(0, 1, Math.PI / 2, out);
    expect(out.x).toBeCloseTo(-1, 10);
    expect(out.z).toBeCloseTo(0, 10);
    moveToWorld(1, 0, Math.PI / 2, out);
    expect(out.x).toBeCloseTo(0, 10);
    expect(out.z).toBeCloseTo(-1, 10);
  });
});

describe('buttons', () => {
  test('held and pressed are different things', () => {
    const out = mapIntents(raw(['Space'], ['Space']), defaults(), emptyIntents());
    expect([out.jump, out.jumpPressed]).toEqual([true, true]);
    // The next frame the key is still down, and it is not a new press.
    mapIntents(raw(['Space'], []), defaults(), out);
    expect([out.jump, out.jumpPressed]).toEqual([true, false]);
    // A tap shorter than a frame still counts once.
    mapIntents(raw([], ['Space']), defaults(), out);
    expect([out.jump, out.jumpPressed]).toEqual([false, true]);
  });

  test('the mouse, the map key, the turn keys and a number key', () => {
    const out = mapIntents(raw(['Mouse0', 'KeyM', 'KeyE', 'Digit4']), defaults(), emptyIntents());
    expect([out.use, out.usePressed, out.map, out.turn, out.slot]).toEqual([true, true, true, 1, 3]);
    mapIntents(raw(['KeyQ', 'Mouse2', 'KeyF']), defaults(), out);
    expect([out.turn, out.place, out.placePressed, out.interact, out.use, out.slot]).toEqual([-1, true, true, true, false, -1]);
  });

  test('a gamepad button and a touch button do the same as a key', () => {
    const out = mapIntents(raw(['Pad0', 'Pad15']), defaults(), emptyIntents());
    expect([out.jump, out.slotStep]).toEqual([true, 1]);
    mapIntents(raw([TOUCH_CODE.interact, TOUCH_CODE.turnLeft]), defaults(), out);
    expect([out.interact, out.turn, out.jump]).toEqual([true, -1, false]);
  });

  test('zoom adds the wheel and the keys', () => {
    const r = raw(['Minus']);
    r.zoom = 1;
    expect(mapIntents(r, defaults(), emptyIntents()).zoom).toBe(2);
    expect(mapIntents(raw(['Equal']), defaults(), emptyIntents()).zoom).toBe(-1);
  });

  test('a dialogue box takes every intent, and a menu lets only the map key through', () => {
    const everything = ['KeyW', 'Space', 'KeyF', 'Mouse0', 'KeyM', 'KeyE', 'Digit2'];
    const talk = maskIntents(mapIntents(raw(everything), defaults(), emptyIntents()), 'talk');
    expect(talk).toEqual(emptyIntents());
    const menu = maskIntents(mapIntents(raw(everything), defaults(), emptyIntents()), 'menu');
    expect(menu).toEqual({ ...emptyIntents(), map: true });
    const play = maskIntents(mapIntents(raw(everything), defaults(), emptyIntents()), 'play');
    expect([play.forward, play.jump, play.interact, play.map, play.slot]).toEqual([1, true, true, true, 1]);
  });
});

describe('the wheel and a pinch', () => {
  test('one wheel gesture is one step, however many events it sends', () => {
    const wheel = new WheelSteps();
    expect(wheel.add(100, 1000)).toBe(1);
    // A trackpad: many small events in a row add up to one step, then wait.
    let steps = 0;
    for (let i = 0; i < 12; i++) steps += wheel.add(-8, 2000 + i * 16);
    expect(steps).toBe(-1);
  });

  test('spreading two fingers zooms in, and closing them zooms out', () => {
    const pinch = new PinchSteps();
    pinch.start(100);
    expect(pinch.move(110)).toBe(0);
    expect(pinch.move(130)).toBe(-1);
    expect(pinch.move(200)).toBe(-2);
    expect(pinch.move(60)).toBe(5);
  });
});

describe('rebinding', () => {
  test('a new key does the action and the old key stops', () => {
    const bindings = rebind(defaults(), 'jump', 'KeyJ');
    expect(bindings.jump).toEqual(['KeyJ', 'Pad0']);
    expect(mapIntents(raw(['KeyJ']), bindings, emptyIntents()).jump).toBe(true);
    expect(mapIntents(raw(['Space']), bindings, emptyIntents()).jump).toBe(false);
  });

  test('a key does one thing: binding it takes it from the action that had it', () => {
    const bindings = rebind(defaults(), 'interact', 'KeyE');
    expect(bindings.interact).toEqual(['KeyE', 'Pad2']);
    expect(bindings.turnRight).toEqual(['Pad5']);
    const out = mapIntents(raw(['KeyE']), bindings, emptyIntents());
    expect([out.interact, out.turn]).toEqual([true, 0]);
  });

  test('the second slot adds a code and leaves the first', () => {
    const bindings = rebind(defaults(), 'map', 'Tab', 2);
    expect(bindings.map).toEqual(['KeyM', 'Pad8', 'Tab']);
    expect(unbind(bindings, 'map', 'KeyM').map).toEqual(['Pad8', 'Tab']);
  });

  test('rebinding does not change the bindings it was given', () => {
    const before = defaults();
    rebind(before, 'jump', 'KeyJ');
    expect(before).toEqual(defaults());
  });

  test('bindings save and load', () => {
    const bindings = rebind(rebind(defaults(), 'jump', 'KeyJ'), 'map', 'Tab');
    const loaded = loadBindings(saveBindings(bindings));
    expect(loaded).toEqual(bindings);
    expect(mapIntents(raw(['Tab']), loaded, emptyIntents()).map).toBe(true);
  });

  test('a save from before an action existed keeps that action on its default key', () => {
    const loaded = loadBindings(JSON.stringify({ v: 1, keys: { jump: ['KeyJ'], gone: ['KeyX'], use: 'broken' } }));
    expect(loaded.jump).toEqual(['KeyJ']);
    expect(loaded.map).toEqual(['KeyM', 'Pad8']);
    expect(loaded.use).toEqual(['Mouse0', 'Pad7']);
    expect(Object.keys(loaded).sort()).toEqual([...ACTIONS].sort());
  });

  test('text that is not a save gives the defaults', () => {
    expect(loadBindings('not json')).toEqual(defaults());
    expect(loadBindings(null)).toEqual(defaults());
    expect(loadBindings('{"v":2,"keys":{"jump":["KeyJ"]}}')).toEqual(defaults());
  });

  test('codes have short names for a key cap', () => {
    expect([codeLabel('KeyW'), codeLabel('Digit4'), codeLabel('Space'), codeLabel('Mouse2'), codeLabel('Pad0'), codeLabel('ArrowUp')])
      .toEqual(['W', '4', 'Space', 'Right click', 'Pad A', '↑']);
  });
});
