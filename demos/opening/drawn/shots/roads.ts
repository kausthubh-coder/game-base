// Shot 4, roads of light. Seven cities on a green land in a lapis sea. Roads of light draw themselves out from
// the king's city to the six around it, then round the ring from city to city, the last arriving by `lit`.
// When a road reaches a city, the small stones at its people's throats light. Ships ride the swell.
import { type Cam, type Ctx, H, W, blob, bloom, camLerp, curve, dabs, ease, glow, hash, look, reset, rng, smooth, span, frac } from '../kit/core.ts';
import { type Doorway, tree, town } from '../kit/city.ts';
import { Fresco, INK, P, bands, composePanel, ellipseAt, flower } from '../kit/fresco.ts';
import { gold } from '../kit/live.ts';
import { FULL, type MakePainter, drawPanel, pause, sheen, stillOf } from '../kit/shot.ts';

const C = { x: 960, y: 560 };
const RING = { rx: 380, ry: 300 };
const CITY_R = [92, 70];
const ANG = [-90, -30, 30, 90, 150, 210].map((d) => (d * Math.PI) / 180);
const CITIES = [C, ...ANG.map((a) => ({ x: C.x + Math.cos(a) * RING.rx, y: C.y + Math.sin(a) * RING.ry }))];

interface Road { a: number; b: number; from: number; to: number; ax: number; ay: number; bx: number; by: number }

