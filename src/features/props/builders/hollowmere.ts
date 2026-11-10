// Pieces of Hollowmere, Greenhollow's capital: its heraldry, its lights and its two landmarks. The arms of
// Greenhollow are a gold wheat sheaf on green over the blue of the Mere. Every piece here merges into the
// shared instanced prop material, so each kind costs one draw call however many stand in the town.
import type * as THREE from 'three';
import { P, RAMP } from '../palette.ts';
import { Shape } from '../shape.ts';

const UP = [0, 1, 0] as const;
const TAU = Math.PI * 2;

/**
 * The sheaf of the arms, drawn flat on a cloth facing +z at x = 0: five stalks fanned from a band, with
 * heads of grain at their tops. `h` is its height.
 */
function sheaf(s: Shape, y: number, z: number, h: number, ear: number, band: number): void {
  const w = h * 0.06;
  for (let k = -2; k <= 2; k++) {
    const top = [k * h * 0.13, y + h * (0.98 - Math.abs(k) * 0.08)] as const;
    const foot = [k * h * 0.07, y] as const;
    s.poly([[foot[0] - w, foot[1], z], [foot[0] + w, foot[1], z], [top[0] + w, top[1] - h * 0.24, z], [top[0] - w, top[1] - h * 0.24, z]], ear, { sway: 0.3 });
    // The head of grain: a long diamond.
    s.poly([[top[0], top[1] - h * 0.34, z], [top[0] + w * 2.2, top[1] - h * 0.17, z], [top[0], top[1], z], [top[0] - w * 2.2, top[1] - h * 0.17, z]], ear, { sway: 0.3 });
  }
  s.poly([[-h * 0.2, y + h * 0.3, z], [h * 0.2, y + h * 0.3, z], [h * 0.2, y + h * 0.4, z], [-h * 0.2, y + h * 0.4, z]], band, { sway: 0.3 });
}

/**
 * A banner on a tall pole, with the arms on both faces. Variants: crown (gold sheaf on green, the realm),
 * harvest (green sheaf on saffron, for the harvest), hedge (a green leaf on cream, the Hedgewardens).
 */
export function banner(variant: number): THREE.BufferGeometry {
  const s = new Shape(1401 + variant);
  const field = [P.moss, P.gold, P.bone][variant], charge = [P.butter, P.pine, P.moss][variant], trim = [P.gold, P.moss, P.leaf][variant];
  s.box(0, 0, 0, 0.4, 0.22, 0.4, RAMP.stone, { bevel: 0.04, skip: '-y' });
  s.cyl(0, 0.22, 0, 0.07, 0.06, 4.1, 6, P.timber, { cap: 'end' });
  s.cone(0, 4.32, 0, 0.11, 0.26, 5, P.gold);
  s.box(0, 4.06, 0, 1.24, 0.08, 0.08, P.timber);
  for (const x of [-0.62, 0.62]) s.blob(x, 4.1, 0, 0.06, 0.06, 0.06, P.gold, { sides: 5, rings: 1 });
  // The cloth hangs from the bar and ends in two tails. It sways more toward its foot.
  const top = 4.0, low = 1.75, tail = 1.4, w = 0.55;
  const sway = (y: number) => 0.15 + 0.45 * (top - y) / (top - tail);
  for (const z of [0.045, -0.045]) {
    const front = z > 0;
    const pts = [[-w, top], [w, top], [w, tail], [0, low], [-w, tail]] as const;
    const at = front ? pts : [...pts].reverse();
    s.poly(at.map(([x, y]) => [x, y, z] as const), field, { sways: at.map(([, y]) => sway(y)), toward: [0, 0, front ? 1 : -1] });
    // A band of trim at the top and a band of the Mere at the foot.
    const zz = z * 1.25;
    const band = (y0: number, y1: number, tone: number) => {
      const quad = [[-w, y0, zz], [w, y0, zz], [w, y1, zz], [-w, y1, zz]] as const;
      s.poly(front ? quad : [...quad].reverse(), tone, { sways: [sway(y0), sway(y0), sway(y1), sway(y1)], toward: [0, 0, front ? 1 : -1] });
    };
    band(top - 0.16, top, trim);
    band(tail + 0.12, tail + 0.24, variant === 2 ? P.leaf : P.denim);
    s.at(0, 0, zz * 1.2, front ? 0 : Math.PI, () => {
      if (variant === 2) {
        // A leaf: a long diamond with a midrib.
        s.poly([[0, 2.0, 0], [0.32, 2.75, 0], [0, 3.6, 0], [-0.32, 2.75, 0]], charge, { sway: 0.4 });
        s.poly([[-0.025, 2.05, 0.004], [0.025, 2.05, 0.004], [0.025, 3.45, 0.004], [-0.025, 3.45, 0.004]], P.bone, { sway: 0.4 });
      } else sheaf(s, 2.05, 0, 1.55, charge, trim);
    });
  }
  s.shadowBox(0, 0, 0, 0.14, 4.3, 0.14);
  s.shadowBox(0, 1.6, 0, 1.1, 2.4, 0.06);
  return s.done();
}

