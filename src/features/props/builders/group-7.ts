// Ways down. Dimensions and material colours follow the concept handoff.
import * as THREE from 'three';
import { P } from '../palette.ts';
import { Shape } from '../shape.ts';

type Point = readonly [number, number, number];
const stone = [0x9c91a7, 0xdec398, 0xf4deb2];
const rock = [0x82748d, 0xa294ac, 0xb8a6b9, 0xd2bdb8];
const bark = [0x674638, 0x98613c, 0xc68b50];
const moss = [0x68754c, 0x89936b, 0xa0a16e];

/** A solid extruded quadrilateral, also used for the arch's wedge stones. */
function prism(s: Shape, face: Point[], depth: number, tone: number) {
  const back = face.map(([x, y, z]): Point => [x, y, z - depth]);
  s.poly(face, tone, { toward: [0, 0, 1], skin: 'stone' });
  s.poly(back, tone, { toward: [0, 0, -1], skin: 'stone' });
  for (let i = 0; i < face.length; i++) {
    const j = (i + 1) % face.length;
    s.poly([face[i], back[i], back[j], face[j]], tone, { two: true, skin: 'stone' });
  }
}

/** A continuous open throat, buried beneath broad overlapping outcrops. */
function hill(s: Shape, width: number, depth: number, height: number, cave: boolean) {
  const n = 24;
  const front = depth / 2 - (cave ? 1 : 2.1);
  const points: Point[] = [];
  const faces: [number, number, number][] = [];
  // Inner and outer rings at each end. The bore never gets a rear panel.
  for (const rear of [false, true]) for (const inner of [false, true]) {
    for (let k = 0; k <= n; k++) {
      const a = k / n * Math.PI;
      points.push([Math.cos(a) * (inner ? (cave ? 2.2 : 2.5) : width * 0.44),
        Math.sin(a) * (inner ? (cave ? 4.4 : 6) : height * (rear ? 0.88 : 0.94)),
        rear ? -depth / 2 : front - (inner ? 0 : 0.6 + Math.sin(a) * 0.6)]);
    }
  }
  const ring = n + 1;
  for (let i = 0; i < n; i++) for (const [a, b] of [[0, 1], [2, 0], [1, 3], [3, 2]]) {
    const j = a * ring + i, k = b * ring + i;
    faces.push([j, j + 1, k + 1], [j, k + 1, k]);
  }
  s.mesh(points.flat(), faces.flat(), rock, { skin: 'rock', moss: 0.32, mossTone: moss, key: 0.3, cavity: 0.5 });
  // Masses step up to the crown; their inside edges stay outside the throat.
  for (const side of [-1, 1]) {
    s.rock(side * width * 0.38, 0, -0.3, width * 0.25, height * 0.65, depth * 0.88, rock,
      { level: 2, planes: 8, reach: 0.65, skin: 'rock', moss: 0.4, mossTone: moss, key: 0.4 });
    s.rock(side * width * 0.29, height * 0.47, -0.7, width * 0.34, height * 0.38, depth * 0.72, rock,
      { level: 2, seat: false, skin: 'rock', moss: 0.45, mossTone: moss, key: 0.4 });
    s.rock(side * width * 0.42, 0, front, width * 0.18, height * 0.22, 1.5, rock,
      { level: 2, skin: 'rock', moss: 0.25, mossTone: moss });
  }
  s.rock(-width * 0.06, height * 0.72, -depth * 0.17, width * 0.48, height * 0.28, depth * 0.65, rock,
    { level: 2, seat: false, skin: 'rock', moss: 0.45, mossTone: moss, key: 0.4 });
  // Raised cushions follow the ledges; the vertical rock stays mostly bare.
  for (const side of [-1, 1]) {
    s.rock(side * width * 0.38, height * 0.60, -0.3, width * 0.21, height * 0.065, depth * 0.58, moss,
      { level: 1, seat: false, skin: 'moss', shadow: false, key: 0.3 });
    s.rock(side * width * 0.42, height * 0.16, front, width * 0.15, height * 0.06, 1.25, moss,
      { level: 1, seat: false, skin: 'moss', shadow: false });
  }
  s.rock(-width * 0.06, height * 0.96, -depth * 0.17, width * 0.30, height * 0.04, depth * 0.43, moss,
    { level: 1, seat: false, skin: 'moss', shadow: false });
  s.shadowBox(-width * 0.35, 0, 0, width * 0.25, height * 0.65, depth * 0.85);
  s.shadowBox(width * 0.35, 0, 0, width * 0.25, height * 0.65, depth * 0.85);
  s.shadowBox(0, height * 0.7, -0.4, width * 0.5, height * 0.2, depth * 0.7);
}

