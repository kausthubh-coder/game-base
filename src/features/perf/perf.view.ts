// The performance meter: an overlay with the numbers that say whether the game is fast, a button
// that copies them as text, the four quality levels and an automatic mode.
//
// The meter reads the renderer's counters itself. The host tells it what it cannot see: how long
// the rules took (`begin('sim')`, `end('sim')`) and the world's numbers (`counters`).
import type { ViewContext, ViewSystem } from '../../engine/system.ts';
import type { Quality } from '../../engine/types.ts';
import type { Level } from '../../content/quality.ts';
import { Governor, type GovernorOptions } from './governor.sim.ts';
import { createPerfPanel } from './perf.ui.ts';
import { FrameStats } from './stats.sim.ts';

export type PerfSlot = 'frame' | 'sim';

export interface PerfOptions {
  /** Where the panel goes. The page body by default. */
  parent?: HTMLElement;
  /** Start in automatic mode. True by default. */
  auto?: boolean;
  /** Called when the quality level changes, by hand or automatically. Pass it on to every view system. */
  onQuality?: (quality: Quality) => void;
  governor?: Partial<GovernorOptions>;
}

/** Numbers the host fills in every frame. The meter only shows them. */
export interface PerfCounters {
  chunks: number;
  meshQueue: number;
  /** Main-thread milliseconds of chunk work this frame. */
  meshMs: number;
}

export interface PerfSnapshot {
  fps: number;
  low1Fps: number;
  /** Milliseconds between frames, and milliseconds of script in a frame. */
  frameMs: number;
  scriptMs: number;
  simMs: number;
  meshMs: number;
  drawCalls: number;
  triangles: number;
  chunks: number;
  meshQueue: number;
  geometries: number;
  textures: number;
  /** JavaScript heap in megabytes, or -1 where the browser does not tell. */
  heapMb: number;
  quality: Level;
  renderScale: number;
  auto: boolean;
}

export interface PerfView extends ViewSystem {
  readonly counters: PerfCounters;
  /** The latest numbers. The same object every time. */
  readonly snapshot: PerfSnapshot;
  /** `?stress=N` from the address, 1 when absent. Multiply the view distance by it. */
  readonly stress: number;
  readonly quality: Level;
  /** Start and stop a timer. Wrap the whole frame in 'frame' and the rules in 'sim'. */
  begin(slot: PerfSlot): void;
  end(slot: PerfSlot): void;
  /** 'auto' or a level to hold. */
  setMode(mode: 'auto' | Level): void;
  /** The text the copy button copies. */
  report(): string;
}

const fixed = (v: number, digits = 1): string => v.toFixed(digits);

