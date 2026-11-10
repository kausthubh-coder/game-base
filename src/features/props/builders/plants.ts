// Small plants. They are drawn by the thousand, so each is a few dozen triangles: blades are three-sided
// spikes, flower heads are low cones. Everything above the root sways.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape, type Tone } from '../shape.ts';

/** A blade from the ground at x, z: it leans the way `angle` points and comes to a point. `bend` adds a knee. */
function blade(s: Shape, x: number, z: number, height: number, width: number, angle: number, lean: number, tone: Tone, sway: number, bend = false): void {
  const dx = Math.cos(angle) * lean, dz = Math.sin(angle) * lean;
  const turn = s.r() * 6;
  if (bend) s.tube([[x, 0, z], [x + dx * 0.35, height * 0.6, z + dz * 0.35], [x + dx, height, z + dz]], [width, width * 0.7, 0], 3, tone, { cap: 'none', flat: true, sways: [0, sway * 0.4, sway], turn });
  else s.tube([[x, 0, z], [x + dx, height, z + dz]], [width, 0], 3, tone, { cap: 'none', flat: true, sways: [0, sway], turn });
}

export function grassTuft(variant: number): THREE.BufferGeometry {
  const s = new Shape(401 + variant);
  const blades = [5, 7, 9][variant];
  const tall = [0.3, 0.4, 0.5][variant];
  for (let i = 0; i < blades; i++) {
    const angle = (i / blades) * Math.PI * 2 + s.rr(-0.4, 0.4);
    const out = s.rr(0.02, 0.1 + variant * 0.05);
    const height = tall * s.rr(0.6, 1.1);
    blade(s, Math.cos(angle) * out, Math.sin(angle) * out, height, 0.045, angle, height * s.rr(0.2, 0.55), RAMP.grass, 0.5);
  }
  return s.done();
}

export function tallGrass(): THREE.BufferGeometry {
  const s = new Shape(431);
  // Three blades with a knee among straight ones: enough to read as tall grass, at half the triangles.
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + s.rr(-0.4, 0.4);
    const out = s.rr(0.03, 0.26);
    const height = s.rr(0.6, 1.05);
    blade(s, Math.cos(angle) * out, Math.sin(angle) * out, height, 0.055, angle, height * s.rr(0.15, 0.4), RAMP.grassDry, 0.8, i % 4 === 0);
  }
  return s.done();
}

const PETALS: readonly (readonly [Tone, number])[] = [
  [[P.pearl, P.ivory], P.gold],
  [[P.gold, P.butter], P.ochre],
  [[P.rust, P.coral], P.butter],
  [[P.rose, P.blush], P.butter],
  [[P.plum, P.mauve], P.lemon],
  [[P.denim, P.sky], P.ivory],
];

/** One flower head at the top of a stem, tipped a little, with a dot in its middle. */
function flowerHead(s: Shape, x: number, y: number, z: number, r: number, petals: Tone, middle: number, sway: number): void {
  s.at(x, y, z, { rx: s.rr(-0.5, 0.5), rz: s.rr(-0.5, 0.5) }, () => {
    s.cone(0, 0, 0, r, r * 0.3, 5, petals, { sway, noise: 0.9 });
    s.cone(0, r * 0.2, 0, r * 0.38, r * 0.45, 3, middle, { sway });
  });
}

export function flower(variant: number): THREE.BufferGeometry {
  const s = new Shape(457 + variant);
  const [petals, middle] = PETALS[variant];
  for (let i = 0; i < 3; i++) {
    const angle = i * 2.2 + s.rr(-0.4, 0.4);
    const out = i === 0 ? 0 : s.rr(0.1, 0.2);
    const x = Math.cos(angle) * out, z = Math.sin(angle) * out;
    const height = s.rr(0.26, 0.46);
    const lean = s.rr(0.02, 0.1);
    const tx = x + Math.cos(angle) * lean, tz = z + Math.sin(angle) * lean;
    s.tube([[x, 0, z], [tx, height + 0.02, tz]], [0.026, 0], 3, RAMP.grass, { cap: 'none', flat: true, sways: [0, 0.5] });
    flowerHead(s, tx, height, tz, s.rr(0.085, 0.115), petals, middle, 0.5);
  }
  for (let i = 0; i < 3; i++) {
    const angle = i * 2.1 + 0.6;
    blade(s, Math.cos(angle) * 0.07, Math.sin(angle) * 0.07, s.rr(0.12, 0.2), 0.04, angle, 0.1, RAMP.grass, 0.3);
  }
  return s.done();
}

