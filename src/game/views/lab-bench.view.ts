// The fixed flight: `?bench` in the address starts a new game with no click, flies a fixed path from the
// spawn through the meadow and into the town, and records what every second of it cost: frame times, draw
// calls, triangles, and the quality level in use. It ends with a table on screen, and the same numbers are at
// `window.__game.bench()` as plain data. It is how the game is measured on a machine that is not on the desk.
//
//   /?bench                    the stored quality setting, automatic by default: the level may change in flight
//   /?bench&quality=low        holds a level, as everywhere else
//   /?bench=0.5                the same path in half the time
//
// The rules stand still while it flies, at noon under a clear sky, so two runs draw the same world. The frame
// times are therefore the picture's cost, without the rules'. The flight's clock is the frames' own time
// step, which the shell caps at a quarter of a second, so a slow machine flies the same path in more real
// time and its seconds line up with a fast machine's. A stop is also held for at least sixty frames, so the
// land, the grass and the water of the place have arrived before its numbers are taken, however slow the frames.
//
// The save is left as it was: the flight plays a new game, and whatever was stored is put back when the page closes.
// Without `?bench` this file does nothing.
import { QUALITY_BUDGETS, levelOf } from '../../content/quality.ts';
import { flightPose, flightSeconds, flightTable, type FlightPose, type FlightStop } from '../../features/perf/index.ts';
import type { Systems } from '../api.sim.ts';
import { SAVE_KEY } from '../shell/save.ts';
import type { GameView } from '../shell/view.ts';
import { addStyle } from '../uiview/theme.ts';

/**
 * The stops, in order. `at` is a place of the region or a column. `as` is the camera: `played` is the game's own
 * 2.5D camera as a new game opens on it, and `horizon` is the free camera looking out over the land, which
 * sees the most. For `horizon`, `yaw` 0 looks north and 90 west, `pitch` is how far it looks down and
 * `distance` how far back it stands. `hold` and `travel` are seconds.
 */
const ROUTE: readonly { name: string; at: string | readonly [number, number]; as: 'played' | 'horizon'; yaw: number; pitch: number; distance: number; hold: number; travel: number }[] = [
  { name: 'spawn', at: 'spawn', as: 'played', yaw: 300, pitch: 6, distance: 9, hold: 4, travel: 2 },
  { name: 'spawn view', at: 'spawn', as: 'horizon', yaw: 300, pitch: 6, distance: 9, hold: 4, travel: 5 },
  { name: 'meadow', at: [12, -214], as: 'horizon', yaw: 338, pitch: 13, distance: 36, hold: 4, travel: 6 },
  { name: 'road', at: [60, -200], as: 'horizon', yaw: 285, pitch: 5, distance: 9, hold: 4, travel: 5 },
  { name: 'vale', at: [100, -210], as: 'horizon', yaw: 250, pitch: 5, distance: 12, hold: 4, travel: 5 },
  { name: 'gate', at: [124, -176], as: 'horizon', yaw: 275, pitch: 7, distance: 10, hold: 4, travel: 4 },
  { name: 'street', at: [143, -174], as: 'horizon', yaw: 272, pitch: 6, distance: 10, hold: 4, travel: 4 },
  { name: 'town', at: [150, -139], as: 'horizon', yaw: 318, pitch: 11, distance: 17, hold: 4, travel: 4 },
  { name: 'green', at: [173, -142], as: 'horizon', yaw: 0, pitch: 7, distance: 15, hold: 4, travel: 4 },
  { name: 'square', at: 'town.square', as: 'played', yaw: 0, pitch: 7, distance: 15, hold: 4, travel: 0 },
];

/** Frames with nothing left to mesh before the flight takes off, and the most frames it waits for that. */
const SETTLED = 20, WAIT_MOST = 1200;
/** A stop is held for at least this many frames. Above fifteen frames a second its four seconds are longer than that. */
const HOLD_FRAMES = 60;
/** Seconds the rules run before they are stopped, so the clear noon sky has taken hold. */
const LEAD = 0.4;
const DEG = Math.PI / 180;

