// The small things of the wild kinds of land, scattered in numbers by the painted world's wilds (WILDS in
// src/content/painted.ts): ferns and surface roots in the Old Forest, fallen logs, grey grass in the grey
// forest, bulrushes and stepping stones in the marsh, scree on the cave hills. Each is small and cheap; the big
// set pieces (giant roots, boulders, fallen giants, crystals) are landmarks of their own.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape } from '../shape.ts';

/** A fern: fronds that arch out from one crown, each a stem with leaflets in pairs along it. */
export function fern(variant: number): THREE.BufferGeometry {
  const s = new Shape(811 + variant);
  const fronds = variant === 0 ? 7 : 5;
  const reach = variant === 0 ? 0.75 : 0.55;
  for (let i = 0; i < fronds; i++) {
    const angle = (i / fronds) * Math.PI * 2 + s.rr(-0.3, 0.3), len = reach * s.rr(0.8, 1.15), rise = len * s.rr(0.55, 0.8);
    const dx = Math.cos(angle), dz = Math.sin(angle);
    // The stem rises, arches over and its tip droops toward the ground.
    const at = (t: number): [number, number, number] => [dx * len * t, rise * Math.sin(t * Math.PI * 0.8) + 0.02, dz * len * t];
    s.tube([at(0), at(0.45), at(1)], [0.02, 0.014, 0], 3, RAMP.pineBark, { cap: 'none', flat: true, sways: [0, 0.35, 0.7] });
    // Leaflets in pairs, longest in the middle of the frond.
    for (let k = 1; k <= 4; k++) {
      const t = k / 5, [x, y, z] = at(t), size = 0.2 * Math.sin(t * Math.PI) + 0.05;
      for (const side of [-1, 1]) {
        const sx = -dz * side, sz = dx * side;
        s.poly([[x, y, z], [x + sx * size + dx * 0.06, y - 0.03, z + sz * size + dz * 0.06], [x + dx * 0.12, y - 0.01, z + dz * 0.12]], k % 2 ? RAMP.oakLeaf : RAMP.bushLeaf, { two: true, sway: 0.4 + t * 0.3 });
      }
    }
  }
  return s.done();
}

/** An old tree's root breaking the ground: an arch of bark (`arch`) or a long low coil with moss on it (`coil`). */
export function surfaceRoot(variant: number): THREE.BufferGeometry {
  const s = new Shape(831 + variant);
  if (variant === 0) {
    s.tube([[-1.3, 0.02, 0], [-0.7, 0.42, 0.08], [0.1, 0.55, -0.05], [0.8, 0.3, 0.06], [1.3, 0.02, 0]], [0.2, 0.24, 0.22, 0.18, 0.12], 6, RAMP.bark, { cap: 'none' });
    s.blob(-0.1, 0.72, 0, 0.32, 0.08, 0.2, [P.moss, P.leaf], { sides: 5, rings: 1, jitter: 0.2 });
    s.tube([[0.4, 0.4, 0.05], [0.75, 0.05, 0.4]], [0.07, 0.03], 4, P.bark, { flat: true });
    s.shadowBox(0, 0, 0, 2.4, 0.6, 0.45);
  } else {
    s.tube([[-1.5, 0.05, -0.3], [-0.8, 0.2, 0.1], [0, 0.26, -0.15], [0.7, 0.2, 0.25], [1.4, 0.04, 0]], [0.16, 0.22, 0.24, 0.18, 0.1], 6, RAMP.pineBark, { cap: 'none' });
    s.blob(-0.6, 0.38, 0.05, 0.4, 0.08, 0.22, [P.moss, P.leaf], { sides: 5, rings: 1, jitter: 0.25 });
    s.blob(0.6, 0.38, 0.18, 0.28, 0.07, 0.18, [P.moss, P.lime], { sides: 5, rings: 1, jitter: 0.25 });
    s.shadowBox(0, 0, 0, 2.8, 0.35, 0.6);
  }
  return s.done();
}

/** A fallen trunk, long and mossy along its top, a broken stub of a bough on it and a fern at one end. */
export function fallenLog(): THREE.BufferGeometry {
  const s = new Shape(851);
  // It lies along x, a little sunk into the ground.
  s.at(0, 0.36, 0, { rz: -Math.PI / 2 }, () => {
    s.cyl(0, -1.9, 0, 0.42, 0.34, 3.8, 7, RAMP.bark, { cap: 'both', capTone: P.clay, flat: true });
  });
  s.blob(-0.4, 0.74, 0, 1.3, 0.12, 0.3, [P.moss, P.leaf, P.lime], { sides: 6, rings: 1, jitter: 0.25 });
  s.blob(1.2, 0.72, 0.05, 0.5, 0.1, 0.24, [P.moss, P.leaf], { sides: 5, rings: 1, jitter: 0.25 });
  s.tube([[0.6, 0.6, 0.1], [0.9, 1.05, 0.35]], [0.12, 0.07], 5, P.bark, { capTone: P.clay, flat: true });
  for (const [x, z] of [[-1.3, 0.38], [-0.9, 0.42], [1.5, 0.36]] as const) {
    s.tube([[x, 0.3, z], [x, 0.33, z]], [0.12, 0.02], 5, [P.tan, P.clay], { cap: 'start', capTone: P.cream, flat: true });
  }
  s.shadowBox(0, 0, 0, 3.8, 0.75, 0.85);
  return s.done();
}

