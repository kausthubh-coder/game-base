// The cut-out way's pieces: each shot's layers.json from cutout/art, its pictures, and what is worked out once
// at load so a frame costs only drawing: a soft shadow under each paper piece and a mask of the gold in it.
//
// The art helpers replace pictures but keep the names and the shape of layers.json, so everything here reads the
// manifests and nothing knows a pixel of a picture.
import type { ShotId } from '../types.ts';

export interface LayerSpec {
  id: string;
  file: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  /** 0 is nearest the camera, 1 the far sky. Only the three shots of you have it. */
  depth?: number;
  /** Where the piece hinges, as a share of its box. */
  pivot?: [number, number];
  /** Alternate drawings in the same box, after the first. */
  frames?: string[];
  note?: string;
}

export interface Manifest {
  shot: string;
  frame: [number, number];
  layers: LayerSpec[];
  [extra: string]: unknown;
}

export interface Piece {
  spec: LayerSpec;
  /** The first drawing, then the alternates. */
  drawings: HTMLImageElement[];
  /** A soft dark copy of the piece at half size, padded by SHADOW_PAD, for the paper's shadow on the wall. */
  shadow?: HTMLCanvasElement;
  /** The gold in the piece at half size: white where the paint is gold, clear elsewhere. Light runs over it. */
  gold?: HTMLCanvasElement;
}

export interface Scene {
  id: ShotId;
  manifest: Manifest;
  pieces: Piece[];
  byId: Map<string, Piece>;
}

/** Half-size pixels of blur and padding round a shadow. */
export const SHADOW_PAD = 8;

const manifests = import.meta.glob<Manifest>('./art/*/layers.json', { eager: true, import: 'default' });
const files = import.meta.glob<string>('./art/*/*.webp', { eager: true, query: '?url', import: 'default' });
const roadPaths = import.meta.glob<{ center: [number, number]; strokeWidth: number; paths: string[] }>('./art/roads/road-paths.json', { eager: true, import: 'default' });

export const roads = () => Object.values(roadPaths)[0];

/** `./art/war` and `../shared/plaster.webp` give `./art/shared/plaster.webp`. */
function resolve(dir: string, file: string) {
  const parts = `${dir}/${file}`.split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' || out.length === 0) out.push(p);
  }
  return out.join('/');
}

export function manifest(id: ShotId): Manifest {
  const m = manifests[`./art/${id}/layers.json`];
  if (!m) throw new Error(`cutout: no layers.json for ${id}`);
  return m;
}

const images = new Map<string, Promise<HTMLImageElement>>();
function image(path: string) {
  let p = images.get(path);
  if (!p) {
    const url = files[path];
    if (!url) throw new Error(`cutout: no picture ${path}`);
    const img = new Image();
    img.src = url;
    p = img.decode().then(() => img);
    images.set(path, p);
  }
  return p;
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function makeShadow(img: HTMLImageElement, spec: LayerSpec) {
  const w = spec.w / 2, h = spec.h / 2;
  const c = canvas(w + SHADOW_PAD * 2, h + SHADOW_PAD * 2);
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  x.filter = 'blur(3px)';
  x.drawImage(img, SHADOW_PAD, SHADOW_PAD, w, h);
  x.filter = 'none';
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = 'rgb(46,30,14)';
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

/**
 * White where the paint is gold leaf: warm, saturated and bright. The gleam draws a band of light through
 * this mask, so light runs over the gold and nothing else.
 */
function makeGold(img: HTMLImageElement, spec: LayerSpec) {
  const w = Math.ceil(spec.w / 2), h = Math.ceil(spec.h / 2);
  const c = canvas(w, h);
  const x = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  x.drawImage(img, 0, 0, w, h);
  const data = x.getImageData(0, 0, w, h);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;
    // Gold: red over green over blue, fairly bright, clearly coloured. Pale ivory highlights count a little.
    const warm = r >= g && g > b && r - b > 50;
    const gold = warm ? Math.min(1, Math.max(0, (max - 120) / 110)) * Math.min(1, Math.max(0, (sat - 0.25) / 0.3)) : 0;
    d[i] = 255; d[i + 1] = 236; d[i + 2] = 190;
    d[i + 3] = Math.round(a * gold);
  }
  x.putImageData(data, 0, 0);
  // A canvas made for reading lives in main memory and would be sent to the graphics chip on every frame it is
  // drawn; a plain copy stays there.
  const out = canvas(w, h);
  (out.getContext('2d') as CanvasRenderingContext2D).drawImage(c, 0, 0);
  return out;
}

export interface LoadOptions {
  /** Layers that cast a shadow on the wall. */
  paper: (spec: LayerSpec) => boolean;
  /** Layers with gold for the light to run over. */
  gold: (spec: LayerSpec) => boolean;
}

export async function loadScene(id: ShotId, opts: LoadOptions): Promise<Scene> {
  const m = manifest(id);
  const dir = `./art/${id}`;
  const pieces = await Promise.all(
    [...m.layers].sort((a, b) => a.z - b.z).map(async (spec): Promise<Piece> => {
      const drawings = await Promise.all([spec.file, ...(spec.frames ?? [])].map((f) => image(resolve(dir, f))));
      return {
        spec,
        drawings,
        shadow: opts.paper(spec) ? makeShadow(drawings[0], spec) : undefined,
        gold: opts.gold(spec) ? makeGold(drawings[0], spec) : undefined,
      };
    }),
  );
  return { id, manifest: m, pieces, byId: new Map(pieces.map((p) => [p.spec.id, p])) };
}
