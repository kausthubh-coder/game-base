// The small things every shot of the drawn way uses: canvases, seeded randomness for paint made at load,
// hashes for anything that moves (a frame never calls Math.random), easing, the camera and soft light sprites.

/** The film is drawn at this size. The page scales the canvas to fit. */
export const W = 1920;
export const H = 1080;

export type Ctx = CanvasRenderingContext2D;

export function canvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return { canvas: c, ctx: c.getContext('2d') as Ctx };
}

/** A seeded stream of numbers in [0, 1), for paint made once at load. */
export type Rand = () => number;
export function rng(seed: number): Rand {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fixed number in [0, 1) for each n: the place of particle n, the flicker at frame n. */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth noise in [0, 1) along one axis, for flicker and sway. */
export function noise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

/** The part after the point, always in [0, 1), for phases that may start before zero. */
export const frac = (x: number) => x - Math.floor(x);

export const clamp = (x: number, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smooth = (x: number) => {
  const k = clamp(x);
  return k * k * (3 - 2 * k);
};
/** Eases in and out more gently than smooth: a camera that starts and stops like a person. */
export const ease = (x: number) => {
  const k = clamp(x);
  return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
};
/**
 * A walk: speeds up over the first `a` of the way, holds an even pace, and slows over the last `b`. Its top
 * speed is only a little over the average, so a camera that walks with it never whips.
 */
export function walk(x: number, a = 0.15, b = 0.25): number {
  const k = clamp(x);
  const v = 1 / (1 - a / 2 - b / 2);
  if (k < a) return (v * k * k) / (2 * a);
  if (k > 1 - b) {
    const r = 1 - k;
    return 1 - (v * r * r) / (2 * b);
  }
  return v * (a / 2 + (k - a));
}

export const easeOut = (x: number) => 1 - (1 - clamp(x)) ** 3;
/** 0 before a, 1 after b, smooth between. */
export const span = (x: number, a: number, b: number) => smooth((x - a) / (b - a));

/** Where the camera looks, in the picture's own 1920 by 1080 space, and how close. */
export interface Cam { x: number; y: number; zoom: number }

/** Sets ctx so that drawing in picture space lands on screen through the camera. Keeps the view inside the picture. */
export function look(ctx: Ctx, cam: Cam): void {
  const z = cam.zoom;
  const hw = W / (2 * z);
  const hh = H / (2 * z);
  const x = z >= 1 ? clamp(cam.x, hw, W - hw) : cam.x;
  const y = z >= 1 ? clamp(cam.y, hh, H - hh) : cam.y;
  ctx.setTransform(z, 0, 0, z, W / 2 - x * z, H / 2 - y * z);
}

export function camLerp(a: Cam, b: Cam, k: number): Cam {
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), zoom: lerp(a.zoom, b.zoom, k) };
}

export function reset(ctx: Ctx): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** A soft round light, white at its heart. Drawn with 'lighter' it blooms. Made once a colour. */
const glows = new Map<string, HTMLCanvasElement>();
export function glow(color: string, core = 0.35): HTMLCanvasElement {
  const key = `${color}|${core}`;
  const have = glows.get(key);
  if (have) return have;
  const { canvas: c, ctx } = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(core * 0.4, color);
  g.addColorStop(core, withAlpha(color, 0.45));
  g.addColorStop(0.7, withAlpha(color, 0.1));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glows.set(key, c);
  return c;
}

