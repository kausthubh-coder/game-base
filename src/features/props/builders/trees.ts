// Trees: a trunk that never moves and clumps of leaves that sway. Each builds to the height and reach
// its entry gives in `crown`, so the scatter rules know where the top is without building anything.
import type * as THREE from 'three';
import type { PropDef } from '../../../content/props.ts';
import { P, RAMP } from '../palette.ts';
import { Shape } from '../shape.ts';

type V3 = readonly [number, number, number];

/** How much chance moves a leaf face along its ramp. High, so a clump is dappled and not one flat green. */
const DAPPLE = 0.6;

/** Leaves high in a tree move more than leaves near the trunk. */
const leafSway = (y: number, top: number) => 0.3 + 0.7 * (y / top);

function crownOf(def: PropDef, variant: number): { top: number; reach: number } {
  if (!def.crown) throw new Error(`${def.name} needs a crown for each variant`);
  return def.crown[variant];
}

export function oak(variant: number, def: PropDef): THREE.BufferGeometry {
  const s = new Shape(101 + variant);
  const { top, reach } = crownOf(def, variant);
  const trunk = top * (variant === 2 ? 0.52 : 0.44);
  const lx = s.rr(-0.3, 0.3), lz = s.rr(-0.3, 0.3);
  // A wide foot, then a slight lean up into the leaves.
  s.tube([[0, 0, 0], [0, 0.4, 0], [lx * 0.5, trunk * 0.6, lz * 0.5], [lx, trunk + 0.6, lz]], [0.5, 0.33, 0.28, 0.2], 5, RAMP.bark, { cap: 'none', flat: true });
  s.shadowBox(lx * 0.4, 0, lz * 0.4, 0.45, trunk, 0.45);
  // One big clump on top, and a ring of smaller ones around and under it.
  const big = reach * 0.74;
  const cy = top - big * 0.86;
  s.blob(lx, cy, lz, big, big * 0.8, big, RAMP.oakLeaf, { sway: leafSway(cy, top), shadow: true, noise: DAPPLE });
  // The ring casts one wide shadow between them, not one each.
  s.shadowBlob(lx, cy - big * 0.4, lz, reach * 0.86, big * 0.5, reach * 0.86);
  const count = variant === 1 ? 5 : 4;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + s.rr(-0.3, 0.3);
    const size = reach * s.rr(0.46, 0.56);
    const out = reach - size * 0.95;
    const y = cy - big * s.rr(0.25, 0.5);
    s.blob(lx + Math.cos(angle) * out, y, lz + Math.sin(angle) * out, size, size * 0.78, size, RAMP.oakLeaf, { sway: leafSway(y, top), sides: 6, rings: 2, noise: DAPPLE });
  }
  return s.done();
}

export function birch(variant: number, def: PropDef): THREE.BufferGeometry {
  const s = new Shape(211 + variant);
  const { top, reach } = crownOf(def, variant);
  const height = top * 0.8;

  /** One pale trunk with dark bands, and gold clumps up its top half. */
  const stem = (lx: number, lz: number, tall: number, thick: number, clumps: number, from: number) => {
    const at = (t: number): V3 => [lx * t * t, tall * t, lz * t * t];
    s.tube([at(0), at(0.35), at(0.7), at(1)], [thick, thick * 0.78, thick * 0.55, thick * 0.25], 5, RAMP.birchBark, { cap: 'none' });
    for (const t of [0.12, 0.3, 0.5]) {
      const p = at(t);
      const r = thick * (1 - 0.6 * t) + 0.014;
      s.cyl(p[0], p[1], p[2], r, r, 0.08, 4, P.slate, { cap: 'none', flat: true, turn: t * 9 });
    }
    s.shadowBox(lx * 0.3, 0, lz * 0.3, thick * 1.6, tall * 0.7, thick * 1.6);
    // Two shadow balls for the whole stem's leaves: a wide one low and a narrow one high.
    const low = at(from + (1 - from) * 0.3), up = at(0.92);
    s.shadowBlob(low[0], low[1] + 0.2, low[2], reach * 0.8, (tall * (1 - from)) * 0.36, reach * 0.8);
    s.shadowBlob(up[0], top - reach * 0.6, up[2], reach * 0.55, reach * 0.6, reach * 0.55);
    for (let i = 0; i < clumps; i++) {
      const t = from + ((1 - from) * i) / (clumps - 1);
      const p = at(t);
      const angle = i * 2.4 + s.rr(-0.3, 0.3);
      const size = reach * (i === clumps - 1 ? 0.62 : s.rr(0.46, 0.58)) * (variant === 1 ? 0.8 : 1);
      const out = i === clumps - 1 ? 0 : reach * 0.42;
      const y = i === clumps - 1 ? top - size * 1.05 : p[1] + s.rr(0, 0.3);
      s.blob(p[0] + Math.cos(angle) * out, y, p[2] + Math.sin(angle) * out, size, size * 0.95, size, RAMP.birchLeaf, { sway: leafSway(y, top), sides: 6, rings: 2, jitter: 0.18, noise: DAPPLE });
    }
  };

  if (variant === 1) {
    // Two trunks from one foot, leaning apart.
    stem(0.9, 0.2, height, 0.19, 3, 0.55);
    stem(-0.8, -0.3, height * 0.86, 0.16, 3, 0.6);
  } else {
    stem(s.rr(-0.5, 0.5), s.rr(-0.3, 0.3), height, variant === 2 ? 0.15 : 0.2, variant === 2 ? 4 : 5, 0.45);
  }
  return s.done();
}

export function pine(variant: number, def: PropDef): THREE.BufferGeometry {
  const s = new Shape(307 + variant);
  const { top, reach } = crownOf(def, variant);
  const bare = top * 0.14;
  const tiers = [6, 5, 4][variant];
  s.cyl(0, 0, 0, 0.27, 0.1, top * 0.72, 5, RAMP.pineBark, { cap: 'none', flat: true });
  s.shadowBox(0, 0, 0, 0.3, bare + 0.4, 0.3);
  // Skirts of needles, each one smaller than the one under it. Every second point of a rim is pulled in.
  const step = (top - bare) / (tiers + 0.6);
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1);
    const y = bare + step * i;
    const r = reach * (1 - 0.74 * f);
    const h = i === tiers - 1 ? top - y : step * 1.6;
    s.cone(0, y, 0, r, h, 9, RAMP.pineLeaf, { star: 0.3, cap: true, capTone: P.pineDeep, sway: leafSway(y + h * 0.4, top) * 0.55, turn: i * 0.7, noise: 0.7 });
  }
  const mass = top - bare;
  s.shadowBlob(0, bare + mass * 0.3, 0, reach * 0.72, mass * 0.34, reach * 0.72);
  s.shadowBlob(0, bare + mass * 0.68, 0, reach * 0.4, mass * 0.32, reach * 0.4);
  return s.done();
}
