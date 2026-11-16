// The legend's people, painted at load into a Fresco. A figure is drawn in its own units: feet at 0, 100 units
// tall, y up is negative. Flat and stylised, full length, with a simple kind face, like a temple painting.
import { type Rand, blob, curve, ellipse, lerp, poly, rng, shade } from './core.ts';
import { type Fresco, INK, type Motif, P, ellipseAt } from './fresco.ts';

export type HairStyle = 'short' | 'messy' | 'curly' | 'bun' | 'braid' | 'wavy';
export type Hold = 'none' | 'hoe' | 'hoe-side' | 'spear' | 'pole' | 'plant' | 'scales' | 'wheel' | 'abacus' | 'book' | 'hammer' | 'banner-rod';
export type Arms = 'chest' | 'sides' | 'open' | 'staff' | 'hoe-across' | 'forward' | 'rest';

export interface Person {
  robe: string;
  mantle?: string;
  dress?: 'robe' | 'tunic';
  motif?: Motif;
  skin?: string;
  hair: string;
  style: HairStyle;
  halo?: boolean;
  headband?: boolean;
  /** -1 looks left, 1 looks right. */
  look?: number;
  /** 0 ahead, 1 up at the sky, -1 down. */
  gaze?: number;
  eyes?: 'open' | 'closed';
  /** A sad face keeps its mouth still. */
  sad?: boolean;
  hold?: Hold;
  arms?: Arms;
  pose?: 'stand' | 'kneel';
  /** The way a kneeling figure faces. */
  dir?: 1 | -1;
  seed?: number;
  /** Mirrored left to right. */
  flip?: boolean;
}

type Pt = [number, number];

/** Draws a person with feet at x, y and height h in the fresco's space. */
export function person(f: Fresco, x: number, y: number, h: number, who: Person): void {
  const r = rng(who.seed ?? Math.round(x * 7 + y * 13 + h));
  f.save();
  f.translate(x, y);
  f.scaleBy(h / 100);
  if (who.flip) f.scaleBy(-1, 1);
  if (who.pose === 'kneel') kneeling(f, who, r);
  else standing(f, who, r);
  f.restore();
}

function standing(f: Fresco, who: Person, r: Rand): void {
  const dress = who.dress ?? 'robe';
  const skin = who.skin ?? P.skin;
  const look = who.look ?? 0;
  if (who.halo) halo(f, look * 1.2, -89, 13.5);
  if (who.style === 'wavy' || who.style === 'braid') backHair(f, who, look * 1.2, -89);
  // Feet.
  for (const sx of [-1, 1]) sandal(f, sx * 4.6, -1.6, skin);
  if (dress === 'tunic') {
    // Trousers, rolled at the ankle.
    for (const sx of [-1, 1]) {
      const leg = poly([[sx * 1, -40], [sx * 9.5, -40], [sx * 8.4, -5], [sx * 2.2, -5]]);
      f.fill(leg, P.tan, 1.4);
      f.wash(poly([[sx * 1, -40], [sx * 3.5, -40], [sx * 3.4, -5], [sx * 2.2, -5]]), shade(P.tan, -0.25), 0.4);
      f.line(poly([[sx * 2.2, -8], [sx * 8.6, -8]]), shade(P.tan, -0.3), 0.8, 0.6);
    }
  }
  neck(f, look, -89, skin);
  if (dress === 'tunic') tunic(f, who, r);
  else robe(f, who, r);
  holdBehind(f, who);
  arms(f, who, skin, r);
  head(f, who, look * 1.2, -89, r);
}

