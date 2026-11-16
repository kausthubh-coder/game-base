// The temple wall: warm ivory plaster, tempera paint, gold leaf. A Fresco paints one panel (or one piece that
// moves, a beast that breathes) at load into three pictures at once: the paint, a mask of where the gold is (so
// light can run over the gold as the camera moves), and the red-brown underdrawing the war shot paints in first.
import { type Ctx, H, type Rand, W, blotches, canvas, grainTile, lerp, rng } from './core.ts';

export const INK = '#5b3a1e';
export const SINOPIA = '#a4492c';

/** The legend's colours: the six peoples, and the skin, hair and earth the figures share. */
export const P = {
  plaster: '#f2e3c6',
  green: '#3f8f3a',
  vermilion: '#d9502a',
  lapis: '#2c5fb8',
  violet: '#7a4aa6',
  white: '#f4efe2',
  slate: '#6d7790',
  skin: '#f0c9a0',
  tan: '#d8b98a',
  leaf: '#5f9a43',
  wood: '#9a6a3a',
  gold: '#d9a93a',
  goldDeep: '#a8761e',
  red: '#cf3a2a',
  hairDark: '#3a2618',
  hairBrown: '#6b4024',
  hairAuburn: '#b5502a',
  hairBlond: '#d8b060',
  hairBlue: '#2a3f8a',
  hairPurple: '#5a3a6e',
} as const;

/** The six peoples in their order on the wall, with the sign each wears. */
export const PEOPLES = [
  { robe: P.green, motif: 'leaf' },
  { robe: P.vermilion, motif: 'flame' },
  { robe: P.lapis, motif: 'wave' },
  { robe: P.violet, motif: 'grape' },
  { robe: P.white, motif: 'star' },
  { robe: P.slate, motif: 'anvil' },
] as const;
export type Motif = (typeof PEOPLES)[number]['motif'];

/** Shared textures, made once. */
export interface Plaster {
  /** Bare ivory plaster with mottling, 1920 by 1080. */
  wall: HTMLCanvasElement;
  goldTile: HTMLCanvasElement;
  pigment: HTMLCanvasElement;
}

let plaster: Plaster | null = null;
export function plasterKit(): Plaster {
  if (plaster) return plaster;
  const { canvas: wall, ctx } = canvas(W, H);
  ctx.fillStyle = P.plaster;
  ctx.fillRect(0, 0, W, H);
  // Big soft patches of warmer and paler plaster, then a fine tooth.
  const big = blotches(W, H, 160, 3);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.55;
  ctx.drawImage(big, 0, 0);
  const mid = blotches(W, H, 34, 4);
  ctx.globalAlpha = 0.28;
  ctx.drawImage(mid, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#c98a3a';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = ctx.createPattern(grainTile(256, 7, 0.6), 'repeat') as CanvasPattern;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // Gold leaf: warm gold with the squares of the leaf, flecks, and creases.
  const { canvas: goldTile, ctx: g } = canvas(256, 256);
  const gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, '#e9be4e');
  gr.addColorStop(0.35, '#f6d877');
  gr.addColorStop(0.6, '#d29a2c');
  gr.addColorStop(1, '#efc75a');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const r = rng(11);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      g.globalAlpha = 0.08 + r() * 0.12;
      g.fillStyle = r() < 0.5 ? '#fff0b0' : '#b07a1c';
      g.fillRect(i * 32 + (r() - 0.5) * 3, j * 32 + (r() - 0.5) * 3, 32, 32);
    }
  }
  g.globalAlpha = 0.35;
  g.strokeStyle = '#9c6a18';
  g.lineWidth = 0.7;
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    let x = r() * 256;
    let y = r() * 256;
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (r() - 0.5) * 30;
      y += (r() - 0.5) * 30;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = 0.3 + r() * 0.5;
    g.fillStyle = r() < 0.6 ? '#fff6c8' : '#8a5a12';
    g.fillRect(r() * 256, r() * 256, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  g.globalAlpha = 1;

  const pigment = grainTile(256, 23, 1.2);
  plaster = { wall, goldTile, pigment };
  return plaster;
}

