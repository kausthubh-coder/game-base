// Things that lie on the ground: rocks, a fallen log, a stump.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape } from '../shape.ts';

/** Stone with moss on the faces that look up. */
const MOSSY = [...RAMP.stone.slice(0, 3), ...RAMP.mossStone];

export function rock(variant: number): THREE.BufferGeometry {
  const s = new Shape(701 + variant);
  // Only the first lump of a rock casts a shadow: the small ones beside it sit in it.
  let first = true;
  const lump = (x: number, z: number, rx: number, ry: number, rz: number, mossy = false, sides = 6, rings = 2) => {
    s.blob(x, ry * 0.45, z, rx, ry, rz, mossy ? MOSSY : RAMP.stone, { floor: 0, jitter: 0.22, sides, rings, shadow: first && ry > 0.2, noise: 0.4 });
    first = false;
  };
  if (variant === 0) {
    lump(0, 0, 0.2, 0.15, 0.17, false, 5);
    lump(0.3, 0.14, 0.13, 0.1, 0.12, false, 5);
    lump(-0.1, 0.27, 0.1, 0.08, 0.1, false, 5);
  } else if (variant === 1) {
    lump(0, 0, 0.42, 0.34, 0.36);
    lump(0.4, 0.2, 0.2, 0.16, 0.2, false, 5);
  } else if (variant === 2) {
    lump(0, 0, 0.8, 0.72, 0.68, true, 7, 3);
    lump(0.72, 0.3, 0.38, 0.3, 0.34);
  } else {
    lump(0, 0, 0.78, 0.26, 0.56, true, 7);
    lump(-0.5, 0.42, 0.26, 0.16, 0.22, false, 5);
  }
  return s.done();
}

export function log(): THREE.BufferGeometry {
  const s = new Shape(733);
  // It lies along x. The cut ends are pale.
  s.at(0, 0.3, 0, { rz: -Math.PI / 2 }, () => {
    s.cyl(0, -1.05, 0, 0.3, 0.27, 2.1, 7, RAMP.bark, { cap: 'both', capTone: P.clay, flat: true });
  });
  s.tube([[0.35, 0.45, 0], [0.5, 0.8, -0.2]], [0.09, 0.06], 4, P.bark, { capTone: P.clay, flat: true });
  s.blob(-0.4, 0.55, 0.05, 0.36, 0.1, 0.24, [P.moss, P.leaf], { sides: 5, rings: 1, jitter: 0.2 });
  // Two shelf mushrooms on the side that faces you.
  for (const [x, y] of [[-0.7, 0.34], [-0.5, 0.42]] as const) {
    s.tube([[x, y, 0.27], [x, y + 0.03, 0.27]], [0.11, 0.02], 5, [P.tan, P.clay], { cap: 'start', capTone: P.cream, flat: true });
  }
  s.shadowBox(0, 0, 0, 2.1, 0.5, 0.55);
  return s.done();
}

export function stump(): THREE.BufferGeometry {
  const s = new Shape(751);
  s.cyl(0, 0, 0, 0.44, 0.36, 0.42, 7, RAMP.bark, { capTone: P.clay, flat: true });
  s.disc(0.03, 0.432, 0.02, 0.2, 6, P.tan);
  // Roots that run out into the ground.
  for (let k = 0; k < 3; k++) {
    const angle = k * 2.1 + 0.4;
    const cx = Math.cos(angle), sz = Math.sin(angle);
    s.tube([[cx * 0.3, 0.2, sz * 0.3], [cx * 0.68, 0, sz * 0.68]], [0.13, 0.05], 4, P.bark, { cap: 'none', flat: true });
  }
  // A shoot growing back.
  s.tube([[0.3, 0.3, 0.2], [0.42, 0.62, 0.3]], [0.025, 0.012], 3, RAMP.grass, { cap: 'none', flat: true });
  s.cone(0.42, 0.58, 0.3, 0.09, 0.14, 4, [P.leaf, P.lime]);
  s.shadowBox(0, 0, 0, 0.75, 0.42, 0.75);
  return s.done();
}