function root(s: Shape, points: Point[], radii: number[]) {
  s.sweep(points, radii.map(r => r * 0.85), bark, { sides: 10, steps: 2, ribs: [7, 0.08],
    skin: 'barkOld', floor: 0, moss: 0.12, mossTone: moss, key: 0.35, cavity: 0.4 });
}

function roots(s: Shape, w: number, d: number, h: number, many: boolean) {
  const z = d / 2 - 0.3;
  root(s, [[w * 0.37, 0.15, z], [w * 0.29, h * 0.22, z], [w * 0.36, h * 0.48, z - 0.3], [w * 0.2, h * 0.7, z - 1], [0.2, h * 0.94, z - 0.9], [-0.8, h * 0.85, -d / 2 + 0.6]], [0.13, 0.5, 0.58, 0.57, 0.43, 0.18]);
  root(s, [[w * 0.45, 0.1, z - 0.6], [w * 0.39, h * 0.35, z - 0.5], [w * 0.3, h * 0.55, z - 0.5], [w * 0.2, h * 0.7, z - 1]], [0.08, 0.24, 0.32, 0.42]);
  if (many) {
    root(s, [[-w * 0.45, 0.1, z], [-w * 0.29, h * 0.28, z], [-w * 0.34, h * 0.58, z - 0.4], [-w * 0.12, h * 0.87, z - 0.4], [w * 0.11, h * 0.87, -1.5], [w * 0.25, h * 0.5, -d / 2 + 0.5]], [0.12, 0.55, 0.64, 0.64, 0.5, 0.18]);
    root(s, [[-w * 0.38, 0.1, -d / 2 + 0.4], [-w * 0.3, h * 0.5, -d / 2 + 0.8], [-w * 0.1, h * 0.91, -1.5], [w * 0.12, h * 0.85, z - 0.6]], [0.1, 0.48, 0.5, 0.25]);
  }
}

function lamp(s: Shape, x: number, z: number) {
  s.box(x, 2.8, z, 0.22, 0.75, 0.18, P.oakDark, { bevel: 0.04 });
  s.tube([[x, 3.45, z], [x, 3.65, z + 0.35], [x, 3.35, z + 0.65]], [0.07, 0.07, 0.07], 6, 0xb58c47);
  s.cyl(x, 2.35, z + 0.65, 0.32, 0.32, 0.65, 8, P.pewter, { flat: true, cap: 'both' });
  for (const y of [2.28, 3]) s.cyl(x, y, z + 0.65, 0.39, 0.34, 0.12, 8, 0xb58c47, { cap: 'both' });
  s.cone(x, 3.12, z + 0.65, 0.36, 0.26, 8, P.ochre);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    s.box(x + Math.cos(a) * 0.3, 2.35, z + 0.65 + Math.sin(a) * 0.3, 0.06, 0.66, 0.06, P.ochre);
  }
}

