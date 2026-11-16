// Order of the Dawn. Dimensions include trim; +z is the entrance side.
import { P } from '../palette.ts';
import { Shape, type Tone } from '../shape.ts';

type Point = [number, number, number];
const brass = [P.ochre, P.gold, P.butter];
const stone = [P.sand, P.plaster, P.plasterLight, P.ivory];
const plaster = [P.plaster, P.plasterLight, P.ivory];
const TAU = Math.PI * 2;

function arc(s: Shape, r: number, y: number, z: number, thickness: number, tone: number, glow = 0) {
  const n = s.detail < 1 ? 5 : 10,
    points: number[] = [],
    triangles: number[] = [];
  for (let i = 0; i <= n; i++)
    for (const [dr, dz] of [
      [-thickness, -thickness],
      [thickness, -thickness],
      [thickness, thickness],
      [-thickness, thickness],
    ]) {
      const angle = (i * Math.PI) / n;
      points.push((r + dr) * Math.cos(angle), y + (r + dr) * Math.sin(angle), z + dz);
    }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < 4; j++) {
      const a = i * 4 + j,
        b = i * 4 + ((j + 1) % 4);
      triangles.push(a, b, b + 4, a, b + 4, a + 4);
    }
  triangles.push(0, 2, 1, 0, 3, 2, n * 4, n * 4 + 1, n * 4 + 2, n * 4, n * 4 + 2, n * 4 + 3);
  for (let i = 0; i < triangles.length; i += 3)
    [triangles[i + 1], triangles[i + 2]] = [triangles[i + 2], triangles[i + 1]];
  s.mesh(points, triangles, tone, { skin: 'flat', glow, crease: 0.5, key: 0.15 });
}

// Six rays, including on the small pump bonnet. All seals face +z.
function seal(s: Shape, x: number, y: number, z: number, r: number) {
  s.at(x, y, z, 0, () => {
    const points: Point[] = [
      [-r, 0, 0],
      [r, 0, 0],
    ];
    for (let i = 1; i <= 12; i++)
      points.push([r * Math.cos((i * Math.PI) / 12), r * Math.sin((i * Math.PI) / 12), 0]);
    s.poly(points, P.gold, { two: true });
    arc(s, r, 0, 0.025, r * 0.06, P.butter);
    for (let i = 0; i < 6; i++) {
      const a = ((i + 0.5) * Math.PI) / 6;
      s.at(Math.cos(a) * r * 1.28, Math.sin(a) * r * 1.28, 0, { rz: a - Math.PI / 2 }, () =>
        s.box(0, 0, 0, r * 0.17, r * 0.65, r * 0.12, P.butter),
      );
    }
  });
}

// Curved brass takes continuous normals and a broad painted highlight.
function pipe(s: Shape, path: Point[], radius: number) {
  s.sweep(
    path,
    path.map(() => radius),
    brass,
    { sides: 12, steps: 2, cap: 'both', skin: 'flat', key: 0.45, cavity: 0.2, mottle: 0.12 },
  );
}

function dome(s: Shape, x: number, y: number, z: number, r: number) {
  const profile: [number, number][] = [];
  for (let j = 0; j <= 10; j++) {
    const t = (j * Math.PI) / 20;
    profile.push([j === 10 ? 0 : r * Math.cos(t), r * Math.sin(t)]);
  }
  s.lathe(x, y, z, profile, brass, {
    sides: 24,
    cap: false,
    skin: 'flat',
    key: 0.5,
    mottle: 0.13,
    cavity: 0.12,
  });
}

function masonry(
  s: Shape,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  wall = false,
) {
  if (Math.min(w, h, d) < 1.2) {
    s.box(x, y, z, w, h, d, wall ? plaster : stone, {
      bevel: s.detail < 1 || Math.min(w, d) < 0.4 ? 0 : Math.min(0.06, h / 5),
      skin: wall ? 'plaster' : 'stone',
    });
    return;
  }
  s.roundBox(x, y, z, w, h, d, wall ? plaster : stone, {
    round: Math.min(0.08, h / 5),
    segments: 1,
    skin: wall ? 'plaster' : 'stone',
    key: 0.18,
    mottle: 0.16,
    cavity: 0.2,
  });
}

