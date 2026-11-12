// The land of the painted world: the same blocks the rules use, drawn as one smooth surface. Each corner of a
// column takes the average height of the four columns that meet there, so a one-block step becomes a slope
// and level ground stays level. A tile is one chunk, made again when its blocks change. All the tiles are
// one mesh, so the land costs one draw call however many chunks are in view, and only the tiles the camera
// sees are listed in it.
//
// With `stepped` the same land is drawn as the blocks stand: every column a flat top at its own height, with
// earth on the risers between. The colours and the grass are the same either way.
//
// Colour comes from the top ground block of each column (meadow greens, path, sand, rock), softened the same
// way as the heights, and the painted meadow texture varies it. A slope too steep for grass shows earth.
// Ground that somebody made is painted on the same surface: furrows on tilled soil, stones on paving.
import * as THREE from 'three';
import { BLOCKS } from '../../content/blocks.ts';
import { FLAT_DROP, LAND_BLOCKS, LAND_COLORS, MADE_GROUND } from '../../content/land.ts';
import { paint } from './paint.ts';
import type { Textures } from './textures.ts';

/** What the land asks of the block world. */
export interface LandBlocks {
  getBlock(x: number, y: number, z: number): number;
  /** The y of the top of the highest solid block in a column. */
  heightAt(x: number, z: number): number;
  /** How many blocks of ground the column had before anything was dug or built. Blocks above it are not land. */
  groundAt(x: number, z: number): number;
  /** How much lamp light a cell has, from 0 to 1. Left out, no lamp lights the land. */
  glowAt?(x: number, y: number, z: number): number;
  /** A number that changes whenever the chunk's blocks change, or -1 while the chunk is not loaded. */
  revision(cx: number, cz: number): number;
}

export interface Land {
  readonly group: THREE.Group;
  /** Tiles are kept within `reach` chunks of this point. Call it every frame. With `view`, only the tiles in it are drawn. */
  update(x: number, z: number, reach: number, view?: THREE.Frustum): void;
  /** The height of the drawn ground at a point, or NaN where no tile is made yet. */
  heightAt(x: number, z: number): number;
  /** 0 on grass to 1 on bare ground (path, sand, rock, a made floor), or NaN where no tile is made yet. */
  bareAt(x: number, z: number): number;
  /** The ground's colour at a point, written into `out`. False where no tile is made yet. */
  colorAt(x: number, z: number, out: THREE.Color): boolean;
  /** A number that changes when the land of a chunk is made again, or -1 while it is not made. */
  stampAt(cx: number, cz: number): number;
  readonly tiles: number;
  readonly triangles: number;
}

const CHUNK = 16;
/** Vertices along one side of a tile. */
const SIDE = CHUNK + 1;
/** Tiles made in one frame at most. */
const PER_FRAME = 2;

const KIND_NONE = 0, KIND_GRASS = 1;
const kindOf = new Uint8Array(256), liquid = new Uint8Array(256), solid = new Uint8Array(256);
/** Per block: 1 where furrows are painted on it, 2 where paving stones are. */
const madeOf = new Uint8Array(256);
const kindColor: THREE.Color[] = [new THREE.Color(0, 0, 0), new THREE.Color(LAND_COLORS.grass.mid)];
for (const block of BLOCKS) {
  liquid[block.id] = block.liquid ? 1 : 0;
  solid[block.id] = block.solid ? 1 : 0;
  if (!LAND_BLOCKS.includes(block.key)) continue;
  madeOf[block.id] = MADE_GROUND[block.key] === 'soil' ? 1 : MADE_GROUND[block.key] === 'paving' ? 2 : 0;
  if (block.key === 'grass') { kindOf[block.id] = KIND_GRASS; continue; }
  const named = (LAND_COLORS as Record<string, unknown>)[block.key];
  kindColor.push(new THREE.Color(typeof named === 'string' ? named : block.color));
  kindOf[block.id] = kindColor.length - 1;
}
const GRASS = { light: new THREE.Color(LAND_COLORS.grass.light), mid: new THREE.Color(LAND_COLORS.grass.mid), deep: new THREE.Color(LAND_COLORS.grass.deep), straw: new THREE.Color(LAND_COLORS.grass.straw) };
const EARTH = new THREE.Color(LAND_COLORS.earth), CLIFF = new THREE.Color(LAND_COLORS.cliff), BED = new THREE.Color(LAND_COLORS.bed), SHORE = new THREE.Color(LAND_COLORS.shore);