function kneeling(f: Fresco, who: Person, r: Rand): void {
  const d = who.dir ?? 1;
  const skin = who.skin ?? P.skin;
  const look = who.look ?? d * 0.5;
  const hy = -64;
  if (who.halo) halo(f, look * 1.2 + d * 2, hy, 13.5);
  if (who.style === 'wavy' || who.style === 'braid') backHair(f, who, look * 1.2 + d * 2, hy);
  // The sole of the back foot.
  sandal(f, -d * 17, -2.5, skin, d);
  neck(f, look + d * 1.6, hy, skin);
  const robeColor = who.robe;
  if ((who.dress ?? 'robe') === 'tunic') {
    // Front knee up, back knee down.
    const thigh = curve([[d * -4, -30], [d * 8, -30], [d * 17, -26], [d * 19, -18], [d * 15, -14], [d * 2, -14], [d * -10, -10]]);
    f.fill(thigh, P.tan, 1.4);
    f.fill(poly([[d * 12, -18], [d * 19, -18], [d * 18.5, -3], [d * 13, -3]]), P.tan, 1.4);
    sandal(f, d * 17, -1.5, skin, d);
    f.fill(curve([[d * -14, -12], [d * 2, -14], [d * 6, -4], [d * -16, -2], [d * -19, -5]]), shade(P.tan, -0.08), 1.4);
    const body = curve([[d * -3, -58], [d * 4, -59], [d * 11, -55], [d * 12, -40], [d * 10, -26], [d * -2, -24], [d * -12, -27], [d * -12, -42], [d * -10, -55]]);
    f.fill(body, robeColor, 1.6);
    f.wash(curve([[d * -12, -42], [d * -10, -55], [d * -6, -57], [d * -7, -40], [d * -9, -27], [d * -12, -27]]), shade(robeColor, -0.3), 0.45);
    f.fill(poly([[d * -11, -40], [d * 11.5, -40], [d * 11.5, -37], [d * -11.5, -37]]), '#9a5a2a', 1);
  } else {
    // A robe gathered into a mound, one knee forward.
    const body = curve([[d * -4, -58], [d * 5, -59], [d * 12, -54], [d * 13, -38], [d * 17, -28], [d * 23, -16], [d * 24, -3], [d * 4, 0], [d * -14, 0], [d * -19, -6], [d * -15, -26], [d * -13, -44], [d * -11, -55]]);
    const g = f.p.createLinearGradient(d * -18, 0, d * 22, 0);
    g.addColorStop(0, shade(robeColor, -0.12));
    g.addColorStop(0.6, robeColor);
    g.addColorStop(1, shade(robeColor, 0.1));
    f.fill(body, g, 1.7);
    // Folds over the knee and down the back.
    const folds = new Path2D();
    folds.moveTo(d * 2, -34);
    folds.quadraticCurveTo(d * 12, -22, d * 20, -6);
    folds.moveTo(d * -6, -40);
    folds.quadraticCurveTo(d * -10, -20, d * -12, -2);
    folds.moveTo(d * 6, -24);
    folds.quadraticCurveTo(d * 8, -12, d * 6, -1);
    f.line(folds, shade(robeColor, -0.35), 1.3, 0.55);
    // Gold hem.
    const hem = new Path2D();
    hem.moveTo(d * -18, -4);
    hem.quadraticCurveTo(d * 2, 1, d * 23, -3);
    f.gildLine(hem, 2.2);
    // The mantle's edge with its trim.
    const trim = new Path2D();
    trim.moveTo(d * -3, -58);
    trim.bezierCurveTo(d * 4, -44, d * 10, -36, d * 14, -26);
    f.gildLine(trim, 1.8);
    if (who.motif) motif(f, who.motif, d * -6, -30, 4.2);
  }
  holdBehind(f, who);
  arms(f, who, skin, r, -25, d);
  head(f, who, look * 1.2 + d * 2, hy, r);
}

function neck(f: Fresco, look: number, hy: number, skin: string): void {
  const n = poly([[look - 2.8, hy + 5], [look + 2.8, hy + 5], [look + 3.2, hy + 11], [look - 3.2, hy + 11]]);
  f.fill(n, skin, 0);
  f.wash(poly([[look - 2.8, hy + 6], [look + 2.8, hy + 6], [look + 2.8, hy + 8.5], [look - 2.8, hy + 8.5]]), shade(skin, -0.3), 0.35);
}

function robe(f: Fresco, who: Person, r: Rand): void {
  const c = who.robe;
  const mantle = who.mantle ?? shade(c, -0.12);
  const under = shade(c, 0.12);
  const body = curve([
    [-3.5, -82], [-9.5, -79.5], [-11.2, -75], [-11, -64], [-10.2, -52], [-11.2, -40], [-13.2, -24], [-15.6, -5],
    [-8, -3.2], [0, -4], [8, -3.2], [15.6, -5], [13.2, -24], [11.2, -40], [10.2, -52], [11, -64], [11.2, -75], [9.5, -79.5], [3.5, -82],
  ]);
  const g = f.p.createLinearGradient(-16, 0, 16, 0);
  g.addColorStop(0, shade(under, -0.08));
  g.addColorStop(0.5, under);
  g.addColorStop(1, shade(under, -0.18));
  f.fill(body, g, 1.8);
  // Folds of the under robe.
  const folds = new Path2D();
  for (const x of [-7, -2, 4, 9]) {
    folds.moveTo(x * 0.7, -40);
    folds.quadraticCurveTo(x * 0.9 + (r() - 0.5) * 2, -22, x * 1.15, -5);
  }
  f.line(folds, shade(c, -0.3), 1.2, 0.5);
  // Gold hem band.
  const hem = new Path2D();
  hem.moveTo(-15.2, -8);
  hem.quadraticCurveTo(0, -6, 15.2, -8);
  f.gildLine(hem, 2.4);
  // The mantle: over the left shoulder, across the body to the right hip.
  const m = curve([
    [-11.2, -75], [-5, -81.5], [-1, -80], [3.5, -67], [8, -53], [12.5, -38], [13.8, -22], [7, -17.5], [-2, -15.5], [-13.6, -17.5], [-12, -34], [-10.6, -52], [-11, -68],
  ]);
  const mg = f.p.createLinearGradient(-14, -70, 14, -20);
  mg.addColorStop(0, shade(mantle, 0.06));
  mg.addColorStop(1, shade(mantle, -0.14));
  f.fill(m, mg, 1.7);
  const mf = new Path2D();
  mf.moveTo(-9, -68);
  mf.quadraticCurveTo(-4, -46, 6, -24);
  mf.moveTo(-12, -52);
  mf.quadraticCurveTo(-8, -36, -6, -19);
  mf.moveTo(-2, -60);
  mf.quadraticCurveTo(4, -44, 11, -28);
  f.line(mf, shade(mantle, -0.35), 1.2, 0.5);
  const edge = new Path2D();
  edge.moveTo(-1.5, -80);
  edge.bezierCurveTo(3, -66, 11, -46, 13.6, -22);
  edge.moveTo(13.6, -21);
  edge.quadraticCurveTo(0, -14.5, -13.4, -17.5);
  f.gildLine(edge, 2);
  if (who.motif) {
    f.save();
    f.clip(m);
    motif(f, who.motif, -6, -36, 6.5);
    motif(f, who.motif, 6, -26, 4.2);
    motif(f, who.motif, -8, -58, 3.6);
    f.restore();
    motif(f, who.motif, -4, -10.5, 3);
    motif(f, who.motif, 5, -10.5, 3);
  }
  // A brooch at the shoulder.
  f.gild(ellipseAt(-9.5, -76, 1.6, 1.6, 0), 0.6);
}

