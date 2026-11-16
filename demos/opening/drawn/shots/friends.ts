// Shot 3, his friends. The camera walks along the farm boy and his six friends in gold, each holding the sign
// of their gift, and stops on the beat `scraped` at one more place: a figure chiselled back to bare plaster,
// with a painted fox still sitting at its feet. It holds there. Nothing points at it.
import { type Cam, type Ctx, H, type Rand, W, camLerp, canvas, curve, lerp, look, reset, rng, smooth, span, walk } from '../kit/core.ts';
import { type Person, person } from '../kit/figure.ts';
import { Fresco, INK, P, bands, composePanel, ellipseAt, flower, ground, rays } from '../kit/fresco.ts';
import { fox, foxTail } from '../kit/fox.ts';
import { FULL, type MakePainter, drawPanel, pause, sheen, stillOf } from '../kit/shot.ts';

const GROUND = 846;
const FIG_H = 530;
/** The seven figures' feet, then the scraped place, then the fox. */
const XS = [330, 510, 690, 870, 1050, 1230, 1410];
export const SCRAPED = { x: 1595, y: GROUND, h: FIG_H };
const FOX = { x: 1688, y: GROUND + 4, h: 175 };

const SEVEN: Person[] = [
  { robe: P.green, dress: 'tunic', hair: P.hairDark, style: 'messy', headband: true, hold: 'hoe', look: 0.1 },
  { robe: P.green, motif: 'leaf', hair: P.hairBrown, style: 'bun', hold: 'plant', look: 0.15 },
  { robe: P.vermilion, motif: 'flame', hair: P.hairAuburn, style: 'curly', hold: 'scales', look: 0.05 },
  { robe: P.lapis, motif: 'wave', hair: P.hairBlue, style: 'messy', hold: 'wheel', look: 0 },
  { robe: P.violet, motif: 'grape', hair: P.hairPurple, style: 'braid', hold: 'abacus', look: -0.05 },
  { robe: P.white, motif: 'star', hair: P.hairBlond, style: 'curly', hold: 'book', look: -0.1 },
  { robe: P.slate, motif: 'anvil', hair: P.hairDark, style: 'short', hold: 'hammer', look: -0.15 },
];

export const friends: MakePainter = (env) => {
  const scale = 1.9;
  let panel: HTMLCanvasElement;
  let gold: HTMLCanvasElement;
  let tail: HTMLCanvasElement;
  const TAIL_PX = 200;

  async function build() {
    const f = new Fresco(W, H, scale);
    const r = rng(31);
    bands(f, r);
    rays(f, 960, -120, 15, 260, 560, Math.PI * 0.18, Math.PI * 0.82, 2.2);
    ground(f, 220, 1780, GROUND, r);
    for (let i = 0; i < 7; i++) {
      person(f, XS[i], GROUND, FIG_H, { ...SEVEN[i], halo: true, seed: 100 + i });
      await pause();
    }
    scrape(f, SCRAPED.x, SCRAPED.y, SCRAPED.h, rng(77));
    fox(f, FOX.x, FOX.y, FOX.h, false);
    for (let x = 240; x < 1780; x += 90) {
      if (Math.abs(x - FOX.x) < 60) continue;
      const fx = x + (r() - 0.5) * 30;
      flower(f, fx, GROUND, 40 + r() * 14, [P.white, P.red, P.white][Math.floor(r() * 3)], r);
    }
    f.temper();
    panel = composePanel(f, 3, { cracks: 8 });
    gold = f.gold;
    // The tail, at twice the panel's own scale so it stays sharp up close.
    const t = new Fresco(TAIL_PX, TAIL_PX, scale);
    t.translate(TAIL_PX * 0.2 - 28 * (FOX.h / 100), TAIL_PX * 0.7 + 8 * (FOX.h / 100));
    t.scaleBy(FOX.h / 100);
    foxTail(t, 0);
    t.temper();
    tail = t.paint;
  }

  function camAt(tl: number, stop: number): Cam {
    const k = walk(tl / stop);
    const a: Cam = { x: 520, y: 560, zoom: 1.85 };
    const b: Cam = { x: SCRAPED.x + 30, y: 560, zoom: 1.85 };
    const cam = camLerp(a, b, k);
    // After the stop the camera settles a little closer, as if leaning in.
    const lean = smooth((tl - stop) / 3);
    cam.zoom += 0.1 * lean;
    cam.y += 14 * lean;
    // The walk has a gentle sway of a person carrying it.
    cam.y += Math.sin(tl * 2.2) * 3 * (1 - span(tl, stop - 0.6, stop));
    return cam;
  }

  function scene(ctx: Ctx, tl: number, cam: Cam) {
    drawPanel(ctx, panel, cam);
    look(ctx, cam);
    const u = FOX.h / 100;
    const swing = Math.sin(tl * 1.3) * 0.12 + Math.sin(tl * 3.1) * 0.03;
    ctx.translate(FOX.x + 28 * u, FOX.y - 8 * u);
    ctx.rotate(swing);
    ctx.drawImage(tail, -TAIL_PX * 0.2, -TAIL_PX * 0.7, TAIL_PX, TAIL_PX);
    reset(ctx);
  }

  return {
    build,
    draw(ctx, tl, shot) {
      const stop = shot.beats.scraped;
      const cam = camAt(tl, stop);
      scene(ctx, tl, cam);
      // A lamp's light runs along the gold as the camera walks, and leaves the scraped place in its own light.
      const pos = lerp(0.95, 0.05, walk(tl / stop));
      sheen(env, ctx, cam, [{ mask: gold, x: 0, y: 0, w: W, h: H }], pos, 0.45 * (1 - span(tl, stop - 0.4, stop + 0.6)), 0.05);
    },
    still: () => stillOf((ctx) => scene(ctx, 0, FULL)),
    hires() {
      const { canvas: c, ctx } = canvas(panel.width, panel.height);
      ctx.drawImage(panel, 0, 0);
      ctx.scale(scale, scale);
      const u = FOX.h / 100;
      ctx.translate(FOX.x + 28 * u, FOX.y - 8 * u);
      ctx.drawImage(tail, -TAIL_PX * 0.2, -TAIL_PX * 0.7, TAIL_PX, TAIL_PX);
      return c;
    },
  };
};

