// Hearth limestone ruins. Colours follow assets-src/concept/stone.md, overriding the old prop palette.
import { P } from '../palette.ts';
import { ashlar, ashlarRing, stoneArch, stoneBlock } from '../arch.ts';
import { Shape } from '../shape.ts';

const stone = 0xdec398,
  sun = 0xf4deb2,
  shade = 0x9c91a7,
  moss = 0x89936b;
const root = 0x98613c,
  brass = 0xb58c47;
const tones = [shade, stone, sun];
const masonry = {
  skin: 'stone' as const,
  key: 0.35,
  mottle: 0.3,
  cavity: 0.28,
  moss: 0.12,
  mossTone: [moss, 0xa0a18e],
};
function block(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number) {
  const start = s.mark();
  const options = { tone: tones, relief: 0, chamfer: Math.min(0.09, h / 5),
    course: 0.95, chip: 0.45, vary: 0.35, moss: 0.16 };
  if (h < 0.8) stoneBlock(s, x, y, z, w, h, d, { ...options, faces: '+z-z+x-x+y' });
  else ashlar(s, x, y, z, w - 0.08, h - 0.04, d - 0.08, { ...options, relief: 0.04 });
  s.weather(start, { moss: 0.9, wear: 0.6, stains: [[x, y + h, z + d / 2, w * 0.4, h * 0.7]] });
}
function growth(s: Shape, x: number, y: number, z: number, r = 0.5) {
  s.rock(x, y, z, r * 2, 0.12, r, [0x697452, moss, 0xa0a18e], {
    level: 1,
    seat: false,
    skin: 'moss',
    shadow: false,
    lump: 0.2,
  });
  // Small overlapping leaves make a ragged edge below a damp ledge.
  for (let i = 0; i < 4 && y > 0.5; i++) {
    const px = x + (i - 1.5) * r * 0.32;
    s.poly(
      [
        [px, y + 0.02, z + r * 0.45],
        [px + 0.12, y - r * 0.6, z + r * 0.5],
        [px - 0.08, y - r * 0.85, z + r * 0.48],
      ],
      moss,
      { two: true, skin: 'moss' },
    );
  }
}
function arch(
  s: Shape,
  x: number,
  y: number,
  z: number,
  radius: number,
  thickness: number,
  depth: number,
) {
  for (let i = 0; i < 9; i++) {
    const a = (i * Math.PI) / 9 + 0.012,
      b = ((i + 1) * Math.PI) / 9 - 0.012;
    const r = radius,
      R = r + thickness;
    const points = [
      [r * Math.cos(a), r * Math.sin(a)],
      [R * Math.cos(a), R * Math.sin(a)],
      [R * Math.cos(b), R * Math.sin(b)],
      [r * Math.cos(b), r * Math.sin(b)],
    ];
    for (const dz of [-depth / 2, depth / 2])
      s.poly(
        points.map(([px, py]) => [x + px, y + py, z + dz]),
        stone,
        { toward: [0, 0, Math.sign(dz)], skin: 'stone' },
      );
    for (let k = 0; k < 4; k++) {
      const p = points[k],
        q = points[(k + 1) % 4];
      s.poly(
        [
          [x + p[0], y + p[1], z - depth / 2],
          [x + q[0], y + q[1], z - depth / 2],
          [x + q[0], y + q[1], z + depth / 2],
          [x + p[0], y + p[1], z + depth / 2],
        ],
        k === 2 ? sun : stone,
        { two: true, skin: 'stone' },
      );
    }
  }
}
function roots(s: Shape, x: number, y: number, z: number) {
  for (let i = 0; i < 3; i++)
    s.sweep(
      [
        [x, y + 2.8, z],
        [x + 0.15, y + 1.2, z + 0.25],
        [x + (i - 1) * 0.65, y + 0.3, z + 0.7],
        [x + (i - 1) * 1.1, y + 0.06, z + 1.25],
      ],
      [0.22, 0.28, 0.2, 0.035],
      [0x665048, root, 0xc68b50],
      { sides: 8, steps: 2, skin: 'barkOld', floor: 0, ribs: [5, 0.04], sways: [0, 0, 0, 0] },
    );
}

