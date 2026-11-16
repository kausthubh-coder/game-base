// The direction of each shot: where the camera goes, how each piece hinges, swaps and lights, all as a share
// of the shot or a beat from film.ts. Ids are the layer ids in cutout/art/<shot>/layers.json.
//
// The legend is a paper theatre on a plastered wall: pieces are laid on and lifted off, hinge on their pivots,
// cloth swaps its drawings, and a slow light runs over the gold. The three shots of you are painted planes at
// their depths, under candle light, rain and morning sun.
import type { ShotId } from '../types.ts';
import { clamp, cycle, ease, flicker, land, mix, ramp, rnd, settle, wave } from './motion.ts';
import { roads } from './scene.ts';
import { H, W, type Direction, type Kit, type Pose } from './stage.ts';

const has = (...ids: string[]) => (id: string) => ids.some((x) => id === x || id.startsWith(`${x}-`));
/** A bump that peaks at `at` and is gone `wide` seconds either side. */
const bump = (t: number, at: number, wide: number) => Math.exp(-(((t - at) / wide) ** 2));
/** A band of light that crosses the frame from x `from` to `to` over the shot. */
const sweep = (k: Kit, from: number, to: number, strength: number, angle = 0.38, width = 280) =>
  ({ kind: 'band', angle, at: mix(from, to, k.tl / k.s.len), width, strength }) as const;

/** Motes of gold dust drifting in the light, in screen space, fixed by index. */
function motes(k: Kit, n: number, alpha: number, rise = 14, area: [number, number, number, number] = [0, 0, W, H]) {
  const { c, tl } = k;
  c.globalCompositeOperation = 'lighter';
  const [x0, y0, w, h] = area;
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd(i, 1) * w + Math.sin(tl * 0.35 + i) * 18;
    const y = y0 + ((((rnd(i, 2) * h - tl * (rise * (0.5 + rnd(i, 3)))) % h) + h) % h);
    k.spark(x, y, 5 + rnd(i, 4) * 7, alpha * (0.35 + 0.5 * (0.5 + 0.5 * Math.sin(tl * 1.3 + i * 2.1))));
  }
  c.globalCompositeOperation = 'source-over';
}

function fill(k: Kit, colour: string, alpha: number, op: GlobalCompositeOperation = 'source-over') {
  if (alpha <= 0.002) return;
  k.c.globalCompositeOperation = op;
  k.c.globalAlpha = alpha;
  k.c.fillStyle = colour;
  k.c.fillRect(0, 0, W, H);
  k.c.globalCompositeOperation = 'source-over';
  k.c.globalAlpha = 1;
}

/** Darkens the frame away from a point: a spot of light or a candle's reach. */
function pool(k: Kit, x: number, y: number, inner: number, outer: number, colour: string, alpha: number) {
  const g = k.c.createRadialGradient(x, y, inner, x, y, outer);
  g.addColorStop(0, `rgba(${colour},0)`);
  g.addColorStop(1, `rgba(${colour},${alpha})`);
  k.c.fillStyle = g;
  k.c.globalAlpha = 1;
  k.c.fillRect(0, 0, W, H);
}

/** A piece laid onto the wall between a and b seconds: it comes down from above the wall and its shadow tightens. */
function laid(tl: number, a: number, b: number): Pose {
  const q = clamp((tl - a) / (b - a));
  const down = land(q);
  return { alpha: ease(q * 2.2), lift: 1 - down, sx: 1 + 0.06 * (1 - down), sy: 1 + 0.06 * (1 - down) };
}

// 1. The war. The wall lays itself in: the light of the spring, the spring, then the six armies from the
// middle out, each banner unfurling from its pole. Then the banners stir and the armies lean in.
const SIDES: Record<string, number> = { green: -1, red: -1, blue: -1, violet: 1, white: 1, grey: 1 };
const ORDER: Record<string, number> = { blue: 0, violet: 0, red: 1, white: 1, green: 2, grey: 2 };

const war: Direction = {
  flat: true,
  keys: [
    { at: 0, x: 958, y: 610, zoom: 1.3 },
    { at: 'painted', x: 960, y: 548, zoom: 1.04 },
    { at: 1, x: 960, y: 540, zoom: 1.0 },
  ],
  paper: has('group', 'banner'),
  gold: has('rays', 'spring', 'banner', 'group'),
  lights: (k) => [sweep(k, -400, 2600, 0.5)],
  pose(id, k) {
    const P = k.beat('painted'), tl = k.tl;
    if (id === 'rays') return { alpha: ramp(tl, 0, 0.32 * P), sx: mix(0.86, 1, land(tl / (0.4 * P))), sy: mix(0.86, 1, land(tl / (0.4 * P))), rot: 0.006 * wave(tl, 0.06) };
    if (id === 'spring-ground') return { alpha: ramp(tl, 0.06 * P, 0.24 * P) };
    if (id === 'spring') {
      const q = land((tl - 0.12 * P) / (0.32 * P));
      return { alpha: ramp(tl, 0.12 * P, 0.26 * P), sy: Math.max(0.05, q) * (1 + 0.012 * wave(tl, 0.8)), sx: mix(0.7, 1, q) };
    }
    const [kind, colour] = id.split('-');
    if (kind !== 'group' && kind !== 'banner') return;
    const start = (0.3 + 0.16 * ORDER[colour]) * P, len = 0.26 * P;
    const lay = laid(tl, start, start + len);
    const lean = SIDES[colour] * -0.012 * ramp(tl, P, k.s.len) + 0.004 * wave(tl, 0.19, ORDER[colour] * 0.3 + SIDES[colour] * 0.1);
    if (kind === 'group') return { ...lay, rot: lean };
    // The cloth unfurls from the pole once its army is down, then breathes through its three drawings.
    const u = land((tl - (start + 0.7 * len)) / (0.32 * P));
    const phase = rnd(ORDER[colour] * 2 + (SIDES[colour] > 0 ? 1 : 0), 7);
    return {
      ...lay,
      alpha: Math.min(lay.alpha ?? 1, ease(u * 3)),
      sx: (lay.sx ?? 1) * Math.max(0.04, u),
      rot: lean + 0.04 * wave(tl, 0.42, phase) * u,
      frame: cycle(tl, 3.4, 3, 0.4, phase * 3),
    };
  },
  over(k) {
    // Light wells up out of the spring.
    const P = k.beat('painted');
    const [x, y] = k.at(957, 610);
    const on = ramp(k.tl, 0.2 * P, 0.6 * P);
    k.c.globalCompositeOperation = 'lighter';
    k.spark(x, y, 420 * k.scale(), on * (0.32 + 0.08 * wave(k.tl, 0.7)));
    k.c.globalCompositeOperation = 'source-over';
    motes(k, 30, on * 0.7, 26, [x - 260 * k.scale(), 0, 520 * k.scale(), y]);
  },
};

