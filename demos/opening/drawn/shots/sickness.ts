// Shot 5, the sickness. Two rows of beds, a sleeper in each, a small bright stone at every throat. The stones
// fail one by one and are dim by the beat `dim`, and the colour drains out of the wall toward blue. The king
// kneels with his head bowed by three small graves, and petals fall on them.
import { type Cam, type Ctx, H, type Rand, W, bloom, camLerp, curve, ease, glow, hash, look, noise, reset, rng, shade, span, frac } from '../kit/core.ts';
import { halo, head, hoe } from '../kit/figure.ts';
import { Fresco, INK, P, PEOPLES, bands, composePanel, ellipseAt, flower, ground } from '../kit/fresco.ts';
import { FULL, type MakePainter, drawPanel, pause, sheen, stillOf } from '../kit/shot.ts';

const ROWS = [520, 850];
const COLS = [390, 610, 830, 1050];
const KING = { x: 1330, y: 898 };
const GRAVES = [1480, 1600, 1720];

export const sickness: MakePainter = (env) => {
  const scale = 1.3;
  let panel: HTMLCanvasElement;
  let gold: HTMLCanvasElement;
  const stones: [number, number][] = [];

  async function build() {
    const f = new Fresco(W, H, scale);
    const r = rng(55);
    bands(f, r);
    let n = 0;
    for (const y of ROWS) {
      ground(f, 300, 1150, y + 4, r);
      for (const x of COLS) {
        bed(f, x, y, PEOPLES[(n * 5 + 1) % 6].robe, n, r);
        stones.push([x, y - 152]);
        n++;
      }
      for (const x of [300, 500, 720, 940, 1160]) flower(f, x + (r() - 0.5) * 10, y + 2, 40, [P.white, P.red][Math.floor(r() * 2)], r);
      await pause();
    }
    ground(f, 1220, 1760, 902, r);
    // The king, kneeling, his head bowed, leaning on his hoe.
    mourner(f, KING.x, KING.y, 470);
    for (const [i, x] of GRAVES.entries()) {
      const mound = curve([[x - 52, 902], [x - 42, 878], [x - 16, 866], [x + 16, 866], [x + 42, 878], [x + 52, 902]]);
      f.fill(mound, '#8a5a32', 1.6);
      const clods = new Path2D();
      for (let k = 0; k < 30; k++) {
        const cx = x + (r() - 0.5) * 100;
        const cy = 868 + r() * 30;
        clods.moveTo(cx + 2, cy);
        clods.arc(cx, cy, 1.4 + r() * 1.8, 0, Math.PI * 2);
      }
      f.line(clods, '#5e3a1e', 1.2, 0.6);
      for (let k = -1; k <= 1; k++) flower(f, x + k * 26, 866 + Math.abs(k) * 4, 46 - Math.abs(k) * 8, [P.white, P.red, '#e8c440'][(i + k + 3) % 3], r);
    }
    f.temper();
    panel = composePanel(f, 5);
    gold = f.gold;
  }

  function scene(ctx: Ctx, tl: number, cam: Cam, dimAt: number, len: number) {
    drawPanel(ctx, panel, cam);
    look(ctx, cam);
    // The stones fail one after another, guttering as they go.
    ctx.globalCompositeOperation = 'lighter';
    const g = glow('#fff1b0', 0.45);
    stones.forEach(([x, y], i) => {
      const start = dimAt * (0.1 + hash(i + 2) * 0.55);
      const k = 1 - span(tl, start, start + dimAt * 0.35);
      const flick = k > 0 && k < 1 ? 0.6 + 0.4 * noise(tl * 14 + i * 7) : 1;
      bloom(ctx, g, x, y, 24, (0.05 + 0.95 * k) * flick);
    });
    // Petals falling on the graves.
    for (let i = 0; i < 9; i++) {
      const life = 4 + hash(i) * 2;
      const ph = frac((tl + hash(i + 1) * 9) / life);
      const x = GRAVES[i % 3] + (hash(i + 2) - 0.5) * 120 + Math.sin(tl * 1.6 + i) * 14;
      const y = 620 + ph * 260;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
      ctx.fillStyle = i % 2 ? '#fbf3e2' : '#e86a5a';
      ctx.beginPath();
      ctx.ellipse(x, y, 5, 2.6, tl * 2 + i, 0, Math.PI * 2);
      ctx.fill();
    }
    reset(ctx);
    drain(ctx, span(tl, dimAt * 0.15, dimAt + (len - dimAt) * 0.3));
  }

  return {
    build,
    draw(ctx, tl, shot) {
      const dimAt = shot.beats.dim;
      const cam = camLerp({ x: 720, y: 600, zoom: 1.32 }, { x: 1040, y: 610, zoom: 1.1 }, ease(tl / shot.len));
      scene(ctx, tl, cam, dimAt, shot.len);
      sheen(env, ctx, cam, [{ mask: gold, x: 0, y: 0, w: W, h: H }], 0.2 + 0.6 * (tl / shot.len), 0.25 * (1 - span(tl, 0, dimAt)), 0.02);
    },
    still: () => stillOf((ctx) => scene(ctx, 99, FULL, 2.5, 5)),
  };
};

