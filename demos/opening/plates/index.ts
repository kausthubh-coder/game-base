// The mockup's way: one painted plate a shot under a slow camera, a dissolve between shots, and light, weather
// and the Mark drawn over the plate in code. It is the player in the planning site
// (~/dev/sandbox/game-look-test/playthrough/cine.js), drawn at 1920 by 1080 and timed from the film's beats.
//
// The effects are written in the mockup's own space, 1280 by 720, and the canvas scales them up, so its sizes
// and speeds carry over unchanged.
import { SEAM, type CreateRenderer, type FilmRenderer, type Shot, type ShotId } from '../types.ts';
import { SHOTS, type Fx, type Tint } from './shots.ts';

const W = 1280, H = 720;
const SCALE = 1.5;
/** Seconds a shot takes to dissolve in over the one before. */
const FADE = 0.8;
const PLASTER = '#ead8b4';
const TINT: Record<Tint, string> = { gold: '255,214,120', white: '255,250,235' };

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (p: number) => p * p * (3 - 2 * p);
const mix = (a: number, b: number, p: number) => a + (b - a) * p;
/** A fixed "random" number for particle i, so a frame looks the same every time it is drawn. */
const rnd = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

const plateUrl = (name: string) => new URL(`../art/plates/${name}.jpg`, import.meta.url).href;

/** One soft dot of light, drawn once and stamped wherever a light is needed. */
function makeSpark() {
  const spark = document.createElement('canvas');
  spark.width = spark.height = 64;
  const c = spark.getContext('2d') as CanvasRenderingContext2D;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,248,220,1)'); g.addColorStop(0.25, 'rgba(255,220,130,.75)'); g.addColorStop(1, 'rgba(255,190,80,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  return spark;
}

/** Where the camera is: the part of the plate on screen, as fractions of the plate, and a way to place a point of the plate on screen. */
interface View { sx: number; sy: number; sw: number; zoom: number; at(u: number, v: number): [number, number] }

