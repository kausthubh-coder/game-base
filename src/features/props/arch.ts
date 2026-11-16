// Architecture: the calls a builder uses to make a building or a ruin read like its concept sheet. Each one
// draws with a `Shape`'s soft forms and skins, so a whole building is still one geometry and one draw call,
// and each is cut more coarsely at a low `detail`. README.md in this folder lists every call with its cost.
//
// The space is the Shape's: y up, one unit one meter, front +z. A wall's face looks toward +z; turn the pen
// with `s.at` for the other sides. Shading is baked into the colors, as the soft forms do, and `weather`
// (in shape.ts) ages any part after it is drawn.
import { P } from './palette.ts';
import type { MeshOptions, Shape, Skin, Tone } from './shape.ts';

type V3 = readonly [number, number, number];

// ---------------------------------------------------------------- materials

/** The town's honey stone, lavender-grey in shade (region-hollowmere/README.md). */
export const HONEY = [P.pewter, P.burlap, P.sand, P.plaster] as const;
/**
 * The ancients' Hearth limestone: honey cream with lavender-grey shade. Its colors are the material colors of
 * assets-src/concept/stone.md, which the ruins keep outside the prop palette.
 */
export const HEARTH = [0x9c91a7, 0xc9b28e, 0xdec398, 0xf4deb2] as const;
/** Lime plaster over stone or timber. */
export const PLASTER = [P.burlap, P.sand, P.plaster, P.plasterLight] as const;
/** Hewn oak beams, posts and boards. */
export const TIMBER = [P.timber, P.oakDark, P.oak, P.plank] as const;
/** The town's muted teal roof tiles. */
export const TEAL = [P.tealDeep, P.tealDark, P.teal, P.tealLight] as const;
/** Grey-violet slate. */
export const SLATE = [P.night, P.slate, P.iron, P.pewter] as const;
/** Straw thatch. */
export const STRAW = [P.ochre, P.gold, P.butter] as const;
/** Window glass: dark by day, warm at night through `glow`. */
export const GLASS = [P.night, P.slate, P.denim] as const;

const fine = (s: Shape) => s.detail >= 0.75;

// ---------------------------------------------------------------- a batch of points for one mesh

/** Where a surface is at (u, v) meters across it and `off` meters out from it: position, then normal. */
type Mapper = (u: number, v: number, off: number, out: number[]) => void;

/** Points and triangles gathered for one `mesh` call, with a hint, a texture place and a ramp shift a point. */
class Batch {
  readonly p: number[] = [];
  readonly t: number[] = [];
  readonly h: number[] = [];
  readonly uv: number[] = [];
  readonly sh: number[] = [];
  add(x: number, y: number, z: number, nx: number, ny: number, nz: number, u = 0, v = 0, shift = 0): number {
    this.p.push(x, y, z);
    this.h.push(nx, ny, nz);
    this.uv.push(u, v);
    this.sh.push(shift);
    return this.p.length / 3 - 1;
  }
  /** A point from a mapper's output. */
  at(o: number[], u: number, v: number, shift: number): number {
    return this.add(o[0], o[1], o[2], o[3], o[4], o[5], u, v, shift);
  }
  quad(a: number, b: number, c: number, d: number): void {
    this.t.push(a, b, c, a, c, d);
  }
  tri(a: number, b: number, c: number): void {
    this.t.push(a, b, c);
  }
  draw(s: Shape, tone: Tone, o: MeshOptions = {}): void {
    if (this.t.length) s.mesh(this.p, this.t, tone, { ...o, hints: this.h, uvs: this.uv, shifts: this.sh });
  }
}

/** A flat surface: origin, the way u runs, the way v runs and the way out. */
function plane(origin: V3, u: V3, v: V3, n: V3): Mapper {
  return (a, b, off, out) => {
    for (let k = 0; k < 3; k++) out[k] = origin[k] + u[k] * a + v[k] * b + n[k] * off;
    out[3] = n[0];
    out[4] = n[1];
    out[5] = n[2];
  };
}

const _o = [0, 0, 0, 0, 0, 0];

/**
 * One dressed block on a surface, over u0..u1 and v0..v1: a face standing `rel` proud of the surface in its
 * middle, with chamfers down to the surface at its edges, so neighbours meet in a groove. `chip` (1 to 4)
 * breaks one corner. Long blocks on a curved surface are cut every `seg` meters. A flat block is one face.
 * 6k + 4 triangles, where k is how many pieces it is cut into; 2k flat.
 */
function pillow(b: Batch, at: Mapper, u0: number, u1: number, v0: number, v1: number, ch: number, rel: number, seg: number, shift: number, chip: number, flat: boolean): void {
  const k = Math.max(1, Math.ceil((u1 - u0) / seg - 0.15));
  if (flat) {
    const row = (v: number) => Array.from({ length: k + 1 }, (_, j) => { const u = u0 + ((u1 - u0) * j) / k; at(u, v, 0, _o); return b.at(_o, u, v, shift); });
    const bottom = row(v0), top = row(v1);
    for (let j = 0; j < k; j++) b.quad(bottom[j], bottom[j + 1], top[j + 1], top[j]);
    return;
  }
  const c = Math.min(ch, (u1 - u0) * 0.3, (v1 - v0) * 0.3);
  const outer = (v: number) => Array.from({ length: k + 1 }, (_, j) => { const u = u0 + ((u1 - u0) * j) / k; at(u, v, 0, _o); return b.at(_o, u, v, shift); });
  const inner = (v: number, corner0: number, corner1: number) => Array.from({ length: k + 1 }, (_, j) => {
    let u = u0 + c + ((u1 - u0 - 2 * c) * j) / k, w = v, r = rel;
    const corner = j === 0 ? corner0 : j === k ? corner1 : 0;
    if (corner && corner === chip) {
      u += (j === 0 ? 1 : -1) * c * 1.6;
      w += (v < (v0 + v1) / 2 ? 1 : -1) * c * 1.6;
      r *= 0.15;
    }
    at(u, w, r, _o);
    return b.at(_o, u, w, shift);
  });
  const ob = outer(v0), ot = outer(v1), ib = inner(v0 + c, 1, 2), it = inner(v1 - c, 4, 3);
  for (let j = 0; j < k; j++) {
    b.quad(ib[j], ib[j + 1], it[j + 1], it[j]);
    b.quad(ob[j], ob[j + 1], ib[j + 1], ib[j]);
    b.quad(it[j], it[j + 1], ot[j + 1], ot[j]);
  }
  b.quad(ob[0], ib[0], it[0], ot[0]);
  b.quad(ib[k], ob[k], ot[k], it[k]);
}

// ---------------------------------------------------------------- masonry

export interface StoneOptions {
  /** The stone's ramp. Default `HONEY`. */
  tone?: Tone;
  /** Default `limestone`. */
  skin?: Skin;
  /** Height of a course, in meters. Default 0.9. */
  course?: number;
  /** Shortest and longest block. Default [1.2, 2.2]. */
  long?: readonly [number, number];
  /** The chamfer round each block's face. Default 0.07. */
  chamfer?: number;
  /** How far a block's face stands proud of its joints. Default 0.045. */
  relief?: number;
  /** The share of blocks with a broken corner, 0 to 1. Default 0.25. */
  chip?: number;
  /** How far one block's color moves from the next along the ramp. Default 0.22. */
  vary?: number;
  /** Moss on upward faces and ledges, as `FormOptions.moss`: 0.1 is a ruin's sparse moss. Default 0. */
  moss?: number;
  mossTone?: Tone;
  /** Blocks laid flat with no chamfer, as at low detail. */
  flat?: boolean;
}

