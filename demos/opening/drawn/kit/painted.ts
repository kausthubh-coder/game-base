// The game's painted look for the last three shots: soft edges, brush dabs, stone and wood with grain, warm
// light against blue night. Everything here runs at load into cached pictures.
import { type Ctx, type Rand, dabs, lerp, shade } from './core.ts';

/** Fills a path, then works dabs of the given colours into it, clipped, for a surface that looks brushed. */
export function brushed(ctx: Ctx, path: Path2D, base: string | CanvasGradient, colors: readonly string[], r: Rand, box: [number, number, number, number], count: number, size: [number, number] = [3, 9], alpha: [number, number] = [0.08, 0.25]): void {
  ctx.fillStyle = base;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  const [x, y, w, h] = box;
  dabs(ctx, r, count, () => [x + r() * w, y + r() * h], colors, size, alpha, 1.8);
  ctx.restore();
}

/** A wall of dressed stone blocks in rows, each block its own shade, with mortar and chipped edges. */
export function stoneWall(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, r: Rand, base: string, rowH = 64): void {
  for (let y = y0, row = 0; y < y1; y += rowH, row++) {
    let x = x0 - (row % 2) * rowH * 0.7;
    while (x < x1) {
      const w = rowH * (1.3 + r() * 1.1);
      const c = shade(base, (r() - 0.5) * 0.22);
      const p = block(x + 2, y + 2, w - 4, rowH - 4, Math.min(10, rowH * 0.18), r);
      brushed(ctx, p, c, [shade(c, 0.15), shade(c, -0.15), shade(c, 0.05)], r, [x, y, w, rowH], Math.floor(w * 0.5), [2, 7]);
      // A lit top edge and a shadowed foot, as if the light comes from above.
      ctx.save();
      ctx.clip(p);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#fff4dc';
      ctx.fillRect(x, y, w, 5);
      ctx.fillStyle = '#20140c';
      ctx.fillRect(x, y + rowH - 9, w, 9);
      ctx.restore();
      x += w;
    }
  }
}

/** A dressed stone: a rectangle with softened, slightly uneven corners. */
function block(x: number, y: number, w: number, h: number, rad: number, r: Rand): Path2D {
  const j = () => (r() - 0.5) * rad * 0.5;
  const p = new Path2D();
  p.moveTo(x + rad + j(), y + j());
  p.lineTo(x + w - rad + j(), y + j());
  p.quadraticCurveTo(x + w, y, x + w + j(), y + rad + j());
  p.lineTo(x + w + j(), y + h - rad + j());
  p.quadraticCurveTo(x + w, y + h, x + w - rad + j(), y + h + j());
  p.lineTo(x + rad + j(), y + h + j());
  p.quadraticCurveTo(x, y + h, x + j(), y + h - rad + j());
  p.lineTo(x + j(), y + rad + j());
  p.quadraticCurveTo(x, y, x + rad + j(), y + j());
  p.closePath();
  return p;
}

/** Planks of wood with grain lines, filling a path. */
export function wood(ctx: Ctx, path: Path2D, x: number, y: number, w: number, h: number, color: string, r: Rand, vertical = true): void {
  brushed(ctx, path, color, [shade(color, 0.12), shade(color, -0.15)], r, [x, y, w, h], Math.floor((w * h) / 120), [2, 6]);
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = shade(color, -0.35);
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.2;
  const n = Math.floor((vertical ? w : h) / 7);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    if (vertical) {
      const gx = x + (i + r()) * 7;
      ctx.moveTo(gx, y);
      ctx.bezierCurveTo(gx + (r() - 0.5) * 6, y + h * 0.3, gx + (r() - 0.5) * 6, y + h * 0.7, gx + (r() - 0.5) * 4, y + h);
    } else {
      const gy = y + (i + r()) * 7;
      ctx.moveTo(x, gy);
      ctx.bezierCurveTo(x + w * 0.3, gy + (r() - 0.5) * 6, x + w * 0.7, gy + (r() - 0.5) * 6, x + w, gy + (r() - 0.5) * 4);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Leafy foliage as heaps of dabs in several greens, lighter on top. */
export function foliage(ctx: Ctx, r: Rand, cx: number, cy: number, rx: number, ry: number, n: number, light: string, dark: string, alpha = 0.9): void {
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d;
    const k = (cy + ry - y) / (2 * ry);
    ctx.globalAlpha = alpha * (0.5 + r() * 0.5);
    ctx.fillStyle = mixHex(dark, light, k * 0.8 + r() * 0.3);
    ctx.beginPath();
    ctx.ellipse(x, y, 7 + r() * 8, 3.5 + r() * 4, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function mixHex(a: string, b: string, k: number): string {
  const x = Number.parseInt(a.slice(1), 16);
  const y = Number.parseInt(b.slice(1), 16);
  const kk = Math.max(0, Math.min(1, k));
  const ch = (s: number) => Math.round(lerp((x >> s) & 255, (y >> s) & 255, kk));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** A soft glow of colour painted into a picture at load: light falling on a wall or a floor. */
export function pool(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, alpha: number, op: GlobalCompositeOperation = 'lighter'): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Wisteria: hanging clusters of violet flowers with leaves, for the eaves. */
export function wisteria(ctx: Ctx, r: Rand, x: number, y: number, len: number): void {
  for (let i = 0; i < len / 4; i++) {
    const k = i / (len / 4);
    const px = x + Math.sin(k * 3 + x) * 3;
    const py = y + k * len;
    ctx.globalAlpha = 0.7 + r() * 0.3;
    ctx.fillStyle = k < 0.3 ? '#c8a8f0' : k < 0.7 ? '#a888e0' : '#8a6ac8';
    ctx.beginPath();
    ctx.ellipse(px + (r() - 0.5) * (1 - k) * 18, py, 3.2 * (1 - k * 0.5), 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
