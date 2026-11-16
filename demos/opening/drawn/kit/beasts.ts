// The six old gods, asleep, each wound in gold bands: the stag of the green, the lion of the vermilion, the
// dragon of the lapis, the eagle of the violet, the elephant of the white, the turtle of the slate. Drawn in a
// box about 340 wide and 220 tall, feet on y = 0, centred on x = 0.
import { type Rand, blob, curve, rng, shade } from './core.ts';
import { type Fresco, INK, P, ellipseAt, flower } from './fresco.ts';

export type Beast = 'stag' | 'lion' | 'dragon' | 'eagle' | 'elephant' | 'turtle';
export const BEASTS: readonly Beast[] = ['stag', 'lion', 'dragon', 'eagle', 'elephant', 'turtle'];

export function beast(f: Fresco, b: Beast, seed: number): void {
  const r = rng(seed);
  ({ stag, lion, dragon, eagle, elephant, turtle })[b](f, r);
}

/** A gold band wound across a body: a ribbon along a curve with a darker edge and a fold where it turns. */
function band(f: Fresco, pts: [number, number][], width = 15): void {
  const p = curve(pts, false);
  f.gildLine(p, width);
  const edge = new Path2D();
  const a = pts[0];
  const b = pts[pts.length - 1];
  edge.moveTo(a[0], a[1]);
  edge.lineTo(a[0] + 2, a[1] + width * 0.6);
  edge.moveTo(b[0], b[1]);
  edge.lineTo(b[0] - 2, b[1] + width * 0.6);
  f.line(edge, '#a8761e', 2, 0.6);
}

function sleepyEye(f: Fresco, x: number, y: number, s: number, rot = 0): void {
  const e = new Path2D();
  e.moveTo(x - 6 * s * Math.cos(rot), y - 6 * s * Math.sin(rot));
  e.quadraticCurveTo(x + 3 * s * Math.sin(rot), y + 4 * s, x + 6 * s * Math.cos(rot), y + 6 * s * Math.sin(rot));
  f.line(e, '#2a1a10', 2 * s);
  const lash = new Path2D();
  for (let k = -1; k <= 1; k++) {
    lash.moveTo(x + k * 3 * s, y + 2.4 * s);
    lash.lineTo(x + k * 3.6 * s, y + 4.6 * s);
  }
  f.line(lash, '#2a1a10', 1.2 * s, 0.7);
}

