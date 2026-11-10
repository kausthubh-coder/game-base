import { TownShape } from './town-shape.ts';
// Town pieces. Things fixed to a wall (door, window, sign, awning) have their middle on the wall's
// outer face at x = 0, z = 0, and their front toward +z, away from the wall.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape } from '../shape.ts';

const PLANKS = [P.plank, P.plankDark, P.plankLight, P.plank];
const UP = [0, 1, 0] as const;

/** A door leaf of upright planks with two iron straps. It is hinged at x = 0 and reaches along +x. */
function leaf(s: Shape, wide: number, tall: number): void {
  const count = Math.round(wide / 0.19);
  const each = wide / count;
  for (let i = 0; i < count; i++) s.box(each * (i + 0.5), 0, 0, each - 0.012, tall, 0.07, PLANKS[i % 4], { skip: '-y', grade: 0.2 });
  for (const y of [tall * 0.16, tall * 0.78]) s.box(wide / 2, y, 0, wide - 0.02, 0.07, 0.1, P.slate);
}

/** Variants: closed, open (swung out), and a barn's two tall leaves folded back against the wall. */
export function door(variant: number): THREE.BufferGeometry {
  const s = new TownShape(801 + variant);
  if (variant === 2) {
    // It fills an opening two blocks wide and three high. The braces are thick enough to show on both faces.
    const barnLeaf = () => {
      leaf(s, 1, 2.9);
      s.at(0.5, 1.36, 0, { rz: 1.12 }, () => s.box(0, -0.045, 0, 1.9, 0.09, 0.11, P.plankDark));
    };
    s.at(-1, 0, 0.05, -(Math.PI - 0.22), barnLeaf);
    s.at(1, 0, 0.05, -0.22, barnLeaf);
    return s.done();
  }
  for (const x of [-0.43, 0.43]) s.box(x, 0, -0.06, 0.14, 2, 0.2, P.timber, { skip: '-y' });
  s.box(0, 1.86, -0.06, 0.72, 0.14, 0.2, P.timber, { skip: '+x-x' });
  s.box(0, 0, 0.16, 1, 0.05, 0.3, RAMP.stone, { skip: '-y' });
  s.at(-0.36, 0, -0.06, variant === 1 ? -1.75 : 0, () => {
    leaf(s, 0.72, 1.86);
    s.box(0.62, 0.9, 0, 0.05, 0.12, 0.14, P.butter);
  });
  return s.done();
}

/** It covers the outer face of one glass block. The glass glows when it is dark. */
export function townWindow(variant: number): THREE.BufferGeometry {
  const s = new TownShape(829 + variant);
  s.box(0, 0, 0.04, 1.06, 0.1, 0.18, P.timber);
  s.box(0, 0.9, 0.02, 1, 0.1, 0.12, P.timber);
  for (const x of [-0.45, 0.45]) s.box(x, 0.1, 0.02, 0.1, 0.8, 0.12, P.timber, { skip: '+y-y' });
  s.poly([[-0.4, 0.1, 0.03], [0.4, 0.1, 0.03], [0.4, 0.9, 0.03], [-0.4, 0.9, 0.03]], P.ice, { glow: 1 });
  s.box(0, 0.1, 0.03, 0.05, 0.8, 0.05, P.timberLight, { skip: '+y-y-z' });
  s.box(0, 0.475, 0.03, 0.8, 0.05, 0.05, P.timberLight, { skip: '+x-x-z' });
  s.light(0, 0.5, 0.35);
  if (variant === 1) {
    // Shutters folded open against the wall.
    for (const side of [-1, 1]) {
      s.box(side * 0.73, 0.08, 0.035, 0.42, 0.86, 0.05, P.teal, { skip: '-z' });
      for (const y of [0.2, 0.72]) s.box(side * 0.73, y, 0.07, 0.42, 0.06, 0.03, P.tealDark, { skip: '-z' });
    }
  } else if (variant === 2) {
    s.box(0, -0.08, 0.2, 0.96, 0.2, 0.24, P.plank, { top: P.soil });
    const blooms = [[P.rust, P.coral], [P.rose, P.blush], [P.gold, P.butter]] as const;
    for (let i = 0; i < 5; i++) {
      const x = -0.36 + i * 0.18;
      s.blob(x, 0.15, 0.2, 0.1, 0.07, 0.1, [P.moss, P.leaf], { sides: 4, rings: 1 });
      s.cone(x + s.rr(-0.03, 0.03), 0.2, 0.2 + s.rr(-0.04, 0.06), 0.07, 0.07, 5, blooms[i % 3], { noise: 0.8 });
    }
  }
  return s.done();
}