function tunic(f: Fresco, who: Person, r: Rand): void {
  const c = who.robe;
  const body = curve([
    [-3.5, -82], [-9.5, -79.5], [-11.4, -75], [-10.8, -60], [-11, -48], [-13.4, -37], [-7, -35.6], [0, -36.4], [7, -35.6], [13.4, -37], [11, -48], [10.8, -60], [11.4, -75], [9.5, -79.5], [3.5, -82],
  ]);
  const g = f.p.createLinearGradient(-14, 0, 14, 0);
  g.addColorStop(0, shade(c, 0.05));
  g.addColorStop(0.55, c);
  g.addColorStop(1, shade(c, -0.18));
  f.fill(body, g, 1.8);
  const folds = new Path2D();
  folds.moveTo(-6, -52);
  folds.quadraticCurveTo(-7, -44, -9, -37);
  folds.moveTo(3, -52);
  folds.quadraticCurveTo(4, -44, 5, -37);
  folds.moveTo(-3, -74);
  folds.quadraticCurveTo(-5, -66, -7, -58);
  f.line(folds, shade(c, -0.3), 1.2, 0.5);
  // The neck slit and a rope belt.
  const slit = new Path2D();
  slit.moveTo(0, -80.5);
  slit.lineTo(0.6, -74);
  f.line(slit, shade(c, -0.4), 1, 0.8);
  f.fill(poly([[-12.6, -56.5], [12.6, -56.5], [12.4, -53.5], [-12.4, -53.5]]), '#a0602c', 1);
  const knot = new Path2D();
  knot.moveTo(-2, -55);
  knot.quadraticCurveTo(-3, -48, -2.5, -42 + r());
  knot.moveTo(-1, -55);
  knot.quadraticCurveTo(0, -49, 0.5, -44);
  f.line(knot, '#a0602c', 1.4);
}

/** Two arms as sleeves along shoulder, elbow and hand, with hands at the end. */
function arms(f: Fresco, who: Person, skin: string, r: Rand, dy = 0, d: 1 | -1 = 1): void {
  const hold = who.hold ?? 'none';
  const kind = who.arms ?? (hold === 'none' ? 'sides' : hold === 'hoe' ? 'hoe-across' : hold === 'hoe-side' || hold === 'spear' || hold === 'pole' ? 'staff' : 'chest');
  // A kneeling figure is turned to face d: its far shoulder is near the middle.
  const L: Pt = dy ? [-d * 4, -76 - dy] : [-9.6, -76 - dy];
  const R: Pt = dy ? [d * 7, -76 - dy] : [9.6, -76 - dy];
  let le: Pt;
  let lh: Pt;
  let re: Pt;
  let rh: Pt;
  switch (kind) {
    case 'chest': le = [-12.8, -60]; lh = [-4.6, -59]; re = [12.8, -60]; rh = [4.6, -59]; break;
    case 'open': le = [-20, -73]; lh = [-30, -76]; re = [21, -80]; rh = [27, -92]; break;
    case 'staff': le = [-12.6, -61]; lh = [-10.8, -49]; re = [13.4, -64]; rh = [13.2, -56]; break;
    case 'hoe-across': le = [-12.6, -61]; lh = [-1, -60]; re = [12.8, -56]; rh = [5, -46]; break;
    case 'forward': le = [d * 2, -59]; lh = [d * 12, -51]; re = [d * 10, -61]; rh = [d * 17, -53]; break;
    case 'rest': le = [d * -4, -54]; lh = [d * 6, -42]; re = [d * 6, -56]; rh = [d * 16, -60]; break;
    default: le = [-12.4, -61]; lh = [-11.6, -48]; re = [12.4, -61]; rh = [11.6, -48];
  }
  for (const p of [le, lh, re, rh]) p[1] -= dy;
  const sleeve = who.dress === 'tunic' ? shade(who.robe, 0.04) : shade(who.mantle ?? who.robe, -0.06);
  const one = (s: Pt, e: Pt, h: Pt, front: boolean) => {
    const path = new Path2D();
    path.moveTo(s[0], s[1]);
    path.quadraticCurveTo(e[0], e[1], lerp(e[0], h[0], who.dress === 'tunic' ? 0.05 : 0.78), lerp(e[1], h[1], who.dress === 'tunic' ? 0.05 : 0.78));
    if (who.dress === 'tunic') {
      // Short sleeve, then a bare forearm, each a little narrower toward its end.
      limb(f, [lerp(s[0], e[0], 0.5), lerp(s[1], e[1], 0.5)], e, 3.4, 2.7, skin);
      limb(f, e, h, 2.8, 2.2, skin);
      limb(f, [s[0] - 0.5, s[1] + 1], [lerp(s[0], e[0], 0.62), lerp(s[1], e[1], 0.62)], 4.6, 4, sleeve);
    } else {
      f.line(path, INK, 7.4, 0.85);
      f.line(path, sleeve, 6);
      // The sleeve hangs from the forearm like a bell.
      const m1x = lerp(e[0], h[0], 0.3);
      const m1y = lerp(e[1], h[1], 0.3);
      const m2x = lerp(e[0], h[0], 0.78);
      const m2y = lerp(e[1], h[1], 0.78);
      const drape = new Path2D();
      drape.moveTo(m1x, m1y);
      drape.lineTo(m2x, m2y);
      drape.quadraticCurveTo(m2x + (e[0] - h[0]) * 0.05, m2y + 9, lerp(m1x, m2x, 0.4), m1y + 8.5);
      drape.closePath();
      f.fill(drape, shade(sleeve, -0.06), 1.2);
      // A wide cuff with gold trim.
      const cx = lerp(e[0], h[0], 0.78);
      const cy = lerp(e[1], h[1], 0.78);
      const a = Math.atan2(h[1] - e[1], h[0] - e[0]);
      const cuff = ellipseAt(cx, cy, 2, 4.4, a);
      f.fill(cuff, sleeve, 1.2);
      const t = new Path2D();
      t.ellipse(cx, cy, 2, 4.4, a, -Math.PI / 2, Math.PI / 2);
      f.gildLine(t, 1, false);
    }
    hand(f, h[0], h[1], skin, front, r);
  };
  one(L, le, lh, true);
  one(R, re, rh, true);
  holdFront(f, who, lh, rh);
}