function stag(f: Fresco, r: Rand): void {
  const fawn = '#e9d3a6';
  // Folded legs.
  for (const [x, w] of [[-90, 40], [60, 46]] as const) f.fill(ellipseAt(x, -12, w, 13, 0), shade(fawn, -0.08), 1.5);
  const hoof = new Path2D();
  hoof.moveTo(98, -8);
  hoof.lineTo(110, -4);
  f.line(hoof, '#4a3020', 5);
  const body = curve([[-140, -20], [-150, -70], [-110, -112], [-30, -124], [50, -116], [100, -96], [118, -60], [100, -20], [20, -8], [-80, -8]]);
  const g = f.p.createLinearGradient(0, -124, 0, -8);
  g.addColorStop(0, fawn);
  g.addColorStop(1, shade(fawn, -0.12));
  f.fill(body, g, 1.8);
  for (let i = 0; i < 16; i++) f.wash(ellipseAt(-100 + r() * 170, -40 - r() * 50, 4, 3, 0), '#fffaf0', 0.85);
  // Moss over the back, with little white flowers.
  const moss = curve([[-146, -64], [-120, -114], [-40, -134], [40, -128], [96, -104], [70, -92], [10, -100], [-60, -98], [-120, -76]]);
  f.fill(moss, '#5f9a43', 1.4);
  const tufts = new Path2D();
  for (let i = 0; i < 40; i++) {
    const x = -130 + r() * 220;
    const y = -100 - r() * 26 + Math.abs(x) * 0.12;
    tufts.moveTo(x, y);
    tufts.lineTo(x + (r() - 0.5) * 6, y - 6 - r() * 6);
  }
  f.line(tufts, '#3f7a34', 2, 0.8);
  for (let i = 0; i < 9; i++) flower(f, -120 + r() * 200, -112 - r() * 14, 16, P.white, r);
  // Neck and the head laid down on the ground to the right.
  const neck = curve([[70, -110], [120, -112], [150, -80], [150, -44], [120, -40], [96, -70]]);
  f.fill(neck, fawn, 1.6);
  f.save();
  f.translate(170, -46);
  f.rotate(0.35);
  // Ears, then antlers like a tree in winter, hung with moss.
  antler(f, -18, -30, -2.1, 60, 4, r);
  antler(f, -2, -32, -1.35, 70, 4, r);
  f.fill(curve([[-30, -26], [-46, -40], [-34, -40], [-20, -32]]), fawn, 1.4);
  const head = curve([[-34, -20], [-18, -34], [10, -30], [44, -12], [50, 2], [36, 10], [-10, 10], [-34, 4]]);
  f.fill(head, fawn, 1.6);
  f.wash(ellipseAt(46, -3, 6, 5, 0), '#3a2414');
  sleepyEye(f, -2, -16, 1.4, 0.2);
  f.restore();
  band(f, [[-130, -40], [-80, -100], [-20, -126], [20, -128]], 16);
  band(f, [[-30, -10], [0, -60], [40, -110], [70, -120]], 15);
  band(f, [[60, -14], [96, -40], [120, -76]], 13);
}

function antler(f: Fresco, x: number, y: number, a: number, len: number, depth: number, r: Rand): void {
  const ex = x + Math.cos(a) * len;
  const ey = y + Math.sin(a) * len;
  const p = new Path2D();
  p.moveTo(x, y);
  p.quadraticCurveTo(x + Math.cos(a + 0.3) * len * 0.5, y + Math.sin(a + 0.3) * len * 0.5, ex, ey);
  f.line(p, INK, depth * 1.8 + 2, 0.85);
  f.line(p, '#b88a4a', depth * 1.8);
  if (depth > 1) {
    antler(f, ex, ey, a - 0.45 - r() * 0.2, len * 0.65, depth - 1, r);
    antler(f, ex, ey, a + 0.4 + r() * 0.2, len * 0.6, depth - 1, r);
  } else {
    if (r() < 0.5) {
      const hang = new Path2D();
      hang.moveTo(ex, ey);
      hang.lineTo(ex + 1, ey + 10 + r() * 14);
      f.line(hang, '#6aa04a', 3, 0.8);
    }
    f.fill(ellipseAt(ex, ey, 4, 3, 0), '#6aa04a', 0.8);
  }
}

