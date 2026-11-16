// Trees and bushes of the painted world, the way a background painter builds them: a dark mass first, then dabs of lighter
// leaves on the side the sun reaches. The crown is leaf cards scattered over rounded blobs. Every card
// takes its normal from the blob it sits on, so it gets one tone, and the crown shades as one round form.
// In the vertex shader each card turns to face the camera and is cut to a brush-dab shape by a mask.
//
// Grey drains a tree (`Placement.grey`): its leaves and bark turn toward the grey look's colours, and in the
// dying look (`uGreyThin`) a share of its leaf cards are gone and the dark balls inside the crown shrink, so the
// boughs and twigs stand bare.
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
  /** The colour of that ball before the light is on it. */
  coreColor?: string;
  /** How far up the trunk the boughs leave it, from 0 to 1. A low fork shows long limbs under the crown. */
  fork?: number;
  /** How far below the crown's middle its lowest blobs hang, from 0 to -1. Low values make the edge droop. */
  low?: number;
  /** Cards sit on a blob down to this height on it, from 1 (the top) to -1 (the bottom). */
  under?: number;
  /** Roots that run out over the ground from the trunk's foot, for an old tree. */
  roots?: number;
  /** How thick the roots are where they leave the trunk, and how high up it: 1 is an old tree's, 1.5 a buttressed giant's. */
  buttress?: number;
  /** How much wider the trunk is at its foot than just above it. */
  flare?: number;
  /** Trunks from one foot: 2 is an elder oak split into twin stems that part low and hold up half the crown each. */
  stems?: number;
  /** How many boughs leave the trunk for the crown, and how thick they are as a share of the trunk. */
  limbs?: number;
  limb?: number;
  /** A hollow in the trunk this far up it, from 0 to 1: a bee tree's, where a comb is set in later. */
  hollow?: number;
  /** Twigs inside the crown, which only a thinned crown shows. */
  twigs?: boolean;
}

export interface TreeShape { wood: THREE.BufferGeometry; leaves: THREE.BufferGeometry; cards: number }

function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** How long a mark of painted bark is, round a tube and along it, in meters at a scale of 1. */
const BARK_MARK = 1.3;

class Builder {
  positions: number[] = []; normals: number[] = []; colors: number[] = []; hubs: number[] = []; barks: number[] = []; index: number[] = [];
  /** The middle of the ball the next vertices belong to, or null for wood. */
  hub: THREE.Vector3 | null = null;
  /** `u` and `v` place painted bark: round a tube and along it, so it follows every trunk, bough and root. */
  vertex(p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color, u = 0, v = 0): number {
    this.positions.push(p.x, p.y, p.z); this.normals.push(n.x, n.y, n.z); this.colors.push(c.r, c.g, c.b); this.barks.push(u, v);
    if (this.hub) this.hubs.push(this.hub.x, this.hub.y, this.hub.z, 1); else this.hubs.push(0, 0, 0, 0);
    return this.positions.length / 3 - 1;
  }
  /** A tube through `path`, `sides` round, with the radius given at each point. */
  tube(path: THREE.Vector3[], radii: number[], sides: number, low: THREE.Color, high: THREE.Color): void {
    const p = new THREE.Vector3(), n = new THREE.Vector3(), tangent = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(), c = new THREE.Color();
    const first = this.positions.length / 3;
    // The bark goes round a whole number of times, so its seam meets: a ring has one vertex more than its sides.
    let mean = 0;
    for (const r of radii) mean += r / radii.length;
    const round = Math.max(1, Math.round((Math.PI * 2 * mean) / BARK_MARK));
    let along = 0;
    path.forEach((centre, j) => {
      if (j > 0) along += centre.distanceTo(path[j - 1] as THREE.Vector3) / BARK_MARK;
      tangent.copy(path[Math.min(path.length - 1, j + 1)] as THREE.Vector3).sub(path[Math.max(0, j - 1)] as THREE.Vector3).normalize();
      side.set(1, 0, 0).cross(tangent);
      if (side.lengthSq() < 0.01) side.set(0, 0, 1).cross(tangent);
      side.normalize(); up.copy(tangent).cross(side);
      for (let i = 0; i <= sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        n.copy(side).multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a));
        p.copy(centre).addScaledVector(n, radii[j] as number);
        this.vertex(p, n, c.copy(low).lerp(high, j / (path.length - 1)), (i / sides) * round, along);
      }
    });
    const ring = sides + 1;
    for (let j = 0; j < path.length - 1; j++) {
      for (let i = 0; i < sides; i++) {
        const a = first + j * ring + i, b = a + 1, c2 = a + ring, d = b + ring;
        this.index.push(a, b, c2, b, d, c2);
      }
    }
  }
  /** A faceted ball: the dark inside of a blob of leaves, or with `hub` false a dark hollow, which never shrinks. */
  ball(centre: THREE.Vector3, radius: THREE.Vector3, color: THREE.Color, hub = true): void {
    const g = new THREE.IcosahedronGeometry(1, radius.x > 2.5 ? 1 : 0), pos = g.getAttribute('position');
    const p = new THREE.Vector3(), n = new THREE.Vector3(), first = this.positions.length / 3;
    this.hub = hub ? centre : null;
    for (let i = 0; i < pos.count; i++) {
      n.fromBufferAttribute(pos, i).normalize();
      this.vertex(p.copy(n).multiply(radius).add(centre), n, color);
      this.index.push(first + i);
    }
    this.hub = null;
    g.dispose();
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setAttribute('aHub', new THREE.Float32BufferAttribute(this.hubs, 4));
    g.setAttribute('aBark', new THREE.Float32BufferAttribute(this.barks, 2));
    g.setIndex(this.index);
    return g;
  }
}