/** A rectangle the courses leave open on a face, in the face's meters: u0..u1 across, v0..v1 up. */
export interface Hole {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

/** The joints between courses from V0 to V1, a little uneven, with every hole's sill and head on one. */
function courseLines(s: Shape, V0: number, V1: number, o: StoneOptions, holes: readonly Hole[] = [], even = false): number[] {
  const course = o.course ?? 0.9;
  const lines: number[] = [V0];
  while (lines[lines.length - 1] < V1 - 1e-6) lines.push(Math.min(V1, lines[lines.length - 1] + course * (even ? 1 : s.rr(0.85, 1.15))));
  if (lines.length > 2 && V1 - lines[lines.length - 2] < course * 0.45) lines.splice(lines.length - 2, 1);
  // Each opening's sill and head lie on a joint, so a course is either beside an opening or clear of it.
  for (const h of holes) for (const v of [h.v0, h.v1]) {
    if (v <= V0 + 0.05 || v >= V1 - 0.05) continue;
    let near = 0;
    for (let i = 1; i < lines.length; i++) if (Math.abs(lines[i] - v) < Math.abs(lines[near] - v)) near = i;
    if (near > 0 && near < lines.length - 1 && Math.abs(lines[near] - v) < course * 0.4) lines[near] = v;
    else lines.push(v);
  }
  lines.sort((a, c) => a - c);
  for (let i = lines.length - 1; i > 0 && lines.length > 2; i--) if (lines[i] - lines[i - 1] < 0.12) lines.splice(i === lines.length - 1 ? Math.max(1, i - 1) : i, 1);
  return lines;
}

/** Lays courses of blocks between the `lines` over U0..U1 of a surface, round the holes. `top` drops blocks above it. */
function lay(s: Shape, b: Batch, at: Mapper, U0: number, U1: number, lines: readonly number[], o: StoneOptions, curved: boolean, holes: readonly Hole[] = [], breaks: readonly number[] = [], top?: (u: number) => number): void {
  const [shortest, longest] = o.long ?? [1.2, 2.2];
  const flat = o.flat || !fine(s);
  for (let c = 0; c < lines.length - 1; c++) {
    const a = lines[c], e = lines[c + 1];
    let pieces: [number, number][] = [[U0, U1]];
    for (const h of holes) {
      if (h.v0 >= e - 1e-4 || h.v1 <= a + 1e-4) continue;
      pieces = pieces.flatMap(([p, q]): [number, number][] => (h.u1 <= p || h.u0 >= q ? [[p, q]] : [[p, Math.max(p, h.u0)], [Math.min(q, h.u1), q]]).filter(([m, n]) => n - m > 0.02) as [number, number][]);
    }
    for (const at0 of breaks) pieces = pieces.flatMap(([p, q]): [number, number][] => (at0 > p + 0.02 && at0 < q - 0.02 ? [[p, at0], [at0, q]] : [[p, q]]));
    for (const [p, q] of pieces) {
      let u = p, first = true;
      while (u < q - 1e-4) {
        let len = s.rr(shortest, longest) * (first && c % 2 === 1 ? 0.55 : 1);
        first = false;
        if (q - (u + len) < shortest * 0.45) len = q - u;
        const chip = s.r() < (o.chip ?? 0.25) ? 1 + Math.floor(s.r() * 4) : 0;
        const shift = (s.r() - 0.5) * 2 * (o.vary ?? 0.22);
        if (!top || a < top(u + len / 2) - 1e-4) pillow(b, at, u, u + len, a, e, o.chamfer ?? 0.07, o.relief ?? 0.045, curved ? 1.2 : Infinity, shift, chip, flat);
        u += len;
      }
    }
  }
}

function stoneLook(o: StoneOptions): MeshOptions {
  return { skin: o.skin ?? 'limestone', crease: 0.4, light: 0.25, key: 0.3, mottle: 0.16, cavity: 0.55, moss: o.moss ?? 0, mossTone: o.mossTone };
}

/**
 * A mass of coursed masonry that stands on y like `box`: a plinth, a pier, a garden wall. Its visible faces
 * (`faces`, default '+z+x-x-z+y') are laid in courses of blocks of uneven length, each a little proud with
 * chamfered edges, some with a broken corner, each its own shade. `holes` leaves openings in its +z face.
 */
export function ashlar(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number, o: StoneOptions & { faces?: string; holes?: readonly Hole[] } = {}): void {
  const faces = o.faces ?? '+z+x-x-z+y';
  const b = new Batch();
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  if (faces.includes('+z')) lay(s, b, plane([x0, y, z1], [1, 0, 0], [0, 1, 0], [0, 0, 1]), 0, w, courseLines(s, 0, h, o, o.holes), o, false, o.holes);
  if (faces.includes('-z')) lay(s, b, plane([x1, y, z0], [-1, 0, 0], [0, 1, 0], [0, 0, -1]), 0, w, courseLines(s, 0, h, o), o, false);
  if (faces.includes('+x')) lay(s, b, plane([x1, y, z1], [0, 0, -1], [0, 1, 0], [1, 0, 0]), 0, d, courseLines(s, 0, h, o), o, false);
  if (faces.includes('-x')) lay(s, b, plane([x0, y, z0], [0, 0, 1], [0, 1, 0], [-1, 0, 0]), 0, d, courseLines(s, 0, h, o), o, false);
  if (faces.includes('+y')) lay(s, b, plane([x0, y + h, z1], [1, 0, 0], [0, 0, -1], [0, 1, 0]), 0, w, courseLines(s, 0, d, { course: d > 1.6 ? 1.2 : d }), o, false);
  b.draw(s, o.tone ?? HONEY, stoneLook(o));
}

/** One dressed block standing on y: a quoin, a pedestal, a step, a coping stone. Faces as `ashlar`, default '+z+x-x+y'. */
export function stoneBlock(s: Shape, x: number, y: number, z: number, w: number, h: number, d: number, o: StoneOptions & { faces?: string } = {}): void {
  ashlar(s, x, y, z, w, h, d, { long: [99, 99], course: 99, faces: '+z+x-x+y', ...o });
}

export interface RingOptions extends StoneOptions {
  /** How thick the wall is. Default 0.9. */
  thick?: number;
  /** Where the wall starts and ends, as angles from +z toward +x. Default all round. */
  from?: number;
  to?: number;
  /** The height of each stretch of its top, from `from` to `to`: a broken crown. Default one height, `h`. */
  tops?: readonly number[];
  /** Openings, by angle and height above y. */
  holes?: readonly { from: number; to: number; bottom: number; top: number }[];
}

/**
 * A round wall of coursed blocks inside and out: a tower, a well, a ruined rotunda. Its crown steps down
 * stretch by stretch as `tops` says, with its broken ends shown, and openings leave clean jambs and sills.
 * About 16 triangles a block outside (cut every 1.2 m), 4 inside, and the crown.
 */
export function ashlarRing(s: Shape, x: number, y: number, z: number, r: number, h: number, o: RingOptions = {}): void {
  const thick = o.thick ?? 0.9, from = o.from ?? 0, to = o.to ?? Math.PI * 2, ri = r - thick;
  const holeList = o.holes ?? [];
  // Each stretch of the crown is moved onto the nearest joint, so no block stands half above it.
  const lines = courseLines(s, 0, Math.max(h, ...(o.tops ?? [h])), o, holeList.map((q) => ({ u0: 0, u1: 0, v0: q.bottom, v1: q.top })));
  const snap = (v: number) => lines.reduce((best, line) => (Math.abs(line - v) < Math.abs(best - v) ? line : best), lines[0]);
  const tops = (o.tops ?? [h]).map(snap);
  const span = to - from, step = span / tops.length;
  const topAt = (a: number) => tops[Math.max(0, Math.min(tops.length - 1, Math.floor((a - from) / step)))];
  const breaks: number[] = [];
  for (let j = 1; j < tops.length; j++) if (tops[j] !== tops[j - 1]) breaks.push(from + j * step);
  const b = new Batch(), inside = new Batch(), crown = new Batch(), ends = new Batch();
  const around = (radius: number, sign: number): Mapper => (u, v, off, out) => {
    const a = from + u / radius, sa = Math.sin(a), ca = Math.cos(a), rr = radius + off * sign;
    out[0] = x + sa * rr; out[1] = y + v; out[2] = z + ca * rr;
    out[3] = sa * sign; out[4] = 0; out[5] = ca * sign;
  };
  const holes = (radius: number): Hole[] => (o.holes ?? []).map((q) => ({ u0: (q.from - from) * radius, u1: (q.to - from) * radius, v0: q.bottom, v1: q.top }));
  lay(s, b, around(r, 1), 0, span * r, lines, o, true, holes(r), breaks.map((a) => (a - from) * r), (u) => topAt(from + u / r));
  lay(s, inside, around(ri, -1), 0, span * ri, lines, { ...o, flat: true }, true, holes(ri), breaks.map((a) => (a - from) * ri), (u) => topAt(from + u / ri));
  // The crown of each stretch, and the broken ends where one stretch stands higher than the next.
  const pieces = Math.max(1, Math.round(step * r / 0.9));
  const point = (a: number, radius: number, height: number, nx: number, ny: number, nz: number) => crown.add(x + Math.sin(a) * radius, y + height, z + Math.cos(a) * radius, nx, ny, nz);
  for (let j = 0; j < tops.length; j++) {
    const a0 = from + j * step;
    for (let k = 0; k < pieces; k++) {
      const a = a0 + (step * k) / pieces, c = a0 + (step * (k + 1)) / pieces;
      if (holeList.some((q) => q.top >= tops[j] - 1e-4 && (a + c) / 2 > q.from && (a + c) / 2 < q.to)) continue;
      crown.quad(point(a, ri, tops[j], 0, 1, 0), point(a, r, tops[j], 0, 1, 0), point(c, r, tops[j], 0, 1, 0), point(c, ri, tops[j], 0, 1, 0));
    }
  }
  const end = (a: number, low: number, high: number, sign: number) => {
    const nx = Math.cos(a) * sign, nz = -Math.sin(a) * sign;
    const q = (radius: number, y0: number) => ends.add(x + Math.sin(a) * radius, y + y0, z + Math.cos(a) * radius, nx, 0, nz);
    ends.quad(q(ri, low), q(r, low), q(r, high), q(ri, high));
  };
  for (let j = 1; j < tops.length; j++) if (tops[j] !== tops[j - 1]) end(from + j * step, Math.min(tops[j], tops[j - 1]), Math.max(tops[j], tops[j - 1]), tops[j] < tops[j - 1] ? 1 : -1);
  if (span < Math.PI * 2 - 1e-3) { end(from, 0, tops[0], -1); end(to, 0, tops[tops.length - 1], 1); }
  for (const q of holeList) {
    end(q.from, q.bottom, Math.min(q.top, topAt(q.from - 1e-3)), 1);
    end(q.to, q.bottom, Math.min(q.top, topAt(q.to + 1e-3)), -1);
    if (q.bottom > 0.01) {
      const n = Math.max(1, Math.round((q.to - q.from) * r / 0.9));
      for (let k = 0; k < n; k++) {
        const a = q.from + ((q.to - q.from) * k) / n, c = q.from + ((q.to - q.from) * (k + 1)) / n;
        crown.quad(point(a, ri, q.bottom, 0, 1, 0), point(a, r, q.bottom, 0, 1, 0), point(c, r, q.bottom, 0, 1, 0), point(c, ri, q.bottom, 0, 1, 0));
      }
    }
  }
  const look = stoneLook(o);
  b.draw(s, o.tone ?? HEARTH, look);
  inside.draw(s, o.tone ?? HEARTH, { ...look, light: 0.15, cavity: 0.7 });
  crown.draw(s, o.tone ?? HEARTH, { ...look, crease: 0.5, moss: Math.min(0.6, (o.moss ?? 0) * 2.5) });
  ends.draw(s, o.tone ?? HEARTH, { ...look, crease: 0.5, light: 0.15 });
}

export interface ArchOptions extends StoneOptions {
  /** How deep the ring is, front to back. Default 0.5. */
  depth?: number;
  /** How wide the ring's stones are, from the opening out. Default 0.4. */
  ring?: number;
  /** How many voussoirs, the keystone in the middle. Default 9 (7 under 1.2 m). */
  stones?: number;
  /** How far the keystone stands out above the rest. Default 0.12. */
  key?: number;
  /** Jamb blocks down to y on each side, alternately long and short, as `ring` wide. Default true. */
  jambs?: boolean;
  /** Fills the corners above the ring up to its crown with masonry, a rectangle round the arch. */
  spandrels?: boolean;
  /** The wall face behind it, at each x (from the arch's middle) as z from the arch's front: a round tower curves away. */
  behind?: (x: number) => number;
}

/**
 * A round arch of dressed stones over an opening `span` wide whose arch springs at `spring` above y, with
 * its front at z. Each voussoir shows its face, its soffit and its back; jambs carry it down to y. Used by
 * doors and windows with a stone frame, and alone for a gate or a ruin. About 16 triangles a stone.
 */
export function stoneArch(s: Shape, x: number, y: number, z: number, span: number, spring: number, o: ArchOptions = {}): void {
  const depth = o.depth ?? 0.5, ring = o.ring ?? 0.4, n = o.stones ?? (span < 0.8 ? 5 : span < 2 ? 7 : 9), r = span / 2, R = r + ring;
  const behind = o.behind ?? (() => -depth);
  const b = new Batch();
  const ch = o.chamfer ?? 0.06, rel = o.relief ?? 0.04, flat = o.flat || !fine(s);
  const gap = 0.012;
  for (let i = 0; i < n; i++) {
    const a = Math.PI - (i * Math.PI) / n - gap, c = Math.PI - ((i + 1) * Math.PI) / n + gap;
    const keystone = i === (n - 1) / 2;
    const out = R + (keystone ? o.key ?? 0.12 : 0) + (i % 2 ? 0.04 : 0);
    const shift = (s.r() - 0.5) * 2 * (o.vary ?? 0.22);
    // The face: u round the arc, v outward from the opening.
    const face: Mapper = (u, v, off, res) => {
      const t = a + ((c - a) * u) / 1, rad = r + v;
      res[0] = x + Math.cos(t) * rad; res[1] = y + spring + Math.sin(t) * rad; res[2] = z + off + (keystone ? 0.04 : 0);
      res[3] = 0; res[4] = 0; res[5] = 1;
    };
    pillow(b, face, 0, 1, 0, out - r, ch, rel, Infinity, shift, 0, flat);
    // The soffit and the back of the stone, which the opening and the wall's edge show.
    const back = Math.min(behind(Math.cos((a + c) / 2) * R), -0.05);
    for (const [rad, sign] of [[r, -1], [out, 1]] as const) {
      const p = (t: number, dz: number) => b.add(x + Math.cos(t) * rad, y + spring + Math.sin(t) * rad, z + dz, Math.cos(t) * sign, Math.sin(t) * sign, 0, t * rad, dz, shift);
      b.quad(p(a, 0), p(c, 0), p(c, back), p(a, back));
    }
  }
  if (o.jambs ?? true) {
    let v = 0, i = 0;
    while (v < spring - 0.05) {
      const hgt = Math.min(spring - v, (o.course ?? 0.6) * s.rr(0.85, 1.1));
      const wide = i % 2 ? ring * 0.75 : ring * 1.15;
      for (const side of [-1, 1]) {
        const cx = x + side * (r + wide / 2);
        const back = Math.min(behind(side * (r + wide / 2)), -0.05);
        const blockO = { ...o, long: [99, 99] as const, course: 99 };
        const bb = new Batch();
        const d = -back;
        lay(s, bb, plane([cx - wide / 2, y + v, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]), 0, wide, [0, hgt], blockO, false);
        // The side facing the opening, and the outer side only where the jamb stands well proud.
        const inner = side < 0 ? plane([cx + wide / 2, y + v, z], [0, 0, -1], [0, 1, 0], [1, 0, 0]) : plane([cx - wide / 2, y + v, z - d], [0, 0, 1], [0, 1, 0], [-1, 0, 0]);
        const outer = side < 0 ? plane([cx - wide / 2, y + v, z - d], [0, 0, 1], [0, 1, 0], [-1, 0, 0]) : plane([cx + wide / 2, y + v, z], [0, 0, -1], [0, 1, 0], [1, 0, 0]);
        lay(s, bb, inner, 0, d, [0, hgt], { ...blockO, flat: d < 0.2 || blockO.flat }, false);
        if (d >= 0.2) lay(s, bb, outer, 0, d, [0, hgt], blockO, false);
        bb.draw(s, o.tone ?? HONEY, stoneLook(o));
      }
      v += hgt;
      i++;
    }
  }
  if (o.spandrels) {
    // The two corners between the ring and a rectangle up to its crown, and the ledge on top.
    const top = spring + R, m = 6;
    for (const side of [-1, 1]) {
      const corner = b.add(x + side * R, y + top, z, 0, 0, 1);
      let prev = -1;
      for (let k = 0; k <= m; k++) {
        const t = side < 0 ? Math.PI - (k * Math.PI) / (2 * m) : (k * Math.PI) / (2 * m);
        const q = b.add(x + Math.cos(t) * R, y + spring + Math.sin(t) * R, z, 0, 0, 1);
        if (prev >= 0) b.tri(corner, prev, q);
        prev = q;
      }
      const base = b.add(x + side * R, y + spring, z, 0, 0, 1);
      const first = b.add(x + side * R, y + spring, z, 0, 0, 1);
      b.tri(corner, first, base);
      const back = Math.min(behind(side * R), -0.05);
      const sx = side, s0 = b.add(x + side * R, y + spring, z, sx, 0, 0), s1 = b.add(x + side * R, y + top, z, sx, 0, 0);
      const s2 = b.add(x + side * R, y + top, z + back, sx, 0, 0), s3 = b.add(x + side * R, y + spring, z + back, sx, 0, 0);
      b.quad(s0, s1, s2, s3);
    }
    const ledge = Math.max(4, Math.round(R / 0.6));
    for (let k = 0; k < ledge; k++) {
      const u0 = -R + (2 * R * k) / ledge, u1 = -R + (2 * R * (k + 1)) / ledge;
      b.quad(b.add(x + u0, y + top, z, 0, 1, 0), b.add(x + u1, y + top, z, 0, 1, 0), b.add(x + u1, y + top, z + Math.min(behind(u1), -0.05), 0, 1, 0), b.add(x + u0, y + top, z + Math.min(behind(u0), -0.05), 0, 1, 0));
    }
  }
  b.draw(s, o.tone ?? HONEY, stoneLook(o));
}

// ---------------------------------------------------------------- timber

export interface TimberOptions {
  /** Its height across, when it is not square: a board or a joist. */
  height?: number;
  skin?: Skin;
}

/**
 * One hewn beam, post or brace from a to b, `size` wide: four faces and two cut ends, 12 triangles, its grain
 * along it. A beam that does not stand upright keeps its faces level.
 */
export function timber(s: Shape, a: V3, b: V3, size = 0.2, tone: Tone = TIMBER, o: TimberOptions = {}): void {
  const t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(t[0], t[1], t[2]) || 1;
  for (let k = 0; k < 3; k++) t[k] /= len;
  const ref = Math.abs(t[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
  let sx = t[1] * ref[2] - t[2] * ref[1], sy = t[2] * ref[0] - t[0] * ref[2], sz = t[0] * ref[1] - t[1] * ref[0];
  const sl = Math.hypot(sx, sy, sz) || 1;
  sx /= sl; sy /= sl; sz /= sl;
  const ux = sy * t[2] - sz * t[1], uy = sz * t[0] - sx * t[2], uz = sx * t[1] - sy * t[0];
  const hw = size / 2, hh = (o.height ?? size) / 2;
  const p: number[] = [], h: number[] = [], uv: number[] = [], tris: number[] = [];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [end, base] of [[0, a], [len, b]] as const)
    for (const [cs, cu] of corners) {
      p.push(base[0] + sx * cs * hw + ux * cu * hh, base[1] + sy * cs * hw + uy * cu * hh, base[2] + sz * cs * hw + uz * cu * hh);
      h.push(sx * cs + ux * cu, sy * cs + uy * cu, sz * cs + uz * cu);
      uv.push(cs * hw + cu * hh, end);
    }
  for (let k = 0; k < 4; k++) { const k1 = (k + 1) % 4; tris.push(k, k1, 4 + k1, k, 4 + k1, 4 + k); }
  // Each end has its own corners, so it shades flat as cut wood.
  const first = p.length / 3;
  for (const [i, sign] of [[0, -1], [4, 1]] as const) for (let k = 0; k < 4; k++) {
    p.push(p[(i + k) * 3], p[(i + k) * 3 + 1], p[(i + k) * 3 + 2]);
    h.push(t[0] * sign, t[1] * sign, t[2] * sign);
    uv.push(0, 0);
  }
  tris.push(first, first + 1, first + 2, first, first + 2, first + 3, first + 4, first + 5, first + 6, first + 4, first + 6, first + 7);
  s.mesh(p, tris, tone, { smooth: false, skin: o.skin ?? 'grain', hints: h, uvs: uv, light: 0.25, mottle: 0.22, cavity: 0.3 });
}

// ---------------------------------------------------------------- roofs

export interface Dormer {
  /** Its middle along the ridge, from the roof's middle. */
  x: number;
  /** Which slope: 1 the +z one, -1 the other. */
  side: 1 | -1;
  /** Width of its front, default 1.6, and height of its front wall, default 1.5. */
  w?: number;
  h?: number;
}

export interface RoofOptions {
  /** 'gable' (default), 'hip' (sloped on all four sides) or 'half-hip' (a gable whose top is hipped back). */
  kind?: 'gable' | 'hip' | 'half-hip';
  /** Ridge height above the eave. Default 0.85 × d / 2. */
  rise?: number;
  /** How far the eaves reach past the walls. Default 0.6. */
  overhang?: number;
  /** How far a gable's verges reach past its end walls. Default the overhang. */
  verge?: number;
  /** 'tiles' (default), 'slate' or 'thatch': its skin, ramp and how its courses step. */
  cover?: 'tiles' | 'slate' | 'thatch';
  tone?: Tone;
  /** Meters between the courses whose stepped edges are modelled. Default 0.9; thatch 1.3. */
  course?: number;
  /** How thick it is at its edges. Default 0.18; thatch 0.4. */
  thick?: number;
  /** A ridge bent down by this many meters in its middle: an old roof. */
  sag?: number;
  /** How far each slope bellies down between eave and ridge. Default 0.08. */
  belly?: number;
  /** Where a half-hip's hip starts, as a share of the rise. Default 0.62. */
  hip?: number;
  /** Plaster gable ends under a gable or half-hip, framed in timber this way. Default 'king'; 'none' leaves them open. */
  gables?: GableFrame | 'none';
  /** Which end gets a gable: -1 the -x end, 1 the +x end, 0 both (default). A porch's back end is inside its wall. */
  gableEnd?: -1 | 0 | 1;
  /** Rafter ends under the eaves, every this many meters. Default 1.4; 0 for none. Not at low detail. */
  tails?: number;
  dormers?: readonly Dormer[];
  /** Moss on the upward faces, as `FormOptions.moss`. */
  moss?: number;
}

type Face = [V3, V3, V3, V3];

/**
 * A roof over a footprint `w` along x by `d` along z, resting on walls whose top is at `wallTop`, its ridge along
 * x. Each slope is cut into courses whose lower edges step out, so its edge and the verge's profile read
 * as tiles, with the cover's painted skin between. Ridge and hip caps, barge boards, a ridge beam's ends,
 * rafter tails, gable ends and dormers come with it. Cost: about 4 × columns × courses a slope, plus
 * 40 for the caps and 12 a timber; a 7 × 6 cottage roof is about 700, a 20 × 14 hip about 1,100.
 */
export function roof(s: Shape, x: number, wallTop: number, z: number, w: number, d: number, o: RoofOptions = {}): void {
  const start = s.mark();
  const kind = o.kind ?? 'gable', cover = o.cover ?? 'tiles', thatched = cover === 'thatch';
  const tone = o.tone ?? (cover === 'slate' ? SLATE : thatched ? STRAW : TEAL);
  const rise = o.rise ?? (0.85 * d) / 2, over = o.overhang ?? 0.6, verge = kind === 'hip' ? over : o.verge ?? over;
  const pitch = rise / (d / 2), course = (o.course ?? (thatched ? 1.3 : 0.9)) / (fine(s) ? 1 : 0.55);
  const thick = o.thick ?? (thatched ? 0.4 : 0.18), lip = thatched ? 0.14 : cover === 'slate' ? 0.04 : 0.07;
  // The roof's underside rests on the wall top, so its surface there stands `thick` above it.
  const y = wallTop + thick + 0.06;
  const W = w / 2 + verge, Wh = w / 2 + over, D = d / 2 + over, eaveY = y - over * pitch, top = y + rise;
  const t = o.hip ?? 0.62, yt = y + rise * t, zt = D - (yt - eaveY) / pitch;
  const faces: { face: Face; verges: boolean; eave: boolean }[] = [];
  for (const sg of [1, -1]) {
    if (kind === 'gable') faces.push({ face: [[-W, eaveY, sg * D], [W, eaveY, sg * D], [W, top, 0], [-W, top, 0]], verges: true, eave: true });
    else if (kind === 'hip') {
      const R = Math.max(0, Wh - D);
      faces.push({ face: [[-Wh, eaveY, sg * D], [Wh, eaveY, sg * D], [R, top, 0], [-R, top, 0]], verges: false, eave: true });
      faces.push({ face: [[sg * Wh, eaveY, D], [sg * Wh, eaveY, -D], [sg * R, top, 0], [sg * R, top, 0]], verges: false, eave: true });
    } else {
      const R = Math.max(0, W - zt);
      faces.push({ face: [[-W, eaveY, sg * D], [W, eaveY, sg * D], [W, yt, sg * zt], [-W, yt, sg * zt]], verges: true, eave: true });
      faces.push({ face: [[-W, yt, sg * zt], [W, yt, sg * zt], [R, top, 0], [-R, top, 0]], verges: false, eave: false });
      faces.push({ face: [[sg * W, yt, zt], [sg * W, yt, -zt], [sg * R, top, 0], [sg * R, top, 0]], verges: false, eave: true });
    }
  }
  const surface = new Batch(), edge = new Batch(), under = new Batch();
  const P0 = [0, 0, 0];
  const lerp = (f: Face, u: number, v: number, out: number[]) => {
    for (let k = 0; k < 3; k++) {
      const bottom = f[0][k] + (f[1][k] - f[0][k]) * u, upper = f[3][k] + (f[2][k] - f[3][k]) * u;
      out[k] = bottom + (upper - bottom) * v;
    }
  };
  for (const { face, verges, eave } of faces) {
    const e1 = [face[1][0] - face[0][0], face[1][1] - face[0][1], face[1][2] - face[0][2]];
    const mid = [(face[2][0] + face[3][0]) / 2 - (face[0][0] + face[1][0]) / 2, (face[2][1] + face[3][1]) / 2 - (face[0][1] + face[1][1]) / 2, (face[2][2] + face[3][2]) / 2 - (face[0][2] + face[1][2]) / 2];
    let nx = e1[1] * mid[2] - e1[2] * mid[1], ny = e1[2] * mid[0] - e1[0] * mid[2], nz = e1[0] * mid[1] - e1[1] * mid[0];
    const nl = Math.hypot(nx, ny, nz) * (ny < 0 ? -1 : 1);
    nx /= nl; ny /= nl; nz /= nl;
    const width = Math.hypot(e1[0], e1[1], e1[2]), slope = Math.hypot(mid[0], mid[1], mid[2]);
    const ex = e1[0] / width, ey = e1[1] / width, ez = e1[2] / width;
    const cols = Math.max(1, Math.round(width / (fine(s) ? 2.4 : 4.5))), rows = Math.max(1, Math.round(slope / course));
    const at = (u: number, v: number, off: number, shift = 0, b = surface, n: readonly number[] = [nx, ny, nz]) => {
      lerp(face, u, v, P0);
      const sink = (o.belly ?? 0.08) * Math.sin(Math.PI * Math.min(1, v));
      const px = P0[0] + nx * off, py = P0[1] + ny * off - sink, pz = P0[2] + nz * off;
      return b.add(x + px, py, z + pz, n[0], n[1], n[2], (P0[0] - face[0][0]) * ex + (P0[1] - face[0][1]) * ey + (P0[2] - face[0][2]) * ez, (1 - v) * slope, shift);
    };
    for (let r = 0; r < rows; r++) {
      const v0 = r / rows, v1 = (r + 1) / rows, dv = Math.min(0.4, lip * 1.5 / slope);
      const shift = (s.r() - 0.5) * 0.12;
      const low = Array.from({ length: cols + 1 }, (_, c) => at(c / cols, v0 - (r > 0 ? dv : 0), lip, shift));
      const high = Array.from({ length: cols + 1 }, (_, c) => at(c / cols, v1, 0, shift));
      for (let c = 0; c < cols; c++) surface.quad(low[c], low[c + 1], high[c + 1], high[c]);
      // The stepped edge where this course laps over the one below, or the fascia at the eave.
      const down = [-(nx * ny), 1 - ny * ny, -(nz * ny)].map((q) => -q);
      const lipTop = Array.from({ length: cols + 1 }, (_, c) => at(c / cols, v0 - (r > 0 ? dv : 0), lip, 0, edge, down));
      const lipLow = Array.from({ length: cols + 1 }, (_, c) => at(c / cols, v0 - (r > 0 ? dv : 0), r === 0 ? -thick : 0, 0, edge, down));
      if (r > 0 || eave) for (let c = 0; c < cols; c++) edge.quad(lipTop[c], lipTop[c + 1], lipLow[c + 1], lipLow[c]);
      if (verges)
        for (const [u, sign] of [[0, -1], [1, 1]] as const) {
          const side = [ex * sign, ey * sign, ez * sign];
          edge.quad(at(u, v0 - (r > 0 ? dv : 0), lip, 0, edge, side), at(u, v1, 0, 0, edge, side), at(u, v1, -thick, 0, edge, side), at(u, v0 - (r > 0 ? dv : 0), -thick, 0, edge, side));
        }
    }
    const down = [-nx, -ny, -nz];
    under.quad(at(0, 0, -thick, 0, under, down), at(1, 0, -thick, 0, under, down), at(1, 1, -thick, 0, under, down), at(0, 1, -thick, 0, under, down));
  }
  const skin: Skin = thatched ? 'thatch' : cover === 'slate' ? 'slate' : 'tiles';
  surface.draw(s, tone, { skin, crease: 0.35, light: 0.2, key: 0.25, mottle: 0.22, cavity: 0.35, moss: o.moss ?? 0 });
  edge.draw(s, tone, { skin: 'flat', smooth: false, light: 0, mottle: 0.1, cavity: 0.2, shifts: undefined });
  under.draw(s, [P.umber, P.timber, P.oakDark], { smooth: false, light: 0, mottle: 0.15 });
  // Ridge and hip caps, rounded, a shade darker than the slopes.
  const cap = typeof tone === 'number' ? tone : tone.slice(0, Math.max(2, tone.length - 1));
  const capO = { cap: 'both' as const, skin: 'flat' as Skin, turn: Math.PI / 6 };
  const sides = fine(s) ? 6 : 4;
  const ridgeHalf = kind === 'gable' ? W + 0.04 : kind === 'hip' ? Math.max(0, Wh - D) : Math.max(0, W - zt);
  if (ridgeHalf > 0.05) s.tube([[x - ridgeHalf, top + 0.04, z], [x + ridgeHalf, top + 0.04, z]], [0.17, 0.17], sides, cap, capO);
  const hipFoot = kind === 'hip' ? [Wh, eaveY, D] : [W, yt, zt];
  if (kind !== 'gable')
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      s.tube([[x + sx * hipFoot[0], hipFoot[1] + lip, z + sz * hipFoot[2]], [x + sx * ridgeHalf, top + 0.04, z]], [0.13, 0.15], sides, cap, capO);
  // Barge boards on the verges, the ridge beam's ends, and the purlins' ends under them.
  if (kind !== 'hip') {
    const endY = kind === 'gable' ? top : yt, endZ = kind === 'gable' ? 0 : zt, drop = thick + 0.14;
    for (const sx of [-1, 1]) {
      const bx = x + sx * (W + 0.03);
      for (const sz of [-1, 1]) timber(s, [bx, eaveY - drop, z + sz * D], [bx, endY - drop, z + sz * endZ], 0.12, TIMBER, { height: 0.3 });
      if (kind === 'gable') timber(s, [x + sx * (w / 2 - 0.2), top - 0.28, z], [x + sx * (W + 0.32), top - 0.28, z], 0.26);
      if (fine(s) && kind === 'gable')
        for (const f of [0.55]) for (const sz of [-1, 1]) {
          const py = eaveY + (top - eaveY) * f - thick - 0.16, pz = z + sz * D * (1 - f);
          timber(s, [x + sx * (w / 2 - 0.1), py, pz], [x + sx * (W + 0.18), py, pz], 0.16);
        }
    }
  }
  // Rafter ends under the eaves, from the wall out to the fascia.
  const tails = o.tails ?? 1.4;
  if (tails > 0 && fine(s))
    for (const sz of [-1, 1]) {
      const n = Math.max(2, Math.round(w / tails));
      for (let i = 0; i <= n; i++) {
        const px = x - w / 2 + 0.15 + ((w - 0.3) * i) / n;
        timber(s, [px, wallTop - 0.1, z + sz * (d / 2 - 0.1)], [px, eaveY - thick - 0.04, z + sz * (D - 0.12)], 0.13);
      }
    }
  if (kind !== 'hip' && (o.gables ?? 'king') !== 'none')
    for (const sx of o.gableEnd ? [o.gableEnd] : [-1, 1])
      s.at(x + sx * (w / 2), 0, z, (sx * Math.PI) / 2, () => gable(s, 0, wallTop, 0, d, rise + y - wallTop - thick, { frame: o.gables === 'none' ? 'king' : o.gables, clip: kind === 'half-hip' ? t : 1 }));
  for (const dm of o.dormers ?? []) dormer(s, x, y, z, d, pitch, dm, { ...o, dormers: [], sag: 0 });
  s.weather(start, { sag: o.sag ?? 0, wear: 0.3 });
}

function dormer(s: Shape, x: number, y: number, z: number, d: number, pitch: number, dm: Dormer, o: RoofOptions): void {
  const w = dm.w ?? 1.6, h = dm.h ?? 1.5, front = d / 2 - 0.15;
  const floor = y + (d / 2 - front) * pitch - 0.25, head = floor + h, rise = w * 0.45;
  // Where the dormer's head and ridge meet the main slope, back from its front.
  const backHead = d / 2 - (head - y) / pitch, backRidge = d / 2 - (head + rise - y) / pitch;
  s.at(x + dm.x * dm.side, 0, z, dm.side > 0 ? 0 : Math.PI, () => {
    wall(s, 0, floor, front, w, h, { openings: [{ kind: 'window', x: 0, y: 0.25, w: w * 0.5, h: h * 0.62, shutters: false }], frame: 'none', moss: 0, patches: 0, posts: true });
    for (const side of [-1, 1]) {
      const cx = side * (w / 2);
      s.mesh([cx, floor, front, cx, head, front, cx, head, backHead], [0, 1, 2], PLASTER, { hints: [side, 0, 0, side, 0, 0, side, 0, 0], skin: 'plaster', light: 0.1 });
    }
    s.at(0, 0, (front + backRidge) / 2, Math.PI / 2, () => roof(s, 0, head, 0, front - backRidge + 0.3, w, { ...o, rise, overhang: 0.25, verge: 0.2, tails: 0, kind: 'gable', gables: 'king', gableEnd: -1 }));
  });
}

export type GableFrame = 'king' | 'cross' | 'queen' | 'plain';

/**
 * A gable end: a plaster triangle `w` wide and `rise` high on the wall top at y, facing +z, with its timbers.
 * 'king' is a tie, a king post and two struts; 'queen' two posts and a collar; 'cross' a collar with an X
 * above it; 'plain' the tie alone. `clip` (0 to 1) stops it at that share of the rise for a half-hip.
 * About 20 triangles and 12 a timber.
 */
export function gable(s: Shape, x: number, y: number, z: number, w: number, rise: number, o: { frame?: GableFrame; clip?: number; tone?: Tone; size?: number } = {}): void {
  const clip = Math.min(1, o.clip ?? 1), hw = w / 2, size = o.size ?? 0.2, top = rise * clip, topW = hw * (1 - clip);
  const b = new Batch();
  const rows = 3;
  const pts: number[][] = [];
  for (let r = 0; r <= rows; r++) {
    const v = (top * r) / rows, half = hw * (1 - v / rise);
    pts.push([b.add(x - half, y + v, z, 0, 0, 1), b.add(x, y + v, z, 0, 0, 1), b.add(x + half, y + v, z, 0, 0, 1)]);
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < 2; c++) b.quad(pts[r][c], pts[r][c + 1], pts[r + 1][c + 1], pts[r + 1][c]);
  b.draw(s, o.tone ?? PLASTER, { skin: 'plaster', light: 0.1, mottle: 0.2, cavity: 0.3 });
  const f = z + size / 2 - 0.03;
  const at = (u: number, v: number): V3 => [x + u, y + v, f];
  const rake = (v: number) => hw * (1 - v / rise) - size * 0.6;
  timber(s, at(-hw, size / 2), at(hw, size / 2), size);
  const frame = o.frame ?? 'king';
  if (clip < 1) timber(s, at(-topW, top - size / 2), at(topW, top - size / 2), size);
  if (frame === 'king' || frame === 'cross') {
    const collar = Math.min(top - size, rise * 0.45);
    if (frame === 'king') {
      timber(s, at(0, size), at(0, Math.min(top, rise - size)), size * 1.1);
      for (const side of [-1, 1]) timber(s, at(side * size * 0.6, rise * 0.12), at(side * rake(collar + rise * 0.2) * 0.8, collar + rise * 0.2), size * 0.8);
    } else {
      timber(s, at(-rake(collar), collar), at(rake(collar), collar), size);
      const up = Math.min(top - size * 0.5, rise * 0.85);
      for (const side of [-1, 1]) timber(s, at(side * rake(collar) * 0.9, collar), at(-side * rake(up) * 0.5, up), size * 0.8);
    }
  } else if (frame === 'queen') {
    const collar = Math.min(top - size, rise * 0.55);
    timber(s, at(-rake(collar), collar), at(rake(collar), collar), size);
    for (const side of [-1, 1]) timber(s, at(side * hw * 0.35, size), at(side * hw * 0.35, collar), size);
  }
}

// ---------------------------------------------------------------- walls and openings

export interface Opening {
  /** 'window', 'door', or 'arch': an open archway, dark inside. */
  kind: 'window' | 'door' | 'arch';
  /** Its middle along the wall, from the wall's middle. */
  x: number;
  /** Its foot above the wall's foot. Default 1 for a window, 0 otherwise. */
  y?: number;
  /** The clear opening: width, and height to the top of its head or its arch. */
  w: number;
  h: number;
  /** 'square' (default for windows) or 'arch' (round-headed; default for doors and archways). */
  top?: 'square' | 'arch';
  /** 'timber' (default on plaster), 'stone' (default on stone and for arches) or 'none'. */
  frame?: 'timber' | 'stone' | 'none';
  /** Two lights side by side under one head, with a mullion between. */
  pair?: boolean;
  /** Open shutters either side. Default true on square windows. */
  shutters?: boolean;
  /** Glazing bars: 'cross' (default), 'grid' or 'none'. */
  bars?: 'cross' | 'grid' | 'none';
  /** Door leaves, 1 or 2. Default 1, 2 when wider than 1.6. */
  leaves?: 1 | 2;
  /** An archway's inside: how deep, and its color. Default 1.2 and umber. */
  inside?: number;
  insideTone?: Tone;
  /** An archway's back glows: 1 when it is dark, 2 always. An oven's fire. */
  insideGlow?: number;
  /** Windows glow when it is dark; 0 keeps a window dark. Default 1. */
  glow?: number;
}

export interface WallOptions {
  /** 'plaster' (default) over a stone `plinth`, or 'stone' coursed all the way up. */
  material?: 'plaster' | 'stone';
  tone?: Tone;
  stone?: StoneOptions;
  /** Height of the coursed stone base under plaster. Default 0. */
  plinth?: number;
  /** How deep the openings' reveals are. Default 0.25. */
  depth?: number;
  /**
   * Timber framing over plaster: 'cottage' (posts, a head and knee braces under it), 'close' (the same with
   * a long diagonal in each lower bay), 'civic' (close posts, sill, X braces in the top band) or 'none'.
   */
  frame?: 'cottage' | 'close' | 'civic' | 'none';
  /** Heights above y of the framing's rails, besides its sill and head. */
  rails?: readonly number[];
  /** Meters between framing posts. Default 2.2 (1.4 for civic). */
  bay?: number;
  /** Posts at both ends (on by default with a frame); false when the corners are someone else's. */
  posts?: boolean;
  openings?: readonly Opening[];
  /** Plaster repairs and fallen patches showing the stone under it. Default 2; none at low detail. */
  patches?: number;
  /** Damp and moss up from the ground, in meters. Default 0.6. */
  moss?: number;
  /** Streaks under each sill. Default true. */
  stains?: boolean;
}

/**
 * A wall `w` wide and `h` high, standing on y with its face at z looking +z, with its openings cut through:
 * windows, doors and archways with their reveals, frames, sills and shutters. Plaster walls stand on a
 * coursed `plinth` and carry timber framing; stone walls are coursed all the way up. It ages itself: damp
 * and moss at its foot, streaks under its sills, worn edges. The face is cut only where the openings need
 * it: a plain plaster wall is about 30 triangles, a window 60 to 150, a door 90, a stone wall 10 a block.
 */
export function wall(s: Shape, x: number, y: number, z: number, w: number, h: number, o: WallOptions = {}): void {
  const start = s.mark();
  const stone = o.material === 'stone', depth = o.depth ?? 0.25;
  const openings = (o.openings ?? []).map((q) => ({ ...q, y: q.y ?? (q.kind === 'window' ? 1 : 0), top: q.top ?? (q.kind === 'window' ? 'square' : 'arch') }));
  const plinth = stone ? 0 : Math.min(h, o.plinth ?? 0);
  const x0 = x - w / 2;
  // The holes, in the face's meters from its left foot.
  const holes = openings.map((q) => ({ u0: q.x + w / 2 - q.w / 2, u1: q.x + w / 2 + q.w / 2, v0: q.y, v1: q.y + q.h, arch: q.top === 'arch', spring: q.top === 'arch' ? q.y + q.h - q.w / 2 : q.y + q.h }));
  if (stone) {
    const ring = 0.4;
    ashlar(s, x, y, z - 0.25, w, h, 0.5, { ...o.stone, tone: o.stone?.tone ?? o.tone, faces: '+z', holes: holes.map((q) => ({ u0: q.u0 - (q.arch ? ring : 0), u1: q.u1 + (q.arch ? ring : 0), v0: q.v0, v1: q.arch ? q.spring + (q.u1 - q.u0) / 2 + ring : q.v1 })) });
    // Above each arch, the corners between its ring and the courses.
    for (const q of openings) if (q.top === 'arch') stoneArch(s, x + q.x, y + q.y, z, q.w, q.h - q.w / 2, { ...o.stone, tone: o.stone?.tone ?? o.tone, ring: 0.4, depth, jambs: false, spandrels: true });
  } else {
    if (plinth > 0) ashlar(s, x, y, z - 0.2, w + 0.04, plinth, 0.48, { ...o.stone, faces: '+z+y' });
    const xs = new Set<number>([0, w]), ys = new Set<number>([plinth, h]);
    if (h > 1.2 + plinth) ys.add(Math.min(h, plinth + 0.7));
    for (const q of holes) {
      xs.add(q.u0); xs.add(q.u1);
      ys.add(Math.max(plinth, q.v0)); ys.add(q.spring); ys.add(Math.min(h, q.v1));
    }
    const us = [...xs].filter((u) => u >= 0 && u <= w).sort((a, b) => a - b), vs = [...ys].filter((v) => v >= plinth && v <= h).sort((a, b) => a - b);
    const b = new Batch();
    const pt = (u: number, v: number) => b.add(x0 + u, y + v, z, 0, 0, 1, u, v);
    for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < vs.length - 1; j++) {
      const um = (us[i] + us[i + 1]) / 2, vm = (vs[j] + vs[j + 1]) / 2;
      const hole = holes.find((q) => um > q.u0 && um < q.u1 && vm > q.v0 && vm < q.v1);
      if (!hole) { b.quad(pt(us[i], vs[j]), pt(us[i + 1], vs[j]), pt(us[i + 1], vs[j + 1]), pt(us[i], vs[j + 1])); continue; }
      if (!hole.arch || vm < hole.spring) continue;
      // The corners above a round head, fanned from the cell's top corners.
      const r = (hole.u1 - hole.u0) / 2, cx = hole.u0 + r, m = 8;
      const arc = (k: number) => { const a = Math.PI - (k * Math.PI) / m; return pt(cx + Math.cos(a) * r, hole.spring + Math.sin(a) * r); };
      const tl = pt(us[i], vs[j + 1]), tr = pt(us[i + 1], vs[j + 1]);
      for (let k = 0; k < m; k++) b.tri(k < m / 2 ? tl : tr, arc(k), arc(k + 1));
      b.tri(tl, arc(m / 2), tr);
    }
    b.draw(s, o.tone ?? PLASTER, { skin: 'plaster', light: 0.1, key: 0.12, mottle: 0.22, cavity: 0.35 });
    if (fine(s)) patches(s, x, y + plinth, z, w, h - plinth, holes, o.patches ?? 2, o.stone);
  }
  for (const q of openings) {
    const at = x + q.x, foot = y + q.y;
    const frame = q.frame ?? (stone || q.kind === 'arch' ? 'stone' : 'timber');
    reveal(s, at, foot, z, q.w, q.h, q.top === 'arch', depth, stone ? (o.stone?.tone ?? o.tone ?? HONEY) : PLASTER, q.kind !== 'door' || q.y > 0.05);
    if (q.kind === 'window') windowIn(s, at, foot, z, depth, q, frame === 'stone' && !stone ? 'stone' : frame === 'timber' ? 'timber' : 'none', o.stone);
    else if (q.kind === 'door') doorIn(s, at, foot, z - depth * 0.7, q);
    else {
      const d = q.inside ?? 1.2, back = z - depth - d;
      const b = new Batch();
      const r = q.w / 2, spring = q.top === 'arch' ? q.h - r : q.h;
      b.quad(b.add(at - r, foot, back, 0, 0, 1), b.add(at + r, foot, back, 0, 0, 1), b.add(at + r, foot + spring, back, 0, 0, 1), b.add(at - r, foot + spring, back, 0, 0, 1));
      if (q.top === 'arch') for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 8, c = ((k + 1) * Math.PI) / 8;
        b.tri(b.add(at, foot + spring, back, 0, 0, 1), b.add(at + Math.cos(a) * r, foot + spring + Math.sin(a) * r, back, 0, 0, 1), b.add(at + Math.cos(c) * r, foot + spring + Math.sin(c) * r, back, 0, 0, 1));
      }
      for (const side of [-1, 1]) b.quad(b.add(at + side * r, foot, z - depth, -side, 0, 0), b.add(at + side * r, foot, back, -side, 0, 0), b.add(at + side * r, foot + spring, back, -side, 0, 0), b.add(at + side * r, foot + spring, z - depth, -side, 0, 0));
      b.quad(b.add(at - r, foot, z - depth, 0, 1, 0), b.add(at + r, foot, z - depth, 0, 1, 0), b.add(at + r, foot, back, 0, 1, 0), b.add(at - r, foot, back, 0, 1, 0));
      b.draw(s, q.insideTone ?? [P.ink, P.umber, P.bark], { light: 0.1, mottle: 0.1, cavity: 0.6 });
      if (q.insideGlow) {
        // The fire: a low glowing bed at the back of the opening.
        const fire = new Batch(), fz = back + 0.05, top = Math.min(spring, 0.7);
        fire.quad(fire.add(at - r * 0.7, foot, fz, 0, 0, 1), fire.add(at + r * 0.7, foot, fz, 0, 0, 1), fire.add(at + r * 0.5, foot + top, fz, 0, 0, 1), fire.add(at - r * 0.5, foot + top, fz, 0, 0, 1));
        fire.draw(s, [P.rust, P.coral, P.apricot], { glow: q.insideGlow, light: 0, cavity: 0 });
        s.light(at, foot + 0.6, z + 0.5);
      }
    }
    if (frame === 'stone' && !stone) stoneArchFrame(s, at, foot, z, q, o.stone);
  }
  if (!stone && (o.frame ?? 'none') !== 'none')
    framing(s, x, y + plinth, z, w, h - plinth, o, (o.rails ?? []).map((v) => v - plinth), holes.map((q) => ({ ...q, v0: q.v0 - plinth, v1: q.v1 - plinth })));
  const stains = o.stains ?? true;
  s.weather(start, {
    moss: o.moss ?? 0.6,
    wear: 0.5,
    stains: stains ? openings.filter((q) => q.kind === 'window').map((q) => [x + q.x, y + q.y - 0.12, z, q.w * 0.9, Math.min(1.4, q.y + 0.2)]) : undefined,
  });
}