function turned(
  s: Shape,
  x: number,
  y: number,
  z: number,
  r0: number,
  r1: number,
  h: number,
  tone: Tone = brass,
  glow = 0,
) {
  s.lathe(
    x,
    y,
    z,
    [
      [r0 * 0.97, 0],
      [r0, 0.025],
      [r1, h - 0.025],
      [r1 * 0.97, h],
    ],
    tone,
    {
      sides: 24,
      skin: tone === stone ? 'stone' : 'flat',
      key: 0.4,
      cavity: 0.15,
      mottle: 0.14,
      glow,
    },
  );
}

function opening(s: Shape, w: number, h: number, tone: number, glow = 0, fill = true) {
  const r = w / 2,
    spring = h - r;
  if (fill) s.box(0, 0, 0, w, spring, 0.08, tone, { glow });
  const pts: Point[] = [
    [-r, spring, 0.045],
    [r, spring, 0.045],
  ];
  for (let i = 1; i <= 12; i++)
    pts.push([r * Math.cos((i * Math.PI) / 12), spring + r * Math.sin((i * Math.PI) / 12), 0.045]);
  if (fill) s.poly(pts, tone, { glow, toward: [0, 0, 1], skin: 'flat' });
  for (const x of [-r - 0.16, r + 0.16]) masonry(s, x, 0, 0, 0.32, spring, 0.32);
  arc(s, r + 0.16, spring, 0, 0.2, P.plasterLight);
}

// Fill the wall above a curved doorway without closing its passage.
function spandrel(s: Shape, w: number, h: number, base: number, z: number) {
  const r = w / 2;
  for (let i = 0; i < 10; i++) {
    const x = -r + (w * i) / 10,
      xx = -r + (w * (i + 1)) / 10;
    const y = base + h - r + Math.sqrt(Math.max(0, r * r - x * x));
    const yy = base + h - r + Math.sqrt(Math.max(0, r * r - xx * xx));
    s.poly(
      [
        [x, y, z],
        [xx, yy, z],
        [xx, base + h, z],
        [x, base + h, z],
      ],
      plaster,
      { toward: [0, 0, 1], skin: 'plaster' },
    );
  }
}