const BARK_LOW = new THREE.Color('#8a5c44'), BARK_HIGH = new THREE.Color('#ab7d58'), CORE = new THREE.Color('#3d7547');
/** A hollow's dark: greener than red, so painted bark leaves it its own colour, as it does the crown's dark balls. */
const HOLLOW = new THREE.Color('#1c2117');

/** Builds one tree. A bush is a tree with no height. */
export function buildTree(spec: TreeSpec): TreeShape {
  const r = random(spec.seed), wood = new Builder();
  const crownY = Math.max(spec.crown * spec.squash * 0.75, spec.height - spec.crown * spec.squash * 0.5);
  const crownCentre = new THREE.Vector3(spec.lean, crownY, spec.lean * 0.4);

  // ---- blobs: one in the middle, the rest round it and above it
  const blobs: Array<{ c: THREE.Vector3; r: number }> = [{ c: crownCentre.clone(), r: spec.crown * 0.62 }];
  for (let i = 1; i < spec.blobs; i++) {
    const low = spec.low ?? -0.2;
    const a = (i / (spec.blobs - 1)) * Math.PI * 2 + r() * 0.8, up = low + r() * (0.8 - low), flat = Math.sqrt(Math.max(0, 1 - up * up * 0.7));
    const d = spec.crown * (0.45 + r() * 0.3);
    blobs.push({ c: new THREE.Vector3(Math.cos(a) * flat * d, up * d * spec.squash, Math.sin(a) * flat * d).add(crownCentre), r: spec.crown * (0.3 + r() * 0.2) });
  }

  // ---- trunk and boughs
  if (spec.height > 0) {
    // One trunk, or twin stems that part from one foot toward either half of the crown, each thinner.
    const stems = spec.stems ?? 1, thick = stems > 1 ? 0.72 : 1, flare = spec.flare ?? 0.9;
    const paths: THREE.Vector3[][] = [], radiiOf: number[][] = [];
    for (let s = 0; s < stems; s++) {
      const a = spec.seed + s * Math.PI, apart = stems > 1 ? spec.crown * 0.42 : 0, foot = stems > 1 ? spec.trunk * 0.45 : 0;
      const top = crownCentre.clone().setY(crownY - spec.crown * spec.squash * 0.35).add(new THREE.Vector3(Math.cos(a) * apart, 0, Math.sin(a) * apart));
      const fx = Math.cos(a) * foot, fz = Math.sin(a) * foot;
      const path: THREE.Vector3[] = [], radii: number[] = [];
      for (let j = 0; j <= 6; j++) {
        const t = j / 6;
        path.push(new THREE.Vector3(fx + (top.x - fx) * t * t + Math.sin(t * 5 + spec.seed + s) * spec.trunk * 0.25, top.y * t, fz + (top.z - fz) * t * t));
        radii.push(spec.trunk * thick * (1 + flare * Math.exp(-t * 9)) * (1 - 0.55 * t));
      }
      wood.tube(path, radii, 8, BARK_LOW, BARK_HIGH);
      paths.push(path); radiiOf.push(radii);
    }
    // Each bough leaves the stem nearest the blob it holds up.
    const limb = spec.limb ?? 0.36, fork = Math.round((spec.fork ?? 0.67) * 6);
    for (const blob of blobs.slice(1, 1 + (spec.limbs ?? 5))) {
      let from = (paths[0] as THREE.Vector3[])[fork] as THREE.Vector3;
      for (const path of paths) if ((path[fork] as THREE.Vector3).distanceTo(blob.c) < from.distanceTo(blob.c)) from = path[fork] as THREE.Vector3;
      from = from.clone();
      const mid = from.clone().lerp(blob.c, 0.5).add(new THREE.Vector3(0, -blob.r * 0.25, 0));
      wood.tube([from, mid, blob.c], [spec.trunk * limb, spec.trunk * limb * (2 / 3), spec.trunk * limb * (5 / 18)], 5, BARK_HIGH, BARK_HIGH);
    }
    // A bee tree's hollow: a dark hole set into the trunk's face toward local +x, where its comb is fitted.
    if (spec.hollow !== undefined) {
      const path = paths[0] as THREE.Vector3[], radii = radiiOf[0] as number[], k = Math.max(0, Math.min(5.99, spec.hollow * 6)), j = Math.floor(k);
      const r0 = (radii[j] as number) + ((radii[j + 1] as number) - (radii[j] as number)) * (k - j);
      const at = (path[j] as THREE.Vector3).clone().lerp(path[j + 1] as THREE.Vector3, k - j).add(new THREE.Vector3(r0 * 0.78, 0, 0));
      wood.ball(at, new THREE.Vector3(r0 * 0.32, r0 * 1.15, r0 * 0.62), HOLLOW, false);
    }
    // Twigs from the middle of each blob out toward its leaves. Hidden in a full crown, they are what a dying
    // tree shows when its leaves are gone.
    for (const blob of spec.twigs ? blobs.slice(1) : []) {
      for (let k = 0; k < 2; k++) {
        const a = r() * Math.PI * 2, up = 0.2 + r() * 0.6, end = blob.c.clone().add(new THREE.Vector3(Math.cos(a) * blob.r * 0.9, up * blob.r * spec.squash, Math.sin(a) * blob.r * 0.9));
        wood.tube([blob.c.clone(), blob.c.clone().lerp(end, 0.55).add(new THREE.Vector3(0, blob.r * 0.12, 0)), end], [spec.trunk * 0.09, spec.trunk * 0.05, spec.trunk * 0.015], 3, BARK_HIGH, BARK_HIGH);
      }
    }
    // An old tree's roots: each rises from the trunk's foot, arches over the ground and dives back into it. A
    // buttressed giant's leave it higher and thicker, so the trunk flares into the floor.
    const b = spec.buttress ?? 1;
    for (let k = 0; k < (spec.roots ?? 0); k++) {
      const a = (k / (spec.roots as number)) * Math.PI * 2 + r() * 0.5, out = spec.trunk * (3.2 + r() * 2.6), lift = spec.trunk * (0.25 + r() * 0.35), bend = (r() - 0.5) * 0.6;
      const at = (d: number, y: number, turn: number): THREE.Vector3 => new THREE.Vector3(Math.cos(a + turn) * d, y, Math.sin(a + turn) * d);
      wood.tube([at(spec.trunk * 0.3, spec.trunk * 1.5 * b, 0), at(spec.trunk * 1.2, lift + spec.trunk * 0.3 * b, bend * 0.3), at(out * 0.6, lift, bend * 0.7), at(out, -spec.trunk * 0.2, bend)],
        [spec.trunk * 0.42 * b, spec.trunk * 0.3 * b, spec.trunk * 0.17 * b, spec.trunk * 0.06], 6, BARK_LOW, BARK_HIGH);
    }
  }
  const core = spec.core ?? 0.8, coreColor = spec.coreColor ? new THREE.Color(spec.coreColor) : CORE;
  for (const blob of blobs) wood.ball(blob.c, new THREE.Vector3(blob.r * core, blob.r * core * spec.squash, blob.r * core), coreColor);

  // ---- leaf cards on the blobs
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], cards: number[] = [], index: number[] = [];
  const dir = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  const spin = spec.spin ?? Math.PI, inset = spec.inset ?? [0.92, 1.08], under = spec.under ?? -0.45;
  let count = 0;
  const crownTop = crownY + spec.crown * spec.squash, crownLow = crownY - spec.crown * spec.squash;
  for (const blob of blobs) {
    const wanted = Math.round((spec.cover * 4 * Math.PI * blob.r * blob.r) / (spec.card * spec.card));
    for (let k = 0; k < wanted; k++) {
      // Even spread over the sphere, then a little scatter.
      const y = 1 - (2 * (k + 0.5)) / wanted, ring = Math.sqrt(1 - y * y), a = k * 2.399963 + r() * 0.5;
      dir.set(Math.cos(a) * ring, y, Math.sin(a) * ring);
      if (dir.y < under) continue;
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
export function cardHooks(shape: [number, number], wobble = 1, push = 1.3, hang = 0, thin = false): PaintOptions {
  return {
    vertexPars: `attribute vec4 aCard; varying vec3 vCard;${thin ? ' attribute float aGrey; uniform float uGreyThin; varying float vGrey;' : ''}`,
    // A card of a dying tree may be gone: the grey look thins the crown by each card's own random number.
    vertexBegin: thin ? 'vGrey = aGrey;' : '',
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
      ${thin ? 'if (aCard.z < aGrey * uGreyThin) cardSize = 0.0;' : ''}
      vec2 corner = (uv * 2.0 - 1.0) * cardSize * vec2(${shape[0].toFixed(3)}, ${shape[1].toFixed(3)});
      corner.y -= cardSize * ${(shape[1] * hang).toFixed(3)};
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
/** How the leaves are drawn: a mask of one spray of leaves on every card, coloured in four tones by the light. */
export interface LeafLook {
  mask: THREE.Texture;
  tones: Tones;
  /** How far apart in tone neighbouring cards may be. High values make single sprays of leaves stand out. */
  vary?: number;
  /** How much lighter the top of the crown is than its foot, whatever the sun does. */
  top?: number;
  /** True for a tree that is drawn leaf by leaf however far off it is: a landmark. It never becomes a far tree. */
  always?: boolean;
  /**
   * True when `mask` is a painting of leaves in their own colours (`leaves-old`, `leaves-willow`): it is drawn
   * in those colours under the light, and `tones` only shade it a little.
   */
  painted?: boolean;
  /** The cards hang from where they sit, longer than wide: a willow's strands. */
  hang?: boolean;
  /** A painting of bark in its own colours, and its average colour, for the trunk and boughs. */
  bark?: THREE.Texture;
  barkMean?: THREE.Color;
}

export interface Foliage { leaf: THREE.MeshLambertMaterial; depth: THREE.MeshDepthMaterial; wood: THREE.MeshLambertMaterial }

/** The materials of one kind of tree. */
export function foliageMaterials(textures: Textures, look: LeafLook): Foliage {
  const shape: [number, number] = look.hang ? [0.5, 0.78] : look.painted ? [0.6, 0.6] : [0.62, 0.5];
  const hooks = cardHooks(shape, look.hang ? 0.5 : 1, 1.6, look.hang ? 0.55 : 0, true), air = look.always ? 'paintAir' : 'paintHazeTree';
  // A painted card's own colours, or the mask's grey times the tones.
  const leafColor = look.painted
    ? 'vec3 card = texture2D(map, vMapUv).rgb; float detail = dot(card, vec3(0.3, 0.59, 0.11)) * 1.25;'
    : 'float detail = texture2D(map, vMapUv).r;';
  const leafTone = look.painted
    ? 'tone = mix(card, tone * dot(card, vec3(0.3, 0.59, 0.11)) / max(dot(uTones[2], vec3(0.3, 0.59, 0.11)), 0.01), 0.4) * mix(vec3(0.62, 0.72, 0.8), vec3(1.12, 1.1, 1.0), smoothstep(0.1, 0.9, lit));'
    : '';
  const leaf = paint({
    ...hooks, map: look.mask, alphaTest: 0.5, side: THREE.DoubleSide, keepNormal: true, brush: 0.1, bands: 0, wrap: 0.5, brushScale: 0.05, see: 'leaves',
    uniforms: { uTones: { value: look.tones.map((t) => new THREE.Color(t)) }, uVary: { value: look.vary ?? 0.12 }, uTop: { value: look.top ?? 0 } },
    fragmentPars: 'uniform vec3 uTones[4], uLeafSun, uLeafShade, uGreyLeaf; uniform float uVary, uTop, uGreyDrain; varying vec3 vCard; varying float vGrey;',
    // The tone runs smoothly from deep shade to the sunlit top. The mask's own brush marks shift it a little,
    // so single leaves catch the light, and leaves low in the crown are darker.
    fragmentFinal: /* glsl */ `
      ${leafColor}
      float lit = paintLit((vCard.x - 0.5) * uVary + (detail - 0.85) * 0.7 + vCard.y * 0.06);
      lit = clamp(lit + (vCard.z - 0.6) * uTop, 0.0, 1.0);
      vec3 tone = mix(uTones[0], uTones[1], smoothstep(0.08, 0.36, lit));
      tone = mix(tone, uTones[2], smoothstep(0.36, 0.66, lit));
      tone = mix(tone, uTones[3], smoothstep(0.7, 0.96, lit));
      ${leafTone}
      tone *= mix(0.78, 1.0, vCard.z);
      // Grey drains the leaves toward the grey look's colour, keeping how light each one is: a crown's ash is a little
      // creamier than the grass's grey-green under it.
      tone = mix(tone, uGreyLeaf * vec3(1.2, 1.1, 1.06) * (0.18 + dot(tone, vec3(0.3, 0.59, 0.11)) / dot(uGreyLeaf, vec3(0.3, 0.59, 0.11)) * 1.15), vGrey * uGreyDrain);
      // The leaf's own colour is in diffuseColor too (the map); grey drains that as well, or a drained crown keeps
      // its painting's green under the ash and reads olive.
      float leafLight = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
      vec3 leafTint = mix(diffuseColor.rgb, vec3(min(1.0, leafLight * 1.3)), vGrey * uGreyDrain);
      vec3 outgoingLight = ${air}(tone * mix(uLeafShade, uLeafSun, lit) * leafTint + uSkyAdd * (1.0 - lit) * 0.25);`,
  });
  const depth = paintDepth({ ...hooks, map: look.mask, alphaTest: 0.5, side: THREE.DoubleSide });
  // With the scene's multisampled target this softens the cut edge of every leaf.
  leaf.alphaToCoverage = true;
  const painted = look.bark !== undefined;
  const wood = paint({
    vertexColors: true, brush: 0.35, bands: 0.7, wrap: 0.3, brushScale: 0.3, see: 'wood',
    uniforms: { uBark: { value: look.bark ?? textures.bark }, uBarkMean: { value: look.barkMean ?? new THREE.Color(1, 1, 1) } },
    vertexPars: 'attribute vec4 aHub; attribute vec2 aBark; attribute float aGrey; uniform float uGreyThin; varying float vGrey; varying vec2 vBark;',
    // A dying tree's dark balls of shade shrink into the middle of their blobs, so its boughs stand bare.
    // Painted bark is laid round each tube and along it (`aBark`), so its grooves follow every trunk, bough and root;
    // world-flat bark breaks into zigzags where a trunk turns from it.
    vertexBegin: 'vGrey = aGrey; vBark = aBark; transformed = mix(transformed, aHub.xyz, aHub.w * min(1.0, aGrey * uGreyThin * 1.6));',
    fragmentPars: 'uniform sampler2D uBark; uniform vec3 uBarkMean, uGreyBark; uniform float uGreyDrain; varying float vGrey; varying vec2 vBark;',
    // The dark balls inside a crown go as soon as its leaves start to, never left as flat shapes where leaves were.
    fragmentAlbedo: 'if (diffuseColor.g > diffuseColor.r && paintSeeCut(vPaintWorld, 1.0) > 0.02) discard;\n' + (painted
      // Painted bark in its own colours, laid on the wood's warm-to-pale ramp. The dark balls inside the crown take the
      // painted leaves' deep olive, as dark as they were.
      // Warmed toward the vista's ochre: the painting's lavender is left for the shade to bring.
      ? `vec3 barkPaint = texture2D(uBark, vBark).rgb * vec3(1.3, 1.0, 0.68);
      diffuseColor.rgb = mix(barkPaint * (0.55 + 0.6 * dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)) / dot(uBarkMean, vec3(0.3, 0.59, 0.11))), dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)) * vec3(0.8, 1.0, 0.5), step(0.5, diffuseColor.g - diffuseColor.r + 0.5));`
      : 'diffuseColor.rgb *= 0.55 + 0.9 * texture2D(uBark, vec2(vPaintWorld.x + vPaintWorld.z, vPaintWorld.y) * 0.35).g;')
      // Grey drains the bark toward the grey look's colour, a mid lavender-grey under the light, its grooves soft marks
      // of the painting's own lightness. (The painting is sampled as it is stored and its mean is in linear light, so
      // their ratio is no measure of a mark: it washed drained bark to white.)
      + 'diffuseColor.rgb = mix(diffuseColor.rgb, uGreyBark * 1.05 * (0.6 + 0.8 * dot(texture2D(uBark, vBark).rgb, vec3(0.3, 0.59, 0.11))), vGrey * uGreyDrain);',
    fragmentFinal: `vec3 outgoingLight = ${air}(paintShade(diffuseColor.rgb, paintLit(0.0))) + totalEmissiveRadiance;`,
  });
  return { leaf, depth, wood };
}

/** Where one tree stands. `fall` is how far it has tipped over, in radians, and `toward` the compass angle it falls to. */
export interface Placement { x: number; y: number; z: number; scale: number; turn: number; tint: THREE.Color; fall?: number; toward?: number; grey?: number }

export interface Stand {
  readonly group: THREE.Group;
  /** Stands the shape at these places, and nowhere else. It keeps room for `capacity` of them. */
  plant(places: readonly Placement[]): void;
  readonly count: number;
  /** Triangles drawn for the trees that stand now. */
  readonly triangles: number;
  /** Triangles of one tree, its shadow left out. */
  readonly each: number;
}

/**
 * One tree shape that can stand at many places, which change as trees are felled and the land loads: two draw
 * calls, plus two in the shadow pass when it casts a shadow.
 */
export function createStand(shape: TreeShape, materials: Foliage, capacity: number, shadows: boolean): Stand {
  const group = new THREE.Group();
  // How grey each tree is, read by the leaves' and the wood's shaders. Each stand has its own copies of the shape.
  const leafShape = shape.leaves.clone(), woodShape = shape.wood.clone(), greys = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  greys.setUsage(THREE.DynamicDrawUsage);
  leafShape.setAttribute('aGrey', greys);
  woodShape.setAttribute('aGrey', greys);
  if (!woodShape.getAttribute('aHub')) woodShape.setAttribute('aHub', new THREE.Float32BufferAttribute(new Float32Array((woodShape.getAttribute('position')?.count ?? 0) * 4), 4));
  const leaves = new THREE.InstancedMesh(leafShape, materials.leaf, capacity);
  const wood = new THREE.InstancedMesh(woodShape, materials.wood, capacity);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), white = new THREE.Color(1, 1, 1), at = new THREE.Vector3(), size = new THREE.Vector3();
  const tip = new THREE.Quaternion(), axis = new THREE.Vector3();
  leaves.customDepthMaterial = materials.depth;
  // A card reaches past the geometry's own bounds once it faces the camera, so each mesh is culled by a ball of
  // its own round every tree it holds, wide enough for the cards (`plant` works it out). A kind of tree whose
  // trees are all off screen, or out of the sun's shadow box, costs no draw call.
  shape.leaves.computeBoundingSphere();
  shape.wood.computeBoundingSphere();
  const leafBall = shape.leaves.boundingSphere as THREE.Sphere, woodBall = shape.wood.boundingSphere;
  /** How far a tree of scale 1 reaches from its root, its cards facing any way included. */
  const reachOf = Math.max(leafBall.center.length() + leafBall.radius, woodBall ? woodBall.center.length() + woodBall.radius : 0) + 1.5;
  const ball = new THREE.Sphere();
  leaves.boundingSphere = wood.boundingSphere = ball;
  // A shape with no wood, a bush, is its leaves alone.
  const hasWood = (shape.wood.index?.count ?? 0) > 0;
  for (const mesh of hasWood ? [leaves, wood] : [leaves]) {
    mesh.count = 0;
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);
  }
  group.visible = false;
  const perTree = ((shape.leaves.index?.count ?? 0) + (shape.wood.index?.count ?? 0)) / 3;
  return {
    group,
    plant(places) {
      const n = Math.min(capacity, places.length);
      // The ball round them all: the middle of their roots, out to the farthest crown.
      let mx = 0, my = 0, mz = 0;
      for (let i = 0; i < n; i++) { const place = places[i] as Placement; mx += place.x; my += place.y; mz += place.z; }
      ball.center.set(mx / Math.max(1, n), my / Math.max(1, n), mz / Math.max(1, n));
      ball.radius = 0;
      for (let i = 0; i < n; i++) {
        const place = places[i] as Placement;
        ball.radius = Math.max(ball.radius, Math.hypot(place.x - ball.center.x, place.y - ball.center.y, place.z - ball.center.z) + reachOf * place.scale);
      }
      for (let i = 0; i < n; i++) {
        const place = places[i] as Placement;
        q.setFromAxisAngle(up, place.turn);
        if (place.fall) q.premultiply(tip.setFromAxisAngle(axis.set(Math.cos(place.toward ?? 0), 0, -Math.sin(place.toward ?? 0)), place.fall));
        m.compose(at.set(place.x, place.y, place.z), q, size.setScalar(place.scale));
        leaves.setMatrixAt(i, m); wood.setMatrixAt(i, m);
        leaves.setColorAt(i, place.tint); wood.setColorAt(i, white);
        greys.setX(i, place.grey ?? 0);
      }
      greys.needsUpdate = true;
      leaves.count = wood.count = n;
      // An empty stand is not drawn at all: it would still cost a draw call.
      group.visible = n > 0;
      leaves.instanceMatrix.needsUpdate = wood.instanceMatrix.needsUpdate = true;
      if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      if (wood.instanceColor) wood.instanceColor.needsUpdate = true;
    },
    get count() { return leaves.count; },
    get triangles() { return leaves.count * perTree; },
    each: perTree,
  };
}
