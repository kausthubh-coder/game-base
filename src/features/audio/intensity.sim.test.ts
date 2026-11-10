import { expect, test } from 'bun:test';
import { gateLayers, intensityTarget, layerLevel, LAYERS, newSwitches, smoothIntensity, type Mood } from './intensity.sim.ts';

const mood = (m: Partial<Mood>): Mood => ({ town: 0, danger: 0, fight: 0, boss: 0, night: 0, rain: 0, ...m });

/** The layers that are on once the intensity has settled for this mood. */
function settled(m: Mood): string[] {
  const switches = newSwitches();
  const level = intensityTarget(m);
  for (let i = 0; i < 4; i++) gateLayers(switches, level, m.danger, m.boss);
  return LAYERS.filter((id) => switches[id]);
}

test('each mood has its own arrangement', () => {
  expect(settled(mood({}))).toEqual(['drone', 'harmony', 'melody', 'sparkle', 'bass', 'perc']);
  // Night is thinner: the bass and the drums go home.
  expect(settled(mood({ night: 1 }))).toEqual(['drone', 'harmony', 'melody', 'sparkle']);
  // A town is fuller.
  expect(settled(mood({ town: 1 }))).toContain('full');
  expect(settled(mood({ town: 1 }))).not.toContain('drums');
  // A fight brings the drums, by day or by night.
  expect(settled(mood({ fight: 1 }))).toContain('drums');
  expect(settled(mood({ fight: 1, night: 1 }))).toContain('drums');
  // A town with an enemy near is tense, but it is not a fight.
  expect(settled(mood({ town: 1, danger: 1 }))).toContain('tension');
  expect(settled(mood({ town: 1, danger: 1 }))).not.toContain('drums');
  expect(settled(mood({ boss: 1, fight: 1 }))).toContain('boss');
});

test('a layer does not flicker when the intensity wobbles at its threshold', () => {
  const switches = newSwitches();
  let flips = 0;
  let was = false;
  for (let i = 0; i < 400; i++) {
    // Rise through the drum threshold, then wobble around it.
    const level = i < 100 ? 0.6 + i * 0.003 : 0.84 + 0.05 * Math.sin(i);
    gateLayers(switches, level, 0, 0);
    if (switches.drums !== was) flips++;
    was = switches.drums;
  }
  expect(flips).toBe(1);
  expect(switches.drums).toBe(true);
});

test('a layer that is off stays off inside the band', () => {
  const switches = newSwitches();
  for (let i = 0; i < 100; i++) gateLayers(switches, 0.72 + 0.1 * Math.abs(Math.sin(i)), 0, 0);
  expect(switches.drums).toBe(false);
});

test('intensity rises fast and falls slowly', () => {
  let up = 0.5;
  let down = 0.95;
  for (let i = 0; i < 20; i++) {
    up = smoothIntensity(up, 0.95, 0.05);
    down = smoothIntensity(down, 0.5, 0.05);
  }
  // After one second: most of the way up, less than half of the way down.
  expect(up).toBeGreaterThan(0.85);
  expect(down).toBeGreaterThan(0.75);
});

test('a layer comes in over a range of intensity', () => {
  expect(layerLevel('bass', false, 0.9, 0, 0)).toBe(0);
  const low = layerLevel('bass', true, 0.44, 0, 0);
  const high = layerLevel('bass', true, 0.7, 0, 0);
  expect(low).toBeGreaterThan(0.5);
  expect(high).toBe(1);
  expect(high).toBeGreaterThan(low);
});
