// Stations: the furniture a player works at or sleeps in. Each fits in one block, or two for the bed
// and the forge, and reads from above: what it is for sits on its top.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape } from '../shape.ts';

export function workbench(): THREE.BufferGeometry {
  const s = new Shape(1201);
  s.box(0, 0.78, 0, 1.7, 0.12, 0.8, P.plankLight, { bevel: 0.02, top: P.plankPale });
  for (const x of [-0.74, 0.74]) for (const z of [-0.3, 0.3]) s.box(x, 0, z, 0.12, 0.78, 0.12, P.timber, { skip: '-y+y' });
  s.box(0, 0.2, 0, 1.5, 0.06, 0.6, P.plank);
  s.box(0, 0.9, -0.37, 1.7, 0.5, 0.05, P.plankDark, { skip: '-y' });
  // On the top: a saw, a hammer, a vise and a board being worked.
  s.box(-0.45, 0.9, 0.05, 0.5, 0.02, 0.15, P.ash, { skip: '-y' });
  s.box(-0.12, 0.9, 0.05, 0.16, 0.05, 0.13, P.oak, { skip: '-y' });
  s.at(0.3, 0.9, 0.12, 0.5, () => {
    s.box(0, 0, 0, 0.34, 0.04, 0.045, P.oakDark, { skip: '-y' });
    s.box(0.17, 0, 0, 0.09, 0.08, 0.16, P.slate, { skip: '-y' });
  });
  s.box(0.68, 0.9, 0.24, 0.18, 0.15, 0.22, P.slate, { skip: '-y' });
  s.box(0.2, 0.9, -0.18, 0.9, 0.05, 0.16, P.clay, { skip: '-y' });
  // Hanging on the back board.
  s.box(-0.5, 1.08, -0.335, 0.06, 0.26, 0.03, P.iron, { skip: '-z' });
  s.box(-0.2, 1.1, -0.335, 0.2, 0.2, 0.03, P.pewter, { skip: '-z' });
  s.shadowBox(0, 0, 0, 1.7, 0.9, 0.8);
  return s.done();
}

/** A stone hearth with live coals, a hood behind it and an anvil beside it. The coals glow by day too. */
export function forge(): THREE.BufferGeometry {
  const s = new Shape(1223);
  s.box(-0.3, 0, 0, 1.3, 0.8, 1, RAMP.stone, { bevel: 0.05, skip: '-y', grade: 0.25 });
  s.box(-0.3, 0.8, 0.08, 1, 0.05, 0.66, P.umber, { skip: '-y' });
  const hot = [P.coral, P.apricot, P.butter] as const;
  for (let k = 0; k < 6; k++) {
    s.blob(-0.62 + (k % 3) * 0.32 + s.rr(-0.05, 0.05), 0.87, -0.06 + Math.floor(k / 3) * 0.3, 0.13, 0.08, 0.12, hot, { sides: 4, rings: 1, jitter: 0.2, glow: 2, noise: 0.9 });
  }
  // The hood: a stone back wall that narrows into a flue.
  s.box(-0.3, 0.8, -0.38, 1.1, 0.75, 0.24, RAMP.stone, { skip: '-y', grade: 0.2 });
  s.box(-0.3, 1.55, -0.38, 0.5, 0.5, 0.24, P.iron, { skip: '-y' });
  // Bellows on the left.
  s.box(-1.05, 0.5, 0.1, 0.2, 0.3, 0.5, P.tan, { bevel: 0.03 });
  // The anvil, on its block.
  s.box(0.82, 0, 0.1, 0.34, 0.34, 0.34, P.timber, { skip: '-y' });
  s.box(0.82, 0.34, 0.1, 0.18, 0.16, 0.22, P.slate, { skip: '-y' });
  s.box(0.82, 0.5, 0.1, 0.24, 0.13, 0.46, P.night, { top: P.slate });
  s.at(0.82, 0.565, 0.33, { rx: Math.PI / 2 }, () => s.cone(0, 0, 0, 0.065, 0.2, 4, P.night, { turn: Math.PI / 4 }));
  s.light(-0.3, 1.0, 0.1);
  s.shadowBox(-0.3, 0, 0, 1.3, 0.8, 1);
  s.shadowBox(-0.3, 0.8, -0.38, 1.1, 1.25, 0.24);
  s.shadowBox(0.82, 0, 0.1, 0.3, 0.6, 0.46);
  return s.done();
}

