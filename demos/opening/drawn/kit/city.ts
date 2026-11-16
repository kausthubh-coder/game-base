// Towns of the legend: white walls, red roofs, gold domes, and an arched door with its people in it. The roads
// and the night shot both use them.
import { type Rand, blob, curve, ellipse, poly, rng, shade } from './core.ts';
import { head } from './figure.ts';
import { type Fresco, INK, P, PEOPLES, ellipseAt } from './fresco.ts';

const WALL = '#f4ecdc';
const ROOF = '#cf4a2c';

/** A house front: a block with a roof and windows. */
export function house(f: Fresco, x: number, y: number, w: number, h: number, r: Rand, dome = false, doors = 0): void {
  const body = poly([[x - w / 2, y], [x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y]]);
  const g = f.p.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, WALL);
  g.addColorStop(1, shade(WALL, -0.1));
  f.fill(body, g, 1.4);
  if (dome) {
    const d = new Path2D();
    d.moveTo(x - w * 0.42, y - h);
    d.bezierCurveTo(x - w * 0.42, y - h - w * 0.6, x + w * 0.42, y - h - w * 0.6, x + w * 0.42, y - h);
    d.closePath();
    f.gild(d, 1.2);
    const spire = new Path2D();
    spire.moveTo(x, y - h - w * 0.45);
    spire.lineTo(x, y - h - w * 0.62);
    spire.moveTo(x - w * 0.06, y - h - w * 0.56);
    spire.lineTo(x + w * 0.06, y - h - w * 0.56);
    f.gildLine(spire, Math.max(1.2, w * 0.03), false);
  } else {
    const roof = poly([[x - w / 2 - w * 0.08, y - h], [x, y - h - w * 0.32], [x + w / 2 + w * 0.08, y - h]]);
    f.fill(roof, ROOF, 1.3);
    const tiles = new Path2D();
    for (let k = 1; k < 4; k++) {
      tiles.moveTo(x - w / 2 + (w * k) / 4 - w * 0.05, y - h);
      tiles.lineTo(x, y - h - w * 0.3);
    }
    f.line(tiles, shade(ROOF, -0.3), 0.8, 0.5);
  }
  const win = Math.max(1, Math.floor(w / 26));
  for (let k = 0; k < win; k++) {
    const wx = x - w / 2 + (w * (k + 0.5)) / win;
    const wy = y - h * 0.62;
    const ww = Math.min(9, w * 0.12);
    const arch = new Path2D();
    arch.moveTo(wx - ww / 2, wy + ww);
    arch.lineTo(wx - ww / 2, wy);
    arch.arc(wx, wy, ww / 2, Math.PI, 0);
    arch.lineTo(wx + ww / 2, wy + ww);
    arch.closePath();
    f.fill(arch, r() < 0.5 ? '#e8b64a' : '#7a5236', 0.8);
  }
  for (let k = 0; k < doors; k++) {
    const dx = x - w / 2 + (w * (k + 0.5)) / doors;
    const dw = Math.min(w / doors * 0.5, 22);
    const door = new Path2D();
    door.moveTo(dx - dw / 2, y);
    door.lineTo(dx - dw / 2, y - dw);
    door.arc(dx, y - dw, dw / 2, Math.PI, 0);
    door.lineTo(dx + dw / 2, y);
    door.closePath();
    f.fill(door, '#6a4024', 1);
  }
}

export interface Doorway { x: number; y: number; stones: [number, number][] }

/**
 * A walled town around a gold dome, its great arch in front with two people in it. Returns where the people's
 * stones are, so the shot can light them. `s` is its size: 1 is a town 220 wide.
 */
