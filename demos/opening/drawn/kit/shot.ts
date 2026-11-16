// What a shot of the drawn way is, and what every shot shares while it draws: the camera over a cached panel,
// the light that runs over gold, and two scratch canvases for masks.
import type { Film, Shot, ShotId } from '../../types.ts';
import { type Cam, type Ctx, type Finish, H, W, canvas, look, reset } from './core.ts';

export interface Env {
  film: Film;
  finish: Finish;
  /** Full-frame canvases a shot may clear and use while it draws. Nothing is kept in them between frames. */
  scratch: Ctx;
  scratch2: Ctx;
  /** Another shot's painter, built if it is not yet: the wall needs the friends panel. */
  painter(id: ShotId): Promise<Painter>;
}

export interface Painter {
  /** Makes everything in the shot that does not move. */
  build(): Promise<void>;
  /**
   * Draws the shot `tl` seconds into it. tl runs a little before 0 and past shot.len while a dissolve or the
   * seam holds it on screen, so a shot keeps moving there.
   */
  draw(ctx: Ctx, tl: number, shot: Shot): void;
  /** The whole finished panel with no camera move, for the legend's eight shots. */
  still?(): HTMLCanvasElement;
  /** The finished panel at the finer scale it was painted at, for a camera that comes close to it on the wall. */
  hires?(): HTMLCanvasElement;
}

export type MakePainter = (env: Env) => Painter;

/** A soft vertical band of light, swept across gold. */
let band: HTMLCanvasElement | null = null;
function sheenBand(): HTMLCanvasElement {
  if (band) return band;
  const { canvas: c, ctx } = canvas(256, 4);
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,240,190,0)');
  g.addColorStop(0.35, 'rgba(255,236,170,0.35)');
  g.addColorStop(0.5, 'rgba(255,252,230,1)');
  g.addColorStop(0.65, 'rgba(255,236,170,0.35)');
  g.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 4);
  band = c;
  return c;
}

/** A gold mask and where it sits in picture space. */
export interface GoldPiece { mask: CanvasImageSource; x: number; y: number; w: number; h: number }

/**
 * Light running over the gold: a soft band at `pos` (0 left of the frame, 1 right of it) on screen, as if a lamp
 * passed. `glow` adds an even shine over all gold. Draws through the camera into ctx with 'lighter'.
 */
export function sheen(env: Env, ctx: Ctx, cam: Cam, golds: readonly GoldPiece[], pos: number, strength: number, glow = 0): void {
  if (strength <= 0.01 && glow <= 0.01) return;
  const s = env.scratch;
  reset(s);
  s.clearRect(0, 0, W, H);
  look(s, cam);
  for (const g of golds) s.drawImage(g.mask, g.x, g.y, g.w, g.h);
  reset(s);
  s.globalCompositeOperation = 'source-in';
  if (glow > 0) {
    // An even shine first; the band then adds to it.
    s.globalAlpha = Math.min(1, glow);
    s.fillStyle = '#ffecaa';
    s.fillRect(0, 0, W, H);
    s.globalCompositeOperation = 'source-atop';
  }
  if (strength > 0) {
    // A slanted band, a fifth of the frame wide.
    s.setTransform(1, 0, -0.35, 1, (pos * 1.6 - 0.3) * W + H * 0.175, 0);
    s.globalAlpha = Math.min(1, strength);
    s.drawImage(sheenBand(), -W * 0.2, 0, W * 0.4, H);
  }
  reset(s);
  reset(ctx);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.85;
  ctx.drawImage(s.canvas, 0, 0);
  reset(ctx);
}

/** Draws a cached panel through the camera. */
export function drawPanel(ctx: Ctx, img: CanvasImageSource, cam: Cam, alpha = 1): void {
  reset(ctx);
  look(ctx, cam);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, 0, 0, W, H);
  ctx.globalAlpha = 1;
}

/** Lets the page breathe between heavy builds, so load does not freeze it for seconds at a time. */
export const pause = () => new Promise<void>((done) => setTimeout(done, 0));

/** A still of a legend panel: the shot drawn at a finished moment with the camera square on. */
export function stillOf(draw: (ctx: Ctx) => void): HTMLCanvasElement {
  const { canvas: c, ctx } = canvas(W, H);
  reset(ctx);
  draw(ctx);
  return c;
}

export const FULL: Cam = { x: W / 2, y: H / 2, zoom: 1 };
