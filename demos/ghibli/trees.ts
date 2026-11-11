// Trees and bushes the way a background painter builds them: a dark mass first, then dabs of lighter
// leaves on the side the sun reaches. The crown is leaf cards scattered over rounded blobs. Every card
// takes its normal from the blob it sits on, so it gets one tone, and the crown shades as one round form.
// In the vertex shader each card turns to face the camera and is cut to a brush-dab shape by a mask.
import * as THREE from 'three';
import { paint, paintDepth, type PaintOptions } from './paint.ts';
import type { Textures } from './textures.ts';

export interface TreeSpec {
  seed: number;
  height: number;
  /** Trunk radius at the ground. */
  trunk: number;
  /** Crown radius. */
  crown: number;
  blobs: number;
  /** Size of one leaf card in meters. */
  card: number;
  /** Cards per card-sized patch of blob surface. */
  cover: number;
  /** Crown height over its width. */
  squash: number;
  /** How far the trunk leans, in meters at the top. */
  lean: number;
  /** The most a card is turned, in radians. Leaf masks turn any way; a painting with its own light stays upright. */
  spin?: number;
  /** How far out on its blob a card sits, as a share of the blob's radius: least and most. */
  inset?: [number, number];
  /** The dark ball inside each blob, as a share of the blob's radius. */
  core?: number;
}

export interface TreeShape { wood: THREE.BufferGeometry; leaves: THREE.BufferGeometry; cards: number }

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

class Builder {
  positions: number[] = []; normals: number[] = []; colors: number[] = []; index: number[] = [];
  vertex(p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color): number {
    this.positions.push(p.x, p.y, p.z); this.normals.push(n.x, n.y, n.z); this.colors.push(c.r, c.g, c.b);
    return this.positions.length / 3 - 1;
  }
  /** A tube through `path`, `sides` round, with the radius given at each point. */
  tube(path: THREE.Vector3[], radii: number[], sides: number, low: THREE.Color, high: THREE.Color): void {
    const p = new THREE.Vector3(), n = new THREE.Vector3(), tangent = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(), c = new THREE.Color();
    const first = this.positions.length / 3;
    path.forEach((centre, j) => {
      tangent.copy(path[Math.min(path.length - 1, j + 1)] as THREE.Vector3).sub(path[Math.max(0, j - 1)] as THREE.Vector3).normalize();
      side.set(1, 0, 0).cross(tangent);
      if (side.lengthSq() < 0.01) side.set(0, 0, 1).cross(tangent);
      side.normalize(); up.copy(tangent).cross(side);
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        n.copy(side).multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a));
        p.copy(centre).addScaledVector(n, radii[j] as number);
        this.vertex(p, n, c.copy(low).lerp(high, j / (path.length - 1)));
      }
    });
    for (let j = 0; j < path.length - 1; j++) {
      for (let i = 0; i < sides; i++) {
        const a = first + j * sides + i, b = first + j * sides + ((i + 1) % sides), c2 = a + sides, d = b + sides;
        this.index.push(a, b, c2, b, d, c2);
      }
    }
  }
  /** A faceted ball: the dark inside of a blob of leaves. */
  ball(centre: THREE.Vector3, radius: THREE.Vector3, color: THREE.Color): void {
    const g = new THREE.IcosahedronGeometry(1, radius.x > 2.5 ? 1 : 0), pos = g.getAttribute('position');
    const p = new THREE.Vector3(), n = new THREE.Vector3(), first = this.positions.length / 3;
    for (let i = 0; i < pos.count; i++) {
      n.fromBufferAttribute(pos, i).normalize();
      this.vertex(p.copy(n).multiply(radius).add(centre), n, color);
      this.index.push(first + i);
    }
    g.dispose();
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setIndex(this.index);
    return g;
  }
}

const BARK_LOW = new THREE.Color('#8a5c44'), BARK_HIGH = new THREE.Color('#ab7d58'), CORE = new THREE.Color('#3d7547');

