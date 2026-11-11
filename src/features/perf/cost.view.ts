// What each feature costs to draw: draw calls and triangles for the land, the grass, the trees and so on,
// so an agent knows what to cut. The renderer only counts totals.
//
// Every draw of every pass goes through `renderer.renderBufferDirect`: the scene, the sun's shadow pass and
// the final picture's passes. The meter wraps that one method, reads the renderer's own counters before and
// after each draw, and adds the difference to the feature the drawn object belongs to. So the rows always
// add up to the renderer's totals, and `read()` says so.
//
// An object's feature is the nearest of: a `tag` on it or on something it sits in, or a name in the `names`
// table. An object with neither is listed under its top-level object's name, so nothing is lumped away unseen.
//
// The same wrap sees a shader program made in the middle of a draw: the first sight of a material, which
// stalls the frame on a weak graphics chip. `compiles` counts them. Warm-up (warm.view.ts) is there to keep it at zero.
import type * as THREE from 'three';

export interface FeatureCost {
  feature: string;
  /** All of the feature's draw calls in the frame, the shadow pass included. */
  drawCalls: number;
  triangles: number;
  /** The part of those spent in the sun's shadow pass. */
  shadowCalls: number;
  shadowTriangles: number;
}

export interface CostReport {
  /** The renderer's own counters for the frame. */
  total: { drawCalls: number; triangles: number };
  /** One row a feature that drew something, the most triangles first. */
  features: FeatureCost[];
  /** The rows added up. */
  sum: { drawCalls: number; triangles: number };
  /** True when the rows add up to the totals. False would mean a draw went round the meter. */
  addsUp: boolean;
}

export interface CompileCount {
  /** Shader programs the renderer holds. */
  programs: number;
  /** Programs made in the middle of a frame's draw since the page loaded: each one a possible stall. */
  inDraw: number;
  /** The features whose draws made the latest of them, newest last: `town`, or `town (shadow pass)`. */
  latest: string[];
}

export interface CostMeter {
  /** Names features by the names of scene objects: `{ grass: 'grass', 'far-land': 'land' }`. Adds to what was named before. */
  names(table: Readonly<Record<string, string>>): void;
  /** Names the feature of one object and everything in it. */
  tag(object: THREE.Object3D, feature: string): void;
  /** The frame is over: keeps its numbers for `read()` and starts counting the next. Call it where the renderer's totals are read. */
  latch(): void;
  /** The last latched frame by feature. It makes new objects, so call it when asked and not every frame. */
  read(): CostReport;
  compiles(): CompileCount;
  /** Runs `fn` without counting the programs its draws make: for a warm-up, which draws in order to make them. */
  quietly(fn: () => void): void;
  dispose(): void;
}

/** Draws that belong to no object of the scene: the final picture's passes. */
const PASSES = 'final picture';
const OTHER = 'other';
/** The most features. One past it is counted as `other`. */
const MOST = 96;
/** How many of the latest in-draw compiles are remembered. */
const REMEMBER = 12;

type Draw = THREE.WebGLRenderer['renderBufferDirect'];

