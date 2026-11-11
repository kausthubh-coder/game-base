// The meadow's grass, tufts and flowers, grown on the land as it loads. A blade's root has the ground's own
// colour and its normal points up, so the field and the ground read as one surface. Gusts of wind travel
// across it, bend the blades and lift their pale tips.
//
// The land is cut into cells of one chunk. A cell grows its grass once, at the fineness its distance from the
// hero asks for, and keeps it. Each kind of thing is one draw call: when the cells in reach change, their
// kept blades are copied into it. So walking costs a copy, and only new land costs growing.
import * as THREE from 'three';
import { QUALITY, type Level } from '../../content/quality.ts';
import { fbm, smoothstep, type Land } from './land.ts';
import { paint } from './paint.ts';
import { cardHooks } from './trees.ts';
import type { Textures } from './textures.ts';

export interface Grass {
  readonly group: THREE.Group;
  /** Grows and keeps the grass round this point. Call it every frame. */
  update(x: number, z: number): void;
  setQuality(quality: Level): void;
  readonly triangles: number;
}

const CELL = 16;
/** How fine a cell's grass is, by its distance from the hero: fine blades near, broad strokes far. */
const RINGS = [
  { to: 34, spacing: 0.5, width: [0.11, 0.19], height: [0.28, 0.6], tufts: 22, flowers: 26 },
  { to: 66, spacing: 1.0, width: [0.22, 0.35], height: [0.36, 0.8], tufts: 9, flowers: 12 },
  { to: 112, spacing: 2.3, width: [0.5, 0.75], height: [0.5, 1.0], tufts: 0, flowers: 0 },
] as const;
/** Cells grown in one frame at most. */
const PER_FRAME = 2;
const PETALS = ['#fffaf0', '#fffaf0', '#f8dd6a', '#f8dd6a', '#f4aebd', '#cdb8f0'].map((h) => new THREE.Color(h));

/** How tall the grass grows at a spot, from 0 to 1: long grass comes in patches. */
const tallness = (x: number, z: number): number => smoothstep(0.38, 0.7, fbm(x / 17, z / 17, 2, 55));

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function bladeGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.34, 0.5, 0.07, 0.34, 0.5, 0.07, 0, 1, 0.22], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 0.5, 1, 0.5, 0.5, 1], 2));
  g.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  return g;
}

function cardGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** What one cell grew: per blade a matrix and a colour, per tuft and flower a place, a colour and its card. */
interface Cell {
  ring: number;
  /** The land's own stamp when it grew, so grass grows again when the land under it changes. */
  stamp: number;
  blades: Float32Array; bladeColors: Float32Array;
  tufts: Float32Array[]; tuftColors: Float32Array[]; tuftCards: Float32Array[];
  flowers: Float32Array; flowerColors: Float32Array; flowerCards: Float32Array;
}

/** One draw call that holds what many cells grew. */
interface Batch {
  mesh: THREE.InstancedMesh;
  capacity: number;
  cards: THREE.InstancedBufferAttribute | null;
}