/** Dry grey grass of the grey forest: thin pale blades and seed stalks, still. */
export function greyGrass(): THREE.BufferGeometry {
  const s = new Shape(871);
  const tones = [P.straw, P.hay, P.ash] as const;
  for (let i = 0; i < 11; i++) {
    const angle = (i / 11) * Math.PI * 2 + s.rr(-0.3, 0.3), out = s.rr(0.02, 0.18), h = s.rr(0.35, 0.75), lean = h * s.rr(0.1, 0.4);
    const x = Math.cos(angle) * out, z = Math.sin(angle) * out;
    s.tube([[x, 0, z], [x + Math.cos(angle) * lean * 0.4, h * 0.6, z + Math.sin(angle) * lean * 0.4], [x + Math.cos(angle) * lean, h, z + Math.sin(angle) * lean]], [0.03, 0.02, 0], 3, tones[i % 3] as number, { cap: 'none', flat: true, sways: [0, 0.1, 0.2] });
  }
  return s.done();
}

/** Bulrushes: tall straight blades with brown heads (`rushes`), or a clump of flag leaves with a yellow flower (`flag`). */
export function bulrush(variant: number): THREE.BufferGeometry {
  const s = new Shape(891 + variant);
  const stalks = variant === 0 ? 8 : 7;
  for (let i = 0; i < stalks; i++) {
    const angle = (i / stalks) * Math.PI * 2 + s.rr(-0.5, 0.5), out = s.rr(0.04, 0.3), x = Math.cos(angle) * out, z = Math.sin(angle) * out;
    const h = variant === 0 ? s.rr(1.3, 2.0) : s.rr(0.8, 1.25), lean = h * s.rr(0.04, 0.16);
    const tx = x + Math.cos(angle) * lean, tz = z + Math.sin(angle) * lean;
    s.tube([[x, 0, z], [x + (tx - x) * 0.5, h * 0.55, z + (tz - z) * 0.5], [tx, h, tz]], [variant === 0 ? 0.035 : 0.06, variant === 0 ? 0.028 : 0.04, 0], 3, RAMP.reed, { cap: 'none', flat: true, sways: [0, 0.4, 0.85] });
    if (variant === 0 && i % 3 === 0) s.cyl(x + (tx - x) * 0.8, h * 0.68, z + (tz - z) * 0.8, 0.06, 0.06, 0.3, 5, [P.bark, P.wood], { cap: 'end', sway: 0.7 });
  }
  if (variant === 1) {
    s.at(0.1, 0.95, 0.05, { rx: 0.3 }, () => {
      s.cone(0, 0, 0, 0.11, 0.09, 5, [P.gold, P.butter], { sway: 0.7 });
      s.cone(0, 0.03, 0, 0.04, 0.06, 3, P.ochre, { sway: 0.7 });
    });
  }
  return s.done();
}

/** A flat stone just above the water of a marsh pool, to step on: one round (`round`), or two side by side (`pair`). */
export function steppingStone(variant: number): THREE.BufferGeometry {
  const s = new Shape(911 + variant);
  s.blob(0, 0.06, 0, 0.42, 0.14, 0.36, RAMP.mossStone, { floor: 0, jitter: 0.12, sides: 7, rings: 2, shadow: true, noise: 0.3 });
  if (variant === 1) s.blob(0.72, 0.05, 0.22, 0.3, 0.11, 0.28, RAMP.stone, { floor: 0, jitter: 0.14, sides: 6, rings: 2, noise: 0.3 });
  return s.done();
}

/** Scree: a spill of broken stones, flat and sharp, lying where a rock shelf has crumbled. */
export function scree(): THREE.BufferGeometry {
  const s = new Shape(931);
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4, out = i === 0 ? 0 : s.rr(0.25, 0.75), size = i === 0 ? 0.26 : s.rr(0.08, 0.18);
    s.blob(Math.cos(angle) * out, size * 0.3, Math.sin(angle) * out, size * s.rr(1, 1.4), size * 0.6, size, RAMP.stone, { floor: 0, jitter: 0.3, sides: 5, rings: 1, noise: 0.5 });
  }
  return s.done();
}
