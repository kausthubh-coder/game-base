// The drawn way: every frame of the film painted by code, with no picture files. The legend is a temple
// fresco that moves; the last three shots are in the game's painted look. Each shot is one file in shots/,
// built on the kit in kit/. A shot paints what does not move once at load and draws the rest from film time.
import type { CreateRenderer, Shot, ShotId } from '../types.ts';
import { type Ctx, H, W, canvas, finish, lerp, makeFinish, reset, smooth } from './kit/core.ts';
import type { Env, MakePainter, Painter } from './kit/shot.ts';
import { doorstep } from './shots/doorstep.ts';
import { friends } from './shots/friends.ts';
import { gods } from './shots/gods.ts';
import { king } from './shots/king.ts';
import { mark } from './shots/mark.ts';
import { morning } from './shots/morning.ts';
import { night } from './shots/night.ts';
import { roads } from './shots/roads.ts';
import { sickness } from './shots/sickness.ts';
import { wall } from './shots/wall.ts';
import { war } from './shots/war.ts';

const SHOTS: Record<ShotId, MakePainter> = { war, king, friends, roads, sickness, night, gods, mark, wall, doorstep, morning };

/** Seconds of the dissolve into each shot, centred on the shot's start. */
const DISSOLVE: Partial<Record<ShotId, number>> = { wall: 0.8, doorstep: 1.0, morning: 1.0 };
const LEGEND_DISSOLVE = 0.7;

export const create: CreateRenderer = (film) => {
  const out = canvas(W, H);
  const ctx = out.ctx;
  const mixer = canvas(W, H).ctx;
  const env: Env = {
    film,
    finish: makeFinish(ctx),
    scratch: canvas(W, H).ctx,
    scratch2: canvas(W, H).ctx,
    painter,
  };
  const painters = new Map<ShotId, Promise<Painter>>();
  const ready = new Map<ShotId, Painter>();
  const stills = new Map<ShotId, HTMLCanvasElement>();
  let mine: readonly Shot[] = [];

  function painter(id: ShotId): Promise<Painter> {
    let p = painters.get(id);
    if (!p) {
      const made = SHOTS[id](env);
      p = made.build().then(() => {
        ready.set(id, made);
        return made;
      });
      painters.set(id, p);
    }
    return p;
  }

  function drawShot(target: Ctx, s: Shot, t: number): void {
    const p = ready.get(s.id);
    reset(target);
    if (!p) {
      target.fillStyle = s.part ? '#101425' : '#f2e3c6';
      target.fillRect(0, 0, W, H);
      return;
    }
    p.draw(target, t - s.at, s);
    reset(target);
  }

  const way = {
    canvas: out.canvas,
    async load(shots: readonly Shot[]) {
      mine = shots;
      for (const s of shots) await painter(s.id);
      // Draw every shot once at a few moments, dissolves too, so the first real frame of each draws no slower
      // than the rest: the graphics chip makes its programs the first time a kind of drawing is used.
      for (const s of shots) {
        for (const k of [-0.05, 0.1, 0.5, 0.8, 0.98, 1.02]) way.draw(s.at + s.len * k);
      }
    },
    draw(t: number) {
      if (!mine.length) return;
      const first = mine[0];
      const last = mine[mine.length - 1];
      let s = t >= last.at ? last : film.at(t);
      if (t < first.at) s = first;
      const i = mine.indexOf(s);
      const prev = i > 0 ? mine[i - 1] : null;
      const next = i >= 0 && i < mine.length - 1 ? mine[i + 1] : null;
      const into = (x: Shot) => DISSOLVE[x.id] ?? LEGEND_DISSOLVE;
      let a = s;
      let b: Shot | null = null;
      let k = 0;
      if (prev && t - s.at < into(s) / 2) {
        a = prev;
        b = s;
        k = (t - s.at + into(s) / 2) / into(s);
      } else if (next && next.at - t < into(next) / 2) {
        b = next;
        k = (t - next.at + into(next) / 2) / into(next);
      }
      drawShot(ctx, a, t);
      if (b) {
        drawShot(mixer, b, t);
        ctx.globalAlpha = smooth(k);
        ctx.drawImage(mixer.canvas, 0, 0);
        ctx.globalAlpha = 1;
      }
      const cool = b ? lerp(a.part, b.part, smooth(k)) : a.part;
      finish(ctx, env.finish, t, lerp(0.05, 0.07, cool), cool);
    },
    panel(id: ShotId) {
      const have = stills.get(id);
      if (have) return have;
      const p = ready.get(id);
      const still = p?.still?.() ?? null;
      if (still) stills.set(id, still);
      return still;
    },
    dispose() {
      ready.clear();
      painters.clear();
      stills.clear();
      out.canvas.width = 1;
      mixer.canvas.width = 1;
      env.scratch.canvas.width = 1;
      env.scratch2.canvas.width = 1;
    },
  };
  return way;
};
