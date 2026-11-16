import * as THREE from 'three';
import { P } from '../palette.ts';
import { Shape } from '../shape.ts';

// Hearth limestone overrides the older palette, per assets-src/concept/stone.md.
const C = {
  stone: 0xdec398,
  top: 0xf4deb2,
  shade: 0x9c91a7,
  moss: 0x89936b,
  root: 0x98613c,
  ridge: 0xc68b50,
  brass: 0xb58c47,
  dormant: 0x7e829e,
};
type Point = [number, number, number];
const TAU = Math.PI * 2;

const STONE = [C.shade, 0xc5b49e, C.stone, C.top];
const BRASS = [0x826640, C.brass, 0xd6b76c];

/** A hewn extrusion: inset faces, rounded shoulders and broad painted planes. */
function slab(s: Shape, outline: [number, number][], back: number, front: number, tone = C.stone) {
  if (tone !== C.stone || s.detail < 0.75) {
    const paint = tone === C.stone ? STONE : BRASS;
    const skin = tone === C.stone ? 'stone' : 'flat';
    s.poly(outline.map(([x, y]) => [x, y, front]), paint, { toward: [0, 0, 1], skin });
    s.poly(outline.map(([x, y]) => [x, y, back]), paint, { toward: [0, 0, -1], skin });
    for (let i = 0; i < outline.length; i++) {
      const [x, y] = outline[i], [u, v] = outline[(i + 1) % outline.length];
      s.poly([[x,y,back], [u,v,back], [u,v,front], [x,y,front]], paint, { skin });
    }
    return;
  }
  const cx = outline.reduce((n, p) => n + p[0], 0) / outline.length;
  const cy = outline.reduce((n, p) => n + p[1], 0) / outline.length;
  const n = outline.length, bevel = Math.min(0.075, (front - back) * 0.22);
  const points: number[] = [], hints: number[] = [], triangles: number[] = [];
  for (const [scale, z] of [[0.94, back], [1, back + bevel], [1, front - bevel], [0.94, front]]) {
    for (const [x, y] of outline) {
      points.push(cx + (x - cx) * scale, cy + (y - cy) * scale, z);
      hints.push((x - cx) * 0.15, (y - cy) * 0.15, z < (back + front) / 2 ? -1 : 1);
    }
  }
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < n; i++) {
    const a = ring * n + i, b = ring * n + (i + 1) % n;
    triangles.push(a, b, b + n, a, b + n, a + n);
  }
  // Subdivide the broad faces so the baked colour has room for weathering.
  for (const face of [0, 3]) {
    const start = points.length / 3, z = face === 0 ? back : front;
    for (const [x, y] of outline) {
      points.push(cx + (x - cx) * 0.48, cy + (y - cy) * 0.48, z);
      hints.push(0, 0, face === 0 ? -1 : 1);
    }
    const center = points.length / 3;
    points.push(cx, cy, z); hints.push(0, 0, face === 0 ? -1 : 1);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      triangles.push(face * n + i, face * n + j, start + j, face * n + i, start + j, start + i,
        start + i, start + j, center);
    }
  }
  s.mesh(points, triangles, tone === C.stone ? STONE : BRASS, {
    hints, skin: tone === C.stone ? 'stone' : 'flat', crease: 0.8,
    key: 0.35, mottle: 0.25, cavity: 0.24,
  });
}
function stroke(s: Shape, path: Point[], radius: number, tone: number, glow = 0) {
  s.tube(
    path,
    path.map(() => radius),
    s.detail < 0.75 ? 3 : 5,
    tone,
    { cap: 'both', glow },
  );
}
function leaf(s: Shape, x: number, y: number, z: number, size: number, tone: number, glow = 0) {
  s.poly(
    [
      [x, y, z],
      [x - size * 0.19, y + size * 0.35, z],
      [x - size * 0.16, y + size * 0.65, z],
      [x, y + size, z],
      [x + size * 0.16, y + size * 0.65, z],
      [x + size * 0.19, y + size * 0.35, z],
    ],
    tone,
    { toward: [0, 0, 1], glow },
  );
}
function foliage(s: Shape, x: number, z: number, y = 0) {
  s.rock(x, y, z, 0.65, 0.17, 0.48, [0x667353, C.moss, 0xa0a18e], {
    level: 1, planes: 7, skin: 'moss', seat: false, shadow: false, lump: 0.16,
  });
}
function ring(
  s: Shape,
  cy: number,
  inner: number,
  outer: number,
  z0: number,
  z1: number,
  start: number,
  end: number,
  count: number,
  tone: number,
) {
  for (let i = 0; i < count; i++) {
    const a = start + ((end - start) * i) / count + 0.006,
      b = start + ((end - start) * (i + 1)) / count - 0.006;
    slab(
      s,
      [
        [Math.cos(a) * inner, cy + Math.sin(a) * inner],
        [Math.cos(a) * outer, cy + Math.sin(a) * outer],
        [Math.cos(b) * outer, cy + Math.sin(b) * outer],
        [Math.cos(b) * inner, cy + Math.sin(b) * inner],
      ],
      z0,
      z1,
      tone,
    );
  }
}