/** Hollow room; front doorway clears 2.8 wide by 2.5 to spring, 3.9 at crown. */
export function sunkTower(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(6001, detail);
  const r = 4,
    thick = 0.9,
    ri = r - thick,
    stoneO = { tone: tones, moss: 0.42, mossTone: [0x697452, moss, 0xa0a18e], course: 0.95, long: [1.2, 2.4] as const, chip: 0.35, vary: 0.36, chamfer: 0.11, relief: 0.06 };
  // The crown: high on the left and behind, a deep gap broken out of the front right, ragged stone by stone.
  // A stretch is 1/36 turn, about one block.
  const tops = Array.from({ length: 36 }, (_, i) => {
    const a = -Math.PI + ((i + 0.5) / 36) * Math.PI * 2, gap = Math.exp(-((a / 0.85) ** 2));
    return 10.6 - gap * 5.5 + (i % 3 === 1 ? -0.9 : 0) + (i > 20 && i < 30 ? 0.9 : 0);
  });
  const door = Math.asin(2.15 / r),
    side = -Math.PI / 3;
  ashlarRing(s, 0, 0, 0, r, 11, {
    ...stoneO,
    thick,
    from: -Math.PI,
    to: Math.PI,
    tops,
    holes: [
      { from: -door, to: door, bottom: 0, top: 4.6 },
      { from: side - 0.17, to: side + 0.17, bottom: 4.7, top: 7.4 },
    ],
  });
  // The doorway: a deep ring of voussoirs on jambs, standing a little proud of the curve, through the wall.
  const front = r + 0.15;
  stoneArch(s, 0, 0, front, 2.8, 2.5, {
    ...stoneO,
    ring: 0.68,
    key: 0.16,
    course: 0.85,
    spandrels: true,
    behind: (x) => Math.sqrt(Math.max(0, ri * ri - x * x)) - front,
  });
  // The tall side window, facing -x.
  s.at(0, 0, 0, -Math.PI / 3, () => {
    const face = r + 0.1;
    stoneArch(s, 0, 4.7, face, 0.95, 1.95, { ...stoneO, ring: 0.3, course: 0.65, spandrels: true, behind: (x) => Math.sqrt(Math.max(0, ri * ri - x * x)) - face });
    stoneBlock(s, 0, 4.5, face - 0.05, 1.9, 0.22, 0.5, { ...stoneO, faces: '+z+x-x+y', moss: 0.3 });
  });
  // The broken armillary is open brass, never a filled globe.
  for (const tilt of [-0.35, 0.55])
    s.at(0, 10, -1.2, { rx: tilt }, () => {
      const path: [number, number, number][] = [];
      for (let i = 0; i <= 14; i++) {
        const a = 0.15 + (i * Math.PI * 0.85) / 14;
        path.push([2.4 * Math.cos(a), 2.4 * Math.sin(a) * 0.75, 0]);
      }
      s.tube(
        path,
        path.map(() => 0.1),
        5,
        brass,
        { cap: 'both' },
      );
    });
  s.tube(
    [
      [-0.9, 10.3, -1.4],
      [0.6, 12, -1],
    ],
    [0.1, 0.07],
    5,
    brass,
    { cap: 'both' },
  );
  // Cart-thick roots from the old tree behind, over the rear wall and down the slope, prying at its foot.
  const bark = [0x665048, root, 0xc68b50];
  for (const [a, reach, high] of [[3.7, 1.5, 5.2], [4.1, 1.2, 4], [4.45, 1.6, 3.2]] as const) {
    const out = (rad: number, angle: number, y: number): [number, number, number] => [Math.sin(angle) * rad, y, Math.cos(angle) * rad];
    s.sweep([out(r - 0.3, a + 0.12, high + 0.6), out(r + 0.35, a + 0.06, high), out(r + 0.55, a, high * 0.5), out(r + 0.6 + reach * 0.4, a - 0.05, 0.5), out(r + reach, a - 0.1, -0.05)], [0.42, 0.5, 0.46, 0.34, 0.12], bark, {
      sides: 8, steps: 2, skin: 'barkOld', ribs: [6, 0.07], lump: 0.06, floor: 0, sways: [0, 0, 0, 0, 0], moss: 0.15,
    });
  }
  // Fallen blocks inside and at the foot, and the dormant memory stone in the open room.
  stoneBlock(s, 1.2, 0, -1.6, 1.4, 0.7, 0.8, { ...stoneO, faces: '+z+x-x-z+y' });
  stoneBlock(s, -1.5, 0, 1.2, 1.2, 0.6, 0.7, { ...stoneO, faces: '+z+x-x-z+y', moss: 0.4 });
  s.cyl(-0.6, 0, -1, 0.65, 0.55, 0.35, 7, stone);
  s.blob(-0.6, 1, -1, 0.4, 0.7, 0.32, 0x7e829e, { sides: 5, rings: 2, jitter: 0.08 });
  for (const a of [1.2, 2.6, 4, 5]) s.shadowBox(Math.sin(a) * 3.4, 0, Math.cos(a) * 3.4, 1.5, 7, 1.1, a);
  s.weather(0, { moss: 0.7, wear: 0.45 });
  return s.done();
}

