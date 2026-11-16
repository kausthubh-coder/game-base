// Shot 10, the doorstep. Sixteen years ago, night rain. A basket on the guild's step under the door lamp, a
// brass key on the blanket that catches the lamp on the beat `key`. Someone in a long grey hooded coat walks
// away down the wet street and never looks back. Far thunder lights the sky on `thunder`.
import { type Cam, type Ctx, H, W, bloom, camLerp, ease, glow, hash, look, noise, reset, rng, frac } from '../kit/core.ts';
import { KEY, LAMP, VP, basket, lamp, lampLight, paintStreet } from '../kit/street.ts';
import { type MakePainter, pause } from '../kit/shot.ts';

/** The camera at the end of this shot; the morning starts from the same place. */
export const DOORSTEP_END: Cam = { x: 1010, y: 580, zoom: 1.08 };
const START: Cam = { x: 930, y: 556, zoom: 1.0 };

/** The walker's start on the street, in picture space, and how tall. */
const WALK = { x: 735, y: 772, h: 236, speed: 0.21, stride: 0.105 };

export const doorstep: MakePainter = () => {
  let base: HTMLCanvasElement;
  const ripples: [number, number, number][] = [];
  const bolt: [number, number][] = [];

  async function build() {
    base = paintStreet('night');
    basket(base.getContext('2d') as Ctx, 'night');
    await pause();
    const r = rng(14);
    for (let i = 0; i < 70; i++) {
      // On the street and the steps, more near than far.
      const k = r() ** 1.6;
      const y = 600 + k * 470;
      const x = y > 780 && r() < 0.5 ? 1000 + r() * 900 : (r() * (y - VP.y)) * 2.2;
      ripples.push([x, y, 0.4 + k * 1.2]);
    }
    let x = 850;
    let y = 40;
    while (y < 430) {
      bolt.push([x, y]);
      x += (r() - 0.45) * 40;
      y += 20 + r() * 30;
    }
  }

  return {
    build,
    draw(ctx, tl, shot) {
      const cam = camLerp(START, DOORSTEP_END, ease(tl / shot.len));
      const flick = 0.85 + 0.1 * noise(tl * 8) + 0.05 * noise(tl * 21 + 3);
      reset(ctx);
      look(ctx, cam);
      ctx.drawImage(base, 0, 0, W, H);
      walker(ctx, tl);
      lamp(ctx, tl, 1, flick);
      const [lx, ly] = lampLight(tl);
      ctx.globalCompositeOperation = 'lighter';
      bloom(ctx, glow('#ffb860', 0.2), lx, ly, 340 * flick, 0.35);
      bloom(ctx, glow('#ffe0a0', 0.4), lx, ly, 70 * flick, 0.8);
      bloom(ctx, glow('#ffb860', 0.2), LAMP.x + 160, 800, 300 * flick, 0.16);
      // The key catches the lamp.
      const k = shot.beats.key;
      const glint = Math.exp(-(((tl - k) / 0.4) ** 2)) + 0.15 * (0.5 + 0.5 * Math.sin(tl * 5));
      const star = glow('#fff2c0', 0.45);
      bloom(ctx, star, KEY.x - 20, KEY.y - 2, 22 + 50 * glint, 0.5 + 0.5 * glint);
      if (glint > 0.2) {
        ctx.globalAlpha = Math.min(1, glint);
        ctx.fillStyle = '#fffae6';
        ctx.beginPath();
        const s = 46 * glint;
        const kx = KEY.x - 20;
        const ky = KEY.y - 2;
        ctx.moveTo(kx, ky - s);
        ctx.lineTo(kx + 2.5, ky - 2.5);
        ctx.lineTo(kx + s, ky);
        ctx.lineTo(kx + 2.5, ky + 2.5);
        ctx.lineTo(kx, ky + s);
        ctx.lineTo(kx - 2.5, ky + 2.5);
        ctx.lineTo(kx - s, ky);
        ctx.lineTo(kx - 2.5, ky - 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Far thunder: the sky goes white twice and a thin bolt shows in the clouds.
      const dt = tl - shot.beats.thunder;
      const flash = dt < 0 ? 0 : Math.exp(-dt * 7) + (dt > 0.22 ? 0.7 * Math.exp(-(dt - 0.22) * 9) : 0);
      if (flash > 0.01) {
        bloom(ctx, glow('#9fb4ff', 0.15), 820, 220, 620, flash * 0.75);
        ctx.globalAlpha = Math.min(1, flash);
        if (dt < 0.12 || (dt > 0.22 && dt < 0.32)) {
          ctx.strokeStyle = '#f4f6ff';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(bolt[0][0], bolt[0][1]);
          for (let i = 1; i < bolt.length; i++) ctx.lineTo(bolt[i][0], bolt[i][1]);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
      // Ripples where the rain lands.
      ctx.strokeStyle = '#b8c8f0';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < ripples.length; i++) {
        const [x, y, s] = ripples[i];
        const P = 0.8 + hash(i) * 0.6;
        const ph = frac((tl + hash(i + 7) * 5) / P);
        const rad = (4 + 24 * ph) * s;
        ctx.globalAlpha = (1 - ph) * 0.5;
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      reset(ctx);
      // Rain, in two depths, over everything.
      rain(ctx, tl, 280, 900, 20, 1, 0.22, 11);
      rain(ctx, tl, 150, 1500, 46, 1.6, 0.32, 3);
      if (flash > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, flash * 0.12);
        ctx.fillStyle = '#c8d4ff';
        ctx.fillRect(0, 0, W, H);
        reset(ctx);
      }
    },
  };
};

function rain(ctx: Ctx, tl: number, n: number, speed: number, len: number, width: number, alpha: number, seed: number): void {
  ctx.strokeStyle = '#c8d8ff';
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.beginPath();
  const span = H + len;
  for (let i = 0; i < n; i++) {
    const y = frac((hash(i + seed) * span + tl * speed * (0.85 + hash(i + seed + 0.5) * 0.3)) / span) * span - len;
    const x = hash(i * 1.7 + seed) * (W + 300) - 150 - y * 0.12;
    ctx.moveTo(x, y);
    ctx.lineTo(x - len * 0.12, y + len);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * The one in the grey coat, from behind, walking away. They walk at an even pace in the world, so on screen
 * they slow and shrink toward the far end of the street, and each step is a step: one boot lifts as the other
 * takes the weight, the coat's hem swings, the body rises and falls.
 */
function walker(ctx: Ctx, tl: number): void {
  const d = Math.max(-0.3, WALK.speed * tl);
  const z = 1 + d;
  const fx = VP.x + (WALK.x - VP.x) / z;
  const fy = VP.y + (WALK.y - VP.y) / z;
  const u = WALK.h / z / 100;
  const ph = (d / WALK.stride) * Math.PI;
  for (const mirror of [true, false]) {
    ctx.save();
    ctx.translate(fx, fy);
    if (mirror) {
      // The reflection in the wet street, faint and shortened.
      ctx.scale(u, -u * 0.6);
      ctx.globalAlpha = 0.22;
    } else {
      ctx.scale(u, u);
    }
    figure(ctx, ph);
    ctx.restore();
  }
}

function figure(ctx: Ctx, ph: number): void {
  const s = Math.sin(ph);
  const bob = -1.4 * Math.abs(s);
  const sway = 1.1 * s;
  const lift = (k: number) => Math.max(0, k);
  // Boots under the hem: the lifted one rises and shows its sole.
  for (const side of [-1, 1]) {
    const up = lift(side * s);
    const x = side * 4.2 + sway * 0.3;
    ctx.fillStyle = '#2a2224';
    ctx.fillRect(x - 2.4, -15 - up * 3, 4.8, 14 - up * 2);
    ctx.beginPath();
    ctx.ellipse(x, -1.2 - up * 4.6, 3.2, 1.6 + up * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (up > 0.2) {
      ctx.fillStyle = '#4a3a34';
      ctx.beginPath();
      ctx.ellipse(x, -1 - up * 4.6, 2.6, 1.2 * up, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.translate(sway, bob);
  // The long coat, its hem swinging against the step.
  const hem = -1.8 * s;
  ctx.fillStyle = '#545866';
  ctx.beginPath();
  ctx.moveTo(-8, -82);
  ctx.quadraticCurveTo(-15, -80, -16, -72);
  ctx.quadraticCurveTo(-17, -46, -20 + hem, -15);
  ctx.quadraticCurveTo(-10 + hem, -12 + Math.abs(s), 0 + hem, -13);
  ctx.quadraticCurveTo(10 + hem, -12 - Math.abs(s), 20 + hem, -15);
  ctx.quadraticCurveTo(17, -46, 16, -72);
  ctx.quadraticCurveTo(15, -80, 8, -82);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,40,50,0.5)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // The side toward the lamp is warmer; the far side falls into the dark.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(190,150,110,0.35)';
  ctx.fillRect(6, -84, 18, 74);
  ctx.fillStyle = 'rgba(20,24,40,0.35)';
  ctx.fillRect(-24, -84, 14, 74);
  ctx.restore();
  // The seam up the back and a fold either side, moving with the stride.
  ctx.strokeStyle = 'rgba(60,62,72,0.6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -78);
  ctx.quadraticCurveTo(0.5 * s, -46, hem * 0.8, -14);
  ctx.moveTo(-8, -50);
  ctx.quadraticCurveTo(-11, -32, -13 + hem, -16);
  ctx.moveTo(8, -50);
  ctx.quadraticCurveTo(11, -32, 13 + hem, -16);
  ctx.stroke();
  // Sleeves, swinging opposite the boots.
  for (const side of [-1, 1]) {
    const swing = -side * s * 2.2;
    ctx.strokeStyle = '#4e525e';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(side * 14, -74);
    ctx.quadraticCurveTo(side * 18, -60, side * 17.5 + swing * 0.4, -46 + swing);
    ctx.stroke();
  }
  // The hood, its peak, a warm edge from the lamp behind us.
  ctx.fillStyle = '#525662';
  ctx.beginPath();
  ctx.moveTo(-10, -80);
  ctx.quadraticCurveTo(-12, -94, -3, -100);
  ctx.quadraticCurveTo(0, -103, 3, -100);
  ctx.quadraticCurveTo(12, -94, 10, -80);
  ctx.quadraticCurveTo(0, -77, -10, -80);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,130,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, -80);
  ctx.quadraticCurveTo(12, -94, 3, -100);
  ctx.moveTo(16, -72);
  ctx.quadraticCurveTo(17, -46, 20 + hem, -15);
  ctx.stroke();
}
