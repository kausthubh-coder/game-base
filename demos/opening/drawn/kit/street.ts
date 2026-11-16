// The guild's street by the harbour, painted once for the rainy night and once for the sunny morning sixteen
// years on, from the same place, so a dissolve between them reads as the same picture. The doorstep and the
// morning shots draw what moves over these.
import { type Ctx, H, type Rand, W, blob, canvas, dabs, lerp, rng, shade } from './core.ts';
import { brushed, foliage, pool, stoneWall, wisteria, wood } from './painted.ts';

export type Mood = 'night' | 'day';

/** Where things are, in picture space. */
export const VP = { x: 560, y: 548 };
export const DOOR = { x: 1260, y: 150, w: 460, h: 618 };
export const LAMP = { x: 1206, y: 262 };
export const BASKET = { x: 1392, y: 752 };
export const KEY = { x: 1352, y: 736 };
export const STEP_TOP = 768;
/** The street's floor, from the near edge back to the vanishing point. */
export const STREET: readonly [number, number][] = [[0, H], [1220, H], [880, 700], [610, VP.y], [520, VP.y], [0, 820]];

interface Palette {
  skyTop: string; skyLow: string; glow: string; hills: string[]; water: string; wall: string; stone: string; street: string;
  door: string; leaf: [string, string]; window: string; lit: number;
}

const P: Record<Mood, Palette> = {
  night: {
    skyTop: '#0c1640', skyLow: '#33509e', glow: '#f0a050', hills: ['#2a3a6e', '#1f2c58', '#16204a'], water: '#16285a',
    wall: '#7a7a92', stone: '#6c6c86', street: '#3a4262', door: '#4a3020', leaf: ['#5a7a6a', '#1a2a2a'], window: '#ffc860', lit: 0.25,
  },
  day: {
    skyTop: '#3a86e0', skyLow: '#cfe8fa', glow: '#fff0b0', hills: ['#8ab0d8', '#6a9a6a', '#4a8a4a'], water: '#2a8ad8',
    wall: '#e8dcc4', stone: '#d8c8a8', street: '#bca88a', door: '#7a4a28', leaf: ['#b8e070', '#3a7a2a'], window: '#f8d890', lit: 1,
  },
};