// 2. The farm boy. Six hands, raised high, hinge down from their cuffs and lower the crown; it comes to rest
// over his head on the beat with a small wobble. The six kneel lower as it lands.
const king: Direction = {
  flat: true,
  keys: [
    { at: 0, x: 960, y: 610, zoom: 1.08 },
    { at: 'crown', x: 958, y: 470, zoom: 1.34, stop: true },
    { at: 1, x: 958, y: 462, zoom: 1.38 },
  ],
  paper: has('person', 'hand', 'crown', 'boy'),
  gold: has('crown', 'rays', 'boy', 'hand', 'spring'),
  lights: (k) => {
    const C = k.beat('crown');
    return [sweep(k, -300, 2400, 0.45), { kind: 'pool', x: 960, y: 300, r: 460, strength: 0.4 * ramp(k.tl, C - 0.8, C) * (0.75 + 0.25 * wave(k.tl, 0.5)) }];
  },
  pose(id, k) {
    const C = k.beat('crown'), tl = k.tl;
    const up = ease(tl / C);
    if (id === 'crown') return { dy: -150 * (1 - up), rot: 0.05 * settle(tl, C, 1.4, 1.2), lift: 0.6 * (1 - up), shine: 0.7 * bump(tl, C, 0.45) };
    if (id.startsWith('hand-')) {
      const colour = id.slice(5);
      const side = SIDES[colour];
      // The left hands hinge at their left end, the right hands at their right end. Turning by `side` lifts the
      // free end, so each hand starts raised and comes down to rest with the crown.
      const lag = ORDER[colour] * 0.05 * C;
      const q = ease((tl - lag) / (C - lag));
      return { rot: side * 0.34 * (1 - q) + side * 0.012 * settle(tl, C, 1.4, 1), lift: 0.4 * (1 - q), alpha: ramp(tl, 0, 0.15 * C), shine: 0.3 * bump(tl, C, 0.5) };
    }
    if (id.startsWith('person-')) {
      const side = SIDES[id.slice(7)];
      return { rot: -side * (0.05 * ramp(tl, C - 0.5, C + 0.9) + 0.004 * wave(tl, 0.21, ORDER[id.slice(7)] * 0.2)) };
    }
    if (id === 'boy') return { sy: 1 + 0.004 * wave(tl, 0.3), shine: 0.2 * ramp(tl, C - 0.4, C + 0.4) };
    if (id === 'rays') return { alpha: 0.7 + 0.3 * ramp(tl, C - 0.8, C + 0.2), rot: 0.008 * wave(tl, 0.05) };
    if (id === 'spring') return { sy: 1 + 0.01 * wave(tl, 0.8) };
  },
  over(k) {
    const C = k.beat('crown');
    const [x, y] = k.at(960, 300);
    k.c.globalCompositeOperation = 'lighter';
    k.spark(x, y, 520 * k.scale(), 0.3 * bump(k.tl, C, 0.6));
    k.c.globalCompositeOperation = 'source-over';
    motes(k, 22, 0.55, 12);
  },
};

// 3. His friends. The camera walks along the six in gold and stops on the scraped place, then holds. The fox
// flicks its tail. Nobody remarks on the gap, but the light leaves it last.
const friends: Direction = {
  flat: true,
  keys: [
    { at: 0, x: 1276, y: 548, zoom: 1.55 },
    { at: 'scraped', x: 2534, y: 540, zoom: 1.6, stop: true },
    { at: 1, x: 2538, y: 545, zoom: 1.68 },
  ],
  paper: has('boy', 'friend', 'fox'),
  gold: has('boy', 'friend', 'rays'),
  lights: (k) => [{ kind: 'band', angle: 0.32, at: mix(900, 3200, k.tl / k.beat('scraped')) , width: 360, strength: 0.55 * (1 - ramp(k.tl, k.beat('scraped'), k.s.len)) }],
  pose(id, k) {
    const tl = k.tl;
    if (id === 'boy' || id.startsWith('friend-')) {
      const i = id === 'boy' ? 0 : 1 + 'green red blue violet white grey'.split(' ').indexOf(id.slice(7));
      return { sy: 1 + 0.004 * wave(tl, 0.24, i * 0.17), rot: 0.004 * wave(tl, 0.12, i * 0.31) };
    }
    if (id === 'fox') return { frame: cycle(tl, 0.9, 2, 0.45, 0.3) };
  },
  over(k) {
    // A still for the hall's wall is the painting itself, without the film's darkening round the gap.
    if (k.still) return;
    const S = k.beat('scraped');
    const [x, y] = k.at(2538, 560);
    const hold = ramp(k.tl, S - 0.3, S + 1.4);
    pool(k, x, y, 260 * k.scale(), 980 * k.scale(), '30,20,8', 0.42 * hold);
    // A little plaster dust still falls from the scraped place.
    const { c, tl } = k;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgb(236,226,204)';
    for (let i = 0; i < 14; i++) {
      const fall = (tl * (10 + rnd(i, 3) * 8) + rnd(i, 2) * 600) % 600;
      const [px, py] = k.at(2440 + rnd(i, 1) * 200, 260 + fall);
      c.globalAlpha = 0.5 * hold * Math.sin((fall / 600) * Math.PI);
      c.fillRect(px, py, 2.2, 2.2);
    }
    c.globalAlpha = 1;
  },
};