/** One lantern: an iron cap, four posts and warm glass, its bottom at y. It lists its light. */
function lanternHead(s: Shape, x: number, y: number, z: number, size = 1): void {
  const w = 0.3 * size, h = 0.38 * size;
  s.box(x, y, z, w + 0.06, 0.05, w + 0.06, P.night);
  s.box(x, y + 0.05, z, w, h, w, P.lampHot, { glow: 1, grade: 0, skip: '+y-y' });
  for (const dx of [-w / 2, w / 2]) for (const dz of [-w / 2, w / 2]) s.box(x + dx, y + 0.05, z + dz, 0.035, h, 0.035, P.night, { skip: '+y-y' });
  s.cone(x, y + 0.05 + h, z, w * 0.8, 0.16 * size, 4, P.slate, { turn: Math.PI / 4, cap: true });
  s.blob(x, y + 0.23 * size + h, z, 0.04, 0.04, 0.04, P.night, { sides: 4, rings: 1 });
  s.light(x, y + 0.05 + h / 2, z);
}

/**
 * Lanterns that light the street. Variants: post (an iron post with a lantern on top), double (a post with
 * an arm each way and a lantern hanging from each), ground (a low stone lantern for a path's edge).
 */
export function lantern(variant: number): THREE.BufferGeometry {
  const s = new Shape(1411 + variant);
  if (variant === 2) {
    s.box(0, 0, 0, 0.5, 0.18, 0.5, RAMP.stone, { bevel: 0.04, skip: '-y' });
    s.cyl(0, 0.18, 0, 0.12, 0.1, 0.5, 6, RAMP.stone, { cap: 'none', flat: true });
    s.box(0, 0.68, 0, 0.44, 0.08, 0.44, RAMP.stone[3]);
    s.box(0, 0.76, 0, 0.32, 0.3, 0.32, P.lampHot, { glow: 1, grade: 0, skip: '-y+y' });
    for (const dx of [-0.16, 0.16]) for (const dz of [-0.16, 0.16]) s.box(dx, 0.76, dz, 0.06, 0.3, 0.06, RAMP.stone[2], { skip: '+y-y' });
    s.cone(0, 1.06, 0, 0.36, 0.22, 4, RAMP.mossStone, { turn: Math.PI / 4, cap: true });
    s.light(0, 0.9, 0);
    s.shadowBox(0, 0, 0, 0.5, 1.2, 0.5);
    return s.done();
  }
  s.box(0, 0, 0, 0.36, 0.2, 0.36, RAMP.stone, { bevel: 0.04, skip: '-y' });
  s.cyl(0, 0.2, 0, 0.075, 0.06, variant === 0 ? 2.25 : 2.75, 6, P.night, { cap: 'end' });
  s.cyl(0, 0.2, 0, 0.12, 0.1, 0.3, 6, P.slate, { cap: 'end' });
  if (variant === 0) {
    s.box(0, 2.42, 0, 0.18, 0.06, 0.18, P.night);
    lanternHead(s, 0, 2.45, 0, 1.15);
  } else {
    s.box(0, 2.9, 0, 1.5, 0.07, 0.07, P.night);
    s.cone(0, 2.95, 0, 0.09, 0.18, 5, P.gold);
    for (const x of [-0.68, 0.68]) {
      s.box(x, 2.48, 0, 0.025, 0.42, 0.025, P.night, { skip: '+y-y' });
      lanternHead(s, x, 2.0, 0, 1);
    }
  }
  s.shadowBox(0, 0, 0, 0.14, 2.9, 0.14);
  return s.done();
}