/** Takes the colour out toward a cold blue, k from 0 to 1. */
function drain(ctx: Ctx, k: number): void {
  if (k <= 0.001) return;
  reset(ctx);
  ctx.globalCompositeOperation = 'saturation';
  ctx.globalAlpha = 0.6 * k;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.62 * k;
  ctx.fillStyle = '#7f9ce0';
  ctx.fillRect(0, 0, W, H);
  reset(ctx);
}

/** A bed seen from its foot: gold posts, a pillow, a sleeper under a blanket of their people's colour. */
function bed(f: Fresco, x: number, y: number, cover: string, n: number, r: Rand): void {
  const w = 180;
  // Headboard and posts.
  const posts = new Path2D();
  for (const s of [-1, 1]) {
    posts.moveTo(x + s * (w / 2 - 6), y - 6);
    posts.lineTo(x + s * (w / 2 - 6), y - 250);
  }
  f.gildLine(posts, 9);
  for (const s of [-1, 1]) for (const py of [-256, -96]) f.gild(ellipseAt(x + s * (w / 2 - 6), y + py, 9, 9, 0), 1);
  const board = new Path2D();
  board.moveTo(x - w / 2 + 6, y - 232);
  board.quadraticCurveTo(x, y - 262, x + w / 2 - 6, y - 232);
  board.moveTo(x - w / 2 + 6, y - 205);
  board.quadraticCurveTo(x, y - 225, x + w / 2 - 6, y - 205);
  f.gildLine(board, 5);
  const pillow = curve([[x - 60, y - 205], [x, y - 222], [x + 60, y - 205], [x + 64, y - 168], [x - 64, y - 168]]);
  f.fill(pillow, '#fbf5e8', 1.4);
  // The sleeper's head, eyes shut.
  f.save();
  f.translate(x, y - 186);
  f.scaleBy(3.2);
  head(f, { robe: cover, hair: [P.hairDark, P.hairBrown, P.hairAuburn, P.hairBlue, P.hairBlond, P.hairBrown, P.hairBlue, P.hairPurple][n], style: (['messy', 'bun', 'curly', 'wavy', 'curly', 'braid', 'messy', 'wavy'] as const)[n], look: (n % 3) - 1 === 0 ? 0.1 : ((n % 3) - 1) * 0.3, eyes: 'closed' }, 0, 0, rng(n));
  f.restore();
  // The blanket, up to the chin, with a gold vine along its turned edge.
  const blanket = curve([[x - 82, y - 160], [x - 30, y - 168], [x + 30, y - 168], [x + 82, y - 160], [x + 90, y - 110], [x + 84, y - 56], [x, y - 50], [x - 84, y - 56], [x - 90, y - 110]]);
  const g = f.p.createLinearGradient(x - 90, 0, x + 90, 0);
  g.addColorStop(0, shade(cover, 0.08));
  g.addColorStop(1, shade(cover, -0.15));
  f.fill(blanket, g, 1.6);
  const vine = new Path2D();
  vine.moveTo(x - 80, y - 140);
  vine.bezierCurveTo(x - 30, y - 150, x + 20, y - 130, x + 80, y - 142);
  f.gildLine(vine, 2.6, false);
  for (let k = 0; k < 6; k++) {
    const vx = x - 66 + k * 26;
    const vy = y - 144 + Math.sin(k) * 4;
    f.gild(ellipseAt(vx, vy - 5, 5, 2.4, -0.6), 0.5);
  }
  const folds = new Path2D();
  for (const k of [-0.5, 0, 0.45]) {
    folds.moveTo(x + k * 140, y - 128);
    folds.quadraticCurveTo(x + k * 150 + (r() - 0.5) * 10, y - 90, x + k * 160, y - 58);
  }
  f.line(folds, shade(cover, -0.4), 1.6, 0.5);
  // The footboard, a blue panel in a gold frame.
  const foot = curve([[x - w / 2 + 2, y - 104], [x, y - 116], [x + w / 2 - 2, y - 104], [x + w / 2 - 2, y - 8], [x - w / 2 + 2, y - 8]]);
  f.fill(foot, '#2a4ea8', 1.6);
  f.gildLine(foot, 4);
  const fleur = new Path2D();
  fleur.moveTo(x, y - 92);
  fleur.quadraticCurveTo(x + 8, y - 66, x, y - 40);
  fleur.quadraticCurveTo(x - 8, y - 66, x, y - 92);
  for (const s of [-1, 1]) {
    fleur.moveTo(x, y - 48);
    fleur.quadraticCurveTo(x + s * 26, y - 70, x + s * 46, y - 52);
    fleur.quadraticCurveTo(x + s * 26, y - 54, x, y - 40);
  }
  f.gild(fleur, 0.6);
  for (const s of [-1, 1]) f.gild(ellipseAt(x + s * (w / 2 - 6), y - 112, 9, 9, 0), 1);
  // The stone at the throat, pale; the shot lights it.
  f.fill(ellipseAt(x, y - 152, 5, 5, 0), '#f6efd8', 1);
}