export function chimney(): THREE.BufferGeometry {
  const s = new TownShape(853);
  s.box(0, 0, 0, 0.58, 1.25, 0.58, RAMP.brick, { bevel: 0.03, skip: '-y', grade: 0.25 });
  // A few stones that stand proud, so the stack is not one flat block.
  s.box(0.08, 0.25, 0.29, 0.26, 0.14, 0.04, RAMP.stone, { skip: '-z' });
  s.box(-0.1, 0.72, 0.29, 0.26, 0.14, 0.04, P.pewter, { skip: '-z' });
  s.box(0.29, 0.5, -0.05, 0.04, 0.14, 0.26, RAMP.stone, { skip: '-x' });
  s.box(-0.29, 0.9, 0.06, 0.04, 0.14, 0.26, P.pewter, { skip: '+x' });
  s.box(0, 1.25, 0, 0.72, 0.12, 0.72, P.ash);
  for (const x of [-0.15, 0.15]) s.cyl(x, 1.37, 0, 0.1, 0.085, 0.24, 6, P.rust, { capTone: P.ink });
  s.shadowBox(0, 0, 0, 0.58, 1.4, 0.58);
  return s.done();
}

/**
 * An iron arm out from the wall, a bar across its end and a board hanging under the bar, facing the
 * street. The mark goes through the board, so it shows from behind too.
 */
export function sign(variant: number): THREE.BufferGeometry {
  const s = new TownShape(877 + variant);
  s.box(0, 2.42, 0.24, 0.06, 0.06, 0.48, P.slate);
  s.tube([[0, 2.08, 0.02], [0, 2.42, 0.36]], [0.025, 0.025], 4, P.slate, { cap: 'none', flat: true });
  s.box(0, 2.42, 0.46, 0.8, 0.06, 0.06, P.slate);
  for (const x of [-0.26, 0.26]) s.box(x, 2.3, 0.46, 0.03, 0.12, 0.03, P.iron, { skip: '+y-y' });
  s.box(0, 1.72, 0.46, 0.7, 0.58, 0.08, P.plankLight, { bevel: 0.02 });
  if (variant === 0) {
    s.at(0, 2.01, 0.46, { rz: 0.6 }, () => {
      s.box(0, -0.2, 0, 0.05, 0.4, 0.12, P.oakDark);
      s.box(0, 0.1, 0, 0.26, 0.13, 0.14, P.slate);
    });
  } else if (variant === 1) {
    s.blob(0, 2.0, 0.46, 0.24, 0.13, 0.075, [P.ochre, P.gold, P.butter], { sides: 6, rings: 2, jitter: 0.05 });
  } else {
    s.blob(0, 1.93, 0.46, 0.17, 0.15, 0.075, [P.plum, P.mauve, P.rose], { sides: 6, rings: 2, jitter: 0 });
    s.box(0, 2.05, 0.46, 0.08, 0.13, 0.1, P.mist);
    s.box(0, 2.18, 0.46, 0.1, 0.04, 0.11, P.tan);
  }
  return s.done();
}

/** Striped cloth over a shop front two blocks wide, on two poles. The strip along its front edge moves in the wind. */
export function awning(variant: number): THREE.BufferGeometry {
  const s = new TownShape(907 + variant);
  const cloth = variant === 0 ? [P.teal, P.plasterLight] : [P.rust, P.plasterLight];
  const half = 1.1, back = 2.35, front = 1.9, reach = 1.1, stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const x0 = -half + (i / stripes) * half * 2, x1 = x0 + (half * 2) / stripes;
    s.poly([[x0, front, reach], [x1, front, reach], [x1, back, 0.02], [x0, back, 0.02]], cloth[i % 2], { two: true });
    s.poly([[x0, front - 0.2, reach], [x1, front - 0.2, reach], [x1, front, reach], [x0, front, reach]], cloth[i % 2], { two: true, sways: [0.35, 0.35, 0, 0], grade: 0.2 });
  }
  for (const x of [-1.04, 1.04]) s.tube([[x, 0, reach - 0.04], [x, front, reach - 0.04]], [0.04, 0.035], 4, P.timber, { cap: 'none', flat: true });
  s.shadowBox(0, 2.05, 0.55, 2.2, 0.08, 1.1);
  return s.done();
}