/** Builds one tree. A bush is a tree with no height. */
export function buildTree(spec: TreeSpec): TreeShape {
  const r = random(spec.seed), wood = new Builder();
  const crownY = Math.max(spec.crown * spec.squash * 0.75, spec.height - spec.crown * spec.squash * 0.5);
  const crownCentre = new THREE.Vector3(spec.lean, crownY, spec.lean * 0.4);

  // ---- blobs: one in the middle, the rest round it and above it
  const blobs: Array<{ c: THREE.Vector3; r: number }> = [{ c: crownCentre.clone(), r: spec.crown * 0.62 }];
  for (let i = 1; i < spec.blobs; i++) {
    const a = (i / (spec.blobs - 1)) * Math.PI * 2 + r() * 0.8, up = -0.2 + r() * 1.0, flat = Math.sqrt(Math.max(0, 1 - up * up * 0.7));
    const d = spec.crown * (0.45 + r() * 0.3);
    blobs.push({ c: new THREE.Vector3(Math.cos(a) * flat * d, up * d * spec.squash, Math.sin(a) * flat * d).add(crownCentre), r: spec.crown * (0.3 + r() * 0.2) });
  }

  // ---- trunk and boughs
  if (spec.height > 0) {
    const top = crownCentre.clone().setY(crownY - spec.crown * spec.squash * 0.35);
    const path: THREE.Vector3[] = [], radii: number[] = [];
    for (let j = 0; j <= 6; j++) {
      const t = j / 6;
      path.push(new THREE.Vector3(top.x * t * t + Math.sin(t * 5 + spec.seed) * spec.trunk * 0.25, top.y * t, top.z * t * t));
      radii.push(spec.trunk * (1 + 0.9 * Math.exp(-t * 9)) * (1 - 0.55 * t));
    }
    wood.tube(path, radii, 8, BARK_LOW, BARK_HIGH);
    for (const blob of blobs.slice(1, 6)) {
      const from = (path[4] as THREE.Vector3).clone(), mid = from.clone().lerp(blob.c, 0.5).add(new THREE.Vector3(0, -blob.r * 0.25, 0));
      wood.tube([from, mid, blob.c], [spec.trunk * 0.36, spec.trunk * 0.24, spec.trunk * 0.1], 5, BARK_HIGH, BARK_HIGH);
    }
  }
  const core = spec.core ?? 0.8;
  for (const blob of blobs) wood.ball(blob.c, new THREE.Vector3(blob.r * core, blob.r * core * spec.squash, blob.r * core), CORE);

  // ---- leaf cards on the blobs
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], cards: number[] = [], index: number[] = [];
  const dir = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  const spin = spec.spin ?? Math.PI, inset = spec.inset ?? [0.92, 1.08];
  let count = 0;
  const crownTop = crownY + spec.crown * spec.squash, crownLow = crownY - spec.crown * spec.squash;
  for (const blob of blobs) {
    const wanted = Math.round((spec.cover * 4 * Math.PI * blob.r * blob.r) / (spec.card * spec.card));
    for (let k = 0; k < wanted; k++) {
      // Even spread over the sphere, then a little scatter.
      const y = 1 - (2 * (k + 0.5)) / wanted, ring = Math.sqrt(1 - y * y), a = k * 2.399963 + r() * 0.5;
      dir.set(Math.cos(a) * ring, y, Math.sin(a) * ring);
      if (dir.y < -0.45) continue;
      p.set(dir.x * blob.r, dir.y * blob.r * spec.squash, dir.z * blob.r).multiplyScalar(inset[0] + r() * (inset[1] - inset[0])).add(blob.c);
      if (blobs.some((other) => other !== blob && p.distanceTo(other.c) < other.r * 0.78)) continue;
      n.copy(p).sub(crownCentre).normalize().lerp(dir, 0.55).normalize();
      const size = spec.card * (0.65 + r() * 0.8), turn = (r() - 0.5) * 2 * spin, rand = r();
      const sway = spec.height > 0 ? 0.35 + 0.65 * (p.y - crownLow) / (crownTop - crownLow) : 0.3;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
        positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z); uvs.push(u, v); cards.push(size, turn, rand, sway);
      }
      index.push(count * 4, count * 4 + 1, count * 4 + 2, count * 4, count * 4 + 2, count * 4 + 3);
      count++;
    }
  }
  const leaves = new THREE.BufferGeometry();
  leaves.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  leaves.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  leaves.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  leaves.setAttribute('aCard', new THREE.Float32BufferAttribute(cards, 4));
  leaves.setIndex(index);
  return { wood: wood.geometry(), leaves, cards: count };
}