/** An arm or a sleeve: a rounded shape from a to b, w0 half-wide at a and w1 at b. */
function limb(f: Fresco, a: Pt, b: Pt, w0: number, w1: number, color: string): void {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  const p = new Path2D();
  p.moveTo(a[0] + nx * w0, a[1] + ny * w0);
  p.lineTo(b[0] + nx * w1, b[1] + ny * w1);
  p.arc(b[0], b[1], w1, ang + Math.PI / 2, ang - Math.PI / 2, true);
  p.lineTo(a[0] - nx * w0, a[1] - ny * w0);
  p.arc(a[0], a[1], w0, ang - Math.PI / 2, ang + Math.PI / 2, true);
  p.closePath();
  f.fill(p, color, 1.2);
}

function hand(f: Fresco, x: number, y: number, skin: string, _front: boolean, r: Rand): void {
  const p = blob(x, y, 2.5, 2.1, r, 0.08, 8);
  f.fill(p, skin, 1.1);
  const k = new Path2D();
  k.moveTo(x - 1.4, y - 0.4);
  k.lineTo(x + 1.2, y - 0.6);
  f.line(k, shade(skin, -0.35), 0.5, 0.6);
}

function sandal(f: Fresco, x: number, y: number, skin: string, d = 0): void {
  f.fill(ellipseAt(x + d * 1.5, y - 0.6, 3.6, 1.8, 0), skin, 1);
  f.fill(ellipseAt(x + d * 1.5, y + 0.3, 4.4, 1.5, 0), '#7a4a26', 1);
  const strap = new Path2D();
  strap.moveTo(x - 2.6, y - 1.6);
  strap.lineTo(x + 2.6, y - 1.2);
  f.line(strap, '#7a4a26', 0.9);
}

/** A tooled gold halo. */
export function halo(f: Fresco, x: number, y: number, rad: number): void {
  f.gild(ellipseAt(x, y, rad, rad, 0), 1.4);
  const rings = new Path2D();
  rings.arc(x, y, rad - 1.6, 0, Math.PI * 2);
  rings.moveTo(x + rad - 3.6, y);
  rings.arc(x, y, rad - 3.6, 0, Math.PI * 2);
  f.line(rings, 'rgba(150,100,24,0.6)', 0.6);
  const dots = new Path2D();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    dots.moveTo(x + Math.cos(a) * (rad - 2.6) + 0.35, y + Math.sin(a) * (rad - 2.6));
    dots.arc(x + Math.cos(a) * (rad - 2.6), y + Math.sin(a) * (rad - 2.6), 0.35, 0, Math.PI * 2);
  }
  f.line(dots, 'rgba(140,90,20,0.7)', 0.5);
}

function backHair(f: Fresco, who: Person, hx: number, hy: number): void {
  if (who.style === 'wavy') {
    const p = curve([[hx - 8, hy - 2], [hx - 9.5, hy + 6], [hx - 10, hy + 16], [hx - 6, hy + 20], [hx + 6, hy + 20], [hx + 10, hy + 16], [hx + 9.5, hy + 6], [hx + 8, hy - 2], [hx, hy - 9]]);
    f.fill(p, who.hair, 1.3);
  }
}

