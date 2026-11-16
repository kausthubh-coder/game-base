// Shot 8, the Mark. A hand rises into the light, its back to us. Points of gold light on it one after another
// on the beats `light1` to `light6`, each with a flare, and each wakes a little light in one of the six beasts
// along the foot of the wall. The seventh place, at the end of the arc, stays dark.
import { type Cam, type Ctx, H, W, bloom, camLerp, curve, ease, glow, look, reset, rng, span } from '../kit/core.ts';
import { Fresco, bands, composePanel, ellipseAt, ground, rays } from '../kit/fresco.ts';
import { FULL, type MakePainter, drawPanel, pause, sheen, stillOf } from '../kit/shot.ts';
import { type BeastSprite, beastSprites, drawBeast } from './gods.ts';

const HAND = { x: 960, y: 500 };
const SP = { w: 640, h: 1040, ox: 320, oy: 500 };
const FOOT = 952;
const FRIEZE = [340, 588, 836, 1084, 1332, 1580];
/** The seven places on the back of the hand, in hand space, left to right along an arc. */
const PLACES: [number, number][] = Array.from({ length: 7 }, (_, i) => {
  const a = Math.PI * (1.1 + (i / 6) * 0.8);
  return [Math.cos(a) * 92, 82 + Math.sin(a) * 78];
});

export const mark: MakePainter = (env) => {
  const scale = 1.3;
  let panel: HTMLCanvasElement;
  let gold: HTMLCanvasElement;
  let hand: HTMLCanvasElement;
  let sprites: BeastSprite[];

  async function build() {
    const f = new Fresco(W, H, scale);
    const r = rng(88);
    bands(f, r);
    rays(f, HAND.x, HAND.y, 40, 240, 520, 0, Math.PI * 2, 2.4);
    ground(f, 240, 1680, FOOT, r);
    f.temper();
    panel = composePanel(f, 8, { cracks: 12 });
    gold = f.gold;
    await pause();
    const h = new Fresco(SP.w, SP.h, scale);
    h.translate(SP.ox, SP.oy);
    paintHand(h);
    h.temper();
    hand = h.paint;
    sprites = await beastSprites();
  }

  /** How far below its place the hand is: it rises before the first light. */
  function rise(tl: number, first: number): number {
    const k = ease(tl / (first * 0.9));
    return 560 * (1 - k) + Math.sin(tl * 0.9) * 4 * k;
  }

  function scene(ctx: Ctx, tl: number, cam: Cam, beats: readonly number[]) {
    drawPanel(ctx, panel, cam);
    look(ctx, cam);
    const lit = beats.reduce((n, b) => n + span(tl, b - 0.05, b + 0.1), 0);
    ctx.globalCompositeOperation = 'lighter';
    bloom(ctx, glow('#ffd66a', 0.22), HAND.x, HAND.y - 40, 420, 0.25 + lit * 0.06);
    ctx.globalCompositeOperation = 'source-over';
    const dy = rise(tl, beats[0]);
    ctx.drawImage(hand, HAND.x - SP.ox, HAND.y - SP.oy + dy, SP.w, SP.h);
    // The beasts along the foot, each warmed by its own light.
    FRIEZE.forEach((x, i) => {
      const on = span(tl, beats[i] - 0.05, beats[i] + 0.3);
      if (on > 0) {
        ctx.globalCompositeOperation = 'lighter';
        bloom(ctx, glow('#ffe39a', 0.25), x, FOOT - 50, 120, on * 0.45);
        ctx.globalCompositeOperation = 'source-over';
      }
      drawBeast(ctx, sprites[i].paint, x, FOOT, 0.42, i % 2 === 1, Math.sin(tl * 1.2 + i));
    });
    // The places: six light, the seventh never does.
    const flare = glow('#fff4c8', 0.4);
    for (let i = 0; i < 6; i++) {
      const b = beats[i];
      const on = span(tl, b - 0.04, b + 0.04);
      if (on <= 0) continue;
      const x = HAND.x + PLACES[i][0];
      const y = HAND.y + PLACES[i][1] + dy;
      const since = tl - b;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#f8d870';
      ctx.beginPath();
      ctx.arc(x, y, 8 * on, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const burst = Math.exp(-Math.max(0, since) * 4);
      bloom(ctx, flare, x, y, 13 + 46 * burst, 0.5 + 0.4 * burst);
      // A four-pointed glint as it catches.
      if (burst > 0.02) {
        ctx.globalAlpha = burst;
        ctx.fillStyle = '#fff8e0';
        ctx.beginPath();
        const s = 54 * burst + 8;
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + 3, y - 3);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x + 3, y + 3);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - 3, y + 3);
        ctx.lineTo(x - s, y);
        ctx.lineTo(x - 3, y - 3);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    reset(ctx);
  }

  return {
    build,
    draw(ctx, tl, shot) {
      const beats = [1, 2, 3, 4, 5, 6].map((i) => shot.beats[`light${i}`]);
      const cam = camLerp({ x: 960, y: 560, zoom: 1.02 }, { x: 960, y: 520, zoom: 1.18 }, ease(tl / (shot.len + 1)));
      scene(ctx, tl, cam, beats);
      sheen(env, ctx, cam, [{ mask: gold, x: 0, y: 0, w: W, h: H }], span(tl, 0, shot.len), 0.25, 0.03);
    },
    still: () => stillOf((ctx) => scene(ctx, 99, FULL, [0, 0, 0, 0, 0, 0])),
  };
};