/** Four tones from deep shade to the sunlit top, as a painter mixes them for one kind of tree. */
export type Tones = [string, string, string, string];

/**
 * Shader hooks for anything drawn as cards that face the camera. The geometry needs `aCard`: size, turn, a
 * random number, sway. `shape` is the card's half width and half height in card sizes, `wobble` how much a
 * card turns in the wind, `push` how far out (in card sizes) the point lies whose shadow the card takes.
 */
export function cardHooks(shape: [number, number], wobble = 1, push = 1.3): PaintOptions {
  return {
    vertexPars: 'attribute vec4 aCard; varying vec3 vCard;',
    // The whole card sways with the bough it hangs from, more in a gust and more near the top.
    vertexWorld: /* glsl */ `
      float gust = paintGust(paintWorldPos.xz);
      float phase = paintWorldPos.x * 0.21 + paintWorldPos.z * 0.17 + aCard.z * 6.283;
      paintWorldPos.xz += uWind.xy * (0.05 + 0.3 * gust) * aCard.w * (0.6 + 0.4 * sin(uTime * 1.7 + phase));`,
    // All four corners start at the card's middle. They move out in view space, so the card faces the camera.
    vertexView: /* glsl */ `
      float cardSize = aCard.x;
      #ifdef USE_INSTANCING
        cardSize *= length(instanceMatrix[0].xyz);
      #endif
      float turn = aCard.y + sin(uTime * 1.3 + aCard.z * 40.0) * (0.06 + 0.16 * gust) * ${wobble.toFixed(2)};
      vec2 corner = (uv * 2.0 - 1.0) * cardSize * vec2(${shape[0].toFixed(3)}, ${shape[1].toFixed(3)});
      mvPosition.xy += mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * corner;
      vCard = vec3(aCard.z, gust, aCard.w);`,
    // A card takes its shadow from a point pushed out along its normal, clear of the cards beside it. Without
    // this the leaves shade one another at random and the crown loses its round form.
    vertexShadow: `worldPosition.xyz += normalize(mat3(modelMatrix) * objectNormal) * aCard.x * ${push.toFixed(2)};`,
  };
}

/**
 * How a crown's leaves are drawn. `fluffy`: many small cards cut by a leaf mask, shaded smoothly through four
 * tones. `painted`: a few large cards, each a painting of a bough of leaves with its own light and shade.
 */
export type LeafLook = { kind: 'fluffy'; mask: THREE.Texture; tones: Tones } | { kind: 'painted'; map: THREE.Texture };

export interface Foliage { leaf: THREE.MeshLambertMaterial; depth: THREE.MeshDepthMaterial; wood: THREE.MeshLambertMaterial }