function roof(s: Shape, w: number, d: number, base: number, rise: number, z: number, detail = 1) {
  for (const side of [-1, 1]) {
    const panels = detail < 1 ? 2 : 10;
    for (let j = 0; j < panels; j++) {
      const near = z - d / 2 + (j * d) / panels,
        far = near + d / panels;
      const points: number[] = [],
        hints: number[] = [],
        triangles: number[] = [];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4,
          x = ((side * w) / 2) * t;
        const y = base + rise * (1 - t) - Math.sin(t * Math.PI) * 0.12;
        points.push(x, y, near, x, y, far);
        hints.push(side * 0.4, 1, 0, side * 0.4, 1, 0);
        if (i < 4) {
          const a = i * 2;
          triangles.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      s.mesh(points, triangles, [P.tealDark, P.teal, P.tealPale], {
        hints,
        skin: 'flat',
        key: 0.2,
        mottle: 0.12,
      });
      s.tube(
        [
          [(side * w) / 2, base, near],
          [0, base + rise, near],
        ],
        [0.035, 0.035],
        4,
        P.tealPale,
        { skin: 'flat' },
      );
    }
    for (const end of [-1, 1])
      s.sweep(
        [
          [(side * w) / 2, base, z + (end * d) / 2],
          [0, base + rise, z + (end * d) / 2],
        ],
        [0.12, 0.12],
        [P.tealDark, P.teal, P.tealPale],
        { sides: 4, steps: 1, skin: 'flat', cap: 'none' },
      );
    s.box((side * w) / 2, base - 0.14, z, 0.18, 0.2, d, P.tealDark, { bevel: 0.03, skin: 'flat' });
  }
}

function doorLeaf(s: Shape, side: number) {
  const points: Point[] = [
    [0, 0, 0],
    [-side * 1.6, 0, 0],
    [-side * 1.6, 4.4, 0],
  ];
  for (let i = 1; i <= 8; i++) {
    const a = (i * Math.PI) / 16;
    points.push([-side * (1.6 - 1.6 * Math.sin(a)), 2.8 + 1.6 * Math.cos(a), 0]);
  }
  s.poly(points, brass, { two: true, skin: 'flat' });
  for (let i = 0; i < 4; i++) {
    const x = (i + 0.5) * 0.38;
    const top = 2.8 + Math.sqrt(2.56 - (1.6 - x) ** 2);
    s.box(-side * x, 0, 0.025, 0.025, top, 0.045, P.ochre, { skin: 'flat' });
  }
  s.at(-side * 1.25, 1.5, 0.09, 0, () => {
    const path: Point[] = [];
    for (let i = 0; i <= 16; i++)
      path.push([0.13 * Math.cos((i * TAU) / 16), 0.13 * Math.sin((i * TAU) / 16), 0]);
    s.tube(
      path,
      path.map(() => 0.025),
      5,
      P.butter,
      { cap: 'none', skin: 'flat' },
    );
  });
}

/** Replace the closed prop with fixed; hinge leaves at [-/+1.6,.6,5.66].
 * Rotate the left leaf toward -PI/2 and right toward PI/2 about Y. */
export function chapelParts(detail = 1) {
  const leaf = (side: number) => {
    const s = new Shape(1510, detail);
    doorLeaf(s, side);
    return s.done();
  };
  return { fixed: chapel(0, undefined, detail, false), left: leaf(-1), right: leaf(1) };
}

export function chapel(_variant = 0, _def?: unknown, detail = 1, closed = true) {
  const s = new Shape(1501, detail);
  masonry(s, 0, 0, 0, 9, 0.55, 13);
  for (const x of [-3.7, 3.7]) masonry(s, x, 0.55, 0.2, 0.6, 5.8, 10.6, true);
  for (const x of [-2.8, 2.8]) masonry(s, x, 0.55, 5.2, 2.4, 5.8, 0.6, true);
  masonry(s, 0, 5, 5.2, 3.2, 1.35, 0.6, true);
  spandrel(s, 3.2, 4.4, 0.6, 5.5);
  s.lathe(
    0,
    0.55,
    -3.45,
    [
      [3.45, 0],
      [3.45, 6.5],
    ],
    plaster,
    { sides: 32, skin: 'plaster', key: 0.2 },
  );
  turned(s, 0, 6.65, -3.45, 3.55, 3.55, 0.4, stone);
  dome(s, 0, 7.05, -3.45, 3.4);
  for (let k = 0; k < (detail < 1 ? 0 : 6); k++) {
    const a = (k * TAU) / 6,
      path: Point[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = (i * Math.PI) / 16;
      path.push([
        3.41 * Math.cos(t) * Math.cos(a),
        7.05 + 3.41 * Math.sin(t),
        -3.45 + 3.41 * Math.cos(t) * Math.sin(a),
      ]);
    }
    s.tube(
      path,
      path.map(() => 0.025),
      4,
      P.butter,
      { cap: 'none' },
    );
  }
  for (const z of [-3.7, -0.4, 2.9, 5.1])
    for (const x of [-4.3, 4.3]) {
      masonry(s, x, 0, z, 1.4, 1.7, 1.1);
      masonry(s, x, 1.7, z, 1, 1.5, 0.9);
      masonry(s, x, 3.2, z, 0.6, 3.3, 0.7, true);
    }
  for (const side of [-1, 1])
    for (const z of [-2.2, 1.1, 4]) {
      s.at(side * 4.025, 2.2, z, (side * Math.PI) / 2, () => {
        opening(s, 1.05, 2.6, P.lamp, 1);
        s.box(0, 0, 0.13, 0.08, 2.55, 0.1, P.ochre);
        s.box(0, 1.05, 0.13, 1.05, 0.09, 0.1, P.ochre);
      });
      s.light(side * 4.2, 3.3, z);
    }
  s.poly(
    [
      [-4, 6.3, 5.51],
      [4, 6.3, 5.51],
      [0, 8.9, 5.51],
    ],
    plaster,
    { toward: [0, 0, 1], skin: 'plaster' },
  );
  roof(s, 9.2, 11.2, 6.35, 2.55, 0.1, detail);
  for (let i = 0; i < 3; i++)
    masonry(s, 0, i * 0.2, 6.1 - i * 0.25, 5.6 - i * 0.3, 0.2, 1.8 - i * 0.5);
  s.at(0, 0.6, 5.58, 0, () => {
    opening(s, 3.2, 4.4, P.ochre, 0, false);
    if (closed) for (const side of [-1, 1]) s.at(side * 1.6, 0, 0.08, 0, () => doorLeaf(s, side));
  });
  seal(s, 0, 6.35, 5.6, 0.65);
  for (const x of [-1.35, 1.35]) masonry(s, x, 8.1, 3.9, 0.65, 3.65, 0.85);
  arc(s, 1.35, 10.25, 3.9, 0.35, P.plasterLight);
  s.box(0, 10.9, 3.9, 2.7, 0.16, 0.2, P.timber);
  s.lathe(
    0,
    9,
    3.9,
    [
      [0.75, 0],
      [0.78, 0.12],
      [0.62, 0.25],
      [0.46, 0.7],
      [0.4, 1.1],
      [0.26, 1.25],
      [0.1, 1.3],
    ],
    brass,
    { sides: 24, skin: 'flat', key: 0.5 },
  );
  turned(s, 0, 10.25, 3.9, 0.08, 0.08, 0.65);
  roof(s, 3.7, 1.6, 11.85, 1.03, 3.9, detail);
  s.shadowBox(0, 0, 0, 8, 7, 11);
  return s.done();
}

function handwheel(s: Shape) {
  const path: Point[] = [];
  for (let i = 0; i <= 20; i++)
    path.push([0.3 * Math.cos((i * TAU) / 20), 0.3 * Math.sin((i * TAU) / 20), 0]);
  s.sweep(
    path,
    path.map(() => 0.045),
    brass,
    { sides: 6, steps: 1, cap: 'none', skin: 'flat', key: 0.4 },
  );
  for (let i = 0; i < 4; i++)
    s.tube([[0, 0, 0], path[i * 5]], [0.035, 0.035], 6, P.butter, { skin: 'flat' });
}
/** Wheel pivot [.9,1.5,.75], turn about Z. Use fixed instead of the closed prop. */
export function orderPumpParts(detail = 1) {
  const wheel = new Shape(1512, detail);
  handwheel(wheel);
  return { fixed: orderPump(0, undefined, detail, false), wheel: wheel.done() };
}

export function orderPump(_variant = 0, _def?: unknown, detail = 1, wheelVisible = true) {
  const s = new Shape(1502, detail);
  turned(s, 0, 0, 0, 1.5, 1.5, 0.18, stone);
  turned(s, 0, 0.18, 0, 1.1, 0.8, 0.45, stone);
  turned(s, 0, 0.7, 0, 0.65, 0.65, 1.8, brass, 2);
  for (const y of [0.65, 0.85, 2.45, 2.65]) turned(s, 0, y, 0, 0.8, 0.8, 0.15);
  dome(s, 0, 2.8, 0, 0.78);
  for (let k = 0; k < 4; k++) {
    const a = (k * TAU) / 4 + Math.PI / 4;
    s.cyl(Math.cos(a) * 0.65, 0.9, Math.sin(a) * 0.65, 0.045, 0.045, 1.55, 4, P.gold);
  }
  for (const sign of [-1, 1]) {
    const p: Point[] = [[sign * 0.48, 3.28, 0]];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI - (i * Math.PI) / 8;
      p.push([sign * (0.89 + 0.41 * Math.cos(a)), 3.4 + 0.41 * Math.sin(a), 0]);
    }
    p.push(
      [sign * 1.3, 1.8, 0],
      [sign * 1.25, 1.6, 0],
      [sign * 1.08, 1.47, 0],
      [sign * 0.65, 1.45, 0],
    );
    pipe(s, p, 0.18);
    for (const y of [2, 3.15]) s.cyl(sign * 1.3, y, 0, 0.22, 0.22, 0.12, 6, P.butter);
  }
  for (let i = 0; i < 4; i++)
    s.at(0, 0, 0, (i * TAU) / 4 + Math.PI / 4, () =>
      s.sweep(
        [
          [0.5, 0.8, 0],
          [0.95, 0.6, 0],
          [1.18, 0.2, 0],
        ],
        [0.2, 0.2, 0.22],
        brass,
        { sides: 12, steps: 3, skin: 'flat', key: 0.4 },
      ),
    );
  seal(s, 0, 2.97, 0.75, 0.2);
  if (wheelVisible) s.at(0.9, 1.5, 0.75, 0, () => handwheel(s));
  s.light(0, 1.7, 0);
  s.shadowBox(0, 0, 0, 2.6, 3.8, 1.5);
  return s.done();
}

