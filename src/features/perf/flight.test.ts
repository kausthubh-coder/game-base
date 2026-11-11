import { describe, expect, test } from 'bun:test';
import { FlightLog, flightPose, flightSeconds, flightTable, type FlightFrame, type FlightPose, type FlightStop } from './flight.sim.ts';

const STOPS: FlightStop[] = [
  { name: 'spawn', x: 0, z: 0, yaw: 350, pitch: 6, distance: 10, hold: 2, travel: 4 },
  { name: 'road', x: 40, z: 0, yaw: 10, pitch: 10, distance: 20, hold: 2, travel: 2 },
  { name: 'town', x: 40, z: 20, yaw: 90, pitch: 10, distance: 20, hold: 3, travel: 9 },
];
const pose = (t: number): FlightPose => flightPose(STOPS, t, { x: 0, z: 0, yaw: 0, pitch: 0, distance: 0, stop: 0, done: false });
const frame = (over: Partial<FlightFrame> = {}): FlightFrame => ({ ms: 16, cpuMs: 4, drawCalls: 70, triangles: 200000, level: 'high', scale: 1, compiles: 0, ...over });

describe('the fixed flight', () => {
  test('the last stop has no leg after it', () => {
    expect(flightSeconds(STOPS)).toBe(2 + 4 + 2 + 2 + 3);
  });

  test('it holds at a stop, eases along a leg and ends after the last hold', () => {
    expect(pose(0)).toMatchObject({ x: 0, z: 0, stop: 0, done: false });
    expect(pose(1.99)).toMatchObject({ x: 0, stop: 0 });
    // Halfway along the leg it is halfway there, and it leaves a stop slowly.
    expect(pose(4)).toMatchObject({ x: 20, z: 0, stop: -1, distance: 15 });
    expect(pose(2.4).x).toBeLessThan(4);
    expect(pose(6)).toMatchObject({ x: 40, z: 0, stop: 1 });
    expect(pose(12.9)).toMatchObject({ x: 40, z: 20, stop: 2, done: false });
    expect(pose(13)).toMatchObject({ stop: 2, done: true });
    expect(pose(500)).toMatchObject({ x: 40, z: 20, done: true });
  });

  test('the camera turns the short way round', () => {
    // From 350 degrees to 10 is 20 degrees through north, not 340 the other way.
    expect(pose(4).yaw).toBeCloseTo(360, 5);
    expect(pose(9).yaw).toBeCloseTo(50, 5);
  });

  test('the same moment is the same place whatever the frame rate', () => {
    const fast: number[] = [], slow: number[] = [];
    for (let t = 0; t < 13; t += 1 / 60) if (Math.abs(t - Math.round(t)) < 1e-6) fast.push(pose(t).x);
    for (let t = 0; t < 13; t += 0.25) if (Math.abs(t - Math.round(t)) < 1e-6) slow.push(pose(t).x);
    expect(fast.length).toBe(slow.length);
    fast.forEach((x, i) => expect(x).toBeCloseTo(slow[i]!, 6));
  });
});

describe('the flight log', () => {
  test('frames gather into seconds: average and worst frame time, the most draw calls and triangles', () => {
    const log = new FlightLog();
    log.begin({ page: '/?bench' });
    log.frame(0.0, 'spawn', 'spawn', frame({ ms: 10 }));
    log.frame(0.5, 'spawn', 'spawn', frame({ ms: 30, drawCalls: 90, triangles: 250000, compiles: 1 }));
    log.frame(1.2, '→ road', null, frame({ ms: 20, level: 'medium', scale: 0.7 }));
    const { seconds, most } = log.report;
    expect(seconds).toHaveLength(2);
    expect(seconds[0]).toEqual({ second: 0, place: 'spawn', level: 'high', scale: 1, frames: 2, frameMs: 20, worstMs: 30, cpuMs: 4, drawCalls: 90, triangles: 250000, compiles: 1 });
    expect(seconds[1]).toMatchObject({ second: 1, place: '→ road', level: 'medium', scale: 0.7, frames: 1, frameMs: 20 });
    expect(most).toEqual({ drawCalls: 90, triangles: 250000, compiles: 1, frames: 3 });
  });

  test('a stop keeps the most it cost while the flight held there, and its cost by feature', () => {
    const log = new FlightLog();
    log.begin({});
    // The frame with the most triangles so far is the one whose cost by feature the stop keeps.
    expect(log.frame(0, 'spawn', 'spawn', frame({ drawCalls: 70 }))).toBe(true);
    expect(log.frame(1, 'spawn', 'spawn', frame({ drawCalls: 75, triangles: 210000 }))).toBe(true);
    log.features([{ feature: 'grass', drawCalls: 4, triangles: 90000, shadowCalls: 0, shadowTriangles: 0 }]);
    expect(log.frame(1.5, 'spawn', 'spawn', frame({ drawCalls: 60, triangles: 150000 }))).toBe(false);
    expect(log.frame(2, '→ road', null, frame({ drawCalls: 400 }))).toBe(false);
    log.frame(6, 'road', 'road', frame({ drawCalls: 60, triangles: 100000, level: 'low' }));
    log.end({ drawCalls: 80, triangles: 150000 });
    const { stops, state, budget } = log.report;
    expect(state).toBe('done');
    expect(budget).toEqual({ drawCalls: 80, triangles: 150000 });
    expect(stops.map((s) => [s.name, s.level, s.drawCalls, s.triangles])).toEqual([['spawn', 'high', 75, 210000], ['road', 'low', 60, 100000]]);
    expect(stops[0]!.features).toEqual([{ feature: 'grass', drawCalls: 4, triangles: 90000, shadowCalls: 0, shadowTriangles: 0 }]);
  });

  test('the table names what is over the budget, and is the same data as the report', () => {
    const log = new FlightLog();
    log.begin({});
    log.frame(0, 'spawn', 'spawn', frame({ drawCalls: 95, triangles: 140000 }));
    log.end({ drawCalls: 80, triangles: 150000 });
    const table = flightTable(log.report);
    expect(table).toContain('budget at this level: 80 draw calls, 150000 triangles');
    expect(table).toContain('calls +15, triangles ok');
    expect(table).toContain('whole flight: 1 frames, at most 95 draw calls and 140000 triangles in a frame, 0 shader programs compiled in a draw');
    expect(JSON.parse(JSON.stringify(log.report))).toEqual(log.report);
  });

  test('beginning again clears the last flight', () => {
    const log = new FlightLog();
    log.begin({});
    log.frame(0, 'spawn', 'spawn', frame());
    log.end(null);
    log.begin({ page: 'again' });
    expect(log.report).toMatchObject({ state: 'flying', seconds: [], stops: [], budget: null, most: { frames: 0 } });
  });
});