function hash(ix: number, iy: number, seed: number): number {
  let n = (ix * 73856093) ^ (iy * 19349663) ^ (seed * 83492791);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Layered noise between 0 and 1. */
export function fbm(x: number, y: number, octaves: number, seed: number): number {
  let sum = 0, amp = 0.5, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) { sum += amp * noise(x * freq, y * freq, seed + i * 17); total += amp; amp *= 0.5; freq *= 2; }
  return sum / total;
}
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The meadow's green at a spot: broad drifts of light and deep green and of dry straw. */
export function meadowColor(x: number, z: number, out: THREE.Color): THREE.Color {
  out.copy(GRASS.mid).lerp(GRASS.light, smoothstep(0.35, 0.68, fbm(x / 36, z / 36, 3, 21)));
  out.lerp(GRASS.deep, smoothstep(0.5, 0.78, fbm(x / 10, z / 10, 2, 33)) * 0.55);
  out.lerp(GRASS.straw, smoothstep(0.6, 0.78, fbm(x / 52, z / 52, 2, 44)) * 0.5);
  return out;
}

interface Tile {
  cx: number;
  cz: number;
  /** Stepped land only: the tile's own mesh. */
  mesh: THREE.Mesh | null;
  /** Smooth land only: which run of the one mesh's vertices is this tile's, or -1 before it is made. */
  slot: number;
  /** A ball that holds the tile, to ask whether the camera sees it. */
  ball: THREE.Sphere;
  /** The revisions of the nine chunks it was made from, added up with their places, so any change shows. */
  stamp: number;
  /** Per vertex: height, and how bare the ground is. */
  heights: Float32Array;
  bare: Float32Array;
  colors: Float32Array;
  /** Stepped land only: the height of each column's top. */
  tops: Float32Array;
  triangles: number;
}

// The stepped land's vertices as they are gathered for one tile. They are copied into the tile's geometry.
const sp: number[] = [], sn: number[] = [], sc: number[] = [], sg: number[] = [], sm: number[] = [], si: number[] = [];
/** Adds a four-cornered face. Corners 0 and 1 are its upper edge, 2 and 3 lie under them. `n` is the way it faces. */
function face(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, x3: number, y3: number, z3: number, nx: number, ny: number, nz: number): number {
  const first = sp.length / 3;
  sp.push(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3);
  sn.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
  // Wound so that the front is the side the normal points to.
  const ax = x1 - x0, ay = y1 - y0, az = z1 - z0, bx = x2 - x0, by = y2 - y0, bz = z2 - z0;
  const front = (ay * bz - az * by) * nx + (az * bx - ax * bz) * ny + (ax * by - ay * bx) * nz > 0;
  if (front) si.push(first, first + 1, first + 2, first + 1, first + 3, first + 2);
  else si.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
  return first;
}

