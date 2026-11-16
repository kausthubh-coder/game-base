// Shot 1, the war. The temple wall paints itself in: first the red underdrawing, then the colour in brush
// strokes spreading out from the spring, all done by the beat `painted`. Six armies under six banners face each
// other across a spring of light. The banners stir and the spring pulses.
import { type Cam, type Ctx, H, W, bloom, camLerp, canvas, ease, glow, hash, look, reset, rng, shade, span, frac } from '../kit/core.ts';
import { type Person, person } from '../kit/figure.ts';
import { Fresco, P, PEOPLES, bands, cracks, flower, ground, plasterUnder, rays } from '../kit/fresco.ts';
import { banner } from '../kit/live.ts';
import { FULL, type MakePainter, drawPanel, pause, sheen, stillOf } from '../kit/shot.ts';

const GROUND = 862;
const NO_DASH: number[] = [];
const SPRING = { x: 960, y: 846 };
const HAIR = [P.hairDark, P.hairBrown, P.hairAuburn, P.hairBlond, P.hairDark, P.hairBrown];
const STYLES = ['short', 'curly', 'bun', 'messy', 'braid', 'short'] as const;

/** Leaders stand nearest the spring; each army's banner flies from its leader's pole. */
const LEADER_X = [430, 640, 850, 1070, 1280, 1490];
const LEADER_H = 330;

interface Pole { x: number; y: number; out: number; color: string; dark: string; motif: (typeof PEOPLES)[number]['motif']; seed: number }

