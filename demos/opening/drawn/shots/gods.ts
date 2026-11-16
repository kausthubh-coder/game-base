// Shot 7, the old gods. Six great beasts lie asleep in a ring round the golden dome, each wound in gold bands.
// They breathe, each at its own pace. On the beat `bands` a light runs round the ring and every band catches it.
import { type Cam, type Ctx, H, W, bloom, camLerp, ease, glow, look, reset, rng, span } from '../kit/core.ts';
import { BEASTS, beast } from '../kit/beasts.ts';
import { Fresco, P, bands as goldBands, composePanel, ellipseAt, flower, rays } from '../kit/fresco.ts';
import { FULL, type GoldPiece, type MakePainter, drawPanel, pause, sheen, stillOf } from '../kit/shot.ts';

const C = { x: 960, y: 560 };
/** Where each beast lies, its feet, and its size. */
export const RING: readonly { x: number; y: number; s: number; flip: boolean }[] = [
  { x: 730, y: 430, s: 1.0, flip: true },
  { x: 1190, y: 430, s: 1.0, flip: false },
  { x: 1380, y: 660, s: 0.95, flip: true },
  { x: 750, y: 880, s: 1.0, flip: false },
  { x: 1170, y: 880, s: 1.0, flip: false },
  { x: 540, y: 660, s: 0.95, flip: false },
];
const SPRITE = { w: 440, h: 300, ox: 220, oy: 270 };

/** Each beast painted once as its own picture, so it can breathe. Shared with the Mark. */
export interface BeastSprite { paint: HTMLCanvasElement; gold: HTMLCanvasElement }
let made: BeastSprite[] | null = null;
export async function beastSprites(): Promise<BeastSprite[]> {
  if (made) return made;
  const out: BeastSprite[] = [];
  for (let i = 0; i < 6; i++) {
    const f = new Fresco(SPRITE.w, SPRITE.h, 1.6);
    f.translate(SPRITE.ox, SPRITE.oy);
    beast(f, BEASTS[i], 300 + i);
    f.temper();
    out.push({ paint: f.paint, gold: f.gold });
    await pause();
  }
  made = out;
  return out;
}

export function drawBeast(ctx: Ctx, img: CanvasImageSource, x: number, y: number, s: number, flip: boolean, breath: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((flip ? -s : s) * (1 + breath * 0.008), s * (1 + breath * 0.022));
  ctx.drawImage(img, -SPRITE.ox, -SPRITE.oy, SPRITE.w, SPRITE.h);
  ctx.restore();
}

export const gods: MakePainter = (env) => {
  const scale = 1.3;
  let panel: HTMLCanvasElement;
  let gold: HTMLCanvasElement;
  let sprites: BeastSprite[];
  const golds: GoldPiece[] = [];

  async function build() {
    const f = new Fresco(W, H, scale);
    const r = rng(77);
    goldBands(f, r);
    // A garland ring the beasts lie in.
    const ring = new Path2D();
    ring.ellipse(C.x, C.y + 60, 560, 390, 0, 0, Math.PI * 2);
    f.line(ring, '#4f8a38', 3);
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2;
      const x = C.x + Math.cos(a) * 560;
      const y = C.y + 60 + Math.sin(a) * 390;
      f.fill(ellipseAt(x + Math.cos(a + 1.2) * 9, y + Math.sin(a + 1.2) * 9, 9, 4, a + 0.6), '#5f9a43', 0.8);
      if (i % 5 === 0) flower(f, x, y + 8, 22, P.white, r);
    }
    // The dome in the middle with its rays.
    rays(f, C.x, C.y + 30, 24, 160, 300, -Math.PI, 0, 2.2);
    rays(f, C.x, C.y + 30, 13, 160, 260, 0.15, Math.PI - 0.15, 2);
    const dome = new Path2D();
    dome.arc(C.x, C.y + 30, 140, Math.PI, 0);
    dome.closePath();
    f.gild(dome, 2);
    const scales = new Path2D();
    for (let row = 0; row < 5; row++) {
      for (let k = -6; k <= 6; k++) {
        const x = C.x + k * 22 + (row % 2) * 11;
        const y = C.y + 30 - row * 24 - 12;
        if (Math.hypot(x - C.x, y - C.y - 30) > 130) continue;
        scales.moveTo(x - 11, y);
        scales.quadraticCurveTo(x, y + 12, x + 11, y);
      }
    }
    f.line(scales, 'rgba(150,100,24,0.6)', 1.2);
    f.temper();
    panel = composePanel(f, 7, { cracks: 10 });
    gold = f.gold;
    await pause();
    sprites = await beastSprites();
    golds.push({ mask: gold, x: 0, y: 0, w: W, h: H });
  }

  function scene(ctx: Ctx, tl: number, cam: Cam, glint: number) {
    drawPanel(ctx, panel, cam);
    look(ctx, cam);
    ctx.globalCompositeOperation = 'lighter';
    bloom(ctx, glow('#ffd66a', 0.25), C.x, C.y + 10, 230 * (0.92 + 0.08 * Math.sin(tl * 1.2)), 0.25 + glint * 0.15);
    ctx.globalCompositeOperation = 'source-over';
    RING.forEach((b, i) => drawBeast(ctx, sprites[i].paint, b.x, b.y, b.s, b.flip, Math.sin(tl * (1.05 + i * 0.11) + i * 1.7)));
    reset(ctx);
  }

  /** The beasts' gold through the camera, breathing with them, then the sweep over everything. */
  function bandLight(ctx: Ctx, tl: number, cam: Cam, pos: number, k: number) {
    const s = env.scratch;
    reset(s);
    s.clearRect(0, 0, W, H);
    look(s, cam);
    RING.forEach((b, i) => drawBeast(s, sprites[i].gold, b.x, b.y, b.s, b.flip, Math.sin(tl * (1.05 + i * 0.11) + i * 1.7)));
    reset(s);
    s.globalCompositeOperation = 'source-in';
    s.globalAlpha = 0.06 + 0.3 * k;
    s.fillStyle = '#fff0b8';
    s.fillRect(0, 0, W, H);
    reset(s);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(s.canvas, 0, 0);
    reset(ctx);
    sheen(env, ctx, cam, golds, pos, 0.35 * k);
  }

  return {
    build,
    draw(ctx, tl, shot) {
      const b = shot.beats.bands;
      const cam = camLerp({ x: C.x, y: C.y + 40, zoom: 1.18 }, { x: C.x, y: C.y + 10, zoom: 1.04 }, ease(tl / shot.len));
      const k = span(tl, b - 0.35, b) * (1 - span(tl, b + 0.6, b + 1.8));
      scene(ctx, tl, cam, k);
      bandLight(ctx, tl, cam, span(tl, b - 0.5, b + 1.2), k);
    },
    still: () => stillOf((ctx) => scene(ctx, 0, FULL, 0)),
  };
};