/**
 * Paints into the panel's paint, its gold mask and its underdrawing with one set of calls. Transforms go to
 * all three. `scale` is how much finer than picture space the paint is kept, for a camera that comes close.
 */
export class Fresco {
  readonly paint: HTMLCanvasElement;
  readonly gold: HTMLCanvasElement;
  readonly sinopia: HTMLCanvasElement | null;
  readonly p: Ctx;
  readonly g: Ctx;
  readonly s: Ctx | null;
  private readonly goldPat: CanvasPattern;
  readonly w: number;
  readonly h: number;
  /** One pixel of picture space in the current transform, for line widths that stay the same on screen. */
  px = 1;
  private readonly pxStack: number[] = [];

  constructor(w: number, h: number, readonly scale = 1, underdrawing = false) {
    this.w = w;
    this.h = h;
    const a = canvas(w * scale, h * scale);
    this.paint = a.canvas;
    this.p = a.ctx;
    const b = canvas(w * scale * 0.5, h * scale * 0.5);
    this.gold = b.canvas;
    this.g = b.ctx;
    const s = underdrawing ? canvas(w * scale, h * scale) : null;
    this.sinopia = s?.canvas ?? null;
    this.s = s?.ctx ?? null;
    for (const c of this.all()) {
      c.lineCap = 'round';
      c.lineJoin = 'round';
    }
    this.p.scale(scale, scale);
    this.g.scale(scale * 0.5, scale * 0.5);
    this.s?.scale(scale, scale);
    this.goldPat = this.p.createPattern(plasterKit().goldTile, 'repeat') as CanvasPattern;
  }

  private *all(): Generator<Ctx> {
    yield this.p;
    yield this.g;
    if (this.s) yield this.s;
  }

  save(): void {
    for (const c of this.all()) c.save();
    this.pxStack.push(this.px);
  }
  restore(): void {
    for (const c of this.all()) c.restore();
    this.px = this.pxStack.pop() ?? 1;
  }
  translate(x: number, y: number): void {
    for (const c of this.all()) c.translate(x, y);
  }
  scaleBy(sx: number, sy = sx): void {
    for (const c of this.all()) c.scale(sx, sy);
    this.px /= Math.sqrt(Math.abs(sx * sy));
  }
  rotate(a: number): void {
    for (const c of this.all()) c.rotate(a);
  }
  alpha(a: number): void {
    this.p.globalAlpha = a;
  }

  /** Flat paint with an ink edge. */
  fill(path: Path2D, color: string | CanvasGradient | CanvasPattern, edge = 1.6): void {
    this.p.fillStyle = color;
    this.p.fill(path);
    if (edge > 0) this.ink(path, edge);
    else if (this.s) this.sketch(path, 1.2);
  }

  /** Paint with no ink line: shading, a glaze, a fold. */
  wash(path: Path2D, color: string | CanvasGradient, alpha = 1): void {
    this.p.globalAlpha = alpha;
    this.p.fillStyle = color;
    this.p.fill(path);
    this.p.globalAlpha = 1;
  }

  /** The dark line round a shape. */
  ink(path: Path2D, width = 1.6, color = INK, alpha = 0.85): void {
    this.p.globalAlpha = alpha;
    this.p.strokeStyle = color;
    this.p.lineWidth = width * this.px;
    this.p.stroke(path);
    this.p.globalAlpha = 1;
    this.sketch(path, width);
  }

  /** A painted line in a colour. */
  line(path: Path2D, color: string, width: number, alpha = 1): void {
    this.p.globalAlpha = alpha;
    this.p.strokeStyle = color;
    this.p.lineWidth = width;
    this.p.stroke(path);
    this.p.globalAlpha = 1;
    if (this.s && width > 2) this.sketch(path, 1.4);
  }

  /** Gold leaf, with a darker gold edge. */
  gild(path: Path2D, edge = 1.2): void {
    this.goldPat.setTransform(this.p.getTransform().inverse());
    this.p.fillStyle = this.goldPat;
    this.p.fill(path);
    if (edge > 0) {
      this.p.strokeStyle = P.goldDeep;
      this.p.lineWidth = edge * this.px;
      this.p.stroke(path);
    }
    this.g.fillStyle = '#fff';
    this.g.fill(path);
    this.sketch(path, 1.2);
  }

