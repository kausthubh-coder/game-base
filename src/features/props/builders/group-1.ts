import { ashlar, stoneBlock } from '../arch.ts';
import { Shape } from '../shape.ts';

// Hearth limestone, explicitly specified by assets-src/concept/stone.md.
// These concept colours supersede the older village prop palette for this group.
const C = { stone: 0xdec398, sun: 0xf4deb2, shade: 0x9c91a7, moss: 0x89936b,
  teal: 0x648f88, root: 0x98613c, ridge: 0xc68b50, brass: 0xb58c47,
  dormant: 0x7e829e, gold: 0xffd266 };
const stone = [C.shade, C.stone, C.sun];

function block(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number) {
  const start = s.mark();
  const options = { tone: stone, course: 1.15, long: [1.8, 2.8] as const,
    chip: 0.4, chamfer: 0.075, relief: 0, vary: 0.3, moss: 0.12 };
  if (h < 2) stoneBlock(s, x, y, z, w, h, d, { ...options, faces: '+z-x+x-z+y' });
  else ashlar(s, x, y, z, w, h, d - 0.09, { ...options, relief: 0.045, faces: '+z-z' });
  if (h >= 2) ashlar(s, x, y, z, w, h, d, { ...options, flat: true, faces: '+x-x+y' });
  s.weather(start, { moss: 0.85, wear: 0.55, stains: [[x, y + h, z + d / 2, w * 0.3, h * 0.6]] });
}
function leaf(s: Shape, x: number, y: number, z: number, size = 1) {
  s.box(x, y, z, 0.045, size * 1.8, 0.025, C.brass);
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    s.poly([[x, y + i * size * 0.45, z], [x + side * size * 0.4, y + (i * 0.45 + 0.65) * size, z],
      [x + side * size * 0.36, y + (i * 0.45 + 0.22) * size, z]], C.brass, { toward: [0, 0, 1] });
  }
}
function root(s: Shape, x: number, z: number, height: number) {
  const start = s.mark();
  const r = new Shape(917, s.detail);
  r.sweep([[-0.7, 0.21, 0.4], [-0.35, 0.5, 0.15], [0.2, height * 0.4, 0],
    [-0.1, height * 0.75, -0.16], [0.5, height, -0.3]], [0.55, 0.78, 0.55, 0.3, 0.025], [C.root, C.ridge],
    { sides: 8, steps: 2, ribs: [5, 0.07], cap: 'none', skin: 'barkOld', key: 0.3, floor: 0 });
  const g = r.done(), p = g.getAttribute('position');
  const points: number[] = [];
  for (let i = 0; i < p.count; i++) points.push(x + p.getX(i) * 0.55, p.getY(i), z + p.getZ(i) * 0.42);
  s.mesh(points, Array.from(g.index!.array), [C.root, C.ridge], { skin: 'barkOld', key: 0.3 });
  g.dispose();
  s.weather(start, { moss: 0.7, wear: 0.2 });
}
function moss(s: Shape, x: number, y: number, z: number, width: number) {
  s.rock(x, y, z, width, 0.12, 0.34, [C.moss, 0xa0a18e],
    { level: 1, seat: false, shadow: false, skin: 'moss', lump: 0.22 });
}
// One bevelled extruded ring. Smooth soffit; broad seams come from the stone skin.
// Eight points around the section round the visible arrises without separate blocks.
function ring(s: Shape, radius: number, thickness: number, depth: number, start: number, end: number, count: number, spring: number) {
  const bevel = 0.07, outer = radius + thickness, half = depth / 2;
  const section = [[radius, -half + bevel], [radius + bevel, -half], [outer - bevel, -half],
    [outer, -half + bevel], [outer, half - bevel], [outer - bevel, half], [radius + bevel, half], [radius, half - bevel]];
  const mark = s.mark();
  // One chamfered wedge per voussoir. The tiny joints stay readable at game distance.
  for (let i = 0; i < count; i++) {
    const points: number[] = [], tris: number[] = [];
    const a = start + (end - start) * i / count + 0.002;
    const b = start + (end - start) * (i + 1) / count - 0.002;
    const segments = 1;
    for (let j = 0; j <= segments; j++) {
      const angle = a + (b - a) * j / segments;
      for (const [r, z] of section) points.push(Math.cos(angle) * r, spring + Math.sin(angle) * r, z);
    }
    for (let j = 0; j < segments; j++) for (let k = 0; k < 8; k++) {
      const p = j * 8 + k, q = j * 8 + (k + 1) % 8;
      tris.push(p, p + 8, q, q, p + 8, q + 8);
    }
    for (let j = 1; j < 7; j++) {
      tris.push(0, j, j + 1);
      const n = segments * 8;
      tris.push(n, n + j + 1, n + j);
    }
    const tint = i % 4 === 0 ? [C.shade, C.stone] : i % 3 === 0 ? [C.stone, C.sun] : stone;
    s.mesh(points, tris, tint, { skin: 'limestone', key: 0.35, crease: 0.8, cavity: 0.3, moss: 0.1 });
  }
  s.weather(mark, { moss: 0.8, wear: 0.65 });
}

