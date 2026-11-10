// Pastoral valley pieces. All geometry merges into the shared instanced prop material.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape } from '../shape.ts';

/** Two-block fence section, with broad rails visible above meadow grass. */
export function pastureFence(): THREE.BufferGeometry {
  const s = new Shape(1301);
  for (const x of [-1, 1]) {
    s.box(x, 0, 0, .2, 1.12, .2, P.timber, { bevel: .025, skip: '-y' });
    s.cone(x, 1.12, 0, .15, .12, 4, P.plankLight, { turn: Math.PI / 4 });
  }
  for (const y of [.35, .79]) s.box(0, y, 0, 2, .16, .12, P.plankLight);
  s.at(0, .61, .03, { rz: .32 }, () => s.box(0, -.06, 0, 1.9, .12, .1, P.plank));
  s.shadowBox(0, 0, 0, 2.2, 1.2, .2);
  return s.done();
}

/** A three-block stream span. Deck runs along z; caller provides collision. */
export function footbridge(): THREE.BufferGeometry {
  const s = new Shape(1303);
  for (const x of [-.6, .6]) s.box(x, 0, 0, .16, .24, 3.2, P.timber);
  for (let i = 0; i < 8; i++) s.box(0, .24, -1.4 + i * .4, 1.5, .12, .38, i % 2 ? P.plank : P.plankLight);
  for (const x of [-.7, .7]) {
    for (const z of [-1.4, 1.4]) s.box(x, .36, z, .14, .95, .14, P.timber);
    s.box(x, 1.15, 0, .14, .14, 3.1, P.plankLight);
  }
  s.shadowBox(0, .2, 0, 1.5, .2, 3.2);
  return s.done();
}

/** A cut oak with roots and an uneven moss cap, rather than a smooth cylinder. */
export function mossStump(): THREE.BufferGeometry {
  const s = new Shape(1307);
  s.cyl(0, 0, 0, .48, .34, .62, 7, RAMP.bark, { capTone: P.plankLight, flat: true });
  s.disc(0, .625, 0, .23, 7, P.plank);
  s.disc(0, .63, 0, .12, 7, P.plankPale);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    s.tube([[Math.cos(a) * .65, .04, Math.sin(a) * .65], [Math.cos(a) * .3, .3, Math.sin(a) * .3]], [.12, .16], 4, P.bark, { cap: 'both' });
    s.blob(Math.cos(a) * .29, .57, Math.sin(a) * .29, .23, .1, .19, RAMP.bushLeaf, { sides: 5, rings: 1, jitter: .12 });
  }
  s.shadowBlob(0, .25, 0, .5, .3, .5);
  return s.done();
}

/** Five warm meadow blooms, with grounded leaves and swaying flower heads. */
export function wildflowers(): THREE.BufferGeometry {
  const s = new Shape(1311);
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4, x = Math.cos(a) * .32, z = Math.sin(a) * .32, h = .32 + i * .045;
    s.tube([[x, 0, z], [x + .03, h, z]], [.025, .018], 4, P.moss, { cap: 'none', sways: [0, .3] });
    s.blob(x, .07, z, .15, .07, .12, RAMP.bushLeaf, { sides: 4, rings: 1 });
    s.cone(x + .03, h, z, .13, .06, 5, i % 2 ? [P.gold, P.butter] : [P.rose, P.blush], { sway: .5 });
    s.disc(x + .03, h + .065, z, .045, 5, P.butter, { sway: .5 });
  }
  return s.done();
}

/** Bound square hay with broad top strands and two rope straps. */
export function hayBale(): THREE.BufferGeometry {
  const s = new Shape(1319);
  s.box(0, 0, 0, 1.15, .7, .8, RAMP.hay, { bevel: .07, skip: '-y' });
  for (const x of [-.33, .33]) {
    s.box(x, .7, 0, .055, .035, .81, P.burlap);
    for (const z of [-.405, .405]) s.box(x, .03, z, .055, .67, .03, P.burlap);
  }
  for (let i = 0; i < 5; i++) s.box(-.45 + i * .22, .705, .02, .04, .018, .55, P.butter);
  s.shadowBox(0, 0, 0, 1.15, .7, .8);
  return s.done();
}

/** A low produce stand for the square; saffron canopy leaves the seller visible. */
export function harvestStall(): THREE.BufferGeometry {
  const s = new Shape(1321);
  s.box(0, .68, 0, 1.9, .14, .85, P.plankLight, { bevel: .025 });
  for (const x of [-.84, .84]) for (const z of [-.33, .33]) s.box(x, 0, z, .12, 2.05, .12, P.timber, { skip: '-y' });
  for (let i = 0; i < 5; i++) {
    const x = -1.1 + i * .44;
    s.poly([[x, 1.95, .65], [x + .44, 1.95, .65], [x + .44, 2.3, -.55], [x, 2.3, -.55]], i % 2 ? P.plasterLight : P.gold, { two: true });
    s.poly([[x, 1.78, .65], [x + .44, 1.78, .65], [x + .44, 1.95, .65], [x, 1.95, .65]], i % 2 ? P.plasterLight : P.gold, { two: true, sways: [.3, .3, 0, 0] });
  }
  for (const x of [-.5, .5]) {
    s.box(x, .82, 0, .7, .14, .6, P.plankDark, { top: P.soil });
    for (const z of [-.15, .15]) s.blob(x, 1.02, z, .25, .13, .14, x < 0 ? [P.rust, P.coral] : [P.moss, P.leaf], { sides: 5, rings: 1 });
  }
  s.shadowBox(0, 1.95, 0, 2.2, .3, 1.2);
  return s.done();
}