export function orderEngine(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(1503, detail);
  for (const x of [-4.5, 4.5]) {
    masonry(s, x, 0, 0, 3, 0.45, 3.8);
    masonry(s, x, 0.45, 0, 2.5, 2.1, 3.2);
    masonry(s, x, 2.55, 0, 3, 0.35, 3.8, true);
    s.box(x, 2.4, 0, 2.65, 0.15, 3.4, P.gold);
  }
  s.at(0, 4.6, 0, { rz: -Math.PI / 2 }, () => {
    turned(s, 0, -5.7, 0, 1.45, 1.45, 11.4, [P.gold, P.butter, P.lamp], 2);
    for (const y of [-5.6, -4.4, 4.4, 5.6]) {
      const r = Math.abs(y) === 4.4 ? 2 : 1.55;
      s.lathe(
        0,
        y - 0.18,
        0,
        [
          [r - 0.12, 0],
          [r, 0.07],
          [r, 0.29],
          [r - 0.12, 0.36],
        ],
        brass,
        { sides: 32, skin: 'flat', key: 0.5, cavity: 0.1 },
      );
    }
  });
  for (const y of [3.3, 5.9]) s.box(0, y, 0.65, 8.6, 0.18, 0.18, P.gold);
  seal(s, 0, 6.05, 0.3, 2.03);
  for (const x of [-1.7, 1.7]) {
    for (const sign of [-1, 1]) {
      const points: number[] = [],
        hints: number[] = [],
        tris: number[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16,
          z = 1.1 + 2.9 * t,
          y = 0.18 + 3.25 * Math.pow(1 - t, 3);
        for (const [dx, dy] of [
          [-0.6, 0],
          [0.6, 0],
          [0.6, 0.32],
          [-0.6, 0.32],
        ]) {
          points.push(x + dx, y + dy, sign * z);
          hints.push(dx, dy === 0 ? -0.3 : 1, sign * 0.4);
        }
        if (i < 16)
          for (let j = 0; j < 4; j++) {
            const a = i * 4 + j,
              b = i * 4 + ((j + 1) % 4);
            tris.push(a, b, b + 4, a, b + 4, a + 4);
          }
      }
      s.mesh(points, tris, brass, { hints, skin: 'flat', key: 0.45, crease: 0.7, cavity: 0.1 });
    }
    s.box(x, 0.33, 3.5, 0.7, 0.08, 1, x > 0 ? P.lampHot : P.slate, { glow: x > 0 ? 2 : 0 });
  }
  s.light(0, 4.6, 0);
  s.light(1.7, 0.3, 3.5);
  s.shadowBox(0, 2.9, 0, 11.4, 3.5, 3.8);
  for (const x of [-4.5, 4.5]) s.shadowBox(x, 0, 0, 3, 2.9, 3.8);
  return s.done();
}