function doorLeaf(s: Shape, side: 'left' | 'right') {
  const sign = side === 'left' ? -1 : 1;
  const points: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 16;
    points.push([sign * (0.025 + 2.475 * Math.cos(a)), 3.9 + 2.5 * Math.sin(a)]);
  }
  slab(s, points, -0.5, 0.13);
  const a = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
  ring(s, 3.9, 2.34, 2.49, 0.14, 0.22, a, a + Math.PI, 16, C.brass);
  for (let i = 1; i < 4; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 4;
    stroke(
      s,
      [
        [sign * 0.1, 3.9, 0.25],
        [sign * 2.34 * Math.cos(angle), 3.9 + 2.34 * Math.sin(angle), 0.25],
      ],
      0.065,
      C.brass,
    );
  }
  const boss: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 8;
    boss.push([sign * (0.025 + 0.5 * Math.cos(angle)), 3.9 + 0.5 * Math.sin(angle)]);
  }
  slab(s, boss, 0.24, 0.38, C.brass);
  stroke(
    s,
    [
      [sign * 0.035, 1.43, 0.25],
      [sign * 0.035, 6.37, 0.25],
    ],
    0.018,
    P.lumeLight,
    2,
  );
}
function root(
  s: Shape,
  path: Point[],
  radii: number[],
  sides: number,
  tone: readonly number[] | number,
  options: { cap: 'both' },
) {
  s.sweep(path, radii, tone, { ...options, sides: Math.max(10, sides), steps: 3,
    skin: 'barkOld', ribs: [7, 0.06], key: 0.4, moss: 0.12, lump: 0.06 });
}
function doorFrame(s: Shape) {
  // The Hall caller supplies a flat walking floor at model y=0, not a stair surface.
  s.roundBox(0, -0.12, 0, 8.6, 0.12, 3, C.stone, {
    round: 0.03, skin: 'stone', key: 0.35,
  });
  for (const sign of [-1, 1]) {
    s.roundBox(sign * 3.48, 0, -0.6, 1.75, 3.8, 1.8, STONE, {
      round: 0.09, wobble: 0.025, skin: 'stone', key: 0.3, moss: 0.16,
    });
    s.roundBox(sign * 3.48, 3.7, -0.6, 2, 0.35, 1.8, STONE, { round: 0.06, skin: 'stone' });
    foliage(s, sign * 3.9, 0.3);
  }
  // Leave a 2.5m floor-level bore through the circular surround. Its lower arc used
  // to form a raised sill through the hero, inside the sight rule's protected zone.
  // Keep the original 12-degree stone courses around the upper and side arcs.
  ring(s, 3.9, 2.6, 3.65, -1.5, 0.32, -Math.PI / 3, 4 * Math.PI / 3, 25, C.stone);
  // Roots sweep across the crown and descend outside the door, never across its opening.
  for (const sign of [-1, 1]) {
    root(
      s,
      [
        [sign * 0.15, 7.7, -0.5],
        [sign * 1.2, 7.45, 0.1],
        [sign * 2.2, 6.7, 0.4],
        [sign * 3.4, 6.1, 0.35],
        [sign * 3.9, 4.6, 0.5],
        [sign * 4.1, 1.2, 0.5],
      ],
      [0.3, 0.36, 0.3, 0.24, 0.18, 0.07],
      7,
      [0x705249, C.root, C.ridge],
      { cap: 'both' },
    );
    root(
      s,
      [
        [sign * 1.4, 7.5, -0.4],
        [sign * 2.7, 6.6, -0.25],
        [sign * 4.2, 5.5, -0.1],
        [sign * 4.3, 3.1, 0.1],
      ],
      [0.18, 0.2, 0.13, 0.03],
      6,
      C.root,
      { cap: 'both' },
    );
    foliage(s, sign * 3.6, -0.15, 4.05);
    foliage(s, sign * 0.9, -0.5, 7.46);
    s.shadowBox(sign * 3.45, 0, -0.6, 1.8, 4.2, 1.8);
  }
  s.shadowBox(0, 6, -0.6, 5, 1.5, 1.8);
}
/** Separate geometries, in model coordinates. Hinge pivots are (-2.5,3.9,0) / (2.5,3.9,0).
 * Caller owns/disposes these; use instead of the merged prop when opening the Hall. */