/** A clay oven with an iron top, a pot on it and a pipe at the back. The fire in its mouth glows by day too. */
export function stove(): THREE.BufferGeometry {
  const s = new Shape(1249);
  s.box(0, 0, 0, 1, 0.8, 0.72, P.clay, { bevel: 0.04, skip: '-y', grade: 0.25 });
  s.box(0, 0.8, 0, 1.04, 0.06, 0.76, P.slate);
  // The fire mouth, on the front.
  s.poly([[-0.24, 0.12, 0.362], [0.24, 0.12, 0.362], [0.24, 0.46, 0.362], [0, 0.56, 0.362], [-0.24, 0.46, 0.362]], P.ink);
  s.poly([[-0.2, 0.13, 0.364], [0.2, 0.13, 0.364], [0.14, 0.26, 0.364], [0, 0.34, 0.364], [-0.14, 0.26, 0.364]], P.coral, { glow: 2 });
  s.poly([[-0.1, 0.13, 0.366], [0.1, 0.13, 0.366], [0, 0.24, 0.366]], P.butter, { glow: 2 });
  // A pot with its lid, and a pan beside it.
  s.cyl(-0.2, 0.86, 0.02, 0.19, 0.22, 0.22, 8, P.iron, { capTone: P.pewter });
  s.cyl(-0.2, 1.08, 0.02, 0.05, 0.04, 0.05, 5, P.night);
  s.cyl(0.26, 0.86, 0.08, 0.15, 0.17, 0.05, 8, P.night, { capTone: P.umber });
  s.box(0.48, 0.875, 0.08, 0.22, 0.03, 0.04, P.night);
  // The pipe.
  s.cyl(0.3, 0.86, -0.25, 0.08, 0.08, 1, 6, P.night, { capTone: P.ink });
  s.light(0, 0.4, 0.5);
  s.shadowBox(0, 0, 0, 1, 0.86, 0.72);
  return s.done();
}

/** Variants: closed, and open with gold in it. Its front faces +z. */
export function chest(variant: number): THREE.BufferGeometry {
  const s = new Shape(1277 + variant);
  s.box(0, 0, 0, 0.9, 0.44, 0.56, P.plank, { bevel: 0.03, skip: '-y', top: variant === 1 ? P.umber : P.plank });
  for (const x of [-0.3, 0.3]) s.box(x, 0, 0, 0.08, 0.45, 0.59, P.slate, { skip: '-y' });
  s.box(0, 0.26, 0.285, 0.12, 0.14, 0.03, P.butter, { skip: '-z' });
  const lid = () => {
    s.box(0, 0, 0.28, 0.92, 0.17, 0.58, P.plankDark, { bevel: 0.05, top: P.plank });
    for (const x of [-0.3, 0.3]) s.box(x, 0, 0.28, 0.08, 0.18, 0.6, P.slate, { skip: '-y' });
  };
  if (variant === 0) s.at(0, 0.44, -0.28, 0, lid);
  else {
    // The lid stands open on its back hinge, and coins fill the box.
    s.at(0, 0.44, -0.28, { rx: -1.75 }, lid);
    s.blob(0, 0.4, 0, 0.36, 0.12, 0.2, [P.ochre, P.gold, P.butter, P.lemon], { sides: 6, rings: 1, jitter: 0.25, noise: 0.9 });
  }
  s.shadowBox(0, 0, 0, 0.9, 0.6, 0.56);
  return s.done();
}

/** One block wide and two long, with the pillow toward -z. Variants: a teal blanket, a red one. */
export function bed(variant: number): THREE.BufferGeometry {
  const s = new Shape(1301 + variant);
  const blanket = variant === 0 ? [P.teal, P.tealLight] : [P.rust, P.coral];
  s.box(0, 0, 0, 1, 0.3, 1.96, P.plankDark, { skip: '-y' });
  s.box(0, 0.3, 0, 0.9, 0.16, 1.86, P.bone, { bevel: 0.04, skip: '-y' });
  s.box(0, 0.46, -0.68, 0.62, 0.1, 0.36, P.ivory, { bevel: 0.03, skip: '-y' });
  s.box(0, 0.4, 0.34, 0.94, 0.12, 1.16, blanket[0], { bevel: 0.03, skip: '-y', top: blanket[1] });
  s.box(0, 0.47, -0.2, 0.94, 0.06, 0.16, P.plasterLight, { skip: '-y' });
  s.box(0, 0, -0.98, 1, 0.9, 0.1, P.timber, { skip: '-y', top: P.plank });
  s.box(0, 0, 0.98, 1, 0.5, 0.08, P.timber, { skip: '-y', top: P.plank });
  s.shadowBox(0, 0, 0, 1, 0.5, 2);
  return s.done();
}