export function createLand(blocks: LandBlocks, textures: Textures, stepped = false): Land {
  const group = new THREE.Group();
  group.name = 'land';
  const material = paint({
    vertexColors: true, brush: 0.3, bands: 0.3, wrap: 0.25, brushScale: 0.06, dapple: 1,
    uniforms: { uGround: { value: textures.ground }, uGroundMean: { value: textures.groundMean }, uRock: { value: textures.rock }, uCobble: { value: textures.cobble } },
    vertexPars: 'attribute vec2 aGlow, aMade; varying vec3 vLand; varying vec2 vMade;',
    // Lamp light, how bare the ground is, and how level it lies. Then how much of it is a tilled field, and how much is paved.
    vertexBegin: 'vLand = vec3(aGlow, normal.y); vMade = aMade;',
    fragmentPars: 'uniform sampler2D uGround, uRock, uCobble; uniform vec3 uGroundMean, uLamp; varying vec3 vLand; varying vec2 vMade;',
    // The painted meadow texture at two sizes, divided by its own average: it varies the colour, it does not tint it.
    fragmentAlbedo: /* glsl */ `
      float steep = 1.0 - smoothstep(0.55, 0.8, vLand.z);
      vec3 dabs = texture2D(uGround, vPaintWorld.xz * 0.13).rgb * 0.55 + texture2D(uGround, vPaintWorld.xz * 0.031 + 0.37).rgb * 0.45;
      vec3 vary = dabs / uGroundMean;
      // Bare ground keeps the brush marks and loses their green.
      vary = mix(vary, vec3(dot(vary, vec3(0.3333))), vLand.y);
      diffuseColor.rgb *= mix(vec3(1.0), vary, 0.5 * (1.0 - steep));
      // A steep bank is rock. Its marks are laid along the bank, where the meadow's would run down it in streaks.
      float rock = texture2D(uRock, vec2(vPaintWorld.x + vPaintWorld.z, vPaintWorld.y * 1.5) * 0.17).g;
      diffuseColor.rgb *= mix(1.0, 0.62 + 0.76 * rock, steep);
      // A tilled field: two furrows to a block, running east and west, their ridges catching the light.
      float furrow = 0.5 + 0.5 * sin(vPaintWorld.z * 12.566 + sin(vPaintWorld.x * 1.9) * 0.5);
      diffuseColor.rgb *= mix(1.0, 0.66 + 0.5 * furrow * furrow, smoothstep(0.3, 0.7, vMade.x));
      // Paving: stones set close together. At the rim of the paving single stones lie in the grass.
      vec4 stone = texture2D(uCobble, vPaintWorld.xz * 0.37);
      float laid = step(stone.g * 0.8 + 0.1, vMade.y) * (1.0 - steep);
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(0.74, 0.72, 0.68), 0.75 * stone.b) * (0.55 + 0.55 * stone.r), laid);`,
    // A lamp's light lies on the ground as its own colour, on top of the day's light.
    fragmentFinal: 'vec3 outgoingLight = paintHaze(paintShade(diffuseColor.rgb, paintLit(0.0)) + diffuseColor.rgb * uLamp * vLand.x * vLand.x) + totalEmissiveRadiance;',
  });
  // ---- smooth land: one mesh. Each tile owns a run of 17 by 17 vertices in it. The runs in use are kept
  // together at the front: when a tile goes, the last one moves into its place, and only that many are drawn.
  const RUN = SIDE * SIDE, RUN_INDEX = CHUNK * CHUNK * 6;
  const PARTS = [['position', 3], ['normal', 3], ['color', 3], ['aGlow', 2], ['aMade', 2]] as const;
  const sheet = new THREE.Mesh(new THREE.BufferGeometry(), material);
  sheet.name = 'land-sheet';
  sheet.receiveShadow = true;
  sheet.frustumCulled = false;
  sheet.matrixAutoUpdate = false;
  sheet.visible = false;
  if (!stepped) group.add(sheet);
  const live: Tile[] = [];
  let room = 0;
  /** Makes room for `count` tiles, keeping what is there. */
  function grow(count: number): void {
    const old = sheet.geometry, geometry = new THREE.BufferGeometry();
    for (const [name, size] of PARTS) {
      const array = new Float32Array(count * RUN * size), before = old.getAttribute(name) as THREE.BufferAttribute | undefined;
      if (before) array.set(before.array as Float32Array);
      const attribute = new THREE.BufferAttribute(array, size);
      attribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(name, attribute);
    }
    const index = new THREE.BufferAttribute(new Uint32Array(count * RUN_INDEX), 1);
    index.setUsage(THREE.DynamicDrawUsage);
    geometry.setIndex(index);
    geometry.setDrawRange(0, 0);
    sheet.geometry = geometry;
    old.dispose();
    room = count;
    listed = -1;
  }
  /** A number that changes when the tiles in view change. The triangles are listed again only then. */
  let listed = -1, drawn = 0;
  /** Lists the triangles of the tiles the camera sees. */
  function list(view: THREE.Frustum | undefined): void {
    let mark = live.length;
    for (const tile of live) mark = (Math.imul(mark, 31) + (!view || view.intersectsSphere(tile.ball) ? 1 : 0)) | 0;
    if (mark === listed) return;
    listed = mark;
    const attribute = sheet.geometry.getIndex() as THREE.BufferAttribute, index = attribute.array as Uint32Array;
    let n = 0;
    for (const tile of live) {
      if (view && !view.intersectsSphere(tile.ball)) continue;
      const first = tile.slot * RUN;
      for (let j = 0; j < CHUNK; j++) {
        for (let i = 0; i < CHUNK; i++) {
          const a = first + j * SIDE + i, b = a + 1, c = a + SIDE, d = c + 1;
          index[n++] = a; index[n++] = c; index[n++] = b; index[n++] = b; index[n++] = c; index[n++] = d;
        }
      }
    }
    attribute.clearUpdateRanges();
    attribute.addUpdateRange(0, n);
    attribute.needsUpdate = true;
    sheet.geometry.setDrawRange(0, n);
    sheet.visible = n > 0;
    drawn = n / 3;
  }
  /** Says that the run of vertices at `slot` changed, so only that run is sent to the graphics card. */
  function touched(slot: number): void {
    for (const [name, size] of PARTS) {
      const attribute = sheet.geometry.getAttribute(name) as THREE.BufferAttribute;
      attribute.addUpdateRange(slot * RUN * size, RUN * size);
      attribute.needsUpdate = true;
    }
  }
  /** Takes a tile out of the one mesh: the last tile's vertices move into its run. */
  function release(tile: Tile): void {
    if (tile.slot < 0) return;
    const last = live.pop() as Tile;
    if (last !== tile) {
      for (const [name, size] of PARTS) {
        const array = (sheet.geometry.getAttribute(name) as THREE.BufferAttribute).array as Float32Array;
        array.copyWithin(tile.slot * RUN * size, last.slot * RUN * size, (last.slot + 1) * RUN * size);
      }
      last.slot = tile.slot;
      live[last.slot] = last;
      touched(last.slot);
    }
    tile.slot = -1;
    listed = -1;
  }

  const tiles = new Map<number, Tile>();
  // A chunk's key, small enough to stay a small integer: a larger number would be a new object at every lookup.
  // It holds chunks within 8,192 of the origin, 131,072 blocks.
  const key = (cx: number, cz: number): number => ((cx + 8192) << 14) | (cz + 8192);

  // The columns of a tile and two more each way, so every vertex of the tile and of its rim has four columns
  // round it and a slope across it.
  const COLS = CHUNK + 4;
  const top = new Float32Array(COLS * COLS), glow = new Float32Array(COLS * COLS), kind = new Uint8Array(COLS * COLS), wet = new Uint8Array(COLS * COLS), made = new Uint8Array(COLS * COLS), work = new Uint8Array(COLS * COLS);
  const VERTS = CHUNK + 3;
  const vHeight = new Float32Array(VERTS * VERTS), vBare = new Float32Array(VERTS * VERTS), vGlow = new Float32Array(VERTS * VERTS), vColor = new Float32Array(VERTS * VERTS * 3), vMade = new Float32Array(VERTS * VERTS * 2);
  const color = new THREE.Color(), part = new THREE.Color(), normal = new THREE.Vector3();

  /**
   * Finds the ground of one column: its height, what it is made of, whether water lies on it. The ground is
   * the top solid block at or under the height the land had before anything was built: a block above that was
   * put there and is drawn as a block.
   */
  function column(x: number, z: number, at: number): void {
    let y = Math.min(blocks.heightAt(x, z), blocks.groundAt(x, z)) - 1, id = 0;
    for (; y >= 0; y--) {
      id = blocks.getBlock(x, y, z);
      if (solid[id] && !liquid[id]) break;
    }
    const over = blocks.getBlock(x, y + 1, z), land = kindOf[id] !== 0;
    // Ground that is not land (a floor let into the earth) is drawn as blocks, and the land lies just under its top.
    top[at] = Math.max(0, y + 1 - (land ? 0 : FLAT_DROP));
    kind[at] = kindOf[id];
    wet[at] = liquid[over];
    glow[at] = blocks.glowAt ? blocks.glowAt(x, y + 1, z) : 0;
    // Bare under a floor, a wall or a made bed: grass does not grow there.
    made[at] = !land || (solid[over] && !liquid[over]) ? 1 : 0;
    work[at] = madeOf[id] as number;
  }

  // The chunks' revisions around the hero, read once a frame. A tile's stamp needs its nine chunks, and the
  // tiles share them, so the frame asks the world once for each chunk instead of nine times.
  let revs = new Int32Array(0), revSide = 0, revX = 0, revZ = 0;
  function readRevisions(fx: number, fz: number, reach: number): void {
    revSide = 2 * (reach + 2) + 1;
    if (revs.length < revSide * revSide) revs = new Int32Array(revSide * revSide);
    revX = fx - reach - 2;
    revZ = fz - reach - 2;
    for (let j = 0; j < revSide; j++) for (let i = 0; i < revSide; i++) revs[j * revSide + i] = blocks.revision(revX + i, revZ + j);
  }
  function revisionAt(cx: number, cz: number): number {
    const i = cx - revX, j = cz - revZ;
    return i >= 0 && j >= 0 && i < revSide && j < revSide ? (revs[j * revSide + i] as number) : blocks.revision(cx, cz);
  }

  function stampOf(cx: number, cz: number): number {
    let stamp = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const rev = revisionAt(cx + dx, cz + dz);
        if (rev < 0) return -1;
        stamp = (Math.imul(stamp, 31) + rev + 1) | 0;
      }
    }
    return stamp & 0x7fffffff;
  }

  function build(tile: Tile): void {
    const x0 = tile.cx * CHUNK, z0 = tile.cz * CHUNK;
    for (let j = 0; j < COLS; j++) for (let i = 0; i < COLS; i++) column(x0 + i - 2, z0 + j - 2, j * COLS + i);
    // A vertex sits where four columns meet. Vertex (i, j) of the rim grid is the corner at x0 + i - 1, z0 + j - 1.
    for (let j = 0; j < VERTS; j++) {
      for (let i = 0; i < VERTS; i++) {
        const v = j * VERTS + i, wx = x0 + i - 1, wz = z0 + j - 1;
        let h = 0, lo = Infinity, hi = -Infinity, bare = 0, water = 0, lamp = 0, soil = 0, paving = 0;
        color.setRGB(0, 0, 0);
        for (let c = 0; c < 4; c++) {
          const at = (j + (c >> 1)) * COLS + i + (c & 1), t = top[at], k = kind[at];
          h += t; lo = Math.min(lo, t); hi = Math.max(hi, t);
          if (k === KIND_GRASS && !made[at]) meadowColor(wx, wz, part);
          else { part.copy(kindColor[k === KIND_GRASS ? KIND_NONE : k] ?? CLIFF); if (k === KIND_GRASS || k === KIND_NONE) part.copy(CLIFF); bare += 0.25; }
          if (wet[at]) water += 0.25;
          if (work[at] === 1) soil += 0.25; else if (work[at] === 2) paving += 0.25;
          lamp += (glow[at] as number) * 0.25;
          color.r += part.r * 0.25; color.g += part.g * 0.25; color.b += part.b * 0.25;
        }
        // A drop of two blocks or more across one corner is a bank or a cliff: earth and rock, not grass.
        const steep = stepped ? 0 : smoothstep(1.3, 2.6, hi - lo);
        color.lerp(CLIFF, steep);
        // Under water the bed, and a pale wet shore where water meets land.
        if (water > 0) color.lerp(water >= 1 ? BED : SHORE, water >= 1 ? 0.85 : 0.7);
        vHeight[v] = h / 4;
        vBare[v] = Math.min(1, bare + steep + water);
        vGlow[v] = lamp;
        vMade[v * 2] = soil; vMade[v * 2 + 1] = paving;
        vColor[v * 3] = color.r; vColor[v * 3 + 1] = color.g; vColor[v * 3 + 2] = color.b;
      }
    }
    // The lookups below read the corners either way: the grass asks them for its colour and where it may grow.
    for (let j = 0; j < SIDE; j++) {
      for (let i = 0; i < SIDE; i++) {
        const v = (j + 1) * VERTS + i + 1, n = j * SIDE + i;
        tile.heights[n] = vHeight[v] as number; tile.bare[n] = vBare[v] as number;
        tile.colors[n * 3] = vColor[v * 3] as number; tile.colors[n * 3 + 1] = vColor[v * 3 + 1] as number; tile.colors[n * 3 + 2] = vColor[v * 3 + 2] as number;
      }
    }
    if (stepped) { buildSteps(tile, x0, z0); return; }
    if (tile.slot < 0) {
      if (live.length >= room) grow(Math.max(64, room * 2));
      tile.slot = live.length;
      live.push(tile);
      listed = -1;
    }
    const geometry = sheet.geometry, first = tile.slot * RUN;
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute, normals = geometry.getAttribute('normal') as THREE.BufferAttribute, colors = geometry.getAttribute('color') as THREE.BufferAttribute;
    const glows = geometry.getAttribute('aGlow') as THREE.BufferAttribute, mades = geometry.getAttribute('aMade') as THREE.BufferAttribute;
    let low = Infinity, high = -Infinity;
    for (let j = 0; j < SIDE; j++) {
      for (let i = 0; i < SIDE; i++) {
        const v = (j + 1) * VERTS + i + 1, n = first + j * SIDE + i, h = vHeight[v] as number;
        low = Math.min(low, h); high = Math.max(high, h);
        positions.setXYZ(n, x0 + i, h, z0 + j);
        normal.set((vHeight[v - 1] as number) - (vHeight[v + 1] as number), 2, (vHeight[v - VERTS] as number) - (vHeight[v + VERTS] as number)).normalize();
        normals.setXYZ(n, normal.x, normal.y, normal.z);
        colors.setXYZ(n, vColor[v * 3], vColor[v * 3 + 1], vColor[v * 3 + 2]);
        glows.setXY(n, vGlow[v] as number, vBare[v] as number);
        mades.setXY(n, vMade[v * 2] as number, vMade[v * 2 + 1] as number);
      }
    }
    tile.ball.center.set(x0 + 8, (low + high) / 2, z0 + 8);
    tile.ball.radius = Math.hypot(11.4, (high - low) / 2 + 0.5);
    touched(tile.slot);
    listed = -1;
  }

  /** The four ways a column has a neighbour: the step in x and z, and the two ends of the edge they share. */
  const SIDES = [[-1, 0, 0, 0, 0, 1], [1, 0, 1, 0, 1, 1], [0, -1, 0, 0, 1, 0], [0, 1, 0, 1, 1, 1]] as const;

  /** Stepped land: a flat top for every column, and a riser of earth wherever the next column stands lower. */
  function buildSteps(tile: Tile, x0: number, z0: number): void {
    sp.length = sn.length = sc.length = sg.length = sm.length = si.length = 0;
    const paintCorner = (v: number, toEarth: number): void => {
      color.setRGB(vColor[v * 3] as number, vColor[v * 3 + 1] as number, vColor[v * 3 + 2] as number).lerp(EARTH, toEarth);
      sc.push(color.r, color.g, color.b);
      sg.push(vGlow[v] as number, toEarth > 0 ? 1 : vBare[v] as number);
      // A riser is earth, whatever lies on top.
      sm.push(toEarth > 0 ? 0 : vMade[v * 2] as number, toEarth > 0 ? 0 : vMade[v * 2 + 1] as number);
    };
    let low = Infinity, high = -Infinity;
    for (let j = 0; j < CHUNK; j++) {
      for (let i = 0; i < CHUNK; i++) {
        const c = (j + 2) * COLS + i + 2, h = top[c] as number, v = (j + 1) * VERTS + i + 1;
        tile.tops[j * CHUNK + i] = h;
        low = Math.min(low, h); high = Math.max(high, h);
        face(x0 + i, h, z0 + j, x0 + i + 1, h, z0 + j, x0 + i, h, z0 + j + 1, x0 + i + 1, h, z0 + j + 1, 0, 1, 0);
        paintCorner(v, 0); paintCorner(v + 1, 0); paintCorner(v + VERTS, 0); paintCorner(v + VERTS + 1, 0);
        for (const [dx, dz, ax, az, bx, bz] of SIDES) {
          const under = top[c + dz * COLS + dx] as number;
          if (h - under < 0.02) continue;
          low = Math.min(low, under);
          face(x0 + i + ax, h, z0 + j + az, x0 + i + bx, h, z0 + j + bz, x0 + i + ax, under, z0 + j + az, x0 + i + bx, under, z0 + j + bz, dx, 0, dz);
          // The turf hangs a little way over the edge, and under it is earth.
          paintCorner(v + az * VERTS + ax, 0.45); paintCorner(v + bz * VERTS + bx, 0.45);
          sc.push(EARTH.r, EARTH.g, EARTH.b, EARTH.r, EARTH.g, EARTH.b);
          sg.push(vGlow[v + az * VERTS + ax] as number, 1, vGlow[v + bz * VERTS + bx] as number, 1);
          sm.push(0, 0, 0, 0);
        }
      }
    }
    const mesh = tile.mesh as THREE.Mesh, geometry = mesh.geometry;
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(sn, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
    geometry.setAttribute('aGlow', new THREE.Float32BufferAttribute(sg, 2));
    geometry.setAttribute('aMade', new THREE.Float32BufferAttribute(sm, 2));
    geometry.setIndex(si);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + 8, (low + high) / 2, z0 + 8), Math.hypot(11.4, (high - low) / 2 + 0.5));
    tile.triangles = si.length / 3;
    mesh.visible = true;
  }

  function makeTile(cx: number, cz: number): Tile {
    let mesh: THREE.Mesh | null = null;
    if (stepped) {
      mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
      mesh.receiveShadow = true;
      mesh.visible = false;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    return { cx, cz, mesh, slot: -1, ball: new THREE.Sphere(), stamp: -2, heights: new Float32Array(SIDE * SIDE), bare: new Float32Array(SIDE * SIDE), colors: new Float32Array(SIDE * SIDE * 3), tops: new Float32Array(stepped ? CHUNK * CHUNK : 0), triangles: CHUNK * CHUNK * 2 };
  }

  /** The tile and the place inside it of a point, for the three lookups below. */
  const at = { tile: null as Tile | null, n: 0, fx: 0, fz: 0 };
  function locate(x: number, z: number): boolean {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const tile = tiles.get(key(cx, cz));
    if (!tile || tile.stamp < 0) return false;
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK, i = Math.min(CHUNK - 1, Math.floor(lx)), j = Math.min(CHUNK - 1, Math.floor(lz));
    at.tile = tile; at.n = j * SIDE + i; at.fx = lx - i; at.fz = lz - j;
    return true;
  }
  const blend = (a: Float32Array, n: number, step: number, offset: number, fx: number, fz: number): number => {
    const p = a[n * step + offset], q = a[(n + 1) * step + offset], r = a[(n + SIDE) * step + offset], s = a[(n + SIDE + 1) * step + offset];
    return p + (q - p) * fx + (r - p) * fz + (p - q - r + s) * fx * fz;
  };

  return {
    group,
    update(x, z, reach, view) {
      const fx = Math.floor(x / CHUNK), fz = Math.floor(z / CHUNK);
      // forEach, not for-of: this runs every frame, and for-of makes an entry for each tile.
      tiles.forEach((tile, k) => {
        if (Math.abs(tile.cx - fx) <= reach + 1 && Math.abs(tile.cz - fz) <= reach + 1) return;
        if (tile.mesh) { group.remove(tile.mesh); tile.mesh.geometry.dispose(); }
        release(tile);
        tiles.delete(k);
      });
      // Nearest first, a few a frame: the land grows outward from the hero.
      readRevisions(fx, fz, reach);
      let budget = PER_FRAME;
      for (let ring = 0; ring <= reach && budget > 0; ring++) {
        for (let dx = -ring; dx <= ring && budget > 0; dx++) {
          for (let dz = -ring; dz <= ring && budget > 0; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const cx = fx + dx, cz = fz + dz, stamp = stampOf(cx, cz);
            if (stamp < 0) continue;
            let tile = tiles.get(key(cx, cz));
            if (tile && tile.stamp === stamp) continue;
            if (!tile) tiles.set(key(cx, cz), (tile = makeTile(cx, cz)));
            build(tile);
            tile.stamp = stamp;
            budget--;
          }
        }
      }
      if (!stepped && room > 0) list(view);
    },
    heightAt(x, z) {
      if (!locate(x, z) || !at.tile) return NaN;
      // `at.n` counts corners, 17 to a row. A column's top is kept 16 to a row.
      return stepped ? at.tile.tops[at.n - Math.floor(at.n / SIDE)] as number : blend(at.tile.heights, at.n, 1, 0, at.fx, at.fz);
    },
    bareAt: (x, z) => (locate(x, z) && at.tile ? blend(at.tile.bare, at.n, 1, 0, at.fx, at.fz) : NaN),
    colorAt(x, z, out) {
      if (!locate(x, z) || !at.tile) return false;
      const c = at.tile.colors;
      out.setRGB(blend(c, at.n, 3, 0, at.fx, at.fz), blend(c, at.n, 3, 1, at.fx, at.fz), blend(c, at.n, 3, 2, at.fx, at.fz));
      return true;
    },
    stampAt: (cx, cz) => tiles.get(key(cx, cz))?.stamp ?? -1,
    get tiles() { return tiles.size; },
    get triangles() { if (!stepped) return drawn; let n = 0; for (const tile of tiles.values()) n += tile.triangles; return n; },
  };
}