export const roads: MakePainter = (env) => {
  const scale = 1.5;
  let panel: HTMLCanvasElement;
  let goldMask: HTMLCanvasElement;
  const towns: Doorway[] = [];
  const list: Road[] = [];
  const ships: { img: HTMLCanvasElement; x: number; y: number; w: number; seed: number }[] = [];
  const lamps: [number, number][] = [];
  let townLayer: Fresco;

  async function build() {
    const f = new Fresco(W, H, scale);
    const r = rng(44);
    bands(f, r);
    // The sea, with white curls of wave.
    const sea = blob(C.x, C.y + 10, 700, 510, r, 0.05, 28);
    const sg = f.p.createRadialGradient(C.x, C.y, 300, C.x, C.y, 720);
    sg.addColorStop(0, '#2f63c4');
    sg.addColorStop(1, '#1f4a9e');
    f.fill(sea, sg, 0);
    const curls = new Path2D();
    for (let i = 0; i < 90; i++) {
      const a = r() * Math.PI * 2;
      const d = 0.86 + r() * 0.16;
      const x = C.x + Math.cos(a) * 690 * d;
      const y = C.y + 10 + Math.sin(a) * 500 * d;
      curls.moveTo(x - 14, y + 3);
      curls.quadraticCurveTo(x - 6, y - 7, x + 3, y - 2);
      curls.quadraticCurveTo(x + 6, y + 2, x + 1, y + 3);
      curls.moveTo(x + 6, y + 3);
      curls.quadraticCurveTo(x + 13, y - 3, x + 20, y + 3);
    }
    f.line(curls, 'rgba(245,250,255,0.85)', 2.4);
    // The land, with a gold shore.
    const land = blob(C.x, C.y, 560, 430, r, 0.04, 30);
    const lg = f.p.createRadialGradient(C.x, C.y - 40, 60, C.x, C.y, 560);
    lg.addColorStop(0, '#6cb04a');
    lg.addColorStop(1, '#3f8a34');
    f.fill(land, lg, 0);
    f.save();
    f.clip(land);
    dabs(f.p, r, 2600, () => [C.x + (r() - 0.5) * 1120, C.y + (r() - 0.5) * 880], ['#6cb04a', '#4a9038', '#5aa040', '#78b856'], [4, 11], [0.06, 0.18], 2.2);
    const grass = new Path2D();
    for (let i = 0; i < 900; i++) {
      const gx = C.x + (r() - 0.5) * 1100;
      const gy = C.y + (r() - 0.5) * 860;
      grass.moveTo(gx, gy);
      grass.lineTo(gx + (r() - 0.5) * 4, gy - 5 - r() * 6);
    }
    f.line(grass, 'rgba(40,100,40,0.45)', 1.2);
    f.restore();
    f.save();
    f.clip(sea);
    dabs(f.p, r, 1400, () => [C.x + (r() - 0.5) * 1420, C.y + (r() - 0.5) * 1040], ['#3a72d0', '#24509e', '#2a5cb8', '#4a82dc'], [5, 14], [0.08, 0.22], 2.6);
    f.restore();
    f.gildLine(land, 6);
    await pause();
    // Fields of wheat, flower beds, trees, everything but where roads and towns go.
    const clear = (x: number, y: number, m: number) =>
      CITIES.every((c, i) => Math.hypot(x - c.x, (y - c.y) * 1.2) > CITY_R[i ? 1 : 0] + 50 + m) && farFromRoads(x, y, 26 + m);
    for (let i = 0; i < 26; i++) {
      const x = C.x + (r() - 0.5) * 980;
      const y = C.y + (r() - 0.5) * 760;
      if (Math.hypot((x - C.x) / 520, (y - C.y) / 395) > 1 || !clear(x, y, 30)) continue;
      const field = blob(x, y, 46 + r() * 20, 22 + r() * 10, r, 0.1, 10);
      f.fill(field, '#e2b84a', 1);
      const rows = new Path2D();
      for (let k = -4; k <= 4; k++) {
        rows.moveTo(x - 40 + k * 3, y + k * 4 - 6);
        rows.lineTo(x + 40 + k * 3, y + k * 4 - 14);
      }
      f.save();
      f.clip(field);
      f.line(rows, '#b88a26', 1.4, 0.7);
      f.restore();
    }
    for (let i = 0; i < 160; i++) {
      const x = C.x + (r() - 0.5) * 1060;
      const y = C.y + (r() - 0.5) * 820;
      if (Math.hypot((x - C.x) / 525, (y - C.y) / 400) > 0.98 || !clear(x, y, 0)) continue;
      const k = r();
      if (k < 0.35) tree(f, x, y, 0.75 + r() * 0.3, 'orange', r);
      else if (k < 0.6) tree(f, x, y, 0.8 + r() * 0.3, 'cypress', r);
      else if (k < 0.75) tree(f, x, y, 0.7, 'blossom', r);
      else flower(f, x, y, 22, [P.red, P.white, P.red][Math.floor(r() * 3)], r);
    }
    await pause();
    // The roads' beds: a faint path the light will run along, so the land does not look cut.
    for (const road of plan()) {
      const p = new Path2D();
      p.moveTo(road.ax, road.ay);
      p.lineTo(road.bx, road.by);
      f.line(p, 'rgba(120,150,70,0.6)', 18);
      list.push(road);
      // Lamps along it.
      for (const k of [0.33, 0.66]) {
        const lx = road.ax + (road.bx - road.ax) * k + 22;
        const ly = road.ay + (road.by - road.ay) * k - 6;
        const post = new Path2D();
        post.moveTo(lx, ly + 16);
        post.lineTo(lx, ly - 14);
        f.line(post, INK, 3.4, 0.8);
        f.line(post, '#c8963a', 2);
        f.gild(ellipseAt(lx, ly - 18, 5, 6, 0), 1);
        lamps.push([lx, ly - 18]);
      }
    }
    // The towns, the king's the biggest, on their own layer over the roads.
    const tf = new Fresco(W, H, scale);
    CITIES.forEach((c, i) => towns.push(town(tf, c.x, c.y + (i ? 20 : 30), i ? 0.62 : 0.88, 3 + i, i ? 2 : 3)));
    tf.temper();
    townLayer = tf;
    f.temper();
    panel = composePanel(f, 4, { cracks: 10 });
    goldMask = f.gold;
    await pause();
    // Ships, each its own picture so it can ride the swell.
    const spots = [[330, 330], [300, 610], [340, 860], [1590, 300], [1640, 600], [1570, 850]];
    spots.forEach(([x, y], i) => {
      const s = new Fresco(170, 150, scale);
      s.translate(85, 120);
      s.scaleBy(1.4);
      ship(s, 0, 0, i % 2 ? -1 : 1);
      s.temper();
      ships.push({ img: s.paint, x, y, w: 170, seed: i * 1.9 });
    });
  }

  function plan(): Road[] {
    const out: Road[] = [];
    const end = (a: number, b: number) => {
      const A = CITIES[a];
      const B = CITIES[b];
      const d = Math.hypot(B.x - A.x, B.y - A.y);
      const ra = a ? CITY_R[1] : CITY_R[0];
      const rb = b ? CITY_R[1] : CITY_R[0];
      return {
        ax: A.x + ((B.x - A.x) / d) * ra, ay: A.y + 20 + ((B.y - A.y) / d) * ra * 0.8,
        bx: B.x - ((B.x - A.x) / d) * rb, by: B.y + 20 - ((B.y - A.y) / d) * rb * 0.8,
      };
    };
    // Six spokes out from the middle, one after another, then the ring.
    for (let i = 0; i < 6; i++) out.push({ a: 0, b: i + 1, from: 0.06 + i * 0.045, to: 0.2 + i * 0.045, ...end(0, i + 1) });
    for (let i = 0; i < 6; i++) out.push({ a: i + 1, b: ((i + 1) % 6) + 1, from: 0.36 + i * 0.035, to: 0.425 + i * 0.035, ...end(i + 1, ((i + 1) % 6) + 1) });
    return out;
  }

  function farFromRoads(x: number, y: number, m: number): boolean {
    for (const road of plan()) {
      const dx = road.bx - road.ax;
      const dy = road.by - road.ay;
      const t = Math.max(0, Math.min(1, ((x - road.ax) * dx + (y - road.ay) * dy) / (dx * dx + dy * dy)));
      if (Math.hypot(x - road.ax - dx * t, y - road.ay - dy * t) < m) return false;
    }
    return true;
  }

  /** When each city's light comes on: the middle at once, the others when their first road arrives. */
  function lightOf(i: number, p: number, lit: number): number {
    if (i === 0) return 1;
    let first = 1;
    for (const r of list) if (r.b === i || r.a === i) first = Math.min(first, r.to);
    return span(p, first * (lit / 0.6) - 0.03, first * (lit / 0.6) + 0.1);
  }

  function scene(ctx: Ctx, tl: number, cam: Cam, p: number, litShare: number) {
    drawPanel(ctx, panel, cam);
    look(ctx, cam);
    for (const s of ships) {
      const bob = Math.sin(tl * 1.4 + s.seed) * 4;
      const roll = Math.sin(tl * 1.1 + s.seed * 2) * 0.05;
      ctx.translate(s.x, s.y + bob);
      ctx.rotate(roll);
      ctx.drawImage(s.img, -85, -120, 170, 150);
      ctx.rotate(-roll);
      ctx.translate(-s.x, -s.y - bob);
    }
    // The roads, drawn out to where they have got to.
    const k = litShare / 0.6;
    ctx.lineCap = 'round';
    const pat = gold(ctx);
    const head = glow('#ffe7a0', 0.4);
    for (const r of list) {
      const g = smooth((p - r.from * k) / ((r.to - r.from) * k));
      if (g <= 0) continue;
      const ex = r.ax + (r.bx - r.ax) * g;
      const ey = r.ay + (r.by - r.ay) * g;
      ctx.beginPath();
      ctx.moveTo(r.ax, r.ay);
      ctx.lineTo(ex, ey);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,214,110,0.28)';
      ctx.lineWidth = 34;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#a8761e';
      ctx.lineWidth = 15;
      ctx.stroke();
      ctx.strokeStyle = pat;
      ctx.lineWidth = 11;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,250,220,0.8)';
      ctx.lineWidth = 2.4;
      ctx.stroke();
      // The bright tip of the road swells in as it sets off and fades as it arrives.
      const tip = smooth(g / 0.1) * (1 - smooth((g - 0.8) / 0.2));
      if (tip > 0) {
        ctx.globalCompositeOperation = 'lighter';
        bloom(ctx, head, ex, ey, 46, 0.95 * tip);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.drawImage(townLayer.paint, 0, 0, W, H);
    // Lamps and stones, alight once their road has come.
    ctx.globalCompositeOperation = 'lighter';
    const lamp = glow('#ffd77a', 0.3);
    for (let i = 0; i < lamps.length; i++) {
      const road = list[Math.floor(i / 2)];
      const on = smooth((p - (road.from + (road.to - road.from) * (i % 2 ? 0.66 : 0.33)) * k) / 0.1);
      bloom(ctx, lamp, lamps[i][0], lamps[i][1], 26 + Math.sin(tl * 3 + i) * 2, on * 0.8);
    }
    const stone = glow('#fff2b8', 0.45);
    towns.forEach((t, i) => {
      const on = lightOf(i, p, litShare);
      for (let s = 0; s < t.stones.length; s++) {
        const pulse = 0.85 + 0.15 * Math.sin(tl * 2.6 + i + s * 1.7);
        bloom(ctx, stone, t.stones[s][0], t.stones[s][1], 22 * pulse, on);
      }
      bloom(ctx, lamp, t.x, t.y + 10, 120, on * 0.18);
    });
    // A few motes of light on the roads, running outward.
    for (let i = 0; i < 30; i++) {
      const road = list[i % list.length];
      const done = smooth((p - road.to * k) / 0.05);
      if (done <= 0) continue;
      const ph = frac(tl * 0.35 + hash(i));
      bloom(ctx, head, road.ax + (road.bx - road.ax) * ph, road.ay + (road.by - road.ay) * ph, 10, done * Math.sin(ph * Math.PI) * 0.8);
    }
    reset(ctx);
  }

  return {
    build,
    draw(ctx, tl, shot) {
      const p = tl / shot.len;
      const lit = shot.beats.lit / shot.len;
      const cam = camLerp({ x: C.x, y: C.y - 10, zoom: 1.75 }, { x: C.x, y: C.y - 10, zoom: 1.04 }, ease(p / lit));
      cam.zoom -= 0.03 * span(p, lit, 1.2);
      scene(ctx, tl, cam, p, lit);
      sheen(env, ctx, cam, [{ mask: goldMask, x: 0, y: 0, w: W, h: H }, { mask: townLayer.gold, x: 0, y: 0, w: W, h: H }], span(p, lit - 0.05, 1.1), 0.35 * span(p, lit - 0.1, lit), 0.04);
    },
    still: () => stillOf((ctx) => scene(ctx, 5, FULL, 1, 0.6)),
  };
};

/** A little ship with a white sail, facing d. */
function ship(f: Fresco, x: number, y: number, d: 1 | -1): void {
  const hull = curve([[x - 40 * d, y - 14], [x + 42 * d, y - 16], [x + 30 * d, y + 4], [x - 28 * d, y + 4]]);
  f.gild(hull, 1.5);
  const mast = new Path2D();
  mast.moveTo(x, y - 14);
  mast.lineTo(x, y - 74);
  f.line(mast, INK, 3, 0.9);
  const sail = curve([[x + 2 * d, y - 70], [x + 30 * d, y - 52], [x + 34 * d, y - 30], [x + 4 * d, y - 22]]);
  f.fill(sail, '#fbf6ea', 1.4);
  const flag = new Path2D();
  flag.moveTo(x, y - 74);
  flag.lineTo(x - 16 * d, y - 70);
  flag.lineTo(x, y - 66);
  f.fill(flag, '#e8b84a', 0.8);
}

