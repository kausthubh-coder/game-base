// The land far from the hero. The game keeps blocks in memory for about ninety blocks around the hero, and the
// near land is drawn from them. Past that, this draws the land from its shape alone: the same hills, rivers
// and woods, a point every few blocks (`farLandCell` in src/content/quality.ts), out to where the painted ridges stand. So the view runs to the
// horizon, and haze is only the air in between.
//
// It is one mesh that sits on a fixed grid in the world and is made again, a few rows a frame, each time the
// hero has walked into the next 32 blocks. Where the near land is drawn, this one is cut away.
import * as THREE from 'three';
import { LAND_COLORS } from '../../content/land.ts';
import { createGround, MEADOW_ONLY, type Nature } from './nature.ts';
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
  /** The kinds of land, so each reads from far off in its own colours. Left out, it is all meadow. */
  nature?: Nature;
}

export interface FarLand {
  readonly group: THREE.Group;
  /** Call every frame with the hero's place and how far out the near land is drawn. */
  update(x: number, z: number, near: number): void;
  /** Meters between two points. The land is made again at the new spacing. */
  setCell(cell: number): void;
  readonly triangles: number;
}

/** How far the mesh reaches from its middle, in blocks. */
const REACH = 304;
/** The mesh is made again when the hero is in another square of this many blocks. */
const SNAP = 32;
/** Rows worked out in one frame. */
const ROWS = 16;
/** How far under the true ground the far land lies, so the near land always covers it where both are drawn. */
const SINK = 0.7;
const DEEP = new THREE.Color(LAND_COLORS.grass.deep), BLADES = new THREE.Color(LAND_COLORS.grass.light), CLIFF = new THREE.Color(LAND_COLORS.cliff);

/** `cell` is the meters between two points. */
export function createFarLand(source: FarSource, textures: Textures, cell = 8): FarLand {
  /** Meters between two points, cells from the middle of the mesh to its edge, and points along a side. */
  let step = cell, half = Math.ceil(REACH / step), side = half * 2 + 1;
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
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(side * side * 3), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(side * side * 3), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(side * side * 3), 3));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    return { mesh, heights: new Float32Array(side * side), ox: NaN, oz: NaN };
  };
  // One sheet is shown while the other is made for the hero's new place.
  let shown = sheet(), next = sheet();
  let row = -1, hole = -1, triangles = 0;
  const color = new THREE.Color(), normal = new THREE.Vector3(), WATER = new THREE.Color(source.water);
  const ground = createGround(source.nature ?? MEADOW_ONLY), reading = new Float32Array(ground.size);

  /** Leaves out the cells that the near land always covers, wherever in its square the hero stands. */
  function cut(near: number): void {
    const inside = Math.max(0, near - SNAP * 0.75 - step * 1.5), index: number[] = [];
    for (let j = 0; j < side - 1; j++) {
      for (let i = 0; i < side - 1; i++) {
        if (Math.hypot((Math.abs(i + 0.5 - half) + 0.5) * step, (Math.abs(j + 0.5 - half) + 0.5) * step) < inside) continue;
        const a = j * side + i, b = a + 1, c = a + side, d = c + 1;
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
    for (let i = 0; i < side; i++) {
      const x = s.ox + (i - half) * step, z = s.oz + (j - half) * step, n = j * side + i;
      const h = source.heightAt(x, z), wet = h < source.waterLevel - 0.4;
      if (wet) color.copy(WATER);
      else {
        const top = source.topAt(x, z);
        ground.read(x, z, reading);
        // The near land is seen through its grass, whose blades are lighter than the ground. Woods are darker,
        // and the old forest darkest of all under its crowns. A marsh's pools and a kind's bare ground show
        // through as patches; the far land's points are several blocks apart, so they read as a mottle.
        if (top === 'grass') {
          const shade = ground.share(reading, 'oldForest');
          ground.green(x, z, reading, color).lerp(BLADES, 0.3 * (1 - shade)).lerp(DEEP, source.forestAt(x, z) * 0.4 + shade * 0.35);
          ground.finish(reading, 1, color);
          // A pool far off is water, a glint in the marsh.
          color.lerp(WATER, ground.wet(reading) * 0.85);
        } else color.set((LAND_COLORS as Record<string, unknown>)[top] as string ?? CLIFF);
        ground.grey(reading, color);
      }
      const y = wet ? source.waterLevel - 0.25 : Math.max(h - SINK, source.waterLevel - 0.25);
      s.heights[n] = y;
      positions.setXYZ(n, x, y, z);
      colors.setXYZ(n, color.r, color.g, color.b);
    }
  }

  function finish(s: Sheet): void {
    const geometry = s.mesh.geometry, normals = geometry.getAttribute('normal') as THREE.BufferAttribute, h = s.heights;
    for (let j = 0; j < side; j++) {
      for (let i = 0; i < side; i++) {
        const n = j * side + i, w = i > 0 ? n - 1 : n, e = i < side - 1 ? n + 1 : n, up = j > 0 ? n - side : n, down = j < side - 1 ? n + side : n;
        normal.set(((h[w] as number) - (h[e] as number)) / ((e - w) * step), 1, ((h[up] as number) - (h[down] as number)) / (((down - up) / side) * step)).normalize();
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
      for (let done = 0; done < ROWS && row < side; done++) fill(next, row++);
      if (row < side) return;
      finish(next);
      shown.mesh.visible = false;
      next.mesh.visible = true;
      [shown, next] = [next, shown];
      row = -1;
    },
    setCell(spacing) {
      if (spacing === step) return;
      step = spacing; half = Math.ceil(REACH / step); side = half * 2 + 1;
      for (const s of [shown, next]) { group.remove(s.mesh); s.mesh.geometry.dispose(); }
      shown = sheet(); next = sheet();
      row = -1; hole = -1;
    },
    get triangles() { return triangles; },
  };
}