/** Bottom-origin prop: place at terrainY - 3. Top tread is local y=3, terminal soil y=0. */
export function forestStair(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(6002, detail);
  for (let i = 0; i < 12; i++) {
    const top = 3 - i * 0.25,
      z = -4.6 + i * 0.77;
    block(s, 0, top - 0.25, z, 4.33, 0.25, 0.79);
    for (const x of [-2.6, 2.6]) {
      const wallTop = top + 0.35 + s.r() * 0.25;
      block(s, x, 0, z, 0.8, wallTop, 0.79);
      if (i % 3 === 0) growth(s, x, wallTop, z, 0.42);
    }
  }
  s.roundBox(0, 0, 4.65, 4.4, 0.06, 0.7, [P.soil, P.burlap], { skin: 'mud' });
  s.at(2.3, 0, 3.5, { scale: 0.48 }, () => roots(s, 0, 0, 0));
  s.at(2.55, 0.65, 4.3, { rx: Math.PI / 2 }, () => {
    s.cyl(0, 0, 0, 0.53, 0.53, 0.12, 14, stone);
    for (let i = 0; i < 7; i++) {
      const a = (i * Math.PI * 2) / 7;
      const r = i === 2 ? 0.33 : 0.47;
      s.poly(
        [
          [0, 0.125, 0],
          [Math.cos(a) * r, 0.125, Math.sin(a) * r],
          [Math.cos(a + 0.3) * 0.16, 0.125, Math.sin(a + 0.3) * 0.16],
        ],
        shade,
        { toward: [0, 1, 0] },
      );
    }
  });
  for (const x of [-2.6, 2.6]) s.shadowBox(x, 0, 0, 0.8, 2, 10);
  s.weather(0, { moss: 0.7, wear: 0.45 });
  return s.done();
}

