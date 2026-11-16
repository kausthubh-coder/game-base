// The cut-out way: Sol's painted pieces from cutout/art moved and lit like a cut-out film, a paper theatre with
// gold leaf. Each shot's pieces hinge, swap drawings and catch a running light under a rostrum camera
// (shots.ts says how, stage.ts draws it). Shots dissolve into each other; over the picture lies the same
// vignette and a fine grain, so the eleven read as one film.
import { SEAM, type CreateRenderer, type Shot, type ShotId } from '../types.ts';
import { ease } from './motion.ts';
import { loadScene, type Scene } from './scene.ts';
import { DIRECTION, prepare } from './shots.ts';
import { H, Stage, W } from './stage.ts';

/** Seconds a shot takes to dissolve in over the one before. Night to morning on the same step takes longer. */
const FADE: Partial<Record<ShotId, number>> & { default: number } = { default: 0.8, morning: 1.4, wall: 1.0 };

function makeVignette() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.08);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(12,6,0,.42)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  return c;
}

/** A tile of fixed noise; shifting it by a step of film time gives grain that is the same at the same t. */
function makeGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  const img = x.createImageData(256, 256);
  let seed = 1;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const v = (seed / 2147483647) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

export const create: CreateRenderer = (film) => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  const under = document.createElement('canvas');
  under.width = W;
  under.height = H;
  const u = under.getContext('2d') as CanvasRenderingContext2D;
  const stage = new Stage();
  const vignette = makeVignette();
  const grain = makeGrain();
  const grainPattern = c.createPattern(grain, 'repeat') as CanvasPattern;
  const scenes = new Map<ShotId, Scene>();
  const panels = new Map<ShotId, HTMLCanvasElement>();
  let mine: readonly Shot[] = [];

  async function scene(id: ShotId) {
    let sc = scenes.get(id);
    if (!sc) {
      const d = DIRECTION[id];
      sc = await loadScene(id, { paper: (s) => !!d.paper?.(s.id), gold: (s) => !!d.gold?.(s.id) });
      const { layers: _layers, ...extra } = sc.manifest;
      prepare(id, extra);
      scenes.set(id, sc);
    }
    return sc;
  }

  function drawShot(ctx: CanvasRenderingContext2D, s: Shot, tl: number) {
    const sc = scenes.get(s.id);
    if (!sc) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = s.part ? '#0d0b10' : '#e6d3ad';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    stage.drawShot(ctx, sc, DIRECTION[s.id], s, tl);
  }

  return {
    canvas,
    async load(shots) {
      mine = shots;
      // Every shot's pieces before the first frame, so no frame is drawn half-loaded.
      await Promise.all(shots.map((s) => scene(s.id)));
      // Draw each shot once off screen, so its pictures are on the graphics chip before the film reaches it
      // and the first frame of a shot does not stall.
      for (const s of shots) drawShot(u, s, s.len * 0.5);
      u.getImageData(0, 0, 1, 1);
    },
    draw(t) {
      const first = mine[0], last = mine[mine.length - 1];
      if (!first) return;
      const s = t < first.at ? first : t >= last.at + last.len ? last : film.at(t);
      const tl = Math.min(t, last.at + last.len + SEAM) - s.at;
      const before = mine.find((m) => m.n === s.n - 1);
      const fade = FADE[s.id] ?? FADE.default;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      if (before && tl < fade) {
        // The new shot drawn whole on its own canvas, then dissolved over the old one, so its pieces never show through each other.
        drawShot(c, before, before.len + tl);
        drawShot(u, s, tl);
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalAlpha = ease(tl / fade);
        c.drawImage(under, 0, 0);
        c.globalAlpha = 1;
      } else {
        drawShot(c, s, tl);
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(vignette, 0, 0);
      // Grain: the tile jumps to a new place twelve times a second of film time.
      const step = Math.floor(t * 12);
      c.globalCompositeOperation = 'overlay';
      c.globalAlpha = 0.07;
      c.translate(((step * 97) % 256), ((step * 61) % 256));
      c.fillStyle = grainPattern;
      c.fillRect(-256, -256, W + 256, H + 256);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    },
    ready: (id) => scenes.has(id),
    panel(id) {
      const shot = film.shot(id);
      const sc = scenes.get(id);
      if (!shot || !sc || shot.part !== 0) return null;
      let p = panels.get(id);
      if (!p) {
        p = document.createElement('canvas');
        p.width = W;
        p.height = H;
        const ctx = p.getContext('2d') as CanvasRenderingContext2D;
        // The whole panel, finished, square on: every piece at rest at the end of its shot, the frame's middle.
        const [fw, fh] = sc.manifest.frame;
        stage.drawShot(ctx, sc, DIRECTION[id], shot, shot.len, true, { x: fw / 2, y: fh / 2, zoom: 1 });
        panels.set(id, p);
      }
      return p;
    },
    dispose() {
      scenes.clear();
      panels.clear();
      canvas.width = canvas.height = 0;
    },
  };
};