/** Travel follows X. Tile every 12m. Deck y=13; channel z=0, width .4.
 * Each end owns half of its pier, wholly within [-6,6]; closed flush joint faces; no overlapping pier volumes.
 * Variant 1 adds only colour/emission. Variant 2 is the west cantilever and fallen east pier.
 */
export function highRoadArch(variant: number, _def?: unknown, detail = 1) {
  const s = new Shape(1101, detail), broken = variant === 2, lit = variant === 1;
  for (const side of [-1, 1]) {
    if (broken && side === 1) continue;
    const x = side * 5.5;
    block(s, x, 0, 0, 1, 6, 6.2);
    s.box(side * 5.4, 0, 0, 1.2, 0.6, 7, stone, { bevel: 0.045, skin: 'stone' });
    s.box(side * 5.35, 5.8, 0, 1.3, 0.3, 6.8, C.teal, { bevel: 0.035, skin: 'stone' });
    for (const z of [-3.12, 3.12]) {
      block(s, x, 1.1, z, 0.82, 4.1, 0.16);
      leaf(s, x, 1.6, z + Math.sign(z) * 0.09, 0.8); moss(s, x, 0.6, z, 0.8);
      root(s, x + (side < 0 ? 0.4 : -0.25), z - Math.sign(z) * 0.2, 4.8);
    }
    for (const z of [-3.105,3.105]) for (let y=1;y<6;y+=2) s.box(x+(y===3?.17:-.12),y,z,.025,.98,.01,C.shade);
    s.shadowBox(x, 0, 0, 1, 6, 6.2);
  }
  ring(s, 5, 0.85, 6.5, broken ? Math.PI / 2 : 0, Math.PI, broken ? 6 : 12, 6);
  // Spandrels meet the outer ring along its curve, without a stair-stepped soffit.
  const end = broken ? 0 : 6;
  for (let i = 0; i < (broken ? 12 : 24); i++) {
    const a = Math.PI - i * Math.PI / 24, b = Math.PI - (i + 1) * Math.PI / 24;
    const x0 = Math.cos(a) * 5.85, x1 = Math.cos(b) * 5.85;
    const y0 = 6 + Math.sin(a) * 5.85, y1 = 6 + Math.sin(b) * 5.85;
    for (const side of [-1, 1]) s.poly([[x0,y0,side*3.05],[x1,y1,side*3.05],[x1,12.5,side*3.05],[x0,12.5,side*3.05]], stone, {toward:[0,0,side], skin: 'stone'});
  }
  for (const side of [-1, 1]) {
    if (broken && side === 1) continue;
    s.box(side*5.925,6,0,.15,6.5,6.1,stone, { skin: 'stone' });
    for (const z of [-3.25,3.25]) {
      block(s,side*5.5,6.1,z,1,6.5,.45);
      s.box(side*5.4,12.4,z,1.2,.3,.5,C.sun,{});
      s.box(side*5.5,13,z,1,.85,.5,stone,{});
      s.box(side*5.5,13.85,z,1,.15,.5,C.teal,{});
      moss(s,side*5.35,6.1,z,1);
    }
  }
  const length = broken ? 6 : 12, center = broken ? -3 : 0;
  s.box(center, 12.5, 0, length, 0.5, 7, stone, { skin: 'stone' });
  s.box(center, 13.005, 0, length, 0.025, 0.4, lit ? C.gold : C.dormant, { glow: lit ? 2 : 0 });
  for (const z of [-0.25,0.25]) s.box(center,13.01,z,length,.025,.06,C.brass);
  for (let x=-5;x<end;x+=2) for(const z of [-1.7,1.7]) s.box(x,13.001,z,.025,.003,2.7,C.shade);
  if (lit) s.light(0, 13.2, 0);
  for (const z of [-3.25, 3.25]) {
    // A 2.2m clear landing on +Z. No sill above the y=13 walking surface.
    const rails = variant === 3 && z > 0 ? [[-3.55, 4.9], [3.55, 4.9]] : [[center, length]];
    for (const [x, width] of rails) {
      block(s, x, 13, z, width, 0.6, 0.5);
      s.box(x, 13.6, z, width, 0.2, 0.5, C.sun, { bevel: 0.04, skin: 'stone' });
    }
    for (let x = -5; x < end; x += 2) {
      if (variant === 3 && z > 0 && Math.abs(x) < 1.4) continue;
      s.box(x, 13.1, z + Math.sign(z) * 0.251, 0.025, 0.7, 0.01, C.shade);
      if (x === -3 || x === 3) moss(s, x, 12.98, z, 0.7);
    }
    block(s, broken ? -0.5 : 0, 11.4, z - Math.sign(z) * 0.08, 0.9, 1.4, 0.3);
    leaf(s, broken ? -0.5 : 0, 11.6, z + 0.09, 0.48);
  }
  s.shadowBox(center, 12.5, 0, length, 1.5, 7);
  if (broken) {
    for (let i = 0; i < 6; i++) s.at(1.2 + (i % 3) * 1.5, 0, (Math.floor(i / 3) - 0.5) * 2.8, { ry: i * 0.4 }, () => block(s, 0, 0, 0, 1.2, 0.65 + (i % 3) * 0.5, 1.8));
    s.shadowBox(3, 0, 0, 5, 1.8, 5);
  }
  return s.done();
}