// 4. Roads of light. From the middle city six roads run out, one after another, each with a light at its head;
// each city brightens as its road arrives; the ring road joins them all on `lit`. Ships ride the swell.
interface Road { len: number; pts: Float32Array; path: Path2D }
let roadCache: Road[] | null = null;
function roadPaths(): Road[] {
  if (roadCache) return roadCache;
  roadCache = roads().paths.map((d) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('d', d);
    const len = el.getTotalLength();
    const n = Math.max(2, Math.ceil(len / 6));
    const pts = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const p = el.getPointAtLength((i / (n - 1)) * len);
      pts[i * 2] = p.x;
      pts[i * 2 + 1] = p.y;
    }
    return { len, pts, path: new Path2D(d) };
  });
  return roadCache;
}
/** How far along each road the light has run, 0 to 1. Spokes first, the ring last, all done on `lit`. */
function roadReach(k: Kit, i: number, count: number) {
  const L = k.beat('lit');
  if (i < count - 1) return land((k.tl - (0.04 + i * 0.075) * L) / (0.3 * L));
  return ease((k.tl - 0.56 * L) / (0.44 * L));
}
const CITY_AT_SPOKE = ['city-northwest', 'city-northeast', 'city-west', 'city-east', 'city-southwest', 'city-southeast'];

const roadsShot: Direction = {
  flat: true,
  keys: [
    { at: 0, x: 960, y: 520, zoom: 1.34 },
    { at: 'lit', x: 960, y: 538, zoom: 1.03, stop: true },
    { at: 1, x: 960, y: 540, zoom: 1.0 },
  ],
  paper: has('city', 'ship', 'island'),
  gold: has('roads', 'city'),
  lights: (k) => [sweep(k, -200, 2400, 0.4)],
  pose(id, k) {
    const tl = k.tl;
    if (id.startsWith('ship-')) {
      const i = Number(id.slice(5));
      return { rot: 0.045 * wave(tl, 0.33, i * 0.23), dy: 3 * wave(tl, 0.33, i * 0.23 + 0.25), dx: 1.5 * wave(tl, 0.17, i * 0.4) };
    }
    if (id === 'city-center') return { shine: 0.35 * ramp(tl, 0, 0.12 * k.beat('lit')) };
    const spoke = CITY_AT_SPOKE.indexOf(id);
    if (spoke >= 0) {
      const all = roadPaths().length;
      const reach = roadReach(k, spoke, all);
      const arrived = (k.tl - (0.04 + spoke * 0.075) * k.beat('lit')) - 0.3 * k.beat('lit');
      return { shine: (reach >= 1 ? 0.3 : 0) + 0.6 * (arrived > 0 ? Math.exp(-arrived * 2.4) : 0) };
    }
  },
  paint: {
    roads(k, piece, pose) {
      // The road layer, shown only where the light has run: each path stroked as far as it has reached, then
      // the painting cut to that stroke.
      const all = roadPaths();
      const x = k.scratch;
      const { x: lx, y: ly, w, h } = piece.spec;
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalCompositeOperation = 'source-over';
      x.globalAlpha = 1;
      x.clearRect(0, 0, w, h);
      x.setTransform(1, 0, 0, 1, -lx, -ly);
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.lineWidth = roads().strokeWidth * 1.7;
      x.strokeStyle = '#fff';
      all.forEach((r, i) => {
        const q = k.still ? 1 : roadReach(k, i, all.length);
        if (q <= 0) return;
        x.setLineDash([r.len * q, r.len * 2]);
        x.stroke(r.path);
      });
      x.setLineDash([]);
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.drawImage(piece.drawings[0], 0, 0, w, h);
      if (!k.place(piece, pose)) return;
      k.c.globalAlpha = pose.alpha ?? 1;
      k.c.drawImage(x.canvas, 0, 0, w, h, 0, 0, w, h);
    },
  },
  over(k) {
    if (k.still) return;
    const all = roadPaths();
    k.c.globalCompositeOperation = 'lighter';
    all.forEach((r, i) => {
      const q = roadReach(k, i, all.length);
      if (q <= 0 || q >= 1) return;
      const n = r.pts.length / 2;
      const j = Math.min(n - 1, Math.round(q * (n - 1)));
      const [x, y] = k.at(r.pts[j * 2], r.pts[j * 2 + 1]);
      const s = k.scale();
      k.spark(x, y, 90 * s, 0.95);
      k.spark(x, y, 34 * s, 1);
    });
    const [cx, cy] = k.at(960, 500);
    k.spark(cx, cy, 300 * k.scale(), 0.35 * ramp(k.tl, 0, 0.1 * k.beat('lit')));
    k.c.globalCompositeOperation = 'source-over';
  },
};