/** A head centred at hx, hy in figure units: hair, face, ears. */
export function head(f: Fresco, who: Person, hx: number, hy: number, r: Rand = rng(1)): void {
  const skin = who.skin ?? P.skin;
  const look = who.look ?? 0;
  const gaze = who.gaze ?? 0;
  const tilt = -gaze * 0.12 * (look >= 0 ? 1 : -1);
  f.save();
  f.translate(hx, hy);
  f.rotate(tilt);
  // Ears.
  if (Math.abs(look) < 0.35) {
    for (const s of [-1, 1]) f.fill(ellipseAt(s * 7.1, 0.8, 1.4, 2.1, 0), skin, 1);
  } else {
    f.fill(ellipseAt(-Math.sign(look) * 6.3, 0.6, 1.4, 2.1, 0), skin, 1);
  }
  const face = curve([[-7.2, -2], [-6.8, 4], [-3.6, 7.6], [look * 1.2, 8.6], [3.6, 7.6], [6.8, 4], [7.2, -2], [5, -8], [0, -9.2], [-5, -8]]);
  const g = f.p.createRadialGradient(look * 2 - 1, -1, 1, 0, 0, 9);
  g.addColorStop(0, shade(skin, 0.1));
  g.addColorStop(0.7, skin);
  g.addColorStop(1, shade(skin, -0.12));
  f.fill(face, g, 1.3);
  features(f, look, gaze, who.eyes ?? 'open', skin, who.sad ?? false);
  hair(f, who, look, r);
  if (who.headband) {
    const b = new Path2D();
    b.moveTo(-7.4, -3.8);
    b.quadraticCurveTo(0, -7.6, 7.4, -3.8);
    f.gildLine(b, 1.6);
  }
  f.restore();
}

function features(f: Fresco, look: number, gaze: number, eyes: 'open' | 'closed', skin: string, sad: boolean): void {
  const lx = look * 2.4;
  const ey = 0.4 - gaze * 0.7;
  // Blush.
  for (const s of [-1, 1]) f.wash(ellipseAt(lx + s * 3.9, 3.4, 1.6, 0.95, 0), '#e88a7a', 0.35);
  const p = new Path2D();
  if (eyes === 'closed') {
    for (const s of [-1, 1]) {
      p.moveTo(lx + s * 2.7 - 1.2, ey + 0.2);
      p.quadraticCurveTo(lx + s * 2.7, ey + 1.3, lx + s * 2.7 + 1.2, ey + 0.2);
    }
    f.line(p, '#3a2414', 0.65);
  } else {
    for (const s of [-1, 1]) {
      const ex = lx + s * 2.7 + (s === Math.sign(look) ? look * 0.2 : 0);
      f.wash(ellipseAt(ex, ey, 0.95, 1.25, 0), '#2a1a10');
      f.wash(ellipseAt(ex + 0.3, ey - 0.45 - gaze * 0.1, 0.32, 0.32, 0), '#ffffff', 0.9);
      p.moveTo(ex - 1.1, ey - 1.15);
      p.quadraticCurveTo(ex, ey - 1.6, ex + 1.1, ey - 1.0);
    }
    f.line(p, '#2a1a10', 0.5);
  }
  const brow = new Path2D();
  for (const s of [-1, 1]) {
    // Gentle brows, raised a little at the inner end: a kind face, never a cross one.
    brow.moveTo(lx + s * 2.7 - s * 1.4, -3.5 - gaze * 0.6);
    brow.quadraticCurveTo(lx + s * 2.7, -4.2 - gaze * 0.6, lx + s * 2.7 + s * 1.4, -3.3 - gaze * 0.6);
  }
  f.line(brow, '#7a5434', 0.45, 0.7);
  const nose = new Path2D();
  nose.moveTo(lx + look * 0.9, 1.6);
  nose.quadraticCurveTo(lx + look * 1.6 + 0.4, 3.2, lx + look * 0.6, 3.5);
  f.line(nose, shade(skin, -0.35), 0.5, 0.8);
  const mouth = new Path2D();
  const mx = lx + look * 0.5;
  mouth.moveTo(mx - 1.3, 5.4);
  mouth.quadraticCurveTo(mx, sad ? 4.9 : 6.2, mx + 1.3, 5.4);
  f.line(mouth, '#a0483a', 0.65);
}

