// The rostrum: draws one shot's pieces at one moment under one camera. A shot's direction (shots.ts) says
// where the camera is and how each piece sits; this file turns that into drawing, with the paper's shadow on
// the wall, the gold catching the light, and the depth between the planes of the three shots of you.
//
// The camera looks at a stack of flat planes. A piece's plane is its `depth` from layers.json; the legend's
// pieces lie on one wall, a hair apart by their z, so a long travel shows them as paper laid on plaster.
import type { Shot } from '../types.ts';
import { SHADOW_PAD, type Piece, type Scene } from './scene.ts';

export const W = 1920, H = 1080;

/** How a piece sits at this moment. Every field is optional; a missing one is the piece at rest. */
export interface Pose {
  /** Frame pixels. */
  dx?: number;
  dy?: number;
  /** Radians about the pivot, clockwise. */
  rot?: number;
  /** Scale about the pivot. */
  sx?: number;
  sy?: number;
  alpha?: number;
  /** Which drawing: 0 is the first. A fraction dissolves into the next one. */
  frame?: number;
  /** 0 lies on the wall; 1 is held off it, its shadow longer and softer. */
  lift?: number;
  /** Extra light on the piece's gold, 0 to 1. */
  shine?: number;
  hide?: boolean;
  /** Overrides the pivot from layers.json. */
  pivot?: [number, number];
}

/** A camera key: where the camera looks (frame pixels of the reference plane) and how close. */
export interface Key {
  /** A share of the shot, or a beat's name. */
  at: number | string;
  x: number;
  y: number;
  zoom: number;
  /** The camera comes to rest here. Without it the move flows through the key. */
  stop?: boolean;
}

export interface Cam { x: number; y: number; zoom: number }

/** Light that runs over the gold: a band crossing the frame, or a pool round a point. */
export type Light =
  | { kind: 'band'; angle: number; at: number; width: number; strength: number }
  | { kind: 'pool'; x: number; y: number; r: number; strength: number };

export interface Direction {
  keys: Key[];
  /** The plane the camera keys are written on. The legend is flat and ignores it. */
  ref?: number;
  /** The legend: one wall, depth from z. */
  flat?: boolean;
  /** Pieces that are paper and throw a shadow on the wall. */
  paper?: (id: string) => boolean;
  /** Pieces whose gold catches the light. */
  gold?: (id: string) => boolean;
  /** Pieces that are light only, laid on with `screen`. */
  screen?: (id: string) => boolean;
  lights?(k: Kit): Light[];
  pose?(id: string, k: Kit): Pose | undefined;
  /** Draws a piece itself instead of the plain drawing (a road that grows, a dome that closes, a flag that waves). */
  paint?: Record<string, (k: Kit, piece: Piece, pose: Pose) => void>;
  /** Drawn over everything, in screen pixels. */
  over?(k: Kit): void;
}

export interface Kit {
  c: CanvasRenderingContext2D;
  s: Shot;
  /** Seconds into the shot. */
  tl: number;
  cam: Cam;
  /** Seconds into the shot of a beat. */
  beat(name: string): number;
  /** Where a frame point on a plane lands on screen. Without a depth, the reference plane. */
  at(x: number, y: number, depth?: number): [number, number];
  /** Screen pixels per frame pixel on a plane. */
  scale(depth?: number): number;
  /** A soft dot of light at a screen point. */
  spark(x: number, y: number, size: number, alpha: number): void;
  piece(id: string): Piece | undefined;
  /** Sets the canvas to draw in a piece's own pixels, posed. Returns false when its plane is behind the camera. */
  place(piece: Piece, pose: Pose): boolean;
  /** Draws a piece's drawing at its pose, the way the stage does. */
  draw(piece: Piece, pose: Pose): void;
  /** A spare canvas the size of the frame. */
  scratch: CanvasRenderingContext2D;
  /** True when drawing a still for a panel: no camera, everything finished. */
  still: boolean;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d') as CanvasRenderingContext2D;
}