/** The sides, head and sill of an opening, from the face back `depth`. */
function reveal(s: Shape, x: number, y: number, z: number, w: number, h: number, arch: boolean, depth: number, tone: Tone, sill: boolean): void {
  const b = new Batch(), r = w / 2, spring = arch ? h - r : h, back = z - depth;
  for (const side of [-1, 1]) b.quad(b.add(x + side * r, y, z, -side, 0, 0), b.add(x + side * r, y + spring, z, -side, 0, 0), b.add(x + side * r, y + spring, back, -side, 0, 0), b.add(x + side * r, y, back, -side, 0, 0));
  if (sill) b.quad(b.add(x - r, y, z, 0, 1, 0), b.add(x + r, y, z, 0, 1, 0), b.add(x + r, y, back, 0, 1, 0), b.add(x - r, y, back, 0, 1, 0));
  if (arch) {
    const m = fine(s) ? 8 : 5;
    for (let k = 0; k < m; k++) {
      const a = (k * Math.PI) / m, c = ((k + 1) * Math.PI) / m;
      const p = (t: number, zz: number) => b.add(x + Math.cos(t) * r, y + spring + Math.sin(t) * r, zz, -Math.cos(t), -Math.sin(t), 0);
      b.quad(p(a, z), p(c, z), p(c, back), p(a, back));
    }
  } else b.quad(b.add(x - r, y + h, z, 0, -1, 0), b.add(x + r, y + h, z, 0, -1, 0), b.add(x + r, y + h, back, 0, -1, 0), b.add(x - r, y + h, back, 0, -1, 0));
  b.draw(s, tone, { skin: 'plaster', light: 0.15, mottle: 0.15, cavity: 0.5 });
}