function hair(f: Fresco, who: Person, look: number, r: Rand): void {
  const c = who.hair;
  const lx = look * 1.4;
  const hl = shade(c, 0.25);
  if (who.style === 'curly') {
    const p = new Path2D();
    for (let i = 0; i < 15; i++) {
      const a = Math.PI * (1.05 + (i / 14) * 0.9);
      const rad = 7.6 + r() * 0.8;
      ellipse(lx * 0.5 + Math.cos(a) * rad, -1.5 + Math.sin(a) * rad * 0.95, 2.6, 2.4, 0, p);
    }
    ellipse(lx * 0.5, -5.4, 6.4, 3.6, 0, p);
    f.fill(p, c, 0);
    curls(f, lx, hl, r);
    return;
  }
  // The cap of hair with a fringe.
  const cap = curve([
    [-7.8, 2], [-8.3, -3.5], [-6.6, -8], [-2, -10.4], [3, -10.2], [7, -7.6], [8.3, -3], [7.8, 2], [7.0, -2.2],
    [5 + lx, -4.6], [2.8 + lx, -3.1], [0.5 + lx, -4.8], [-1.8 + lx, -3.2], [-4 + lx, -4.6], [-6.4, -2.4],
  ]);
  f.fill(cap, c, 1.2);
  if (who.style === 'messy' || who.style === 'short') {
    const n = who.style === 'messy' ? 8 : 4;
    const spikes = new Path2D();
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (1.05 + (i / (n - 1)) * 0.9);
      const bx = Math.cos(a) * 7.6;
      const by = -1.2 + Math.sin(a) * 8.6;
      const ta = a + (r() - 0.5) * 0.7;
      const len = who.style === 'messy' ? 1.6 + r() * 1.2 : 1.2 + r() * 0.6;
      // A lock of hair: rounded on one side, a soft point on the other, curling with the head.
      const tx = bx + Math.cos(ta) * len * 1.4;
      const ty = by + Math.sin(ta) * len * 1.4;
      spikes.moveTo(bx + Math.cos(a + 1.3) * 2, by + Math.sin(a + 1.3) * 2);
      spikes.quadraticCurveTo(bx + Math.cos(a + 0.5) * len * 1.3, by + Math.sin(a + 0.5) * len * 1.3, tx, ty);
      spikes.quadraticCurveTo(bx + Math.cos(a - 0.2) * len * 0.6, by + Math.sin(a - 0.2) * len * 0.6, bx + Math.cos(a - 1.3) * 2, by + Math.sin(a - 1.3) * 2);
      spikes.closePath();
    }
    f.fill(spikes, c, 1);
  }
  if (who.style === 'bun') {
    f.fill(blob(-lx * 1.6, -10.4, 3.8, 3.2, r, 0.08, 9), c, 1.2);
  }
  if (who.style === 'braid') {
    const side = look >= 0 ? -1 : 1;
    for (let i = 0; i < 6; i++) {
      f.fill(ellipseAt(side * (6.6 + i * 0.5), 3 + i * 3.4, 2.1, 2.2, 0.3 * side), c, 1);
    }
  }
  // A shine across the hair.
  const shine = new Path2D();
  shine.moveTo(-4.6, -7.2);
  shine.quadraticCurveTo(-1, -9.2, 3.6, -8.4);
  f.line(shine, hl, 0.9, 0.55);
}

function curls(f: Fresco, lx: number, hl: string, r: Rand): void {
  const p = new Path2D();
  for (let i = 0; i < 7; i++) {
    const x = -6 + i * 2 + lx * 0.4;
    const y = -6 - Math.sin((i / 6) * Math.PI) * 3.4 + r();
    p.moveTo(x + 1, y);
    p.arc(x, y, 1, 0, Math.PI * 1.5);
  }
  f.line(p, hl, 0.6, 0.6);
}

/** The people's sign, in gold. */
export function motif(f: Fresco, m: Motif, x: number, y: number, s: number): void {
  const p = new Path2D();
  switch (m) {
    case 'leaf': {
      const stem = new Path2D();
      stem.moveTo(x, y + s);
      stem.quadraticCurveTo(x + s * 0.2, y, x, y - s);
      f.gildLine(stem, s * 0.12, false);
      for (let i = 0; i < 3; i++) {
        for (const sd of [-1, 1]) {
          const ly = y + s * 0.6 - i * s * 0.55;
          p.moveTo(x, ly);
          p.quadraticCurveTo(x + sd * s * 0.45, ly - s * 0.45, x + sd * s * 0.55, ly - s * 0.1);
          p.quadraticCurveTo(x + sd * s * 0.2, ly + s * 0.05, x, ly);
        }
      }
      break;
    }
    case 'flame':
      for (const [ox, k] of [[0, 1], [-0.45, 0.7], [0.45, 0.65]] as const) {
        const fx = x + ox * s;
        p.moveTo(fx, y + s * 0.8);
        p.bezierCurveTo(fx - s * 0.5 * k, y + s * 0.2, fx - s * 0.1, y - s * 0.4 * k, fx + s * 0.15 * k, y - s * k);
        p.bezierCurveTo(fx + s * 0.1, y - s * 0.3 * k, fx + s * 0.55 * k, y + s * 0.1, fx, y + s * 0.8);
      }
      break;
    case 'wave': {
      const w = new Path2D();
      w.moveTo(x - s, y + s * 0.5);
      w.bezierCurveTo(x - s * 0.5, y - s * 0.6, x + s * 0.6, y - s * 0.8, x + s * 0.5, y);
      w.bezierCurveTo(x + s * 0.4, y + s * 0.4, x - s * 0.1, y + s * 0.3, x, y - s * 0.1);
      w.moveTo(x - s, y + s * 0.85);
      w.quadraticCurveTo(x, y + s * 0.4, x + s, y + s * 0.85);
      f.gildLine(w, s * 0.16, false);
      return;
    }
    case 'grape':
      for (const [gx, gy] of [[0, -0.2], [-0.32, -0.25], [0.32, -0.25], [-0.16, 0.12], [0.16, 0.12], [0, 0.45], [-0.48, -0.55], [0.1, -0.6]] as const) {
        ellipse(x + gx * s, y + gy * s, s * 0.18, s * 0.18, 0, p);
      }
      break;
    case 'star':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = i % 2 ? s * 0.32 : s * 0.85;
        if (i === 0) p.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else p.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        const a2 = a + Math.PI / 8;
        p.lineTo(x + Math.cos(a2) * s * 0.18, y + Math.sin(a2) * s * 0.18);
      }
      p.closePath();
      break;
    case 'anvil':
      poly([[x - s * 0.9, y - s * 0.5], [x + s * 0.7, y - s * 0.5], [x + s, y - s * 0.25], [x + s * 0.4, y - s * 0.15], [x + s * 0.3, y + s * 0.2], [x + s * 0.6, y + s * 0.55], [x - s * 0.6, y + s * 0.55], [x - s * 0.3, y + s * 0.2], [x - s * 0.4, y - s * 0.15], [x - s * 0.9, y - s * 0.3]], p);
      break;
  }
  f.gild(p, 0.5);
}