export function createGrass(land: Land, textures: Textures, quality: Level): Grass {
  const group = new THREE.Group();
  group.name = 'grass';
  // The quality table says how much the blades are thinned and how far out they grow.
  let level = QUALITY[quality];

  const bladeMaterial = paint({
    side: THREE.DoubleSide, keepNormal: true, brush: 0.3, bands: 0.3, wrap: 0.25, brushScale: 0.06, dapple: 1,
    vertexPars: 'varying vec2 vBlade;',
    // The wind pushes a blade's tip, not its root, and pushes harder in a gust.
    vertexWorld: /* glsl */ `
      vec3 root = instanceMatrix[3].xyz;
      float gust = paintGust(root.xz);
      float flutter = sin(uTime * 2.6 + root.x * 1.3 + root.z * 1.7) * 0.5 + 0.5;
      float push = (0.07 + 0.55 * gust + 0.06 * flutter) * uv.y * uv.y * length(instanceMatrix[1].xyz);
      paintWorldPos.xz += uWind.xy * push;
      paintWorldPos.y -= push * 0.4 * uv.y;
      vBlade = vec2(uv.y, gust);`,
    fragmentPars: 'varying vec2 vBlade;',
    fragmentAlbedo: /* glsl */ `
      vec3 tip = diffuseColor.rgb * vec3(1.13, 1.1, 0.86) + vec3(0.02, 0.025, 0.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, tip, vBlade.x * vBlade.x);
      diffuseColor.rgb += vec3(0.1, 0.11, 0.06) * vBlade.y * vBlade.x;`,
  });
  const tuftMaterial = (mask: THREE.Texture): THREE.Material => {
    const material = paint({
      map: mask, alphaTest: 0.5, side: THREE.DoubleSide, keepNormal: true, brush: 0.25, bands: 0.3, wrap: 0.3, dapple: 1,
      vertexPars: 'attribute vec4 aCard; varying vec2 vCard;',
      vertexWorld: 'float gust = paintGust(paintWorldPos.xz);',
      // The card stands on its lower edge and faces the camera. The wind leans its top the way it blows across the screen.
      vertexView: /* glsl */ `
        vec2 corner = vec2((uv.x - 0.5) * (aCard.y > 0.5 ? -1.0 : 1.0), uv.y) * aCard.x;
        float across = (viewMatrix * vec4(uWind.x, 0.0, uWind.y, 0.0)).x;
        corner.x += across * (0.06 + 0.42 * gust + 0.04 * sin(uTime * 2.3 + aCard.z * 30.0)) * uv.y * uv.y * aCard.x;
        mvPosition.xy += corner;
        vCard = vec2(uv.y, gust);`,
      fragmentPars: 'varying vec2 vCard;',
      fragmentAlbedo: /* glsl */ `
        vec3 foot = diffuseColor.rgb * vec3(0.6, 0.8, 0.72), tips = diffuseColor.rgb * vec3(1.15, 1.12, 0.86) + vec3(0.02, 0.025, 0.0);
        diffuseColor.rgb = mix(foot, tips, smoothstep(0.05, 0.85, vCard.x)) + vec3(0.09, 0.1, 0.05) * vCard.y * vCard.x;`,
    });
    material.alphaToCoverage = true;
    return material;
  };
  const flowerMaterial = paint({ ...cardHooks([0.5, 0.5]), map: textures.flower, alphaTest: 0.5, side: THREE.DoubleSide, keepNormal: true, brush: 0.1, bands: 0.2, wrap: 0.6 });
  flowerMaterial.alphaToCoverage = true;

  function batch(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number, cards: boolean, name: string): Batch {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    let attribute: THREE.InstancedBufferAttribute | null = null;
    if (cards) {
      attribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
      attribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('aCard', attribute);
    }
    mesh.name = name;
    mesh.count = 0;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return { mesh, capacity, cards: attribute };
  }
  const blades = batch(bladeGeometry(), bladeMaterial, 70000, false, 'blades');
  const tufts = textures.tufts.map((mask, i) => batch(cardGeometry(), tuftMaterial(mask), 2600, true, `tufts-${i}`));
  const flowers = batch(cardGeometry(), flowerMaterial, 5200, true, 'flowers');

  const cells = new Map<number, Cell>();
  const key = (cx: number, cz: number): number => (cx + 32768) * 65536 + (cz + 32768);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(), size = new THREE.Vector3(), color = new THREE.Color();

  /** Grows one cell at the fineness of a ring. Null while the land under it is not drawn yet. */
  function grow(cx: number, cz: number, ringIndex: number): Cell | null {
    const x0 = cx * CELL, z0 = cz * CELL;
    if (!(land.heightAt(x0 + 8, z0 + 8) === land.heightAt(x0 + 8, z0 + 8))) return null;
    const ring = RINGS[ringIndex] as (typeof RINGS)[number], spacing = ring.spacing * level.grassSpacing;
    const r = random(Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ (ringIndex * 977));
    const bladeData: number[] = [], bladeColorData: number[] = [];
    for (let z = z0 + spacing / 2; z < z0 + CELL; z += spacing) {
      for (let x = x0 + spacing / 2; x < x0 + CELL; x += spacing) {
        const px = x + (r() - 0.5) * spacing, pz = z + (r() - 0.5) * spacing;
        const bare = land.bareAt(px, pz), h = land.heightAt(px, pz);
        if (!(bare === bare) || !(h === h)) continue;
        const open = 1 - bare;
        if (open < 0.5 || r() > open) continue;
        // Long grass grows in patches and stays short beside bare ground.
        const tall = 0.55 + 1.05 * tallness(px, pz);
        const width = ring.width[0] + r() * (ring.width[1] - ring.width[0]);
        const height = (ring.height[0] + r() * (ring.height[1] - ring.height[0])) * tall * (0.5 + 0.5 * open);
        m.compose(at.set(px, h - 0.03, pz), q.setFromAxisAngle(up, r() * Math.PI * 2), size.set(width, height, width));
        for (let i = 0; i < 16; i++) bladeData.push(m.elements[i] as number);
        land.colorAt(px, pz, color);
        bladeColorData.push(color.r, color.g, color.b);
      }
    }
    const tuftData: number[][] = tufts.map(() => []), tuftColorData: number[][] = tufts.map(() => []), tuftCardData: number[][] = tufts.map(() => []);
    for (let i = 0, tries = 0; i < ring.tufts && tries < ring.tufts * 6; tries++) {
      const px = x0 + r() * CELL, pz = z0 + r() * CELL, bare = land.bareAt(px, pz), h = land.heightAt(px, pz);
      if (!(bare === bare) || bare > 0.15 || r() > 0.25 + 0.75 * tallness(px, pz)) continue;
      const which = i % tufts.length;
      m.makeTranslation(px, h - 0.04, pz);
      for (let k = 0; k < 16; k++) (tuftData[which] as number[]).push(m.elements[k] as number);
      land.colorAt(px, pz, color);
      (tuftColorData[which] as number[]).push(color.r, color.g, color.b);
      (tuftCardData[which] as number[]).push((0.55 + r() * 0.75) * (0.8 + 0.5 * tallness(px, pz)) * (1 + ringIndex * 0.5), r(), r(), 1);
      i++;
    }
    const flowerData: number[] = [], flowerColorData: number[] = [], flowerCardData: number[] = [];
    for (let i = 0; i < ring.flowers * 3; i++) {
      const px = x0 + r() * CELL, pz = z0 + r() * CELL;
      // Drifts: flowers grow where a slow noise is high, and one colour leads in each drift.
      if (fbm(px / 13, pz / 13, 2, 77) < 0.56) continue;
      const bare = land.bareAt(px, pz), h = land.heightAt(px, pz);
      if (!(bare === bare) || bare > 0.2) continue;
      const lead = Math.floor(fbm(px / 30, pz / 30, 1, 78) * PETALS.length), pick = r() < 0.7 ? lead : Math.floor(r() * PETALS.length);
      m.makeTranslation(px, h + 0.22 + r() * 0.3, pz);
      for (let k = 0; k < 16; k++) flowerData.push(m.elements[k] as number);
      const petal = PETALS[Math.min(PETALS.length - 1, pick)] as THREE.Color;
      flowerColorData.push(petal.r, petal.g, petal.b);
      flowerCardData.push(0.2 + r() * 0.16, r() * 6.283, r(), 0.5);
    }
    return {
      ring: ringIndex, stamp: land.stampAt(cx, cz),
      blades: new Float32Array(bladeData), bladeColors: new Float32Array(bladeColorData),
      tufts: tuftData.map((d) => new Float32Array(d)), tuftColors: tuftColorData.map((d) => new Float32Array(d)), tuftCards: tuftCardData.map((d) => new Float32Array(d)),
      flowers: new Float32Array(flowerData), flowerColors: new Float32Array(flowerColorData), flowerCards: new Float32Array(flowerCardData),
    };
  }

  function fill(b: Batch, parts: Float32Array[], colors: Float32Array[], cards: Float32Array[] | null): void {
    const matrices = b.mesh.instanceMatrix.array as Float32Array, tints = (b.mesh.instanceColor as THREE.InstancedBufferAttribute).array as Float32Array;
    let n = 0;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] as Float32Array, count = Math.min(part.length / 16, b.capacity - n);
      if (count <= 0) break;
      matrices.set(part.subarray(0, count * 16), n * 16);
      tints.set((colors[i] as Float32Array).subarray(0, count * 3), n * 3);
      if (cards && b.cards) (b.cards.array as Float32Array).set((cards[i] as Float32Array).subarray(0, count * 4), n * 4);
      n += count;
    }
    b.mesh.count = n;
    b.mesh.instanceMatrix.needsUpdate = true;
    (b.mesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    if (b.cards) b.cards.needsUpdate = true;
  }

  let lastX = NaN, lastZ = NaN, stale = true, triangles = 0;
  const bladeParts: Float32Array[] = [], bladeColorParts: Float32Array[] = [], flowerParts: Float32Array[] = [], flowerColorParts: Float32Array[] = [], flowerCardParts: Float32Array[] = [];
  const tuftParts: Float32Array[][] = tufts.map(() => []), tuftColorParts: Float32Array[][] = tufts.map(() => []), tuftCardParts: Float32Array[][] = tufts.map(() => []);

  return {
    group,
    update(x, z) {
      const fx = Math.floor(x / CELL), fz = Math.floor(z / CELL);
      const reach = Math.ceil((RINGS[level.grassRings - 1] as (typeof RINGS)[number]).to / CELL);
      if (fx !== lastX || fz !== lastZ) { lastX = fx; lastZ = fz; stale = true; }
      // Grow what is missing or too coarse, nearest first, a few cells a frame.
      let budget = PER_FRAME;
      for (let ring = 0; ring <= reach && budget > 0; ring++) {
        for (let dx = -ring; dx <= ring && budget > 0; dx++) {
          for (let dz = -ring; dz <= ring && budget > 0; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const far = Math.hypot((fx + dx + 0.5) * CELL - x, (fz + dz + 0.5) * CELL - z);
            const want = RINGS.findIndex((r, i) => i < level.grassRings && far < r.to + CELL * 0.7);
            if (want < 0) continue;
            // A cell keeps finer grass than it needs until it is well past the ring, so a step back and forth grows nothing.
            const loose = RINGS.findIndex((r, i) => i < level.grassRings && far < r.to + CELL * 1.9);
            const k = key(fx + dx, fz + dz), have = cells.get(k);
            if (have && have.ring <= want && have.ring >= loose && have.stamp === land.stampAt(fx + dx, fz + dz)) continue;
            const grown = grow(fx + dx, fz + dz, want);
            if (!grown) continue;
            cells.set(k, grown);
            stale = true;
            budget--;
          }
        }
      }
      if (!stale) return;
      stale = false;
      bladeParts.length = bladeColorParts.length = flowerParts.length = flowerColorParts.length = flowerCardParts.length = 0;
      for (const list of [...tuftParts, ...tuftColorParts, ...tuftCardParts]) list.length = 0;
      for (const [k, cell] of cells) {
        const cx = Math.floor(k / 65536) - 32768, cz = (k % 65536) - 32768;
        if (Math.abs(cx - fx) > reach + 1 || Math.abs(cz - fz) > reach + 1) { cells.delete(k); continue; }
        bladeParts.push(cell.blades); bladeColorParts.push(cell.bladeColors);
        flowerParts.push(cell.flowers); flowerColorParts.push(cell.flowerColors); flowerCardParts.push(cell.flowerCards);
        cell.tufts.forEach((part, i) => { (tuftParts[i] as Float32Array[]).push(part); (tuftColorParts[i] as Float32Array[]).push(cell.tuftColors[i] as Float32Array); (tuftCardParts[i] as Float32Array[]).push(cell.tuftCards[i] as Float32Array); });
      }
      fill(blades, bladeParts, bladeColorParts, null);
      tufts.forEach((b, i) => fill(b, tuftParts[i] as Float32Array[], tuftColorParts[i] as Float32Array[], tuftCardParts[i] as Float32Array[]));
      fill(flowers, flowerParts, flowerColorParts, flowerCardParts);
      triangles = blades.mesh.count * 3 + (flowers.mesh.count + tufts.reduce((sum, b) => sum + b.mesh.count, 0)) * 2;
    },
    setQuality(next) {
      level = QUALITY[next];
      cells.clear();
      stale = true;
    },
    get triangles() { return triangles; },
  };
}