function watchDoor(s: Shape) {
  const points: Point[] = [
    [0, 0, 0],
    [1.9, 0, 0],
    [1.9, 1.7, 0],
  ];
  for (let i = 1; i <= 12; i++)
    points.push([
      0.95 + 0.95 * Math.cos((i * Math.PI) / 12),
      1.7 + 0.95 * Math.sin((i * Math.PI) / 12),
      0,
    ]);
  s.poly(points, [P.wood, P.tan, P.plank], { two: true, skin: 'grain' });
  seal(s, 0.95, 1.5, 0.13, 0.43);
}
/** Door pivot [-.95,.4,2.88], rotate about Y. Caller supplies floor and collision. */
export function watchPostParts(detail = 1) {
  const door = new Shape(1514, detail);
  watchDoor(door);
  return { fixed: watchPost(0, undefined, detail, false), door: door.done() };
}

export function watchPost(_variant = 0, _def?: unknown, detail = 1, closed = true) {
  const s = new Shape(1504, detail);
  masonry(s, 0, 0, 0, 6, 0.4, 6);
  spandrel(s, 1.9, 2.65, 0.4, 2.76);
  // Square tapered shaft, broad plaster faces.
  // Four tapered wall faces leave a real entrance, with an interior behind it.
  for (let side = 0; side < 4; side++)
    s.at(0, 0, 0, (side * Math.PI) / 2, () => {
      const face = (l: number, r: number, base: number, top: number) => {
        const depth = (y: number) => 2.79 - ((y - 0.4) * 0.56) / 6.5;
        const pts = [
          Math.max(l, -depth(base)),
          base,
          depth(base),
          Math.min(r, depth(base)),
          base,
          depth(base),
          Math.min(r, depth(top)),
          top,
          depth(top),
          Math.max(l, -depth(top)),
          top,
          depth(top),
        ];
        s.mesh(pts, [0, 1, 2, 0, 2, 3], plaster, {
          hints: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
          skin: 'plaster',
          key: 0.2,
        });
      };
      if (side === 0) {
        face(-2.79, -0.95, 0.4, 3.05);
        face(0.95, 2.79, 0.4, 3.05);
        face(-2.79, 2.79, 3.05, 6.9);
      } else {
        s.mesh(
          [-2.79, 0.4, 2.79, 2.79, 0.4, 2.79, 2.23, 6.9, 2.23, -2.23, 6.9, 2.23],
          [0, 1, 2, 0, 2, 3],
          plaster,
          { hints: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], skin: 'plaster', key: 0.2 },
        );
      }
    });
  for (const [y, w] of [
    [0.4, 5.65],
    [3.5, 5.15],
    [6.8, 4.6],
  ])
    s.box(0, y, 0, w, 0.2, w, y === 0.4 ? P.plaster : P.gold, { bevel: 0.04 });
  s.at(0, 0.4, 2.8, 0, () => {
    opening(s, 1.9, 2.65, P.wood, 0, false);
    if (closed) s.at(-0.95, 0, 0.08, 0, () => watchDoor(s));
  });
  for (let side = 0; side < 4; side++)
    s.at(0, 0, 0, (side * Math.PI) / 2, () => {
      s.at(0, 4.3, 2.4, 0, () => opening(s, 0.32, 1.35, P.lamp, 1));
      s.light(0, 5, 2.5);
    });
  for (const x of [-2, 2])
    for (const z of [-2, 2]) {
      masonry(s, x, 7, z, 0.55, 1.85, 0.55, true);
      s.box(x, 8.65, z, 0.7, 0.2, 0.7, stone);
    }
  s.box(0, 8.85, 0, 5.6, 0.18, 5.6, P.gold, { bevel: 0.04 });
  s.lathe(
    0,
    9.03,
    0,
    [
      [2.8, 0],
      [2.8, 0.07],
      [0.12, 0.94],
      [0, 0.97],
    ],
    brass,
    { sides: 16, square: 1, skin: 'flat', key: 0.45, crease: 0.5 },
  );
  s.shadowBox(0, 0, 0, 5.3, 7, 5.3);
  return s.done();
}