/** A pane of glass, square or round-headed, at z, glowing at night. */
function pane(s: Shape, x: number, y: number, z: number, w: number, h: number, arch: boolean, glow: number): void {
  const b = new Batch(), r = w / 2, spring = arch ? h - r : h;
  b.quad(b.add(x - r, y, z, 0, 0, 1), b.add(x + r, y, z, 0, 0, 1), b.add(x + r, y + spring, z, 0, 0, 1), b.add(x - r, y + spring, z, 0, 0, 1));
  if (arch) {
    const c = b.add(x, y + spring, z, 0, 0, 1);
    const m = fine(s) ? 8 : 5;
    for (let k = 0; k < m; k++) b.tri(c, b.add(x + Math.cos((k * Math.PI) / m) * r, y + spring + Math.sin((k * Math.PI) / m) * r, z, 0, 0, 1), b.add(x + Math.cos(((k + 1) * Math.PI) / m) * r, y + spring + Math.sin(((k + 1) * Math.PI) / m) * r, z, 0, 0, 1));
  }
  b.draw(s, GLASS, { glow, light: 0, mottle: 0.35, cavity: 0 });
}

function windowIn(s: Shape, x: number, y: number, face: number, depth: number, q: Opening & { y: number; top: 'square' | 'arch' }, frame: 'timber' | 'stone' | 'none', stone?: StoneOptions): void {
  const arch = q.top === 'arch', glow = q.glow ?? 1, f = fine(s), z = face - depth;
  const lights = q.pair ? [-q.w / 4, q.w / 4] : [0];
  const lw = q.pair ? q.w / 2 - 0.08 : q.w;
  for (const dx of lights) pane(s, x + dx, y, z + 0.01, lw, arch && q.pair ? q.h : q.h, arch, glow);
  if (glow > 0) s.light(x, y + q.h * 0.5, z + 0.6);
  if (q.pair) timber(s, [x, y, z + 0.06], [x, y + q.h - (arch ? 0 : 0.05), z + 0.06], 0.16, frame === 'stone' ? (stone?.tone ?? HONEY) : TIMBER, { skin: frame === 'stone' ? 'limestone' : 'grain' });
  // Glazing bars: thin timbers proud of the glass.
  const bars = q.bars ?? 'cross';
  if (bars !== 'none' && f)
    for (const dx of lights) {
      const cx = x + dx, spring = arch ? q.h - lw / 2 : q.h, bz = z + 0.04;
      timber(s, [cx, y, bz], [cx, y + (arch ? q.h - 0.02 : spring), bz], 0.05, TIMBER);
      const rows = bars === 'grid' ? [spring * 0.33, spring * 0.66] : [spring * 0.55];
      for (const v of rows) timber(s, [cx - lw / 2, y + v, bz], [cx + lw / 2, y + v, bz], 0.05, TIMBER);
    }
  if (frame === 'timber') {
    const r = q.w / 2 + 0.08, top = arch ? q.h - q.w / 2 : q.h;
    for (const side of [-1, 1]) timber(s, [x + side * r, y - 0.05, face + 0.04], [x + side * r, y + top + 0.12, face + 0.04], 0.16);
    if (!arch) timber(s, [x - r - 0.18, y + q.h + 0.1, face + 0.05], [x + r + 0.18, y + q.h + 0.1, face + 0.05], 0.2);
    else timber(s, [x - r, y + top + 0.12, face + 0.04], [x + r, y + top + 0.12, face + 0.04], 0.12);
  }
  // A sill that sheds the rain, standing out from the wall.
  if (frame !== 'none' || q.y > 0.3) timber(s, [x - q.w / 2 - 0.2, y - 0.07, face + 0.06], [x + q.w / 2 + 0.2, y - 0.07, face + 0.06], 0.3, frame === 'stone' ? (stone?.tone ?? HONEY) : TIMBER, { height: 0.12, skin: frame === 'stone' ? 'limestone' : 'grain' });
  if ((q.shutters ?? !arch) && !q.pair)
    for (const side of [-1, 1]) {
      const sw = q.w / 2 + 0.04, sx = x + side * (q.w / 2 + 0.1 + sw / 2), sz = face + 0.08;
      s.box(sx, y + 0.02, sz - 0.05, sw, q.h - 0.04, 0.07, side < 0 ? P.plank : P.plankPale, { skin: 'grain', skip: '-z' });
      if (f) for (const v of [0.18, q.h - 0.3]) s.poly([[sx - sw * 0.47, y + v, sz + 0.025], [sx + sw * 0.47, y + v, sz + 0.025], [sx + sw * 0.47, y + v + 0.07, sz + 0.025], [sx - sw * 0.47, y + v + 0.07, sz + 0.025]], P.timber, { skin: 'grain' });
    }
}