// 5. The sickness. The camera drifts along the rows to the king. One by one the throat stones gutter and go
// dim, the last on `dim`; the light runs cold and the king bows over the three graves.
const STONE_ORDER = [3, 6, 1, 8, 4, 2, 7, 5];
/** 1 while a stone burns, 0 once it has gone dim; it gutters in the half second before. */
function stoneLight(k: Kit, n: number) {
  const D = k.beat('dim');
  const at = mix(0.14 * k.s.len, D, STONE_ORDER.indexOf(n) / (STONE_ORDER.length - 1));
  if (k.tl < at - 0.55) return 1;
  if (k.tl >= at) return 0;
  const q = (k.tl - (at - 0.55)) / 0.55;
  return clamp((1 - q) * (0.55 + 0.45 * Math.sign(Math.sin(q * q * 38 + n))));
}

const sickness: Direction = {
  flat: true,
  keys: [
    { at: 0, x: 740, y: 520, zoom: 1.26 },
    { at: 0.55, x: 1060, y: 560, zoom: 1.2 },
    { at: 1, x: 1330, y: 590, zoom: 1.36 },
  ],
  paper: has('bed', 'king', 'grave'),
  gold: has('king', 'bed'),
  lights: (k) => [sweep(k, -300, 2300, 0.38 * (1 - ramp(k.tl, k.beat('dim') - 0.5, k.beat('dim') + 0.8)))],
  pose(id, k) {
    const tl = k.tl;
    if (id.startsWith('stone-')) return { frame: k.still ? 1 : 1 - stoneLight(k, Number(id.slice(6))) };
    if (id.startsWith('bed-')) return { sy: 1 + 0.003 * wave(tl, 0.18, Number(id.slice(4)) * 0.13) };
    if (id === 'king') return { rot: 0.025 * ramp(tl, 0.35 * k.s.len, k.s.len), sy: 1 + 0.004 * wave(tl, 0.16) };
  },
  over(k) {
    const D = k.beat('dim');
    k.c.globalCompositeOperation = 'lighter';
    for (let n = 1; n <= 8; n++) {
      const p = k.piece(`stone-${n}`);
      if (!p || k.still) continue;
      const on = stoneLight(k, n);
      const [x, y] = k.at(p.spec.x + p.spec.w / 2, p.spec.y + p.spec.h / 2);
      k.spark(x, y, 70 * k.scale(), on * (0.75 + 0.2 * flicker(k.tl, n)));
    }
    k.c.globalCompositeOperation = 'source-over';
    // The colour drains as the stones go out.
    fill(k, 'rgb(170,186,220)', 0.55 * ramp(k.tl, D - 0.6, D + 1.2), 'multiply');
    const [kx, ky] = k.at(1400, 640);
    pool(k, kx, ky, 300 * k.scale(), 1300 * k.scale(), '14,18,34', 0.38 * ramp(k.tl, D - 0.4, k.s.len));
  },
};

// 6. The night. The houses light in order; out of each, lights rise and stream to the king, who rises with
// them; the golden dome closes over the city from both sides and meets at the top on `dome`. Doors stand open.
const KING_AT: [number, number] = [957, 391];
function houseOn(k: Kit, i: number) { return k.beat('rise') + i * 0.04 * k.s.len; }