export function dawnDome(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(1505, detail);
  // Six broad sectors. Shared vertices/normals erase horizontal cylinder bands.
  const sides = detail < 1 ? 48 : 72,
    rings = detail < 1 ? 10 : 20;
  const points: number[] = [],
    hints: number[] = [],
    tris: number[] = [];
  for (let j = 0; j <= rings; j++)
    for (let i = 0; i <= sides; i++) {
      const t = ((j / rings) * Math.PI) / 2,
        a = (i / sides) * TAU;
      const x = 59.5 * Math.cos(t) * Math.cos(a),
        y = 59.5 * Math.sin(t),
        z = 59.5 * Math.cos(t) * Math.sin(a);
      points.push(x, y, z);
      hints.push(x, y, z);
      if (j < rings && i < sides) {
        const n = j * (sides + 1) + i;
        tris.push(n, n + 1, n + sides + 1, n + 1, n + sides + 2, n + sides + 1);
      }
    }
  s.mesh(points, tris, [P.ochre, P.gold, P.butter], {
    hints,
    skin: 'flat',
    glow: 2,
    light: 0.25,
    key: 0.12,
    cavity: 0,
    mottle: 0.035,
  });
  for (let k = 0; k < 6; k++) {
    const a = (k * TAU) / 6,
      path: Point[] = [];
    for (let j = 0; j <= 24; j++) {
      const t = (j * Math.PI) / 48;
      path.push([
        59.94 * Math.cos(t) * Math.cos(a),
        59.94 * Math.sin(t),
        59.94 * Math.cos(t) * Math.sin(a),
      ]);
    }
    s.tube(
      path,
      path.map(() => 0.1),
      4,
      P.lampHot,
      { glow: 2, cap: 'none' },
    );
  }
  // A continuous distant skyline, projected just outside the opaque shell.
  // The city is a relief, not traversable buildings or a transparent interior.
  for (let k = 0; k < 96; k++) {
    const a = (k * TAU) / 96,
      h = k % 16 === 0 ? 18 : k % 8 === 0 ? 10 : 2.5 + s.r() * 4;
    s.at(0, 0, 0, a, () => {
      const project = (x: number, y: number): Point => [x, y, Math.sqrt(3599 - y * y - x * x)];
      for (let y = 0; y < h; y += 2) {
        const top = Math.min(h, y + 2);
        s.poly([project(-2, y), project(2, y), project(2, top), project(-2, top)], P.oakDark, {
          glow: 2,
          toward: [0, 0, 1],
          skin: 'flat',
        });
      }
      if (h > 8)
        s.poly([project(-0.8, h), project(0.8, h), project(0, h + 3)], P.oakDark, {
          glow: 2,
          toward: [0, 0, 1],
          skin: 'flat',
        });
    });
  }
  s.light(0, 30, 0);
  return s.done();
}
