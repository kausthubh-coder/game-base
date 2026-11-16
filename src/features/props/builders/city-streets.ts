// act1-city-streets. Metres, +z front; modular masonry joins on integer boundaries.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape } from '../shape.ts';
import { jetty } from './group-4.ts';

type Point = [number, number, number];
const STONE = [0x9c91a7, 0xdec398, 0xf4deb2] as const;
const WOOD = RAMP.plank;
const TAU = Math.PI * 2;
function board(
  s: Shape,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  bevel = 0,
) {
  s.box(x, y, z, w, h, d, WOOD, { bevel: s.detail < 0.75 ? 0 : bevel, skin: 'grain' });
}
function stone(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number) {
  if (s.detail < 0.75) s.box(x, y, z, w, h, d, STONE, { skin: 'stone' });
  else s.roundBox(x, y, z, w, h, d, STONE, { round: 0.045, skin: 'stone', moss: 0.025 });
}
function rope(s: Shape, path: Point[], r = 0.035) {
  s.sweep(
    path,
    path.map(() => r),
    [P.burlap, P.burlapLight],
    { sides: 5, steps: 2, cap: 'none', skin: 'grain' },
  );
}
function beam(s: Shape, a: Point, b: Point, r = 0.09) {
  s.tube([a, b], [r, r], 4, WOOD, { skin: 'grain', cap: 'both', turn: Math.PI / 4 });
}
function leaf(s: Shape, x: number, y: number, z: number, scale = 1, tone: number = P.cream) {
  s.poly(
    [
      [x, y, z],
      [x - 0.18 * scale, y + 0.22 * scale, z],
      [x, y + 0.55 * scale, z],
      [x + 0.18 * scale, y + 0.22 * scale, z],
    ],
    tone,
    { two: true },
  );
}
function lantern(s: Shape, x: number, y: number, z: number, size = 1) {
  s.at(x, y, z, { scale: size }, () => {
    s.lathe(
      0,
      0,
      0,
      [
        [0.16, 0],
        [0.23, 0.08],
        [0.27, 0.48],
        [0.16, 0.53],
      ],
      [P.lamp, P.lampHot],
      { sides: 6, glow: 1 },
    );
    s.lathe(
      0,
      0,
      0,
      [
        [0.29, 0.49],
        [0.3, 0.55],
        [0.08, 0.72],
        [0, 0.76],
      ],
      [P.timber, P.iron],
      { sides: 6 },
    );
    s.lathe(
      0,
      0,
      0,
      [
        [0.16, 0],
        [0.22, 0.05],
      ],
      P.iron,
      { sides: 6 },
    );
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4;
      beam(
        s,
        [Math.cos(a) * 0.17, 0.04, Math.sin(a) * 0.17],
        [Math.cos(a) * 0.24, 0.51, Math.sin(a) * 0.24],
        0.022,
      );
    }
  });
  s.light(x, y + size * 0.28, z);
}
function finished(s: Shape, w: number, h: number, d: number): THREE.BufferGeometry {
  s.shadowBox(0, 0, 0, w, h, d);
  return s.done();
}