/** Draws a glow sprite centred at x, y with radius r. */
export function bloom(ctx: Ctx, sprite: CanvasImageSource, x: number, y: number, r: number, alpha = 1): void {
  if (alpha <= 0.002 || r <= 0) return;
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/** '#rrggbb' to 'rgba(r,g,b,a)'. */
export function withAlpha(hex: string, a: number): string {
  if (hex.startsWith('rgb')) return hex;
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Mixes two '#rrggbb' colours. */
export function mix(a: string, b: string, k: number): string {
  const x = Number.parseInt(a.slice(1), 16);
  const y = Number.parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(lerp((x >> s) & 255, (y >> s) & 255, clamp(k)));
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

/** Darker or lighter by k in -1..1. */
export function shade(c: string, k: number): string {
  return k < 0 ? mix(c, '#1a0f08', -k) : mix(c, '#fffaf0', k);
}

/** A tile of fine grain, grey around mid, for film grain and pigment. */
export function grainTile(size: number, seed: number, soft = 0): HTMLCanvasElement {
  const { canvas: c, ctx } = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const r = rng(seed);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (r() + r() + r() - 1.5) * 90;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (soft > 0) {
    const { canvas: b, ctx: bx } = canvas(size, size);
    bx.filter = `blur(${soft}px)`;
    // Draw it tiled so the blur wraps and the tile stays seamless.
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) bx.drawImage(c, dx, dy);
    return b;
  }
  return c;
}

/** Value noise as a picture: blotches of size `cell` in grey, seamless, for plaster and stone. */
export function blotches(w: number, h: number, cell: number, seed: number): HTMLCanvasElement {
  const gw = Math.ceil(w / cell) + 2;
  const gh = Math.ceil(h / cell) + 2;
  const { canvas: s, ctx: sx } = canvas(gw, gh);
  const img = sx.createImageData(gw, gh);
  const r = rng(seed);
  for (let i = 0; i < gw * gh; i++) {
    const v = r() * 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  sx.putImageData(img, 0, 0);
  const { canvas: c, ctx } = canvas(w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = `blur(${cell * 0.35}px)`;
  ctx.drawImage(s, -cell, -cell, gw * cell, gh * cell);
  return c;
}

/** A path through points, smoothed through their midpoints. */
export function curve(pts: readonly (readonly [number, number])[], closed = true, path = new Path2D()): Path2D {
  const n = pts.length;
  if (n < 2) return path;
  if (!closed) {
    path.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const [x, y] = pts[i];
      const [nx, ny] = pts[i + 1];
      path.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    }
    path.lineTo(pts[n - 1][0], pts[n - 1][1]);
    return path;
  }
  const mid = (i: number) => {
    const a = pts[i % n];
    const b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  };
  const m0 = mid(n - 1);
  path.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    path.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  path.closePath();
  return path;
}

/** A wobbly round shape, like a dab or a bush. */
export function blob(cx: number, cy: number, rx: number, ry: number, r: Rand, wob = 0.15, n = 12, path = new Path2D()): Path2D {
  const pts: [number, number][] = [];
  const off = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * 2 * wob;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return curve(pts, true, path);
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0, path = new Path2D()): Path2D {
  path.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2);
  return path;
}

export function poly(pts: readonly (readonly [number, number])[], path = new Path2D()): Path2D {
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
  path.closePath();
  return path;
}

/** Stamps many soft dabs of colour in a region: leaves, stone, the grain of a painted surface. At load only. */
export function dabs(
  ctx: Ctx,
  r: Rand,
  count: number,
  where: () => [number, number],
  colors: readonly string[],
  size: [number, number],
  alpha: [number, number] = [0.25, 0.6],
  stretch = 1.6,
): void {
  for (let i = 0; i < count; i++) {
    const [x, y] = where();
    const s = lerp(size[0], size[1], r());
    ctx.globalAlpha = lerp(alpha[0], alpha[1], r());
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.beginPath();
    ctx.ellipse(x, y, s * stretch, s, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Applies the film's grain and edge darkening to the finished frame. Cheap: two fills. */
export interface Finish {
  grain: CanvasPattern;
  vignette: HTMLCanvasElement;
  warmVignette: HTMLCanvasElement;
}

export function makeFinish(ctx: Ctx): Finish {
  const tile = grainTile(256, 91);
  const grain = ctx.createPattern(tile, 'repeat') as CanvasPattern;
  const vig = (inner: string, outer: string, k: number) => {
    const { canvas: c, ctx: v } = canvas(W / 4, H / 4);
    const g = v.createRadialGradient(W / 8, H / 8, H / 8 * 0.55, W / 8, H / 8, W / 8 * 1.05);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    v.fillStyle = g;
    v.globalAlpha = k;
    v.fillRect(0, 0, W / 4, H / 4);
    return c;
  };
  return {
    grain,
    vignette: vig('rgba(10,12,30,0)', 'rgba(10,12,30,1)', 0.55),
    warmVignette: vig('rgba(80,50,20,0)', 'rgba(80,50,20,1)', 0.22),
  };
}

const grainM = new DOMMatrix();
/**
 * Film grain that changes twelve times a second, a pure function of t, and the edges darkened: warm for the
 * legend, cool for the night. `cool` from 0 to 1 blends them, so a dissolve between the parts never snaps.
 */
export function finish(ctx: Ctx, f: Finish, t: number, grain: number, cool: number): void {
  reset(ctx);
  if (cool < 1) {
    ctx.globalAlpha = 1 - cool;
    ctx.drawImage(f.warmVignette, 0, 0, W, H);
  }
  if (cool > 0) {
    ctx.globalAlpha = cool;
    ctx.drawImage(f.vignette, 0, 0, W, H);
  }
  ctx.globalAlpha = 1;
  if (grain > 0) {
    const frame = Math.floor(t * 12);
    grainM.e = Math.floor(hash(frame) * 256);
    grainM.f = Math.floor(hash(frame + 0.5) * 256);
    f.grain.setTransform(grainM);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = grain;
    ctx.fillStyle = f.grain;
    ctx.fillRect(0, 0, W, H);
  }
  reset(ctx);
}
