// Loads every skin in skins.ts into one texture array: one 256-pixel layer a skin, so a prop of any skins
// is still one draw call. Each layer is divided by its own average colour, so it carries only light and dark
// and the part's vertex colour stays its colour. Grain, thatch, plaster, tiles, slate and limestone are
// drawn here, since no painting fits them. A painting that does not load leaves its layer plain, and the
// props still draw.
import * as THREE from 'three';
import { SKIN_NAMES, SKINS } from './skins.ts';

/** Pixels a side of each layer. The paintings are soft, and a prop's texture is seldom larger on screen. */
const SIZE = 256;

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Draws at a spot and at its wrapped copies, so the layer repeats without a seam. */
function tiled(x: number, y: number, draw: (x: number, y: number) => void): void {
  for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) draw(x + dx, y + dy);
}

/** Wood grain: long soft streaks down the layer, with a few knots. */
function grain(g: CanvasRenderingContext2D): void {
  const r = random(41);
  g.fillStyle = '#9b7a58';
  g.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 120; i++) {
    const x = r() * SIZE, w = 1 + r() * 4, light = r() < 0.5;
    g.fillStyle = light ? '#c49c74' : '#6e5038';
    g.globalAlpha = 0.18 + r() * 0.3;
    tiled(x, 0, (tx) => g.fillRect(tx, 0, w, SIZE));
  }
  for (let i = 0; i < 4; i++) {
    const x = r() * SIZE, y = r() * SIZE;
    g.globalAlpha = 0.45;
    g.fillStyle = '#5a3f2b';
    tiled(x, y, (tx, ty) => { g.beginPath(); g.ellipse(tx, ty, 3 + r() * 3, 8 + r() * 6, 0, 0, Math.PI * 2); g.fill(); });
  }
  g.globalAlpha = 1;
}

/** Straw laid in courses: short strokes down the layer, light and dark, with a shadow under each course. */
function thatch(g: CanvasRenderingContext2D): void {
  const r = random(73);
  g.fillStyle = '#c9a25a';
  g.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 900; i++) {
    const x = r() * SIZE, y = r() * SIZE, length = 18 + r() * 34, w = 1 + r() * 2.2;
    g.strokeStyle = r() < 0.55 ? '#efd08a' : '#8f6a33';
    g.globalAlpha = 0.25 + r() * 0.45;
    g.lineWidth = w;
    const lean = (r() - 0.5) * 6;
    tiled(x, y, (tx, ty) => { g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + lean, ty + length); g.stroke(); });
  }
  // Four courses, each a little darker at its lower edge where the next one overlaps it.
  for (let c = 0; c < 4; c++) {
    const y = (c + 1) * (SIZE / 4);
    const shade = g.createLinearGradient(0, y - 14, 0, y);
    shade.addColorStop(0, 'rgba(70,45,20,0)');
    shade.addColorStop(1, 'rgba(70,45,20,0.45)');
    g.globalAlpha = 1;
    g.fillStyle = shade;
    g.fillRect(0, y - 14, SIZE, 14);
  }
  g.globalAlpha = 1;
}

/** Lime plaster: soft blotches, light and dark. */
function plaster(g: CanvasRenderingContext2D): void {
  const r = random(97);
  g.fillStyle = '#d8ccb4';
  g.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 160; i++) {
    const x = r() * SIZE, y = r() * SIZE, rx = 8 + r() * 30, ry = 6 + r() * 18;
    g.fillStyle = r() < 0.5 ? '#efe6d2' : '#b9aa90';
    g.globalAlpha = 0.12 + r() * 0.2;
    tiled(x, y, (tx, ty) => { g.beginPath(); g.ellipse(tx, ty, rx, ry, r() * Math.PI, 0, Math.PI * 2); g.fill(); });
  }
  g.globalAlpha = 1;
}

/**
 * Rows of tiles or slates: each piece its own shade, lighter toward its middle, with a dark joint at its
 * sides and along each row. Rows are even and shaded alike at top and bottom, so the mirrored repeat
 * does not show.
 */