export function hallDoorParts(detail = 1): Record<
  'hallFrame' | 'hallLeafLeft' | 'hallLeafRight',
  THREE.BufferGeometry
> {
  const frame = new Shape(330, detail),
    left = new Shape(331, detail),
    right = new Shape(332, detail);
  doorFrame(frame);
  doorLeaf(left, 'left');
  doorLeaf(right, 'right');
  const parts = { hallFrame: frame.done(), hallLeafLeft: left.done(), hallLeafRight: right.done() };
  for (const [name, g] of Object.entries(parts)) g.name = name;
  return parts;
}
export function hallDoor(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(330, detail);
  doorFrame(s);
  doorLeaf(s, 'left');
  doorLeaf(s, 'right');
  s.light(0, 3.9, 0.4);
  s.shadowBox(0, 1.4, -0.2, 5, 5, 0.6);
  return s.done();
}

export function shrine(variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(340, detail),
    awake = variant === 1,
    sides = 32;
  const stone = { sides, skin: 'stone' as const, key: 0.3, mottle: 0.24, moss: 0.08 };
  s.lathe(0, 0, 0, [[2.43, 0], [2.5, 0.07], [2.5, 0.4], [2.44, 0.5]], STONE, stone);
  s.lathe(0, 0.5, 0, [[2.08, 0], [2.15, 0.07], [2.15, 0.4], [2.07, 0.5]], STONE, stone);
  s.lathe(0, 1, 0, [[1.78, 0], [1.8, 0.12], [1.78, 3.22], [1.78, 3.4]], STONE, stone);
  for (let i = 0; i < 8; i++)
    s.at(0, 0, 0, (i * TAU) / 8, () => {
      // Pointed carved panels, with broad raised stone edges.
      s.poly(
        [
          [-0.49, 1.15, 1.79],
          [0.49, 1.15, 1.79],
          [0.49, 3.3, 1.79],
          [0, 4.08, 1.79],
          [-0.49, 3.3, 1.79],
        ],
        0xcdbb9f,
        { toward: [0, 0, 1], skin: 'stone' },
      );
      stroke(
        s,
        [
          [-0.56, 1.1, 1.81],
          [-0.56, 3.35, 1.81],
          [0, 4.17, 1.81],
          [0.56, 3.35, 1.81],
          [0.56, 1.1, 1.81],
        ],
        0.085,
        C.top,
      );
      leaf(s, 0, 2.15, 1.84, 0.8, C.brass);
      leaf(s, 0, 2.27, 1.85, 0.55, awake ? P.lumeLight : C.dormant, awake ? 2 : 0);
      for (const y of [1.85, 2.9]) s.box(0.7, y, 1.6, 0.22, 0.025, 0.06, C.shade);
    });
  // One continuous rounded bowl, including its rim and inward-facing basin wall.
  s.lathe(0, 4.4, 0, [[1.78, 0], [1.9, 0.12], [2.06, 0.34], [2.08, 0.49],
    [2.04, 0.58], [1.98, 0.6], [1.56, 0.6], [1.5, 0.55], [1.37, 0.24], [1.3, 0.15]],
    STONE, { ...stone, cap: false });
  s.disc(0, 4.55, 0, 1.3, 24, awake ? P.lume : C.shade, { glow: awake ? 2 : 0 });
  if (awake) s.light(0, 4.65, 0);
  for (let i = 0; i < 5; i++) foliage(s, Math.cos(i * 1.3) * 1.95, Math.sin(i * 1.3) * 1.95, 0.5);
  s.shadowBox(0, 0, 0, 3.6, 4.7, 3.6);
  const g = s.done();
  g.userData.glowingParts = awake ? ['basin', 'panelInsets'] : [];
  return g;
}