const night: Direction = {
  flat: true,
  keys: [
    { at: 0, x: 956, y: 640, zoom: 1.22 },
    { at: 'dome', x: 950, y: 566, zoom: 1.03, stop: true },
    { at: 1, x: 950, y: 562, zoom: 1.06 },
  ],
  paper: has('city', 'king'),
  gold: has('dome', 'king'),
  lights: (k) => [{ kind: 'band', angle: 0.25, at: mix(0, 2100, ramp(k.tl, k.beat('dome') - 0.6, k.s.len)), width: 320, strength: 0.6 * ramp(k.tl, k.beat('dome') - 0.6, k.beat('dome')) }],
  pose(id, k) {
    const tl = k.tl, R = k.beat('rise');
    if (id === 'king') return { dy: -28 * ease((tl - R) / (k.s.len - R)), shine: 0.4 * ramp(tl, R, k.beat('dome')) };
    if (id === 'stars') return { alpha: k.still ? 1 : ramp(tl, R + 0.1 * k.s.len, k.beat('dome')) };
  },
  paint: {
    dome(k, piece, pose) {
      // Two wedges sweep up from the dome's feet and meet at the apex.
      const q = k.still ? 1 : ramp(k.tl, 0.4 * k.s.len, k.beat('dome'));
      if (q <= 0) return;
      const meta = domeMeta;
      const [cx, cy] = meta?.center ?? [944, 876];
      const c = k.c;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      const [sx, sy] = k.at(cx, cy);
      const r = 1600 * k.scale();
      c.beginPath();
      c.moveTo(sx, sy);
      c.arc(sx, sy, r, Math.PI, Math.PI + q * (Math.PI / 2));
      c.closePath();
      c.moveTo(sx, sy);
      c.arc(sx, sy, r, Math.PI * 2 - q * (Math.PI / 2), Math.PI * 2);
      c.closePath();
      c.clip();
      k.draw(piece, pose);
      c.restore();
      // A light runs up each rib as it closes.
      if (q < 1) {
        const [rx, ry] = meta?.radius ?? [638, 592];
        c.globalCompositeOperation = 'lighter';
        for (const a of [Math.PI + q * (Math.PI / 2), Math.PI * 2 - q * (Math.PI / 2)]) {
          const [px, py] = k.at(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
          k.spark(px, py, 120 * k.scale(), 0.9);
        }
        c.globalCompositeOperation = 'source-over';
      }
    },
  },
  over(k) {
    if (k.still) return;
    const tl = k.tl, D = k.beat('dome');
    const paths = nightPaths();
    const s = k.scale();
    k.c.globalCompositeOperation = 'lighter';
    paths.forEach((p, i) => {
      const on = houseOn(k, i);
      const lit = ramp(tl, on - 0.25, on);
      // The house's door glows from when it lights until its last light has gone, then dims to an ember.
      const lastGone = D - 0.05;
      const [hx, hy] = k.at(p.from[0], p.from[1]);
      const door = lit * (1 - 0.7 * ramp(tl, lastGone - 0.4, lastGone)) * (0.8 + 0.2 * flicker(tl, i));
      k.spark(hx, hy - 20 * s, 150 * s, door * 0.8);
      k.spark(hx, hy - 20 * s, 44 * s, door);
      const travel = 0.24 * k.s.len;
      for (let j = 0; j < 5; j++) {
        const launch = on + 0.15 + j * Math.max(0.05, (D - travel - on - 0.15) / 4);
        const q = (tl - launch) / travel;
        if (q <= 0 || q >= 1.02) continue;
        const bend = (rnd(i * 5 + j, 1) - 0.5) * 260;
        const ctlx = mix(p.from[0], KING_AT[0], 0.35) + bend, ctly = p.from[1] - 330 - rnd(i * 5 + j, 2) * 160;
        for (let tail = 0; tail < 4; tail++) {
          const u = clamp(q - tail * 0.035);
          if (u <= 0) break;
          const e = ease(u);
          const x = (1 - e) ** 2 * p.from[0] + 2 * (1 - e) * e * ctlx + e * e * KING_AT[0];
          const y = (1 - e) ** 2 * p.from[1] + 2 * (1 - e) * e * ctly + e * e * KING_AT[1];
          const [sx2, sy2] = k.at(x, y);
          k.spark(sx2, sy2, (30 - tail * 6) * s, (1 - tail * 0.24) * Math.min(1, q * 8) * (q > 0.92 ? (1.02 - q) * 10 : 1));
        }
      }
    });
    const [kx, ky] = k.at(KING_AT[0], KING_AT[1] - 28 * ease((tl - k.beat('rise')) / (k.s.len - k.beat('rise'))));
    k.spark(kx, ky, (160 + 220 * ramp(tl, k.beat('rise'), D)) * s, 0.55 + 0.1 * wave(tl, 0.6));
    k.c.globalCompositeOperation = 'source-over';
  },
};
interface DomeMeta { center: [number, number]; radius: [number, number] }
let domeMeta: DomeMeta | null = null;
let nightCache: { from: [number, number] }[] | null = null;
function nightPaths() { return nightCache ?? []; }

// 7. The old gods. Six beasts asleep in a ring, breathing slowly. On `bands` a light runs across the gold
// bands round them, and for a moment they read as chains.
const BEASTS = ['stag', 'lion', 'tortoise', 'serpent', 'bird', 'elephant'];
const gods: Direction = {
  flat: true,
  keys: [
    { at: 0, x: 960, y: 530, zoom: 1.03 },
    { at: 'bands', x: 958, y: 515, zoom: 1.17, stop: true },
    { at: 1, x: 958, y: 515, zoom: 1.2 },
  ],
  paper: (id) => BEASTS.includes(id) || id === 'wreath',
  gold: has('stag', 'lion', 'tortoise', 'serpent', 'bird', 'elephant', 'sun', 'wreath'),
  lights: (k) => {
    const B = k.beat('bands');
    return [{ kind: 'band', angle: 0.35, at: 960 + (k.tl - B) * 900, width: 300, strength: 0.25 + 0.75 * bump(k.tl, B, 0.9) }];
  },
  pose(id, k) {
    const tl = k.tl, B = k.beat('bands');
    const base = id.replace(/-bands$/, '');
    const i = BEASTS.indexOf(base);
    if (i >= 0) {
      const breath = 1 + 0.011 * wave(tl, 0.27, i * 0.19);
      return { sy: breath, sx: 1 + 0.003 * wave(tl, 0.27, i * 0.19), shine: id.endsWith('-bands') ? 0.55 * bump(tl, B + (i % 2) * 0.15, 0.45) : 0 };
    }
    if (id === 'sun') return { pivot: [0.5, 0.5], alpha: 0.85 + 0.15 * wave(tl, 0.2), sx: 1 + 0.012 * wave(tl, 0.15), sy: 1 + 0.012 * wave(tl, 0.15) };
  },
  over(k) { motes(k, 18, 0.45, 8); },
};

// 8. The Mark. A hand rises into the light. Seven places on the palm; on light1 to light6 each one lights in
// turn and the beast below it answers. The seventh stays dark.
const MARK_BEASTS = ['stag', 'lion', 'serpent', 'elephant', 'bird', 'tortoise'];
interface MarkMeta { center: [number, number]; radius: number; points: number; darkPoint: number }
function markMeta(): MarkMeta {
  const m = markManifest as { mark?: MarkMeta } | null;
  return m?.mark ?? { center: [950, 520], radius: 100, points: 7, darkPoint: 6 };
}
let markManifest: unknown = null;

function handPose(k: Kit): Pose {
  const q = land(k.tl / (0.17 * k.s.len));
  return { dy: 80 * (1 - q), rot: 0.05 * (1 - q), sy: 1 + 0.003 * wave(k.tl, 0.25) };
}

const mark: Direction = {
  flat: true,
  keys: [
    { at: 0, x: 950, y: 610, zoom: 1.02 },
    { at: 'light6', x: 950, y: 512, zoom: 1.44, stop: true },
    { at: 1, x: 950, y: 510, zoom: 1.48 },
  ],
  paper: (id) => id === 'hand' || MARK_BEASTS.includes(id),
  gold: (id) => id === 'rays' || MARK_BEASTS.includes(id),
  lights: (k) => {
    const lit = litCount(k);
    return [sweep(k, -200, 2200, 0.35), { kind: 'pool', x: 950, y: 520, r: 700, strength: 0.08 * lit }];
  },
  pose(id, k) {
    const tl = k.tl;
    if (id === 'hand') return handPose(k);
    if (id === 'rays') return { alpha: 0.75 + 0.04 * litCount(k), rot: 0.008 * wave(tl, 0.05), pivot: [0.5, 0.65] };
    const i = MARK_BEASTS.indexOf(id);
    if (i >= 0) {
      const b = k.beat(`light${i + 1}`);
      return { shine: k.still ? 0.25 : 0.8 * bump(tl, b + 0.12, 0.3) + 0.22 * ramp(tl, b, b + 0.4) };
    }
  },
  over(k) {
    const m = markMeta();
    const hand = k.piece('hand');
    if (!hand) return;
    const pose = handPose(k);
    const c = k.c;
    const s = k.scale();
    // The palm's points ride the hand: pose the palm centre the way the hand is posed.
    const [px, py] = hand.spec.pivot ?? [0.5, 1];
    const ax = hand.spec.x + px * hand.spec.w, ay = hand.spec.y + py * hand.spec.h + (pose.dy ?? 0);
    const rot = pose.rot ?? 0;
    const palm = (x: number, y: number): [number, number] => {
      const rx = x - (hand.spec.x + px * hand.spec.w), ry = y - (hand.spec.y + py * hand.spec.h);
      return [ax + rx * Math.cos(rot) - ry * Math.sin(rot), ay + rx * Math.sin(rot) + ry * Math.cos(rot)];
    };
    const appear = ramp(k.tl, 0.1 * k.s.len, k.beat('light1'));
    for (let i = 0; i < m.points; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI * 2) / m.points;
      const [fx, fy] = palm(m.center[0] + Math.cos(ang) * m.radius, m.center[1] + Math.sin(ang) * m.radius);
      const [x, y] = k.at(fx, fy);
      const dark = i === m.darkPoint;
      // The lit places take light1 to light6 in order round the palm, stepping over the dark one.
      const beat = dark ? Number.POSITIVE_INFINITY : k.beat(`light${(i < m.darkPoint ? i : i - 1) + 1}`);
      const since = k.still ? 10 : k.tl - beat;
      // The place itself: a thin ring pressed in gold. The dark one is drawn the same, and stays empty.
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = appear * (dark ? 0.55 : 0.45);
      c.strokeStyle = dark ? 'rgb(92,66,40)' : 'rgb(170,124,52)';
      c.lineWidth = 2 * s;
      c.beginPath();
      c.arc(x, y, 13 * s, 0, Math.PI * 2);
      c.stroke();
      // Each light swells in over the last 70 ms before its beat and is full on the beat.
      if (since < -0.07) continue;
      const rise = since < 0 ? ease((since + 0.07) / 0.07) : 1;
      c.globalCompositeOperation = 'lighter';
      const burst = since < 0 ? rise : Math.exp(-since * 3.2);
      k.spark(x, y, (60 + 220 * burst) * s, 0.9 * rise);
      k.spark(x, y, 26 * s, rise);
      // A four-pointed star on the moment it lights.
      if (burst > 0.03) {
        c.globalAlpha = burst;
        c.strokeStyle = 'rgba(255,244,210,1)';
        c.lineWidth = 1.6 * s;
        const r = (40 + 90 * (1 - burst)) * s;
        c.beginPath();
        c.moveTo(x - r, y); c.lineTo(x + r, y);
        c.moveTo(x, y - r * 0.8); c.lineTo(x, y + r * 0.8);
        c.stroke();
      }
    }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    motes(k, 16, 0.4, 10);
  },
};
function litCount(k: Kit) {
  if (k.still) return 6;
  let n = 0;
  for (let i = 1; i <= 6; i++) if (k.tl >= k.beat(`light${i}`)) n++;
  return n;
}