export function cityStall(v: number, _def: unknown, detail = 1) {
  const s = new Shape(8100 + v, detail);
  for (const x of [-1.25, 1.25])
    for (const z of [-1.2, 1.2]) board(s, x, 0, z, 0.14, z < 0 ? 2.88 : 2.35, 0.14, 0.02);
  board(s, 0, 0.73, 0.6, 2.7, 0.14, 1.4, 0.025);
  for (const y of [0.08, 0.3, 0.52]) board(s, 0, y, 1.25, 2.6, 0.19, 0.09);
  for (const x of [-1.25, 1.25]) {
    beam(s, [x, 1.85, 1.2], [x, 2.28, 0.6], 0.065);
    beam(s, [x, 2.25, -1.2], [x, 2.55, -0.65], 0.065);
  }
  // Draped counter linen, with a broad hanging fold.
  for (let i = 0; i < 6; i++) {
    const x = -0.55 + i * 0.18,
      z = 1.32 + Math.sin((i * Math.PI) / 2) * 0.025;
    s.poly(
      [
        [x, 0.89, 0.1],
        [x + 0.18, 0.89, 0.1],
        [x + 0.18, 0.89, z],
        [x, 0.89, z],
      ],
      [P.plaster, P.ivory],
      { two: true, skin: 'flat' },
    );
    s.poly(
      [
        [x, 0.89, z],
        [x + 0.18, 0.89, z],
        [x + 0.18, 0.28, z + 0.025],
        [x, 0.3, z + 0.025],
      ],
      [P.plaster, P.ivory],
      { two: true, skin: 'flat' },
    );
  }
  if (v === 0) lantern(s, 1.13, 1.65, 1.05, 0.65);
  for (const z of [-1.25, 1.25]) board(s, 0, z < 0 ? 2.84 : 2.31, z, 2.95, 0.12, 0.15);
  // Six broad cloth strips sag between ridge and valance.
  for (let i = 0; i < 6; i++) {
    const x = -1.5 + i * 0.5;
    const tone = v
      ? [P.plaster, P.ivory]
      : i % 2
        ? [P.cream, P.ivory]
        : [P.ochre, P.gold, P.butter];
    const p: number[] = [];
    for (const xx of [x, x + 0.5])
      for (let j = 0; j < 5; j++) {
        const t = j / 4;
        p.push(
          xx,
          2.98 - 0.6 * t - (0.15 + 0.025 * Math.cos(xx * TAU)) * Math.sin(t * Math.PI),
          -1.5 + 3 * t,
        );
      }
    const tri: number[] = [];
    for (let j = 0; j < 4; j++) tri.push(j, j + 1, j + 5, j + 1, j + 6, j + 5);
    s.mesh(p, tri, tone, { skin: 'flat' });
    s.poly(
      [
        [x, 2.38, 1.5],
        [x + 0.5, 2.38, 1.5],
        [x + 0.5, 2.15, 1.5],
        [x, 2.18, 1.5],
      ],
      tone,
      { two: true },
    );
  }
  return finished(s, 2.7, 2.4, 2.7);
}
export function cityCrate(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8104, detail);
  board(s, 0, 0, 0, 1, 1, 1, 0.025);
  for (const z of [-0.505, 0.505]) {
    for (const x of [-0.43, 0.43]) board(s, x, 0.04, z, 0.1, 0.92, 0.035);
    beam(s, [-0.4, 0.12, z], [0.4, 0.88, z], 0.045);
  }
  for (const z of [-0.42, 0.42]) board(s, 0, 0.97, z, 0.98, 0.03, 0.1);
  return finished(s, 1, 1, 1);
}
export function cityBarrel(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8105, detail);
  s.lathe(
    0,
    0,
    0,
    [
      [0.38, 0],
      [0.45, 0.12],
      [0.5, 0.5],
      [0.45, 0.88],
      [0.38, 1],
    ],
    WOOD,
    { sides: 12, skin: 'grain' },
  );
  for (const [y0, y1] of [
    [0.13, 0.26],
    [0.74, 0.87],
  ]) {
    const radius = (y: number) => 0.5 - Math.abs(y - 0.5) * (0.05 / 0.38) + 0.012;
    s.lathe(
      0,
      0,
      0,
      [
        [radius(y0), y0],
        [radius(y1), y1],
      ],
      P.iron,
      { sides: 12, cap: false },
    );
  }
  return finished(s, 1, 1, 1);
}
export function cityCart(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8103, detail);
  board(s, 0, 0.65, -0.5, 2.25, 0.16, 2.7, 0.03);
  for (const x of [-1.05, 1.05]) {
    board(s, x, 0.8, -0.5, 0.12, 0.7, 2.7);
    board(s, x, 0.56, 1.25, 0.12, 0.12, 1.5);
  }
  board(s, 0, 0.8, -1.8, 2.2, 0.7, 0.12);
  for (const x of [-1.36, 1.36])
    s.at(x, 0.65, -0.4, { rz: Math.PI / 2 }, () => {
      s.lathe(
        0,
        0,
        0,
        [
          [0.52, -0.1],
          [0.64, -0.1],
          [0.64, 0.1],
          [0.52, 0.1],
          [0.52, -0.1],
        ],
        WOOD,
        { sides: 12, cap: false, skin: 'grain' },
      );
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        beam(s, [0, 0, 0], [0.55 * Math.cos(a), 0, 0.55 * Math.sin(a)], 0.045);
      }
    });
  beam(s, [-1.45, 0.65, -0.4], [1.45, 0.65, -0.4]);
  board(s, 0, 0, 1, 0.12, 0.65, 0.12);
  return finished(s, 2.7, 1.5, 4);
}
export function cityBench(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8106, detail);
  for (const x of [-1.15, 1.15]) {
    stone(s, x, 0, 0, 0.24, 0.5, 0.7);
    board(s, x, 0.45, -0.3, 0.14, 0.83, 0.14);
  }
  for (const z of [-0.25, 0, 0.25]) board(s, 0, 0.48, z, 2.9, 0.12, 0.23, 0.02);
  for (const y of [0.85, 1.09]) board(s, 0, y, -0.32, 2.8, 0.18, 0.1, 0.02);
  return finished(s, 2.9, 1.28, 0.75);
}
export function cityLamp(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8107, detail);
  stone(s, -0.6, 0, 0, 0.6, 0.5, 0.6);
  board(s, -0.6, 0.5, 0, 0.2, 2.5, 0.2, 0.025);
  board(s, 0, 2.8, 0, 1.6, 0.16, 0.18);
  beam(s, [-0.6, 2, 0], [0.45, 2.8, 0]);
  rope(s, [
    [0.6, 2.8, 0],
    [0.6, 2.65, 0],
  ]);
  lantern(s, 0.6, 1.9, 0);
  return finished(s, 0.7, 3, 0.7);
}
export function citySign(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8108, detail);
  board(s, 0.85, 0, 0, 0.15, 2, 0.15);
  board(s, 0, 1.8, 0, 1.85, 0.14, 0.18);
  beam(s, [0.85, 1.1, 0], [0.15, 1.8, 0]);
  for (const x of [-0.6, 0.4])
    rope(s, [
      [x, 1.8, 0],
      [x, 1.4, 0],
    ]);
  s.poly(
    [
      [-0.8, 1.4, 0.05],
      [0.6, 1.4, 0.05],
      [0.6, 0.45, 0.05],
      [-0.1, 0.15, 0.05],
      [-0.8, 0.45, 0.05],
    ],
    WOOD,
    { two: true, skin: 'grain' },
  );
  leaf(s, -0.1, 0.5, 0.06);
  return finished(s, 1.8, 2, 0.15);
}
export function cityBanner(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8109, detail);
  stone(s, 0, 0, 0, 0.65, 0.4, 0.65);
  board(s, 0, 0.4, 0, 0.16, 3.6, 0.16, 0.02);
  board(s, 0, 3.65, 0, 1.85, 0.12, 0.13);
  s.poly(
    [
      [-0.7, 3.6, 0.1],
      [0.7, 3.6, 0.1],
      [0.7, 1.2, 0.16],
      [0, 1.65, 0.2],
      [-0.7, 1.2, 0.16],
    ],
    [P.ochre, P.gold],
    { two: true, skin: 'flat' },
  );
  leaf(s, 0, 2.1, 0.21, 1.4);
  return finished(s, 0.65, 4, 0.65);
}
export function cityWell(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8110, detail);
  s.lathe(
    0,
    0,
    0,
    [
      [1.8, 0],
      [1.8, 1.15],
      [1.45, 1.15],
      [1.45, 0.1],
    ],
    STONE,
    { sides: 16, cap: false, skin: 'stone' },
  );
  for (const x of [-2.1, 2.1]) {
    stone(s, x, 0, 0, 0.65, 1, 0.8);
    board(s, x, 1, 0, 0.32, 3.4, 0.32, 0.035);
  }
  for (const sign of [-1, 1])
    s.poly(
      [
        [-3, 4.3, sign * 3],
        [3, 4.3, sign * 3],
        [3, 6, 0],
        [-3, 6, 0],
      ],
      [P.tealDark, P.teal, P.tealPale],
      { two: true, skin: 'flat' },
    );
  board(s, 0, 5.8, 0, 6, 0.2, 0.22, 0.025);
  beam(s, [-2.3, 2.5, 0], [2.3, 2.5, 0], 0.19);
  rope(
    s,
    [
      [0, 2.5, 0],
      [0, 0.3, 0],
    ],
    0.045,
  );
  return finished(s, 4.8, 4.4, 3.6);
}
export function cityFountain(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8111, detail);
  s.lathe(
    0,
    0,
    0,
    [
      [2.85, 0],
      [3, 0.15],
      [3, 1],
      [2.75, 1.15],
      [2.55, 1],
      [2.55, 0.25],
    ],
    STONE,
    { sides: 16, skin: 'stone', cap: false },
  );
  s.lathe(
    0,
    0,
    0,
    [
      [0.65, 0.1],
      [0.8, 0.4],
      [0.45, 0.6],
      [0.3, 1.65],
      [0.65, 1.8],
      [1, 2.1],
      [1.05, 2.3],
      [0.9, 2.4],
      [0.7, 2.1],
    ],
    STONE,
    { sides: 12, skin: 'stone', cap: false },
  );
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    s.at(0, 0, 0, a, () => leaf(s, 0, 0.25, 2.99, 1.3, P.moss));
  leaf(s, 0, 2.35, 0, 1.1, P.leaf);
  return finished(s, 5.7, 1, 5.7);
}
/** Separate transparent geometry; mount at the fixed fountain's origin. */
export function cityFountainWater(detail = 1) {
  const s = new Shape(8199, detail);
  s.disc(0, 0.86, 0, 2.55, 24, P.ice);
  s.disc(0, 2.16, 0, 0.85, 16, P.ice);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
    s.at(0, 0, 0, a, () =>
      s.poly(
        [
          [-0.16, 2.2, 0.9],
          [0.16, 2.2, 0.9],
          [0.23, 0.86, 1.65],
          [-0.23, 0.86, 1.65],
        ],
        P.ice,
        { two: true },
      ),
    );
  return s.done();
}
export function cityPlanter(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8112, detail);
  stone(s, 0, 0, 0, 2.8, 0.7, 1.6);
  s.box(0, 0.7, 0, 2.65, 0.05, 1.45, P.soil, { skin: 'mud' });
  for (let i = 0; i < 3; i++)
    s.rock(-0.85 + i * 0.85, 0.7, 0, 1.05, 0.7 + (i % 2) * 0.25, 1.35, RAMP.bushLeaf, {
      level: 1,
      seat: false,
      shadow: false,
      planes: 0,
      lump: 0.08,
      skin: 'flat',
    });
  for (let i = 0; i < (detail < 0.75 ? 5 : 9); i++) {
    const x = -1.1 + (i % 5) * 0.52,
      z = i < 5 ? 0.4 : -0.25,
      y = 1.2 + (i % 3) * 0.12;
    const pts: Point[] = [];
    for (let j = 0; j < 12; j++) {
      const a = (j * TAU) / 12,
        r = j % 2 ? 0.08 : 0.19;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, z + Math.sin(a) * r]);
    }
    s.poly(pts, i % 3 ? P.plasterLight : P.mauve, { two: true, toward: [0, 1, 0], skin: 'flat' });
    s.disc(x, y + 0.015, z, 0.055, 6, P.butter);
  }
  return finished(s, 2.8, 0.7, 1.6);
}
function fenceRun(s: Shape) {
  // Own the start and middle posts. A terminal variant supplies the last post.
  for (const x of [-1.5, 0]) {
    board(s, x, 0.15, 0, 0.14, 1, 0.14);
    s.box(x, 0, 0, 0.24, 0.15, 0.24, STONE, { skin: 'stone' });
  }
  for (const y of [0.35, 0.8]) board(s, 0, y, 0, 3, 0.12, 0.1);
}
export function cityFence(v: number, _def: unknown, detail = 1) {
  const s = new Shape(8113, detail);
  fenceRun(s);
  if (v) board(s, 1.5, 0, 0, 0.14, 1.15, 0.14);
  return finished(s, 3, 1, 0.14);
}
export function cityFenceCorner(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8114, detail);
  s.at(0, 0, -1.5, 0, () => fenceRun(s));
  s.at(1.5, 0, 0, -Math.PI / 2, () => fenceRun(s));
  return finished(s, 3, 1, 3);
}
export function cityPavingEdge(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8115, detail);
  stone(s, 0, 0, 0.5, 4, 1, 1);
  return finished(s, 4, 1, 1);
}
export function cityStringLights(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8116, detail);
  for (const x of [-2.8, 2.8]) {
    stone(s, x, 0, 0, 0.4, 0.45, 0.4);
    board(s, x, 0.45, 0, 0.16, 3.55, 0.16);
  }
  rope(s, [
    [-2.8, 3.85, 0],
    [0, 3.35, 0],
    [2.8, 3.85, 0],
  ]);
  for (const x of [-2, -1, 0, 1, 2]) lantern(s, x, 2.98 + 0.5 * (x / 2.8) ** 2, 0, 0.5);
  return finished(s, 5.8, 4, 0.4);
}