function holdBehind(f: Fresco, who: Person): void {
  const h = who.hold ?? 'none';
  if (h === 'hoe') hoe(f, 14, -1, -10, -88);
  if (h === 'hoe-side') hoe(f, 13.5, -1, 13, -96, true);
  if (h === 'spear') spear(f, 13.5, 0, 13.5, -122);
  if (h === 'pole') spear(f, 13.5, 0, 13.5, -150, true);
}

function holdFront(f: Fresco, who: Person, lh: Pt, rh: Pt): void {
  const h = who.hold ?? 'none';
  const cx = (lh[0] + rh[0]) / 2;
  const cy = (lh[1] + rh[1]) / 2;
  if (h === 'plant') plant(f, cx, cy - 2);
  if (h === 'scales') scales(f, cx, cy);
  if (h === 'wheel') wheel(f, cx, cy - 2, 11);
  if (h === 'abacus') abacus(f, cx, cy - 4);
  if (h === 'book') book(f, cx, cy - 4);
  if (h === 'hammer') hammer(f, cx + 2, cy);
  if (h === 'banner-rod') rodBanner(f, who, lh, rh);
}

export function hoe(f: Fresco, x0: number, y0: number, x1: number, y1: number, right = false): void {
  const s = new Path2D();
  s.moveTo(x0, y0);
  s.lineTo(x1, y1);
  f.line(s, INK, 3.4, 0.85);
  f.line(s, P.wood, 2.2);
  const a = Math.atan2(y1 - y0, x1 - x0);
  f.save();
  f.translate(x1, y1);
  f.rotate(a + Math.PI / 2);
  const d = right ? 1 : -1;
  const blade = poly([[-1.6, -1], [d * 9, -2.6], [d * 10.5, 2.8], [d * 4, 1.6], [-1.6, 2]]);
  f.fill(blade, '#8a9098', 1.2);
  f.wash(poly([[d * 4, -1.6], [d * 9, -2.6], [d * 10.5, 2.8], [d * 7, 2.2]]), '#c6ccd4', 0.6);
  f.restore();
}

export function spear(f: Fresco, x0: number, y0: number, x1: number, y1: number, finial = false): void {
  const s = new Path2D();
  s.moveTo(x0, y0);
  s.lineTo(x1, y1);
  f.gildLine(s, 1.8);
  const tip = finial
    ? poly([[x1, y1 - 7], [x1 + 2.4, y1 - 1], [x1, y1 + 1], [x1 - 2.4, y1 - 1]])
    : poly([[x1, y1 - 9], [x1 + 2.2, y1 - 2], [x1, y1 + 1], [x1 - 2.2, y1 - 2]]);
  f.gild(tip, 0.8);
  f.gild(ellipseAt(x1, y1 + 2.5, 1.6, 1.1, 0), 0.6);
}

function plant(f: Fresco, x: number, y: number): void {
  const r = rng(5);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.2;
    const st = new Path2D();
    st.moveTo(x + (i - 4) * 0.8, y - 2);
    const tx = x + Math.cos(a) * 14;
    const ty = y - 2 + Math.sin(a) * 14;
    st.lineTo(tx, ty);
    f.line(st, '#4e7a3a', 0.8);
    for (let k = 0; k < 4; k++) f.wash(ellipseAt(tx - Math.cos(a) * k * 1.6, ty - Math.sin(a) * k * 1.6, 1, 0.8, 0), k % 2 ? '#8a6ac8' : '#a58ad8');
    if (i % 2) f.fill(ellipseAt(x + (i - 4) * 1.4, y - 4 - r() * 3, 2.2, 1, a), '#5f9a43', 0.6);
  }
  const pot = curve([[x - 8, y - 3], [x + 8, y - 3], [x + 6.5, y + 4], [x - 6.5, y + 4]]);
  f.fill(pot, '#efe2c8', 1.2);
  const band = new Path2D();
  band.moveTo(x - 7.5, y - 1);
  band.quadraticCurveTo(x, y + 0.5, x + 7.5, y - 1);
  f.gildLine(band, 1.2, false);
}

function scales(f: Fresco, x: number, y: number): void {
  const p = new Path2D();
  p.moveTo(x, y + 6);
  p.lineTo(x, y - 12);
  p.moveTo(x - 10, y - 8);
  p.lineTo(x + 10, y - 8);
  for (const s of [-1, 1]) {
    p.moveTo(x + s * 10, y - 8);
    p.lineTo(x + s * 13, y - 1);
    p.moveTo(x + s * 10, y - 8);
    p.lineTo(x + s * 7, y - 1);
  }
  f.gildLine(p, 1.1, false);
  for (const s of [-1, 1]) {
    const pan = new Path2D();
    pan.moveTo(x + s * 10 - 4.5, y - 1);
    pan.quadraticCurveTo(x + s * 10, y + 3.5, x + s * 10 + 4.5, y - 1);
    pan.closePath();
    f.gild(pan, 0.6);
  }
  f.gild(ellipseAt(x, y + 6.5, 4, 1.4, 0), 0.6);
  f.gild(ellipseAt(x, y - 12.5, 1.5, 1.5, 0), 0.5);
}