function courses(g: CanvasRenderingContext2D, seed: number, rows: number, narrow: number, wide: number, contrast: number, base: string): void {
  const r = random(seed), row = SIZE / rows;
  g.fillStyle = base;
  g.fillRect(0, 0, SIZE, SIZE);
  for (let j = 0; j < rows; j++) {
    let x = j % 2 ? -wide / 2 : 0;
    while (x < SIZE) {
      const w = narrow + r() * (wide - narrow), tone = (r() - 0.5) * contrast;
      const y = j * row;
      const grad = g.createLinearGradient(x, 0, x + w, 0);
      const mid = tone > 0 ? `rgba(255,250,235,${0.1 + tone})` : `rgba(20,25,35,${-tone + 0.05})`;
      grad.addColorStop(0, 'rgba(20,25,35,0.28)');
      grad.addColorStop(0.18, mid);
      grad.addColorStop(0.82, mid);
      grad.addColorStop(1, 'rgba(20,25,35,0.28)');
      g.globalAlpha = 1;
      g.fillStyle = grad;
      g.fillRect(x + 1, y + 1, w - 2, row - 2);
      // A soft darker stroke of wear down each piece.
      g.globalAlpha = 0.08 + r() * 0.08;
      g.fillStyle = '#1a2030';
      g.fillRect(x + 3 + r() * (w - 8), y + 3, 2 + r() * 3, row - 6);
      g.globalAlpha = 0.55;
      g.fillStyle = '#141820';
      g.fillRect(x, y, 1.5, row);
      x += w;
    }
    g.globalAlpha = 0.6;
    g.fillStyle = '#141820';
    g.fillRect(0, j * row, SIZE, 2);
    g.globalAlpha = 0.18;
    g.fillRect(0, j * row + 2, SIZE, 4);
    g.fillRect(0, (j + 1) * row - 6, SIZE, 4);
  }
  g.globalAlpha = 1;
}

function tiles(g: CanvasRenderingContext2D): void {
  courses(g, 131, 5, 34, 58, 0.34, '#4f8c88');
}

function slate(g: CanvasRenderingContext2D): void {
  courses(g, 151, 8, 18, 40, 0.5, '#6b6676');
}

/** Dressed limestone: soft blotches, small pits and faint bedding lines. */
function limestone(g: CanvasRenderingContext2D): void {
  plaster(g);
  const r = random(173);
  for (let i = 0; i < 14; i++) {
    const y = r() * SIZE;
    g.globalAlpha = 0.06 + r() * 0.08;
    g.fillStyle = r() < 0.5 ? '#8c7a62' : '#fff6e2';
    tiled(0, y, (_, ty) => g.fillRect(0, ty, SIZE, 1 + r() * 3));
  }
  for (let i = 0; i < 260; i++) {
    const x = r() * SIZE, y = r() * SIZE, size = 0.6 + r() * 1.8;
    g.globalAlpha = 0.2 + r() * 0.35;
    g.fillStyle = r() < 0.7 ? '#6f6250' : '#fffaf0';
    tiled(x, y, (tx, ty) => { g.beginPath(); g.arc(tx, ty, size, 0, Math.PI * 2); g.fill(); });
  }
  g.globalAlpha = 1;
}

const DRAW = { grain, thatch, plaster, tiles, slate, limestone } as const;

function image(url: string): Promise<HTMLImageElement> {
  return new Promise((done, fail) => {
    const img = new Image();
    img.onload = () => done(img);
    img.onerror = () => fail(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Where each painting is, from the manifest: a built game renames every file by its contents. */
async function paintings(base: string): Promise<Record<string, string>> {
  try {
    const manifest = (await (await fetch(base + 'manifest.json')).json()) as { painted?: { textures?: Record<string, string> } };
    return manifest.painted?.textures ?? {};
  } catch {
    return {};
  }
}

/**
 * Every skin as one texture array, from the paintings the manifest in `base` (the assets folder) lists. It
 * resolves once every layer is in, with plain layers where a painting failed.
 */
export async function loadSkins(base: string): Promise<THREE.DataArrayTexture> {
  const files = await paintings(base);
  const data = new Uint8Array(SIZE * SIZE * 4 * SKIN_NAMES.length).fill(128);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const sources = await Promise.all(SKIN_NAMES.map(async (name) => {
    const source = SKINS[name].source;
    if (!source || !('painting' in source) || !files[source.painting]) return null;
    try {
      return await image(base + files[source.painting]);
    } catch {
      return null;
    }
  }));
  SKIN_NAMES.forEach((name, layer) => {
    const source = SKINS[name].source;
    g.clearRect(0, 0, SIZE, SIZE);
    const painting = sources[layer];
    if (painting) g.drawImage(painting, 0, 0, SIZE, SIZE);
    else if (source && 'draw' in source) DRAW[source.draw](g);
    else return;
    const pixels = g.getImageData(0, 0, SIZE, SIZE).data;
    const mean = [0, 0, 0];
    for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) mean[c] += pixels[i + c];
    for (let c = 0; c < 3; c++) mean[c] = Math.max(1, mean[c] / (SIZE * SIZE));
    const at = layer * SIZE * SIZE * 4;
    for (let i = 0; i < pixels.length; i += 4) {
      for (let c = 0; c < 3; c++) data[at + i + c] = Math.min(255, Math.round((pixels[i + c] / mean[c]) * 128));
      data[at + i + 3] = 255;
    }
  });
  const texture = new THREE.DataArrayTexture(data, SIZE, SIZE, SKIN_NAMES.length);
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
