import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape, type Tone } from '../shape.ts';

// act1-city-parts. All dimensions are metres. Wall face z=0, exterior toward +z.
// Exact un-bevelled mating edges close seams; each bay owns its left post only.
export const CITY_MATERIALS = {
  plaster: [P.sandDark, P.plaster, P.plasterLight],
  stone: [P.pewter, P.sandDark, P.sand, P.cream],
  timber: [P.timber, P.plankDark, P.plankLight],
  roof: [P.tealDeep, P.tealDark, P.teal, P.tealLight],
} as const;
export type CityPiece = 'Plinth' | 'Wall' | 'WallWindow' | 'WallDoor' | 'Corner' | 'RoofEnd' | 'Roof' | 'Ridge' | 'RoofHip' | 'Chimney' | 'Window' | 'Door' | 'Balcony' | 'Stair' | 'Arch' | 'Awning';
export interface CityPartOptions { length?: number; span?: number; rise?: number; run?: number }
const M = CITY_MATERIALS;
type Point = readonly [number, number];

// Extrude an ordered, convex section in x/y through z. Used for roof ends and arch sectors.
function prism(s: Shape, section: Point[], z: number, depth: number, tone: Tone, skin: 'stone' | 'plaster' | 'grain' | 'flat') {
  const area = section.reduce((sum, p, i) => { const q = section[(i + 1) % section.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
  if (area < 0) section = [...section].reverse();
  const points: number[] = [];
  for (const dz of [0, depth]) for (const [x, y] of section) points.push(x, y, z + dz);
  const n = section.length, triangles: number[] = [];
  for (let i = 1; i < n - 1; i++) triangles.push(0, i + 1, i, n, n + i, n + i + 1);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; triangles.push(i, j, n + j, i, n + j, n + i); }
  s.mesh(points, triangles, tone, { skin, smooth: false, cavity: 0.2, key: 0.3 });
}
function beam(s: Shape, x: number, y: number, z: number, w: number, h: number, d = 0.18) {
  s.box(x, y, z, w, h, d, M.timber, { skin: 'grain' });
}
function stone(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number) {
  s.box(x, y, z, w, h, d, M.stone, { skin: 'stone' });
}
function window(s: Shape) {
  s.box(0, 0.22, 0.12, 1.1, 1.5, 0.12, [P.navy, P.iron, P.ice], { skin: 'flat' });
  for (const x of [-0.6, 0, 0.6]) beam(s, x, 0.18, 0.26, 0.1, 1.6);
  for (const y of [0.15, 0.95, 1.75]) beam(s, 0, y, 0.3, 1.4, 0.14, 0.3);
  for (const x of [-0.83, 0.83]) {
    s.box(x, 0.3, 0.4, 0.34, 1.36, 0.14, RAMP.plank, { skin: 'grain' });
    for (const y of [0.48, 1.4]) beam(s, x, y, 0.5, 0.34, 0.09, 0.08);
  }
  beam(s, 0, 0, 0.5, 1.6, 0.16, 0.65);
}
function wall(s: Shape, length: number, opening: 'none' | 'window' | 'door') {
  // Widths below three close legacy footprints as plain infill, never squeeze a doorway.
  if (length < 3) opening = 'none';
  if (opening === 'door') {
    for (const sign of [-1, 1]) s.box(sign * (length + 2) / 4, 0, 0.45, (length - 2) / 2, 2.4, 0.9, M.plaster, { skin: 'plaster' });
    s.box(0, 2.4, 0.45, length, 0.6, 0.9, M.plaster, { skin: 'plaster' });
    for (const x of [-1.08, 1.08]) beam(s, x, 0, 0.9, 0.16, 2.4);
  } else {
    if (opening === 'window') {
      for (const sign of [-1, 1]) s.box(sign * (length + 2) / 4, 0, 0.45, (length - 2) / 2, 3, 0.9, M.plaster, { skin: 'plaster', grade: 0.15 });
      s.box(0, 0, 0.45, 2, 0.65, 0.9, M.plaster, { skin: 'plaster' });
      s.box(0, 2.55, 0.45, 2, 0.45, 0.9, M.plaster, { skin: 'plaster' });
    } else s.box(0, 0, 0.45, length, 3, 0.9, M.plaster, { skin: 'plaster', grade: 0.15 });
    stone(s, 0, 0, 0.5, length, 0.26, 1);
    if (opening === 'window') s.at(0, 0.65, 0.17, {}, () => window(s));
    else if (length >= 3) beam(s, 0, 0.26, 0.92, 0.14, 2.54, 0.16);
  }
  beam(s, -length / 2 + 0.1, 0, 0.5, 0.2, 3, 1);
  beam(s, 0, 2.8, 0.5, length, 0.2, 1);
}
function arch(s: Shape, width: number, spring: number, radius: number, rise: number, outerRise: number) {
  const outer = width / 2;
  for (const sign of [-1, 1]) stone(s, sign * (outer + radius) / 2, 0, 0.5, outer - radius, spring, 1);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 8, b = (i + 1) * Math.PI / 8;
    prism(s, [[radius * Math.cos(a), spring + rise * Math.sin(a)], [outer * Math.cos(a), spring + outerRise * Math.sin(a)], [outer * Math.cos(b), spring + outerRise * Math.sin(b)], [radius * Math.cos(b), spring + rise * Math.sin(b)]], 0, 1, M.stone, 'stone');
  }
}
/** Add a part to an existing Shape, so a complete building merges into one instanced geometry. */
export function drawCityPart(s: Shape, piece: CityPiece, options: CityPartOptions = {}) {
  const length = options.length ?? 4, span = options.span ?? 6, rise = options.rise ?? 2, run = options.run ?? 4;
  if (!Number.isInteger(length) || length < 1 || length > 4) throw new Error('city wall length must be an integer from 1 to 4');
  if (![span, rise, run].every(v => Number.isFinite(v) && v > 0)) throw new Error('city roof dimensions must be positive');
  switch (piece) {
    case 'Plinth': stone(s, 0, 0, 0.5, length, 1, 1); break;
    case 'Wall': wall(s, length, 'none'); break;
    case 'WallWindow': wall(s, length, 'window'); break;
    case 'WallDoor': wall(s, length, 'door'); break;
    case 'Corner':
      stone(s, 0, 0, 0.5, 1, 0.35, 1);
      // Full-width core closes perpendicular walls for the whole storey, including corners.
      s.box(0, 0.35, 0.5, 1, 2.4, 1, M.timber, { skin: 'grain' });
      beam(s, 0, 2.75, 0.5, 1, 0.25, 1); break;
    case 'RoofEnd':
      prism(s, [[-span / 2, 0], [span / 2, 0], [0, rise]], 0, 0.8, M.plaster, 'plaster');
      beam(s, 0, 0, 0.88, span, 0.16, 0.24);
      for (const x of [-span / 4, 0, span / 4]) beam(s, x, 0.1, 0.88, 0.12, Math.max(0.1, rise * (1 - Math.abs(x) * 2 / span) - 0.16), 0.18);
      for (const sign of [-1, 1]) prism(s, [[sign * span / 2, 0], [0, rise], [0, rise - 0.18], [sign * (span / 2 - 0.22), 0]], 0.8, 0.2, M.timber, 'grain'); break;
    case 'Roof': {
      // Ridge is z=0, eave z=span/2. Courses own their upper edge and meet at exact run boundaries.
      const half = span / 2;
      for (let i = 0; i < 5; i++) {
        const z0 = half * i / 5, z1 = half * (i + 1) / 5;
        const y0 = rise * (1 - i / 5), y1 = rise * (1 - (i + 1) / 5);
        const columns = Math.max(2, Math.round(run * 2));
        for (let col = 0; col < columns; col++) {
          const x0 = -run / 2 + run * col / columns, x1 = -run / 2 + run * (col + 1) / columns;
          const tone = [P.tealDark, P.teal, P.teal, P.tealLight][(col * 3 + i * 7) % 4];
          s.poly([[x0, y0, z0], [x1, y0, z0], [x1, y1 + 0.06, z1], [x0, y1 + 0.06, z1]], tone, { skin: 'plaster', toward: [0, 1, 1] });
          if (col > 0) s.poly([[x0, y0 + 0.004, z0], [x0 + 0.012, y0 + 0.004, z0], [x0 + 0.012, y1 + 0.064, z1], [x0, y1 + 0.064, z1]], P.tealDark, { skin: 'flat', toward: [0, 1, 1] });
        }
        s.poly([[-run / 2, y1, z1], [run / 2, y1, z1], [run / 2, y1 + 0.06, z1], [-run / 2, y1 + 0.06, z1]], P.tealDark, { skin: 'flat', two: true });
      }
      s.poly([[-run / 2, rise, 0], [run / 2, rise, 0], [run / 2, 0, half], [-run / 2, 0, half]], P.timber, { skin: 'grain', toward: [0, -1, -1] });
      beam(s, 0, 0, half - 0.12, run, 0.12, 0.24);
      break;
    }
    case 'Ridge':
      s.at(0, 0, 0, { ry: Math.PI / 2 }, () => prism(s, [[-0.5, 0], [0.5, 0], [0, 0.3]], -run / 2, run, M.roof, 'flat')); break;
    case 'RoofHip': {
      const half = span / 2;
      s.at(-half / 2, 0, 0, {}, () => {
      s.poly([[0, rise, 0], [half, 0, 0], [half, 0, half], [0, 0, half]], M.roof, { skin: 'flat', two: true, toward: [0, 1, 0] });
      for (let i = 1; i <= 5; i++) {
        const a = half * i / 5, y = rise * (1 - i / 5);
        s.poly([[a, y, 0], [a, y, a], [a, y + 0.04, a], [a, y + 0.04, 0]], P.tealDark, { skin: 'flat', two: true });
        s.poly([[a, y, a], [0, y, a], [0, y + 0.04, a], [a, y + 0.04, a]], P.tealDark, { skin: 'flat', two: true });
      }
      });
      break;
    }
    case 'Chimney':
      stone(s, 0, 0, 0.5, 1, 0.35, 1);
      s.roundBox(0, 0.35, 0.5, 0.72, 2.25, 0.72, M.plaster, { skin: 'plaster', round: 0.04, segments: 1 });
      stone(s, 0, 2.55, 0.5, 1, 0.2, 1);
      for (const x of [-0.34, 0.34]) stone(s, x, 2.75, 0.5, 0.18, 0.25, 0.86);
      for (const z of [0.16, 0.84]) stone(s, 0, 2.75, z, 0.5, 0.25, 0.18);
      s.box(0, 2.7, 0.5, 0.5, 0.02, 0.5, P.ink, { skin: 'flat' }); break;
    case 'Window': window(s); break;
    case 'Door': arch(s, 2, 1.85, 0.74, 0.55, 1.15); break;
    case 'Balcony':
      beam(s, 0, 0, 1, 4, 0.14, 2);
      for (const x of [-1.9, 1.9]) beam(s, x, 0.88, 1, 0.2, 0.12, 2);
      beam(s, 0, 0.88, 1.9, 4, 0.12, 0.2);
      for (let i = 0; i <= 8; i++) beam(s, -1.9 + i * 3.8 / 8, 0.14, 1.9, 0.1, 0.74, 0.1);
      break;
    case 'Stair':
      for (let i = 0; i < 16; i++) stone(s, 0, 0, (i + 0.5) / 4, 2, (i + 1) * 3 / 16, 0.25);
      break;
    case 'Arch': arch(s, 4, 2.4, 1, 0.35, 0.6); break;
    case 'Awning':
      for (let i = 0; i < 8; i++) {
        const x = -2 + i * 0.5;
        s.poly([[x, 1, 0], [x + 0.5, 1, 0], [x + 0.5, 0.5, 2], [x, 0.5, 2]], i % 2 ? P.plasterLight : P.gold, { skin: 'plaster', two: true });
        s.poly([[x, 0.5, 2], [x + 0.5, 0.5, 2], [x + 0.45, 0.32, 2], [x + 0.05, 0.32, 2]], i % 2 ? P.plasterLight : P.gold, { skin: 'plaster', two: true });
      }
      for (const x of [-1.9, 1.9]) beam(s, x, 0, 0.1, 0.2, 1, 0.2);
      break;
  }
}
function builder(piece: CityPiece) {
  return (variant: number, _def: unknown, detail = 1): THREE.BufferGeometry => {
    const s = new Shape(8510, detail);
    drawCityPart(s, piece, { length: ['Plinth', 'Wall', 'WallWindow', 'WallDoor'].includes(piece) ? 4 - variant : 4 });
    if (piece === 'WallDoor' || piece === 'Arch' || piece === 'Door') {
      for (const x of [-1.5, 1.5]) if (piece !== 'Door') s.shadowBox(x, 0, 0.5, 0.5, 2.4, 0.8);
    } else if (['Plinth', 'Wall', 'WallWindow'].includes(piece)) s.shadowBox(0, 0, 0.5, 4 - variant, piece === 'Plinth' ? 1 : 3, 1);
    return s.done();
  };
}
export const cityPartPlinth = builder('Plinth'), cityPartWall = builder('Wall'), cityPartWallWindow = builder('WallWindow'), cityPartWallDoor = builder('WallDoor');
export const cityPartCorner = builder('Corner'), cityPartRoofEnd = builder('RoofEnd'), cityPartRoof = builder('Roof'), cityPartRidge = builder('Ridge'), cityPartRoofHip = builder('RoofHip');
export const cityPartChimney = builder('Chimney'), cityPartWindow = builder('Window'), cityPartDoor = builder('Door'), cityPartBalcony = builder('Balcony'), cityPartStair = builder('Stair'), cityPartArch = builder('Arch'), cityPartAwning = builder('Awning');

/** Separate arched leaf. Place pivot at [-.72,0,.48] inside cityPartDoor; rotate about local Y to open outward. */
export function cityPartDoorLeaf(detail = 1): THREE.BufferGeometry {
  const s = new Shape(8511, detail);
  const section: Point[] = [[0, 0], [1.44, 0], [1.44, 1.84]];
  for (let i = 1; i <= 8; i++) { const a = i * Math.PI / 8; section.push([0.72 + 0.72 * Math.cos(a), 1.84 + 0.53 * Math.sin(a)]); }
  prism(s, section, 0, 0.12, RAMP.plank, 'grain');
  for (const y of [0.4, 1.6]) s.box(0.72, y, 0.15, 1.32, 0.08, 0.04, P.iron, { skin: 'flat' });
  s.box(1.22, 1.05, 0.16, 0.08, 0.16, 0.08, P.iron, { bevel: 0.02 });
  return s.done();
}

/** Three storeys assembled offline from the same parts. No world placement or collision is added. */
export function cityPartHouse(_variant: number, _def: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(8512, detail);
  for (let floor = -1; floor < 3; floor++) {
    const y = floor < 0 ? 0 : 1 + floor * 3;
    for (const sign of [-1, 1]) {
      s.at(0, y, sign * 3, { ry: sign < 0 ? Math.PI : 0 }, () => drawCityPart(s, floor < 0 ? 'Plinth' : floor === 0 && sign > 0 ? 'WallDoor' : 'WallWindow'));
      for (const z of [-1, 2]) s.at(sign * 2, y, z, { ry: sign * Math.PI / 2 }, () => drawCityPart(s, floor < 0 ? 'Plinth' : 'Wall', { length: z === -1 ? 4 : 2 }));
      for (const x of [-2.5, 2.5]) s.at(x, y, sign * 3.5 - 0.5, {}, () => drawCityPart(s, floor < 0 ? 'Plinth' : 'Corner', { length: 1 }));
    }
  }
  for (const z of [-4, 3]) s.at(0, 10, z, {}, () => drawCityPart(s, 'RoofEnd'));
  for (const z of [-2, 2]) {
    for (const sign of [-1, 1]) s.at(0, 10, z, { ry: sign * Math.PI / 2 }, () => drawCityPart(s, 'Roof'));
    s.at(0, 12, z, { ry: Math.PI / 2 }, () => drawCityPart(s, 'Ridge'));
  }
  s.at(0, 4, 4, {}, () => drawCityPart(s, 'Balcony'));
  s.at(0, 7, 4, {}, () => drawCityPart(s, 'Balcony'));
  s.at(0, 3.4, 4, {}, () => drawCityPart(s, 'Awning'));
  s.at(-1, 10, -2, {}, () => drawCityPart(s, 'Chimney'));
  s.shadowBox(0, 0, 0, 6, 10, 8);
  return s.done();
}