/** Three clockwise flights, 16/14/14 risers, each exactly 13/44 high. */
export function roadStair(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(1102, detail), rise = 13 / 44;
  for (const x of [-3.4, 3.4]) for (const z of [-3.4, 3.4]) {
    block(s, x, 0, z, 1.1, 13, 1.1);
    for (const y of [4.7273, 8.8636, 13]) {
      block(s, x, y - 0.25, z, 1.2, 0.25, 1.2);
      s.box(x, y, z, 1.2, 0.16, 1.2, C.teal, { bevel: 0.035, skin: 'stone' });
    }
    block(s, x, 13.16, z, 1.1, 1.64, 1.1);
    s.box(x, 14.8, z, 1.2, 0.2, 1.2, C.teal, { bevel: 0.035, skin: 'stone' });
    leaf(s, x, 13.5, z + 0.56, 0.5);
    s.shadowBox(x, 0, z, 1.2, 15, 1.2);
  }
  const flights = [{ x: -2.65, z: 0, turn: 0, n: 16, base: 0 },
    { x: 0, z: -2.65, turn: -Math.PI / 2, n: 14, base: 16 },
    { x: 2.65, z: 0, turn: Math.PI, n: 14, base: 30 }];
  for (const f of flights) s.at(f.x, 0, f.z, f.turn, () => {
    for (let i = 0; i < f.n; i++) {
      const y = (f.base + i + 1) * rise, z = 2.25 - (i + 0.5) * 4.5 / f.n;
      s.box(0, Math.max(0, y - 0.6), z, 1.8, Math.min(y, 0.6), 4.5 / f.n + 0.005, stone, { skin: 'stone' });
    }
    // Continuous sloping cheeks, instead of a serrated box on every riser.
    for (const side of [-1, 1]) {
      const y0 = (f.base + 1) * rise, y1 = (f.base + f.n) * rise;
      const points = [];
      for (const x of [side - 0.09, side + 0.09])
        for (const [z, y] of [[2.25, y0], [-2.25, y1]])
          for (const lift of [0, 0.9]) points.push(x, y + lift, z);
      s.mesh(points, [0,1,2,1,3,2, 4,6,5,5,6,7, 0,4,1,1,4,5,
        2,3,6,3,7,6, 1,5,3,3,5,7, 0,2,4,2,6,4], stone,
        { skin: 'stone', crease: 0.6, key: 0.3 });
    }
  });
  for (const [x, z, step] of [[-2.65, -2.65, 16], [2.65, -2.65, 30], [2.65, 2.65, 44]]) block(s, x, step * rise - 0.45, z, 2, 0.45, 2);
  // Final gallery leads west to the road; its west end is open, at y=13.
  s.box(0, 12.55, 2.65, 8, 0.45, 1.8, stone, { skin: 'stone' });
  s.box(0, 13, 3.65, 6, 0.9, 0.2, stone, { skin: 'stone' });
  for (const z of [-3.4, 3.4]) s.at(0, 0, z, 0, () => ring(s, 2.85, 0.4, 0.65, 0, Math.PI, 8, 9.2));
  root(s, 3.2, 3.44, 8.4); moss(s, 3.2, 0.08, 3.6, 1);
  return s.done();
}