const STYLE = /* css */ `
.lab-bench { position: fixed; right: 12px; top: 12px; z-index: 40; max-width: min(94vw, 880px); max-height: 92vh; overflow: auto;
  margin: 0; padding: 10px 12px; pointer-events: auto; user-select: text;
  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; white-space: pre;
  color: #e8eaee; background: rgba(16, 20, 26, 0.88); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 6px; }
`;

export function install(view: GameView): void {
  const params = new URLSearchParams(location.search);
  if (!params.has('bench')) return;
  const { game, perf } = view;
  const sys = game.systems as Partial<Systems>;
  const pace = Math.min(4, Math.max(0.1, Number(params.get('bench')) || 1));

  // The flight plays a new game. What was stored before is put back when the page closes, after the shell has saved.
  let stored: string | null = null;
  try { stored = localStorage.getItem(SAVE_KEY); } catch { /* nothing can be stored, so nothing can be lost */ }
  window.addEventListener('pagehide', () => {
    try {
      if (stored === null) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, stored);
    } catch { /* as above */ }
  });

  addStyle(view.root, 'lab-bench', STYLE);
  const panel = document.createElement('pre');
  panel.className = 'lab-bench';
  panel.textContent = 'fixed flight: loading';
  view.root.append(panel);

  const stops: FlightStop[] = ROUTE.map((stop) => {
    const at = typeof stop.at === 'string' ? (stop.at === 'spawn' ? sys.region?.spawn() : sys.region?.place(stop.at)?.at) ?? { x: 0, z: 0 } : { x: stop.at[0], z: stop.at[1] };
    return { name: stop.name, x: at.x + 0.5, z: at.z + 0.5, yaw: stop.yaw, pitch: stop.pitch, distance: stop.distance, hold: stop.hold * pace, travel: stop.travel * pace };
  });
  const total = flightSeconds(stops);
  const pose: FlightPose = { x: 0, z: 0, yaw: 0, pitch: 0, distance: 10, stop: 0, done: false };
  // The hero's drawn position is the point the world loads around and the camera follows. While the rules
  // stand still nothing else moves it, so the flight does.
  const hero = view.playerPosition as { x: number; y: number; z: number };

  /** Puts the hero and the camera where the flight is `t` seconds in. */
  function fly(t: number): void {
    flightPose(stops, t, pose);
    const ground = view.groundAt(pose.x, pose.z);
    hero.x = pose.x;
    hero.z = pose.z;
    hero.y = ground === ground ? ground : view.world.sim.heightAt(Math.floor(pose.x), Math.floor(pose.z)) || hero.y;
    // A leg is flown with the camera of the stop it leaves.
    const played = (ROUTE[pose.stop >= 0 ? pose.stop : legFrom(t)] as (typeof ROUTE)[number]).as === 'played';
    view.camera.setMode(played ? 'tilt' : 'free');
    if (!played) view.camera.setLook(pose.yaw * DEG, pose.pitch * DEG, pose.distance);
    view.camera.follow(hero.x, hero.y, hero.z);
    view.camera.snap();
  }

  /** The stop a leg leaves, for a moment between two stops. */
  function legFrom(t: number): number {
    let start = 0;
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i] as FlightStop;
      start += stop.hold + stop.travel;
      if (t < start) return i;
    }
    return stops.length - 1;
  }

  const placeOf = (): string => (pose.stop >= 0 ? (stops[pose.stop] as FlightStop).name : `→ ${(stops[Math.min(stops.length - 1, legFrom(shown) + 1)] as FlightStop).name}`);

  let state: 'starting' | 'leading' | 'settling' | 'flying' | 'done' = 'starting';
  let lead = 0, quiet = 0, waited = 0, warm = false;
  /** The flight's clock, and the moment of it the frame before this one drew. */
  let clock = 0, shown = -1, shownStop = -1, shownPlace = '';
  let compiled = 0, sinceText = 0, heldFrames = 0;
  const ahead: FlightPose = { x: 0, z: 0, yaw: 0, pitch: 0, distance: 10, stop: 0, done: false };

  view.onFrame((dt) => {
    if (state === 'done') return;
    if (state === 'starting') {
      // The title holds the start. The flight goes straight in, always into a new game, so every run flies the same world.
      if (!view.started) view.newGame();
      sys.time?.setWeather('clear', true);
      sys.time?.setTimeOfDay(0.5);
      state = 'leading';
      return;
    }
    if (state === 'leading') {
      lead += dt;
      if (lead < LEAD) return;
      view.setPaused('bench', true);
      state = 'settling';
      void perf.warm.start().then(() => { warm = true; });
    }
    if (state === 'settling') {
      // Stand at the first stop until its land has arrived and every shader is compiled, so the first second measures the flight and not the loading.
      fly(0);
      quiet = view.world.stats.queue === 0 ? quiet + 1 : 0;
      if (++waited < WAIT_MOST && (quiet < SETTLED || !warm)) return;
      const size = view.renderer.domElement;
      perf.flight.begin({
        page: location.pathname + location.search,
        date: new Date().toISOString(),
        gpu: perf.gpu,
        browser: navigator.userAgent,
        canvas: `${size.width} x ${size.height}`,
        devicePixelRatio: window.devicePixelRatio,
        quality: view.settings.quality,
        heldLevel: levelOf(params.get('quality')) !== null,
        flightSeconds: total,
        stops: stops.length,
        rules: 'paused: the frame times are the cost of the picture alone',
      });
      compiled = perf.costs.compiles().inDraw;
      state = 'flying';
      clock = 0;
      shown = -1;
    }

    // The frame before this one is over: its numbers are the meter's latest. It drew the flight at `shown`.
    if (shown >= 0) {
      const s = perf.snapshot, now = perf.costs.compiles().inDraw;
      const heaviest = perf.flight.frame(shown, shownPlace, shownStop >= 0 ? (stops[shownStop] as FlightStop).name : null, {
        ms: s.lastFrameMs, cpuMs: s.lastCpuMs, drawCalls: s.drawCalls, triangles: s.triangles, level: s.quality, scale: s.renderScale, compiles: now - compiled,
      });
      compiled = now;
      // The heaviest frame of a hold stands for the stop in the cost by feature.
      if (heaviest) perf.flight.features(perf.costs.read().features);
      flightPose(stops, clock, pose);
      if (pose.done) {
        perf.flight.end(QUALITY_BUDGETS[s.quality]);
        state = 'done';
        const report = perf.flight.report;
        panel.textContent = `fixed flight: done, ${report.most.frames} frames at ${s.quality}\nThe same as data: window.__game.bench()\n\n${flightTable(report)}`;
        console.info(`[bench] the fixed flight is done. window.__game.bench() has the report.\n${flightTable(report)}`);
        return;
      }
    }
    fly(clock);
    shown = clock;
    heldFrames = pose.stop >= 0 && pose.stop === shownStop ? heldFrames + 1 : 0;
    shownStop = pose.stop;
    shownPlace = placeOf();
    // The clock waits at the end of a hold until the stop has had its frames.
    flightPose(stops, clock + dt, ahead);
    if (pose.stop < 0 || heldFrames + 1 >= HOLD_FRAMES || (ahead.stop === pose.stop && !ahead.done)) clock += dt;
    sinceText += dt;
    if (sinceText >= 0.5) {
      sinceText = 0;
      panel.textContent = `fixed flight: second ${Math.floor(shown)} of ${Math.ceil(total)}, ${shownPlace}, ${perf.snapshot.quality}`;
    }
  });
}