export function createPerf(ctx: ViewContext, options: PerfOptions = {}): PerfView {
  const renderer = ctx.renderer;
  // The meter adds up every render pass of a frame, so it resets the counters itself.
  renderer.info.autoReset = false;
  const basePixelRatio = renderer.getPixelRatio();
  const stats = new FrameStats(600);
  const script = new FrameStats(120), sim = new FrameStats(120);
  const governor = new Governor(options.governor);
  const counters: PerfCounters = { chunks: 0, meshQueue: 0, meshMs: 0 };
  const snapshot: PerfSnapshot = {
    fps: 0, low1Fps: 0, frameMs: 0, scriptMs: 0, simMs: 0, meshMs: 0, drawCalls: 0, triangles: 0, chunks: 0, meshQueue: 0,
    geometries: 0, textures: 0, heapMb: -1, quality: ctx.quality, renderScale: 1, auto: options.auto !== false,
  };
  const stress = Math.max(0.25, Number(new URLSearchParams(location.search).get('stress')) || 1);
  const started: Record<PerfSlot, number> = { frame: 0, sim: 0 };
  let simThisFrame = 0, sinceText = 1, warmup = 3, worstMesh = 0;
  let last = performance.now();

  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));

  function apply(quality: Level, scale: number): void {
    if (scale !== snapshot.renderScale) {
      snapshot.renderScale = scale;
      renderer.setPixelRatio(basePixelRatio * scale);
    }
    if (quality !== snapshot.quality) {
      snapshot.quality = quality;
      // The engine's `Quality` names three of the four levels, so `ultra` travels under that type. See src/content/quality.ts.
      ctx.quality = quality as Quality;
      options.onQuality?.(quality as Quality);
    }
  }

  function setMode(mode: 'auto' | Level): void {
    snapshot.auto = mode === 'auto';
    if (mode === 'auto') {
      governor.reset(0);
      warmup = 2;
      apply(governor.step.quality, governor.step.scale);
    } else {
      apply(mode, 1);
    }
    panel.setMode(mode);
  }

  function report(): string {
    const s = snapshot, size = renderer.domElement;
    return [
      `game-base performance report, ${new Date().toISOString()}`,
      `page: ${location.pathname}${location.search}`,
      `gpu: ${gpu}`,
      `browser: ${navigator.userAgent}`,
      `canvas: ${size.width} x ${size.height} pixels, device pixel ratio ${fixed(devicePixelRatio, 2)}, render scale ${fixed(s.renderScale, 2)}`,
      `quality: ${s.quality}${s.auto ? ' (automatic)' : ' (held)'}, stress x${stress}`,
      `frames per second: ${fixed(s.fps)} average, ${fixed(s.low1Fps)} worst 1 percent, over ${stats.frames} frames`,
      `frame time: ${fixed(s.frameMs, 2)} ms between frames, ${fixed(s.scriptMs, 2)} ms of script`,
      `simulation: ${fixed(s.simMs, 2)} ms`,
      `chunk work: ${fixed(s.meshMs, 2)} ms this frame, ${fixed(worstMesh, 2)} ms worst frame`,
      `draw calls: ${s.drawCalls}`,
      `triangles: ${s.triangles}`,
      `chunks: ${s.chunks} loaded, ${s.meshQueue} waiting`,
      `gpu objects: ${s.geometries} geometries, ${s.textures} textures`,
      `memory: ${s.heapMb < 0 ? 'not reported by this browser' : fixed(s.heapMb) + ' MB of script heap'}`,
    ].join('\n');
  }

  async function copy(): Promise<void> {
    const text = report();
    try {
      await navigator.clipboard.writeText(text);
      panel.flash('copied');
    } catch {
      // No clipboard permission: fall back to a selected text box.
      const box = document.createElement('textarea');
      box.value = text;
      box.style.cssText = 'position:fixed;left:8px;top:8px;width:420px;height:260px;z-index:30';
      document.body.append(box);
      box.select();
      const done = document.execCommand('copy');
      if (done) box.remove();
      else box.addEventListener('blur', () => box.remove(), { once: true });
      panel.flash(done ? 'copied' : 'press Ctrl+C');
    }
  }

  const panel = createPerfPanel(options.parent ?? document.body, (mode) => setMode(mode as 'auto' | Level), () => void copy());
  panel.setMode(snapshot.auto ? 'auto' : snapshot.quality);

  return {
    counters,
    snapshot,
    stress,
    get quality() { return snapshot.quality; },

    begin(slot) {
      started[slot] = performance.now();
    },

    end(slot) {
      const ms = performance.now() - started[slot];
      if (slot === 'sim') simThisFrame += ms;
      else script.push(ms);
    },

    setMode,
    report,

    update(dt) {
      const now = performance.now();
      stats.push(now - last);
      last = now;
      sim.push(simThisFrame);
      simThisFrame = 0;

      const info = renderer.info, s = snapshot;
      s.drawCalls = info.render.calls;
      s.triangles = info.render.triangles;
      info.reset();
      s.meshMs = counters.meshMs;
      if (counters.meshMs > worstMesh) worstMesh = counters.meshMs;

      // Automatic quality reads the last half second, and waits out the first seconds while the world loads.
      if (s.auto) {
        if (warmup > 0) warmup -= dt;
        else if (governor.update(dt, stats.fps(30))) apply(governor.step.quality, governor.step.scale);
      }

      sinceText += dt;
      if (sinceText < 0.25) return;
      sinceText = 0;
      s.fps = stats.fps();
      s.low1Fps = stats.low1Fps();
      s.frameMs = stats.meanMs(60);
      s.scriptMs = script.meanMs();
      s.simMs = sim.meanMs();
      s.chunks = counters.chunks;
      s.meshQueue = counters.meshQueue;
      s.geometries = info.memory.geometries;
      s.textures = info.memory.textures;
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      s.heapMb = memory ? memory.usedJSHeapSize / 1048576 : -1;
      panel.setText(
        `${fixed(s.fps).padStart(5)} fps   ${fixed(s.low1Fps).padStart(5)} worst 1%\n`
        + `frame ${fixed(s.frameMs).padStart(5)} ms  script ${fixed(s.scriptMs).padStart(4)} ms\n`
        + `sim   ${fixed(s.simMs, 2).padStart(5)} ms  chunks ${fixed(s.meshMs).padStart(4)} ms\n`
        + `draw calls ${String(s.drawCalls).padStart(4)}   tris ${String(s.triangles).padStart(7)}\n`
        + `chunks ${String(s.chunks).padStart(4)}  waiting ${String(s.meshQueue).padStart(3)}\n`
        + `geometries ${String(s.geometries).padStart(4)}  ${s.heapMb < 0 ? 'heap n/a' : 'heap ' + fixed(s.heapMb, 0) + ' MB'}\n`
        + `${s.quality}${s.auto ? ' (auto)' : ''}  scale ${fixed(s.renderScale, 2)}${stress !== 1 ? '  stress x' + stress : ''}`,
      );
    },

    setQuality(quality) {
      // Another part of the game set the level by hand: hold it.
      setMode(quality);
    },

    dispose() {
      renderer.info.autoReset = true;
      renderer.setPixelRatio(basePixelRatio);
      panel.dispose();
    },
  };
}