// Convex flat paint shapes share the stone's material and light, without a texture or extra draw call.
function paint(s: Shape, x: number, points: number[][], colour: number, z = 1.012) {
  const cx = points.reduce((n, p) => n + p[0], 0) / points.length;
  const cy = points.reduce((n, p) => n + p[1], 0) / points.length;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    const fade = 0.12 + s.r() * 0.25;
    const mix = (shift: number) => Math.round(((colour >> shift) & 255) * (1 - fade) + ((stone >> shift) & 255) * fade);
    s.poly([[x + cx, cy, z], [x + p[0], p[1], z], [x + q[0], q[1], z]],
      (mix(16) << 16) | (mix(8) << 8) | mix(0), { toward: [0, 0, 1], skin: 'plaster' });
    if (s.detail >= 0.75 && i % 2 === 0) {
      const px = x + p[0] * 0.7 + cx * 0.3, py = p[1] * 0.7 + cy * 0.3;
      s.poly([[px, py, z + 0.002], [px + 0.12, py + 0.025, z + 0.002], [px + 0.04, py + 0.17, z + 0.002]],
        tones, { toward: [0, 0, 1], skin: 'limestone' });
    }
  }
}
export function muralWall(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(6003, detail);
  block(s, -7, 0, 0, 2, 2, 2);
  block(s, -5.75, 0, 0, 0.5, 4, 2);
  block(s, 1.25, 0, 0, 13.5, 5.65, 2);
  for (let i = 0; i < 7; i++) block(s, -4.5 + i * 1.9, 5.65, 0, 1.9, 0.35, 2);
  // Pigment sits on a weathered lime field; the eighth figure exposes stone.
  s.box(1, 0.65, 1.003, 13.8, 4.85, 0.012, stone, { grade: 0, skin: 'plaster' });
  const pigments = [0xb18042, 0x7e8c60, 0xaa725c, 0x71899d, 0x968298, 0xc1ae8f, 0x777467, 0xe7cfa7];
  for (let i = 0; i < 8; i++) {
    const x = -4.9 + i * 1.65,
      h = i === 0 ? 4.8 : 4.3;
    paint(
      s,
      x,
      [
        [-0.68, 0.85],
        [0.68, 0.85],
        [0.38, h - 1.05],
        [-0.35, h - 1.05],
      ],
      pigments[i],
    );
    paint(
      s,
      x,
      [
        [-0.3, h - 1.1],
        [0.3, h - 1.1],
        [0.42, h - 0.7],
        [0.2, h - 0.35],
        [-0.18, h - 0.3],
        [-0.37, h - 0.65],
      ],
      pigments[i],
    );
    if (i === 0)
      paint(
        s,
        x,
        [
          [-0.34, h - 0.3],
          [0.34, h - 0.3],
          [0.37, h + 0.18],
          [0.12, h],
          [-0.02, h + 0.32],
          [-0.19, h],
          [-0.4, h + 0.15],
        ],
        brass,
      );
    if (i < 7) {
      // Each companion's large emblem: crown sash, branch, scales, sail, wheel, book, hammer.
      const ink = sun;
      if (i === 0)
        paint(
          s,
          x,
          [
            [-0.48, 3.7],
            [0.46, 4],
            [0.36, 3.6],
            [-0.55, 3.3],
          ],
          ink,
          1.018,
        );
      if (i === 1)
        for (let j = 0; j < 4; j++) {
          paint(
            s,
            x,
            [
              [-0.03, 1.7],
              [0.03, 1.7],
              [0.03, 3.2],
              [-0.03, 3.2],
            ],
            ink,
            1.018,
          );
          paint(
            s,
            x,
            [
              [0, 2 + j * 0.25],
              [0.35, 2.2 + j * 0.25],
              [0.22, 2.4 + j * 0.25],
            ],
            ink,
            1.018,
          );
        }
      if (i === 2) {
        paint(
          s,
          x,
          [
            [-0.04, 1.8],
            [0.04, 1.8],
            [0.04, 3.2],
            [-0.04, 3.2],
          ],
          ink,
          1.018,
        );
        paint(
          s,
          x,
          [
            [-0.5, 2.9],
            [0.5, 2.9],
            [0.5, 3],
            [-0.5, 3],
          ],
          ink,
          1.018,
        );
        for (const dx of [-0.32, 0.32])
          paint(
            s,
            x + dx,
            [
              [-0.2, 2.25],
              [0.2, 2.25],
              [0, 2.85],
            ],
            ink,
            1.018,
          );
      }
      if (i === 3) {
        paint(
          s,
          x,
          [
            [-0.5, 2.15],
            [0.45, 2.15],
            [0.32, 1.98],
            [-0.4, 1.98],
          ],
          ink,
          1.018,
        );
        paint(
          s,
          x,
          [
            [0, 2.3],
            [0, 3.3],
            [-0.46, 2.3],
          ],
          ink,
          1.018,
        );
        paint(
          s,
          x,
          [
            [0.07, 2.3],
            [0.07, 3.2],
            [0.4, 2.3],
          ],
          ink,
          1.018,
        );
      }
      if (i === 4)
        for (let j = 0; j < 12; j++) {
          const a = (j * Math.PI) / 6,
            b = ((j + 1) * Math.PI) / 6;
          paint(
            s,
            x,
            [
              [0.44 * Math.cos(a), 2.65 + 0.44 * Math.sin(a)],
              [0.44 * Math.cos(b), 2.65 + 0.44 * Math.sin(b)],
              [0.37 * Math.cos(b), 2.65 + 0.37 * Math.sin(b)],
              [0.37 * Math.cos(a), 2.65 + 0.37 * Math.sin(a)],
            ],
            ink,
            1.018,
          );
        }
      if (i === 5)
        for (const d of [-1, 1])
          paint(
            s,
            x,
            [
              [d * 0.04, 2],
              [d * 0.44, 2.15],
              [d * 0.44, 3],
              [d * 0.04, 2.85],
            ],
            ink,
            1.018,
          );
      if (i === 6) {
        paint(
          s,
          x,
          [
            [-0.2, 1.9],
            [-0.1, 1.85],
            [0.35, 3.05],
            [0.25, 3.1],
          ],
          ink,
          1.018,
        );
        paint(
          s,
          x,
          [
            [0, 3],
            [0.5, 2.8],
            [0.62, 3.08],
            [0.12, 3.28],
          ],
          ink,
          1.018,
        );
      }
    } else {
      for (let j = 0; j < 10; j++)
        paint(
          s,
          x,
          [
            [s.rr(-0.45, 0.4), 1.1 + j * 0.27],
            [0.46, 1.15 + j * 0.27],
            [0.2, 1.22 + j * 0.27],
          ],
          stone,
          1.021,
        );
      // Surviving seated fox, with pointed ears, cream chest and curled tail.
      paint(
        s,
        x,
        [
          [-0.2, 0.8],
          [0.22, 0.8],
          [0.12, 1.3],
          [-0.12, 1.4],
        ],
        root,
        1.025,
      );
      paint(
        s,
        x,
        [
          [-0.18, 1.3],
          [-0.25, 1.66],
          [-0.04, 1.53],
          [0.15, 1.65],
          [0.2, 1.34],
          [0, 1.22],
        ],
        root,
        1.025,
      );
      paint(
        s,
        x,
        [
          [0.14, 0.82],
          [0.63, 0.82],
          [0.75, 1.08],
          [0.6, 1.22],
          [0.45, 1],
          [0.15, 1],
        ],
        root,
        1.025,
      );
      paint(
        s,
        x,
        [
          [-0.1, 1.25],
          [0.1, 1.25],
          [0.06, 0.86],
        ],
        sun,
        1.028,
      );
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = -5.3 + i * 0.7;
    paint(
      s,
      x,
      [
        [0, 5.12],
        [0.55, 5.17],
        [0.6, 5.24],
        [0, 5.2],
      ],
      moss,
      1.022,
    );
    paint(
      s,
      x,
      [
        [0.2, 5.2],
        [0.35, 5.48],
        [0.62, 5.5],
        [0.45, 5.25],
      ],
      moss,
      1.022,
    );
    const y = 0.8 + Math.sin(i * 0.5) * 0.12;
    paint(
      s,
      x,
      [
        [0, y],
        [0.73, y + 0.06],
        [0.73, y + 0.19],
        [0, y + 0.13],
      ],
      i < 9 ? 0x899aa0 : 0xb98f70,
      1.022,
    );
  }
  for (let i = 0; i < 35; i++) {
    const x = s.rr(-5.4, 7.5),
      y = s.rr(1, 5.2);
    paint(
      s,
      x,
      [
        [0, y],
        [0.08, y + 0.1],
        [0.18, y + 0.02],
      ],
      stone,
      1.03,
    );
  }
  for (let i = 0; i < 6; i++) growth(s, -2 + i * 1.7, 6, 0, 0.6);
  s.shadowBox(0, 0, 0, 16, 5, 2);
  s.weather(0, { moss: 0.7, wear: 0.45 });
  return s.done();
}

/** Door clears 2.2 x 2.1 to spring, 3.2 at crown. Fox den clears .8 x .55. */
export function deadCottage(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(6004, detail);
  for (let col = 0; col < 9; col++) {
    const x = col - 4,
      height = col < 5 ? 2 + col * 0.65 : 5.2 - (col - 5) * 0.85;
    if (col === 5) block(s, x, 0, -3.05, 1, 2.6, 0.9);
    else block(s, x, 0, -3.05, 1, Math.floor(height / 0.65) * 0.65, 0.9);
  }
  block(s, 1, 4.55, -3.05, 1, 1.2, 0.9);
  block(s, 1, 5.75, -3.05, 1.35, 0.25, 1.05);
  arch(s, 1, 3.9, -3.05, 0.5, 0.25, 0.95);
  for (const x of [-4.05, 4.05])
    for (let j = 0; j < 6; j++) {
      const z = -2.1 + j * 0.94;
      if (x > 0 && j === 3) {
        block(s, x, 0.55, z, 0.9, 0.2, 0.92);
        continue;
      }
      block(s, x, 0, z, 0.9, j % 3 === 0 ? 1.3 : 0.85, 0.94);
    }
  for (const x of [-3.1, 3.1]) block(s, x, 0, 3.05, 2.7, 1.1, 0.9);
  for (const x of [-1.45, 1.45]) block(s, x, 0, 3.05, 0.7, 2.1, 0.9);
  arch(s, 0, 2.1, 3.05, 1.1, 0.5, 0.9);
  for (let i = 0; i < 8; i++)
    block(s, s.rr(-3, 3), 0, s.rr(-2, 1), s.rr(0.4, 0.9), s.rr(0.25, 0.5), 0.6);
  for (let i = 0; i < 4; i++)
    s.at(0.7, 0, 0.5, { ry: 0.3 }, () =>
      s.box(i * 0.21, 0.04, 0, 0.19, 0.08, 1.4, P.plankDark, { bevel: 0.02, skin: 'grain' }),
    );
  growth(s, 3.8, 1.3, -1.5, 0.5);
  for (let i = 0; i < 7; i++) {
    const x = 3.6 + s.r() * 0.4,
      z = -1.8 + s.r() * 0.6;
    s.tube(
      [
        [x, 1.3, z],
        [x, 1.9 + s.r() * 0.25, z],
      ],
      [0.025, 0.015],
      4,
      moss,
    );
    s.blob(x, 1.95, z, 0.08, 0.12, 0.08, P.mauve, { sides: 5, rings: 1 });
  }
  for (const x of [-2.8, 2.8])
    for (let i = 0; i < 7; i++)
      s.tube(
        [
          [x, 0, 1.8],
          [x + s.rr(-0.45, 0.45), s.rr(0.3, 0.8), 1.8 + s.rr(-0.3, 0.3)],
        ],
        [0.035, 0.012],
        4,
        P.burlap,
      );
  s.shadowBox(0, 0, -3.05, 9, 3, 0.9);
  for (const x of [-4.05, 4.05]) s.shadowBox(x, 0, 0, 0.9, 1.3, 7);
  s.weather(0, { moss: 0.7, wear: 0.45 });
  return s.done();
}

export function colonnade(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(6005, detail);
  block(s, 0, 0, 0, 18, 0.3, 6);
  const heights = [7, 7, 2.7, 5.5];
  for (let i = 0; i < 4; i++) {
    const x = -7 + i * 4.5,
      h = heights[i];
    block(s, x, 0.3, -0.6, 2, 0.35, 2);
    s.lathe(
      x,
      0,
      -0.6,
      [
        [0.8, 0.65],
        [0.91, 0.73],
        [0.88, 0.9],
        [0.69, 1],
        [0.7, 1.2],
        [0.67, h * 0.6],
        [0.63, h - 0.2],
        [0.65, h],
      ],
      tones,
      { ...masonry, sides: 20 },
    );
    if (i !== 2) {
      s.lathe(
        x,
        0,
        -0.6,
        [
          [0.65, h - 0.2],
          [0.85, h - 0.1],
          [0.9, h + 0.05],
        ],
        tones,
        { ...masonry, sides: 20 },
      );
      block(s, x, h, -0.6, 2, 0.35, 2);
    }
    growth(s, x, 0.97, -0.1, 0.55);
    s.shadowBox(x, 0, -0.6, 1.5, h, 1.5);
  }
  block(s, -4.75, 7.35, -0.6, 7.5, 0.65, 2);
  for (const x of [-0.9, 5.8]) {
    s.sweep(
      [
        [x - 1, 0.98, 1.6],
        [x, 0.98, 1.85],
        [x + 1.2, 0.98, 2.1],
      ],
      [0.68, 0.68, 0.65],
      tones,
      { ...masonry, sides: 8, steps: 1, cap: 'both', lump: 0.08, smooth: false },
    );
    growth(s, x, 1.62, 1.8, 0.6);
  }
  for (let i = 0; i < 5; i++) growth(s, -7 + i * 1.2, 8, -0.6, 0.5);
  s.weather(0, { moss: 0.7, wear: 0.45 });
  return s.done();
}