export function town(f: Fresco, x: number, y: number, s: number, seed: number, people = 2): Doorway {
  const r = rng(seed);
  f.save();
  f.translate(x, y);
  f.scaleBy(s);
  // Houses behind, the dome in the middle.
  house(f, -74, -30, 52, 56, r);
  house(f, 74, -30, 52, 60, r);
  house(f, -40, -48, 46, 52, r, true);
  house(f, 44, -50, 40, 46, r);
  house(f, 0, -58, 70, 70, r, true);
  // The wall in front.
  const wall = curve([[-104, -18], [-60, -26], [0, -28], [60, -26], [104, -18], [104, 10], [60, 16], [0, 18], [-60, 16], [-104, 10]]);
  f.fill(wall, WALL, 1.6);
  const crenel = new Path2D();
  for (let k = -5; k <= 5; k++) ellipse(k * 19, -24 + Math.abs(k) * 0.6, 6, 3, 0, crenel);
  f.fill(crenel, shade(WALL, -0.06), 1);
  const blocks = new Path2D();
  for (let k = -4; k <= 4; k++) {
    blocks.moveTo(k * 22, -18);
    blocks.lineTo(k * 22, 14);
  }
  f.line(blocks, 'rgba(150,120,90,0.4)', 0.8);
  // The great arch, warm inside, and its people.
  const aw = 64;
  const arch = new Path2D();
  arch.moveTo(-aw / 2, 18);
  arch.lineTo(-aw / 2, -16);
  arch.arc(0, -16, aw / 2, Math.PI, 0);
  arch.lineTo(aw / 2, 18);
  arch.closePath();
  const ig = f.p.createRadialGradient(0, 0, 4, 0, 0, 50);
  ig.addColorStop(0, '#f6c860');
  ig.addColorStop(1, '#a8642a');
  f.fill(arch, ig, 1.8);
  const rim = new Path2D();
  rim.arc(0, -16, aw / 2 + 3, Math.PI, 0);
  f.gildLine(rim, 3.4);
  const stones: [number, number][] = [];
  for (let k = 0; k < people; k++) {
    const px = people === 1 ? 0 : (k - (people - 1) / 2) * 24;
    const p = PEOPLES[(seed + k * 3) % 6];
    const sh = curve([[px - 13, 18], [px - 12, 2], [px - 6, -4], [px, -5], [px + 6, -4], [px + 12, 2], [px + 13, 18]]);
    f.fill(sh, p.robe, 1.2);
    f.save();
    f.translate(px, -14);
    f.scaleBy(1.05);
    head(f, { robe: p.robe, hair: [P.hairDark, P.hairBrown, P.hairAuburn, P.hairBlond][(seed + k) % 4], style: (['short', 'bun', 'curly', 'messy'] as const)[(seed + k) % 4], look: 0 }, 0, 0, rng(seed + k));
    f.restore();
    // The stone at the throat, painted pale; the shot lights it.
    f.fill(ellipseAt(px, -1, 2.6, 2.6, 0), '#fff6d0', 0.8);
    stones.push([x + px * s, y - s]);
  }
  f.restore();
  return { x, y, stones };
}

/** A round tree with fruit, a dark cypress, or a tree in white blossom. */
export function tree(f: Fresco, x: number, y: number, s: number, kind: 'orange' | 'cypress' | 'blossom', r: Rand): void {
  if (kind === 'cypress') {
    const c = curve([[x, y - 70 * s], [x + 9 * s, y - 40 * s], [x + 10 * s, y - 8 * s], [x, y], [x - 10 * s, y - 8 * s], [x - 9 * s, y - 40 * s]]);
    f.fill(c, '#2f6a34', 1.2);
    const l = new Path2D();
    l.moveTo(x, y - 62 * s);
    l.quadraticCurveTo(x + 4 * s, y - 30 * s, x + 1 * s, y - 4 * s);
    f.line(l, '#4f8f48', 1.2, 0.6);
    return;
  }
  const trunk = new Path2D();
  trunk.moveTo(x, y);
  trunk.lineTo(x, y - 22 * s);
  f.line(trunk, INK, 6 * s + 1.4, 0.8);
  f.line(trunk, '#7a4a26', 6 * s);
  const crown = blob(x, y - 36 * s, 26 * s, 21 * s, r, 0.12, 11);
  f.fill(crown, kind === 'blossom' ? '#5f9a43' : '#3f8a3a', 1.3);
  for (let k = 0; k < 9; k++) {
    const fx = x + (r() - 0.5) * 38 * s;
    const fy = y - 36 * s + (r() - 0.5) * 28 * s;
    f.fill(ellipseAt(fx, fy, 3.4 * s, 3.4 * s, 0), kind === 'blossom' ? '#fbf6ea' : '#ef8a22', 0.6);
  }
}