function wheel(f: Fresco, x: number, y: number, rad: number): void {
  const p = new Path2D();
  p.arc(x, y, rad, 0, Math.PI * 2);
  p.moveTo(x + rad * 0.6, y);
  p.arc(x, y, rad * 0.6, 0, Math.PI * 2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.moveTo(x + Math.cos(a) * 2, y + Math.sin(a) * 2);
    p.lineTo(x + Math.cos(a) * (rad + 3.6), y + Math.sin(a) * (rad + 3.6));
  }
  f.gildLine(p, 1.6);
  f.gild(ellipseAt(x, y, 2.6, 2.6, 0), 0.6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    f.gild(ellipseAt(x + Math.cos(a) * (rad + 3.8), y + Math.sin(a) * (rad + 3.8), 1.2, 1.2, 0), 0.5);
  }
}

function abacus(f: Fresco, x: number, y: number): void {
  const frame = poly([[x - 11, y - 9], [x + 11, y - 9], [x + 11, y + 9], [x - 11, y + 9]]);
  f.fill(frame, '#7a4a26', 1.2);
  f.fill(poly([[x - 9.5, y - 7.5], [x + 9.5, y - 7.5], [x + 9.5, y + 7.5], [x - 9.5, y + 7.5]]), '#4a2c1a', 0.6);
  const rods = new Path2D();
  for (let i = 0; i < 4; i++) {
    rods.moveTo(x - 9.5, y - 5 + i * 3.4);
    rods.lineTo(x + 9.5, y - 5 + i * 3.4);
  }
  f.line(rods, '#c8a050', 0.5);
  const beads = new Path2D();
  const r = rng(9);
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 5; k++) ellipse(x - 8 + k * 1.9 + (k > 2 ? 6 + r() * 2 : 0), y - 5 + i * 3.4, 0.9, 1.25, 0, beads);
  }
  f.gild(beads, 0.4);
}

function book(f: Fresco, x: number, y: number): void {
  const pages = poly([[x - 11, y - 8], [x, y - 6.5], [x + 11, y - 8], [x + 11, y + 7], [x, y + 8.5], [x - 11, y + 7]]);
  f.fill(pages, '#f6ecd4', 1.2);
  const ln = new Path2D();
  ln.moveTo(x, y - 6.5);
  ln.lineTo(x, y + 8.5);
  for (let i = 0; i < 4; i++) {
    ln.moveTo(x - 9, y - 4 + i * 3);
    ln.lineTo(x - 2, y - 3.5 + i * 3);
    ln.moveTo(x + 2, y - 3.5 + i * 3);
    ln.lineTo(x + 9, y - 4 + i * 3);
  }
  f.line(ln, 'rgba(120,90,60,0.55)', 0.5);
  // A quill.
  const q = new Path2D();
  q.moveTo(x - 14, y - 18);
  q.quadraticCurveTo(x - 9, y - 26, x - 4, y - 26);
  q.quadraticCurveTo(x - 9, y - 21, x - 14, y - 18);
  f.fill(q, '#fbf6ea', 0.8);
}

function hammer(f: Fresco, x: number, y: number): void {
  const s = new Path2D();
  s.moveTo(x, y + 14);
  s.lineTo(x + 1, y - 12);
  f.line(s, INK, 3.2, 0.85);
  f.line(s, '#8a5a2c', 2.2);
  f.fill(poly([[x - 6, y - 17], [x + 8, y - 17], [x + 8, y - 10], [x - 6, y - 10]]), '#7d8590', 1.2);
  f.wash(poly([[x - 6, y - 17], [x + 8, y - 17], [x + 8, y - 15], [x - 6, y - 15]]), '#c0c6ce', 0.7);
}

/** A banner hung from a short rod held out in front: the kneeling friends of the king. */
function rodBanner(f: Fresco, who: Person, lh: Pt, rh: Pt): void {
  const d = who.dir ?? 1;
  const x0 = Math.min(lh[0], rh[0]) - 3;
  const x1 = Math.max(lh[0], rh[0]) + 6;
  const y = Math.min(lh[1], rh[1]) - 1;
  const cx = d > 0 ? x1 - 2 : x0 + 2;
  const w = 14;
  const bx = cx - w / 2;
  const cloth = poly([[bx, y], [bx + w, y], [bx + w, y + 20], [bx + w / 2, y + 25], [bx, y + 20]]);
  f.fill(cloth, shade(who.robe, -0.05), 1.4);
  const trim = poly([[bx + 1.2, y + 1.2], [bx + w - 1.2, y + 1.2], [bx + w - 1.2, y + 19.4], [bx + w / 2, y + 23.6], [bx + 1.2, y + 19.4]]);
  f.gildLine(trim, 0.8, false);
  if (who.motif) motif(f, who.motif, bx + w / 2, y + 11, 5);
  const rod = new Path2D();
  rod.moveTo(x0 - 4, y);
  rod.lineTo(x1 + 4, y);
  f.gildLine(rod, 1.6);
  f.gild(ellipseAt(x0 - 4.5, y, 1.8, 1.8, 0), 0.5);
  f.gild(ellipseAt(x1 + 4.5, y, 1.8, 1.8, 0), 0.5);
}