// 9. The wall. Close on the painting, then back: it is a wall in a dark dormitory. The child lifts the candle
// in three drawings to the scraped place; the flame goes with the hand. Hobb waits in the lit doorway and tilts
// her head on `hobb`. Near the camera the bunks slide in from the corners as it pulls back past them.
/** The candle's wick in each of the child's three drawings, in the drawing's own pixels. */
const WICK: [number, number][] = [[168, 155], [169, 82], [174, 7]];
/** POSE_SWAP seconds of dissolve between two drawings of a pose, so a limb reads as moving and does not pop. */
const POSE_SWAP = 0.12;
/** The child's drawing: low, half raised, raised, each change a short dissolve ending on its moment. */
function childFrame(k: Kit) {
  const step = (at: number) => ease((k.tl - at + POSE_SWAP) / POSE_SWAP);
  return step(0.17 * k.s.len) + step(0.31 * k.s.len);
}
function flamePoint(k: Kit): [number, number] | null {
  const child = k.piece('child');
  if (!child) return null;
  // Between two drawings the flame goes between their two wicks.
  const f = childFrame(k);
  const i = Math.min(WICK.length - 1, Math.floor(f)), j = Math.min(WICK.length - 1, i + 1);
  const m = f - Math.floor(f);
  return [child.spec.x + mix(WICK[i][0], WICK[j][0], m), child.spec.y + mix(WICK[i][1], WICK[j][1], m)];
}

