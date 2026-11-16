// Shot 6, the night. The wall turns to lapis. The king stands over the city with his arms open. From the beat
// `rise` a light leaves every house and streams up to him; a golden dome closes over the city by `dome`. Every
// door is left open.
import { type Cam, type Ctx, H, W, bloom, camLerp, canvas, dabs, ease, glow, hash, look, reset, rng, smooth, span, frac } from '../kit/core.ts';
import { house } from '../kit/city.ts';
import { person } from '../kit/figure.ts';
import { Fresco, INK, P, bands, composePanel, ellipseAt, flower } from '../kit/fresco.ts';
import { gold } from '../kit/live.ts';
import { FULL, type MakePainter, drawPanel, pause, sheen, stillOf } from '../kit/shot.ts';

const BASE = 872;
const DOME = { x: 960, y: BASE, r: 660 };
const KING = { x: 960, y: 640, h: 330 };
const HALO = { x: 960, y: 640 - 0.89 * 330 };

export const night: MakePainter = (env) => {
  const scale = 1.25;
  let panel: HTMLCanvasElement;
  let goldMask: HTMLCanvasElement;
  let domeFill: HTMLCanvasElement;
  const doors: [number, number][] = [];
  const stars: [number, number, number][] = [];

  async function build() {
    const f = new Fresco(W, H, scale);
    const r = rng(66);
    // The lapis field, laid on thick with a brush.
    const field = new Path2D();
    field.rect(0, 34, W, H - 68);
    f.fill(field, '#1f45a6', 0);
    dabs(f.p, r, 2200, () => [r() * W, 34 + r() * (H - 68)], ['#2a52b8', '#173a94', '#2448a8', '#3260c4'], [8, 22], [0.15, 0.4], 2.4);
    bands(f, r);
    for (let i = 0; i < 90; i++) {
      const a = Math.PI + r() * Math.PI;
      const d = Math.sqrt(r());
      const x = DOME.x + Math.cos(a) * DOME.r * 1.25 * d + (r() - 0.5) * 300;
      const y = DOME.y + Math.sin(a) * DOME.r * d * 1.1;
      if (y > BASE - 40 || y < 50) continue;
      stars.push([x, y, r()]);
    }
    // The city along the foot of the wall, every door open on warm light.
    const xs: number[] = [];
    for (let x = 340; x < 1600; x += 92 + r() * 26) if (Math.abs(x - 960) > 170) xs.push(x);
    for (const x of xs) {
      const w = 80 + r() * 26;
      const h = 90 + r() * 80;
      house(f, x, BASE, w, h, r, r() < 0.35);
      openDoor(f, x, BASE, Math.min(34, w * 0.4));
      doors.push([x, BASE - 26]);
      if (r() < 0.6) flower(f, x + w / 2 + 4, BASE, 34, [P.white, P.red][Math.floor(r() * 2)], r);
    }
    await pause();
    // The great gate with the dais on top, its own door open too.
    const gate = new Path2D();
    gate.rect(820, BASE - 236, 280, 236);
    const gg = f.p.createLinearGradient(820, 0, 1100, 0);
    gg.addColorStop(0, '#f6eedc');
    gg.addColorStop(1, '#e2d4b8');
    f.fill(gate, gg, 1.8);
    const dais = new Path2D();
    dais.rect(800, BASE - 250, 320, 18);
    f.gild(dais, 1.4);
    for (let k = 0; k < 8; k++) {
      const ax = 840 + k * 34;
      const a = new Path2D();
      a.arc(ax + 12, BASE - 210, 11, Math.PI, 0);
      f.line(a, '#c9a258', 2.4);
    }
    openDoor(f, 960, BASE, 90);
    doors.push([960, BASE - 60]);
    const vine = new Path2D();
    for (const s of [-1, 1]) {
      vine.moveTo(960 + s * 90, BASE - 20);
      vine.bezierCurveTo(960 + s * 110, BASE - 80, 960 + s * 70, BASE - 130, 960 + s * 104, BASE - 180);
    }
    f.gildLine(vine, 2.4, false);
    const ground = new Path2D();
    ground.rect(300, BASE, 1320, 6);
    f.gild(ground, 0.8);
    // The king on the dais, arms open, his hoe raised.
    person(f, KING.x, KING.y, KING.h, { robe: P.green, dress: 'tunic', hair: P.hairDark, style: 'messy', headband: true, halo: true, arms: 'open', look: 0.1, gaze: 0.2, seed: 12 });
    hoeRaised(f);
    f.temper();
    panel = composePanel(f, 6, { cracks: 3 });
    goldMask = f.gold;
    // The dome's glass of light, made once and faded in.
    const d = canvas(W / 2, H / 2);
    const g = d.ctx.createRadialGradient(DOME.x / 2, DOME.y / 2, DOME.r * 0.1, DOME.x / 2, DOME.y / 2, DOME.r / 2);
    g.addColorStop(0, 'rgba(255,230,150,0.0)');
    g.addColorStop(0.75, 'rgba(255,220,130,0.18)');
    g.addColorStop(1, 'rgba(255,236,170,0.55)');
    d.ctx.fillStyle = g;
    d.ctx.beginPath();
    d.ctx.arc(DOME.x / 2, DOME.y / 2, DOME.r / 2, Math.PI, 0);
    d.ctx.closePath();
    d.ctx.fill();
    domeFill = d.canvas;
  }

  function scene(ctx: Ctx, tl: number, cam: Cam, rise: number, dome: number) {
    drawPanel(ctx, panel, cam);
    look(ctx, cam);
    ctx.globalCompositeOperation = 'lighter';
    const star = glow('#dfe8ff', 0.4);
    for (let i = 0; i < stars.length; i++) {
      const [x, y, s] = stars[i];
      bloom(ctx, star, x, y, 5 + s * 6, 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(tl * (1 + s * 2) + i)));
    }
    // Every door glows; the king's light grows as the lights reach him.
    const warm = glow('#ffcf6a', 0.3);
    for (const [x, y] of doors) bloom(ctx, warm, x, y, 60, 0.45);
    const fed = span(tl, rise, dome + 0.5);
    bloom(ctx, glow('#ffe39a', 0.3), HALO.x, HALO.y - 20, 150 + 110 * fed, 0.22 + 0.3 * fed);
    // The lights: from each door, one after another, up to the king.
    const spark = glow('#fff0b8', 0.45);
    const T = 2.6;
    for (let d = 0; d < doors.length; d++) {
      const [x0, y0] = doors[d];
      for (let j = 0; j < 5; j++) {
        const born = rise + (j * T) / 5 + hash(d * 7 + j) * 0.5;
        if (tl < born) continue;
        const ph = frac((tl - born) / T);
        for (let tr = 0; tr < 3; tr++) {
          const q = ph - tr * 0.025;
          if (q < 0) continue;
          const u = 1 - q;
          const cx1 = x0;
          const cy1 = y0 - 260;
          const cx2 = HALO.x + (x0 - HALO.x) * 0.25;
          const cy2 = HALO.y + 160;
          const x = u * u * u * x0 + 3 * u * u * q * cx1 + 3 * u * q * q * cx2 + q * q * q * HALO.x;
          const y = u * u * u * y0 + 3 * u * u * q * cy1 + 3 * u * q * q * cy2 + q * q * q * HALO.y;
          const fadeIn = smooth(q / 0.08);
          bloom(ctx, spark, x, y, (10 - tr * 3) * (1 - q * 0.4), (0.95 - tr * 0.3) * fadeIn * (1 - smooth((q - 0.9) / 0.1)));
        }
      }
    }
    // The dome closing from both ends to meet over his head.
    const g = span(tl, rise + (dome - rise) * 0.25, dome);
    if (g > 0) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.9 * span(tl, dome - 0.3, dome + 0.6);
      ctx.drawImage(domeFill, 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(DOME.x, DOME.y, DOME.r, Math.PI, Math.PI + (g * Math.PI) / 2);
      ctx.moveTo(DOME.x + DOME.r, DOME.y);
      ctx.arc(DOME.x, DOME.y, DOME.r, 0, (-g * Math.PI) / 2, true);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,214,120,0.35)';
      ctx.lineWidth = 26;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = gold(ctx);
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      // The two ends glow as they travel, swelling in at the start and fading as they meet.
      const ends = smooth(g / 0.06) * (1 - smooth((g - 0.9) / 0.1));
      if (ends > 0) {
        const a1 = Math.PI + (g * Math.PI) / 2;
        const head = glow('#fff2c0', 0.4);
        bloom(ctx, head, DOME.x + Math.cos(a1) * DOME.r, DOME.y + Math.sin(a1) * DOME.r, 60, ends);
        const a2 = (-g * Math.PI) / 2;
        bloom(ctx, head, DOME.x + Math.cos(a2) * DOME.r, DOME.y + Math.sin(a2) * DOME.r, 60, ends);
      }
      // As they meet, a light blooms at the crown of the dome and dies away.
      const flash = smooth((tl - dome + 0.25) / 0.25) * Math.exp(-Math.max(0, tl - dome) * 3);
      bloom(ctx, glow('#fff6d8', 0.35), DOME.x, DOME.y - DOME.r, 200, flash);
    }
    reset(ctx);
  }

  return {
    build,
    draw(ctx, tl, shot) {
      const rise = shot.beats.rise;
      const dome = shot.beats.dome;
      const p = tl / shot.len;
      const cam = camLerp({ x: 960, y: 640, zoom: 1.3 }, { x: 960, y: 560, zoom: 1.0 }, ease(p / 0.75));
      scene(ctx, tl, cam, rise, dome);
      sheen(env, ctx, cam, [{ mask: goldMask, x: 0, y: 0, w: W, h: H }], span(tl, dome - 0.4, shot.len + 0.5), 0.4 * span(tl, dome - 0.4, dome), 0.03);
    },
    still: () => stillOf((ctx) => scene(ctx, 99, FULL, 1, 6)),
  };
};