/** A table under a striped roof, with goods on it. Variants: produce, bread, cloth. */
export function stall(variant: number): THREE.BufferGeometry {
  const s = new TownShape(929 + variant);
  const cloth = [[P.teal, P.plasterLight], [P.rust, P.plasterLight], [P.gold, P.plasterLight]][variant];
  s.box(0, 0.74, 0, 2.2, 0.1, 1.1, P.plankLight);
  for (const x of [-1.02, 1.02]) for (const z of [-0.47, 0.47]) s.box(x, 0, z, 0.1, 2.05, 0.1, P.timber, { skip: '-y+y' });
  const eave = 2, ridge = 2.5, over = 0.8, half = 1.25, stripes = 5;
  for (let i = 0; i < stripes; i++) {
    const x0 = -half + (i / stripes) * half * 2, x1 = x0 + (half * 2) / stripes;
    s.poly([[x0, eave, over], [x1, eave, over], [x1, ridge, 0], [x0, ridge, 0]], cloth[i % 2], { two: true });
    s.poly([[x1, eave, -over], [x0, eave, -over], [x0, ridge, 0], [x1, ridge, 0]], cloth[i % 2], { two: true });
  }
  for (const x of [-half, half]) s.poly([[x, eave, over], [x, eave, -over], [x, ridge, 0]], cloth[1], { two: true });
  const top = 0.84;
  if (variant === 0) {
    // Three boxes of fruit and greens.
    const loads = [[P.brick, P.rust, P.coral], [P.moss, P.leaf, P.lime], [P.gold, P.butter, P.lemon]] as const;
    for (let i = 0; i < 3; i++) {
      const x = -0.68 + i * 0.68;
      s.box(x, top, 0, 0.56, 0.16, 0.7, P.plank, { top: P.soil });
      for (let k = 0; k < 4; k++) s.blob(x - 0.13 + (k % 2) * 0.26, top + 0.19, -0.16 + Math.floor(k / 2) * 0.32, 0.12, 0.1, 0.12, loads[i], { sides: 4, rings: 1, jitter: 0.1 });
    }
  } else if (variant === 1) {
    s.box(0, top, 0, 1.9, 0.02, 0.8, P.plasterLight, { skip: '-y' });
    // Long loaves at the back, round buns in front.
    for (let k = 0; k < 5; k++) s.blob(-0.72 + k * 0.36, top + 0.1, s.rr(-0.2, -0.1), 0.12, 0.09, 0.24, [P.gold, P.butter, P.lemon], { sides: 6, rings: 1, jitter: 0.06, noise: 0.2 });
    for (let k = 0; k < 4; k++) s.blob(-0.5 + k * 0.34, top + 0.08, 0.3, 0.11, 0.08, 0.11, [P.clay, P.peach, P.cream], { sides: 6, rings: 1, jitter: 0.06, noise: 0.2 });
  } else {
    // Rolls of cloth lying front to back, and a folded pile.
    const dyes = [P.mauve, P.tealLight, P.butter, P.rust];
    for (let k = 0; k < 3; k++) {
      s.at(-0.75 + k * 0.3, top + 0.11, 0, { rx: Math.PI / 2 }, () => s.cyl(0, -0.42, 0, 0.11, 0.11, 0.84, 6, dyes[k], { cap: 'both', capTone: P.plasterLight }));
    }
    for (let k = 0; k < 4; k++) s.box(0.55, top + k * 0.06, 0, 0.62 - k * 0.04, 0.06, 0.56 - k * 0.04, dyes[(k + 1) % 4], { skip: '-y' });
  }
  s.shadowBox(0, 0, 0, 2.2, 0.84, 1.1);
  s.shadowBox(0, 2.05, 0, 2.5, 0.3, 1.6);
  return s.done();
}

