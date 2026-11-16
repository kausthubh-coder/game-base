// act1-kit-parts. Static previews and pivot-local geometry use the same drawing functions.
// Variants always mean working, starved, backed up. Speed belongs to the simulation.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape, type Tone } from '../shape.ts';

type V3 = [number, number, number];
const BRASS = [P.ochre, P.gold, P.butter];
const COPPER = [P.rust, P.coral, P.clay];
const STONE = [P.sandDark, P.sand, P.cream];
const wood = (
  s: Shape,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  bevel = 0,
) => s.box(x, y, z, w, h, d, RAMP.plank, { skin: 'grain', grade: 0.2, bevel: s.detail < 0.75 ? 0 : bevel });
const metal = (s: Shape, a: V3, b: V3, r = 0.075, tone: Tone = COPPER) =>
  s.tube([a, b], [r, r], 6, tone, { cap: 'both', skin: 'flat' });
const foot = (s: Shape, x = 0, z = 0, w = 0.7, d = 0.65) =>
  s.box(x, 0, z, w, 0.12, d, STONE, { skin: 'stone', bevel: s.detail < 0.75 ? 0 : 0.025 });
const socket = (s: Shape, a: V3, b: V3) => metal(s, a, b, 0.12, BRASS);
function goods(s: Shape, v: number, y: number, z: number, x = 0) {
  if (v === 1) return;
  for (let i = 0; i < (v === 2 ? 3 : 1); i++)
    s.box(x + (i - 1) * 0.13, y + i * 0.045, z, 0.18, 0.12, 0.18, STONE, { skin: 'rock' });
}
function shaft(s: Shape, slope = false, corner = false) {
  if (slope) {
    metal(s, [-0.5, 0.5, 0], [-0.38, 0.5, 0]);
    metal(s, [-0.38, 0.5, 0], [0.38, 1.5, 0]);
    metal(s, [0.38, 1.5, 0], [0.5, 1.5, 0]);
    return;
  }
  const end: V3 = corner ? [0, 0.5, 0.5] : [0.5, slope ? 1.5 : 0.5, 0];
  metal(s, [-0.5, 0.5, 0], [0, slope ? 1 : 0.5, 0]);
  metal(s, [0, slope ? 1 : 0.5, 0], end);
}
function shaftBody(s: Shape, slope = false, corner = false) {
  for (const [x, y, z] of corner
    ? [
        [-0.33, 0.5, 0],
        [0, 0.5, 0.33],
      ]
    : [
        [slope ? -0.38 : -0.33, 0.5, 0],
        [slope ? 0.38 : 0.33, slope ? 1.5 : 0.5, 0],
      ]) {
    wood(s, x, 0, z, 0.18, y + 0.12, 0.28);
    if (corner && z > 0) socket(s, [x, y, z - 0.07], [x, y, z + 0.07]);
    else socket(s, [x - 0.07, y, z], [x + 0.07, y, z]);
  }
  if (corner) s.box(0, 0.28, 0, 0.32, 0.4, 0.32, BRASS, { bevel: 0.025, skin: 'flat' });
}
function wheel(s: Shape) {
  // Two open rims, eight paddles and four spokes. Rotation axis is z.
  for (const z of [-0.2, 0.2])
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        b = ((i + 1) * Math.PI) / 6;
      s.poly(
        [
          [Math.cos(a) * 0.9, Math.sin(a) * 0.9, z],
          [Math.cos(b) * 0.9, Math.sin(b) * 0.9, z],
          [Math.cos(b) * 0.75, Math.sin(b) * 0.75, z],
          [Math.cos(a) * 0.75, Math.sin(a) * 0.75, z],
        ],
        RAMP.plank,
        { two: true, skin: 'grain' },
      );
    }
  for (let i = 0; i < 8; i++)
    s.at(0, 0, 0, { rz: (i * Math.PI) / 4 }, () => wood(s, 0, 0.72, 0, 0.19, 0.17, 0.48));
  for (let i = 0; i < 2; i++)
    s.at(0, 0, 0, { rz: (i * Math.PI) / 2 }, () => wood(s, 0, -0.76, 0, 0.1, 1.52, 0.16));
  metal(s, [0, 0, -0.25], [0, 0, 0.25], 0.16, BRASS);
}
function trough(s: Shape, rise: number, ditch = false) {
  const tone = ditch ? STONE : RAMP.plank,
    skin = ditch ? 'stone' : 'grain';
  // Exact end planes z=+/-0.5, also on sloping runs.
  for (const x of [-0.42, 0.42])
    s.mesh(
      [
        [x - 0.08, 0.05, -0.5],
        [x + 0.08, 0.05, -0.5],
        [x + 0.08, 0.3, -0.5],
        [x - 0.08, 0.3, -0.5],
        [x - 0.08, 0.05 + rise, 0.5],
        [x + 0.08, 0.05 + rise, 0.5],
        [x + 0.08, 0.3 + rise, 0.5],
        [x - 0.08, 0.3 + rise, 0.5],
      ].flat(),
      [
        0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 5, 4, 0, 1, 5, 3, 6, 2, 3, 7, 6, 0, 7, 3, 0, 4, 7, 1,
        6, 5, 1, 2, 6,
      ],
      tone,
      { skin },
    );
  s.poly(
    [
      [-0.34, 0.05, -0.5],
      [0.34, 0.05, -0.5],
      [0.34, 0.05 + rise, 0.5],
      [-0.34, 0.05 + rise, 0.5],
    ],
    ditch ? [P.soil, P.timber] : RAMP.plank,
    { two: true, skin: ditch ? 'mud' : 'grain' },
  );
  // Foot keeps sloping modules grounded at their inlet.
  if (rise) wood(s, 0, 0, 0.4, 0.6, rise * 0.9, 0.16);
}
function roof(s: Shape, y: number, width = 0.72, depth = 0.65, tone: Tone = RAMP.plank) {
  for (const sign of [-1, 1])
    s.poly(
      [
        [0, y + 0.16, -depth / 2],
        [(sign * width) / 2, y, -depth / 2],
        [(sign * width) / 2, y, depth / 2],
        [0, y + 0.16, depth / 2],
      ],
      tone,
      { two: true, skin: 'grain' },
    );
}
function lampBody(s: Shape, controlled: boolean) {
  foot(s, 0, 0, 0.38, 0.38);
  wood(s, 0, 0.12, 0, 0.14, 1.58, 0.14, 0.015);
  wood(s, 0, 1.55, 0.15, 0.14, 0.1, 0.5);
  metal(s, [0, 1.42, 0.28], [0, 1.58, 0.28], 0.035, BRASS);
  if (controlled) {
    metal(s, [-0.5, 0.5, 0], [0, 0.5, 0]);
    socket(s, [-0.16, 0.5, 0], [-0.04, 0.5, 0]);
  }
}
function lantern(s: Shape, lit: boolean) {
  s.box(0, -0.31, 0, 0.23, 0.3, 0.23, lit ? P.lamp : P.iron, { skin: 'flat', glow: lit ? 1 : 0 });
  for (const x of [-0.13, 0.13])
    for (const z of [-0.13, 0.13]) s.box(x, -0.32, z, 0.035, 0.33, 0.035, BRASS, { skin: 'flat' });
  s.lathe(
    0,
    0,
    0,
    [
      [0.2, 0],
      [0.08, 0.1],
      [0.04, 0.12],
    ],
    BRASS,
    { sides: 4, skin: 'flat' },
  );
  s.box(0, -0.36, 0, 0.3, 0.045, 0.3, BRASS, { skin: 'flat' });
  if (lit) s.light(0, -0.15, 0);
}
export const PART_KEYS = [
  'partWheel',
  'partShaft',
  'partShaftCorner',
  'partShaftSlope',
  'partLever',
  'partSprinkler',
  'partChute',
  'partChuteUp',
  'partChuteDown',
  'partCollector',
  'partPusher',
  'partClapper',
  'partBeeBox',
  'partSensor',
  'partLamp',
  'partSwitchableLamp',
  'partArm',
  'partSawArm',
  'partWorkbench',
  'partDitch',
  'partFence',
  'partPit',
  'partHatch',
] as const;
export type PartKind = (typeof PART_KEYS)[number];