/** An open door: warm light inside and two gold leaves swung back. */
function openDoor(f: Fresco, x: number, y: number, w: number): void {
  const arch = new Path2D();
  arch.moveTo(x - w / 2, y);
  arch.lineTo(x - w / 2, y - w * 0.9);
  arch.arc(x, y - w * 0.9, w / 2, Math.PI, 0);
  arch.lineTo(x + w / 2, y);
  arch.closePath();
  const g = f.p.createLinearGradient(0, y - w * 1.4, 0, y);
  g.addColorStop(0, '#f8d47a');
  g.addColorStop(1, '#e09a3a');
  f.fill(arch, g, 1.4);
  for (const s of [-1, 1]) {
    const leaf = new Path2D();
    leaf.moveTo(x + s * w / 2, y);
    leaf.lineTo(x + s * w / 2, y - w * 1.05);
    leaf.lineTo(x + s * (w / 2 + w * 0.22), y - w * 1.0);
    leaf.lineTo(x + s * (w / 2 + w * 0.22), y + 2);
    leaf.closePath();
    f.gild(leaf, 1.2);
  }
  f.wash(ellipseAt(x, y - 2, w * 0.7, 6, 0), 'rgba(255,220,140,0.6)');
}

function hoeRaised(f: Fresco): void {
  const u = KING.h / 100;
  const hx = KING.x + 27 * u;
  const hy = KING.y - 92 * u;
  const staff = new Path2D();
  staff.moveTo(hx - 5 * u, hy + 30 * u);
  staff.lineTo(hx + 4 * u, hy - 24 * u);
  f.line(staff, INK, 3.4 * u, 0.85);
  f.line(staff, P.wood, 2.2 * u);
  const blade = new Path2D();
  blade.moveTo(hx + 4 * u, hy - 24 * u);
  blade.lineTo(hx + 13 * u, hy - 21 * u);
  blade.lineTo(hx + 4 * u, hy - 18 * u);
  blade.closePath();
  f.fill(blade, '#8a9098', 1.2);
}
