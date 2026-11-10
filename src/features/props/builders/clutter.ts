import { TownShape } from './town-shape.ts';
// Clutter: the things that make a yard look used. A barrel, a crate, a cart, a sack.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape } from '../shape.ts';

/** Variants: closed, and open with water in it. */
export function barrel(variant: number): THREE.BufferGeometry {
  const s = new TownShape(1101 + variant);
  s.tube([[0, 0, 0], [0, 0.3, 0], [0, 0.62, 0], [0, 0.92, 0]], [0.3, 0.37, 0.37, 0.3], 10, RAMP.plank, { cap: variant === 0 ? 'end' : 'none', capTone: P.plankLight });
  for (const [y, r] of [[0.14, 0.345], [0.7, 0.36]] as const) s.cyl(0, y, 0, r, r, 0.07, 10, P.slate, { cap: 'none' });
  if (variant === 1) {
    s.cyl(0, 0.66, 0, 0.33, 0.28, 0.26, 10, P.plankDark, { cap: 'none', inside: true });
    s.disc(0, 0.8, 0, 0.3, 10, P.denim);
  }
  s.shadowBlob(0, 0.46, 0, 0.36, 0.46, 0.36);
  return s.done();
}

/** A plank box with a post at each corner. `brace` adds the crossed boards on two sides. */
function oneCrate(s: Shape, size: number, brace: boolean): void {
  const half = size / 2;
  s.box(0, 0, 0, size, size, size, P.plankLight, { bevel: brace ? 0.03 : 0, skip: '-y', top: P.plankPale });
  for (const x of [-half, half]) for (const z of [-half, half]) s.box(x, 0, z, 0.11, size + 0.02, 0.11, P.plankDark, { skip: '-y' });
  if (!brace) return;
  for (const z of [-half - 0.012, half + 0.012]) {
    s.at(0, half, z, { rz: Math.PI / 4 }, () => s.box(0, -0.045, 0, size * 1.25, 0.09, 0.03, P.plank, { skip: '+x-x' }));
  }
  for (const x of [-half * 0.45, half * 0.45]) s.box(x, size, 0, 0.12, 0.025, size - 0.1, P.plank, { skip: '-y' });
}

/** Variants: one crate, and a stack of three. */
export function crate(variant: number): THREE.BufferGeometry {
  const s = new TownShape(1123 + variant);
  oneCrate(s, 0.8, true);
  s.shadowBox(0, 0, 0, 0.8, 0.8, 0.8);
  if (variant === 1) {
    s.at(0.06, 0.82, -0.04, 0.5, () => oneCrate(s, 0.56, false));
    s.at(0.78, 0, 0.2, -0.3, () => oneCrate(s, 0.6, false));
    s.shadowBox(0.06, 0.8, -0.04, 0.56, 0.56, 0.56, 0.5);
    s.shadowBox(0.78, 0, 0.2, 0.6, 0.6, 0.6, -0.3);
  }
  return s.done();
}

/** A hand cart that points along +x. Variants: empty, and loaded with hay. */
export function cart(variant: number): THREE.BufferGeometry {
  const s = new TownShape(1151 + variant);
  s.box(0, 0.55, 0, 1.7, 0.1, 0.96, P.plank, { top: P.plankLight });
  for (const z of [-0.45, 0.45]) s.box(0, 0.65, z, 1.7, 0.3, 0.06, P.plankDark, { skip: '-y' });
  for (const x of [-0.82, 0.82]) s.box(x, 0.65, 0, 0.06, 0.3, 0.84, P.plankDark, { skip: '-y+z-z' });
  // Two wheels on one axle, a little behind the middle.
  for (const z of [-0.57, 0.57]) {
    s.at(-0.15, 0.42, z, { rx: Math.PI / 2 }, () => {
      s.cyl(0, -0.05, 0, 0.42, 0.42, 0.1, 10, P.timber, { cap: 'both', capTone: P.plank, flat: true });
      s.cyl(0, -0.08, 0, 0.1, 0.1, 0.16, 6, P.slate, { cap: 'both' });
    });
  }
  // The shafts you pull it by, and the leg it rests on.
  for (const z of [-0.36, 0.36]) s.tube([[0.8, 0.58, z], [1.85, 0.5, z]], [0.045, 0.035], 4, P.timber, { flat: true });
  s.box(1.8, 0.47, 0, 0.06, 0.06, 0.8, P.timber);
  s.box(0.72, 0, 0, 0.08, 0.55, 0.08, P.timber, { skip: '-y+y' });
  if (variant === 1) s.blob(0, 0.86, 0, 0.78, 0.38, 0.42, RAMP.hay, { floor: 0.66, jitter: 0.2, sides: 7, rings: 2, noise: 0.5 });
  s.shadowBox(0, 0.3, 0, 1.7, 0.65, 1.2);
  return s.done();
}

/** A tied sack. It is built around the origin, so the caller can stand it up or lay it down. */
function oneSack(s: Shape): void {
  s.blob(0, 0.26, 0, 0.3, 0.36, 0.25, RAMP.burlap, { floor: 0, jitter: 0.1, sides: 6, rings: 3 });
  s.cyl(0, 0.58, 0, 0.07, 0.12, 0.1, 5, P.burlapLight, { capTone: P.burlap });
  s.cyl(0, 0.56, 0, 0.085, 0.085, 0.035, 5, P.rust, { cap: 'none' });
}

/** Variants: one sack, and a pile of three with one lying down. */
export function sack(variant: number): THREE.BufferGeometry {
  const s = new TownShape(1171 + variant);
  oneSack(s);
  s.shadowBlob(0, 0.26, 0, 0.28, 0.3, 0.24);
  if (variant === 1) {
    s.at(0.52, 0, 0.1, 1.2, () => oneSack(s));
    s.at(0.2, 0.2, 0.5, { ry: 0.4, rz: Math.PI / 2 - 0.15 }, () => oneSack(s));
    s.shadowBlob(0.4, 0.24, 0.3, 0.5, 0.28, 0.45);
  }
  return s.done();
}