export const create: CreateRenderer = (film) => {
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  const spark = makeSpark();
  const plates = new Map<string, HTMLImageElement>();
  /** Each loaded plate, decoded once and kept decoded, so no frame waits on a decode. */
  const bitmaps = new Map<string, ImageBitmap>();
  let mine: readonly Shot[] = [];

  function plate(name: string) {
    let img = plates.get(name);
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      img.src = plateUrl(name);
      plates.set(name, img);
    }
    return img;
  }

  function view(s: Shot, tl: number): View {
    const spec = SHOTS[s.id];
    const until = spec.hold ? s.beats[spec.hold] : s.len;
    const p = ease(clamp(tl / until));
    const [a, b] = spec.cam;
    const zoom = mix(a[2], b[2], p);
    const sw = 1 / zoom;
    const sx = Math.max(0, Math.min(1 - sw, mix(a[0], b[0], p) - sw / 2));
    const sy = Math.max(0, Math.min(1 - sw, mix(a[1], b[1], p) - sw / 2));
    return { sx, sy, sw, zoom, at: (u, v) => [((u - sx) / sw) * W, ((v - sy) / sw) * H] };
  }

  /** How much a beat is "on": rises over the stretch of shot before it, peaks on it, then settles to half. */
  function swell(s: Shot, tl: number, beat: string) {
    const b = s.beats[beat];
    if (tl < b) return ease(clamp(1 + (tl - b) / (s.len * 0.15)));
    return 1 - 0.5 * ease(clamp((tl - b) / (s.len * 0.25)));
  }

  function effect(fx: Fx, s: Shot, tl: number, v: View, a: number) {
    switch (fx.kind) {
      case 'paint': {
        const edge = -0.1 + (tl / s.beats[fx.beat]) * 1.4;
        if (edge > 1.3) return;
        const g = c.createLinearGradient((edge - 0.22) * W, 0, edge * W, 0);
        g.addColorStop(0, 'rgba(234,216,180,0)'); g.addColorStop(1, PLASTER);
        c.globalAlpha = a; c.fillStyle = g; c.fillRect((edge - 0.22) * W, 0, W * 1.5, H);
        return;
      }
      case 'motes': {
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = `rgb(${TINT[fx.tint]})`;
        for (let i = 0; i < 28; i++) {
          const x = rnd(i, 1) * W + Math.sin(tl * 0.4 + i) * 16;
          const y = (((rnd(i, 2) * H - tl * (7 + rnd(i, 3) * 12)) % H) + H) % H;
          c.globalAlpha = a * (0.14 + 0.3 * (0.5 + 0.5 * Math.sin(tl * 1.3 + i * 2.1)));
          c.beginPath(); c.arc(x, y, 1 + rnd(i, 4) * 1.6, 0, 7); c.fill();
        }
        return;
      }
      case 'glow': {
        const [cx, cy] = v.at(fx.x, fx.y);
        const rad = fx.r * W * v.zoom;
        const g = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, `rgba(${TINT[fx.tint]},.85)`); g.addColorStop(1, `rgba(${TINT[fx.tint]},0)`);
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = a * (0.3 + 0.22 * Math.sin(tl * 1.1) + (fx.beat ? 0.3 * swell(s, tl, fx.beat) : 0));
        c.fillStyle = g; c.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
        return;
      }
      case 'spot': {
        const hold = SHOTS[s.id].hold;
        const on = ease(clamp((tl - (hold ? s.beats[hold] : s.len)) / (s.len * 0.15)));
        if (!on) return;
        const [cx, cy] = v.at(fx.x, fx.y);
        const g = c.createRadialGradient(cx, cy, H * 0.3, cx, cy, H * 0.95);
        g.addColorStop(0, 'rgba(30,18,4,0)'); g.addColorStop(1, 'rgba(30,18,4,.5)');
        c.globalAlpha = a * on; c.fillStyle = g; c.fillRect(0, 0, W, H);
        return;
      }
      case 'tint':
        c.globalAlpha = a * 0.2 * ease(clamp(tl / s.beats[fx.beat]));
        c.fillStyle = '#27457a'; c.fillRect(0, 0, W, H);
        return;
      case 'lights': {
        const from = s.beats[fx.from], to = s.beats[fx.to];
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 170; i++) {
          const len = (0.32 + rnd(i, 6) * 0.13) * s.len;
          const start = from + rnd(i, 5) * Math.max(0, to - from - len);
          const q = (tl - start) / len;
          if (q <= 0 || q >= 1) continue;
          const e = ease(q);
          const ox = 0.18 + rnd(i, 1) * 0.64, oy = 0.62 + rnd(i, 2) * 0.16;
          const bend = Math.sin(q * Math.PI) * (rnd(i, 3) - 0.5) * 0.16;
          const [x, y] = v.at(mix(ox, fx.x, e) + bend, mix(oy, fx.y, e));
          const size = (8 + rnd(i, 4) * 12) * v.zoom;
          c.globalAlpha = a * Math.min(1, q * 6) * (1 - q * q * q);
          c.drawImage(spark, x - size / 2, y - size / 2, size, size);
        }
        return;
      }
      case 'mark': {
        const [cx, cy] = v.at(fx.x, fx.y);
        const rad = fx.r * W * v.zoom;
        for (let i = 0; i < 7; i++) {
          const ang = -Math.PI / 2 + (i * Math.PI * 2) / 7;
          const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
          const beat = fx.beats[i];
          const lit = beat === undefined ? 0 : clamp((tl - s.beats[beat]) / (s.len * 0.06));
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = a * 0.9;
          c.strokeStyle = beat === undefined ? 'rgba(90,70,40,.9)' : 'rgba(150,110,40,.8)';
          c.lineWidth = 2;
          c.setLineDash(beat === undefined ? [4, 4] : []);
          c.beginPath(); c.arc(px, py, rad * 0.12, 0, 7); c.stroke();
          c.setLineDash([]);
          if (lit) {
            c.globalCompositeOperation = 'lighter';
            c.globalAlpha = a * lit;
            const size = rad * (0.62 + 0.06 * Math.sin(tl * 3 + i));
            c.drawImage(spark, px - size / 2, py - size / 2, size, size);
          }
        }
        return;
      }
      case 'candle': {
        const [cx, cy] = v.at(fx.x, fx.y);
        const flick = 0.5 + 0.5 * Math.sin(tl * 9 + Math.sin(tl * 23) * 2);
        const g = c.createRadialGradient(cx, cy, W * 0.08, cx, cy, W * 0.7 * v.zoom);
        g.addColorStop(0, 'rgba(10,6,2,0)'); g.addColorStop(1, `rgba(10,6,2,${0.5 + 0.07 * flick})`);
        c.globalAlpha = a; c.fillStyle = g; c.fillRect(0, 0, W, H);
        return;
      }
      case 'rain': {
        c.globalAlpha = a * 0.3; c.strokeStyle = '#d6e2ff'; c.lineWidth = 1.2;
        c.beginPath();
        for (let i = 0; i < 110; i++) {
          const y = ((rnd(i, 2) * (H + 80) + tl * 900 * (0.7 + rnd(i, 3) * 0.6)) % (H + 80)) - 40;
          const x = rnd(i, 1) * (W + 200) - y * 0.18;
          c.moveTo(x, y); c.lineTo(x - 4, y + 22);
        }
        c.stroke();
        return;
      }
      case 'glint': {
        const d = (tl - s.beats[fx.beat]) / (s.len * 0.12);
        if (d < -1) return;
        const on = d < 0 ? ease(1 + d) : 0.35 + 0.65 * (1 - ease(clamp(d)));
        const [x, y] = v.at(fx.x, fx.y);
        const size = 70 * v.zoom * (0.5 + 0.5 * on);
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = a * on;
        c.drawImage(spark, x - size / 2, y - size / 2, size, size);
        // A four-pointed star of thin light.
        c.strokeStyle = 'rgba(255,240,200,.9)'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(x - size, y); c.lineTo(x + size, y); c.moveTo(x, y - size * 0.7); c.lineTo(x, y + size * 0.7); c.stroke();
        return;
      }
    }
  }

  function drawShot(s: Shot, tl: number, alpha: number) {
    const v = view(s, tl);
    const img = bitmaps.get(s.plate) ?? plate(s.plate);
    c.save();
    c.globalAlpha = alpha;
    if (img.width) {
      const iw = img.width, ih = img.height;
      c.drawImage(img, v.sx * iw, v.sy * ih, v.sw * iw, v.sw * ih, 0, 0, W, H);
    } else {
      c.fillStyle = s.part ? '#2b3a4a' : PLASTER; c.fillRect(0, 0, W, H);
    }
    for (const fx of SHOTS[s.id].fx) {
      c.save();
      effect(fx, s, tl, v, alpha);
      c.restore();
    }
    c.restore();
  }

  // The dark at the edges, the same every frame.
  const vignette = document.createElement('canvas');
  vignette.width = W; vignette.height = H;
  {
    const v = vignette.getContext('2d') as CanvasRenderingContext2D;
    const g = v.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)');
    v.fillStyle = g; v.fillRect(0, 0, W, H);
  }

  const renderer: FilmRenderer = {
    canvas,
    async load(shots) {
      mine = shots;
      await Promise.all(shots.map(async (s) => {
        const img = plate(s.plate);
        await img.decode();
        if (!bitmaps.has(s.plate)) bitmaps.set(s.plate, await createImageBitmap(img));
      }));
      // Draw every shot once now, mid-dissolve and mid-shot, so the first time an effect is drawn in the film the
      // graphics chip already has its shader. The candle's gradient alone held the film for 200 ms without this.
      for (const s of shots) {
        renderer.draw(s.at + FADE / 2);
        renderer.draw(s.at + s.len / 2);
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, canvas.width, canvas.height);
    },
    draw(t) {
      const first = mine[0], last = mine[mine.length - 1];
      if (!first) return;
      const s = t < first.at ? first : t >= last.at + last.len ? last : film.at(t);
      const tl = Math.min(t, last.at + last.len + SEAM) - s.at;
      const before = mine.find((m) => m.n === s.n - 1);
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      c.clearRect(0, 0, W, H);
      if (before && tl < FADE) {
        drawShot(before, before.len + tl, 1);
        drawShot(s, tl, ease(tl / FADE));
      } else {
        drawShot(s, tl, 1);
      }
      c.drawImage(vignette, 0, 0);
    },
    panel(id: ShotId) {
      const shot = film.shot(id);
      if (!shot) return null;
      const img = plate(shot.plate);
      return bitmaps.get(shot.plate) ?? (img.complete && img.naturalWidth ? img : null);
    },
    dispose() {
      for (const b of bitmaps.values()) b.close();
      bitmaps.clear();
      plates.clear();
      canvas.width = canvas.height = 0;
    },
  };
  return renderer;
};
