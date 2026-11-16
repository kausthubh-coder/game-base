// The painted fox that still sits at the feet of the scraped place. Sitting, facing left, looking up.
// Units: feet at 0, about 100 tall. Its tail is drawn apart so it can swish.
import { curve } from './core.ts';
import { type Fresco, ellipseAt } from './fresco.ts';

const FOX = '#d8692a';
const DARK = '#9a4318';
const CREAM = '#f7eedd';

export function fox(f: Fresco, x: number, y: number, h: number, withTail = true): void {
  f.save();
  f.translate(x, y);
  f.scaleBy(h / 100);
  if (withTail) foxTail(f, 0);
  const body = curve([[-14, 0], [-17, -20], [-13, -44], [-11, -60], [-1, -63], [9, -52], [22, -42], [33, -24], [31, -4], [18, 0]]);
  const g = f.p.createLinearGradient(-16, 0, 32, 0);
  g.addColorStop(0, FOX);
  g.addColorStop(1, '#c4561e');
  f.fill(body, g, 1.6);
  // The haunch.
  const haunch = new Path2D();
  haunch.moveTo(6, -36);
  haunch.quadraticCurveTo(28, -40, 26, -4);
  f.line(haunch, DARK, 1.6, 0.6);
  f.fill(curve([[-14, -1], [-17, -20], [-13, -44], [-8, -56], [-3, -42], [-5, -20], [-7, -2]]), CREAM, 0);
  // Front legs with dark socks.
  for (const lx of [-11, -4]) {
    const leg = new Path2D();
    leg.moveTo(lx, -30);
    leg.lineTo(lx - 0.5, -1);
    f.line(leg, '#5a2a12', 5.6, 0.9);
    f.line(leg, FOX, 4.4);
    const sock = new Path2D();
    sock.moveTo(lx - 0.4, -9);
    sock.lineTo(lx - 0.5, -1);
    f.line(sock, '#3a2214', 4.6);
  }
  // Head, tipped up to look at the wall.
  f.save();
  f.translate(-7, -70);
  f.rotate(0.5);
  for (const [ex, tip] of [[2, -20], [-7, -21]] as const) {
    const ear = curve([[ex - 4, -6], [ex + 0.5, tip], [ex + 4.5, -7]]);
    f.fill(ear, FOX, 1.3);
    f.wash(curve([[ex - 2, -7], [ex + 0.5, tip + 5], [ex + 2.6, -8]]), '#3a2214', 0.85);
  }
  const head = curve([[-22, 2], [-12, -6], [-4, -10], [6, -6], [8, 2], [2, 8], [-10, 7], [-20, 5]]);
  f.fill(head, FOX, 1.5);
  f.fill(curve([[-22, 2.6], [-12, 3], [-3, 4], [2, 8], [-10, 7.5], [-20, 5.2]]), CREAM, 0);
  f.wash(ellipseAt(-22, 2.4, 1.8, 1.5, 0), '#1e120a');
  const eye = new Path2D();
  eye.moveTo(-9, -2.2);
  eye.quadraticCurveTo(-6.8, -3.8, -4.6, -2.4);
  f.line(eye, '#1e120a', 1.1);
  f.wash(ellipseAt(-6.8, -1.9, 1.1, 1.2, 0), '#1e120a');
  f.restore();
  f.restore();
}

/** The tail alone, swung by `swing` radians about where it meets the body. */
export function foxTail(f: Fresco, swing: number): void {
  f.save();
  f.translate(28, -8);
  f.rotate(swing);
  const tail = curve([[0, -6], [16, -10], [30, -16], [38, -30], [34, -38], [26, -30], [18, -16], [4, 4]]);
  f.fill(tail, FOX, 1.5);
  f.fill(curve([[30, -24], [38, -30], [35, -39], [29, -34]]), CREAM, 0.8);
  const fur = new Path2D();
  fur.moveTo(8, -4);
  fur.quadraticCurveTo(20, -10, 28, -22);
  f.line(fur, DARK, 1.2, 0.5);
  f.restore();
}
