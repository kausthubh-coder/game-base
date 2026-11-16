// Shot 2, the farm boy. A boy with a hoe stands between the six peoples, who kneel with their banners. Six
// hands, one in each people's sleeve, bring a crown down out of the light and rest it over his head on the
// beat `crown`. The light behind him swells as it lands.
import { type Cam, type Ctx, H, W, bloom, camLerp, ease, easeOut, glow, hash, lerp, look, reset, rng, shade, span, frac } from '../kit/core.ts';
import { person } from '../kit/figure.ts';
import { Fresco, INK, P, PEOPLES, bands, composePanel, ellipseAt, flower, ground, rays } from '../kit/fresco.ts';
import { motif } from '../kit/figure.ts';
import { FULL, type MakePainter, drawPanel, pause, sheen, stillOf } from '../kit/shot.ts';

const GROUND = 862;
const BOY = { x: 960, h: 390 };
const CROWN = { x: 960, y: 452 };
const KNEEL_X = [330, 520, 710, 1210, 1400, 1590];

export const king: MakePainter = (env) => {
  const scale = 1.25;
  let panel: HTMLCanvasElement;
  let gold: HTMLCanvasElement;
  let hands: Fresco;
  let boy: Fresco;

  async function build() {
    const f = new Fresco(W, H, scale);
    const r = rng(23);
    bands(f, r);
    // A glory of rays and gold wheat behind the boy.
    rays(f, BOY.x, 520, 44, 70, 430, -Math.PI * 0.98, -Math.PI * 0.02, 2);
    for (let i = 0; i < 9; i++) {
      const x = BOY.x + (i - 4) * 26;
      const stalk = new Path2D();
      const top = GROUND - 250 - (4 - Math.abs(i - 4)) * 26 - r() * 20;
      stalk.moveTo(x, GROUND - 20);
      stalk.quadraticCurveTo(x + (i - 4) * 4, (GROUND + top) / 2, x + (i - 4) * 9, top);
      f.gildLine(stalk, 2, false);
      for (let k = 0; k < 6; k++) {
        const ky = top + 8 + k * 13;
        const kx = x + (i - 4) * 9 * (1 - k * 0.08);
        for (const s of [-1, 1]) f.gild(ellipseAt(kx + s * 5, ky, 3.4, 7, s * 0.5), 0.5);
      }
    }
    ground(f, 240, 1680, GROUND, r);
    for (let side = 0; side < 6; side++) {
      const left = side < 3;
      const p = PEOPLES[side];
      person(f, KNEEL_X[side], GROUND, 320, {
        robe: p.robe,
        motif: p.motif,
        hair: [P.hairBrown, P.hairAuburn, P.hairBlue, P.hairAuburn, P.hairBlond, P.hairDark][side],
        style: (['bun', 'curly', 'messy', 'braid', 'curly', 'short'] as const)[side],
        pose: 'kneel',
        dir: left ? 1 : -1,
        look: left ? 0.7 : -0.7,
        gaze: 0.7,
        hold: 'banner-rod',
        arms: 'forward',
        halo: true,
        seed: 70 + side,
      });
    }
    await pause();
    boy = new Fresco(W, H, scale);
    person(boy, BOY.x, GROUND, BOY.h, {
      robe: P.green,
      dress: 'tunic',
      hair: P.hairDark,
      style: 'messy',
      halo: true,
      look: 0.1,
      gaze: 0.15,
      hold: 'hoe-side',
      seed: 3,
    });
    boy.temper();
    for (let x = 260; x < 1680; x += 52 + r() * 46) {
      if (Math.abs(x - BOY.x) < 70) continue;
      flower(f, x, GROUND, 30 + r() * 12, [P.white, P.red, P.white][Math.floor(r() * 3)], r);
    }
    f.temper();
    panel = composePanel(f, 2);
    gold = f.gold;
    await pause();

    // The six hands and the crown, at rest, as one piece that comes down.
    hands = new Fresco(W, H, scale);
    const h = hands;
    const sr = rng(8);
    const from = [[650, 290], [630, 410], [700, 180], [1270, 290], [1290, 410], [1220, 180]] as const;
    const at = [[884, 452], [900, 476], [910, 430], [1036, 452], [1020, 476], [1010, 430]] as const;
    // Clouds of light the sleeves come out of.
    for (const [x, y] of from) {
      for (let k = 0; k < 7; k++) {
        const cx = x + (sr() - 0.5) * 90;
        const cy = y + (sr() - 0.5) * 50;
        h.wash(ellipseAt(cx, cy, 50 + sr() * 30, 30 + sr() * 16, 0), 'rgba(255,246,215,0.75)');
      }
    }
    for (let i = 0; i < 6; i++) {
      const [sx, sy] = from[i];
      const [hx, hy] = at[i];
      const p = PEOPLES[i];
      const a = Math.atan2(hy - sy, hx - sx);
      const nx = -Math.sin(a);
      const ny = Math.cos(a);
      const wx = hx - Math.cos(a) * 26;
      const wy = hy - Math.sin(a) * 26;
      // The elbow sags a little below the straight line, so the arm bends like an arm.
      const sag = (i < 3 ? 1 : -1) * 18;
      const ex = (sx + wx) / 2 + nx * sag;
      const ey = (sy + wy) / 2 + Math.abs(ny * 18);
      const seg = (ax: number, ay: number, bx: number, by: number, w0: number, w1: number) => {
        const an = Math.atan2(by - ay, bx - ax);
        const px = -Math.sin(an);
        const py = Math.cos(an);
        const q = new Path2D();
        q.moveTo(ax + px * w0, ay + py * w0);
        q.lineTo(bx + px * w1, by + py * w1);
        q.arc(bx, by, w1, an + Math.PI / 2, an - Math.PI / 2, true);
        q.lineTo(ax - px * w0, ay - py * w0);
        q.arc(ax, ay, w0, an - Math.PI / 2, an + Math.PI / 2, true);
        q.closePath();
        return q;
      };
      const g = h.p.createLinearGradient(ex + nx * 30, ey + ny * 30, ex - nx * 30, ey - ny * 30);
      g.addColorStop(0, shade(p.robe, -0.22));
      g.addColorStop(0.5, p.robe);
      g.addColorStop(1, shade(p.robe, 0.12));
      h.fill(seg(sx, sy, ex, ey, 24, 19), g, 1.8);
      h.fill(seg(ex, ey, wx, wy, 19, 14), g, 1.8);
      // The sleeve's bell hangs from the forearm.
      const bell = new Path2D();
      bell.moveTo(lerp(ex, wx, 0.25), lerp(ey, wy, 0.25) + 10);
      bell.quadraticCurveTo(lerp(ex, wx, 0.7), lerp(ey, wy, 0.7) + 40, wx, wy + 16);
      bell.lineTo(wx, wy);
      bell.closePath();
      h.fill(bell, shade(p.robe, -0.1), 1.6);
      const folds = new Path2D();
      folds.moveTo(lerp(sx, ex, 0.3), lerp(sy, ey, 0.3));
      folds.quadraticCurveTo(ex, ey - 4, lerp(ex, wx, 0.6), lerp(ey, wy, 0.6));
      h.line(folds, shade(p.robe, -0.4), 1.6, 0.5);
      const cuff = new Path2D();
      cuff.moveTo(wx + nx * 15, wy + ny * 15);
      cuff.lineTo(wx - nx * 15, wy - ny * 15);
      h.gildLine(cuff, 6);
      motif(h, p.motif, ex, ey, 11);
      const wrist = new Path2D();
      wrist.moveTo(wx, wy);
      wrist.lineTo(hx - Math.cos(a) * 6, hy - Math.sin(a) * 6);
      h.line(wrist, INK, 13, 0.8);
      h.line(wrist, P.skin, 11);
      reachHand(h, hx, hy, a, 1.7, P.skin);
    }
    // The crown: a gold band with points and three stones.
    const band = new Path2D();
    band.ellipse(CROWN.x, CROWN.y + 6, 62, 15, 0, 0, Math.PI);
    band.lineTo(CROWN.x - 62, CROWN.y - 8);
    band.ellipse(CROWN.x, CROWN.y - 8, 62, 15, 0, Math.PI, 0, true);
    band.closePath();
    const pts = new Path2D();
    for (let k = 0; k < 5; k++) {
      const x = CROWN.x - 52 + k * 26;
      const y = CROWN.y - 2 + Math.abs(k - 2) * -3;
      pts.moveTo(x - 9, y);
      pts.lineTo(x, y - 30 + Math.abs(k - 2) * 5);
      pts.lineTo(x + 9, y);
      pts.closePath();
    }
    h.gild(pts, 1.4);
    h.gild(band, 1.6);
    for (const [k, c] of [[-1, P.green], [0, P.red], [1, P.lapis]] as const) {
      h.fill(ellipseAt(CROWN.x + k * 30, CROWN.y + 2, 6, 5, 0), c, 1.2);
      h.wash(ellipseAt(CROWN.x + k * 30 - 1.5, CROWN.y, 2, 1.4, 0), '#fff', 0.8);
    }
    for (let k = 0; k < 5; k++) h.gild(ellipseAt(CROWN.x - 52 + k * 26, CROWN.y - 32 + Math.abs(k - 2) * 8, 3.5, 3.5, 0), 0.8);
    h.temper();
  }

  /** How far above its rest the crown is, in picture pixels. */
  function lift(tl: number, crown: number): number {
    const k = tl / crown;
    if (k >= 1) {
      // A small settle after it lands.
      const s = tl - crown;
      return -6 * Math.exp(-s * 5) * Math.sin(s * 14);
    }
    return 300 * (1 - easeOut(k ** 1.15));
  }

  function camAt(tl: number, len: number, crown: number): Cam {
    const a: Cam = { x: 960, y: 360, zoom: 1.32 };
    const b: Cam = { x: 960, y: 520, zoom: 1.12 };
    const c: Cam = { x: 960, y: 560, zoom: 1.04 };
    if (tl < crown) return camLerp(a, b, ease(tl / crown));
    return camLerp(b, c, ease((tl - crown) / Math.max(0.5, len - crown + 0.7)));
  }

  function scene(ctx: Ctx, tl: number, cam: Cam, crown: number) {
    drawPanel(ctx, panel, cam);
    const dy = lift(tl, crown);
    const landed = span(tl, crown - 0.25, crown + 0.2);
    look(ctx, cam);
    // The glory behind him swells as the crown lands, and breathes after.
    ctx.globalCompositeOperation = 'lighter';
    const breathe = 0.85 + 0.15 * Math.sin(tl * 1.7);
    bloom(ctx, glow('#ffd36a', 0.25), BOY.x, 560, 330 * breathe, 0.25 + 0.3 * landed);
    bloom(ctx, glow('#fff2c4', 0.4), CROWN.x, CROWN.y - 10 - dy, 120, 0.35 + 0.4 * landed * Math.exp(-Math.max(0, tl - crown) * 1.5));
    // Motes of gold drifting up through the light.
    const g = glow('#ffe6a0', 0.4);
    for (let i = 0; i < 24; i++) {
      const life = 3 + hash(i) * 2;
      const ph = frac((tl + hash(i + 1) * 9) / life);
      const x = BOY.x + (hash(i + 2) - 0.5) * 360 + Math.sin(tl * 0.8 + i) * 12;
      const y = GROUND - 60 - ph * 420;
      bloom(ctx, g, x, y, 5 + hash(i + 3) * 4, Math.sin(ph * Math.PI) * 0.7);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(boy.paint, 0, 0, W, H);
    ctx.drawImage(hands.paint, 0, -dy, W, H);
    reset(ctx);
    return dy;
  }

  return {
    build,
    draw(ctx, tl, shot) {
      const crown = shot.beats.crown;
      const cam = camAt(tl, shot.len, crown);
      const dy = scene(ctx, tl, cam, crown);
      sheen(env, ctx, cam, [
        { mask: gold, x: 0, y: 0, w: W, h: H },
        { mask: boy.gold, x: 0, y: 0, w: W, h: H },
        { mask: hands.gold, x: 0, y: -dy, w: W, h: H },
      ], span(tl, crown - 0.4, crown + 1.4), 0.7 * span(tl, crown - 0.5, crown) * (1 - span(tl, crown + 1.2, crown + 1.8)), 0.06);
    },
    still: () => stillOf((ctx) => scene(ctx, 99, FULL, 1)),
  };
};

/** A hand reaching along angle a, fingers curled round what it holds. */
function reachHand(f: Fresco, x: number, y: number, a: number, s: number, skin: string): void {
  f.save();
  f.translate(x, y);
  f.rotate(a);
  f.scaleBy(s);
  const palm = new Path2D();
  palm.ellipse(-4, 0, 8, 6.2, 0, 0, Math.PI * 2);
  f.fill(palm, skin, 1.4);
  const fingers = new Path2D();
  for (let i = 0; i < 4; i++) {
    const fy = -4.2 + i * 2.8;
    fingers.moveTo(2, fy);
    fingers.quadraticCurveTo(8.5, fy - 0.5, 8, fy + 2.4);
  }
  f.line(fingers, INK, 3.3, 0.8);
  f.line(fingers, skin, 2.2);
  const thumb = new Path2D();
  thumb.moveTo(-3, -5);
  thumb.quadraticCurveTo(3, -9, 6, -6.5);
  f.line(thumb, INK, 3.6, 0.8);
  f.line(thumb, skin, 2.5);
  f.restore();
}