const hash01 = (n: number) => {
  const v = Math.sin(n * 91.7 + 7.3) * 43758.5;
  return v - Math.floor(v);
};

/** A figure chiselled away to bare plaster: rougher, paler, a little sunk, with flecks of its paint at the edge. */
function scrape(f: Fresco, x: number, y: number, h: number, r: Rand): void {
  const u = h / 100;
  const pts: [number, number][] = [];
  const outline = [
    [0, -98], [5.6, -96], [7.6, -90], [6.6, -84], [3.6, -81.5], [9.5, -79.5], [11.4, -75], [11.6, -62], [10.6, -50], [12.2, -36], [14.4, -20], [16.2, -4], [6, -1.5],
    [-6, -1.5], [-16.2, -4], [-14.4, -20], [-12.2, -36], [-10.6, -50], [-11.6, -62], [-11.4, -75], [-9.5, -79.5], [-3.6, -81.5], [-6.6, -84], [-7.6, -90], [-5.6, -96],
  ] as const;
  for (const [px, py] of outline) pts.push([x + (px + (r() - 0.5) * 1.6) * u, y + (py + (r() - 0.5) * 1.2) * u]);
  const shape = curve(pts);
  // The halo was gold leaf; it was cut away too, a rough round patch behind the head.
  const halo = new Path2D();
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const rr = (13.6 + (r() - 0.5) * 1.4) * u;
    const hx = x + Math.cos(a) * rr;
    const hy = y - 89 * u + Math.sin(a) * rr;
    if (i) halo.lineTo(hx, hy);
    else halo.moveTo(hx, hy);
  }
  halo.closePath();
  shape.addPath(halo);
  f.fill(shape, '#f7f0e2', 0);
  f.save();
  f.clip(shape);
  // A sunk shadow along the upper left, a lit lip on the lower right.
  f.line(shape, 'rgba(120,90,50,0.35)', 10 * u * 0.3);
  // Chisel marks: short strokes in runs, each with a dark cut and a pale edge.
  const marks = new Path2D();
  const lips = new Path2D();
  for (let i = 0; i < 240; i++) {
    // Marks come in little runs, each run cut at its own angle.
    const run = Math.floor(i / 6);
    const cx = x + ((hash01(run) - 0.5) * 30 + (r() - 0.5) * 4) * u;
    const cy = y - (hash01(run + 0.3) * 100 + (i % 6) * 1.6) * u;
    const a = -1.1 + hash01(run + 0.7) * 1.2;
    const len = (1.6 + r() * 2.2) * u;
    marks.moveTo(cx, cy);
    marks.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    lips.moveTo(cx + 1.4, cy + 1.4);
    lips.lineTo(cx + Math.cos(a) * len + 1.4, cy + Math.sin(a) * len + 1.4);
  }
  f.line(marks, 'rgba(130,95,60,0.55)', 1.6);
  f.line(lips, 'rgba(255,255,250,0.8)', 1.4);
  // Pits where the plaster came away.
  for (let i = 0; i < 10; i++) {
    const px = x + (r() - 0.5) * 26 * u;
    const py = y - r() * 100 * u;
    f.wash(ellipseAt(px, py, (1 + r() * 2.4) * u, (0.8 + r() * 1.6) * u, r() * 3), 'rgba(170,135,95,0.22)');
  }
  f.restore();
  // The broken edge, with flecks of the paint that was there: lapis, vermilion, gold.
  f.ink(shape, 1.4, 'rgba(110,70,35,1)', 0.55);
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    for (let k = 0; k < 5; k++) {
      const t = r();
      const fx = lerp(ax, bx, t) + (r() - 0.5) * 7;
      const fy = lerp(ay, by, t) + (r() - 0.5) * 7;
      const c = [P.lapis, P.vermilion, '#d9a93a', P.lapis, '#e8b84a'][Math.floor(r() * 5)];
      f.wash(ellipseAt(fx, fy, 1.4 + r() * 2.4, 1 + r() * 1.6, r() * 3), c, 0.85);
    }
  }
  const crack = new Path2D();
  crack.moveTo(x - 6 * u, y - 70 * u);
  crack.lineTo(x - 2 * u, y - 58 * u);
  crack.lineTo(x - 5 * u, y - 46 * u);
  f.line(crack, INK, 1, 0.4);
}