export function roadPylon(variant: number, _def?: unknown, detail = 1) {
  const s = new Shape(1103, detail), lit = variant === 1;
  block(s, 0, 0, 0, 6, 0.8, 6); block(s, 0, 0.8, 0, 5.2, 0.8, 5.2);
  // A continuous taper, with course seams in the painting instead of projecting block ledges.
  const shaft = s.mark();
  s.lathe(0, 1.6, 0, [[2.2, 0], [2.15, 0.18], [1.86, 7], [1.55, 14], [1.09, 23.4]], stone,
    { sides: 16, square: 0.98, skin: 'stone', key: 0.4, crease: 0.7, cavity: 0.22 });
  s.weather(shaft, { moss: 1.4, wear: 0.6, stains: [[0, 24, 1.1, 1.3, 18]] });
  for (const y of [4.6, 13, 19.5, 25]) {
    const w = 5.1 - y * 0.09;
    block(s, 0, y - 0.3, 0, w, 0.3, w); s.box(0, y, 0, w, 0.2, w, C.teal, { bevel: 0.04, skin: 'stone' });
    moss(s, w * 0.25, y + 0.2, w * 0.43, w * 0.4);
  }
  for (let k = 0; k < 4; k++) s.at(0, 0, 0, k * Math.PI / 2, () => {
    for (const [y, size, z] of [[6, 2.3, 2], [14.4, 1.7, 1.66], [21, 1.3, 1.35]]) leaf(s, 0, y, z, size);
    s.sweep([[0, 25.1, 0.9], [0, 26.2, 1.1], [0, 27, 1.9], [0, 28.8, 1.8], [0, 29, 1.65]], [0.35, 0.32, 0.3, 0.23, 0.04], stone, { sides: 8, steps: 2, cap: 'none', skin: 'stone', crease: 0.7 });
    s.box(0, 5, 2.04, 0.07, 7.5, 0.035, lit ? C.gold : C.brass, { glow: lit ? 2 : 0 });
  });
  // Six-sided crystal with explicit pointed ends, summit exactly y=30.
  s.tube([[0, 26, 0], [0, 26.8, 0], [0, 28.8, 0], [0, 30, 0]], [0.015, 0.85, 0.75, 0.015], 6,
    lit ? [C.brass, C.gold, C.sun] : [C.shade, C.dormant, 0xb2abc5], { flat: true, cap: 'both', glow: lit ? 2 : 0 });
  if (lit) s.light(0, 28, 0);
  root(s, -1.7, 2.3, 9); root(s, 1.8, 2.3, 4.7);
  s.shadowBox(0, 0, 0, 4, 25, 4); s.shadowBlob(0, 28, 0, 0.9, 2, 0.9);
  return s.done();
}

export function fallenSpan(_variant = 0, _def?: unknown, detail = 1) {
  const s = new Shape(1104, detail);
  for (const [x, z, radius, angle] of [[-2, -1, 3.9, -0.15], [0, 0, 2.8, 0.1], [1.8, 1, 1.9, 0.2]]) {
    s.at(x, 0, z, angle, () => {
      ring(s, radius, 0.85, 1.5, Math.PI / 2, Math.PI, 5, 0);
      moss(s, -0.4, radius + 0.78, 0.2, 1.5);
      leaf(s, -radius * 0.7, radius * 0.6, 0.76, 0.5);
      root(s, -radius * 0.8, 0.8, radius * 0.7);
    });
  }
  s.at(3.2, 0, -1.7, { rz: -0.2, ry: 0.2 }, () => {
    block(s, 0, 0.3, 0, 2, 4, 0.85);
    s.box(0, 0.3, 0.44, 0.4, 3.9, 0.03, C.dormant);
    s.box(0, 4.3, 0, 2.2, 0.18, 1, C.teal, { bevel: 0.035, skin: 'stone' });
  });
  for (let row=0;row<2;row++) for (let col=0;col<2;col++) block(s,4.55+col*1.5,row*.9,1.8,1.48,.89,2.8);
  moss(s,5.1,1.8,1.8,2.5);
  for (let i = 0; i < 9; i++) s.at(-5.8 + i * 1.4, 0, 2.8 + s.rr(-0.6,0.6), s.rr(-1,1), () => block(s, 0, 0, 0, s.rr(.5,1.1), s.rr(.25,.7), s.rr(.5,1)));
  root(s, -5.6, -0.1, 3.4); root(s, 5.5, 3, 1.6);
  s.shadowBox(-2, 0, 0, 8, 3, 4); s.shadowBox(4.5, 0, 0, 4, 3, 5);
  return s.done();
}