function lion(f: Fresco, r: Rand): void {
  const tawny = '#ecbf7c';
  // Tail with a flame tip, curled round the back.
  const tail = new Path2D();
  tail.moveTo(120, -40);
  tail.bezierCurveTo(170, -30, 170, 10, 120, 4);
  f.line(tail, INK, 11, 0.85);
  f.line(tail, tawny, 8.5);
  flames(f, 116, 4, 26, r, 0.7);
  const body = curve([[-60, -10], [-80, -60], [-30, -110], [60, -112], [130, -86], [146, -40], [120, -8], [20, -4]]);
  const g = f.p.createLinearGradient(0, -112, 0, -4);
  g.addColorStop(0, tawny);
  g.addColorStop(1, shade(tawny, -0.15));
  f.fill(body, g, 1.8);
  const haunch = new Path2D();
  haunch.moveTo(70, -96);
  haunch.quadraticCurveTo(130, -86, 120, -14);
  f.line(haunch, shade(tawny, -0.35), 2, 0.6);
  // The mane: tongues of flame round the sleeping head.
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (0.55 + (i / 25) * 1.5);
    const rad = 62 + r() * 18;
    flames(f, -100 + Math.cos(a) * rad * 0.6, -60 + Math.sin(a) * rad * 0.62, 44 + r() * 26, r, 1, a);
  }
  // Paws in front, and the head laid on them.
  for (const x of [-150, -110]) {
    f.fill(curve([[x - 22, -2], [x - 24, -16], [x + 20, -18], [x + 26, -6], [x + 20, 2]]), tawny, 1.5);
    const toes = new Path2D();
    toes.moveTo(x - 12, -2);
    toes.lineTo(x - 12, -9);
    toes.moveTo(x - 2, -2);
    toes.lineTo(x - 2, -9);
    f.line(toes, shade(tawny, -0.4), 1.5);
  }
  const face = curve([[-150, -40], [-140, -82], [-100, -96], [-66, -80], [-60, -40], [-80, -18], [-130, -16]]);
  f.fill(face, tawny, 1.7);
  for (const x of [-138, -76]) f.fill(ellipseAt(x, -86, 11, 12, 0), tawny, 1.4);
  const muzzle = curve([[-132, -34], [-118, -46], [-98, -46], [-86, -34], [-100, -22], [-120, -22]]);
  f.fill(muzzle, '#fbe8c6', 1.2);
  f.fill(curve([[-116, -46], [-100, -46], [-108, -38]]), '#5a3020', 0.8);
  sleepyEye(f, -126, -60, 1.6);
  sleepyEye(f, -88, -60, 1.6);
  const smile = new Path2D();
  smile.moveTo(-108, -38);
  smile.quadraticCurveTo(-116, -28, -122, -32);
  smile.moveTo(-108, -38);
  smile.quadraticCurveTo(-100, -28, -94, -32);
  f.line(smile, '#5a3020', 1.6);
  band(f, [[-40, -10], [-10, -70], [30, -114]], 16);
  band(f, [[40, -6], [70, -60], [110, -96]], 15);
  band(f, [[-60, -94], [10, -96], [80, -84], [140, -60]], 13);
}

/** A tongue of flame, red outside, gold inside, pointing along `a` (up when not given). */
function flames(f: Fresco, x: number, y: number, h: number, r: Rand, k = 1, a = -Math.PI / 2): void {
  const tongue = (scale: number, color: string) => {
    const s = h * scale;
    const c = Math.cos(a);
    const d = Math.sin(a);
    const pt = (u: number, v: number): [number, number] => [x + c * v - d * u, y + d * v + c * u];
    const p = curve([pt(-s * 0.32, 0), pt(-s * 0.36, s * 0.4), pt(-s * 0.08 + (r() - 0.5) * s * 0.2, s * 0.75), pt(s * 0.05, s), pt(s * 0.12, s * 0.65), pt(s * 0.34, s * 0.35), pt(s * 0.3, 0)]);
    return { p, color };
  };
  const outer = tongue(1, '#d9402a');
  f.fill(outer.p, outer.color, 1.2 * k);
  const mid = tongue(0.7, '#f07a2a');
  f.fill(mid.p, mid.color, 0);
  const inner = tongue(0.42, '#f8c84a');
  f.fill(inner.p, inner.color, 0);
}

