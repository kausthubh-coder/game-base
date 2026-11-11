// The fixed flight: a path through named stops, and the log of what each second of it cost. It is the
// measuring tool for a machine nobody has on the desk: open the game with `?bench`, wait, read the table.
//
// The flight's clock is the sum of the frames' own time steps, which the game caps at a quarter of a second.
// So a slow machine flies the same path through the same places in the same seconds, only in more real
// time, and second 12 of one run can be laid beside second 12 of another.
//
// This file is the arithmetic: where the flight is at a moment, and the log. It never touches the page or
// Three.js. The view that flies it is src/game/views/lab-bench.view.ts.

/** One stop of the flight: a place, how the camera looks at it, how long it holds there, and how long the leg to the next stop takes. */
export interface FlightStop {
  name: string;
  x: number;
  z: number;
  /** Degrees. 0 looks north, 90 west. */
  yaw: number;
  /** Degrees the camera looks down. */
  pitch: number;
  /** Meters the camera stands back. */
  distance: number;
  /** Seconds the flight stands still here. */
  hold: number;
  /** Seconds of travel to the next stop. The last stop has none. */
  travel: number;
}

export interface FlightPose {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  distance: number;
  /** The stop the flight is holding at, or -1 on a leg. */
  stop: number;
  /** True once the last stop's hold is over. */
  done: boolean;
}

/** How long the whole flight takes, in seconds. */
export function flightSeconds(stops: readonly FlightStop[]): number {
  let total = 0;
  stops.forEach((stop, i) => { total += stop.hold + (i < stops.length - 1 ? stop.travel : 0); });
  return total;
}

/** The turn from `a` to `b` the short way round, in degrees. */
const turn = (a: number, b: number): number => ((((b - a) % 360) + 540) % 360) - 180;

/** Where the flight is `t` seconds in. `out` is filled and returned, so a call every frame makes no garbage. */
export function flightPose(stops: readonly FlightStop[], t: number, out: FlightPose): FlightPose {
  let start = 0;
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i] as FlightStop, last = i === stops.length - 1;
    if (t < start + stop.hold || last) {
      out.x = stop.x; out.z = stop.z; out.yaw = stop.yaw; out.pitch = stop.pitch; out.distance = stop.distance;
      out.stop = i;
      out.done = last && t >= start + stop.hold;
      return out;
    }
    start += stop.hold;
    if (t < start + stop.travel) {
      const next = stops[i + 1] as FlightStop;
      // A leg eases away from one stop and into the next.
      const k = (t - start) / stop.travel, e = k * k * (3 - 2 * k);
      out.x = stop.x + (next.x - stop.x) * e;
      out.z = stop.z + (next.z - stop.z) * e;
      out.yaw = stop.yaw + turn(stop.yaw, next.yaw) * e;
      out.pitch = stop.pitch + (next.pitch - stop.pitch) * e;
      out.distance = stop.distance + (next.distance - stop.distance) * e;
      out.stop = -1;
      out.done = false;
      return out;
    }
    start += stop.travel;
  }
  out.stop = -1;
  out.done = true;
  return out;
}

/** What one drawn frame cost. */
export interface FlightFrame {
  /** Milliseconds since the frame before. */
  ms: number;
  /** Milliseconds of the main thread the frame took: the rules, the views and handing the picture to the graphics chip. */
  cpuMs: number;
  drawCalls: number;
  triangles: number;
  /** The quality level in use, and the share of the screen's width and height the 3D picture is drawn at. */
  level: string;
  scale: number;
  /** Shader programs compiled in the middle of this frame's draw. Each is a stall. */
  compiles: number;
}

export interface FlightSecond {
  second: number;
  /** The stop the flight held at for most of the second, or `→ name` on the leg toward it. */
  place: string;
  level: string;
  scale: number;
  frames: number;
  /** Milliseconds between frames: the average and the worst. */
  frameMs: number;
  worstMs: number;
  cpuMs: number;
  /** The most in any frame of the second. */
  drawCalls: number;
  triangles: number;
  compiles: number;
}

export interface FlightFeature {
  feature: string;
  drawCalls: number;
  triangles: number;
  shadowCalls: number;
  shadowTriangles: number;
}

export interface FlightStopResult {
  name: string;
  level: string;
  /** The most in any frame while the flight held here. */
  drawCalls: number;
  triangles: number;
  /** The frame of the hold with the most triangles, by feature. At low the shadow pass is drawn every other frame, and this is one with it. */
  features: FlightFeature[];
}

export interface FlightBudget {
  drawCalls: number;
  triangles: number;
}

export interface FlightReport {
  /** `flying` until the last stop's hold is over, then `done`. */
  state: 'waiting' | 'flying' | 'done';
  /** What the page, the machine and the level were. */
  meta: Record<string, string | number | boolean>;
  /** The budget of the level the flight ended on, or null when it has none. */
  budget: FlightBudget | null;
  seconds: FlightSecond[];
  stops: FlightStopResult[];
  /** The whole flight: the most draw calls and triangles in any frame, and how many frames compiled a shader. */
  most: { drawCalls: number; triangles: number; compiles: number; frames: number };
}