/** Supporting-cell offsets: bury ditch .25, pit 1, wheel .4; mount hatch at 2.
 * Front is +z. Fence owns the -x post; put an end post at the final +x endpoint.
 * The caller supplies terrain cuts, water, creatures, goods routes and collision. */
export const PART_PLACEMENT = {
  partDitch: -0.25,
  partPit: -1,
  partWheel: -0.4,
  partHatch: 2,
} as const;
function fixed(s: Shape, key: PartKind, v: number) {
  switch (key) {
    case 'partWheel':
      for (const z of [-0.35, 0.35]) {
        s.box(0, 0, z, 0.28, 0.9, 0.2, STONE, { skin: 'stone' });
        if (z > 0) socket(s, [0, 0.9, z - 0.06], [0, 0.9, z + 0.06]);
      }
      metal(s, [0, 0.9, -0.5], [0, 0.9, 0.5]);
      break;
    case 'partShaft':
    case 'partShaftCorner':
    case 'partShaftSlope':
      shaftBody(s, key === 'partShaftSlope', key === 'partShaftCorner');
      break;
    case 'partLever':
      wood(s, 0, 0, 0, 0.7, 0.15, 0.6, 0.02);
      shaft(s);
      s.box(0, 0.15, 0, 0.3, 0.4, 0.3, BRASS, { skin: 'flat' });
      break;
    case 'partSprinkler':
      foot(s);
      metal(s, [0, 0.12, 0], [0, 0.58, 0], 0.09, BRASS);
      metal(s, [-0.5, 0.5, 0], [0, 0.5, 0]);
      socket(s, [-0.17, 0.5, 0], [-0.05, 0.5, 0]);
      break;
    case 'partChute':
    case 'partChuteUp':
      trough(s, key === 'partChuteUp' ? 1 : 0);
      if (key === 'partChuteUp') {
        metal(s, [-0.5, 0.5, 0], [-0.28, 0.5, 0]);
      }
      goods(s, v, key === 'partChuteUp' ? 0.95 : 0.08, 0.35);
      break;
    case 'partChuteDown':
      s.at(0, 0, 0, Math.PI, () => trough(s, 1));
      goods(s, v, 0.24, 0.35);
      break;
    case 'partDitch':
      s.at(0, -0.05, 0, 0, () => trough(s, 0, true));
      if (v === 2) s.box(0, 0.05, 0.44, 0.68, 0.2, 0.12, STONE, { skin: 'stone' });
      break;
    case 'partCollector':
      wood(s, 0, 0, 0, 0.78, 0.12, 0.78);
      for (const x of [-0.35, 0.35]) {
        wood(s, x, 0.12, 0, 0.1, 0.55, 0.78);
        s.box(x, 0.58, 0, 0.16, 0.1, 0.8, [P.moss, P.lime], { skin: 'moss', bevel: 0.02 });
      }
      for (const z of [-0.35, 0.35]) {
        wood(s, 0, 0.12, z, 0.6, 0.55, 0.1);
        s.box(0, 0.58, z, 0.6, 0.1, 0.16, [P.moss, P.lime], { skin: 'moss' });
      }
      goods(s, v, v === 2 ? 0.6 : 0.15, 0);
      break;
    case 'partBeeBox':
      for (const x of [-0.25, 0.25]) wood(s, x, 0, 0, 0.12, 0.2, 0.5);
      s.roundBox(0, 0.2, 0, 0.65, 0.48, 0.57, RAMP.plank, {
        round: 0.025,
        segments: 1,
        skin: 'grain',
      });
      wood(s, 0, 0.22, 0.37, 0.64, 0.07, 0.25);
      s.box(0, 0.3, 0.291, 0.25, 0.07, 0.02, P.umber, { skin: 'flat' });
      if (v === 2) s.box(0, 0.39, 0.32, 0.48, 0.19, 0.13, BRASS, { skin: 'flat' });
      break;
    case 'partPusher':
    case 'partClapper':
    case 'partArm':
    case 'partSawArm':
      wood(s, 0, 0, 0, 0.78, 0.12, 0.78, 0.02);
      shaft(s);
      for (const x of [-0.27, 0.27])
        wood(s, x, 0.12, -0.05, 0.14, key === 'partPusher' ? 0.48 : 0.7, 0.25);
      if (key === 'partPusher')
        s.at(0, 0.42, 0.15, { rx: Math.PI / 2 }, () =>
          s.lathe(
            0,
            0,
            0,
            [
              [0.08, 0],
              [0.13, 0.04],
              [0.08, 0.08],
              [0.13, 0.12],
              [0.08, 0.16],
              [0.13, 0.2],
              [0.08, 0.24],
            ],
            COPPER,
            { sides: 6, skin: 'flat' },
          ),
        );
      if (key === 'partArm')
        s.lathe(
          0.24,
          0.8,
          -0.12,
          [
            [0.08, 0],
            [0.2, 0.15],
            [0.2, 0.25],
          ],
          BRASS,
          { sides: 6, cap: false, skin: 'flat' },
        );
      if (key === 'partSawArm')
        s.lathe(
          0.24,
          0.12,
          0.22,
          [
            [0.07, 0],
            [0.12, 0.15],
          ],
          COPPER,
          { sides: 6, skin: 'flat' },
        );
      if (v === 2 && (key === 'partArm' || key === 'partSawArm')) goods(s, v, 0.12, 0.42);
      break;
    case 'partSensor':
      foot(s, 0, 0, 0.65, 0.6);
      metal(s, [0, 0.12, 0], [0, 0.4, 0], 0.15, BRASS);
      metal(s, [-0.5, 0.5, 0], [0, 0.5, 0]);
      roof(s, 0.49, 0.65, 0.55);
      break;
    case 'partLamp':
    case 'partSwitchableLamp':
      lampBody(s, key === 'partSwitchableLamp');
      break;
    case 'partWorkbench':
      for (const x of [-0.73, 0.73]) for (const z of [-0.3, 0.3]) wood(s, x, 0, z, 0.12, 0.7, 0.12);
      wood(s, 0, 0.7, 0, 1.7, 0.1, 0.8, 0.02);
      wood(s, 0, 0.9, -0.36, 1.7, 0.5, 0.07);
      for (const x of [-0.55, -0.2, 0.15])
        s.box(x, 1.03, -0.3, 0.05, 0.28, 0.03, P.iron, { skin: 'flat' });
      s.box(0.58, 0.8, 0.18, 0.24, 0.16, 0.23, P.iron, { skin: 'flat' });
      goods(s, v, 0.81, 0.08, v === 2 ? 0.6 : -0.4);
      break;
    case 'partFence':
      wood(s, -0.44, 0, 0, 0.12, 0.86, 0.15, 0.015);
      s.box(-0.44, 0.86, 0, 0.16, 0.04, 0.19, BRASS, { skin: 'flat' });
      for (const y of [0.3, 0.7]) wood(s, 0.06, y, 0, 0.88, 0.13, 0.09, 0.01);
      break;
    case 'partPit':
      for (const x of [-0.46, 0.46]) s.box(x, 0, 0, 0.08, 1, 1, STONE, { skin: 'stone' });
      s.box(0, 0, -0.46, 0.84, 1, 0.08, STONE, { skin: 'stone' });
      s.box(0, 0, 0, 0.84, 0.02, 0.84, [P.soil, P.umber], { skin: 'mud' });
      break;
    case 'partHatch':
      for (const x of [-0.46, 0.46]) wood(s, x, 0, 0, 0.08, 0.08, 1);
      for (const z of [-0.46, 0.46]) wood(s, 0, 0, z, 0.84, 0.08, 0.08);
      metal(s, [-0.5, 0.08, -0.4], [0.5, 0.08, -0.4], 0.045, BRASS);
      break;
  }
  // Conservative, grounded silhouette for the shared shadow pass.
  s.shadowBox(
    0,
    0,
    0,
    key === 'partWorkbench' ? 1.7 : 0.65,
    key === 'partLamp' || key === 'partSwitchableLamp' ? 1.7 : 0.6,
    0.65,
  );
}
function pivot(key: PartKind, v = 0): V3 {
  if (key === 'partChuteUp') return [0, 0, 0];
  if (key === 'partBeeBox') return [0, 0.74, -0.375];
  if (key === 'partCollector') return [0, 0.68, -0.35];
  if (key === 'partWheel') return [0, 0.9, 0];
  if (key === 'partSprinkler') return [0, 0.61, 0];
  if (key === 'partHatch') return [0, 0.08, -0.4];
  if (key === 'partLamp' || key === 'partSwitchableLamp') return [0, 1.35, 0.28];
  if (key === 'partArm' || key === 'partSawArm') return [0, 0.7, 0.04];
  if (key === 'partPusher') return [0, 0.42, v === 0 ? 0.4 : v === 1 ? 0.18 : 0.28];
  if (key === 'partClapper') return [0, 0.72, 0];
  if (key === 'partSensor') return [0, 0.38, 0];
  return [0, 0.5, 0];
}
function moving(s: Shape, key: PartKind, v: number) {
  switch (key) {
    case 'partChuteUp':
      for (let i = 0; i < 4; i++) wood(s, 0, 0.15 + i * 0.23, -0.4 + i * 0.23, 0.62, 0.035, 0.07);
      for (const x of [-0.24, 0.24])
        s.tube(
          [
            [x, 0.12, -0.45],
            [x, 1.02, 0.45],
          ],
          [0.02, 0.02],
          4,
          [P.moss, P.lime],
          { skin: 'bark', cap: 'both' },
        );
      break;
    case 'partBeeBox':
      s.at(0, 0, 0.375, 0, () => roof(s, 0, 0.83, 0.75, [P.tealDark, P.teal, P.tealLight]));
      break;
    case 'partCollector':
      if (v === 2) wood(s, 0, 0, 0.35, 0.74, 0.06, 0.7, 0.015);
      break;
    case 'partWheel':
      wheel(s);
      break;
    case 'partShaft':
    case 'partShaftCorner':
    case 'partShaftSlope':
      s.at(0, -0.5, 0, 0, () => shaft(s, key === 'partShaftSlope', key === 'partShaftCorner'));
      break;
    case 'partLever':
      metal(s, [0, 0, 0], [0, 0.36, 0.13], 0.035, BRASS);
      metal(s, [0, 0.3, 0.11], [0, 0.46, 0.16], 0.065);
      break;
    case 'partSprinkler':
      for (let i = 0; i < 4; i++)
        s.at(0, 0, 0, (i * Math.PI) / 2, () =>
          metal(s, [0, 0, 0], [0.28, 0.05, 0.07], 0.035, BRASS),
        );
      break;
    case 'partPusher':
      metal(s, [0, 0, -0.2], [0, 0, 0.22], 0.09);
      s.box(0, -0.27, 0.26, 0.67, 0.54, 0.1, BRASS, { bevel: 0.025, skin: 'flat' });
      break;
    case 'partClapper':
      wood(s, 0, -0.08, 0.24, 0.52, 0.08, 0.5, 0.02);
      metal(s, [0, 0, 0], [0, 0, 0.45], 0.04, BRASS);
      break;
    case 'partArm':
      s.sweep(
        [
          [0, 0, 0],
          [0, 0.08, 0.42],
          [0.22, -0.04, 0.8],
          [0.33, -0.27, 0.92],
        ],
        [0.1, 0.09, 0.06, 0.015],
        COPPER,
        { sides: 6, steps: 1, cap: 'none', skin: 'flat' },
      );
      break;
    case 'partSawArm':
      wood(s, 0, 0, 0.36, 0.13, 0.12, 0.72);
      s.poly(
        [
          [-0.04, 0, 0.18],
          [-0.04, 0, 0.95],
          [-0.04, -0.17, 0.95],
          [-0.04, -0.11, 0.85],
          [-0.04, -0.2, 0.75],
          [-0.04, -0.11, 0.65],
          [-0.04, -0.2, 0.55],
          [-0.04, -0.11, 0.45],
          [-0.04, -0.2, 0.35],
          [-0.04, -0.12, 0.18],
        ],
        [P.iron, P.pewter, P.ash],
        { two: true, skin: 'flat' },
      );
      break;
    case 'partSensor':
      metal(s, [0, 0, 0], [0, 0, 0.2], 0.16, BRASS);
      s.tube(
        [
          [0, 0, 0.205],
          [0, 0, 0.225],
        ],
        [0.115, 0.115],
        10,
        v === 1 ? P.tealDeep : P.lumeLight,
        { cap: 'both', skin: 'flat', glow: v === 1 ? 0 : 2 },
      );
      if (v !== 1) s.light(0, 0, 0.23);
      s.poly(
        [
          [0.13, 0, 0],
          [0.4, 0.08, 0],
          [0.4, -0.06, 0],
        ],
        BRASS,
        { two: true, skin: 'flat' },
      );
      break;
    case 'partLamp':
    case 'partSwitchableLamp':
      lantern(s, v === 0 || (key === 'partLamp' && v === 2));
      break;
    case 'partHatch':
      for (let i = 0; i < 5; i++) wood(s, 0, 0, 0.08 + i * 0.15, 0.8, 0.045, 0.13);
      for (const x of [-0.35, 0.35]) wood(s, x, -0.04, 0.4, 0.08, 0.04, 0.8);
      break;
  }
}
function pose(key: PartKind, v: number) {
  if (key === 'partBeeBox' || key === 'partCollector') return { rx: v === 2 ? -0.8 : 0 };
  if (key === 'partHatch') return { rx: v === 0 ? -1.1 : v === 2 ? -0.25 : 0 };
  if (key === 'partLever') return { rx: v === 1 ? 1 : 0 };
  if (key === 'partClapper') return { rx: v === 1 ? -0.7 : 0.15 };
  return { rx: 0 };
}
/** Registry preview includes a posed moving piece. For animation use farmPartParts instead.
 * Never layer the preview over the returned stationary geometry. */