export function createCostMeter(renderer: THREE.WebGLRenderer, scene: THREE.Scene): CostMeter {
  const info = renderer.info;
  const labels: string[] = [OTHER];
  const slots = new Map<string, number>([[OTHER, 0]]);
  const byName = new Map<string, string>();
  const tags = new WeakMap<THREE.Object3D, string>();
  /**
   * The slot of every object of the scene drawn so far. Thrown away when a name or a tag is added. An object drawn
   * outside the scene is looked up again each time: a tree photographed for its far picture joins the scene afterwards.
   */
  let known = new WeakMap<THREE.Object3D, number>();

  // The frame being drawn, and the last whole one.
  const calls = new Float64Array(MOST), triangles = new Float64Array(MOST), shadowCalls = new Float64Array(MOST), shadowTriangles = new Float64Array(MOST);
  const shown = { calls: new Float64Array(MOST), triangles: new Float64Array(MOST), shadowCalls: new Float64Array(MOST), shadowTriangles: new Float64Array(MOST), totalCalls: 0, totalTriangles: 0 };
  /** The renderer's call counter after the last draw. A lower one before the next draw means the counters were reset. */
  let lastCalls = 0;
  let inDraw = 0, quiet = false;
  const latest: string[] = [];

  function clear(): void {
    calls.fill(0); triangles.fill(0); shadowCalls.fill(0); shadowTriangles.fill(0);
  }

  function slotOf(feature: string): number {
    let slot = slots.get(feature);
    if (slot === undefined) {
      if (labels.length >= MOST) return 0;
      slot = labels.length;
      labels.push(feature);
      slots.set(feature, slot);
    }
    return slot;
  }

  function resolve(object: THREE.Object3D): number {
    let feature: string | undefined, root = object, top = object;
    for (let o: THREE.Object3D | null = object; o; o = o.parent) {
      if (feature === undefined) feature = tags.get(o) ?? (o.name ? byName.get(o.name) : undefined);
      if (o.parent === scene) top = o;
      root = o;
    }
    if (root !== scene) return slotOf(PASSES);
    const slot = slotOf(feature ?? (top.name ? `${OTHER}: ${top.name}` : OTHER));
    known.set(object, slot);
    return slot;
  }

  const draw = renderer.renderBufferDirect;
  const counted: Draw = function (this: THREE.WebGLRenderer, camera, drawnScene, geometry, material, object, group) {
    const render = info.render, callsBefore = render.calls, trianglesBefore = render.triangles;
    const programsBefore = info.programs ? info.programs.length : 0;
    // Whoever draws the frame resets the renderer's counters first. The rows start again with them.
    if (callsBefore < lastCalls) clear();
    draw.call(this, camera, drawnScene, geometry, material, object, group);
    lastCalls = render.calls;
    const slot = known.get(object) ?? resolve(object);
    const dCalls = render.calls - callsBefore, dTriangles = render.triangles - trianglesBefore;
    calls[slot] += dCalls;
    triangles[slot] += dTriangles;
    // The shadow pass hands its draws no scene.
    if (drawnScene === null) {
      shadowCalls[slot] += dCalls;
      shadowTriangles[slot] += dTriangles;
    }
    if (!quiet && info.programs && info.programs.length > programsBefore) {
      inDraw += info.programs.length - programsBefore;
      latest.push(drawnScene === null ? `${labels[slot] as string} (shadow pass)` : (labels[slot] as string));
      if (latest.length > REMEMBER) latest.shift();
    }
  };
  renderer.renderBufferDirect = counted;

  return {
    names(table) {
      for (const name of Object.keys(table)) byName.set(name, table[name] as string);
      known = new WeakMap();
    },

    tag(object, feature) {
      tags.set(object, feature);
      known = new WeakMap();
    },

    latch() {
      shown.calls.set(calls); shown.triangles.set(triangles); shown.shadowCalls.set(shadowCalls); shown.shadowTriangles.set(shadowTriangles);
      shown.totalCalls = info.render.calls;
      shown.totalTriangles = info.render.triangles;
      clear();
      lastCalls = 0;
    },

    read() {
      const features: FeatureCost[] = [];
      const sum = { drawCalls: 0, triangles: 0 };
      for (let slot = 0; slot < labels.length; slot++) {
        const drawCalls = shown.calls[slot] as number, tris = shown.triangles[slot] as number;
        if (drawCalls === 0 && tris === 0) continue;
        features.push({ feature: labels[slot] as string, drawCalls, triangles: tris, shadowCalls: shown.shadowCalls[slot] as number, shadowTriangles: shown.shadowTriangles[slot] as number });
        sum.drawCalls += drawCalls;
        sum.triangles += tris;
      }
      features.sort((a, b) => b.triangles - a.triangles || b.drawCalls - a.drawCalls);
      const total = { drawCalls: shown.totalCalls, triangles: shown.totalTriangles };
      return { total, features, sum, addsUp: sum.drawCalls === total.drawCalls && sum.triangles === total.triangles };
    },

    compiles() {
      return { programs: info.programs ? info.programs.length : 0, inDraw, latest: [...latest] };
    },

    quietly(fn) {
      const before = quiet;
      quiet = true;
      try {
        fn();
      } finally {
        quiet = before;
      }
    },

    dispose() {
      if (renderer.renderBufferDirect === counted) renderer.renderBufferDirect = draw;
    },
  };
}