export function cityQuayWall(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8120, detail);
  s.box(0, 0, 1, 4, 3.7, 1.8, STONE, { skin: 'stone' });
  stone(s, 0, 3.7, 1, 4, 0.3, 2);
  return finished(s, 4, 4, 2);
}
export function cityQuayCorner(v: number, _def: unknown, detail = 1) {
  const s = new Shape(8121, detail);
  // Union of two arms, with the same inset wall faces as the straight module.
  // Variant 1 mirrors the return arm; coping remains on the integer join planes.
  for (const [x, z, w, d] of [
    [0, 1, 4, 2],
    [-1, 3, 2, 2],
  ]) {
    s.box(v ? -x : x, 0, x === 0 ? 1 : 2.95, x === 0 ? 4 : 1.8, 3.7, x === 0 ? 1.8 : 2.1, STONE, {
      skin: 'stone',
    });
    stone(s, v ? -x : x, 3.7, z, w, 0.3, d);
  }
  return finished(s, 4, 4, 4);
}
export function cityQuaySteps(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8122, detail);
  for (let i = 0; i < 12; i++)
    s.box(0, 0, 2.75 - i * 0.5, 4, (i + 1) * 0.25, 0.5, STONE, { skin: 'stone' });
  return finished(s, 4, 3, 6);
}
export function cityBollard(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8123, detail);
  s.lathe(
    0,
    0,
    0,
    [
      [0.35, 0],
      [0.3, 0.15],
      [0.28, 0.7],
      [0.48, 0.8],
      [0.48, 0.95],
      [0.35, 1],
    ],
    STONE,
    { sides: 10, skin: 'stone' },
  );
  const path: Point[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i * TAU) / 8;
    path.push([Math.cos(a) * 0.32, 0.26 + i * 0.015, Math.sin(a) * 0.32]);
  }
  s.sweep(
    path,
    path.map(() => 0.045),
    RAMP.burlap,
    { sides: 4, steps: 1, cap: 'none', skin: 'grain' },
  );
  return finished(s, 0.95, 1, 0.95);
}
function deck(s: Shape, w: number, d: number, y: number) {
  for (let i = 0; i < Math.round(d / 0.3); i++)
    board(s, 0, y, -d / 2 + (i + 0.5) * 0.3, w, 0.14, 0.29);
}
export function cityDock(v: number, _def: unknown, detail = 1) {
  const s = new Shape(8124, detail);
  deck(s, 3, 3, 0.7);
  // Repeat along x every 3m. Only the terminal module owns the final pair.
  for (const x of v ? [-1.5, 1.5] : [-1.5])
    for (const z of [-1.3, 1.3]) board(s, x, 0, z, 0.18, 1, 0.18);
  return finished(s, 3, 1, 3);
}
function hull(s: Shape, w: number, d: number, h: number) {
  // A continuous open hull, with a second skin and connected gunwale. Bow and stern pinch to a narrow stem.
  const p: number[] = [],
    tri: number[] = [];
  const n = 16;
  for (let ring = 0; ring < 4; ring++)
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n;
      const x = (Math.sin(a) * w) / 2,
        z = (Math.cos(a) * d) / 2;
      const f = ring === 0 ? 0.38 : ring === 3 ? 0.42 : ring === 2 ? 0.9 : 1;
      const y = ring === 0 ? 0 : ring === 3 ? 0.12 : h * (0.8 + 0.2 * Math.abs(Math.cos(a)));
      p.push(x * f, y, z * (ring === 0 || ring === 3 ? 0.75 : 1));
    }
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < n; i++) {
      const a = r * n + i,
        b = r * n + ((i + 1) % n);
      tri.push(a, b, a + n, b, b + n, a + n);
    }
  s.mesh(p, tri, WOOD, { skin: 'grain', crease: 0.9 });
  for (const sign of [-1, 1]) {
    const path: Point[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i * Math.PI) / 8;
      path.push([
        (sign * Math.sin(a) * w) / 2,
        h * (0.8 + 0.2 * Math.abs(Math.cos(a))),
        (Math.cos(a) * d) / 2,
      ]);
    }
    rope(s, path, 0.07);
  }
  for (const [factor, y, toward] of [
    [0.38, 0, -1],
    [0.42, 0.12, 1],
  ]) {
    const floor: Point[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n;
      floor.push([Math.sin(a) * w * 0.5 * factor, y, Math.cos(a) * d * 0.375]);
    }
    s.poly(floor, WOOD, { skin: 'grain', toward: [0, toward, 0] });
  }
  for (const z of [-d * 0.24, 0, d * 0.24]) board(s, 0, h * 0.65, z, w * 0.74, 0.12, 0.32);
}
export function citySkiff(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8125, detail);
  hull(s, 1.86, 5.86, 1.25);
  beam(s, [-0.8, 1.15, -1.5], [0.8, 1.15, 1.5], 0.045);
  return finished(s, 1.8, 1, 5.8);
}
export function cityCargoBoat(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8126, detail);
  hull(s, 3.86, 11.86, 1.6);
  beam(s, [0, 0.15, 0], [0, 5, 0], 0.12);
  beam(s, [-1.6, 4.2, 0], [1.6, 4.2, 0]);
  s.sweep(
    [
      [-1.5, 4.1, 0],
      [-0.7, 3.9, 0],
      [0, 4, 0],
      [0.8, 3.9, 0],
      [1.5, 4.1, 0],
    ],
    [0.1, 0.15, 0.12, 0.15, 0.1],
    [P.burlap, P.cream],
    { sides: 6, steps: 2, skin: 'flat' },
  );
  for (const z of [-5, 5])
    rope(s, [
      [0, 1.5, z],
      [0, 4.8, 0],
    ]);
  return finished(s, 3.8, 1.6, 11.8);
}
export function cityNetRack(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8127, detail);
  for (const x of [-1.8, 1.8]) {
    board(s, x, 0, 0, 0.2, 3, 0.2);
    beam(s, [x, 0, 0.8], [x, 2.6, 0]);
  }
  board(s, 0, 2.75, 0, 4, 0.2, 0.2);
  for (let i = 0; i < 6; i++) {
    const x = -1.5 + i * 0.6;
    rope(
      s,
      [
        [x, 2.7, 0],
        [x * 0.5, 1.1, 0.15],
        [-x, 2.7, 0],
      ],
      0.022,
    );
  }
  for (let i = 0; i < 4; i++) {
    const y = 1.15 + i * 0.35;
    rope(
      s,
      [
        [-1.5, y + 0.6, 0],
        [0, y, 0.15],
        [1.5, y + 0.6, 0],
      ],
      0.022,
    );
  }
  return finished(s, 4, 3, 1.6);
}
export function cityCrane(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8128, detail);
  stone(s, 0, 0, -0.7, 1.2, 0.4, 1.2);
  board(s, 0, 0.4, -0.7, 0.35, 5.4, 0.35, 0.04);
  for (const x of [-1.5, 1.5])
    for (const z of [-1.4, 0.8]) beam(s, [x, 0, z], [0, 4.7, -0.7], 0.14);
  beam(s, [0, 5.6, -1.8], [0, 5.9, 1.7], 0.18);
  beam(s, [0, 3.5, -0.7], [0, 5.8, 1.3], 0.12);
  rope(
    s,
    [
      [0, 5.8, 1.5],
      [0, 2.5, 1.5],
    ],
    0.05,
  );
  s.lathe(
    0,
    1.6,
    1.5,
    [
      [0.35, 0],
      [0.43, 0.3],
      [0.35, 0.65],
    ],
    RAMP.burlap,
    { sides: 8 },
  );
  for (const x of [-0.35, 0.35])
    rope(s, [
      [x, 1.7, 1.5],
      [x, 2.25, 1.5],
      [0, 2.6, 1.5],
    ]);
  return finished(s, 3.3, 5.9, 3.7);
}
export function cityGangplank(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8129, detail);
  for (let i = 0; i < 20; i++) board(s, 0, i * 0.04, -2.85 + i * 0.3, 2, 0.14, 0.3);
  return finished(s, 2, 0.9, 6);
}
export function cityParapet(_v: number, _def: unknown, detail = 1) {
  const s = new Shape(8130, detail);
  s.box(0, 0, 0.5, 4, 0.8, 0.8, STONE, { skin: 'stone' });
  stone(s, 0, 0.8, 0.5, 4, 0.2, 1);
  return finished(s, 4, 1, 1);
}
// Q12 retains the separately approved landmark, including its lamp and pile layout.
export const cityJetty = jetty;