/** The points of a rope that sags between (-half, top) and (half, top) by `sag`, as [x, y] pairs. */
function rope(half: number, top: number, sag: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = -half + 2 * half * t;
    out.push([x, top - sag * 4 * t * (1 - t)]);
  }
  return out;
}

/** A post at each end of a rope ten meters long along x. */
function ropePosts(s: Shape, half: number, top: number): void {
  for (const x of [-half, half]) {
    s.box(x, 0, 0, 0.3, 0.16, 0.3, RAMP.stone, { bevel: 0.03, skip: '-y' });
    s.box(x, 0.16, 0, 0.13, top - 0.06, 0.13, P.timber, { skip: '-y' });
    s.cone(x, top + 0.1, 0, 0.1, 0.12, 4, P.timberLight, { turn: Math.PI / 4 });
    s.shadowBox(x, 0, 0, 0.13, top + 0.2, 0.13);
  }
}

/** Paper lanterns on a rope between two posts, ten meters apart along x. They glow when it is dark. */
export function stringLights(): THREE.BufferGeometry {
  const s = new Shape(1421);
  const half = 5, top = 3.7;
  ropePosts(s, half, top);
  const line = rope(half, top, 0.75, 8);
  for (let i = 0; i < line.length - 1; i++) {
    const [x0, y0] = line[i], [x1, y1] = line[i + 1];
    s.tube([[x0, y0, 0], [x1, y1, 0]], [0.025, 0.025], 3, P.umber, { cap: 'none', sways: [0, 0] });
  }
  const tones = [P.lampHot, P.apricot, P.lampHot, P.butter];
  for (let i = 1; i < line.length - 1; i++) {
    const [x, y] = line[i];
    s.box(x, y - 0.5, 0, 0.26, 0.36, 0.26, tones[i % tones.length], { glow: 1, grade: 0, sway: 0.2 });
    s.box(x, y - 0.14, 0, 0.18, 0.06, 0.18, P.umber, { sway: 0.15, skip: '-y' });
    s.light(x, y - 0.32, 0);
  }
  return s.done();
}

/** Cloth pennants in the festival's colors on a rope between two posts, ten meters apart along x. */
export function bunting(): THREE.BufferGeometry {
  const s = new Shape(1423);
  const half = 5, top = 3.5;
  ropePosts(s, half, top);
  const line = rope(half, top, 0.6, 16);
  const tones = [P.gold, P.moss, P.plasterLight, P.coral, P.denim];
  for (let i = 0; i < line.length - 1; i++) {
    const [x0, y0] = line[i], [x1, y1] = line[i + 1];
    s.tube([[x0, y0, 0], [x1, y1, 0]], [0.018, 0.018], 4, P.umber, { cap: 'none', sways: [0, 0] });
    if (i === 0 || i === line.length - 2) continue;
    s.poly([[x0 + 0.04, y0, 0], [x1 - 0.04, y1, 0], [(x0 + x1) / 2, (y0 + y1) / 2 - 0.42, 0]], tones[i % tones.length], { two: true, sways: [0.15, 0.15, 0.5] });
  }
  return s.done();
}