export function waystone(variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(350, detail),
    awake = variant === 1;
  s.roundBox(0, 0, 0, 2, 0.4, 2, STONE, { round: 0.09, skin: 'stone', key: 0.35 });
  slab(
    s,
    [
      [-0.73, 0.4],
      [0.73, 0.4],
      [0.65, 2.4],
      [0.49, 3.45],
      [-0.49, 3.45],
      [-0.65, 2.4],
    ],
    -0.6,
    0.6,
  );
  slab(
    s,
    [
      [-0.77, 3.4],
      [0.77, 3.4],
      [0.8, 3.57],
      [0.35, 4],
      [-0.35, 4],
      [-0.8, 3.57],
    ],
    -0.72,
    0.72,
  );
  leaf(s, 0, 1.5, 0.615, 1.65, C.shade);
  leaf(s, 0, 1.65, 0.62, 1.35, awake ? P.lume : C.moss, awake ? 2 : 0);
  stroke(
    s,
    [
      [0, 0.55, 0.63],
      [0, 2.8, 0.63],
    ],
    0.025,
    awake ? P.lumeLight : C.shade,
    awake ? 2 : 0,
  );
  for (const side of [-1, 1])
    for (let i = 0; i < 2; i++)
      s.at(side * (0.18 + i * 0.12), 1.7 + i * 0.35, 0.625, { rz: -side * 0.5 }, () =>
        leaf(s, 0, 0, 0, 0.55, C.moss),
      );
  s.at(0, 1.3, 0.64, { rx: -Math.PI / 2 }, () => {
    s.cyl(0, 0, 0, 0.26, 0.26, 0.08, 16, C.brass, { cap: 'both' });
    s.disc(0, 0.085, 0, 0.19, 16, awake ? P.lumeLight : C.stone, { glow: awake ? 2 : 0 });
  });
  foliage(s, -0.45, 0.4, 0.4);
  s.shadowBox(0, 0, 0, 1.4, 3.9, 1.3);
  if (awake) s.light(0, 1.3, 0.9);
  const g = s.done();
  g.userData.glowingParts = awake ? ['touchInset', 'leafInset', 'stem'] : [];
  return g;
}
export function standingStones(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(360, detail);
  const heights = [3.3, 4, 4.4, 5, 4.2, 3.6, 4.1, 3.2];
  for (let i = 0; i < 8; i++) {
    const a = 0.53 + (i * (TAU - 1.06)) / 7,
      h = heights[i];
    s.at(Math.sin(a) * 6.25, 0, Math.cos(a) * 6.25, a + Math.PI, () => {
      slab(
        s,
        [
          [-1.04, 0],
          [1.04, 0],
          [0.94, h * 0.65],
          [0.54, h],
          [-0.55, h - 0.28],
          [-0.92, h * 0.68],
        ],
        -0.6,
        0.6,
      );
      if (i % 2) {
        const path: Point[] = [];
        for (let k = 0; k < 30; k++) {
          const t = k / 29,
            r = 0.06 + t * 0.65,
            ang = t * Math.PI * 3.4;
          path.push([Math.cos(ang) * r, h * 0.56 + Math.sin(ang) * r, 0.615]);
        }
        stroke(s, path, 0.035, C.shade);
      } else {
        stroke(
          s,
          [
            [0, 0.6, 0.615],
            [0, h * 0.77, 0.615],
          ],
          0.035,
          C.shade,
        );
        for (const side of [-1, 1])
          for (let k = 0; k < 3; k++)
            s.at(0, 1 + k * 0.53, 0.62, { rz: side * 0.6 }, () => leaf(s, 0, 0, 0, 0.7, C.shade));
      }
      foliage(s, -0.65, 0.55);
      foliage(s, 0.8, -0.3);
      s.shadowBox(0, 0, 0, 1.8, h - 0.2, 1.2);
    });
  }
  return s.done();
}