export function farmPart(
  key: PartKind,
  v: number,
  _def?: unknown,
  detail = 1,
): THREE.BufferGeometry {
  const s = new Shape(17001, detail);
  fixed(s, key, v);
  s.at(...pivot(key, v), pose(key, v), () => moving(s, key, v));
  if (key === 'partDitch' || key === 'partSprinkler') flow(s, key, v);
  return s.done();
}
/** Every moving geometry is pivot-local. Rotate wheel about z, sprinkler about y, lever/clapper/hatch
 * about x; translate pusher along +z, sweep harvester about y, reciprocate saw along z.
 * Straight shaft rotates x; corner/slope shafts require separate segment rotations by the caller.
 * Lamp geometry supplies the light and sensor geometry supplies its eye. No animation is scheduled here. */
export function farmPartParts(key: PartKind, v = 0, detail = 1) {
  const body = new Shape(17001, detail),
    part = new Shape(17002, detail);
  fixed(body, key, v);
  moving(part, key, v);
  return { stationary: body.done(), moving: part.done(), pivot: pivot(key, v), pose: pose(key, v) };
}
export const PART_BUILDERS = Object.fromEntries(
  PART_KEYS.map((key) => [
    key,
    (v: number, d: unknown, detail: number) => farmPart(key, v, d, detail),
  ]),
);