export function paintStreet(mood: Mood): HTMLCanvasElement {
  const p = P[mood];
  // Each part has its own stream of numbers, so night and day lay out the same.
  let r = rng(1);
  const { canvas: c, ctx } = canvas(W, H);
  // Sky, with the calm upper left kept clear.
  const sky = ctx.createLinearGradient(0, 0, 0, VP.y);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(0.8, p.skyLow);
  sky.addColorStop(1, p.glow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, VP.y + 40);
  if (mood === 'night') {
    for (let i = 0; i < 160; i++) {
      ctx.globalAlpha = 0.3 + r() * 0.7;
      ctx.fillStyle = '#eef2ff';
      const s = r() < 0.1 ? 2.4 : 1.4;
      ctx.fillRect(r() * W, r() * (VP.y - 120), s, s);
    }
    ctx.globalAlpha = 1;
  }
  r = rng(2);
  // Clouds: soft heaps of dabs, kept to the right half of the sky.
  const cloudA = mood === 'night' ? ['#3a4a8a', '#5a6aa8', '#2a3670'] : ['#ffffff', '#f4f8ff', '#dce8f8'];
  for (const [cx, cy, s] of [[860, 150, 1.1], [980, 280, 0.8], [940, 40, 0.9]] as const) {
    for (let i = 0; i < 260 * s; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r());
      const x = cx + Math.cos(a) * 130 * s * d;
      const y = cy + Math.sin(a) * 42 * s * d - (1 - d) * 20 * s;
      ctx.globalAlpha = 0.25 + r() * 0.35;
      ctx.fillStyle = cloudA[Math.floor(r() * 3) % 3];
      ctx.beginPath();
      ctx.ellipse(x, y, 14 * s + r() * 12, 9 * s + r() * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // The far sun or moonrise behind the hills.
  pool(ctx, VP.x + 120, VP.y - 60, 300, 140, p.glow, mood === 'night' ? 0.6 : 0.5);
  ctx.fillStyle = mood === 'night' ? '#ffd890' : '#fff4c0';
  ctx.beginPath();
  ctx.arc(VP.x + 120, VP.y - 34, 36, Math.PI, 0);
  ctx.fill();
  r = rng(3);
  // Hills in three rows, the far town and an aqueduct on them.
  for (let k = 0; k < 3; k++) {
    const base = VP.y - 60 + k * 30;
    ctx.fillStyle = p.hills[k];
    ctx.beginPath();
    ctx.moveTo(200, VP.y + 40);
    for (let x = 200; x <= 1100; x += 40) ctx.lineTo(x, base - 40 * Math.sin(x * 0.006 + k * 2) - 30 * Math.sin(x * 0.013 + k) - (2 - k) * 20);
    ctx.lineTo(1100, VP.y + 40);
    ctx.closePath();
    ctx.fill();
    dabs(ctx, r, 160, () => [200 + r() * 900, base - 20 + r() * 60], [shade(p.hills[k], 0.1), shade(p.hills[k], -0.1)], [3, 7], [0.15, 0.4]);
  }
  ctx.strokeStyle = mood === 'night' ? '#5a6a9a' : '#e8dcc0';
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(420 + i * 22, VP.y - 30, 9, Math.PI, 0);
    ctx.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = 330 + r() * 400;
    const y = VP.y - 70 + r() * 50;
    ctx.fillStyle = mood === 'night' ? '#6a6a90' : '#f0e4cc';
    ctx.fillRect(x, y, 12 + r() * 10, 9 + r() * 6);
    const lit = r() < 0.7;
    if (mood === 'night' && lit) {
      ctx.fillStyle = '#ffd070';
      ctx.fillRect(x + 4, y + 3, 3, 3);
    }
  }
  r = rng(4);
  // The harbour water and its far ships.
  ctx.fillStyle = p.water;
  ctx.beginPath();
  ctx.moveTo(560, VP.y + 6);
  ctx.lineTo(1120, VP.y + 6);
  ctx.lineTo(1120, 760);
  ctx.lineTo(880, 700);
  ctx.lineTo(610, VP.y + 6);
  ctx.closePath();
  ctx.fill();
  dabs(ctx, r, 300, () => [620 + r() * 500, VP.y + 10 + r() * 200], [shade(p.water, 0.15), shade(p.water, -0.1)], [3, 10], [0.2, 0.5], 4);
  for (const [x, y, s] of [[760, 556, 1], [880, 572, 1.2], [690, 552, 0.7]] as const) ship(ctx, x, y, s, mood, r);
  r = rng(5);
  // The houses along the left of the street, with arcades.
  facade(ctx, r, p, mood);
  r = rng(6);
  // The street: cobbles in rows running back to the far end.
  const street = new Path2D();
  STREET.forEach(([x, y], i) => (i ? street.lineTo(x, y) : street.moveTo(x, y)));
  street.closePath();
  ctx.fillStyle = p.street;
  ctx.fill(street);
  ctx.save();
  ctx.clip(street);
  for (let z = 1; z < 24; z *= 1.06) {
    const y = VP.y + (H - VP.y) / z;
    const s = 26 / z;
    for (let x = -40; x < 1300; x += s * 1.6 + r() * s * 0.4) {
      const c = shade(p.street, (r() - 0.5) * 0.3);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.75, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mood === 'night' ? 'rgba(160,180,230,0.25)' : 'rgba(255,250,230,0.35)';
      ctx.beginPath();
      ctx.ellipse(x - s * 0.15, y - s * 0.1, s * 0.4, s * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (mood === 'night') {
    // Wet stone: long warm reflections under every light.
    for (const [x, y, w] of [[LAMP.x - 120, 760, 60], [130, 840, 40], [320, 700, 26], [440, 630, 16], [80, 920, 50]] as const) {
      const g = ctx.createLinearGradient(0, y, 0, y + 260);
      g.addColorStop(0, 'rgba(255,200,110,0.55)');
      g.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - w / 2, y, w, 260);
    }
  } else {
    // Dappled shade from the vines and the far side of the street.
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#5a4a6a';
      ctx.beginPath();
      ctx.ellipse(200 + r() * 800, 760 + r() * 300, 40 + r() * 60, 12 + r() * 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // The quay's posts and rope along the water.
  ctx.strokeStyle = mood === 'night' ? '#2a2a3a' : '#6a4a2a';
  for (let k = 0; k < 9; k++) {
    const t = k / 8;
    const x = lerp(880, 620, t);
    const y = lerp(700, VP.y + 6, t);
    const h = lerp(46, 10, t);
    ctx.lineWidth = lerp(12, 3, t);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(880, 664);
  ctx.quadraticCurveTo(760, 640, 620, VP.y - 2);
  ctx.stroke();
  r = rng(7);
  guild(ctx, r, p, mood);
  r = rng(8);
  // The old vine twisting up between the street and the guild, leafy at the top.
  vine(ctx, r, p, mood);
  r = rng(9);
  // Lilies in the near right corner.
  for (let i = 0; i < 26; i++) {
    const x = 1650 + r() * 300;
    const y = 1080 - r() * 40;
    const a = -Math.PI / 2 + (r() - 0.5) * 1.4;
    ctx.fillStyle = mood === 'night' ? '#2a4a3a' : '#5aa040';
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 60, y + Math.sin(a) * 60, 70, 10, a, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [x, y] of [[1760, 940], [1880, 880], [1690, 1010]] as const) lily(ctx, x, y, mood);
  if (mood === 'night') {
    // Night over everything but the lights: a blue glaze, then warmth back where lamps and windows are.
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#7a86c0';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    pool(ctx, LAMP.x, LAMP.y + 40, 420, 380, '#ffb860', 0.55);
    pool(ctx, BASKET.x, BASKET.y, 260, 120, '#ffc070', 0.35);
  }
  const { canvas: soft, ctx: s } = canvas(W, H);
  s.filter = 'blur(0.7px)';
  s.drawImage(c, 0, 0);
  return soft;
}

function ship(ctx: Ctx, x: number, y: number, s: number, mood: Mood, r: Rand): void {
  ctx.fillStyle = mood === 'night' ? '#2a2030' : '#7a4a2a';
  ctx.beginPath();
  ctx.moveTo(x - 46 * s, y);
  ctx.lineTo(x + 46 * s, y);
  ctx.lineTo(x + 34 * s, y + 14 * s);
  ctx.lineTo(x - 34 * s, y + 14 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 2.4 * s;
  for (const dx of [-14, 16]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * s, y);
    ctx.lineTo(x + dx * s, y - 120 * s);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 14 * s, y - 120 * s);
  ctx.lineTo(x + 46 * s, y);
  ctx.moveTo(x + 16 * s, y - 120 * s);
  ctx.lineTo(x - 46 * s, y);
  ctx.stroke();
  if (mood === 'night') {
    ctx.fillStyle = '#ffd070';
    for (let i = 0; i < 3; i++) ctx.fillRect(x - 24 * s + i * 20 * s + r() * 4, y + 4 * s, 4 * s, 4 * s);
  } else {
    ctx.fillStyle = '#fbf6ea';
    ctx.beginPath();
    ctx.moveTo(x + 18 * s, y - 112 * s);
    ctx.quadraticCurveTo(x + 50 * s, y - 70 * s, x + 18 * s, y - 30 * s);
    ctx.closePath();
    ctx.fill();
  }
}

function facade(ctx: Ctx, r: Rand, p: Palette, mood: Mood): void {
  // One long wall seen at an angle: its top and foot run back to the vanishing point.
  const top = (x: number) => lerp(300, VP.y - 96, x / 520);
  const foot = (x: number) => lerp(820, VP.y + 4, x / 520);
  const wall = new Path2D();
  wall.moveTo(0, top(0));
  wall.lineTo(520, top(520));
  wall.lineTo(520, foot(520));
  wall.lineTo(0, foot(0));
  wall.closePath();
  brushed(ctx, wall, p.wall, [shade(p.wall, 0.1), shade(p.wall, -0.12)], r, [0, 100, 520, 720], 1600, [3, 8]);
  // Roof eaves along the top.
  ctx.fillStyle = mood === 'night' ? '#5a3a40' : '#c8603a';
  ctx.beginPath();
  ctx.moveTo(0, top(0) - 40);
  ctx.lineTo(530, top(530) - 12);
  ctx.lineTo(530, top(530) + 4);
  ctx.lineTo(0, top(0) + 10);
  ctx.closePath();
  ctx.fill();
  // Arcade arches at the foot, warm inside; windows above.
  for (let k = 0; k < 7; k++) {
    const x0 = 520 * (1 - 1 / (1 + k * 0.55)) * 1.45;
    const x1 = 520 * (1 - 1 / (1 + (k + 0.7) * 0.55)) * 1.45;
    if (x1 > 515) break;
    const f0 = foot(x0);
    const f1 = foot(x1);
    const h = (f0 - top(x0)) * 0.42;
    ctx.fillStyle = mood === 'night' ? '#e09a48' : '#6a4a3a';
    ctx.beginPath();
    ctx.moveTo(x0, f0);
    ctx.lineTo(x0, f0 - h * 0.6);
    ctx.quadraticCurveTo((x0 + x1) / 2, f0 - h * 1.1, x1, f1 - h * 0.6);
    ctx.lineTo(x1, f1);
    ctx.closePath();
    ctx.fill();
    if (mood === 'day') {
      ctx.fillStyle = 'rgba(255,220,150,0.5)';
      ctx.fillRect(x0 + (x1 - x0) * 0.2, f0 - h * 0.3, (x1 - x0) * 0.6, h * 0.25);
    }
    const wy = lerp(top(x0), f0, 0.25);
    const ww = (x1 - x0) * 0.4;
    ctx.fillStyle = mood === 'night' ? p.window : '#4a6a8a';
    ctx.beginPath();
    ctx.moveTo(x0 + ww * 0.6, wy + ww * 1.6);
    ctx.lineTo(x0 + ww * 0.6, wy);
    ctx.arc(x0 + ww * 1.1, wy, ww * 0.5, Math.PI, 0);
    ctx.lineTo(x0 + ww * 1.6, wy + ww * 1.6);
    ctx.closePath();
    ctx.fill();
  }
  // A market awning and crates near the front.
  ctx.fillStyle = mood === 'night' ? '#b8b0a0' : '#fbf4e4';
  ctx.beginPath();
  ctx.moveTo(0, 420);
  ctx.lineTo(260, 470);
  ctx.lineTo(240, 520);
  ctx.lineTo(0, 480);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const cx = 40 + i * 34;
    const crate = new Path2D();
    crate.rect(cx, 640 + (i % 2) * 10, 30, 30);
    wood(ctx, crate, cx, 640, 30, 40, '#8a5a32', r, false);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = ['#e04a2a', '#f0a030', '#8ac040'][k % 3];
      ctx.beginPath();
      ctx.arc(cx + 6 + k * 7, 640 + (i % 2) * 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Lamp posts down the street.
  for (const k of [0.15, 0.45, 0.7]) {
    const x = 520 * k + 40;
    const y = lerp(foot(x) + 40, VP.y + 6, k * 0.3);
    const h = lerp(300, 80, k);
    ctx.strokeStyle = mood === 'night' ? '#1a1a2a' : '#3a3a3a';
    ctx.lineWidth = lerp(7, 2, k);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.stroke();
    ctx.fillStyle = mood === 'night' ? '#ffd070' : '#e8e0c8';
    ctx.beginPath();
    ctx.arc(x, y - h - 6, lerp(10, 4, k), 0, Math.PI * 2);
    ctx.fill();
    if (mood === 'night') pool(ctx, x, y - h - 6, lerp(90, 30, k), lerp(90, 30, k), '#ffc060', 0.6);
  }
  for (let i = 0; i < 4; i++) foliage(ctx, r, 30 + i * 30, 380 + i * 30, 50, 40, 200, p.leaf[0], p.leaf[1]);
  for (let i = 0; i < 40; i++) {
    const x = r() * 220;
    const y = 360 + r() * 140;
    ctx.fillStyle = mood === 'night' ? '#c0c8e0' : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 3 + r() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function guild(ctx: Ctx, r: Rand, p: Palette, mood: Mood): void {
  // The front: stone blocks from the vine to the right edge.
  ctx.save();
  const front = new Path2D();
  front.rect(1080, 0, W - 1080, STEP_TOP + 10);
  ctx.clip(front);
  stoneWall(ctx, 1080, -20, W, STEP_TOP + 10, r, p.stone, 70);
  ctx.restore();
  // The arch round the door, in big wedge stones.
  const cx = DOOR.x + DOOR.w / 2;
  const cy = DOOR.y + DOOR.w / 2;
  for (let k = 0; k < 13; k++) {
    const a0 = Math.PI + (k / 13) * Math.PI;
    const a1 = Math.PI + ((k + 1) / 13) * Math.PI;
    const r0 = DOOR.w / 2 + 6;
    const r1 = DOOR.w / 2 + 70;
    const wedge = new Path2D();
    wedge.arc(cx, cy, r1, a0 + 0.01, a1 - 0.01);
    wedge.arc(cx, cy, r0, a1 - 0.01, a0 + 0.01, true);
    wedge.closePath();
    brushed(ctx, wedge, shade(p.stone, 0.12 + (r() - 0.5) * 0.1), [shade(p.stone, 0.2), shade(p.stone, -0.05)], r, [cx - r1, cy - r1, r1 * 2, r1], 120);
  }
  for (const side of [DOOR.x - 66, DOOR.x + DOOR.w + 6]) {
    for (let k = 0; k < 7; k++) {
      const block = new Path2D();
      block.rect(side, cy + k * 76, 60, 72);
      brushed(ctx, block, shade(p.stone, 0.1 + (r() - 0.5) * 0.12), [shade(p.stone, 0.2), shade(p.stone, -0.08)], r, [side, cy + k * 76, 60, 72], 60);
    }
  }
  // The door itself.
  const door = new Path2D();
  door.moveTo(DOOR.x, DOOR.y + DOOR.h);
  door.lineTo(DOOR.x, cy);
  door.arc(cx, cy, DOOR.w / 2, Math.PI, 0);
  door.lineTo(DOOR.x + DOOR.w, DOOR.y + DOOR.h);
  door.closePath();
  if (mood === 'day') {
    // Open: the warm hall beyond, the right leaf swung back against the wall.
    const inside = ctx.createLinearGradient(0, DOOR.y, 0, DOOR.y + DOOR.h);
    inside.addColorStop(0, '#f6d898');
    inside.addColorStop(1, '#c88a4a');
    ctx.fillStyle = inside;
    ctx.fill(door);
    ctx.save();
    ctx.clip(door);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = '#a06a3a';
      ctx.fillRect(DOOR.x + 240, DOOR.y + 220 + k * 110, 200, 10);
      for (let j = 0; j < 6; j++) {
        ctx.fillStyle = ['#f0e0b8', '#c89a60', '#e8d0a0'][j % 3];
        ctx.beginPath();
        ctx.ellipse(DOOR.x + 260 + j * 30, DOOR.y + 200 + k * 110, 10, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const table = new Path2D();
    table.rect(DOOR.x + 220, DOOR.y + 500, 220, 24);
    wood(ctx, table, DOOR.x + 220, DOOR.y + 500, 220, 24, '#8a5a32', r, false);
    ctx.fillStyle = '#fbf4e4';
    ctx.fillRect(DOOR.x + 300, DOOR.y + 500, 70, 50);
    pool(ctx, DOOR.x + 360, DOOR.y + 300, 260, 260, '#fff2c0', 0.6);
    const leaf = new Path2D();
    leaf.moveTo(DOOR.x, DOOR.y + DOOR.h);
    leaf.lineTo(DOOR.x, cy);
    leaf.arc(DOOR.x + 110, cy, 110, Math.PI, Math.PI * 1.5);
    leaf.lineTo(DOOR.x + 200, cy - 80);
    leaf.lineTo(DOOR.x + 200, DOOR.y + DOOR.h - 20);
    leaf.closePath();
    wood(ctx, leaf, DOOR.x, DOOR.y, 200, DOOR.h, p.door, r);
    ctx.restore();
  } else {
    wood(ctx, door, DOOR.x, DOOR.y, DOOR.w, DOOR.h, p.door, r);
    ctx.save();
    ctx.clip(door);
    ctx.fillStyle = '#c8963a';
    for (const y of [cy + 90, cy + 330]) {
      ctx.fillRect(DOOR.x, y, DOOR.w, 22);
      for (let x = DOOR.x + 16; x < DOOR.x + DOOR.w; x += 34) {
        ctx.fillStyle = '#f0c870';
        ctx.beginPath();
        ctx.arc(x, y + 11, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c8963a';
      }
    }
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, DOOR.y);
    ctx.lineTo(cx, DOOR.y + DOOR.h);
    ctx.stroke();
    ctx.restore();
    for (const dx of [-46, 46]) {
      ctx.strokeStyle = '#d8a848';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx + dx, cy + 210, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // The guild's sign: a pick and a coil of rope in a gold ring, on the wall by the door.
  const sx = DOOR.x + DOOR.w + 70 > W - 80 ? DOOR.x - 10 : DOOR.x + DOOR.w + 36;
  const sy = 190;
  ctx.strokeStyle = '#d8a848';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(sx, sy, 72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = mood === 'night' ? '#3a2a20' : '#6a4428';
  ctx.beginPath();
  ctx.arc(sx, sy, 66, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8b848';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(sx - 40, sy + 44);
  ctx.lineTo(sx + 36, sy - 40);
  ctx.moveTo(sx + 8, sy - 50);
  ctx.quadraticCurveTo(sx + 50, sy - 40, sx + 54, sy - 6);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(sx - 12, sy + 10, 20, 12, 0.4, 0, Math.PI * 2);
  ctx.ellipse(sx + 10, sy + 20, 20, 12, 0.4, 0, Math.PI * 2);
  ctx.stroke();
  // The lamp's iron bracket (the lamp itself moves, so the shot draws it).
  ctx.strokeStyle = '#2a2420';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(DOOR.x + 30, 180);
  ctx.lineTo(LAMP.x - 30, 180);
  ctx.quadraticCurveTo(LAMP.x - 60, 150, LAMP.x - 20, 140);
  ctx.stroke();
  // The steps: three curved stones, worn and wide.
  for (let k = 2; k >= 0; k--) {
    const top = STEP_TOP + k * 90;
    const rx = 560 + k * 120;
    const step = new Path2D();
    step.ellipse(1520, top, rx, 70 + k * 10, 0, Math.PI, 0);
    step.lineTo(1520 + rx, top + 60);
    step.ellipse(1520, top + 60, rx, 70 + k * 10, 0, 0, Math.PI);
    step.closePath();
    brushed(ctx, step, shade(p.stone, -0.06 - k * 0.04), [shade(p.stone, 0.12), shade(p.stone, -0.2)], r, [1520 - rx, top - 80, rx * 2, 220], 900);
    const lip = new Path2D();
    lip.ellipse(1520, top, rx, 70 + k * 10, 0, Math.PI, 0);
    ctx.strokeStyle = mood === 'night' ? 'rgba(180,190,230,0.45)' : 'rgba(255,248,230,0.7)';
    ctx.lineWidth = 3;
    ctx.stroke(lip);
  }
  // A barrel and a coil of rope by the door.
  const barrel = new Path2D();
  barrel.ellipse(1840, 690, 70, 96, 0, 0, Math.PI * 2);
  wood(ctx, barrel, 1770, 594, 140, 192, '#7a4a28', r);
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 6;
  for (const y of [630, 750]) {
    ctx.beginPath();
    ctx.ellipse(1840, y, 70, 14, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c8a870';
  ctx.lineWidth = 9;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.ellipse(1760, 770 - k * 10, 60 - k * 8, 16, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function vine(ctx: Ctx, r: Rand, p: Palette, mood: Mood): void {
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = shade(mood === 'night' ? '#5a4a40' : '#8a6a48', (k - 1) * 0.15);
    ctx.lineWidth = 26 - k * 5;
    ctx.beginPath();
    ctx.moveTo(1040 + k * 18, 830);
    for (let y = 830; y > 0; y -= 40) ctx.lineTo(1050 + k * 16 + Math.sin(y * 0.02 + k * 2) * 26, y);
    ctx.stroke();
  }
  foliage(ctx, r, 1060, 120, 230, 150, 2200, p.leaf[0], p.leaf[1]);
  foliage(ctx, r, 1100, 420, 90, 260, 900, p.leaf[0], p.leaf[1]);
  foliage(ctx, r, 1600, 40, 360, 80, 1600, p.leaf[0], p.leaf[1]);
  for (let i = 0; i < 12; i++) wisteria(ctx, r, 900 + r() * 1000, 10 + r() * 60, 80 + r() * 90);
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = mood === 'night' ? '#9aa4c8' : '#ffffff';
    ctx.beginPath();
    ctx.arc(900 + r() * 360, 60 + r() * 240, 3 + r() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function lily(ctx: Ctx, x: number, y: number, mood: Mood): void {
  const petal = mood === 'night' ? '#c8d0ec' : '#fffdf6';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = petal;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 26, y + Math.sin(a) * 18, 30, 10, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e8c040';
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
}

/** The basket on the step with the baby in a blanket and the brass key lying on it. Drawn into the picture. */
export function basket(ctx: Ctx, mood: Mood): void {
  if (mood === 'day') return;
  const r = rng(4);
  const { x, y } = BASKET;
  ctx.fillStyle = '#8a5a2a';
  ctx.beginPath();
  ctx.ellipse(x, y, 110, 52, 0, 0, Math.PI);
  ctx.lineTo(x - 110, y - 10);
  ctx.fill();
  ctx.strokeStyle = '#5a3a1a';
  ctx.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    ctx.ellipse(x, y + k * 7, 108 - k * 6, 44 - k * 4, 0, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#a07040';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(x, y - 10, 104, 26, 0, Math.PI, 0);
  ctx.stroke();
  // The blanket, with a fringe hanging over the rim.
  const blanket = blob(x - 10, y - 26, 96, 36, r, 0.06, 14);
  ctx.fillStyle = '#e8e0c8';
  ctx.fill(blanket);
  ctx.strokeStyle = '#d0c4a8';
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 18; k++) {
    ctx.beginPath();
    ctx.moveTo(x - 80 + k * 5, y);
    ctx.lineTo(x - 82 + k * 5, y + 30 + r() * 10);
    ctx.stroke();
  }
  // The baby's face, asleep.
  ctx.fillStyle = '#f4cdb0';
  ctx.beginPath();
  ctx.ellipse(x + 34, y - 44, 26, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e0c8';
  ctx.beginPath();
  ctx.ellipse(x + 46, y - 60, 30, 16, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a4a3a';
  ctx.lineWidth = 2;
  for (const dx of [24, 42]) {
    ctx.beginPath();
    ctx.arc(x + dx, y - 44, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(230,120,110,0.4)';
  ctx.beginPath();
  ctx.ellipse(x + 20, y - 36, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // The brass key on its cord.
  ctx.strokeStyle = '#8a3a2a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 12, y - 30);
  ctx.quadraticCurveTo(x - 10, y - 10, KEY.x + 10, KEY.y);
  ctx.stroke();
  ctx.save();
  ctx.translate(KEY.x, KEY.y);
  ctx.rotate(-0.3);
  ctx.strokeStyle = '#c89a38';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.moveTo(-9, 0);
  ctx.lineTo(-40, 0);
  ctx.moveTo(-32, 0);
  ctx.lineTo(-32, 8);
  ctx.moveTo(-38, 0);
  ctx.lineTo(-38, 7);
  ctx.stroke();
  ctx.restore();
}

/** The guild's lamp, swinging a little on its chain, lit or not. Returns nothing; draws through ctx's transform. */
export function lamp(ctx: Ctx, tl: number, lit: number, flick: number): void {
  const sway = 0.035 * Math.sin(tl * 1.3) + 0.015 * Math.sin(tl * 3.1 + 1);
  ctx.save();
  ctx.translate(LAMP.x - 20, 142);
  ctx.rotate(sway);
  ctx.strokeStyle = '#2a2420';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 64);
  ctx.stroke();
  ctx.translate(0, 120);
  // Glass, then the iron cage over it.
  ctx.fillStyle = lit > 0 ? '#ffd27a' : '#c8d8e0';
  ctx.globalAlpha = lit > 0 ? 0.55 + 0.4 * lit * flick : 0.7;
  ctx.beginPath();
  ctx.moveTo(-26, -44);
  ctx.lineTo(26, -44);
  ctx.lineTo(20, 40);
  ctx.lineTo(-20, 40);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  if (lit > 0) {
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.ellipse(0, 6 - flick * 2, 6, 12 * flick, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2a2420';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-26, -44);
  ctx.lineTo(-20, 40);
  ctx.moveTo(26, -44);
  ctx.lineTo(20, 40);
  ctx.moveTo(0, -44);
  ctx.lineTo(0, 40);
  ctx.stroke();
  ctx.fillStyle = '#2a2420';
  ctx.beginPath();
  ctx.moveTo(-34, -44);
  ctx.lineTo(0, -66);
  ctx.lineTo(34, -44);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-24, 40, 48, 8);
  ctx.restore();
}

/** Where the lamp's flame is now, for its light. */
const light: [number, number] = [0, 0];
export function lampLight(tl: number): readonly [number, number] {
  const sway = 0.035 * Math.sin(tl * 1.3) + 0.015 * Math.sin(tl * 3.1 + 1);
  light[0] = LAMP.x - 20 - Math.sin(sway) * 120;
  light[1] = 142 + Math.cos(sway) * 120;
  return light;
}