  /** A line of gold: a band, a pole, a ray. */
  gildLine(path: Path2D, width: number, edge = true): void {
    if (edge) {
      this.p.strokeStyle = P.goldDeep;
      this.p.lineWidth = width + 2 * this.px;
      this.p.stroke(path);
    }
    this.goldPat.setTransform(this.p.getTransform().inverse());
    this.p.strokeStyle = this.goldPat;
    this.p.lineWidth = width;
    this.p.stroke(path);
    this.g.strokeStyle = '#fff';
    this.g.lineWidth = width;
    this.g.stroke(path);
    if (width > 3) this.sketch(path, 1.2);
  }

  /** The underdrawing of a shape: the red-brown line a painter lays down first. */
  sketch(path: Path2D, width: number): void {
    if (!this.s) return;
    this.s.strokeStyle = SINOPIA;
    this.s.globalAlpha = 0.75;
    this.s.lineWidth = Math.max(1.3, width) * this.px;
    this.s.stroke(path);
    this.s.globalAlpha = 1;
  }

  /** Clips all three pictures to a path until restore. */
  clip(path: Path2D): void {
    for (const c of this.all()) c.clip(path);
  }

  /** Makes the paint look like pigment on plaster: a mottle of the pigment's own grain over everything painted. */
  temper(): void {
    const c = this.p;
    const { canvas: before, ctx: b } = canvas(this.paint.width, this.paint.height);
    b.drawImage(this.paint, 0, 0);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    // Overlay keeps the hue and moves the value up and down a little.
    c.globalCompositeOperation = 'overlay';
    c.globalAlpha = 0.22;
    c.fillStyle = c.createPattern(plasterKit().pigment, 'repeat') as CanvasPattern;
    c.fillRect(0, 0, this.paint.width, this.paint.height);
    // Overlay paints into the bare places too, so cut back to where paint already was.
    c.globalCompositeOperation = 'destination-in';
    c.globalAlpha = 1;
    c.drawImage(before, 0, 0);
    c.restore();
  }
}

/** Cracks in the plaster, drawn into a ctx in picture space. They go through the paint. */
export function cracks(ctx: Ctx, r: Rand, count: number, w = W, h = H): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < count; i++) {
    let x = r() * w;
    let y = 40 + r() * (h - 80);
    let a = r() * Math.PI * 2;
    const steps = 6 + Math.floor(r() * 18);
    const pts: [number, number][] = [[x, y]];
    for (let k = 0; k < steps; k++) {
      a += (r() - 0.5) * 1.3;
      const d = 8 + r() * 26;
      x += Math.cos(a) * d;
      y += Math.sin(a) * d;
      pts.push([x, y]);
      if (r() < 0.12) {
        // A short branch.
        const b = a + (r() < 0.5 ? 1 : -1) * (0.6 + r());
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(b) * (10 + r() * 20), y + Math.sin(b) * (10 + r() * 20));
        ctx.strokeStyle = 'rgba(120,70,30,0.35)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
    const width = 0.4 + r() * 0.6;
    // A light lip beside the dark crack, as plaster has.
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + 1, py + 1) : ctx.moveTo(px + 1, py + 1)));
    ctx.strokeStyle = 'rgba(255,248,230,0.55)';
    ctx.lineWidth = width + 0.6;
    ctx.stroke();
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.strokeStyle = `rgba(110,62,26,${lerp(0.22, 0.42, r())})`;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  ctx.restore();
}

/** The thin gold bands top and bottom of every panel, into a Fresco so they catch the light. */
export function bands(f: Fresco, r: Rand): void {
  for (const y of [21, H - 21]) {
    const p = new Path2D();
    p.moveTo(0, y - 7);
    for (let x = 0; x <= W; x += 40) p.lineTo(x, y - 7 + (r() - 0.5) * 1.5);
    for (let x = W; x >= 0; x -= 40) p.lineTo(x, y + 7 + (r() - 0.5) * 1.5);
    p.closePath();
    f.gild(p, 1.5);
    const rule = new Path2D();
    rule.moveTo(0, y - 12);
    rule.lineTo(W, y - 12);
    rule.moveTo(0, y + 12);
    rule.lineTo(W, y + 12);
    f.line(rule, 'rgba(150,100,40,0.5)', 1.2);
  }
}