export function well(): THREE.BufferGeometry {
  const s = new TownShape(953);
  s.cyl(0, 0, 0, 0.84, 0.8, 0.7, 10, RAMP.stone, { cap: 'none', flat: true });
  s.cyl(0, 0.3, 0, 0.58, 0.58, 0.4, 10, RAMP.stone[0], { cap: 'none', flat: true, inside: true });
  for (let k = 0; k < 10; k++) {
    const a0 = (k / 10) * Math.PI * 2, a1 = ((k + 1) / 10) * Math.PI * 2;
    s.poly([[Math.cos(a0) * 0.58, 0.7, Math.sin(a0) * 0.58], [Math.cos(a0) * 0.8, 0.7, Math.sin(a0) * 0.8], [Math.cos(a1) * 0.8, 0.7, Math.sin(a1) * 0.8], [Math.cos(a1) * 0.58, 0.7, Math.sin(a1) * 0.58]], RAMP.stone[k % 2 ? 4 : 3], { toward: UP });
  }
  s.disc(0, 0.5, 0, 0.58, 10, P.denim);
  for (const x of [-0.92, 0.92]) s.box(x, 0, 0, 0.12, 2.05, 0.12, P.timber, { skip: '-y' });
  s.tube([[-0.92, 1.5, 0], [1.08, 1.5, 0]], [0.06, 0.06], 6, P.oakDark, { cap: 'both' });
  s.box(1.08, 1.34, 0, 0.05, 0.2, 0.05, P.slate);
  s.box(0.15, 1.02, 0, 0.03, 0.48, 0.03, P.burlap, { skip: '+y-y' });
  s.cyl(0.15, 0.82, 0, 0.11, 0.14, 0.22, 6, P.plank, { cap: 'none', flat: true });
  s.disc(0.15, 1.02, 0, 0.13, 6, P.umber);
  // The little roof: two slopes, each in two shades.
  for (const side of [1, -1]) {
    s.poly([[-1.15, 2, 0.8 * side], [1.15, 2, 0.8 * side], [1.15, 2.25, 0.4 * side], [-1.15, 2.25, 0.4 * side]], P.tealDark, { two: true, toward: UP });
    s.poly([[-1.15, 2.25, 0.4 * side], [1.15, 2.25, 0.4 * side], [1.15, 2.5, 0], [-1.15, 2.5, 0]], P.teal, { two: true, toward: UP });
  }
  for (const x of [-1.15, 1.15]) s.poly([[x, 2, 0.8], [x, 2, -0.8], [x, 2.5, 0]], P.plankDark, { two: true });
  s.box(0, 2.46, 0, 2.4, 0.08, 0.1, P.tealDeep);
  s.shadowBox(0, 0, 0, 1.6, 0.7, 1.6);
  s.shadowBox(0, 2.05, 0, 2.3, 0.35, 1.6);
  return s.done();
}

/** One meter of fence along x: a post at its left end and two rails. `post` is the post alone, to end a run. */
export function fence(variant: number): THREE.BufferGeometry {
  const s = new TownShape(971 + variant);
  const x = variant === 0 ? -0.5 : 0;
  s.box(x, 0, 0, 0.14, 0.92, 0.14, P.timber, { skip: '-y' });
  s.cone(x, 0.92, 0, 0.1, 0.08, 4, P.timberLight, { turn: Math.PI / 4 });
  if (variant === 0) {
    for (const y of [0.3, 0.64]) s.box(0, y, 0, 1, 0.09, 0.06, P.plank, { skip: '+x-x' });
    s.shadowBox(0, 0.2, 0, 1, 0.6, 0.08);
  }
  return s.done();
}

/** A gate one block wide between two tall posts. Variants: closed, open. */
export function gate(variant: number): THREE.BufferGeometry {
  const s = new TownShape(983 + variant);
  for (const x of [-0.5, 0.5]) {
    s.box(x, 0, 0, 0.16, 1.2, 0.16, P.timber, { skip: '-y' });
    s.cone(x, 1.2, 0, 0.12, 0.1, 4, P.timberLight, { turn: Math.PI / 4 });
  }
  s.at(-0.42, 0, 0, variant === 1 ? -1.4 : 0, () => {
    for (const y of [0.24, 0.78]) s.box(0.42, y, 0, 0.84, 0.08, 0.06, P.plank, { skip: '+x-x' });
    for (const x of [0.04, 0.8]) s.box(x, 0.18, 0, 0.07, 0.74, 0.07, P.plankDark, { skip: '-y' });
    s.at(0.42, 0.55, 0, { rz: 0.56 }, () => s.box(0, -0.035, 0, 0.9, 0.07, 0.05, P.plankLight));
  });
  s.shadowBox(0, 0.2, 0, 1, 0.7, 0.1);
  return s.done();
}