function dragon(f: Fresco, r: Rand): void {
  const blue = '#3a6fc8';
  // Waves under the coils.
  for (let i = 0; i < 7; i++) {
    const x = -150 + i * 50;
    const w = new Path2D();
    w.moveTo(x - 30, 0);
    w.bezierCurveTo(x - 24, -36, x + 16, -40, x + 18, -16);
    w.bezierCurveTo(x + 18, -6, x + 6, -6, x + 6, -14);
    w.lineTo(x + 26, 0);
    w.closePath();
    f.fill(w, i % 2 ? '#e8f0fa' : '#5a8ad6', 1.2);
  }
  // The coils: one long body wound twice.
  const coil = new Path2D();
  coil.moveTo(165, -16);
  coil.bezierCurveTo(100, -6, -60, -4, -112, -30);
  coil.bezierCurveTo(-162, -60, -128, -142, -34, -142);
  coil.bezierCurveTo(60, -142, 124, -104, 96, -62);
  coil.bezierCurveTo(78, -36, 20, -46, -6, -72);
  f.line(coil, INK, 50, 0.85);
  f.line(coil, blue, 46);
  f.line(coil, '#e4d6a4', 12, 0.95);
  // Scales along the back.
  const scales = new Path2D();
  for (let i = 0; i < 60; i++) {
    const x = -140 + r() * 290;
    const y = -30 - r() * 120;
    scales.moveTo(x - 4, y);
    scales.quadraticCurveTo(x, y + 4, x + 4, y);
  }
  f.save();
  f.clip(strokeArea(coil));
  f.line(scales, '#24509e', 1.4, 0.7);
  f.restore();
  // The head resting on the inner coil, a crest of fins.
  f.save();
  f.translate(-40, -84);
  f.rotate(0.15);
  f.scaleBy(-1.25, 1.25);
  for (let i = 0; i < 5; i++) {
    const fin = curve([[-10 + i * 12, -14], [-4 + i * 12, -38 - r() * 10], [6 + i * 12, -14]]);
    f.fill(fin, i % 2 ? '#f0c040' : '#6aa0e8', 1.2);
  }
  const head = curve([[-30, 0], [-20, -20], [20, -24], [56, -10], [60, 6], [30, 14], [-20, 14]]);
  f.fill(head, blue, 1.6);
  f.fill(curve([[10, 6], [58, 4], [36, 14], [0, 14]]), '#e4d6a4', 0);
  for (const s of [-1, 1]) {
    const whisker = new Path2D();
    whisker.moveTo(52, 2);
    whisker.bezierCurveTo(70, 6 + s * 6, 76, 20 + s * 6, 90, 14 + s * 10);
    f.gildLine(whisker, 2, false);
  }
  const horn = new Path2D();
  horn.moveTo(-14, -18);
  horn.quadraticCurveTo(-36, -34, -50, -30);
  f.gildLine(horn, 5);
  sleepyEye(f, 10, -6, 1.5, 0.1);
  f.restore();
  band(f, [[-130, -40], [-90, -90], [-40, -126]], 15);
  band(f, [[60, -130], [100, -100], [140, -60]], 15);
  band(f, [[-20, -24], [10, -50], [26, -86]], 13);
}

/** A generous region round a stroked path, for clipping marks to it. */
function strokeArea(p: Path2D): Path2D {
  const out = new Path2D();
  out.addPath(p);
  out.rect(-160, -150, 330, 130);
  return out;
}