/** A stone surround on a plaster wall: jambs and a voussoir ring for round heads, jambs and a lintel for square. */
function stoneArchFrame(s: Shape, x: number, y: number, z: number, q: Opening & { y: number; top: 'square' | 'arch' }, stone?: StoneOptions): void {
  const ring = q.kind === 'window' ? 0.24 : 0.36;
  if (q.top === 'arch') stoneArch(s, x, y, z + 0.08, q.w, q.h - q.w / 2, { ...stone, ring, depth: 0.12, course: q.kind === 'window' ? 0.45 : 0.6, behind: () => -0.1 });
  else {
    stoneArch(s, x, y, z + 0.08, q.w, q.h, { ...stone, ring, depth: 0.12, course: 0.5, stones: 0, behind: () => -0.1 });
    stoneBlock(s, x, y + q.h, z + 0.04, q.w + ring * 2.3, 0.32, 0.2, { ...stone, faces: '+z+y+x-x' });
  }
}

function doorIn(s: Shape, x: number, y: number, z: number, q: Opening & { y: number; top: 'square' | 'arch' }): void {
  const r = q.w / 2, arch = q.top === 'arch', spring = arch ? q.h - r : q.h, leaves = q.leaves ?? (q.w > 1.6 ? 2 : 1);
  const b = new Batch();
  const planks = Math.max(3, Math.round(q.w / 0.24));
  // One face a plank, so each takes its own shade, square or under the round head.
  for (let i = 0; i < planks; i++) {
    const u0 = -r + (q.w * i) / planks, u1 = -r + (q.w * (i + 1)) / planks;
    const head = (u: number) => (arch ? spring + Math.sqrt(Math.max(0, r * r - u * u)) : q.h);
    const shift = (s.r() - 0.5) * 0.3;
    b.quad(b.add(x + u0 + 0.008, y, z, 0, 0, 1, u0, 0, shift), b.add(x + u1 - 0.008, y, z, 0, 0, 1, u1, 0, shift), b.add(x + u1 - 0.008, y + head(u1), z, 0, 0, 1, u1, head(u1), shift), b.add(x + u0 + 0.008, y + head(u0), z, 0, 0, 1, u0, head(u0), shift));
  }
  // A dark backing shows in the seams between planks.
  b.quad(b.add(x - r, y, z - 0.02, 0, 0, 1), b.add(x + r, y, z - 0.02, 0, 0, 1), b.add(x + r, y + spring, z - 0.02, 0, 0, 1), b.add(x - r, y + spring, z - 0.02, 0, 0, 1));
  b.draw(s, [P.oakDark, P.wood, P.oak, P.plank], { skin: 'grain', light: 0.05, mottle: 0.25, cavity: 0.4 });
  const iron = [P.ink, P.night, P.slate];
  if (fine(s)) for (const v of [0.35, spring - 0.3]) for (const side of leaves === 2 ? [-1, 1] : [0]) {
    const cx = leaves === 2 ? x + side * r / 2 : x, len = leaves === 2 ? r * 0.85 : q.w * 0.85;
    timber(s, [cx - len / 2, y + v, z + 0.03], [cx + len / 2, y + v, z + 0.03], 0.06, iron, { height: 0.07, skin: 'flat' });
  }
  if (leaves === 2) timber(s, [x, y, z + 0.02], [x, y + q.h - 0.05, z + 0.02], 0.05, [P.umber, P.timber]);
  for (const side of leaves === 2 ? [-1, 1] : [1]) s.cyl(x + side * (leaves === 2 ? 0.14 : r * 0.55), y + 1.0, z + 0.03, 0.05, 0.05, 0.05, 6, P.iron);
  // The threshold.
  stoneBlock(s, x, y - 0.06, z + 0.25, q.w + 0.3, 0.12, 0.7, { faces: '+z+y', flat: true });
}

