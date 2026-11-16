// Shot 11, sixteen years on. The same step from the same place, so the dissolve reads as the same picture: sun,
// the door standing open, the street hung with flags that stir, dust turning in the light, gulls over the
// harbour. From the beat `title` the upper left stays calm: the page sets the title there.
import { type Cam, type Ctx, H, W, bloom, camLerp, ease, glow, hash, look, reset, frac } from '../kit/core.ts';
import { lamp, paintStreet } from '../kit/street.ts';
import { type MakePainter, pause } from '../kit/shot.ts';
import { DOORSTEP_END } from './doorstep.ts';

const END: Cam = { x: 960, y: 548, zoom: 1.0 };
/** Strings of flags across the street: from, to, how far they sag, how many flags, their size. */
const STRINGS = [
  { a: [1090, 336], b: [250, 318], sag: 120, n: 17, s: 1 },
  { a: [700, 470], b: [380, 452], sag: 40, n: 9, s: 0.5 },
] as const;
const FLAG = ['#f4ead2', '#e8b848', '#f4ead2', '#d8603a'];

export const morning: MakePainter = () => {
  let base: HTMLCanvasElement;

  return {
    async build() {
      base = paintStreet('day');
      await pause();
    },
    draw(ctx, tl, shot) {
      const cam = camLerp(DOORSTEP_END, END, ease(tl / (shot.len + 1)));
      reset(ctx);
      look(ctx, cam);
      ctx.drawImage(base, 0, 0, W, H);
      gulls(ctx, tl);
      for (let k = 0; k < STRINGS.length; k++) flags(ctx, tl, k);
      lamp(ctx, tl, 0, 1);
      // Sparkles on the harbour and dust in the light at the door.
      ctx.globalCompositeOperation = 'lighter';
      const spark = glow('#ffffff', 0.5);
      for (let i = 0; i < 34; i++) {
        const x = 640 + hash(i) * 440;
        const y = 560 + hash(i + 3) * 150 * hash(i + 5);
        const on = Math.max(0, Math.sin(tl * (2 + hash(i + 9) * 3) + i * 1.7));
        bloom(ctx, spark, x, y, 5 + on * 5, on * on * 0.8);
      }
      const mote = glow('#fff2c8', 0.5);
      for (let i = 0; i < 46; i++) {
        const x = 1200 + hash(i + 20) * 520 + Math.sin(tl * 0.4 + i) * 20;
        const y = 300 + ((hash(i + 30) * 460 - tl * (6 + hash(i) * 10)) % 460 + 460) % 460;
        const tw = 0.5 + 0.5 * Math.sin(tl * (1.5 + hash(i + 40) * 2) + i);
        bloom(ctx, mote, x, y, 4 + hash(i + 50) * 4, 0.35 + 0.5 * tw);
      }
      bloom(ctx, glow('#fff4c8', 0.2), 1500, 420, 420, 0.22);
      reset(ctx);
    },
  };
};

/** One string of flags, sagging and swaying in the breeze, each flag swinging on its own. */
function flags(ctx: Ctx, tl: number, k: number): void {
  const st = STRINGS[k];
  const sag = st.sag + 8 * Math.sin(tl * 0.9 + k);
  const at = (t: number, out: number[]) => {
    out[0] = st.a[0] + (st.b[0] - st.a[0]) * t;
    out[1] = st.a[1] + (st.b[1] - st.a[1]) * t + sag * 4 * t * (1 - t);
  };
  ctx.strokeStyle = '#6a5040';
  ctx.lineWidth = 2 * st.s;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    at(i / 20, P);
    if (i) ctx.lineTo(P[0], P[1]);
    else ctx.moveTo(P[0], P[1]);
  }
  ctx.stroke();
  for (let i = 0; i < st.n; i++) {
    at((i + 0.5) / st.n, P);
    const swing = Math.sin(tl * 2.1 + i * 0.8 + k) * 0.16 + Math.sin(tl * 3.7 + i * 1.9) * 0.05 + 0.08;
    const w = 46 * st.s;
    const h = 62 * st.s;
    ctx.save();
    ctx.translate(P[0], P[1]);
    ctx.rotate(swing);
    ctx.fillStyle = FLAG[(i + k) % FLAG.length];
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(w / 2, h * 0.7);
    ctx.lineTo(0, h);
    ctx.lineTo(-w / 2, h * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,40,0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // A shade down the side turned from the sun, and the guild's wheel in gold.
    ctx.fillStyle = 'rgba(120,80,50,0.18)';
    ctx.fillRect(w * 0.15, 0, w * 0.35, h * 0.7);
    ctx.strokeStyle = '#c8902a';
    ctx.lineWidth = 2 * st.s;
    ctx.beginPath();
    ctx.arc(0, h * 0.42, w * 0.2, 0, Math.PI * 2);
    ctx.moveTo(-w * 0.2, h * 0.42);
    ctx.lineTo(w * 0.2, h * 0.42);
    ctx.moveTo(0, h * 0.42 - w * 0.2);
    ctx.lineTo(0, h * 0.42 + w * 0.2);
    ctx.stroke();
    ctx.restore();
  }
}
const P = [0, 0];

/** Three gulls gliding over the harbour, wings rising and falling. */
function gulls(ctx: Ctx, tl: number): void {
  ctx.strokeStyle = '#fbfaf6';
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const x = 760 + frac((tl * (14 + i * 5) + i * 90) / 300) * 300;
    const y = 120 + i * 50 + Math.sin(tl * 0.7 + i * 2) * 14;
    const flap = Math.sin(tl * (4 + i) + i) * 6;
    const s = 1 - i * 0.2;
    ctx.lineWidth = 3.4 * s;
    ctx.beginPath();
    ctx.moveTo(x - 18 * s, y - 6 * s - flap * s);
    ctx.quadraticCurveTo(x - 8 * s, y - 10 * s - flap * 0.5 * s, x, y);
    ctx.quadraticCurveTo(x + 8 * s, y - 10 * s - flap * 0.5 * s, x + 18 * s, y - 6 * s - flap * s);
    ctx.stroke();
  }
}