/** A terminal post is placed at the final rail endpoint plus .06 in x. Interior cells own their
 * -x post. Corner callers share that same post instead of placing two complete end posts. */
export function farmFenceEnd(detail = 1): THREE.BufferGeometry {
  const s = new Shape(17003, detail);
  wood(s, 0, 0, 0, 0.12, 0.86, 0.15, 0.015);
  s.box(0, 0.86, 0, 0.16, 0.04, 0.19, BRASS, { skin: 'flat' });
  return s.done();
}

/** Use these instead of the merged shaft preview when animating a corner or a rise.
 * Each segment is local to its own pivot and turns around its returned unit axis. */
export function farmShaftSegments(
  key: 'partShaft' | 'partShaftCorner' | 'partShaftSlope',
  detail = 1,
) {
  const paths: V3[] =
    key === 'partShaftSlope'
      ? [
          [-0.5, 0.5, 0],
          [-0.38, 0.5, 0],
          [0.38, 1.5, 0],
          [0.5, 1.5, 0],
        ]
      : key === 'partShaftCorner'
        ? [
            [-0.5, 0.5, 0],
            [0, 0.5, 0],
            [0, 0.5, 0.5],
          ]
        : [
            [-0.5, 0.5, 0],
            [0, 0.5, 0],
            [0.5, 0.5, 0],
          ];
  return paths.slice(0, -1).map((a, i) => {
    const b = paths[i + 1],
      delta: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      length = Math.hypot(...delta);
    const s = new Shape(17004 + i, detail);
    metal(s, [0, 0, 0], delta);
    return { geometry: s.done(), pivot: a, axis: delta.map((n) => n / length) as V3 };
  });
}