/** Timber framing over a plaster face whose foot is at y: posts, sill, head and rails, and braces in the clear bays. */
function framing(s: Shape, x: number, y: number, z: number, w: number, h: number, o: WallOptions, rails: readonly number[], holes: readonly Hole[]): void {
  const civic = o.frame === 'civic', size = civic ? 0.22 : 0.2, bay = o.bay ?? (civic ? 1.6 : 2.2), f = z + size / 2 - 0.04, x0 = x - w / 2;
  const posts: number[] = (o.posts ?? true) ? [size / 2, w - size / 2] : [];
  const near = (u: number, gap: number) => posts.some((p) => Math.abs(p - u) < gap);
  // Posts flank every opening that reaches the head's half, then fill the bays between.
  for (const q of holes) for (const u of [q.u0 - size * 0.7, q.u1 + size * 0.7]) if (q.v1 > h * 0.5 && u > size && u < w - size && !near(u, size * 2.5)) posts.push(u);
  const n = Math.max(1, Math.round(w / bay));
  for (let i = 1; i < n; i++) {
    const u = (w * i) / n;
    if (u > size && u < w - size && !near(u, bay * 0.45) && !holes.some((q) => u > q.u0 - size && u < q.u1 + size)) posts.push(u);
  }
  posts.sort((a, b) => a - b);
  for (const u of posts) timber(s, [x0 + u, y, f], [x0 + u, y + h, f], size);
  // Sill, head and rails, broken where an opening passes.
  const rail = (v: number, thick: number) => {
    let pieces: [number, number][] = [[0, w]];
    for (const q of holes) if (v > q.v0 - thick && v < q.v1 + thick) pieces = pieces.flatMap(([a, b]): [number, number][] => (q.u1 <= a || q.u0 >= b ? [[a, b]] : [[a, q.u0], [q.u1, b]])).filter(([m, k]) => k - m > 0.3);
    for (const [a, b] of pieces) timber(s, [x0 + a, y + v, f + 0.01], [x0 + b, y + v, f + 0.01], thick);
  };
  const inner = rails.filter((v) => v > 0.3 && v < h - 0.3);
  if (civic) rail(size / 2, size);
  rail(h - size / 2, size * 1.2);
  for (const v of inner) rail(v, size);
  // Braces, in each bay and band clear of openings: an X in a civic wall's top band, knee braces under
  // every other head, and a long diagonal in a cottage's lower bands.
  const bands = [0, ...inner, h];
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i] + size / 2, b = posts[i + 1] - size / 2;
    if (b - a < 0.6) continue;
    for (let j = 0; j < bands.length - 1; j++) {
      const v0 = bands[j] + size, v1 = bands[j + 1] - size, last = j === bands.length - 2;
      if (v1 - v0 < 0.6 || holes.some((q) => q.u1 > a && q.u0 < b && q.v1 > v0 && q.v0 < v1)) continue;
      if (civic && last) {
        timber(s, [x0 + a, y + v0, f], [x0 + b, y + v1, f], size * 0.8);
        timber(s, [x0 + b, y + v0, f + 0.02], [x0 + a, y + v1, f + 0.02], size * 0.8);
      } else if (civic || last || h - v1 < 1.4) {
        const reach = Math.min(0.9, (b - a) / 2, v1 - v0);
        timber(s, [x0 + a, y + v1 - reach, f], [x0 + a + reach, y + v1, f], size * 0.75);
        timber(s, [x0 + b, y + v1 - reach, f], [x0 + b - reach, y + v1, f], size * 0.75);
      } else if (o.frame === 'close') {
        if (i % 2) timber(s, [x0 + a, y + v0, f], [x0 + b, y + v1, f], size * 0.8);
        else timber(s, [x0 + b, y + v0, f], [x0 + a, y + v1, f], size * 0.8);
      }
    }
  }
}

