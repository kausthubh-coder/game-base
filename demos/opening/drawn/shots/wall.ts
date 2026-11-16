// Shot 9, the wall. We are close on the painting, and as the camera draws back the light falls away: it is a
// wall in a dark bunk room, clear by the beat `room`. A small child in a nightshirt holds a candle up to the
// scraped place, the arm rising, the flame flickering on the wall. The door at the right swings open on a lit
// kitchen and Hobb the cook stands in it, in view by `hobb`.
import { type Cam, type Ctx, H, type Rand, W, blob, bloom, camLerp, canvas, curve, ease, glow, lerp, look, noise, reset, rng, shade, smooth, span, walk } from '../kit/core.ts';
import { brushed, foliage, pool, stoneWall, wisteria, wood } from '../kit/painted.ts';
import { type MakePainter, pause } from '../kit/shot.ts';

/** The painting's place on the wall, in room space. The friends panel is drawn into it. */
const ART = { x: 330, y: 104, w: 960, h: 540 };
const FLOOR = 872;
const DOOR = { x: 1430, y: 250, w: 290, h: 622 };
const KID = { x: 1052, y: 884, h: 252 };
const HOBB = { x: 1575, y: 870, h: 360 };
/** The part of the friends panel the wall shows: the figures, not the bare plaster round them. */
const CROP = { x: 230, y: 70, w: 1560, h: 877 };
/** Where the scraped place is in room space. */
const SCRAPED = { x: ART.x + ((1595 - CROP.x) / CROP.w) * ART.w, y: ART.y + ((580 - CROP.y) / CROP.h) * ART.h };