/** Separate water geometry, to be used with the caller's translucent water material.
 * Short supply changes the spray's reach, never the machine's material or integrity. */
function flow(s: Shape, key: 'partDitch' | 'partSprinkler', variant: number) {
  if (variant === 1) return;
  if (key === 'partDitch') {
    s.poly(
      [
        [-0.34, 0.22, -0.5],
        [-0.34, 0.22, 0.5],
        [0.34, 0.22, 0.5],
        [0.34, 0.22, -0.5],
      ],
      P.ice,
      { two: true, skin: 'flat' },
    );
    return;
  }
  for (let i = 0; i < 4; i++)
    s.at(0, 0.64, 0, (i * Math.PI) / 2, () => {
      const reach = variant === 2 ? 0.65 : 1.25;
      const path = [
        [0.25, 0.05],
        [reach * 0.55, 0.25],
        [reach * 0.8, 0.18],
        [reach, -0.4],
      ];
      for (let j = 0; j < 3; j++) {
        const [x, y] = path[j],
          [nx, ny] = path[j + 1];
        s.poly(
          [
            [x, y, 0.05],
            [nx, ny, 0.05],
            [nx, ny, 0.07],
            [x, y, 0.07],
          ],
          P.ice,
          { two: true, skin: 'flat' },
        );
      }
    });
}
export function farmPartWater(
  key: 'partDitch' | 'partSprinkler',
  variant = 0,
  detail = 1,
): THREE.BufferGeometry {
  const s = new Shape(17005, detail);
  flow(s, key, variant);
  return s.done();
}
