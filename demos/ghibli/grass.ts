// The meadow's grass and flowers. A blade's root has the ground's own colour and its normal points up, so
// the field and the ground read as one surface. Gusts of wind travel across it, bend the blades and lift
// their pale tips: the moving band of light a film's grass has.
import * as THREE from 'three';
import { GREAT_TREE, HOUSE, bare, fbm, groundColor, heightAt, noise, smoothstep } from './land.ts';
import { paint } from './paint.ts';
import { cardHooks } from './trees.ts';
import type { Textures } from './textures.ts';

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

/** Rings of grass round the middle of the scene: fine blades near, broad strokes far. */
const RINGS = [
  { to: 30, spacing: 0.44, width: [0.11, 0.19], height: [0.28, 0.6] },
  { to: 62, spacing: 0.84, width: [0.22, 0.35], height: [0.36, 0.8] },
  { to: 112, spacing: 1.7, width: [0.5, 0.75], height: [0.5, 1.0] },
] as const;
const MIDDLE = { x: 0, z: 20 };

/** How tall the grass grows at a spot, from 0 to 1: long grass comes in patches. */
const tallness = (x: number, z: number): number => smoothstep(0.38, 0.7, fbm(x / 17, z / 17, 2, 55));

/** True where nothing should grow: the cottage's yard and the foot of the great tree. */
function cleared(x: number, z: number): boolean {
  return Math.hypot(x - HOUSE.x, z - HOUSE.z) < 7.5 || Math.hypot(x - GREAT_TREE.x, z - GREAT_TREE.z) < 2.2;
}

export function createGrass(quality: 'low' | 'medium' | 'high'): THREE.InstancedMesh {
  const thin = quality === 'high' ? 1 : quality === 'medium' ? 1.35 : 1.9;
  const r = random(90210), color = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const matrices: number[] = [], colors: number[] = [];
  let from = 0;
  for (const ring of RINGS) {
    const spacing = ring.spacing * thin;
    for (let z = MIDDLE.z - ring.to; z < MIDDLE.z + ring.to; z += spacing) {
      for (let x = MIDDLE.x - ring.to; x < MIDDLE.x + ring.to; x += spacing) {
        const px = x + (r() - 0.5) * spacing, pz = z + (r() - 0.5) * spacing, d = Math.hypot(px - MIDDLE.x, pz - MIDDLE.z);
        const open = 1 - bare(px, pz);
        if (d < from || d >= ring.to || open < 0.5 || cleared(px, pz) || r() > open) continue;
        // Long grass grows in patches and stays short beside the path.
        const tall = 0.55 + 1.05 * tallness(px, pz);
        const width = ring.width[0] + r() * (ring.width[1] - ring.width[0]);
        const height = (ring.height[0] + r() * (ring.height[1] - ring.height[0])) * tall * (0.5 + 0.5 * open);
        m.compose(new THREE.Vector3(px, heightAt(px, pz) - 0.03, pz), q.setFromAxisAngle(up, r() * Math.PI * 2), new THREE.Vector3(width, height, width));
        matrices.push(...m.elements);
        groundColor(px, pz, color);
        colors.push(color.r, color.g, color.b);
      }
    }
    from = ring.to;
  }
  const count = matrices.length / 16;
  const material = paint({
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
  const mesh = new THREE.InstancedMesh(bladeGeometry(), material, count);
  mesh.instanceMatrix.copyArray(matrices);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(colors), 3);
  mesh.name = 'grass';
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

const PETALS = ['#fffaf0', '#fffaf0', '#f8dd6a', '#f8dd6a', '#f4aebd', '#cdb8f0'].map((h) => new THREE.Color(h));

/** Small flower heads in drifts, each a card that faces the camera. */
export function createFlowers(textures: Textures, wanted: number): THREE.InstancedMesh {
  const r = random(4242), m = new THREE.Matrix4();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const material = paint({ ...cardHooks([0.5, 0.5]), map: textures.flower, alphaTest: 0.5, side: THREE.DoubleSide, keepNormal: true, brush: 0.1, bands: 0.2, wrap: 0.6 });
  material.alphaToCoverage = true;
  const mesh = new THREE.InstancedMesh(geometry, material, wanted);
  const cards = new Float32Array(wanted * 4);
  let placed = 0;
  for (let tries = 0; placed < wanted && tries < wanted * 40; tries++) {
    const x = (r() - 0.5) * 150, z = 20 + (r() - 0.5) * 150;
    // Drifts: flowers grow where a slow noise is high, and one colour leads in each drift.
    const drift = fbm(x / 13, z / 13, 2, 77);
    if (drift < 0.56 || bare(x, z) > 0.2 || cleared(x, z)) continue;
    const lead = Math.floor(noise(x / 30, z / 30, 78) * PETALS.length), pick = r() < 0.7 ? lead : Math.floor(r() * PETALS.length);
    m.makeTranslation(x, heightAt(x, z) + 0.22 + r() * 0.3, z);
    mesh.setMatrixAt(placed, m);
    mesh.setColorAt(placed, PETALS[Math.min(PETALS.length - 1, pick)] as THREE.Color);
    cards.set([0.2 + r() * 0.16, r() * 6.283, r(), 0.5], placed * 4);
    placed++;
  }
  mesh.count = placed;
  geometry.setAttribute('aCard', new THREE.InstancedBufferAttribute(cards, 4));
  mesh.name = 'flowers';
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * Tufts of long grass, each one painted stroke by stroke on a card. They stand where the grass is long, dark
 * at the foot and pale at the tips, and they are what the eye reads as brushwork in the field.
 */
export function createTufts(textures: Textures, wanted: number): THREE.Group {
  const r = random(777), m = new THREE.Matrix4(), color = new THREE.Color(), group = new THREE.Group();
  textures.tufts.forEach((mask, which) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
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
    const count = Math.floor(wanted / textures.tufts.length), mesh = new THREE.InstancedMesh(geometry, material, count), cards = new Float32Array(count * 4);
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 30; tries++) {
      // Most tufts stand near the middle of the scene, where the camera is.
      const a = r() * Math.PI * 2, d = 4 + Math.pow(r(), 1.6) * 95, x = MIDDLE.x + Math.cos(a) * d, z = MIDDLE.z + Math.sin(a) * d;
      if (bare(x, z) > 0.15 || cleared(x, z) || r() > 0.25 + 0.75 * tallness(x, z)) continue;
      m.makeTranslation(x, heightAt(x, z) - 0.04, z);
      mesh.setMatrixAt(placed, m);
      groundColor(x, z, color);
      mesh.setColorAt(placed, color);
      cards.set([(0.55 + r() * 0.75) * (0.8 + 0.5 * tallness(x, z)) * (1 + d / 90), r(), r(), 1], placed * 4);
      placed++;
    }
    mesh.count = placed;
    geometry.setAttribute('aCard', new THREE.InstancedBufferAttribute(cards, 4));
    mesh.name = `tufts-${which}`;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  });
  return group;
}
