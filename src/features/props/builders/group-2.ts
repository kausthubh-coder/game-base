import { ashlar } from '../arch.ts';
// Hearth limestone follows assets-src/concept/stone.md, overriding the older prop palette.
import { Shape } from '../shape.ts';
type V = [number, number, number];
const STONE = 0xdec398,
  LIGHT = 0xf4deb2,
  SHADE = 0x9c91a7;
const MOSS = 0xa0a18e,
  TEAL = 0x648f88,
  ROOT = 0x98613c,
  RIDGE = 0xc68b50;

const LIMESTONE = [SHADE, STONE, LIGHT];
const PALE_MOSS = [0x878675, MOSS, 0xb8b6a0];
const MASONRY = { skin: 'limestone' as const, round: 0.06, key: 0.3, moss: 0.12, mossTone: PALE_MOSS };

function root(s: Shape, points: V[], radius: number, tip = 0.05) {
  s.sweep(
    points,
    points.map((_, i) => radius + ((tip - radius) * i) / (points.length - 1)),
    [0x70565d, ROOT, RIDGE],
    {
      sides: 12,
      steps: 3,
      ribs: [7, 0.16],
      lump: 0.055,
      skin: 'barkOld',
      key: 0.35,
      moss: 0.22,
      mossTone: PALE_MOSS,
      floor: 0,
    },
  );
}
function moss(s: Shape, x: number, y: number, z: number, r = 0.65) {
  s.rock(x, y, z, r * 2, 0.12, r * 0.96, PALE_MOSS, {
    level: 1,
    seat: false,
    skin: 'moss',
    shadow: false,
  });
}
function leaf(s: Shape, x: number, y: number, z: number, scale = 1) {
  s.tube(
    [
      [x, y, z],
      [x, y + scale * 1.6, z],
    ],
    [0.035 * scale, 0.025 * scale],
    4,
    SHADE,
  );
  for (const side of [-1, 1])
    for (let i = 0; i < 2; i++) {
      const yy = y + scale * (0.35 + i * 0.65);
      s.poly(
        [
          [x, yy, z],
          [x + side * scale * 0.55, yy + scale * 0.3, z],
          [x + side * scale * 0.55, yy + scale * 0.65, z],
          [x + side * scale * 0.18, yy + scale * 0.5, z + 0.035],
        ],
        STONE,
        { toward: [0, 0, 1] },
      );
      s.tube(
        [
          [x, yy, z + 0.02],
          [x + side * scale * 0.5, yy + scale * 0.55, z + 0.025],
        ],
        [0.025 * scale, 0.01],
        4,
        SHADE,
      );
    }
}
// Extruded annular wedges, open at their centre. Also used for the three recessed sockets.
function ring(
  s: Shape,
  x: number,
  y: number,
  z: number,
  outer: number,
  inner: number,
  depth: number,
  start = 0,
  end = Math.PI * 2,
  count = 24,
  squash = 1,
) {
  count = Math.max(12, Math.round(count * s.detail));
  // Continuous bevelled annulus: eight radial/depth bands, no internal wedge walls.
  const profile = [
    [inner, z - depth + 0.04],
    [inner + 0.04, z - depth],
    [outer - 0.04, z - depth],
    [outer, z - depth + 0.04],
    [outer, z - 0.04],
    [outer - 0.04, z],
    [inner + 0.04, z],
    [inner, z - 0.04],
  ];
  const points: number[] = [],
    triangles: number[] = [];
  for (let i = 0; i <= count; i++) {
    const a = start + ((end - start) * i) / count;
    for (const [r, zz] of profile)
      points.push(x + Math.cos(a) * r, y + Math.sin(a) * r * squash, zz);
  }
  for (let i = 0; i < count; i++)
    for (let j = 0; j < 8; j++) {
      const a = i * 8 + j,
        b = i * 8 + ((j + 1) % 8),
        c = b + 8,
        d = a + 8;
      triangles.push(a, d, b, b, d, c);
    }
  s.mesh(points, triangles, LIMESTONE, {
    skin: 'stone',
    crease: 0.65,
    key: 0.3,
    moss: 0.08,
    mossTone: PALE_MOSS,
  });
}
export function terraceWall(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(2001, detail);
  // Unbevelled end planes keep the join exact; painted ashlar supplies the face seams.
  ashlar(s, 0, 0, 1.325, 12, 5.65, 2.56, { tone: LIMESTONE, relief: 0.045, course: 1.1, chip: 0.4, moss: 0.16, faces: '+z-z' });
  s.box(0, 0, 1.5, 12, 0.4, 3, LIMESTONE, { skin: 'stone' });
  s.box(0, 5.55, 1.5, 12, 0.25, 3, TEAL, { skin: 'stone' });
  for (const x of [-5.65, 5.65]) {
    ashlar(s, x, 0.4, 1.5, 0.7, 5.35, 2.91, { tone: LIMESTONE, relief: 0.045, course: 1.1, faces: '+z-z', chip: 0.4 });
    s.box(x, 5.75, 1.5, 0.7, 0.25, 3, TEAL, { skin: 'stone' });
    leaf(s, x, 4.85, 3.015, 0.35);
  }
  ring(s, 0, 2.9, 3.04, 4.7, 3.8, 0.28, 0.12, Math.PI - 0.12, 20, 0.5);
  leaf(s, 0, 3.65, 3.02, 0.8);
  for (const side of [-1, 1]) {
    root(
      s,
      [
        [side * 3.8, 5.55, 0.5],
        [side * 3.3, 5.55, 3.05],
        [side * 3.6, 4.6, 3.05],
        [side * 3, 3.2, 3.08],
        [side * 4.1, 1.5, 3.02],
      ],
      0.5,
    );
    moss(s, side * 3.3, 5.82, 1.5, 0.8);
    moss(s, side * 3, 0.4, 2.7);
  }
  s.shadowBox(0, 0, 1.5, 12, 6, 3);
  s.weather(0, { moss: 0.9, wear: 0.5 });
  return s.done();
}
export function terraceStair(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(2002, detail);
  // Front +z; twenty .6-deep treads, each .3 above the previous one.
  for (let i = 0; i < 20; i++) {
    const y = (i + 1) * 0.3,
      z = 5.7 - i * 0.6;
    s.box(0, 0, z, 8, y, 0.6, LIMESTONE, { skin: 'stone' });
    ashlar(s, 0, y - 0.09, z, 8, 0.09, 0.6, { tone: LIMESTONE, relief: 0, chamfer: 0.025, chip: 0.5, moss: 0.1, faces: '+z+y' });
    for (const side of [-1, 1])
      s.box(side * 4.5, 0, z, 1, y + 0.48, 0.6, LIMESTONE, { skin: 'stone' });
  }
  for (const side of [-1, 1]) {
    s.at(side * 4.5, 0.95, 5.5, { rx: Math.atan(0.5) }, () =>
      s.box(0, 0, -Math.sqrt(151.25) / 2, 1, 0.15, Math.sqrt(151.25), LIMESTONE, { skin: 'stone' }),
    );
    for (const [z, y] of [
      [5.5, 0],
      [-5.5, 5.7],
    ]) {
      s.roundBox(side * 4.5, y, z, 1, 1.1, 1, LIMESTONE, { ...MASONRY, round: 0.05 });
      s.roundBox(side * 4.5, y + 1.1, z, 1, 0.18, 1, TEAL, { ...MASONRY, round: 0.04 });
      leaf(s, side * 4.5, y + 0.15, z + 0.51, 0.45);
    }
    root(
      s,
      [
        [side * 4.8, 5.9, -5.5],
        [side * 4.8, 4, -3],
        [side * 4.8, 2, -0.5],
        [side * 4.8, 0.18, 4.8],
      ],
      0.2,
    );
    moss(s, side * 4.4, 0.12, 5, 0.45);
  }
  s.shadowBox(0, 0, 0, 10, 3, 12);
  s.shadowBox(0, 3, -3, 10, 3, 6);
  s.weather(0, { moss: 0.9, wear: 0.5 });
  return s.done();
}
export const OLD_GATE_PIVOT = [0, 6.7, 2.05] as const;
function gateBody(s: Shape) {
  // A ring through the backing leaves the same bore clear when the disc is removed.
  ring(s, 0, 6.7, 1.7, 6.7, 5.15, 2.2, 0, Math.PI * 2, 36);
  for (const side of [-1, 1]) {
    ashlar(s, side * 6.05, 0, 0.6, 1.9, 12.8, 2.11, { tone: LIMESTONE, relief: 0.045, course: 1.15, faces: '+z-z', chip: 0.4, moss: 0.15 });
    ashlar(s, side * 6.05, 0, 0.6, 1.9, 12.8, 2.2, { tone: LIMESTONE, relief: 0, course: 1.15, faces: '+x-x+y', flat: true });
  }
  ring(s, 0, 6.7, 2.5, 6.7, 5.15, 0.8, 0, Math.PI * 2, 36);
  for (const a of [Math.PI / 6, Math.PI / 2, (Math.PI * 5) / 6]) {
    const x = Math.cos(a) * 5.9,
      y = 6.7 + Math.sin(a) * 5.9;
    s.tube(
      [
        [x, y, 2.5],
        [x, y, 2.53],
      ],
      [0.68, 0.68],
      16,
      0x493b3c,
      { cap: 'both' },
    );
    ring(s, x, y, 2.85, 0.95, 0.69, 0.34, 0, Math.PI * 2, 16);
  }
  for (const side of [-1, 1]) {
    s.roundBox(side * 5.7, 0, 2, 2.6, 0.55, 2, LIMESTONE, { ...MASONRY, round: 0.06 });
    s.roundBox(side * 5.7, 0.55, 2, 2, 2.1, 1.7, LIMESTONE, { ...MASONRY, round: 0.06 });
    s.roundBox(side * 5.7, 2.65, 2, 2.2, 0.3, 1.9, TEAL, { ...MASONRY, round: 0.06 });
    leaf(s, side * 5.7, 1, 2.88, 0.65);
    moss(s, side * 3.8, 12.85, 0.4, 1.1);
  }
  for (let i = 0; i < 3; i++)
    s.roundBox(0, i * 0.2, 3.8 - i * 0.35, 8, 0.2, 1.4, LIMESTONE, { ...MASONRY, round: 0.03 });
  s.shadowBox(-6, 0, 0.6, 2, 12.8, 2.2);
  s.shadowBox(6, 0, 0.6, 2, 12.8, 2.2);
}
function gateDisc(s: Shape) {
  // Closed disk, separated by a dark central joint; no light in the empty sockets.
  s.tube(
    [
      [0, 6.7, 1.7],
      [0, 6.7, 2.05],
    ],
    [5.05, 5.05],
    48,
    STONE,
    { cap: 'both', skin: 'stone' },
  );
  ring(s, 0, 6.7, 2.12, 4.65, 4.55, 0.08);
  ring(s, 0, 6.7, 2.13, 3.85, 3.78, 0.08);
  s.box(0, 1.65, 2.075, 0.055, 10.1, 0.035, SHADE);
  leaf(s, 0, 4, 2.16, 2.3);
  for (const side of [-1, 1]) {
    root(
      s,
      [
        [side * 4.3, 12.8, 0],
        [side * 4.6, 12.1, 2.4],
        [side * 5.5, 9.6, 2.6],
        [side * 2.9, 5.95, 2.7],
        [side * 1.3, 3.6, 2.7],
        [side * 5, 0.25, 2.7],
      ],
      0.6,
    );
  }
}
/** Closed registry model. Use the parts instead when opening, never both. */
export function oldGate(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(2003, detail);
  gateBody(s);
  gateDisc(s);
  s.weather(0, { moss: 0.9, wear: 0.5 });
  return s.done();
}
/** Place disc at pivot; slide it toward +z out of its rebate, then raise it to open.
 * The bound roots belong to the disc. The caller supplies passage collision and the opening animation. */