function eagle(f: Fresco, r: Rand): void {
  const violet = '#7a4aa6';
  // Tail feathers fanned out behind.
  for (let i = 0; i < 6; i++) {
    const a = 0.1 + i * 0.12;
    const fx = 120 + Math.cos(a) * 60;
    const fy = -30 + Math.sin(a) * 30;
    f.fill(curve([[100, -40], [fx, fy - 10], [fx + 10, fy], [100, -24]]), i % 2 ? '#f4efe2' : violet, 1.2);
  }
  const body = curve([[-120, -20], [-140, -80], [-90, -140], [10, -150], [100, -116], [140, -60], [120, -14], [0, -2]]);
  const g = f.p.createLinearGradient(0, -150, 0, 0);
  g.addColorStop(0, shade(violet, 0.1));
  g.addColorStop(1, shade(violet, -0.2));
  f.fill(body, g, 1.8);
  // The folded wing over it, rows of feathers, white at the tips.
  const wing = curve([[-90, -100], [-10, -136], [90, -120], [140, -70], [120, -30], [40, -24], [-50, -40], [-100, -70]]);
  f.fill(wing, shade(violet, 0.18), 1.6);
  // Long flight feathers at the back first, then rows of shorter ones toward the shoulder, all pointing back.
  for (let i = 0; i < 6; i++) {
    const x = 30 + i * 18;
    const y = -96 + i * 10;
    const fe = curve([[x - 8, y - 6], [x + 50, y + 12], [x + 74, y + 40], [x + 40, y + 30], [x - 6, y + 10]]);
    f.fill(fe, i % 2 ? '#f6f0e4' : shade(violet, 0.25), 1.2);
  }
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      const x = -70 + i * 22 + row * 18;
      const y = -112 + row * 22 + i * 3;
      const fe = curve([[x - 6, y - 6], [x + 22, y + 2], [x + 34, y + 22], [x + 12, y + 18], [x - 6, y + 6]]);
      f.fill(fe, row === 2 ? '#f6f0e4' : row === 1 ? shade(violet, 0.32) : shade(violet, 0.12), 1);
    }
  }
  // The white head tucked down on the breast, the gold beak.
  const head = curve([[-150, -60], [-150, -96], [-120, -118], [-86, -110], [-74, -80], [-90, -50], [-126, -44]]);
  f.fill(head, '#f8f4ea', 1.6);
  const plume = new Path2D();
  plume.moveTo(-120, -112);
  plume.quadraticCurveTo(-110, -136, -86, -140);
  plume.moveTo(-108, -114);
  plume.quadraticCurveTo(-96, -130, -78, -128);
  f.line(plume, shade(violet, 0.2), 3);
  f.fill(curve([[-150, -78], [-172, -64], [-160, -52], [-142, -60]]), '#e8b03a', 1.3);
  sleepyEye(f, -122, -86, 1.4, -0.2);
  band(f, [[-130, -40], [-60, -10], [20, -8]], 15);
  band(f, [[-40, -144], [20, -100], [60, -30]], 15);
  band(f, [[70, -130], [110, -90], [130, -40]], 13);
  void r;
}

function elephant(f: Fresco, r: Rand): void {
  const white = '#f3eee4';
  // Clouds it lies on.
  for (let i = 0; i < 9; i++) {
    const x = -160 + i * 40;
    f.fill(blob(x, -8 - (i % 2) * 6, 34, 18, r, 0.1, 10), '#fbf9f2', 1.2);
    const swirl = new Path2D();
    swirl.arc(x, -8, 9, Math.PI, Math.PI * 2.6);
    f.gildLine(swirl, 1.6, false);
  }
  const body = curve([[-80, -20], [-100, -100], [-40, -160], [60, -164], [140, -120], [160, -50], [130, -16], [0, -10]]);
  const g = f.p.createLinearGradient(0, -164, 0, -10);
  g.addColorStop(0, white);
  g.addColorStop(1, '#dcd4c6');
  f.fill(body, g, 1.8);
  for (const x of [-40, 90]) f.fill(curve([[x - 30, -10], [x - 32, -34], [x + 26, -36], [x + 34, -14], [x + 20, -4]]), white, 1.4);
  // Head, ear, and the trunk curled on the cloud.
  const head = curve([[-150, -60], [-150, -120], [-110, -146], [-60, -140], [-40, -100], [-56, -60], [-100, -46]]);
  f.fill(head, white, 1.7);
  const ear = curve([[-90, -136], [-40, -150], [-10, -110], [-20, -60], [-60, -54], [-80, -90]]);
  f.fill(ear, '#efe6d8', 1.6);
  f.wash(curve([[-80, -126], [-44, -136], [-24, -104], [-34, -72], [-62, -70], [-74, -96]]), '#f2cfc4', 0.5);
  const trunk = new Path2D();
  trunk.moveTo(-142, -80);
  trunk.bezierCurveTo(-170, -50, -176, -14, -150, -10);
  trunk.bezierCurveTo(-134, -8, -132, -24, -142, -28);
  f.line(trunk, INK, 22, 0.85);
  f.line(trunk, white, 19);
  const rings = new Path2D();
  for (let k = 0; k < 5; k++) {
    rings.moveTo(-160 + k * 1.5, -66 + k * 12);
    rings.lineTo(-146 + k * 1.5, -64 + k * 12);
  }
  f.line(rings, '#c8bfb0', 1.4);
  const tusk = new Path2D();
  tusk.moveTo(-128, -64);
  tusk.quadraticCurveTo(-120, -36, -96, -32);
  f.line(tusk, INK, 9, 0.8);
  f.line(tusk, '#fffbea', 7);
  sleepyEye(f, -116, -100, 1.5);
  band(f, [[-30, -150], [0, -100], [10, -16]], 17);
  band(f, [[40, -164], [70, -100], [80, -14]], 16);
  band(f, [[100, -140], [130, -90], [150, -50]], 14);
}