export function reeds(variant: number): THREE.BufferGeometry {
  const s = new Shape(487 + variant);
  const stalks = variant === 0 ? 7 : 6;
  for (let i = 0; i < stalks; i++) {
    const angle = (i / stalks) * Math.PI * 2 + s.rr(-0.5, 0.5);
    const out = s.rr(0.03, 0.24);
    const x = Math.cos(angle) * out, z = Math.sin(angle) * out;
    const height = s.rr(1.0, 1.7);
    const head = variant === 1 && i % 2 === 0;
    blade(s, x, z, height, 0.04, angle, height * s.rr(0.05, 0.2), RAMP.reed, 0.9, !head && i % 2 === 1);
    if (head) {
      // A cattail: a brown club near the top of a straight stalk.
      const lean = height * 0.1;
      const hx = x + Math.cos(angle) * lean * 0.8, hz = z + Math.sin(angle) * lean * 0.8;
      s.cyl(hx, height * 0.74, hz, 0.055, 0.055, 0.26, 4, P.bark, { cap: 'end', sway: 0.75, grade: 0.1 });
    }
  }
  return s.done();
}

export function lilyPad(variant: number): THREE.BufferGeometry {
  const s = new Shape(521 + variant);
  /** A round leaf lying on the water with one wedge cut out of it. */
  const pad = (x: number, z: number, r: number, turn: number, tone: number) => {
    const points: [number, number, number][] = [[x, 0.03, z]];
    for (let k = 0; k <= 8; k++) {
      const angle = turn - 0.3 - (k / 8) * (Math.PI * 2 - 0.6);
      points.push([x + Math.cos(angle) * r, 0.03, z + Math.sin(angle) * r]);
    }
    s.poly(points, tone, { toward: [0, 1, 0] });
  };
  pad(0, 0, 0.42, 0.4, P.moss);
  pad(0.5, 0.28, 0.24, 2.6, P.leaf);
  if (variant === 1) {
    for (let k = 0; k < 6; k++) {
      const angle = (k / 6) * Math.PI * 2;
      s.tube([[Math.cos(angle) * 0.04, 0.04, Math.sin(angle) * 0.04], [Math.cos(angle) * 0.17, 0.15, Math.sin(angle) * 0.17]], [0.06, 0], 3, [P.rose, P.blush], { cap: 'none', flat: true });
    }
    s.cone(0, 0.04, 0, 0.06, 0.1, 5, P.butter);
  }
  return s.done();
}

/** A stem and a cap. `dots` gives the cap a rounder dome with pale spots on it. */
function shroom(s: Shape, x: number, z: number, height: number, cap: number, dome: number, tone: Tone, dots: boolean): void {
  s.cyl(x, 0, z, cap * 0.3, cap * 0.22, height, 4, [P.pearl, P.bone], { cap: 'none' });
  if (dots) s.tube([[x, height - 0.01, z], [x, height + dome * 0.55, z], [x, height + dome, z]], [cap, cap * 0.72, 0], 6, tone, { cap: 'start', capTone: P.cream, flat: true, turn: s.r() * 3 });
  else s.tube([[x, height - 0.01, z], [x, height + dome, z]], [cap, cap * 0.2], 6, tone, { cap: 'both', capTone: P.cream, flat: true, turn: s.r() * 3 });
  if (!dots) return;
  for (let k = 0; k < 4; k++) {
    const angle = k * 1.6 + s.r();
    const out = cap * 0.62;
    s.cone(x + Math.cos(angle) * out, height + dome * 0.42, z + Math.sin(angle) * out, cap * 0.16, cap * 0.14, 3, P.ivory);
  }
}