/** The materials of one kind of tree. */
export function foliageMaterials(textures: Textures, look: LeafLook): Foliage {
  let leaf: THREE.MeshLambertMaterial, depth: THREE.MeshDepthMaterial;
  if (look.kind === 'fluffy') {
    const hooks = cardHooks([0.62, 0.5], 1, 1.6);
    leaf = paint({
      ...hooks, map: look.mask, alphaTest: 0.5, side: THREE.DoubleSide, keepNormal: true, brush: 0.1, bands: 0, wrap: 0.5, brushScale: 0.05,
      uniforms: { uTones: { value: look.tones.map((t) => new THREE.Color(t)) } },
      fragmentPars: 'uniform vec3 uTones[4], uLeafSun, uLeafShade; varying vec3 vCard;',
      // The tone runs smoothly from deep shade to the sunlit top. The mask's own brush marks shift it a little,
      // so single leaves catch the light, and leaves low in the crown are darker.
      fragmentFinal: /* glsl */ `
        float detail = texture2D(map, vMapUv).r;
        float lit = paintLit((vCard.x - 0.5) * 0.12 + (detail - 0.85) * 0.7 + vCard.y * 0.06);
        vec3 tone = mix(uTones[0], uTones[1], smoothstep(0.08, 0.36, lit));
        tone = mix(tone, uTones[2], smoothstep(0.36, 0.66, lit));
        tone = mix(tone, uTones[3], smoothstep(0.7, 0.96, lit));
        tone *= mix(0.78, 1.0, vCard.z);
        vec3 outgoingLight = paintHaze(tone * mix(uLeafShade, uLeafSun, lit) * diffuseColor.rgb + uSkyAdd * (1.0 - lit) * 0.25);`,
    });
    depth = paintDepth({ ...hooks, map: look.mask, alphaTest: 0.5, side: THREE.DoubleSide });
  } else {
    const hooks = cardHooks([0.5, 0.5], 0.3, 0.5);
    leaf = paint({
      ...hooks, map: look.map, alphaTest: 0.4, side: THREE.DoubleSide, keepNormal: true, brush: 0.1, bands: 0, wrap: 0.5, brushScale: 0.05,
      fragmentPars: 'uniform vec3 uLeafSun, uLeafShade; varying vec3 vCard;',
      // The painting carries its own light and shade. The sun only decides how bright the whole bough is.
      fragmentFinal: /* glsl */ `
        float lit = paintLit((vCard.x - 0.5) * 0.1);
        vec3 bough = diffuseColor.rgb * mix(vec3(0.5, 0.66, 0.74), vec3(1.06, 1.03, 0.94), lit) * mix(0.84, 1.0, vCard.z);
        vec3 outgoingLight = paintHaze(bough * mix(uLeafShade, uLeafSun, lit) + uSkyAdd * (1.0 - lit) * 0.25);`,
    });
    depth = paintDepth({ ...hooks, map: look.map, alphaTest: 0.4, side: THREE.DoubleSide });
  }
  // With the scene's multisampled target this softens the cut edge of every leaf.
  leaf.alphaToCoverage = true;
  const wood = paint({
    vertexColors: true, brush: 0.35, bands: 0.7, wrap: 0.3, brushScale: 0.3,
    uniforms: { uBark: { value: textures.bark } },
    fragmentPars: 'uniform sampler2D uBark;',
    fragmentAlbedo: 'diffuseColor.rgb *= 0.55 + 0.9 * texture2D(uBark, vec2(vPaintWorld.x + vPaintWorld.z, vPaintWorld.y) * 0.35).g;',
  });
  return { leaf, depth, wood };
}

export interface Placement { x: number; y: number; z: number; scale: number; turn: number; tint: THREE.Color }

/** Stands one tree shape at many places: two draw calls, plus two in the shadow pass. */
export function plantTrees(shape: TreeShape, materials: Foliage, places: Placement[]): THREE.Group {
  const group = new THREE.Group();
  const leaves = new THREE.InstancedMesh(shape.leaves, materials.leaf, places.length);
  const wood = new THREE.InstancedMesh(shape.wood, materials.wood, places.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), white = new THREE.Color(1, 1, 1);
  places.forEach((place, i) => {
    m.compose(new THREE.Vector3(place.x, place.y, place.z), q.setFromAxisAngle(up, place.turn), new THREE.Vector3(place.scale, place.scale, place.scale));
    leaves.setMatrixAt(i, m); wood.setMatrixAt(i, m);
    leaves.setColorAt(i, place.tint); wood.setColorAt(i, white);
  });
  leaves.customDepthMaterial = materials.depth;
  // A card reaches past the geometry's own bounds once it faces the camera, so the bounds can't cull it.
  leaves.frustumCulled = false;
  for (const mesh of [leaves, wood]) { mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); }
  return group;
}