/** The back of a raised right hand, fingers a little apart, the arm running down out of the picture. */
function paintHand(f: Fresco): void {
  const skin = '#efc39a';
  const g = f.p.createLinearGradient(-140, 0, 140, 0);
  g.addColorStop(0, '#f6d4ae');
  g.addColorStop(0.55, skin);
  g.addColorStop(1, '#d9a47a');
  // Thumb and fingers first; the back of the hand covers their roots.
  thumbOrFinger(f, [-80, 60], [-196, -96], 28, 22, g);
  const fingers: [number, number, number, number][] = [[-70, -50, -0.13, 236], [-23, -64, -0.04, 266], [24, -60, 0.05, 248], [68, -44, 0.14, 192]];
  for (const [x, y, a, len] of fingers) thumbOrFinger(f, [x, y], [x + Math.sin(a) * len, y - Math.cos(a) * len], 25, 21, g);
  const back = curve([
    [-104, -62], [-86, -84], [-60, -82], [-40, -94], [-14, -100], [10, -96], [36, -94], [56, -84], [82, -76], [104, -50],
    [108, 20], [90, 110], [80, 200], [84, 540], [-90, 540], [-84, 200], [-88, 110], [-110, 20],
  ]);
  f.fill(back, g, 2);
  // Light from the left, shade on the right.
  f.wash(curve([[60, -70], [104, -50], [108, 20], [90, 110], [80, 200], [84, 540], [50, 540], [56, 200], [70, 60], [76, -40]]), '#b8805a', 0.25);
  f.wash(curve([[-90, -40], [-70, -70], [-50, 0], [-60, 140], [-74, 520], [-84, 520], [-86, 110], [-104, 10]]), '#fff0dc', 0.35);
  // Knuckles and the tendons on the back of the hand, softly.
  const k = new Path2D();
  for (const [x, y] of [[-74, -70], [-25, -84], [24, -80], [70, -62]] as const) {
    k.moveTo(x - 12, y + 6);
    k.quadraticCurveTo(x, y - 2, x + 12, y + 6);
    k.moveTo(x * 0.7, y + 24);
    k.quadraticCurveTo(x * 0.5, y + 70, x * 0.3, y + 150);
  }
  f.line(k, '#c48a62', 2, 0.35);
  // The seven places of the Mark, faint as if pressed into the skin.
  for (const [x, y] of PLACES) {
    f.wash(ellipseAt(x, y, 12, 12, 0), '#d8a07a', 0.5);
    const ring = new Path2D();
    ring.arc(x, y, 12, 0, Math.PI * 2);
    f.line(ring, '#b07850', 1.6, 0.55);
  }
  const arc = new Path2D();
  PLACES.forEach(([x, y], i) => (i ? arc.lineTo(x, y) : arc.moveTo(x, y)));
  f.line(arc, '#c08860', 1.2, 0.3);
}

function thumbOrFinger(f: Fresco, a: [number, number], b: [number, number], w0: number, w1: number, fill: CanvasGradient): void {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  const p = new Path2D();
  p.moveTo(a[0] + nx * w0, a[1] + ny * w0);
  p.lineTo(b[0] + nx * w1, b[1] + ny * w1);
  p.arc(b[0], b[1], w1, ang + Math.PI / 2, ang - Math.PI / 2, true);
  p.lineTo(a[0] - nx * w0, a[1] - ny * w0);
  p.closePath();
  f.fill(p, fill, 2);
  // The nail, and the creases at the joints.
  const nail = ellipseAt(b[0] - Math.cos(ang) * w1 * 0.55, b[1] - Math.sin(ang) * w1 * 0.55, w1 * 0.6, w1 * 0.75, ang + Math.PI / 2);
  f.fill(nail, '#f6dcc8', 1);
  const c = new Path2D();
  for (const t of [0.42, 0.7]) {
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    c.moveTo(x + nx * w0 * 0.5, y + ny * w0 * 0.5);
    c.quadraticCurveTo(x + Math.cos(ang) * 3, y + Math.sin(ang) * 3, x - nx * w0 * 0.5, y - ny * w0 * 0.5);
  }
  f.line(c, '#c08a62', 1.6, 0.5);
}