/** A fire in an iron bowl on a stone stand. The fire glows when it is dark. */
export function brazier(): THREE.BufferGeometry {
  const s = new Shape(1431);
  s.cyl(0, 0, 0, 0.42, 0.34, 0.2, 8, RAMP.stone, { cap: 'end', flat: true });
  s.cyl(0, 0.2, 0, 0.16, 0.14, 0.62, 6, RAMP.stone, { cap: 'none', flat: true });
  s.cyl(0, 0.82, 0, 0.22, 0.52, 0.32, 8, P.night, { cap: 'start', flat: true });
  s.cyl(0, 1.0, 0, 0.42, 0.42, 0.06, 8, P.slate, { cap: 'none', inside: true });
  for (let k = 0; k < 4; k++) {
    const a = k * TAU / 4;
    s.at(Math.cos(a) * 0.5, 1.12, Math.sin(a) * 0.5, -a, () => s.cone(0, 0, 0, 0.05, 0.14, 4, P.night));
  }
  // Coals and three tongues of flame.
  s.disc(0, 1.08, 0, 0.42, 8, P.rust, { glow: 1 });
  s.cone(0, 1.08, 0, 0.3, 0.62, 5, P.coral, { glow: 1, sway: 0.2 });
  s.cone(0.14, 1.08, 0.06, 0.16, 0.42, 5, P.apricot, { glow: 1, sway: 0.25, turn: 0.4 });
  s.cone(-0.12, 1.08, -0.08, 0.17, 0.48, 5, P.butter, { glow: 1, sway: 0.25, turn: 0.9 });
  s.light(0, 1.3, 0);
  s.shadowBox(0, 0, 0, 0.7, 1.1, 0.7);
  return s.done();
}

/** A long plank box of flowers, for a doorstep or the edge of a square. */
export function planter(): THREE.BufferGeometry {
  const s = new Shape(1441);
  s.box(0, 0, 0, 1.4, 0.48, 0.5, RAMP.plank, { bevel: 0.03, skip: '-y' });
  for (const x of [-0.66, 0.66]) s.box(x, 0, 0, 0.1, 0.5, 0.54, P.timber, { skip: '-y' });
  s.box(0, 0.44, 0, 1.24, 0.06, 0.38, P.soil, { skip: '-y' });
  const heads = [P.coral, P.butter, P.blush, P.plasterLight, P.mauve, P.gold];
  for (let i = 0; i < 6; i++) {
    const x = -0.52 + i * 0.21, z = (i % 2 ? 0.08 : -0.08);
    s.blob(x, 0.52, z, 0.14, 0.1, 0.13, RAMP.bushLeaf, { sides: 5, rings: 1, sway: 0.2 });
    s.blob(x + 0.02, 0.66 + (i % 3) * 0.05, z, 0.075, 0.06, 0.075, heads[i], { sides: 5, rings: 1, sway: 0.4 });
  }
  s.shadowBox(0, 0, 0, 1.4, 0.6, 0.5);
  return s.done();
}

/** A board of notices under a little roof, between two posts. */
export function noticeBoard(): THREE.BufferGeometry {
  const s = new Shape(1451);
  for (const x of [-0.75, 0.75]) s.box(x, 0, 0, 0.14, 2.3, 0.14, P.timber, { skip: '-y' });
  s.box(0, 0.9, 0.02, 1.4, 1.05, 0.08, RAMP.plank);
  const papers = [P.ivory, P.bone, P.plasterLight, P.cream, P.ivory];
  for (let i = 0; i < 5; i++) {
    const x = -0.5 + (i % 3) * 0.48 + (i > 2 ? 0.22 : 0), y = 1.0 + (i > 2 ? 0.48 : 0.04) + (i % 2) * 0.05;
    s.at(x, y, 0.07, { rz: (i - 2) * 0.06 }, () => s.box(0, 0, 0, 0.36, 0.42, 0.015, papers[i]));
  }
  s.at(0.2, 1.1, 0.085, { rz: 0.1 }, () => s.box(0, 0, 0, 0.12, 0.12, 0.01, P.rust));
  for (const side of [1, -1]) s.poly([[-0.98, 2.25, 0.36 * side], [0.98, 2.25, 0.36 * side], [0.98, 2.55, 0], [-0.98, 2.55, 0]], P.tealDark, { two: true, toward: UP });
  s.shadowBox(0, 0, 0, 1.6, 2.5, 0.2);
  return s.done();
}