/** Plaster repairs a shade off the wall, and a few patches fallen away to the stone under it. */
function patches(s: Shape, x: number, y: number, z: number, w: number, h: number, holes: readonly Hole[], count: number, stone?: StoneOptions): void {
  const free = (u: number, v: number, r: number) => !holes.some((q) => u + r > q.u0 - 0.2 && u - r < q.u1 + 0.2 && v + r > q.v0 - 0.2 && v - r < q.v1 + 0.2);
  for (let i = 0, tries = 0; i < count && tries < 30; tries++) {
    const r = s.rr(0.25, 0.5), u = s.rr(r + 0.25, w - r - 0.25), v = s.rr(r + 0.1, Math.min(h - r - 0.2, 2.2));
    if (!free(u, v, r) || w < 1.2 || h < 1) continue;
    i++;
    const bare = i % 2 === 0;
    const sides = 7, pts: number[] = [], tris: number[] = [], hints: number[] = [];
    pts.push(x - w / 2 + u, y + v, z + 0.006);
    hints.push(0, 0, 1);
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2, rr = r * s.rr(0.6, 1.15);
      pts.push(x - w / 2 + u + Math.cos(a) * rr * 1.3, y + v + Math.sin(a) * rr, z + 0.006);
      hints.push(0, 0, 1);
      tris.push(0, 1 + k, 1 + ((k + 1) % sides));
    }
    if (bare) {
      // The wall's stone shows where the plaster has fallen: a few block faces, set back a little.
      s.mesh(pts, tris, [P.iron, P.burlap], { hints, skin: 'plaster', light: 0, mottle: 0.2, cavity: 0 });
      const bw = r * 1.1;
      for (const [du, dv] of [[-bw / 2, -0.12], [bw / 2, -0.12], [0, 0.18]]) stoneBlock(s, x - w / 2 + u + du, y + v + dv - 0.13, z + 0.02, bw * 0.95, 0.27, 0.03, { ...stone, faces: '+z', chip: 0.5 });
    } else s.mesh(pts, tris, [P.sand, P.plaster, P.plasterLight, P.bone], { hints, skin: 'plaster', light: 0, mottle: 0.3, cavity: 0, shifts: pts.map(() => 0.15) });
  }
}

// ---------------------------------------------------------------- porches, steps, chimneys and the rest

export interface PorticoOptions {
  /** Ridge height above the beams. Default 0.45 × w. */
  rise?: number;
  /** Posts across the front: 2 (default) or 4. */
  posts?: 2 | 4;
  /** Height of the stone pedestals under the posts. Default 1. */
  pedestal?: number;
  /** The floor's height, on coursed stone, with steps down in front. Default 0.5. */
  floor?: number;
  /** How many steps down from the floor, and how far they come forward. Default a step each 0.18 m, 2.4 × the floor. */
  steps?: number;
  run?: number;
  roof?: RoofOptions;
  /** The gable's timbers. Default 'king'. */
  frame?: GableFrame;
  /** Banners hung from the front beam, this far either side of the middle. */
  banners?: number;
  bannerTone?: Tone;
  stone?: StoneOptions;
}

/**
 * A columned porch `w` wide reaching `d` out from a wall whose face is at z, its beams at height h: posts on
 * stone pedestals, beams with knee braces, a gabled roof with its truss shown, a raised floor and steps.
 * About 1,000 triangles with two posts.
 */