function turtle(f: Fresco, r: Rand): void {
  const skin = '#8aa070';
  // Legs and the head laid forward.
  for (const x of [-100, 100]) f.fill(curve([[x - 26, -4], [x - 22, -30], [x + 22, -30], [x + 26, -4]]), skin, 1.5);
  const neck = curve([[-110, -40], [-150, -44], [-178, -36], [-182, -16], [-160, -6], [-110, -12]]);
  f.fill(neck, skin, 1.6);
  sleepyEye(f, -164, -30, 1.4);
  const smile = new Path2D();
  smile.moveTo(-182, -20);
  smile.quadraticCurveTo(-172, -14, -164, -18);
  f.line(smile, '#3a4a2a', 1.4);
  // The shell: slate plates with pale rims.
  const shell = curve([[-140, -20], [-130, -80], [-70, -128], [10, -138], [90, -120], [140, -70], [146, -20], [0, -10]]);
  const g = f.p.createLinearGradient(0, -138, 0, -10);
  g.addColorStop(0, '#7f8aa4');
  g.addColorStop(1, '#5a6480');
  f.fill(shell, g, 1.9);
  const rim = new Path2D();
  rim.moveTo(-140, -22);
  rim.quadraticCurveTo(0, -4, 146, -22);
  f.line(rim, '#c8ccd8', 6);
  f.save();
  f.clip(shell);
  const plates = new Path2D();
  for (let row = 0; row < 3; row++) {
    for (let i = -3; i <= 3; i++) {
      const cx = i * 42 + (row % 2) * 21;
      const cy = -40 - row * 34;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        const px = cx + Math.cos(a) * 22;
        const py = cy + Math.sin(a) * 16;
        if (k) plates.lineTo(px, py);
        else plates.moveTo(px, py);
      }
      plates.closePath();
    }
  }
  f.line(plates, '#c8ccd8', 2.4, 0.85);
  f.restore();
  // A small mountain grown on its back, green slopes and snow.
  const hill = curve([[-60, -118], [-30, -150], [-6, -186], [10, -196], [26, -180], [56, -146], [80, -118]]);
  f.fill(hill, '#5f9a43', 1.5);
  f.fill(curve([[-8, -182], [10, -198], [26, -180], [16, -176], [8, -184], [0, -174]]), '#f6f8fc', 1);
  for (let i = 0; i < 5; i++) {
    const tx = -40 + i * 26;
    f.fill(curve([[tx, -130 - (i % 2) * 10], [tx + 5, -150 - (i % 2) * 10], [tx + 10, -130 - (i % 2) * 10]]), '#2f6a34', 0.8);
  }
  for (let i = 0; i < 4; i++) flower(f, -50 + i * 34, -124, 14, P.white, r);
  band(f, [[-120, -40], [-60, -110], [10, -140]], 16);
  band(f, [[40, -132], [100, -90], [130, -30]], 16);
}