/**
 * The Root Fountain, the middle of the Harvest Court: an old basin where the Rootworks' brass roots lift the
 * Mere's water and hold up a stone of lume. It is five meters across. The lume never goes out.
 */
export function rootFountain(): THREE.BufferGeometry {
  const s = new Shape(1461);
  const R = 2.45, sides = 8;
  // The basin: an eight-sided wall, its rim, and the water.
  s.cyl(0, 0, 0, R, R - 0.05, 0.62, sides, RAMP.brick, { cap: 'none', flat: true, turn: Math.PI / 8 });
  s.cyl(0, 0.1, 0, R - 0.32, R - 0.32, 0.52, sides, RAMP.stone[0], { cap: 'none', flat: true, inside: true, turn: Math.PI / 8 });
  for (let k = 0; k < sides; k++) {
    const a0 = (k + 0.5) / sides * TAU, a1 = (k + 1.5) / sides * TAU;
    s.poly([[Math.cos(a0) * (R - 0.36), 0.66, Math.sin(a0) * (R - 0.36)], [Math.cos(a0) * (R + 0.08), 0.66, Math.sin(a0) * (R + 0.08)],
      [Math.cos(a1) * (R + 0.08), 0.66, Math.sin(a1) * (R + 0.08)], [Math.cos(a1) * (R - 0.36), 0.66, Math.sin(a1) * (R - 0.36)]], RAMP.stone[k % 2 ? 4 : 3], { toward: UP });
    s.at(Math.cos(a0) * (R - 0.14), 0.62, Math.sin(a0) * (R - 0.14), 0, () => s.box(0, 0, 0, 0.5, 0.04, 0.5, RAMP.stone[2]));
  }
  s.disc(0, 0.5, 0, R - 0.32, sides, P.denim, { turn: Math.PI / 8 });
  s.disc(0, 0.505, 0, R - 0.9, sides, P.sky, { turn: 0 });
  // The plinth, and the roots: four brass roots that twist up around each other to the stone.
  s.cyl(0, 0.3, 0, 0.62, 0.5, 0.75, 8, RAMP.brick, { cap: 'end', flat: true });
  for (let k = 0; k < 4; k++) {
    const a = k * TAU / 4;
    const path: [number, number, number][] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6, r = 0.95 - 0.75 * t + 0.25 * Math.sin(t * Math.PI), b = a + t * 1.9;
      path.push([Math.cos(b) * r, 0.5 + t * 2.75, Math.sin(b) * r]);
    }
    s.tube(path, [0.16, 0.14, 0.12, 0.1, 0.09, 0.08, 0.07], 5, k % 2 ? [P.ochre, P.gold] : [P.oak, P.ochre], { cap: 'end' });
    // Water runs from the foot of each root back into the basin.
    s.at(Math.cos(a + 0.4) * 1.05, 0.52, Math.sin(a + 0.4) * 1.05, -a, () => s.box(0, 0, 0, 0.3, 0.02, 0.9, P.ice));
  }
  s.cyl(0, 3.1, 0, 0.12, 0.34, 0.22, 6, P.ochre, { cap: 'none' });
  s.blob(0, 3.55, 0, 0.36, 0.42, 0.36, [P.lumeDeep, P.lume, P.lumeLight], { sides: 6, rings: 3, glow: 2, jitter: 0.05 });
  s.light(0, 3.55, 0);
  s.shadowBox(0, 0, 0, R * 2, 0.66, R * 2);
  s.shadowBox(0, 0.6, 0, 1.2, 3.2, 1.2);
  return s.done();
}