function makeSpark() {
  const x = canvas(64, 64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,250,228,1)');
  g.addColorStop(0.22, 'rgba(255,222,140,.8)');
  g.addColorStop(0.55, 'rgba(255,190,90,.22)');
  g.addColorStop(1, 'rgba(255,180,80,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return x.canvas;
}

/** Where the camera is at tl: a smooth curve through the keys, at rest on the first, the last and every stop. */
export function camera(d: Direction, s: Shot, tl: number): Cam {
  const keys = d.keys.map((k) => ({ ...k, t: typeof k.at === 'string' ? (s.beats[k.at] ?? 0) : k.at * s.len }));
  keys.sort((a, b) => a.t - b.t);
  if (tl <= keys[0].t || keys.length === 1) return keys[0];
  const last = keys[keys.length - 1];
  if (tl >= last.t) return last;
  let i = 0;
  while (keys[i + 1].t < tl) i++;
  const a = keys[i], b = keys[i + 1];
  const h = Math.max(1e-6, b.t - a.t);
  const u = (tl - a.t) / h;
  // Cubic Hermite per channel; the slope at a key is zero where the camera rests, else the slope across it.
  const slope = (j: number, f: 'x' | 'y' | 'zoom') => {
    const k = keys[j];
    if (j === 0 || j === keys.length - 1 || k.stop) return 0;
    return (keys[j + 1][f] - keys[j - 1][f]) / (keys[j + 1].t - keys[j - 1].t);
  };
  const herm = (f: 'x' | 'y' | 'zoom') => {
    const p0 = a[f], p1 = b[f], m0 = slope(i, f) * h, m1 = slope(i + 1, f) * h;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
  };
  return { x: herm('x'), y: herm('y'), zoom: herm('zoom') };
}

/** Draws shots. One stage serves the film, the dissolves and the panels; it keeps only its spare canvases. */
export class Stage {
  private spark = makeSpark();
  private small = canvas(1024, 1024);
  readonly scratch = canvas(W, H);

  /** Draws scene `scene` at tl seconds into shot `s` on `c`. `cam` overrides the direction's camera. */
  drawShot(c: CanvasRenderingContext2D, scene: Scene, d: Direction, s: Shot, tl: number, still = false, cam?: Cam) {
    const view = cam ?? camera(d, s, tl);
    const [fw, fh] = scene.manifest.frame;
    if (d.flat) {
      // Keep the camera inside the painted wall.
      const hw = W / 2 / view.zoom, hh = H / 2 / view.zoom;
      view.x = Math.min(fw - hw, Math.max(hw, view.x));
      view.y = Math.min(fh - hh, Math.max(hh, view.y));
    }
    const ref = d.flat ? 1 : (d.ref ?? 0.5);
    const dist = (depth: number) => 2 + 2 * depth;
    const dr = dist(ref);
    const dolly = dr * (1 - 1 / view.zoom);
    const depthOf = (p: Piece) => (d.flat ? 1 - p.spec.z / 3000 : (p.spec.depth ?? ref));
    /** Scale and offset of a plane: screen = frame * k + o. Null when the plane is behind the camera. */
    const plane = (depth: number): [number, number, number] | null => {
      const di = dist(depth);
      const den = di - dolly;
      if (den < 0.08) return null;
      const k = di / den;
      return [k, W / 2 - (W / 2) * k - (view.x - W / 2) * (dr / den), H / 2 - (H / 2) * k - (view.y - H / 2) * (dr / den)];
    };

    const poses = new Map<Piece, Pose>();
    const kit: Kit = {
      c, s, tl, cam: view, still,
      scratch: this.scratch,
      beat: (name) => s.beats[name] ?? 0,
      at: (x, y, depth = ref) => {
        const p = plane(depth);
        return p ? [x * p[0] + p[1], y * p[0] + p[2]] : [-1e4, -1e4];
      },
      scale: (depth = ref) => plane(depth)?.[0] ?? 0,
      spark: (x, y, size, alpha) => {
        if (alpha <= 0.002 || size <= 0) return;
        c.globalAlpha = Math.min(1, alpha);
        c.drawImage(this.spark, x - size / 2, y - size / 2, size, size);
      },
      piece: (id) => scene.byId.get(id),
      place: (piece, pose) => {
        const p = plane(depthOf(piece));
        if (!p) return false;
        const { x, y, w, h } = piece.spec;
        const [px, py] = pose.pivot ?? piece.spec.pivot ?? [0.5, 0.5];
        const ax = x + (pose.dx ?? 0) + px * w, ay = y + (pose.dy ?? 0) + py * h;
        const cos = Math.cos(pose.rot ?? 0), sin = Math.sin(pose.rot ?? 0);
        const sx = pose.sx ?? 1, sy = pose.sy ?? 1;
        const [k, ox, oy] = p;
        // plane * translate(anchor) * rotate * scale * translate(-pivot)
        const a = k * cos * sx, b = k * sin * sx, cc = -k * sin * sy, dd = k * cos * sy;
        const e = k * ax + ox - (a * px * w + cc * py * h);
        const f = k * ay + oy - (b * px * w + dd * py * h);
        c.setTransform(a, b, cc, dd, e, f);
        return true;
      },
      draw: (piece, pose) => this.drawPiece(kit, piece, pose),
    };

    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = s.part ? '#0d0b10' : '#e6d3ad';
    c.fillRect(0, 0, W, H);
    for (const piece of scene.pieces) poses.set(piece, d.pose?.(piece.spec.id, kit) ?? {});
    const lights = d.lights?.(kit) ?? [];
    for (const piece of scene.pieces) {
      const pose = poses.get(piece) as Pose;
      if (pose.hide || (pose.alpha ?? 1) <= 0.002) continue;
      const id = piece.spec.id;
      if (piece.shadow && d.paper?.(id)) this.drawShadow(kit, piece, pose);
      c.globalCompositeOperation = d.screen?.(id) ? 'screen' : 'source-over';
      const paint = d.paint?.[id];
      if (paint) paint(kit, piece, pose);
      else this.drawPiece(kit, piece, pose);
      c.globalCompositeOperation = 'source-over';
      if (piece.gold && d.gold?.(id)) this.drawGleam(kit, piece, pose, lights);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    d.over?.(kit);
    c.restore();
  }

  /** The plain drawing, or two drawings dissolving into each other when the frame is between them. */
  drawPiece(k: Kit, piece: Piece, pose: Pose) {
    const c = k.c;
    if (!k.place(piece, pose)) return;
    const { w, h } = piece.spec;
    const n = piece.drawings.length;
    const f = pose.frame ?? 0;
    const i = ((Math.floor(f) % n) + n) % n;
    const m = f - Math.floor(f);
    const alpha = Math.max(0, Math.min(1, pose.alpha ?? 1));
    if (m < 0.01 || n === 1) {
      c.globalAlpha = alpha;
      c.drawImage(piece.drawings[i], 0, 0, w, h);
      return;
    }
    // A true cross-dissolve: both drawings added, weighted, on a spare canvas, then laid on as one piece.
    const x = this.small;
    const sw = Math.min(x.canvas.width, Math.ceil(w)), sh = Math.min(x.canvas.height, Math.ceil(h));
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, sw, sh);
    x.globalCompositeOperation = 'lighter';
    x.globalAlpha = 1 - m;
    x.drawImage(piece.drawings[i], 0, 0, sw, sh);
    x.globalAlpha = m;
    x.drawImage(piece.drawings[(i + 1) % n], 0, 0, sw, sh);
    c.globalAlpha = alpha;
    c.drawImage(x.canvas, 0, 0, sw, sh, 0, 0, w, h);
  }

  private drawShadow(k: Kit, piece: Piece, pose: Pose) {
    const lift = pose.lift ?? 0;
    const off = 5 + lift * 34;
    const c = k.c;
    if (!k.place(piece, { ...pose, dx: (pose.dx ?? 0) + off, dy: (pose.dy ?? 0) + off * 1.25 })) return;
    const { w, h } = piece.spec;
    const shadow = piece.shadow as HTMLCanvasElement;
    c.globalAlpha = Math.max(0, Math.min(1, pose.alpha ?? 1)) * (0.3 - lift * 0.14);
    c.globalCompositeOperation = 'multiply';
    c.drawImage(shadow, -SHADOW_PAD * 2, -SHADOW_PAD * 2, w + SHADOW_PAD * 4, h + SHADOW_PAD * 4);
    c.globalCompositeOperation = 'source-over';
  }

  /** Light through the gold mask: each band or pool lit on a spare canvas, cut to the gold, added on. */
  private drawGleam(k: Kit, piece: Piece, pose: Pose, lights: readonly Light[]) {
    const gold = piece.gold as HTMLCanvasElement;
    const shine = pose.shine ?? 0;
    const alpha = Math.max(0, Math.min(1, pose.alpha ?? 1));
    if (alpha <= 0.01 || (!lights.length && shine <= 0.01)) return;
    const c = k.c;
    const { w, h } = piece.spec;
    const x = this.small;
    const gw = gold.width, gh = gold.height;
    if (gw > x.canvas.width || gh > x.canvas.height) return;
    const x0 = piece.spec.x + (pose.dx ?? 0), y0 = piece.spec.y + (pose.dy ?? 0);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, gw, gh);
    x.globalCompositeOperation = 'lighter';
    let any = false;
    for (const l of lights) {
      if (l.strength <= 0.01) continue;
      if (l.kind === 'band') {
        const nx = Math.cos(l.angle), ny = Math.sin(l.angle);
        const mid = (l.at - (x0 * nx + y0 * ny)) / 2, hw = l.width / 4;
        // Skip a band wholly off the piece.
        const reach = (Math.abs(nx) * gw + Math.abs(ny) * gh);
        if (mid + hw < -reach || mid - hw > reach) continue;
        const g = x.createLinearGradient(nx * (mid - hw), ny * (mid - hw), nx * (mid + hw), ny * (mid + hw));
        g.addColorStop(0, 'rgba(255,240,200,0)');
        g.addColorStop(0.5, `rgba(255,240,200,${Math.min(1, l.strength)})`);
        g.addColorStop(1, 'rgba(255,240,200,0)');
        x.fillStyle = g;
      } else {
        const cx = (l.x - x0) / 2, cy = (l.y - y0) / 2, r = l.r / 2;
        if (cx + r < 0 || cy + r < 0 || cx - r > gw || cy - r > gh) continue;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(255,236,190,${Math.min(1, l.strength)})`);
        g.addColorStop(1, 'rgba(255,236,190,0)');
        x.fillStyle = g;
      }
      x.fillRect(0, 0, gw, gh);
      any = true;
    }
    if (shine > 0.01) {
      x.fillStyle = `rgba(255,236,190,${Math.min(1, shine)})`;
      x.fillRect(0, 0, gw, gh);
      any = true;
    }
    if (!any) return;
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(gold, 0, 0);
    if (!k.place(piece, pose)) return;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = alpha;
    c.drawImage(x.canvas, 0, 0, gw, gh, 0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
  }
}