export function portico(s: Shape, x: number, y: number, z: number, w: number, d: number, h: number, o: PorticoOptions = {}): void {
  const floor = o.floor ?? 0.5, ped = o.pedestal ?? 1, n = o.posts ?? 2, size = 0.34;
  if (floor > 0) {
    ashlar(s, x, y, z + d / 2, w + 0.4, floor, d, { ...o.stone, faces: '+z+x-x+y', course: floor });
    steps(s, x, y, z + d, Math.min(w - 0.6, w * 0.7), floor, o.run ?? Math.max(1, floor * 2.4), { n: o.steps, stone: o.stone });
  }
  const fy = y + floor, fz = z + d - 0.4;
  const xs = n === 4 ? [-w / 2 + 0.4, -w / 6, w / 6, w / 2 - 0.4] : [-w / 2 + 0.4, w / 2 - 0.4];
  for (const px of xs) {
    stoneBlock(s, x + px, fy, fz, 0.75, ped, 0.75, { ...o.stone, faces: '+z+x-x+y-z' });
    timber(s, [x + px, fy + ped, fz], [x + px, y + h, fz], size);
    const reach = 0.85;
    for (const side of px < 0 ? [1] : [-1]) timber(s, [x + px, y + h - reach, fz], [x + px + side * reach, y + h, fz], size * 0.7);
    timber(s, [x + px, y + h - reach, fz], [x + px, y + h, fz - reach], size * 0.7);
  }
  timber(s, [x - w / 2 - 0.2, y + h + 0.15, fz], [x + w / 2 + 0.2, y + h + 0.15, fz], size * 1.1, TIMBER, { height: 0.36 });
  for (const side of [-1, 1]) timber(s, [x + side * (w / 2 - 0.4), y + h + 0.15, z - 0.2], [x + side * (w / 2 - 0.4), y + h + 0.15, fz + 0.3], size);
  const rise = o.rise ?? w * 0.45;
  s.at(x, 0, z + d / 2 - 0.25, Math.PI / 2, () => roof(s, 0, y + h + 0.33, 0, d + 0.5, w, { rise, overhang: 0.5, verge: 0.4, tails: 0, gables: o.frame ?? 'king', gableEnd: -1, ...o.roof }));
  if (o.banners) for (const side of [-1, 1]) banner(s, x + side * o.banners, y + h, fz + 0.25, 1, 2.6, { tone: o.bannerTone });
  s.shadowBox(x, y + h, z + d / 2, w + 1, rise, d + 1);
}

/** A flight of stone steps `w` wide climbing `rise` to its top at z, coming forward `run` toward +z. About 20 triangles a block. */
export function steps(s: Shape, x: number, y: number, z: number, w: number, rise: number, run: number, o: { n?: number; stone?: StoneOptions } = {}): void {
  const n = o.n ?? Math.max(1, Math.round(rise / 0.18));
  for (let i = 0; i < n; i++) {
    const height = (rise * (n - i)) / n, out = (run * (i + 1)) / n, tread = run / n;
    const pieces = Math.max(1, Math.round(w / 1.6));
    for (let k = 0; k < pieces; k++) {
      const bw = w / pieces, bx = x - w / 2 + bw * (k + 0.5);
      stoneBlock(s, bx, y, z + out - tread / 2, bw, height, tread, { moss: 0, ...o.stone, faces: '+z+y' + (k === 0 ? '-x' : '') + (k === pieces - 1 ? '+x' : ''), chip: 0.4 });
    }
  }
}

/**
 * A chimney stack from y up to `top`, `w` by `d`: coursed stone or plaster, a corbelled band, a cap and its
 * pots, sooted at the mouth. About 250 triangles in stone.
 */
export function chimney(s: Shape, x: number, y: number, z: number, w: number, d: number, top: number, o: { material?: 'stone' | 'plaster'; pots?: number; stone?: StoneOptions } = {}): void {
  const start = s.mark();
  const h = top - y - 0.45;
  if (o.material === 'plaster') s.roundBox(x, y, z, w, h, d, PLASTER, { round: 0.06, wobble: 0.02, skin: 'plaster', skip: '-y' });
  else ashlar(s, x, y, z, w, h, d, { course: 0.75, long: [0.6, 1], ...o.stone, faces: '+z+x-x-z' });
  ashlar(s, x, y + h, z, w + 0.2, 0.22, d + 0.2, { course: 0.22, long: [9, 9], ...o.stone, faces: '+z+x-x-z+y' });
  for (let i = 0; i < (o.pots ?? 2); i++) {
    const px = x + (o.pots === 1 ? 0 : (i - 0.5) * w * 0.45);
    s.lathe(px, y + h + 0.22, z, [[0.13, 0], [0.15, 0.1], [0.11, 0.3], [0.12, 0.4]], [P.brick, P.rust, P.coral], { sides: 6, cap: false, skin: 'plaster' });
  }
  s.weather(start, { soot: 0.7, sootReach: 0.9, wear: 0.4 });
  s.shadowBox(x, y, z, w, h, d);
}

/** A timber balcony on brackets, its deck at y, reaching `d` out from the wall at z. About 300 triangles. */
export function balcony(s: Shape, x: number, y: number, z: number, w: number, d: number): void {
  s.box(x, y - 0.14, z + d / 2, w, 0.14, d, TIMBER, { skin: 'grain', bevel: fine(s) ? 0.03 : 0 });
  for (const px of [x - w / 2 + 0.2, x + w / 2 - 0.2]) timber(s, [px, y - 0.95, z + 0.05], [px, y - 0.12, z + d - 0.15], 0.14);
  const n = Math.max(3, Math.round(w / (fine(s) ? 0.32 : 0.6)));
  for (let i = 0; i <= n; i++) timber(s, [x - w / 2 + (w * i) / n, y, z + d - 0.06], [x - w / 2 + (w * i) / n, y + 0.95, z + d - 0.06], i % n === 0 ? 0.14 : 0.07);
  timber(s, [x - w / 2, y + 0.98, z + d - 0.06], [x + w / 2, y + 0.98, z + d - 0.06], 0.14, TIMBER, { height: 0.1 });
  for (const side of [-1, 1]) timber(s, [x + side * w / 2, y + 0.98, z + 0.05], [x + side * w / 2, y + 0.98, z + d - 0.06], 0.1);
}

/**
 * A cloth awning `w` wide from the wall at z and height y down to `drop` lower, `d` out, striped, with a
 * scalloped valance, on timber arms or on posts. About 120 triangles.
 */
export function awning(s: Shape, x: number, y: number, z: number, w: number, d: number, o: { drop?: number; stripes?: readonly Tone[]; posts?: boolean } = {}): void {
  const drop = o.drop ?? 0.7, stripes = o.stripes ?? [[P.ochre, P.gold, P.butter], [P.sand, P.plaster, P.plasterLight]];
  const n = Math.max(2, Math.round(w / 0.7)), sag = 0.12;
  for (let i = 0; i < n; i++) {
    const a = x - w / 2 + (w * i) / n, b = x - w / 2 + (w * (i + 1)) / n;
    const pts = [a, y, z, b, y, z, b, y - drop * 0.5 - sag, z + d * 0.5, a, y - drop * 0.5 - sag, z + d * 0.5, a, y - drop, z + d, b, y - drop, z + d];
    const cloth = stripes[i % stripes.length];
    s.mesh(pts, [0, 1, 2, 0, 2, 3, 3, 2, 5, 3, 5, 4], cloth, { hints: [0, 1, 0.5, 0, 1, 0.5, 0, 1, 0.5, 0, 1, 0.5, 0, 1, 0.5, 0, 1, 0.5], skin: 'flat', light: 0.3, mottle: 0.15 });
    const m = (a + b) / 2;
    s.mesh([a, y - drop, z + d, b, y - drop, z + d, m, y - drop - 0.28, z + d + 0.01], [0, 1, 2], cloth, { hints: [0, 0, 1, 0, 0, 1, 0, 0, 1], skin: 'flat', light: 0, mottle: 0.1 });
    s.mesh([a, y - drop, z + d, b, y - drop, z + d, m, y - drop - 0.28, z + d + 0.01], [0, 2, 1], cloth, { hints: [0, 0, -1, 0, 0, -1, 0, 0, -1], skin: 'flat', light: 0, mottle: 0.1 });
  }
  timber(s, [x - w / 2 - 0.05, y - drop, z + d], [x + w / 2 + 0.05, y - drop, z + d], 0.08);
  for (const side of [-1, 1]) {
    const px = x + side * (w / 2);
    if (o.posts) timber(s, [px, 0, z + d], [px, y - drop + 0.05, z + d], 0.14);
    else timber(s, [px, y - drop - 0.7, z + 0.05], [px, y - drop, z + d], 0.1);
  }
}

/** A cloth banner `w` wide hanging `h` from a rod at y, its tail cut in a swallowtail, a wheat sprig on it. About 60 triangles. */
export function banner(s: Shape, x: number, y: number, z: number, w: number, h: number, o: { tone?: Tone; emblem?: Tone } = {}): void {
  const tone = o.tone ?? [P.ochre, P.gold, P.butter], cut = 0.45;
  const pts = [x - w / 2, y, z, x + w / 2, y, z, x + w / 2, y - h, z, x, y - h + cut, z, x - w / 2, y - h, z, x - w / 2, y - h * 0.5, z, x + w / 2, y - h * 0.5, z];
  for (const sign of [1, -1]) s.mesh(pts, [0, 1, 6, 0, 6, 5, 5, 6, 3, 5, 3, 4, 6, 2, 3], tone, { hints: Array.from({ length: 7 }, () => [0, 0, sign]).flat(), skin: 'flat', light: 0, mottle: 0.2, cavity: 0.2 });
  // A border down each side, and the wheat sprig.
  const pale = [P.plaster, P.plasterLight];
  for (const side of [-1, 1]) s.box(x + side * (w / 2 - 0.05), y - h + 0.05, z + 0.012, 0.06, h - 0.1, 0.01, pale, { skin: 'flat' });
  const emblem = o.emblem ?? pale;
  s.box(x, y - h * 0.75, z + 0.015, 0.05, h * 0.5, 0.01, emblem, { skin: 'flat' });
  for (let i = 0; i < 3; i++)
    for (const side of [-1, 1])
      s.poly([[x, y - h * 0.62 + i * 0.22, z + 0.02], [x + side * w * 0.26, y - h * 0.46 + i * 0.22, z + 0.02], [x, y - h * 0.52 + i * 0.22, z + 0.02]], emblem, { two: true, skin: 'flat' });
  timber(s, [x - w / 2 - 0.15, y + 0.04, z], [x + w / 2 + 0.15, y + 0.04, z], 0.07, TIMBER);
}

/**
 * Corner stones up a building's corner at x, z, to height h: blocks alternately long on its +z face and on
 * its +x face, a little proud of both walls. Turn the pen for the other corners. About 30 triangles a block.
 */
export function quoins(s: Shape, x: number, y: number, z: number, h: number, o: StoneOptions = {}): void {
  let v = 0, i = 0;
  while (v < h - 0.1) {
    const bh = Math.min(h - v, (o.course ?? 0.55) * s.rr(0.9, 1.1));
    const bw = i % 2 ? 0.8 : 0.5, bd = i % 2 ? 0.5 : 0.8;
    stoneBlock(s, x - bw / 2 + 0.06, y + v, z - bd / 2 + 0.06, bw, bh, bd, { ...o, faces: v + bh >= h - 0.1 ? '+z+x+y' : '+z+x', chip: 0.35 });
    v += bh;
    i++;
  }
}