function entrance(s: Shape, z: number) {
  // Opening is 4.8 wide, 3.05 high at the spring and 5.45 at its apex above the sill.
  for (const side of [-1, 1]) {
    s.roundBox(side * 2.95, 0.45, z - 0.65, 1.1, 2.95, 1.3, stone, { round: 0.055, skin: 'stone', key: 0.25 });
    s.box(side * 2.95, 0, z - 0.65, 1.35, 0.5, 1.5, stone[1], { skin: 'stone', bevel: 0.06 });
    s.box(side * 2.95, 3.4, z - 0.65, 1.4, 0.3, 1.5, stone[2], { skin: 'stone', bevel: 0.06 });
    lamp(s, side * 2.95, z + 0.02);
    // Broad leaf relief at the foot of each jamb.
    for (const dx of [-0.2, 0, 0.2]) s.poly([[side * 2.95, 0.95, z + 0.01], [side * 2.95 + dx - 0.12, 1.25, z + 0.03], [side * 2.95 + dx, 1.48, z + 0.01], [side * 2.95 + dx + 0.12, 1.25, z + 0.03]], stone[0], { toward: [0, 0, 1], skin: 'stone' });
  }
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI + 0.009, b = (i + 1) / 13 * Math.PI - 0.009;
    const p = (r: number, t: number): Point => [Math.cos(t) * r, 3.5 + Math.sin(t) * r, z];
    prism(s, [p(2.4, a), p(3.5, a), p(3.5, b), p(2.4, b)], 1.3, i % 3 === 0 ? stone[2] : stone[1]);
  }
  prism(s, [[-0.62, 6.65, z + 0.13], [0, 7.35, z + 0.13], [0.62, 6.65, z + 0.13], [0, 5.85, z + 0.13]], 0.26, stone[2]);
  s.poly([[-0.28, 6.65, z + 0.15], [0, 7.04, z + 0.15], [0.28, 6.65, z + 0.15], [0, 6.23, z + 0.15]], stone[0], { toward: [0, 0, 1], skin: 'stone' });
  for (let j = 0; j < 3; j++) s.box(0, j * 0.15, z - 0.8 + (2 - j) * 0.35, 4.8, 0.15, 0.8, stone[1], { skin: 'stone', bevel: 0.035 });
}

/** Keep the plan's envelope, including the proxy shadows, after organic shaping. */
function finish(s: Shape, width: number, depth: number, height: number): THREE.BufferGeometry {
  const g = s.done();
  const b = g.boundingBox as THREE.Box3;
  const size = b.getSize(new THREE.Vector3());
  const center = b.getCenter(new THREE.Vector3());
  const matrix = new THREE.Matrix4().makeScale(width / size.x, height / size.y, depth / size.z);
  matrix.multiply(new THREE.Matrix4().makeTranslation(-center.x, -b.min.y, -center.z));
  g.applyMatrix4(matrix);
  g.userData.entranceTransform = matrix.toArray();
  const extras = g.userData.prop;
  for (const data of [extras.blobs, extras.boxes]) for (let i = 0; i < data.length; i += 16) {
    const shadow = new THREE.Matrix4().fromArray(data, i).premultiply(matrix);
    shadow.toArray(data, i);
  }
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

export function galleryMouth(_variant = 0, _def?: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7001, detail);
  hill(s, 10, 6, 10, false);
  roots(s, 10, 6, 10, false);
  entrance(s, 1.95);
  for (const side of [-1, 1]) {
    s.box(side * 2.42, 0.45, -0.4, 0.16, 3.1, 3.8, P.slate);
    s.box(side * 2.31, 1.1, -0.7, 0.1, 2.1, 1.35, P.pewter, { bevel: 0.03 });
    s.box(side * 2.24, 1.17, -0.7, 0.04, 1.96, 1.21, P.night);
  }
  return finish(s, 10, 6, 10);
}

export function caveMouth(_variant = 0, _def?: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7011, detail);
  hill(s, 10, 6, 8, true);
  roots(s, 10, 6, 8, false);
  for (const side of [-1, 1]) s.at(side * 3.6, 0, 1.6, { scale: 0.5 }, () => crystalCluster(s, false));
  return finish(s, 10, 6, 8);
}

export function vaultRoots(variant: number, _def?: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7021, detail);
  hill(s, 14, 12, 10, false);
  roots(s, 14, 12, 10, true);
  entrance(s, 4.9);
  if (variant < 2) for (const side of [-1, 1]) s.at(side * 2.4, 0, 4.55,
    variant === 1 ? -side * Math.PI / 2 : 0, () => vaultLeaf(s, side));
  return finish(s, 14, 12, 10);
}