export const wall: MakePainter = (env) => {
  let room: HTMLCanvasElement;
  let art: HTMLCanvasElement;
  let doorLeaf: HTMLCanvasElement;
  let doorLight: HTMLCanvasElement;
  let hole: HTMLCanvasElement;
  let hobb: HTMLCanvasElement;
  let kid: Kid;

  async function build() {
    const friends = await env.painter('friends');
    art = friends.hires?.() ?? (friends.still?.() as HTMLCanvasElement);
    room = paintRoom(rng(9));
    await pause();
    doorLeaf = paintDoor(rng(10));
    doorLight = paintDoorLight();
    hole = paintHole();
    hobb = paintHobb(rng(12));
    kid = makeKid();
  }

  function camAt(tl: number, roomAt: number, len: number): Cam {
    // It opens on the whole painting, filling the frame, as if the legend went on.
    const close: Cam = { x: ART.x + ART.w / 2, y: ART.y + ART.h / 2, zoom: W / ART.w };
    const wide: Cam = { x: 980, y: 560, zoom: 1.02 };
    const end: Cam = { x: SCRAPED.x - 120, y: 580, zoom: 1.1 };
    // Drawing back at an even pace, slow to start and slow to settle.
    const back = walk((tl - 0.1) / (roomAt + 0.6), 0.3, 0.4);
    const cam = camLerp(close, wide, back);
    return camLerp(cam, end, ease(span(tl, roomAt + 0.4, len + 1)));
  }

  return {
    build,
    draw(ctx, tl, shot) {
      const roomAt = shot.beats.room;
      const hobbAt = shot.beats.hobb;
      const cam = camAt(tl, roomAt, shot.len);
      const dark = smooth(span(tl, 0.1, roomAt));
      const open = smooth(span(tl, hobbAt - 1.3, hobbAt - 0.15));
      const raise = smooth(span(tl, 0.25, roomAt + (hobbAt - roomAt) * 0.6));
      const flick = 0.86 + 0.09 * noise(tl * 9) + 0.05 * noise(tl * 23 + 4);

      reset(ctx);
      look(ctx, cam);
      ctx.drawImage(room, 0, 0, W, H);
      const k = art.width / W;
      ctx.drawImage(art, CROP.x * k, CROP.y * k, CROP.w * k, CROP.h * k, ART.x, ART.y, ART.w, ART.h);
      // The kitchen through the door, Hobb in it, the door leaf turning away.
      ctx.globalAlpha = open;
      ctx.drawImage(hobb, HOBB.x - 180, HOBB.y - HOBB.h * 1.02 + Math.sin(tl * 1.8) * 1.2, 360, HOBB.h * 1.04);
      ctx.globalAlpha = 1;
      const leafW = DOOR.w * Math.cos(open * 1.35);
      if (leafW > 2) {
        ctx.drawImage(doorLeaf, DOOR.x + DOOR.w - leafW, DOOR.y, leafW, DOOR.h);
        ctx.globalAlpha = open * 0.6;
        ctx.fillStyle = '#100808';
        ctx.fillRect(DOOR.x + DOOR.w - leafW, DOOR.y, leafW, DOOR.h);
        ctx.globalAlpha = 1;
      }
      const flame = kid.draw(ctx, tl, raise, flick);

      // The dark: everything but the candle's reach, the open door and a breath of moonlight goes blue.
      if (dark > 0.001) {
        const s = env.scratch;
        reset(s);
        s.clearRect(0, 0, W, H);
        look(s, cam);
        s.fillStyle = '#262c58';
        s.fillRect(-200, -200, W + 400, H + 400);
        s.globalCompositeOperation = 'destination-out';
        const R = 520 * flick;
        s.drawImage(hole, flame[0] - R, flame[1] - R * 0.9, R * 2, R * 1.8);
        s.globalAlpha = open;
        s.drawImage(doorLight, 0, 0, W, H);
        s.globalAlpha = 0.35;
        s.drawImage(hole, 20, 120, 300, 340);
        // Where the dark was cut away, the light is warm.
        s.globalAlpha = 1;
        s.globalCompositeOperation = 'destination-over';
        s.fillStyle = '#ffd2a0';
        s.fillRect(-200, -200, W + 400, H + 400);
        reset(s);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = dark;
        ctx.drawImage(s.canvas, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      // The flame's bloom, and its warmth on the wall around it.
      look(ctx, cam);
      ctx.globalCompositeOperation = 'lighter';
      bloom(ctx, glow('#ffb04a', 0.22), flame[0], flame[1], 300 * flick, 0.32 * dark + 0.1);
      bloom(ctx, glow('#ffe2a0', 0.45), flame[0], flame[1] - 4, 36 * flick, 0.9);
      bloom(ctx, glow('#ffc070', 0.2), DOOR.x + DOOR.w / 2, DOOR.y + DOOR.h * 0.45, 340, 0.3 * open);
      bloom(ctx, glow('#ffd38a', 0.35), DOOR.x + DOOR.w * 0.72, DOOR.y + 120, 40, 0.8 * open);
      reset(ctx);
    },
  };
};

/** The bunk room, painted lit, as if the whole of it were in candle light. The dark goes over it each frame. */
function paintRoom(r: Rand): HTMLCanvasElement {
  const { canvas: c, ctx } = canvas(W, H);
  ctx.fillStyle = '#8c7a66';
  ctx.fillRect(0, 0, W, H);
  stoneWall(ctx, -20, 40, W + 20, FLOOR, r, '#a89480', 62);
  // The painting's plaster ground and frame, and a painted dado under it.
  const frame = new Path2D();
  frame.rect(ART.x - 18, ART.y - 18, ART.w + 36, ART.h + 36);
  brushed(ctx, frame, '#e2d4b8', ['#f0e4cc', '#c8b898'], r, [ART.x - 18, ART.y - 18, ART.w + 36, ART.h + 36], 900);
  const dado = new Path2D();
  dado.rect(ART.x - 18, ART.y + ART.h + 18, ART.w + 36, 70);
  brushed(ctx, dado, '#c8a46a', ['#d8b47a', '#a8844a'], r, [ART.x - 18, ART.y + ART.h + 18, ART.w + 36, 70], 500);
  ctx.strokeStyle = '#7a5a2a';
  ctx.lineWidth = 3;
  for (let x = ART.x; x < ART.x + ART.w; x += 80) {
    ctx.beginPath();
    ctx.arc(x + 40, ART.y + ART.h + 88, 36, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#f4ead4';
    ctx.beginPath();
    ctx.arc(x + 40, ART.y + ART.h + 66, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Ceiling beams and a hanging vine.
  const beam = new Path2D();
  beam.rect(0, 0, W, 48);
  wood(ctx, beam, 0, 0, W, 48, '#4a3020', r, false);
  for (const x of [300, 1340]) {
    const post = new Path2D();
    post.rect(x - 16, 0, 32, 120);
    wood(ctx, post, x - 16, 0, 32, 120, '#4a3020', r);
  }
  for (let i = 0; i < 16; i++) foliage(ctx, r, 120 * i + r() * 60, 40 + r() * 20, 70, 26, 90, '#7ab04a', '#2f5a2a');
  for (let i = 0; i < 9; i++) wisteria(ctx, r, 180 + i * 200 + r() * 80, 50, 60 + r() * 60);
  // The round window with the night in it.
  const win = new Path2D();
  win.arc(150, 300, 108, 0, Math.PI * 2);
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath();
  ctx.arc(150, 300, 128, 0, Math.PI * 2);
  ctx.fill();
  const sky = ctx.createLinearGradient(0, 192, 0, 408);
  sky.addColorStop(0, '#1a2a6a');
  sky.addColorStop(0.7, '#3a5ab0');
  sky.addColorStop(1, '#e0a050');
  ctx.fillStyle = sky;
  ctx.fill(win);
  ctx.save();
  ctx.clip(win);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.4 + r() * 0.6;
    ctx.fillRect(50 + r() * 200, 200 + r() * 130, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#1f3a5a';
  ctx.beginPath();
  ctx.moveTo(40, 408);
  ctx.quadraticCurveTo(110, 340, 170, 370);
  ctx.quadraticCurveTo(220, 350, 270, 408);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(150, 192);
  ctx.lineTo(150, 408);
  ctx.moveTo(42, 300);
  ctx.lineTo(258, 300);
  ctx.stroke();
  // Bunks along the left wall with children asleep in them.
  bunks(ctx, r, 10, 300, false);
  bunks(ctx, r, 1730, 1920, true);
  // A bench with a chest and a jug of lavender.
  const bench = new Path2D();
  bench.rect(380, 760, 330, 26);
  wood(ctx, bench, 380, 760, 330, 26, '#6a4428', r, false);
  for (const x of [396, 690]) {
    const leg = new Path2D();
    leg.rect(x - 8, 786, 16, 86);
    wood(ctx, leg, x - 8, 786, 16, 86, '#5a3820', r);
  }
  const chest = new Path2D();
  chest.rect(740, 780, 150, 92);
  wood(ctx, chest, 740, 780, 150, 92, '#7a5030', r, false);
  ctx.strokeStyle = '#c8a050';
  ctx.lineWidth = 6;
  ctx.strokeRect(740, 780, 150, 92);
  const jug = blob(560, 728, 34, 36, r, 0.05, 12);
  brushed(ctx, jug, '#c8b48a', ['#e0d0a8', '#9a8460'], r, [520, 690, 80, 80], 120);
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 1.6;
    ctx.strokeStyle = '#4a7a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(560, 700);
    const ex = 560 + Math.cos(a) * 80;
    const ey = 700 + Math.sin(a) * 80;
    ctx.lineTo(ex, ey);
    ctx.stroke();
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? '#a888e0' : '#f4efe2';
      ctx.beginPath();
      ctx.arc(ex - Math.cos(a) * k * 5, ey - Math.sin(a) * k * 5, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The door's stone surround and the lit kitchen behind it.
  const inside = new Path2D();
  inside.moveTo(DOOR.x, DOOR.y + DOOR.h);
  inside.lineTo(DOOR.x, DOOR.y + DOOR.w / 2);
  inside.arc(DOOR.x + DOOR.w / 2, DOOR.y + DOOR.w / 2, DOOR.w / 2, Math.PI, 0);
  inside.lineTo(DOOR.x + DOOR.w, DOOR.y + DOOR.h);
  inside.closePath();
  const kg = ctx.createLinearGradient(0, DOOR.y, 0, DOOR.y + DOOR.h);
  kg.addColorStop(0, '#f8d690');
  kg.addColorStop(1, '#d8904a');
  ctx.fillStyle = kg;
  ctx.fill(inside);
  ctx.save();
  ctx.clip(inside);
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = '#a86a3a';
    ctx.fillRect(DOOR.x + 20, DOOR.y + 160 + k * 90, DOOR.w - 40, 10);
    for (let j = 0; j < 6; j++) {
      ctx.fillStyle = ['#e8c890', '#8a5a3a', '#c8b080'][j % 3];
      ctx.fillRect(DOOR.x + 30 + j * 40, DOOR.y + 120 + k * 90, 22, 40);
    }
  }
  pool(ctx, DOOR.x + DOOR.w * 0.72, DOOR.y + 120, 140, 140, '#fff0c0', 0.8);
  ctx.restore();
  ctx.lineWidth = 34;
  ctx.strokeStyle = '#b8a48a';
  ctx.stroke(inside);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#6a5a4a';
  for (let k = 0; k < 9; k++) {
    const y = DOOR.y + DOOR.w / 2 + k * 60;
    ctx.beginPath();
    ctx.moveTo(DOOR.x - 17, y);
    ctx.lineTo(DOOR.x + 17, y);
    ctx.moveTo(DOOR.x + DOOR.w - 17, y);
    ctx.lineTo(DOOR.x + DOOR.w + 17, y);
    ctx.stroke();
  }
  // The floor: flagstones running back to the wall.
  const fl = ctx.createLinearGradient(0, FLOOR, 0, H);
  fl.addColorStop(0, '#7a6a58');
  fl.addColorStop(1, '#a48e74');
  ctx.fillStyle = fl;
  ctx.fillRect(0, FLOOR, W, H - FLOOR);
  ctx.strokeStyle = 'rgba(50,36,24,0.55)';
  ctx.lineWidth = 2;
  for (let k = 0, y = FLOOR; y < H; k++, y += 16 + k * 9) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = -16; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo(960 + i * 70, FLOOR);
    ctx.lineTo(960 + i * 190, H);
    ctx.stroke();
  }
  dabs(ctx, r, 900, () => [r() * W, FLOOR + r() * (H - FLOOR)], ['#8a7a64', '#5a4a3a', '#b8a284'], [3, 10], [0.1, 0.3]);
  // A rug before the door.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(1210, 920);
  ctx.lineTo(1700, 920);
  ctx.lineTo(1800, 1010);
  ctx.lineTo(1150, 1010);
  ctx.closePath();
  ctx.fillStyle = '#7a2a2a';
  ctx.fill();
  ctx.strokeStyle = '#c8904a';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
  // Bed ends in the foreground, dark against the room.
  for (const [x0, x1] of [[-20, 540], [1440, 1940]] as const) {
    const lump = blob((x0 + x1) / 2, 1030, (x1 - x0) / 2, 70, r, 0.08, 14);
    brushed(ctx, lump, '#4a5a8a', ['#6a7aaa', '#3a4a7a', '#c8c0b0'], r, [x0, 950, x1 - x0, 130], 500);
    const rail = new Path2D();
    rail.rect(x0 + 40, 990, x1 - x0 - 80, 22);
    wood(ctx, rail, x0 + 40, 990, x1 - x0 - 80, 22, '#3a2416', r, false);
  }
  // Soften everything a touch, as a painting would be.
  const { canvas: soft, ctx: s } = canvas(W, H);
  s.filter = 'blur(0.8px)';
  s.drawImage(c, 0, 0);
  return soft;
}

function dabs(ctx: Ctx, r: Rand, n: number, where: () => [number, number], colors: string[], size: [number, number], alpha: [number, number]): void {
  for (let i = 0; i < n; i++) {
    const [x, y] = where();
    ctx.globalAlpha = lerp(alpha[0], alpha[1], r());
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    ctx.beginPath();
    ctx.ellipse(x, y, lerp(size[0], size[1], r()) * 2, lerp(size[0], size[1], r()) * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Two bunks against a wall with sleeping children: a lump of quilt and a dark head on a pillow. */
function bunks(ctx: Ctx, r: Rand, x0: number, x1: number, right: boolean): void {
  for (const y of [470, 760]) {
    const frame = new Path2D();
    frame.rect(x0, y, x1 - x0, 26);
    wood(ctx, frame, x0, y, x1 - x0, 26, '#5a3820', r, false);
    const quilt = blob((x0 + x1) / 2, y - 26, (x1 - x0) / 2 - 6, 32, r, 0.1, 12);
    brushed(ctx, quilt, '#4a62a8', ['#6a82c8', '#2a428a', '#e8dcc4'], r, [x0, y - 70, x1 - x0, 70], 300);
    const px = right ? x0 + 50 : x1 - 70;
    ctx.fillStyle = '#efe6d4';
    ctx.beginPath();
    ctx.ellipse(px, y - 44, 44, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // A sleeping face turned to the side, the hair a tousle over it, the quilt pulled up to the cheek.
    ctx.fillStyle = '#d8a888';
    ctx.beginPath();
    ctx.ellipse(px + (right ? 6 : -6), y - 44, 13, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ['#3a2418', '#6a3a1e', '#b0702c'][Math.floor(r() * 3)];
    ctx.beginPath();
    ctx.ellipse(px + (right ? -4 : 4), y - 52, 17, 11, right ? 0.4 : -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a62a8';
    ctx.beginPath();
    ctx.ellipse(px, y - 30, 30, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const x of [x0 + 6, x1 - 18]) {
    const post = new Path2D();
    post.rect(x, 380, 18, FLOOR - 380);
    wood(ctx, post, x, 380, 18, FLOOR - 380, '#4a2c18', r);
  }
}

function paintDoor(r: Rand): HTMLCanvasElement {
  const { canvas: c, ctx } = canvas(DOOR.w, DOOR.h);
  const p = new Path2D();
  p.moveTo(0, DOOR.h);
  p.lineTo(0, DOOR.w / 2);
  p.arc(DOOR.w / 2, DOOR.w / 2, DOOR.w / 2, Math.PI, 0);
  p.lineTo(DOOR.w, DOOR.h);
  p.closePath();
  wood(ctx, p, 0, 0, DOOR.w, DOOR.h, '#6a4428', r);
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 3;
  for (let x = 48; x < DOOR.w; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, DOOR.h);
    ctx.stroke();
  }
  ctx.fillStyle = '#8a7a5a';
  for (const y of [180, 440]) ctx.fillRect(10, y, DOOR.w - 20, 16);
  ctx.fillStyle = '#c8a050';
  ctx.beginPath();
  ctx.arc(40, 360, 10, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** Where the door's light falls: the doorway and a wedge across the floor, soft edged. */
function paintDoorLight(): HTMLCanvasElement {
  const { canvas: c, ctx } = canvas(W, H);
  ctx.filter = 'blur(48px)';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(DOOR.x + 10, DOOR.y + 40);
  ctx.lineTo(DOOR.x + DOOR.w - 10, DOOR.y + 40);
  ctx.lineTo(DOOR.x + DOOR.w + 10, FLOOR);
  ctx.lineTo(DOOR.x + DOOR.w + 220, H);
  ctx.lineTo(DOOR.x - 260, H);
  ctx.lineTo(DOOR.x - 10, FLOOR);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(DOOR.x + DOOR.w / 2, DOOR.y + DOOR.h / 2, DOOR.w * 1.1, DOOR.h * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** A soft round hole for cutting light out of the dark. */
function paintHole(): HTMLCanvasElement {
  const { canvas: c, ctx } = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.2, 'rgba(0,0,0,0.9)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.75, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return c;
}

/** Hobb: stout and kind, sleeves rolled, hands on her hips, a ladle at her belt, a scarf in her hair. */
function paintHobb(r: Rand): HTMLCanvasElement {
  const { canvas: c, ctx } = canvas(360, HOBB.h * 1.04);
  const u = HOBB.h / 100;
  ctx.translate(180, HOBB.h);
  ctx.scale(u, u);
  ctx.lineJoin = 'round';
  const fill = (p: Path2D, color: string | CanvasGradient, edge = '#3a2214') => {
    ctx.fillStyle = color;
    ctx.fill(p);
    ctx.strokeStyle = edge;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 0.5;
    ctx.stroke(p);
    ctx.globalAlpha = 1;
  };
  const lit = (a: string, b: string, x0 = -20, x1 = 20) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, b);
    g.addColorStop(0.45, a);
    g.addColorStop(1, b);
    return g;
  };
  // Boots and the long skirt.
  for (const s of [-1, 1]) fill(blob(s * 6, -2, 6, 3, r, 0.05, 8), '#4a2c1a');
  fill(curve([[-17, -46], [17, -46], [22, -14], [20, -3], [0, -1], [-20, -3], [-22, -14]]), lit('#d8c8a4', '#a89878', -22, 22));
  // Body, blouse and apron.
  fill(curve([[-12, -76], [12, -76], [17, -62], [18, -46], [-18, -46], [-17, -62]]), lit('#f2e6d0', '#c8b898', -18, 18));
  fill(curve([[-11, -64], [11, -64], [15, -40], [16, -10], [0, -8], [-16, -10], [-15, -40]]), lit('#9a3a3a', '#6a2424', -16, 16));
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = 'rgba(240,220,200,0.45)';
    ctx.beginPath();
    ctx.ellipse(-10 + r() * 20, -55 + r() * 40, 0.6 + r() * 1.2, 0.4 + r(), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  fill(curve([[-16, -50], [16, -50], [16, -47], [-16, -47]]), '#5a3a22');
  // A ladle on the belt.
  ctx.strokeStyle = '#c8a050';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(10, -48);
  ctx.lineTo(12, -30);
  ctx.stroke();
  fill(blob(12.5, -28, 2.6, 2, r, 0.05, 8), '#d8b060');
  // Arms akimbo: a full sleeve to the elbow, then a bare forearm back to the hip.
  for (const s of [-1, 1]) {
    ctx.lineCap = 'round';
    const upper = new Path2D();
    upper.moveTo(s * 13, -73);
    upper.lineTo(s * 25, -60);
    ctx.strokeStyle = '#3a2214';
    ctx.lineWidth = 9.4;
    ctx.stroke(upper);
    ctx.strokeStyle = '#e8dcc4';
    ctx.lineWidth = 8;
    ctx.stroke(upper);
    const fore = new Path2D();
    fore.moveTo(s * 25, -59);
    fore.lineTo(s * 16, -50);
    ctx.strokeStyle = '#3a2214';
    ctx.lineWidth = 6.6;
    ctx.stroke(fore);
    ctx.strokeStyle = '#e8b892';
    ctx.lineWidth = 5.2;
    ctx.stroke(fore);
    fill(blob(s * 15.5, -50, 3.2, 2.8, r, 0.08, 8), '#e8b892');
  }
  // Neck and head: round face, rosy cheeks, a smile, auburn curls and a scarf.
  fill(curve([[-3, -80], [3, -80], [3, -74], [-3, -74]]), '#efc9a4');
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (0.9 + (i / 15) * 1.2);
    fill(blob(Math.cos(a) * 8, -87 + Math.sin(a) * 8.4, 3.4, 3.2, r, 0.1, 8), i % 2 ? '#9a4a24' : '#b05a2c');
  }
  const face = blob(0, -86, 7.4, 7.8, r, 0.03, 12);
  const fg = ctx.createRadialGradient(-2, -88, 1, 0, -86, 9);
  fg.addColorStop(0, '#f8dcc0');
  fg.addColorStop(1, '#e0a888');
  fill(face, fg);
  for (const s of [-1, 1]) {
    ctx.fillStyle = 'rgba(230,120,100,0.45)';
    ctx.beginPath();
    ctx.ellipse(s * 4, -84, 2, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(s * 3 - 1.3, -87.6);
    ctx.quadraticCurveTo(s * 3, -86.4, s * 3 + 1.3, -87.6);
    ctx.stroke();
  }
  ctx.strokeStyle = '#8a3a2a';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-2, -82.6);
  ctx.quadraticCurveTo(0, -81, 2, -82.6);
  ctx.stroke();
  fill(curve([[-8, -92], [-3, -97], [5, -97], [9, -92], [6, -93], [-5, -93]]), '#efe2c4');
  fill(blob(6, -97, 2.4, 1.6, r, 0.05, 6), '#efe2c4');
  return c;
}

interface Kid { draw(ctx: Ctx, tl: number, raise: number, flick: number): [number, number] }

const flamePos: [number, number] = [0, 0];

/** The child, from behind: curly hair, a long nightshirt, bare feet, one arm lifting a candle. */
function makeKid(): Kid {
  const u = KID.h / 100;
  const { ctx: g } = canvas(2, 2);
  const shirt = g.createLinearGradient(-16, 0, 18, 0);
  shirt.addColorStop(0, '#d8ccb4');
  shirt.addColorStop(0.6, '#f2e8d4');
  shirt.addColorStop(1, '#fff6e2');
  const skin = '#e8b894';
  const hair = g.createRadialGradient(5, -92, 1, 0, -86, 15);
  hair.addColorStop(0, '#8a5a34');
  hair.addColorStop(1, '#4a2c18');
  const S: [number, number] = [8.5, -70];
  const r = rng(5);
  const curls: [number, number, number][] = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return [Math.cos(a) * 11.5, -86 + Math.sin(a) * 11.5, 3.4 + r() * 1.6];
  });
  return {
    draw(ctx, tl, raise, flick) {
      ctx.save();
      ctx.translate(KID.x, KID.y);
      ctx.scale(u, u);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // A small shift of weight as the arm goes up.
      ctx.translate(Math.sin(tl * 0.9) * 0.3, 0);
      // Legs and bare feet.
      for (const s of [-1, 1]) {
        ctx.strokeStyle = '#5a3a24';
        ctx.lineWidth = 5.4;
        ctx.beginPath();
        ctx.moveTo(s * 4, -26);
        ctx.lineTo(s * 4.5, -3);
        ctx.stroke();
        ctx.strokeStyle = skin;
        ctx.lineWidth = 4.2;
        ctx.stroke();
        ctx.fillStyle = shade(skin, -0.1);
        ctx.beginPath();
        ctx.ellipse(s * 4.6, -1.4, 3, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // The nightshirt, to below the knee.
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.moveTo(-9, -74);
      ctx.quadraticCurveTo(0, -77, 9, -74);
      ctx.quadraticCurveTo(12, -60, 13, -46);
      ctx.quadraticCurveTo(16, -32, 16.5, -22);
      ctx.quadraticCurveTo(0, -19, -16.5, -22);
      ctx.quadraticCurveTo(-16, -32, -13, -46);
      ctx.quadraticCurveTo(-12, -60, -9, -74);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,70,50,0.6)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(140,120,90,0.45)';
      ctx.beginPath();
      ctx.moveTo(-4, -60);
      ctx.quadraticCurveTo(-6, -40, -8, -23);
      ctx.moveTo(3, -58);
      ctx.quadraticCurveTo(4, -40, 6, -22);
      ctx.stroke();
      // The left arm hangs.
      ctx.strokeStyle = '#d8ccb4';
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(-8.5, -70);
      ctx.quadraticCurveTo(-12.5, -60, -12.5, -50);
      ctx.stroke();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(-12.6, -47, 2.4, 0, Math.PI * 2);
      ctx.fill();
      // The right arm lifts the candle toward the wall.
      const tx = lerp(12, 24, raise) + Math.sin(tl * 1.7) * 0.4 * raise;
      const ty = lerp(-52, -112, raise) + Math.sin(tl * 2.3) * 0.4;
      const dx = tx - S[0];
      const dy = ty - S[1];
      const d = Math.min(Math.hypot(dx, dy), 33.5);
      const h = Math.sqrt(Math.max(0, 17 * 17 - (d / 2) ** 2));
      const ex = S[0] + dx / 2 + (dy / Math.hypot(dx, dy)) * -h;
      const ey = S[1] + dy / 2 + (dx / Math.hypot(dx, dy)) * h;
      ctx.strokeStyle = '#efe6d2';
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(S[0], S[1]);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = skin;
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(lerp(S[0], ex, 0.6), lerp(S[1], ey, 0.6));
      ctx.lineTo(ex, ey);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      // The candle in its brass dish, and the flame.
      ctx.fillStyle = '#c89a40';
      ctx.beginPath();
      ctx.ellipse(tx, ty - 1, 5, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f6efe0';
      ctx.fillRect(tx - 1.6, ty - 11, 3.2, 10);
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(tx, ty + 1, 2.6, 0, Math.PI * 2);
      ctx.fill();
      const sway = (noise(tl * 6) - 0.5) * 1.6;
      const tall = 5.5 * flick + 1;
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath();
      ctx.moveTo(tx - 1.6, ty - 11.5);
      ctx.quadraticCurveTo(tx - 2, ty - 11.5 - tall * 0.6, tx + sway, ty - 11.5 - tall * 1.4);
      ctx.quadraticCurveTo(tx + 2, ty - 11.5 - tall * 0.6, tx + 1.6, ty - 11.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath();
      ctx.ellipse(tx + sway * 0.3, ty - 13, 0.9, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // The head: a mop of curls, a cord of the key round the neck.
      ctx.fillStyle = skin;
      ctx.fillRect(-2.5, -78, 5, 5);
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(0, -86, 12, 0, Math.PI * 2);
      for (const [cx, cy, cr] of curls) {
        ctx.moveTo(cx + cr, cy);
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,150,90,0.6)';
      ctx.lineWidth = 0.8;
      for (const [cx, cy, cr] of curls) {
        ctx.beginPath();
        ctx.arc(cx + 0.5, cy - 0.5, cr * 0.6, -2.4, -0.6);
        ctx.stroke();
      }
      ctx.strokeStyle = '#6a4a2a';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-6, -75);
      ctx.quadraticCurveTo(0, -72, 6, -75);
      ctx.stroke();
      ctx.restore();
      flamePos[0] = KID.x + (tx + sway * 0.3) * u;
      flamePos[1] = KID.y + (ty - 14) * u;
      return flamePos;
    },
  };
}