/** A wooden post with a lantern hanging from its arm. The lantern glows when it is dark. */
export function lampPost(): THREE.BufferGeometry {
  const s = new TownShape(997);
  s.box(0, 0, 0, 0.34, 0.26, 0.34, RAMP.stone, { bevel: 0.04, skip: '-y' });
  s.box(0, 0.26, 0, 0.12, 2.5, 0.12, P.timber, { skip: '-y' });
  s.box(0.3, 2.62, 0, 0.74, 0.09, 0.09, P.timber);
  s.tube([[0, 2.2, 0], [0.4, 2.62, 0]], [0.035, 0.035], 4, P.timberLight, { cap: 'none', flat: true });
  const x = 0.52;
  s.box(x, 2.48, 0, 0.025, 0.14, 0.025, P.slate, { skip: '+y-y' });
  s.cone(x, 2.37, 0, 0.23, 0.13, 4, P.slate, { turn: Math.PI / 4, cap: true });
  s.box(x, 2.07, 0, 0.26, 0.3, 0.26, P.lamp, { glow: 1, grade: 0, skip: '+y-y' });
  for (const dx of [-0.13, 0.13]) for (const dz of [-0.13, 0.13]) s.box(x + dx, 2.07, dz, 0.028, 0.3, 0.028, P.slate, { skip: '+y-y' });
  s.box(x, 2.02, 0, 0.32, 0.05, 0.32, P.slate);
  s.light(x, 2.2, 0);
  s.shadowBox(0, 0, 0, 0.14, 2.7, 0.14);
  return s.done();
}

/** A post where roads part, with a board for each way. Its first board points along +x. Variants: two ways, three ways. */
export function signpost(variant: number): THREE.BufferGeometry {
  const s = new TownShape(1013 + variant);
  s.box(0, 0, 0, 0.32, 0.16, 0.32, RAMP.stone, { bevel: 0.03, skip: '-y' });
  s.box(0, 0.16, 0, 0.14, 2.1, 0.14, P.timber, { skip: '-y' });
  s.cone(0, 2.26, 0, 0.11, 0.1, 4, P.timberLight, { turn: Math.PI / 4 });
  /** A board on the front of the post that reaches along +x and ends in a point. */
  const board = (y: number, turn: number, length: number, tone: number) => {
    s.at(0, y, 0, turn, () => {
      s.box(length / 2 - 0.14, 0, 0.1, length, 0.24, 0.06, tone);
      // A square on its corner makes the point.
      s.at(length - 0.14, 0.12, 0.1, { rz: Math.PI / 4 }, () => s.box(0, -0.085, 0, 0.17, 0.17, 0.06, tone));
    });
  };
  board(1.78, 0.08, 0.95, P.plankLight);
  board(1.42, Math.PI - 0.12, 0.85, P.plank);
  if (variant === 1) board(1.06, -Math.PI / 2 + 0.1, 0.75, P.plankPale);
  s.shadowBox(0, 0, 0, 0.14, 2.3, 0.14);
  s.shadowBox(0, 1.3, 0.1, 1.5, 0.7, 0.06);
  return s.done();
}

export function bench(): THREE.BufferGeometry {
  const s = new TownShape(1009);
  s.box(0, 0.42, 0.02, 1.5, 0.07, 0.44, P.plankLight);
  for (const y of [0.62, 0.82]) s.box(0, y, -0.2, 1.5, 0.13, 0.05, P.plank);
  for (const x of [-0.64, 0.64]) {
    s.box(x, 0, 0.02, 0.08, 0.42, 0.42, P.timber, { skip: '-y+y' });
    s.box(x, 0.42, -0.2, 0.08, 0.58, 0.07, P.timber, { skip: '-y' });
  }
  s.shadowBox(0, 0, 0, 1.5, 0.5, 0.45);
  return s.done();
}