/** The king in profile, kneeling on one knee, his head bowed, one hand on his knee and one on his planted hoe. */
function mourner(f: Fresco, x: number, y: number, h: number): void {
  f.save();
  f.translate(x, y);
  f.scaleBy(h / 100);
  const skin = P.skin;
  const tan = P.tan;
  hoe(f, 25, 0, 25, -96, true);
  halo(f, 7, -66, 13);
  // The far leg: knee on the ground, the shin back, the sole of the foot showing.
  f.fill(curve([[-9, -33], [0, -34], [3, -6], [-2, -1], [-22, -1], [-24, -5], [-6, -8]]), shade(tan, -0.1), 1.4);
  f.fill(ellipseAt(-23, -3, 2.6, 3.4, 0), '#7a4a26', 1);
  // The near leg: thigh forward, the shin straight down to the foot.
  f.fill(curve([[-8, -33], [4, -34], [15, -28], [18, -21], [17, -2], [12, -2], [11, -17], [-2, -21]]), tan, 1.4);
  f.fill(ellipseAt(16.5, -1.6, 5, 1.8, 0), '#7a4a26', 1);
  f.fill(ellipseAt(16, -2.6, 4, 1.6, 0), skin, 0.8);
  // The tunic, the back bent a little over his knees.
  const body = curve([[-2, -66], [7, -64], [11, -56], [10, -42], [12, -30], [2, -26], [-12, -27], [-12, -40], [-9, -56]]);
  const g = f.p.createLinearGradient(-12, 0, 12, 0);
  g.addColorStop(0, shade(P.green, -0.12));
  g.addColorStop(0.6, P.green);
  g.addColorStop(1, shade(P.green, 0.08));
  f.fill(body, g, 1.7);
  f.fill(poly4(-11.5, -41, 11, -41, 11, -38, -11.5, -38), '#a0602c', 1);
  const folds = new Path2D();
  folds.moveTo(-6, -52);
  folds.quadraticCurveTo(-8, -40, -9, -29);
  folds.moveTo(3, -50);
  folds.quadraticCurveTo(5, -40, 6, -28);
  f.line(folds, shade(P.green, -0.35), 1.1, 0.5);
  // The near arm down to the knee; the far arm out to the hoe.
  const far = new Path2D();
  far.moveTo(6, -60);
  far.quadraticCurveTo(14, -54, 24, -52);
  f.line(far, INK, 5.6, 0.85);
  f.line(far, skin, 4.2);
  f.fill(ellipseAt(25, -52, 2.8, 3.2, 0), skin, 1.1);
  const near = new Path2D();
  near.moveTo(-1, -60);
  near.quadraticCurveTo(4, -44, 13, -29);
  f.line(near, INK, 5.8, 0.85);
  f.line(near, skin, 4.4);
  const sleeve = new Path2D();
  sleeve.moveTo(-1, -61);
  sleeve.lineTo(2, -53);
  f.line(sleeve, INK, 7.6, 0.85);
  f.line(sleeve, P.green, 6.4);
  f.fill(ellipseAt(14, -28.5, 3, 2.6, 0.4), skin, 1.1);
  // The bowed head.
  f.save();
  f.translate(7, -66);
  f.rotate(0.42);
  head(f, { robe: P.green, hair: P.hairDark, style: 'messy', headband: true, look: 0.8, gaze: -1, eyes: 'closed', sad: true }, 0, 0);
  f.restore();
  f.restore();
}

function poly4(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): Path2D {
  const p = new Path2D();
  p.moveTo(ax, ay);
  p.lineTo(bx, by);
  p.lineTo(cx, cy);
  p.lineTo(dx, dy);
  p.closePath();
  return p;
}