const wall: Direction = {
  ref: 0.65,
  keys: [
    { at: 0, x: 1150, y: 395, zoom: 2.1 },
    { at: 'room', x: 1040, y: 500, zoom: 1.32 },
    { at: 0.62, x: 970, y: 542, zoom: 1.04 },
    { at: 1, x: 958, y: 540, zoom: 1.0 },
  ],
  gold: has('wall'),
  screen: has('doorway-glow'),
  lights: (k) => {
    const f = flamePoint(k);
    const fl = flicker(k.tl, 1);
    return f ? [{ kind: 'pool', x: f[0], y: f[1] - 40, r: 520 + 40 * fl, strength: 0.42 + 0.12 * fl }] : [];
  },
  pose(id, k) {
    const tl = k.tl;
    if (id === 'child') return { frame: childFrame(k), sy: 1 + 0.004 * wave(tl, 0.35) };
    if (id === 'flame') {
      const f = flamePoint(k);
      const p = k.piece('flame');
      if (!f || !p) return;
      return { frame: cycle(tl, 9, 3, 0), dx: f[0] - (p.spec.x + p.spec.w / 2), dy: f[1] - (p.spec.y + p.spec.h) };
    }
    if (id === 'hobb') return { frame: ease((tl - k.beat('hobb') + POSE_SWAP) / POSE_SWAP), sy: 1 + 0.004 * wave(tl, 0.3) };
    if (id === 'doorway-glow') return { alpha: 0.6 + 0.2 * flicker(tl * 0.5, 3) };
  },
  over(k) {
    const f = flamePoint(k);
    if (!f) return;
    const [x, y] = k.at(f[0], f[1] - 10, 0.34);
    const s = k.scale(0.34);
    const fl = flicker(k.tl, 1);
    // The candle's reach: the room falls into dark away from it.
    pool(k, x, y, (130 + 12 * fl) * s, (1000 + 60 * fl) * s, '8,5,14', 0.4);
    k.c.globalCompositeOperation = 'lighter';
    k.spark(x, y - 6 * s, (220 + 30 * fl) * s, 0.42);
    k.spark(x, y - 4 * s, 46 * s, 0.9);
    k.c.globalCompositeOperation = 'source-over';
  },
};

// 10. The doorstep. Rain. Far thunder on `thunder`. Someone in a grey coat walks away up the street in six
// drawings and is lost in the rain; the camera comes in on the basket, and the brass key catches the lamp on `key`.
/** The brass key, as a share of the basket's box, so a redrawn basket keeps it. */
const KEY: [number, number] = [0.463, 0.435];
function rain(k: Kit, n: number, speed: number, len: number, alpha: number, width: number, seed: number) {
  const c = k.c;
  c.globalAlpha = alpha;
  c.strokeStyle = '#d6e2ff';
  c.lineWidth = width;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const y = ((rnd(i, seed) * (H + 160) + k.tl * speed * (0.8 + rnd(i, seed + 1) * 0.4)) % (H + 160)) - 80;
    const x = rnd(i, seed + 2) * (W + 240) - 120 - y * 0.16;
    c.moveTo(x, y);
    c.lineTo(x - len * 0.16, y + len);
  }
  c.stroke();
  c.globalAlpha = 1;
}
function lightning(k: Kit) {
  const T = k.beat('thunder');
  const d = k.tl - T;
  const pulse = (x: number, w: number) => (x < 0 || x > w ? 0 : 1 - x / w);
  return Math.max(pulse(d, 0.22), 0.6 * pulse(d - 0.3, 0.18));
}

