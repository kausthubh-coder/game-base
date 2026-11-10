import { describe, expect, test } from 'bun:test';
import { CameraRig } from '../../features/camera/index.ts';
import { CLICK_MS, DRAG_PIXELS, RightDrag } from './drag.ts';

/** The right button over the 2.5D camera, as keys.ts and game.ts wire it: a click places, a drag turns. */
function hand() {
  const drag = new RightDrag();
  const rig = new CameraRig({ baseYaw: 0, turnTime: 0.3 });
  rig.update(1 / 60, 0, 0, 0);
  let placed = 0, time = 0;
  return {
    rig,
    get placed() { return placed; },
    press(x: number, y: number) { drag.press(x, y, time); },
    move(x: number, y: number) { if (drag.move(x, y)) rig.spin(-drag.dx * 0.0024); },
    wait(ms: number) { time += ms; },
    release() {
      const end = drag.release(time);
      if (end === 'click') placed++;
      return end;
    },
  };
}

describe('the right button', () => {
  test('a click places and does not turn the camera', () => {
    const h = hand();
    h.press(500, 400);
    h.wait(90);
    expect(h.release()).toBe('click');
    expect(h.placed).toBe(1);
    expect(h.rig.yaw).toBe(0);
  });

  test('a short jitter within the threshold still places, and does not turn', () => {
    const h = hand();
    h.press(500, 400);
    for (const [x, y] of [[502, 401], [497, 403], [500 + DRAG_PIXELS, 400], [499, 398]]) { h.wait(20); h.move(x, y); }
    h.wait(60);
    expect(h.release()).toBe('click');
    expect(h.placed).toBe(1);
    expect(h.rig.yaw).toBe(0);
  });

  test('a drag past the threshold turns the camera with the hand and places nothing', () => {
    const h = hand();
    h.press(500, 400);
    for (let x = 510; x <= 800; x += 10) { h.wait(16); h.move(x, 400); }
    expect(h.release()).toBe('drag');
    expect(h.placed).toBe(0);
    // 300 pixels to the right turn the view right by 300 * 0.0024 radians: the whole way from the press.
    expect(h.rig.yaw).toBeCloseTo(-300 * 0.0024, 9);
  });

  test('a quick flick past the threshold is a drag, not a click', () => {
    const h = hand();
    h.press(500, 400);
    h.wait(30);
    h.move(500 + DRAG_PIXELS + 1, 400);
    expect(h.release()).toBe('drag');
    expect(h.placed).toBe(0);
  });

  test('a press held still for long places nothing', () => {
    const h = hand();
    h.press(500, 400);
    h.wait(CLICK_MS + 1);
    expect(h.release()).toBe('none');
    expect(h.placed).toBe(0);
  });

  test('a drag that comes back to where it started is still a drag', () => {
    const h = hand();
    h.press(500, 400);
    h.move(540, 400);
    h.move(500, 400);
    expect(h.release()).toBe('drag');
    expect(h.placed).toBe(0);
    expect(h.rig.yaw).toBeCloseTo(0, 9);
  });

  test('a move with no press turns nothing', () => {
    const h = hand();
    h.move(900, 400);
    expect(h.release()).toBe('none');
    expect(h.rig.yaw).toBe(0);
  });
});