export function oldGateParts(detail = 1) {
  const body = new Shape(2003, detail),
    moving = new Shape(2004, detail);
  gateBody(body);
  moving.at(-OLD_GATE_PIVOT[0], -OLD_GATE_PIVOT[1], -OLD_GATE_PIVOT[2], 0, () => gateDisc(moving));
  const disc = moving.done();
  disc.name = 'oldGate-disc';
  return { stationary: body.done(), disc, pivot: OLD_GATE_PIVOT };
}
export function giantRoot(variant: number, _def?: unknown, detail = 1) {
  const s = new Shape(2010 + variant, detail);
  const paths: V[][] = [
    [
      [-7.7, 0.1, 0],
      [-5, 3, 0.25],
      [-1.8, 5.7, 0],
      [1.8, 6.1, 0.2],
      [5, 3.7, 0],
      [7.7, 0.05, 0],
    ],
    [
      [-7.7, 0.1, 0],
      [-5, 1.1, 0.4],
      [-2, 0.9, -0.2],
      [2, 2.2, 0],
      [4.5, 1.6, 0.4],
      [7.7, 0.05, 0],
    ],
    [
      [-7.7, 0.1, 0],
      [-5.5, 2.9, 0.2],
      [-1.5, 3.9, -0.5],
      [3, 4.1, -0.4],
      [6.8, 3.9, 0],
      [7.3, 3.6, 1.2],
      [5.6, 3.4, 1.6],
    ],
  ];
  root(s, paths[variant] ?? paths[0], 0.95, variant === 2 ? 0.25 : 0.65);
  root(
    s,
    paths[variant].map(([x, y, z]) => [x, y * 0.96, z + 0.55] as V),
    0.45,
    variant === 2 ? 0.08 : 0.25,
  );
  root(
    s,
    [
      [-7, 0.05, 1.6],
      [-5.3, 1.9, 0.8],
      [-4, 3 * (variant === 0 ? 1 : 0.6), 0.5],
    ],
    0.55,
    0.12,
  );
  for (let i = 1; i < 5; i++) {
    const p = paths[variant][i];
    moss(
      s,
      p[0],
      p[1] +
        0.95 * (1 - i / (paths[variant].length - 1)) +
        (0.65 * i) / (paths[variant].length - 1),
      p[2],
      0.65,
    );
  }
  s.shadowBlob(-4, 1, 0, 3, 1.4, 1.2);
  s.shadowBlob(1, variant === 0 ? 5 : 2, 0, 4, 0.8, 0.8);
  s.weather(0, { moss: 0.8, wear: 0.45 });
  const g = s.done();
  // Keep underground tube ends on the placement plane; enforce the sheet's envelope.
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, Math.max(0, pos.getY(i)));
  g.computeBoundingBox();
  const bounds = g.boundingBox!;
  const width = bounds.max.x - bounds.min.x;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, ((pos.getX(i) - (bounds.max.x + bounds.min.x) / 2) * 16) / width);
    pos.setY(i, Math.min([7, 3, 5][variant], pos.getY(i)));
  }
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
export function colossus(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(2020, detail);
  const lump = (
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    tone = STONE,
  ) =>
    s.rock(
      x,
      Math.max(0, y - ry),
      z,
      rx * 2,
      ry * 2,
      rz * 2,
      tone === LIGHT ? [STONE, LIGHT] : LIMESTONE,
      {
        level: rx < 2 ? 1 : 2,
        seat: false,
        lump: 0.015,
        planes: 7,
        reach: 0.7,
        flat: 1,
        crease: 0.45,
        skin: 'limestone',
        key: 0.35,
        moss: 0.1,
        mossTone: PALE_MOSS,
      },
    );
  // Supine figure runs along X, crown at -15, heels at +15.
  lump(-2, 2, 0, 6.8, 2.9, 4.6);
  lump(5, 1.9, 0, 3.7, 2.6, 3.6);
  for (const z of [-1.9, 1.9]) {
    lump(10, 1.4, z, 4.5, 1.9, 1.5);
    lump(14, 1.5, z, 0.9, 2.3, 1.5);
  }
  lump(-10.8, 3.3, 0, 3.6, 2.5, 3.1);
  lump(-10.1, 5.1, 0, 2.7, 0.95, 2.4, LIGHT);
  // Nose, closed eyelids, brows and mouth all face skyward.
  s.poly(
    [
      [-11.4, 5.95, -0.4],
      [-9.6, 5.95, -0.65],
      [-9.8, 7, 0],
      [-11.4, 6.2, 0],
    ],
    LIGHT,
    { toward: [0, 1, 0] },
  );
  s.poly(
    [
      [-11.4, 6.2, 0],
      [-9.8, 7, 0],
      [-9.6, 5.95, 0.65],
      [-11.4, 5.95, 0.4],
    ],
    STONE,
    { toward: [0, 1, 0] },
  );
  s.poly(
    [
      [-9.6, 5.95, -0.65],
      [-9.6, 5.95, 0.65],
      [-9.8, 7, 0],
    ],
    SHADE,
    { toward: [1, 1, 0] },
  );
  for (const z of [-1.15, 1.15]) {
    s.sweep(
      [
        [-11.4, 5.95, z * 0.5],
        [-11.3, 6.15, z],
        [-10.8, 5.9, z * 1.5],
      ],
      [0.19, 0.23, 0.1],
      LIMESTONE,
      { sides: 8, steps: 2, cap: 'none', skin: 'stone', key: 0.3 },
    );
    s.sweep(
      [
        [-11.1, 6.0, z * 0.65],
        [-10.9, 6.02, z],
        [-10.65, 5.85, z * 1.4],
      ],
      [0.055, 0.07, 0.03],
      [SHADE, STONE],
      { sides: 8, steps: 2, cap: 'none', skin: 'stone', key: 0.3 },
    );
  }
  s.sweep(
    [
      [-8.8, 5.95, -0.8],
      [-8.65, 6.15, 0],
      [-8.8, 5.95, 0.8],
    ],
    [0.1, 0.12, 0.07],
    [SHADE, STONE],
    { sides: 8, steps: 2, cap: 'none', skin: 'stone', key: 0.3 },
  );
  for (let i = 0; i < 5; i++) {
    const z = -2.7 + i * 1.35;
    s.sweep(
      [
        [-12, 5.9, z * 0.6],
        [-13.8, 5.3, z],
        [-14, 3, z * 1.1],
        [-12.8, 1.2, z * 1.15],
      ],
      [0.5, 0.6, 0.45, 0.15],
      LIMESTONE,
      { sides: 8, steps: 2, cap: 'none', skin: 'stone', key: 0.3 },
    );
  }
  // Raised robe ribbons follow the chest instead of disappearing inside it.
  for (let i = 0; i < 5; i++) {
    const z = -4 + i * 2;
    const path: V[] = [
      [-5, 4.85, 0],
      [-3, 5.35 - Math.abs(z) * 0.12, z * 0.4],
      [0, 4.95 - Math.abs(z) * 0.2, z * 0.7],
      [3.5, 3.65 - Math.abs(z) * 0.12, z * 0.85],
      [5, 2.7, z],
    ];
    s.sweep(path, [0.35, 0.45, 0.38, 0.3, 0.12], LIMESTONE, {
      sides: 8,
      steps: 2,
      cap: 'none',
      squash: 0.5,
      skin: 'stone',
    });
  }
  s.at(-5, 5.1, 0, { rx: -Math.PI / 2 }, () => leaf(s, 0, 0, 0, 0.9));
  lump(1.5, 2, 4, 3.5, 1.6, 0.9);
  lump(5, 3.4, 2.8, 1.8, 0.65, 1.1, LIGHT);
  for (let i = 0; i < 4; i++)
    s.sweep(
      [
        [5, 3.9, 2 + i * 0.45],
        [6.6, 3.7, 2.2 + i * 0.45],
        [7, 3.1, 2.3 + i * 0.45],
      ],
      [0.25, 0.22, 0.16],
      LIMESTONE,
      { sides: 8, steps: 2, cap: 'none', skin: 'stone', key: 0.3 },
    );
  lump(-1, 0.55, 4.3, 2.6, 0.55, 0.6);
  root(
    s,
    [
      [13, 0.1, 3.5],
      [8, 1.5, 3.2],
      [5, 3.6, 2.5],
      [3, 2.6, 3.8],
      [-2, 0.1, 4],
    ],
    0.6,
  );
  for (const x of [-12, -7, 0, 6, 11]) {
    s.rock(x, 0, -2.8, 6.2, 1.3, 4.3, PALE_MOSS, {
      level: 1,
      skin: 'mud',
      moss: 0.6,
      mossTone: PALE_MOSS,
    });
    moss(s, x, 0.45, 3.6, 1.2);
  }
  s.weather(0, { moss: 0.8, wear: 0.45 });
  const g = s.done();
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setY(i, Math.max(0, pos.getY(i)));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
