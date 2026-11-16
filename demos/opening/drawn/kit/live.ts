// Fresco pieces that move, drawn every frame straight onto the film's canvas: banners that stir, motifs on
// them. They draw with beginPath and cached patterns only, so a frame allocates nothing.
import { type Ctx, canvas } from './core.ts';
import { Fresco, INK, type Motif, plasterKit } from './fresco.ts';
import { motif } from './figure.ts';

let goldPat: CanvasPattern | null = null;
export function gold(ctx: Ctx): CanvasPattern {
  if (!goldPat) goldPat = ctx.createPattern(plasterKit().goldTile, 'repeat') as CanvasPattern;
  return goldPat;
}

/** A people's sign as a small gold picture, made once, for drawing on cloth that moves. */
const signs = new Map<Motif, HTMLCanvasElement>();
export function sign(m: Motif): HTMLCanvasElement {
  const have = signs.get(m);
  if (have) return have;
  const f = new Fresco(64, 64, 2);
  motif(f, m, 32, 32, 22);
  signs.set(m, f.paint);
  return f.paint;
}

const ys = new Float32Array(16);
/**
 * A banner flying from the top of a pole at px, py, out to the side `out` (-1 left, 1 right), `len` long and
 * `deep` deep, rippling in a wind of strength `wind` at time t.
 */
export function banner(ctx: Ctx, px: number, py: number, out: number, len: number, deep: number, color: string, dark: string, m: Motif, t: number, wind: number, seed: number, alpha = 1): void {
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    ys[i] = Math.sin(k * 5.2 - t * 3.1 + seed) * 11 * k * wind + Math.sin(k * 9 - t * 4.7 + seed * 2) * 3 * k * wind + k * k * 10;
  }
  const x = (i: number) => px + out * (i / n) * len * (1 - 0.05 * Math.abs(Math.sin(t * 1.3 + seed)));
  const depth = (i: number) => deep * (1 - (i / n) * 0.28);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(px, py + ys[0]);
    for (let i = 1; i <= n; i++) ctx.lineTo(x(i), py + ys[i]);
    // A swallowtail.
    const tx = x(n);
    const ty = py + ys[n];
    ctx.lineTo(tx - out * len * 0.12, ty + depth(n) * 0.5);
    ctx.lineTo(tx, ty + depth(n));
    for (let i = n; i >= 0; i--) ctx.lineTo(x(i), py + ys[i] + depth(i));
    ctx.closePath();
  };
  path();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill();
  // Each strip of cloth turned from the light is darker, each turned to it is paler.
  for (let i = 0; i < n; i++) {
    const slope = (ys[i + 1] - ys[i]) / (len / n);
    ctx.globalAlpha = Math.min(0.5, Math.abs(slope) * 1.6) * alpha;
    ctx.fillStyle = slope > 0 ? dark : '#fff8e6';
    ctx.beginPath();
    ctx.moveTo(x(i), py + ys[i]);
    ctx.lineTo(x(i + 1) + out * 0.6, py + ys[i + 1]);
    ctx.lineTo(x(i + 1) + out * 0.6, py + ys[i + 1] + depth(i + 1));
    ctx.lineTo(x(i), py + ys[i] + depth(i));
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
  path();
  ctx.globalAlpha = 0.85 * alpha;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  // Gold trim along the top and the foot.
  ctx.beginPath();
  ctx.moveTo(px, py + ys[0] + 4);
  for (let i = 1; i <= n; i++) ctx.lineTo(x(i), py + ys[i] + 4);
  ctx.moveTo(px, py + ys[0] + depth(0) - 4);
  for (let i = 1; i <= n; i++) ctx.lineTo(x(i), py + ys[i] + depth(i) - 4);
  ctx.strokeStyle = gold(ctx);
  ctx.lineWidth = 3;
  ctx.stroke();
  // The sign, riding the cloth.
  const mi = Math.round(n * 0.45);
  const s = sign(m);
  const tilt = Math.atan2(ys[mi + 1] - ys[mi - 1], x(mi + 1) - x(mi - 1));
  ctx.save();
  ctx.translate(x(mi), py + ys[mi] + depth(mi) / 2);
  ctx.rotate(tilt);
  ctx.drawImage(s, -deep * 0.36, -deep * 0.36, deep * 0.72, deep * 0.72);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** An empty canvas the size of a sprite, for pieces made at load. */
export const sprite = (w: number, h: number) => canvas(w, h);