export function mushroom(variant: number): THREE.BufferGeometry {
  const s = new Shape(541 + variant);
  if (variant === 0) {
    shroom(s, 0, 0, 0.2, 0.2, 0.15, [P.brick, P.rust], true);
    shroom(s, 0.24, 0.12, 0.11, 0.11, 0.09, [P.brick, P.rust], false);
  } else if (variant === 1) {
    shroom(s, 0, 0, 0.13, 0.17, 0.07, [P.wood, P.tan], false);
    shroom(s, 0.22, -0.1, 0.09, 0.13, 0.06, [P.wood, P.tan], false);
    shroom(s, -0.12, 0.2, 0.07, 0.11, 0.05, [P.tan, P.clay], false);
  } else {
    shroom(s, 0, 0, 0.3, 0.12, 0.2, [P.mauve, P.rose], false);
    shroom(s, 0.17, 0.08, 0.2, 0.09, 0.15, [P.mauve, P.rose], false);
  }
  return s.done();
}

/** Leaf clumps that sit on the ground, under one shadow. Each entry is x, z, radius. */
function clumps(s: Shape, list: readonly (readonly [number, number, number])[], squash: number): void {
  let reach = 0;
  for (const [x, z, r] of list) {
    s.blob(x, r * squash * 0.72, z, r, r * squash, r, RAMP.bushLeaf, { floor: 0, sway: 0.3, sides: 6, rings: 2, jitter: 0.16 });
    reach = Math.max(reach, Math.hypot(x, z) + r * 0.7);
  }
  s.shadowBlob(0.05, list[0][2] * squash * 0.5, 0.05, reach, list[0][2] * squash, reach * 0.8);
}

export function bush(variant: number): THREE.BufferGeometry {
  const s = new Shape(569 + variant);
  if (variant === 0) clumps(s, [[0, 0, 0.55], [0.45, 0.2, 0.4], [-0.35, 0.3, 0.36]], 0.9);
  else if (variant === 1) clumps(s, [[-0.5, 0, 0.45], [0.1, -0.1, 0.52], [0.65, 0.1, 0.4], [0.1, 0.4, 0.34]], 0.7);
  else {
    const list: [number, number, number][] = [[0, 0, 0.5], [0.42, -0.15, 0.42], [-0.3, 0.32, 0.38]];
    clumps(s, list, 0.9);
    // Blossom: small pale cones sitting on the leaves.
    for (let k = 0; k < 7; k++) {
      const [x, z, r] = list[k % 3];
      const angle = k * 2.1, tilt = s.rr(0.2, 0.9);
      const out = Math.sin(tilt) * r, up = r * 0.9 * (0.72 + Math.cos(tilt) * 0.9);
      s.cone(x + Math.cos(angle) * out, up, z + Math.sin(angle) * out, 0.09, 0.06, 5, k % 2 ? [P.rose, P.blush] : [P.pearl, P.ivory], { sway: 0.3, noise: 0.8 });
    }
  }
  return s.done();
}

export function berryBush(): THREE.BufferGeometry {
  const s = new Shape(601);
  const list: [number, number, number][] = [[0, 0, 0.5], [0.4, 0.2, 0.4], [-0.38, 0.22, 0.36]];
  clumps(s, list, 0.95);
  for (let k = 0; k < 7; k++) {
    const [x, z, r] = list[k % 3];
    const angle = k * 1.9, tilt = s.rr(0.3, 1.2);
    const out = Math.sin(tilt) * r * 0.98, up = r * 0.95 * (0.72 + Math.cos(tilt) * 0.9);
    s.blob(x + Math.cos(angle) * out, up, z + Math.sin(angle) * out, 0.07, 0.07, 0.07, [P.brick, P.rust, P.coral], { sides: 4, rings: 1, jitter: 0, sway: 0.3 });
  }
  return s.done();
}