/**
 * The Hollow Oak that Hollowmere is named for: a trunk wider than a door, hollow at its foot, roots over
 * broken stone, and a crown about seven meters out at the height of three houses. Lamps of the festival
 * hang in it. It is drawn with its crown high so the green under it stays in view.
 */
export function elderOak(): THREE.BufferGeometry {
  const s = new Shape(1471);
  // The trunk leans a little and splits into five great limbs.
  s.cyl(0, 0, 0, 1.75, 1.15, 2.2, 9, RAMP.bark, { cap: 'none', flat: true });
  s.cyl(0, 2.2, 0, 1.15, 0.95, 3.4, 9, RAMP.bark, { cap: 'none', flat: true });
  // The hollow: a dark arch on the south face.
  s.poly([[-0.45, 0.02, 1.62], [0.45, 0.02, 1.62], [0.38, 1.25, 1.5], [0, 1.6, 1.42], [-0.38, 1.25, 1.5]], P.ink, { toward: [0, 0, 1] });
  // Roots spread over the ground.
  for (let k = 0; k < 7; k++) {
    const a = k * TAU / 7 + 0.3;
    s.tube([[Math.cos(a) * 3.0, 0.05, Math.sin(a) * 3.0], [Math.cos(a + 0.1) * 2.0, 0.35, Math.sin(a + 0.1) * 2.0], [Math.cos(a) * 1.3, 1.0, Math.sin(a) * 1.3]], [0.18, 0.32, 0.5], 5, RAMP.bark, { cap: 'start' });
  }
  const limbs: [number, number][] = [];
  for (let k = 0; k < 5; k++) {
    const a = k * TAU / 5 + 0.5, reach = 3.6 + (k % 2) * 1.0;
    const tip: [number, number, number] = [Math.cos(a) * reach, 9.2 + (k % 3) * 0.6, Math.sin(a) * reach];
    s.tube([[Math.cos(a) * 0.5, 5.2, Math.sin(a) * 0.5], [Math.cos(a) * reach * 0.5, 7.6, Math.sin(a) * reach * 0.5], tip], [0.55, 0.38, 0.2], 6, RAMP.bark, { cap: 'end' });
    limbs.push([tip[0], tip[2]]);
  }
  // The crown: big clumps over each limb, and more between them and on top.
  const clumps: [number, number, number, number][] = [];
  for (const [x, z] of limbs) clumps.push([x, 10.2, z, 2.9]);
  for (let k = 0; k < 5; k++) {
    const a = k * TAU / 5 + 1.13;
    clumps.push([Math.cos(a) * 3.1, 11.4, Math.sin(a) * 3.1, 2.7]);
  }
  clumps.push([0, 12.6, 0, 3.2], [0.8, 10.0, -0.6, 2.6]);
  for (const [x, y, z, r] of clumps) {
    s.blob(x, y, z, r * 1.08, r * 0.72, r * 1.08, RAMP.oakLeaf, { sides: 7, rings: 3, jitter: 0.12, noise: 0.35, sway: 0.25 });
    s.shadowBlob(x, y, z, r * 1.08, r * 0.72, r * 1.08);
  }
  // Lamps of the festival hang under the crown on short cords.
  for (let k = 0; k < 9; k++) {
    const a = k * TAU / 9 + 0.2, r = 3.4 + (k % 3) * 1.2, y = 7.4 + (k % 2) * 0.5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    s.box(x, y + 0.42, z, 0.02, 0.6, 0.02, P.umber, { sway: 0.1, skip: '+y-y' });
    s.blob(x, y + 0.2, z, 0.2, 0.26, 0.2, k % 3 ? P.lampHot : P.apricot, { sides: 6, rings: 2, glow: 1, sway: 0.15 });
    s.light(x, y + 0.2, z);
  }
  s.shadowBox(0, 0, 0, 2.6, 6.0, 2.6);
  return s.done();
}