/** A sunburst of thin gold rays from a point. */
export function rays(f: Fresco, x: number, y: number, n: number, r0: number, r1: number, from: number, to: number, width = 2.4): void {
  for (let i = 0; i < n; i++) {
    const a = lerp(from, to, n === 1 ? 0.5 : i / (n - 1));
    const long = i % 2 ? 0.82 : 1;
    const p = new Path2D();
    p.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    p.lineTo(x + Math.cos(a) * r1 * long, y + Math.sin(a) * r1 * long);
    f.gildLine(p, width, false);
  }
}

/** A flower of the fresco's border: stem, two leaves, a head in white, red or gold. */
export function flower(f: Fresco, x: number, y: number, s: number, color: string, r: Rand): void {
  const stem = new Path2D();
  const lean = (r() - 0.5) * 6;
  stem.moveTo(x, y);
  stem.quadraticCurveTo(x + lean * 0.3, y - s * 0.6, x + lean, y - s);
  f.line(stem, '#3f7a34', Math.max(1.2, s * 0.06));
  for (const side of [-1, 1]) {
    const leaf = new Path2D();
    const ly = y - s * (0.25 + r() * 0.2);
    leaf.moveTo(x, ly);
    leaf.quadraticCurveTo(x + side * s * 0.35, ly - s * 0.25, x + side * s * 0.4, ly - s * 0.05);
    leaf.quadraticCurveTo(x + side * s * 0.2, ly + s * 0.02, x, ly);
    f.fill(leaf, P.leaf, 0.8);
  }
  const hx = x + lean;
  const hy = y - s;
  const petals = color === P.white ? 6 : 5;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    f.fill(ellipseAt(hx + Math.cos(a) * s * 0.13, hy + Math.sin(a) * s * 0.13, s * 0.14, s * 0.08, a), color, 0.8);
  }
  f.gild(ellipseAt(hx, hy, s * 0.06, s * 0.06, 0), 0);
}

export function ellipseAt(x: number, y: number, rx: number, ry: number, rot: number): Path2D {
  const p = new Path2D();
  p.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2);
  return p;
}

/** The ground line the figures stand on: a thin green strip with grass ticks. */
export function ground(f: Fresco, x0: number, x1: number, y: number, r: Rand): void {
  const p = new Path2D();
  p.moveTo(x0, y);
  for (let x = x0; x <= x1; x += 6) p.lineTo(x, y + (r() - 0.5) * 1.2);
  f.line(p, '#5e8a3c', 3);
  const ticks = new Path2D();
  for (let x = x0; x < x1; x += 5 + r() * 7) {
    ticks.moveTo(x, y);
    ticks.lineTo(x + (r() - 0.5) * 5, y - 4 - r() * 7);
  }
  f.line(ticks, '#4f8a38', 1.3, 0.8);
}

/** Paint, plaster, cracks and bands into one finished panel picture at the fresco's scale. */
export function composePanel(f: Fresco, seed: number, opts: { ground?: string; cracks?: number } = {}): HTMLCanvasElement {
  const { canvas: out, ctx } = canvas(f.paint.width, f.paint.height);
  plasterUnder(ctx, f.scale, seed, opts);
  ctx.globalAlpha = 0.95;
  ctx.drawImage(f.paint, 0, 0);
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.scale(f.scale, f.scale);
  cracks(ctx, rng(seed + 5), opts.cracks ?? 14);
  ctx.restore();
  return out;
}

/** Bare plaster at a scale, optionally under a field of colour (the night's lapis). */
export function plasterUnder(ctx: Ctx, scale: number, seed: number, opts: { ground?: string } = {}): void {
  const kit = plasterKit();
  ctx.save();
  ctx.scale(scale, scale);
  // Shift the plaster so no two panels share the same blotches.
  const dx = (seed * 373) % 600;
  ctx.drawImage(kit.wall, -dx, 0, W + 600, H);
  ctx.drawImage(kit.wall, W + 600 - dx, 0, W + 600, H);
  if (opts.ground) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = opts.ground;
    ctx.fillRect(0, 34, W, H - 68);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}