/** Leaves have hinge-local origins. Use the frame instead of the static prop when animating. */
function vaultLeaf(s: Shape, side: number) {
    for (let j = 0; j < 6; j++) {
      const x = -side * (0.2 + j * 0.4);
      const worldX = side * 2.4 + x;
      const high = 3.5 + Math.sqrt(Math.max(0, 2.4 ** 2 - worldX ** 2));
      s.box(x, 0.45, 0, 0.385, high - 0.5, 0.24, j % 2 ? P.wood : P.oakDark, { bevel: 0.025, skin: 'grain' });
    }
    for (const y of [0.7, 2.8]) s.box(-side * 1.2, y, 0.17, 2.3, 0.12, 0.1, 0xb58c47, { bevel: 0.025, skin: 'grain' });
    s.box(-side * 2.33, 0.45, 0.18, 0.1, 4.9, 0.08, P.gold);
    s.at(-side * 1.8, 1.65, 0.27, { rx: Math.PI / 2 }, () => {
      const pts: Point[] = Array.from({ length: 13 }, (_, i) => [Math.cos(i / 12 * Math.PI * 2) * 0.18, 0, Math.sin(i / 12 * Math.PI * 2) * 0.18]);
      s.tube(pts, pts.map(() => 0.04), 5, P.gold, { cap: 'none' });
    });
    // Half of Calla's sun remains attached to each leaf when opened.
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + k / 5 * Math.PI;
      const cx = -side * 2.4;
      s.poly([[cx, 3.25, 0.3], [cx + side * Math.cos(a - 0.12) * 0.32, 3.25 + Math.sin(a - 0.12) * 0.32, 0.3], [cx + side * Math.cos(a) * 0.85, 3.25 + Math.sin(a) * 0.85, 0.3], [cx + side * Math.cos(a + 0.12) * 0.32, 3.25 + Math.sin(a + 0.12) * 0.32, 0.3]], P.gold, { two: true });
    }
    s.poly(Array.from({ length: 9 }, (_, k): Point => { const a = -Math.PI / 2 + k / 8 * Math.PI; return [-side * 2.4 + side * Math.cos(a) * 0.32, 3.25 + Math.sin(a) * 0.32, 0.32]; }), P.butter, { two: true });

}

export function vaultRootsParts(detail = 1) {
  const frame = vaultRoots(2, undefined, detail);
  const transform = new THREE.Matrix4().fromArray(frame.userData.entranceTransform);
  const leaves = [-1, 1].map(side => {
    const s = new Shape(7021, detail);
    vaultLeaf(s, side);
    const geometry = s.done();
    return { geometry, pivot: new THREE.Vector3(side * 2.4, 0, 4.55), openAngle: -side * Math.PI / 2 };
  });
  // Apply this transform to the leaves' parent, then rotate each child at its pivot.
  return { frame, leaves, transform };
}

function crystalCluster(s: Shape, large: boolean) {
  const scale = large ? 2 : 1;
  s.at(0, 0, 0, { scale }, () => {
    s.rock(0, 0, 0, 1.5, 0.38, 1.5, rock, { level: 2, skin: 'rock', moss: 0.35, mossTone: moss });
    const prisms = [[-0.18, 0, 1.8, 0.29, -0.03], [0.26, 0.05, 1.25, 0.23, -0.16], [0, 0.4, 0.55, 0.18, 0.2]];
    if (large) prisms.push([-0.3, -0.13, 1.15, 0.2, 0.16], [0.38, 0.35, 0.6, 0.18, -0.2]);
    for (const [x, z, h, r, tilt] of prisms) s.at(x, 0.2, z, { rz: tilt }, () => {
      s.cyl(0, 0, 0, r, r, h * 0.76, 6, [0x9c91a7, P.pearl, P.bone, P.mist], { flat: true, cap: 'start', skin: 'flat' });
      s.cone(0, h * 0.76, 0, r, h * 0.24, 6, [P.pearl, P.bone, P.ivory], { noise: 1, skin: 'flat' });
    });
    for (const x of [-0.45, 0.45]) s.blob(x, 0.29, 0.2, 0.18, 0.06, 0.22, moss, { sides: 5, rings: 1, jitter: 0.1 });
  });
}

export function crystals(variant: number, _def?: unknown, detail = 1): THREE.BufferGeometry {
  const s = new Shape(7031 + variant, detail);
  crystalCluster(s, variant === 1);
  return finish(s, variant === 1 ? 3 : 1.5, variant === 1 ? 3 : 1.5, variant === 1 ? 4 : 2);
}