/** Gathers the frames of a flight into seconds and stops. */
export class FlightLog {
  readonly report: FlightReport = { state: 'waiting', meta: {}, budget: null, seconds: [], stops: [], most: { drawCalls: 0, triangles: 0, compiles: 0, frames: 0 } };
  private sumMs = 0;
  private sumCpu = 0;

  begin(meta: Record<string, string | number | boolean>): void {
    const r = this.report;
    r.state = 'flying';
    r.meta = meta;
    r.budget = null;
    r.seconds.length = r.stops.length = 0;
    r.most.drawCalls = r.most.triangles = r.most.compiles = r.most.frames = 0;
  }

  /**
   * Adds a frame drawn `t` seconds into the flight, at `place`. `stop` is the stop it held at, or null on a leg.
   * True when the frame has the most triangles of its stop so far: hand its cost by feature to `features`.
   */
  frame(t: number, place: string, stop: string | null, f: FlightFrame): boolean {
    const r = this.report, second = Math.floor(t);
    let row = r.seconds[r.seconds.length - 1];
    if (!row || row.second !== second) {
      row = { second, place, level: f.level, scale: f.scale, frames: 0, frameMs: 0, worstMs: 0, cpuMs: 0, drawCalls: 0, triangles: 0, compiles: 0 };
      r.seconds.push(row);
      this.sumMs = this.sumCpu = 0;
    }
    row.frames++;
    this.sumMs += f.ms;
    this.sumCpu += f.cpuMs;
    row.frameMs = round(this.sumMs / row.frames, 2);
    row.cpuMs = round(this.sumCpu / row.frames, 2);
    row.worstMs = Math.max(row.worstMs, round(f.ms, 2));
    row.drawCalls = Math.max(row.drawCalls, f.drawCalls);
    row.triangles = Math.max(row.triangles, f.triangles);
    row.compiles += f.compiles;
    row.place = place;
    row.level = f.level;
    row.scale = f.scale;
    r.most.frames++;
    r.most.drawCalls = Math.max(r.most.drawCalls, f.drawCalls);
    r.most.triangles = Math.max(r.most.triangles, f.triangles);
    r.most.compiles += f.compiles;
    if (stop === null) return false;
    let held = r.stops[r.stops.length - 1];
    if (!held || held.name !== stop) r.stops.push((held = { name: stop, level: f.level, drawCalls: 0, triangles: -1, features: [] }));
    const heaviest = f.triangles > held.triangles;
    held.level = f.level;
    held.drawCalls = Math.max(held.drawCalls, f.drawCalls);
    held.triangles = Math.max(held.triangles, f.triangles);
    return heaviest;
  }

  /** The cost by feature of the frame just added, kept for the stop the flight holds at. */
  features(rows: readonly FlightFeature[]): void {
    const held = this.report.stops[this.report.stops.length - 1];
    if (held) held.features = rows.map((row) => ({ ...row }));
  }

  end(budget: FlightBudget | null): void {
    this.report.state = 'done';
    this.report.budget = budget;
  }
}

const round = (value: number, digits: number): number => Math.round(value * 10 ** digits) / 10 ** digits;

const pad = (value: string | number, width: number): string => String(value).padStart(width);

/** The report as text: the stops against the budget, then every second. */
export function flightTable(report: FlightReport): string {
  const lines: string[] = [];
  const b = report.budget;
  lines.push(b ? `budget at this level: ${b.drawCalls} draw calls, ${b.triangles} triangles` : 'this level has no budget of its own');
  lines.push('');
  lines.push(`${'stop'.padEnd(14)} ${'level'.padEnd(7)} ${pad('calls', 6)} ${pad('triangles', 10)}${b ? '   against the budget' : ''}`);
  for (const stop of report.stops) {
    const over = b ? `   ${stop.drawCalls > b.drawCalls ? `calls +${stop.drawCalls - b.drawCalls}` : 'calls ok'}, ${stop.triangles > b.triangles ? `triangles +${stop.triangles - b.triangles}` : 'triangles ok'}` : '';
    lines.push(`${stop.name.padEnd(14)} ${stop.level.padEnd(7)} ${pad(stop.drawCalls, 6)} ${pad(stop.triangles, 10)}${over}`);
  }
  lines.push('');
  lines.push(`${pad('sec', 4)} ${'place'.padEnd(16)} ${'level'.padEnd(7)} ${pad('size', 5)} ${pad('frames', 6)} ${pad('ms', 8)} ${pad('worst', 8)} ${pad('cpu ms', 7)} ${pad('calls', 6)} ${pad('triangles', 10)} ${pad('compiled', 8)}`);
  for (const s of report.seconds) {
    lines.push(`${pad(s.second, 4)} ${s.place.padEnd(16)} ${s.level.padEnd(7)} ${pad(s.scale.toFixed(2), 5)} ${pad(s.frames, 6)} ${pad(s.frameMs.toFixed(1), 8)} ${pad(s.worstMs.toFixed(1), 8)} ${pad(s.cpuMs.toFixed(1), 7)} ${pad(s.drawCalls, 6)} ${pad(s.triangles, 10)} ${pad(s.compiles, 8)}`);
  }
  lines.push('');
  lines.push(`whole flight: ${report.most.frames} frames, at most ${report.most.drawCalls} draw calls and ${report.most.triangles} triangles in a frame, ${report.most.compiles} shader programs compiled in a draw`);
  return lines.join('\n');
}
