import { expect, test } from 'bun:test';
import { clearOfPanels } from './clear.ts';

const BOX = { left: 48, up: 25, right: 48, down: 52 };
const W = 1440, H = 900;
// The top right corner of the HUD at 1440 by 900: the minimap, the clock under it, the quest tracker under that.
const MINIMAP = [1240, 16, 1424, 200], CLOCK = [1290, 208, 1424, 240], TRACKER = [1150, 248, 1424, 420];
const SLOTS = [490, 820, 950, 884];
const HUD = [...MINIMAP, ...CLOCK, ...TRACKER, ...SLOTS];

test('an arrow on the right edge that lies over the quest tracker slides below it', () => {
  const out = clearOfPanels(W - 72, 330, BOX, true, HUD, 4, W, H, 10, { x: 0, y: 0 });
  expect(out.x).toBe(W - 72);
  // Just under the tracker, which is closer than above the minimap.
  expect(out.y).toBe(420 + 10 + 25);
});

test('an arrow on the top edge under the minimap slides left of it', () => {
  const out = clearOfPanels(1300, 72, BOX, false, HUD, 4, W, H, 10, { x: 0, y: 0 });
  expect(out.y).toBe(72);
  expect(out.x).toBe(1240 - 10 - 48);
});

test('an arrow on the bottom edge over the quick slots slides to the nearer side', () => {
  const out = clearOfPanels(560, H - 72, { left: 48, up: 52, right: 48, down: 25 }, false, HUD, 4, W, H, 10, { x: 0, y: 0 });
  expect(out.y).toBe(H - 72);
  expect(out.x).toBe(490 - 10 - 48);
});

test('an arrow clear of every panel stays where the map put it', () => {
  const out = clearOfPanels(W - 72, 600, BOX, true, HUD, 4, W, H, 10, { x: 0, y: 0 });
  expect([out.x, out.y]).toEqual([W - 72, 600]);
});
