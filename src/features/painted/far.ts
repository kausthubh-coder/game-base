// The land far from the hero. The game keeps blocks in memory for about ninety blocks around the hero, and the
// near land is drawn from them. Past that, this draws the land from its shape alone: the same hills, rivers
// and woods, a point every eight blocks, out to where the painted ridges stand. So the view runs to the
// horizon, and haze is only the air in between.
//
// It is one mesh that sits on a fixed grid in the world and is made again, a few rows a frame, each time the
// hero has walked into the next 32 blocks. Where the near land is drawn, this one is cut away.
import * as THREE from 'three';
import { LAND_COLORS } from '../../content/land.ts';
import { meadowColor } from './land.ts';
import { paint } from './paint.ts';
import type { Textures } from './textures.ts';

/** What the far land asks about a place. Every answer comes from the land's shape, so it works where no chunk is loaded. */
export interface FarSource {
  /** The height of the ground. */
  heightAt(x: number, z: number): number;
  /** What the ground is: a key of `LAND_COLORS`, such as `grass` or `stone`. */
  topAt(x: number, z: number): string;
  /** 0 on open land to 1 in deep woods. */
  forestAt(x: number, z: number): number;
  /** Water lies on ground lower than this. */
  waterLevel: number;
  /** The colour of water seen from far off, as sRGB hex. */
  water: string;
}

export interface FarLand {
  readonly group: THREE.Group;
  /** Call every frame with the hero's place and how far out the near land is drawn. */
  update(x: number, z: number, near: number): void;
  readonly triangles: number;
}

/** Meters between two points of the far land. */
const CELL = 8;
/** Cells from the middle of the mesh to its edge: 304 blocks. */
const HALF = 38;
const SIDE = HALF * 2 + 1;
/** The mesh is made again when the hero is in another square of this many blocks. */
const SNAP = 32;
/** Rows worked out in one frame. */
const ROWS = 16;
/** How far under the true ground the far land lies, so the near land always covers it where both are drawn. */
const SINK = 0.7;
const DEEP = new THREE.Color(LAND_COLORS.grass.deep), CLIFF = new THREE.Color(LAND_COLORS.cliff);

export function createFarLand(source: FarSource, textures: Textures): FarLand {
  const group = new THREE.Group();
  group.name = 'far-land';
  const material = paint({
    vertexColors: true, brush: 0.3, bands: 0.3, wrap: 0.25, brushScale: 0.06,
    uniforms: { uGround: { value: textures.ground }, uGroundMean: { value: textures.groundMean } },
    fragmentPars: 'uniform sampler2D uGround; uniform vec3 uGroundMean;',
    // The meadow painting at its larger size only: the small marks are lost at this distance.
    fragmentAlbedo: 'diffuseColor.rgb *= mix(vec3(1.0), texture2D(uGround, vPaintWorld.xz * 0.031 + 0.37).rgb / uGroundMean, 0.4);',
    // Cut away where the near land is drawn. The near land thins out over the same few meters.
    fragmentFinal: /* glsl */ `
      if (distance(vPaintWorld.xz, uFocus.xz) < uEdge.x - 1.0) discard;
      vec3 outgoingLight = paintAir(paintShade(diffuseColor.rgb, paintLit(0.0)));`,
  });

  interface Sheet { mesh: THREE.Mesh; heights: Float32Array; ox: number; oz: number }
  const sheet = (): Sheet => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SIDE * SIDE * 3), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(SIDE * SIDE * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SIDE * SIDE * 3), 3));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    return { mesh, heights: new Float32Array(SIDE * SIDE), ox: NaN, oz: NaN };
  };
  // One sheet is shown while the other is made for the hero's new place.
  let shown = sheet(), next = sheet();
  let row = -1, hole = -1, triangles = 0;
  const color = new THREE.Color(), normal = new THREE.Vector3(), WATER = new THREE.Color(source.water);

  /** Leaves out the cells that the near land always covers, wherever in its square the hero stands. */
  function cut(near: number): void {
    const inside = Math.max(0, near - SNAP * 0.75 - CELL * 1.5), index: number[] = [];
    for (let j = 0; j < SIDE - 1; j++) {
      for (let i = 0; i < SIDE - 1; i++) {
        if (Math.hypot((Math.abs(i + 0.5 - HALF) + 0.5) * CELL, (Math.abs(j + 0.5 - HALF) + 0.5) * CELL) < inside) continue;
        const a = j * SIDE + i, b = a + 1, c = a + SIDE, d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
    const attribute = new THREE.BufferAttribute(new Uint16Array(index), 1);
    shown.mesh.geometry.setIndex(attribute);
    next.mesh.geometry.setIndex(attribute);
    triangles = index.length / 3;
  }

  function fill(s: Sheet, j: number): void {
    const positions = s.mesh.geometry.getAttribute('position') as THREE.BufferAttribute, colors = s.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < SIDE; i++) {
      const x = s.ox + (i - HALF) * CELL, z = s.oz + (j - HALF) * CELL, n = j * SIDE + i;
      const h = source.heightAt(x, z), wet = h < source.waterLevel - 0.4;
      if (wet) color.copy(WATER);
      else {
        const top = source.topAt(x, z);
        if (top === 'grass') meadowColor(x, z, color).lerp(DEEP, source.forestAt(x, z) * 0.45);
        else color.set((LAND_COLORS as Record<string, unknown>)[top] as string ?? CLIFF);
      }
      const y = wet ? source.waterLevel - 0.25 : Math.max(h - SINK, source.waterLevel - 0.25);
      s.heights[n] = y;
      positions.setXYZ(n, x, y, z);
      colors.setXYZ(n, color.r, color.g, color.b);
    }
  }

  function finish(s: Sheet): void {
    const geometry = s.mesh.geometry, normals = geometry.getAttribute('normal') as THREE.BufferAttribute, h = s.heights;
    for (let j = 0; j < SIDE; j++) {
      for (let i = 0; i < SIDE; i++) {
        const n = j * SIDE + i, w = i > 0 ? n - 1 : n, e = i < SIDE - 1 ? n + 1 : n, up = j > 0 ? n - SIDE : n, down = j < SIDE - 1 ? n + SIDE : n;
        normal.set(((h[w] as number) - (h[e] as number)) / ((e - w) * CELL), 1, ((h[up] as number) - (h[down] as number)) / (((down - up) / SIDE) * CELL)).normalize();
        normals.setXYZ(n, normal.x, normal.y, normal.z);
      }
    }
    geometry.getAttribute('position').needsUpdate = geometry.getAttribute('color').needsUpdate = normals.needsUpdate = true;
  }

  return {
    group,
    update(x, z, near) {
      if (near !== hole) cut((hole = near));
      const ox = Math.round(x / SNAP) * SNAP, oz = Math.round(z / SNAP) * SNAP;
      if (row < 0 && (ox !== shown.ox || oz !== shown.oz)) { next.ox = ox; next.oz = oz; row = 0; }
      if (row < 0) return;
      for (let done = 0; done < ROWS && row < SIDE; done++) fill(next, row++);
      if (row < SIDE) return;
      finish(next);
      shown.mesh.visible = false;
      next.mesh.visible = true;
      [shown, next] = [next, shown];
      row = -1;
    },
    get triangles() { return triangles; },
  };
}