const doorstep: Direction = {
  ref: 0.25,
  keys: [
    { at: 0, x: 860, y: 540, zoom: 1.12 },
    { at: 0.36, x: 930, y: 570, zoom: 1.16 },
    { at: 'key', x: 1380, y: 728, zoom: 1.74, stop: true },
    { at: 1, x: 1384, y: 731, zoom: 1.78 },
  ],
  gold: has('door-step-wisteria', 'basket'),
  screen: has('lamp-glow'),
  lights: (k) => {
    const K = k.beat('key');
    const fl = flicker(k.tl * 0.6, 2);
    const b = k.piece('basket')?.spec;
    const kx = b ? b.x + KEY[0] * b.w : 0, ky = b ? b.y + KEY[1] * b.h : 0;
    return [
      { kind: 'pool', x: 1290, y: 210, r: 760, strength: 0.32 + 0.1 * fl + 0.5 * lightning(k) },
      { kind: 'pool', x: kx, y: ky, r: 110, strength: 0.9 * bump(k.tl, K, 0.5) + 0.2 * ramp(k.tl, K, k.s.len) },
    ];
  },
  pose(id, k) {
    const tl = k.tl;
    if (id === 'walker') {
      // From the corner of the street up toward the harbour, smaller with every step, lost in the rain.
      const u = clamp(tl / (0.78 * k.s.len));
      const scale = mix(1, 0.52, ease(u));
      const step = Math.abs(Math.sin(tl * 7 * Math.PI / 2));
      return { frame: cycle(tl, 7, 6, 0), dx: 70 * ease(u), dy: -120 * ease(u) - 2.5 * step * scale, sx: scale, sy: scale, alpha: 1 - ramp(u, 0.72, 1) };
    }
    if (id === 'lamp-glow') return { alpha: Math.min(1, 0.7 + 0.18 * flicker(tl * 0.6, 2) + lightning(k)) };
  },
  over(k) {
    rain(k, 130, 900, 50, 0.42, 1.2, 3);
    rain(k, 40, 1400, 96, 0.5, 2, 7);
    // Rings where the drops hit the step and the street.
    const c = k.c;
    c.strokeStyle = 'rgba(214,226,255,0.5)';
    c.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      const period = 0.7 + rnd(i, 4) * 0.5;
      const q = ((k.tl + rnd(i, 5) * period) % period) / period;
      const onStep = i % 2 === 0;
      const [x, y] = k.at(onStep ? 1060 + rnd(i, 6) * 640 : 120 + rnd(i, 6) * 700, onStep ? 810 + rnd(i, 7) * 200 : 760 + rnd(i, 7) * 300, onStep ? 0.25 : 0.65);
      const r = (3 + q * 16) * k.scale(onStep ? 0.25 : 0.65);
      c.globalAlpha = 0.6 * (1 - q);
      c.beginPath();
      c.ellipse(x, y, r, r * 0.32, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;
    fill(k, '#c8d7ff', 0.3 * lightning(k), 'lighter');
    // The key catches the lamp.
    const basket = k.piece('basket');
    if (basket) {
      const K = k.beat('key');
      const d = (k.tl - K) / 0.6;
      if (d > -1) {
        const on = d < 0 ? ease(1 + d) : 0.35 + 0.65 * (1 - ease(clamp(d)));
        const [x, y] = k.at(basket.spec.x + KEY[0] * basket.spec.w, basket.spec.y + KEY[1] * basket.spec.h, basket.spec.depth);
        const s = k.scale(basket.spec.depth);
        const size = 70 * s * (0.5 + 0.5 * on);
        c.globalCompositeOperation = 'lighter';
        k.spark(x, y, size, on);
        c.globalAlpha = on;
        c.strokeStyle = 'rgba(255,240,200,.9)';
        c.lineWidth = 1.3 * s;
        c.beginPath();
        c.moveTo(x - size, y); c.lineTo(x + size, y);
        c.moveTo(x, y - size * 0.7); c.lineTo(x, y + size * 0.7);
        c.stroke();
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 1;
      }
    }
  },
};

// 11. Sixteen years on. The same framing as the night, dissolved to morning: no basket, the door open. The
// camera draws back to the whole street hung with flags, which wave on the breeze. The upper left stays calm
// for the title.
function wavingStrip(k: Kit, piece: { spec: { w: number; h: number }; drawings: HTMLImageElement[] }, pose: Pose, amp: number, slices: number) {
  const img = piece.drawings[0];
  const { w, h } = piece.spec;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  k.c.globalAlpha = pose.alpha ?? 1;
  for (let i = 0; i < slices; i++) {
    const x0 = (i / slices) * w, x1 = ((i + 1) / slices) * w;
    const u = (i + 0.5) / slices;
    // The rope sags in the middle and sways; a wave runs along it.
    const dy = amp * (Math.sin((u * 2.2 - k.tl * 0.55) * Math.PI * 2) * 0.7 + Math.sin(u * Math.PI) * wave(k.tl, 0.18) * 0.6);
    k.c.drawImage(img, (x0 / w) * iw, 0, ((x1 - x0) / w) * iw + 1, ih, x0, dy, x1 - x0 + 0.6, h);
  }
}
const morning: Direction = {
  ref: 0.25,
  keys: [
    { at: 0, x: 1384, y: 731, zoom: 1.78 },
    { at: 'title', x: 990, y: 560, zoom: 1.06, stop: true },
    { at: 1, x: 975, y: 556, zoom: 1.03 },
  ],
  gold: has('door-step-wisteria'),
  lights: (k) => [sweep(k, 2600, -400, 0.28, -0.4, 420)],
  pose(id, k) {
    if (id === 'flowers') return { rot: 0.012 * wave(k.tl, 0.4), sx: 1 + 0.006 * wave(k.tl, 0.31, 0.2) };
  },
  paint: {
    'flags-near'(k, piece, pose) { if (k.place(piece, pose)) wavingStrip(k, piece, pose, 5, 40); },
    'flags-far'(k, piece, pose) { if (k.place(piece, pose)) wavingStrip(k, piece, pose, 1.6, 14); },
  },
  over(k) {
    // Morning sun from the upper right, and dust in it.
    const g = k.c.createLinearGradient(W, 0, W * 0.35, H * 0.9);
    g.addColorStop(0, 'rgba(255,226,160,0.32)');
    g.addColorStop(1, 'rgba(255,226,160,0)');
    k.c.globalCompositeOperation = 'screen';
    k.c.fillStyle = g;
    k.c.fillRect(0, 0, W, H);
    k.c.globalCompositeOperation = 'source-over';
    motes(k, 24, 0.5, 6, [W * 0.4, 0, W * 0.6, H]);
  },
};

export const DIRECTION: Record<ShotId, Direction> = {
  war, king, friends, roads: roadsShot, sickness, night, gods, mark, wall, doorstep, morning,
};

/** Reads what the direction needs from the manifests beyond the layers: the night's paths and dome, the Mark. */
export function prepare(id: ShotId, extra: Record<string, unknown>) {
  if (id === 'night') {
    nightCache = (extra.lightPaths as { from: [number, number] }[] | undefined) ?? [];
    domeMeta = (extra.dome as DomeMeta | undefined) ?? null;
  }
  if (id === 'mark') markManifest = extra;
}