export const war: MakePainter = (env) => {
  const scale = 1.2;
  let bare: HTMLCanvasElement;
  let art: Fresco;
  let full: HTMLCanvasElement;
  const poles: Pole[] = [];
  /** Brush strokes of the paint-in, in the order they are laid. */
  const strokes: { path: Path2D; at: number; len: number; width: number }[] = [];
  const dash = [0, 4000];

  async function build() {
    const { canvas: b, ctx } = canvas(W * scale, H * scale);
    plasterUnder(ctx, scale, 1);
    ctx.save();
    ctx.scale(scale, scale);
    cracks(ctx, rng(41), 9);
    ctx.restore();
    bare = b;
    await pause();

    art = new Fresco(W, H, scale, true);
    const r = rng(17);
    bands(art, r);
    // The spring's rays fan up behind the armies.
    rays(art, SPRING.x, SPRING.y - 40, 23, 120, 780, -Math.PI * 0.88, -Math.PI * 0.12, 2.6);
    ground(art, 200, 1720, GROUND, r);
    // The ranks behind, all of them first, a little higher on the wall as a painter shows depth.
    for (let side = 0; side < 6; side++) {
      const left = side < 3;
      const dir = left ? 1 : -1;
      for (let k = 3; k >= 1; k--) {
        const who: Person = {
          robe: shade(PEOPLES[side].robe, -0.06 * k),
          motif: PEOPLES[side].motif,
          hair: HAIR[(side + k) % 6],
          style: STYLES[(side * 2 + k) % 6],
          look: 0.55,
          hold: 'spear',
          flip: !left,
          halo: k === 1,
          seed: side * 10 + k,
        };
        person(art, LEADER_X[side] - dir * (k * 50 + 4), GROUND - 4 - (k % 2) * 6, LEADER_H * (0.86 - k * 0.025), who);
      }
    }
    await pause();
    for (let side = 0; side < 6; side++) {
      const left = side < 3;
      const dir = left ? 1 : -1;
      const lx = LEADER_X[side];
      const people = PEOPLES[side];
      const leader: Person = {
        robe: people.robe,
        motif: people.motif,
        hair: HAIR[side],
        style: STYLES[side],
        look: 0.6,
        gaze: 0.25,
        hold: 'pole',
        halo: true,
        flip: !left,
        seed: side * 10,
      };
      person(art, lx, GROUND, LEADER_H, leader);
      const u = LEADER_H / 100;
      poles.push({ x: lx + dir * 13.5 * u, y: GROUND - 150 * u + 10, out: -dir, color: people.robe, dark: shade(people.robe, -0.45), motif: people.motif, seed: side * 1.7 });
    }
    await pause();
    // The spring: a pool of light in a ring of stones, and the jet painted in pale gold.
    const s = art;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (i / 8);
      const stone = new Path2D();
      stone.ellipse(SPRING.x + Math.cos(a) * 70, GROUND - 4 - Math.abs(Math.sin(a)) * 4, 15, 9, 0, 0, Math.PI * 2);
      s.gild(stone, 1);
    }
    for (const [dx, h] of [[0, 330], [-26, 200], [26, 210], [-50, 120], [50, 130]] as const) {
      const jet = new Path2D();
      jet.moveTo(SPRING.x + dx * 0.3 - 5, GROUND - 10);
      jet.quadraticCurveTo(SPRING.x + dx * 0.6, GROUND - h, SPRING.x + dx * 1.6, GROUND - h * 0.45);
      jet.quadraticCurveTo(SPRING.x + dx * 0.6, GROUND - h * 0.86, SPRING.x + dx * 0.3 + 5, GROUND - 10);
      s.fill(jet, 'rgba(255,250,225,0.9)', 0);
    }
    for (let x = 220; x < 1710; x += 46 + r() * 40) {
      if (Math.abs(x - SPRING.x) < 95) continue;
      flower(art, x, GROUND, 24 + r() * 10, [P.white, P.red, P.white, P.gold][Math.floor(r() * 4)], r);
    }
    art.temper();
    // The finished panel: plaster, paint, cracks through it.
    const { canvas: done, ctx: d } = canvas(W * scale, H * scale);
    d.drawImage(bare, 0, 0);
    d.globalAlpha = 0.95;
    d.drawImage(art.paint, 0, 0);
    d.globalAlpha = 1;
    d.scale(scale, scale);
    cracks(d, rng(42), 6);
    full = done;

    // Brush strokes over the painted area, laid outward from the spring.
    const sr = rng(5);
    const list: { path: Path2D; d: number; len: number; width: number }[] = [];
    for (let y = 60; y < 1020; y += 40) {
      for (let x = 150; x < 1790; x += 175) {
        const cx = x + (sr() - 0.5) * 80;
        const cy = y + (sr() - 0.5) * 30;
        const a = (sr() - 0.5) * 0.6;
        const len = 180 + sr() * 80;
        const p = new Path2D();
        const x0 = cx - Math.cos(a) * len * 0.5;
        const y0 = cy - Math.sin(a) * len * 0.5;
        p.moveTo(x0, y0);
        p.quadraticCurveTo(cx + (sr() - 0.5) * 40, cy + (sr() - 0.5) * 40, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len);
        const dist = Math.hypot(cx - SPRING.x, (cy - (SPRING.y - 250)) * 1.4);
        list.push({ path: p, d: dist + sr() * 160, len: len * 1.2, width: 46 + sr() * 14 });
      }
    }
    list.sort((a, b) => a.d - b.d);
    // Laid from q 0.18 to 0.74, each over a fifth of the paint-in, so the last is done by 0.95.
    list.forEach((s, i) => strokes.push({ path: s.path, at: 0.18 + (i / list.length) * 0.56, len: s.len, width: s.width }));
  }

  function camAt(p: number): Cam {
    return camLerp({ x: 960, y: 610, zoom: 1.16 }, { x: 960, y: 560, zoom: 1.02 }, ease(p));
  }

  function spring(ctx: Ctx, tl: number, k: number) {
    const pulse = 0.75 + 0.25 * Math.sin(tl * 2.4) + 0.08 * Math.sin(tl * 5.3);
    ctx.globalCompositeOperation = 'lighter';
    bloom(ctx, glow('#ffd66a', 0.3), SPRING.x, SPRING.y - 30, 150 * pulse, 0.55 * k);
    bloom(ctx, glow('#fff3c0', 0.5), SPRING.x, SPRING.y - 120, 90 * pulse, 0.4 * k);
    // Drops of light thrown up and falling, each from its index and t.
    const g = glow('#ffe9a0', 0.4);
    for (let i = 0; i < 46; i++) {
      const life = 1.6 + hash(i) * 0.9;
      const ph = frac((tl + hash(i + 3) * 7) / life);
      const side = hash(i + 9) < 0.5 ? -1 : 1;
      const vx = side * (10 + hash(i + 5) * 70);
      const h = 120 + hash(i + 7) * 220;
      const x = SPRING.x + vx * ph;
      const y = SPRING.y - 14 - h * 4 * ph * (1 - ph);
      bloom(ctx, g, x, y, 7 + hash(i + 11) * 6, (1 - ph) * 0.9 * k);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function scene(ctx: Ctx, tl: number, cam: Cam, k: number) {
    // Paint, banners and spring, through the camera.
    drawPanel(ctx, full, cam);
    look(ctx, cam);
    for (const p of poles) banner(ctx, p.x, p.y, p.out, 175, 70, p.color, p.dark, p.motif, tl, 1, p.seed);
    spring(ctx, tl, k);
    reset(ctx);
  }

  return {
    build,
    draw(ctx, tl, shot) {
      const p = tl / shot.len;
      const cam = camAt(p);
      const painted = shot.beats.painted;
      const q = tl / painted;
      if (q >= 1) {
        scene(ctx, tl, cam, 1);
        sheen(env, ctx, cam, [{ mask: art.gold, x: 0, y: 0, w: W, h: H }], span(tl, painted, shot.len + 0.6), 0.55 * span(q, 1, 1.1), 0.08 * span(q, 1, 1.15));
        return;
      }
      // The bare wall, then the underdrawing wiping in from the middle.
      drawPanel(ctx, bare, cam);
      const sk = span(q, 0, 0.42);
      if (sk > 0 && art.sinopia) {
        const s2 = env.scratch2;
        reset(s2);
        s2.clearRect(0, 0, W, H);
        look(s2, cam);
        s2.drawImage(art.sinopia, 0, 0, W, H);
        reset(s2);
        s2.globalCompositeOperation = 'destination-in';
        const half = sk * W * 0.62;
        s2.fillStyle = '#fff';
        s2.fillRect(W / 2 - half, 0, half * 2, H);
        reset(ctx);
        ctx.globalAlpha = 0.9 * (1 - span(q, 0.75, 1));
        ctx.drawImage(s2.canvas, 0, 0);
        ctx.globalAlpha = 1;
      }
      // The colour, under a mask of brush strokes.
      const m = env.scratch2;
      reset(m);
      m.clearRect(0, 0, W, H);
      look(m, cam);
      m.strokeStyle = '#fff';
      m.lineCap = 'round';
      let any = false;
      for (const s of strokes) {
        const g = (q - s.at) / 0.21;
        if (g <= 0) continue;
        any = true;
        dash[0] = Math.min(1, g) * s.len;
        m.setLineDash(dash);
        m.lineWidth = s.width;
        m.stroke(s.path);
      }
      m.setLineDash(NO_DASH);
      m.fillStyle = '#fff';
      m.fillRect(0, 0, W, 36);
      m.fillRect(0, H - 36, W, 36);
      reset(m);
      const c = env.scratch;
      reset(c);
      c.clearRect(0, 0, W, H);
      look(c, cam);
      c.globalAlpha = 0.95;
      c.drawImage(art.paint, 0, 0, W, H);
      c.globalAlpha = 1;
      if (any) for (const p of poles) banner(c, p.x, p.y, p.out, 175, 70, p.color, p.dark, p.motif, tl, 1, p.seed);
      reset(c);
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(m.canvas, 0, 0);
      reset(c);
      reset(ctx);
      ctx.drawImage(c.canvas, 0, 0);
      // The last gaps between strokes fill softly before the beat, so the finished wall never snaps in.
      const close = span(q, 0.82, 0.99);
      if (close > 0) {
        look(ctx, cam);
        ctx.globalAlpha = close;
        ctx.drawImage(full, 0, 0, W, H);
        for (const p of poles) banner(ctx, p.x, p.y, p.out, 175, 70, p.color, p.dark, p.motif, tl, 1, p.seed, close);
        reset(ctx);
      }
      look(ctx, cam);
      spring(ctx, tl, span(q, 0.15, 0.6));
      reset(ctx);
    },
    still: () => stillOf((ctx) => scene(ctx, 6, FULL, 1)),
  };
};
