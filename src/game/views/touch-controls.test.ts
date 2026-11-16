import { expect, test } from 'bun:test';
import { stick, touchPointer } from './touch-controls.ts';

test('stick has a dead zone, camera-relative axes, and a circular limit', () => {
  expect(stick(2, -2, 54)).toEqual({ right: 0, forward: 0 });
  expect(stick(54, 0, 54)).toEqual({ right: 1, forward: -0 });
  expect(stick(0, -54, 54)).toEqual({ right: 0, forward: 1 });
  const diagonal = stick(100, -100, 54);
  expect(Math.hypot(diagonal.right, diagonal.forward)).toBeCloseTo(1);
});

test('a second finger cannot steal a control; lost capture cancels exactly once', () => {
  const element = Object.assign(new EventTarget(), {
    setPointerCapture() {}, hasPointerCapture() { return false; }, releasePointerCapture() {},
  });
  const results: unknown[] = [];
  const stop = touchPointer(element as unknown as HTMLElement, {
    start: e => results.push(e.pointerId), end: cancelled => results.push(cancelled),
  });
  function event(name: string, pointerId: number) {
    element.dispatchEvent(Object.assign(new Event(name), { pointerType: 'touch', pointerId }));
  }
  event('pointerdown', 1); event('pointerdown', 2); event('pointerup', 2);
  expect(results).toEqual([1]);
  event('lostpointercapture', 1); event('pointercancel', 1); event('pointerup', 1);
  expect(results).toEqual([1, true]);
  stop();
});
